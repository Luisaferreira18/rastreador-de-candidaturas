-- =============================================================================
-- Caça-vagas: perfil de busca e vagas sugeridas.
--
-- Uma vez por dia (cron da Vercel, ou quando a pessoa abre o app) o servidor
-- busca vagas em fontes públicas (Gupy, Greenhouse e Lever), dá uma nota de
-- compatibilidade com o perfil e grava as melhores aqui.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil de busca (um por usuário)
-- -----------------------------------------------------------------------------
create table public.job_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Cargos procurados ("Estágio em Dados", "Analista de BI").
  roles text[] not null check (cardinality(roles) between 1 and 8),
  -- Habilidades do currículo: vagas que citam mais delas sobem na lista.
  keywords text[] not null default '{}' check (cardinality(keywords) <= 30),
  -- Vagas com essas palavras no título não aparecem.
  excluded_words text[] not null default '{}' check (cardinality(excluded_words) <= 30),
  city text check (city is null or char_length(city) <= 80),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  work_models text[] not null default '{presencial,hibrido,remoto}' check (
    cardinality(work_models) >= 1
    and work_models <@ array['presencial', 'hibrido', 'remoto']::text[]
  ),
  job_types text[] not null default '{estagio}' check (
    cardinality(job_types) >= 1
    and job_types <@ array['estagio', 'trainee', 'clt', 'pj', 'temporario', 'freela']::text[]
  ),
  min_salary_cents integer check (min_salary_cents is null or min_salary_cents between 0 and 100000000),
  use_gupy boolean not null default true,
  -- Lista pronta de empresas que publicam vagas no Greenhouse e no Lever.
  use_company_boards boolean not null default true,
  -- Outras páginas de vagas, no formato "greenhouse:empresa" ou "lever:empresa".
  extra_boards text[] not null default '{}' check (cardinality(extra_boards) <= 20),
  auto_search boolean not null default true,
  last_run_at timestamptz,
  -- Resumo da última busca: vagas analisadas, compatíveis, novas e fontes com erro.
  last_run_stats jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.job_profiles is 'O que cada pessoa procura: usado pela busca diária de vagas.';

-- -----------------------------------------------------------------------------
-- Vagas sugeridas
-- -----------------------------------------------------------------------------
create table public.job_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('gupy', 'greenhouse', 'lever')),
  -- Id da vaga na fonte: a mesma vaga nunca é sugerida duas vezes.
  external_id text not null check (char_length(external_id) <= 200),
  company text not null check (char_length(company) between 1 and 120),
  title text not null check (char_length(title) between 1 and 200),
  url text not null check (char_length(url) <= 2048 and url ~ '^https://'),
  location text check (location is null or char_length(location) <= 200),
  work_model text check (work_model is null or work_model in ('presencial', 'hibrido', 'remoto')),
  job_type text check (job_type is null or job_type in ('estagio', 'trainee', 'clt', 'pj', 'temporario', 'freela')),
  salary_cents integer check (salary_cents is null or salary_cents >= 0),
  published_at timestamptz,
  deadline date,
  -- Nota de compatibilidade (0 a 100) e os motivos, para a pessoa entender a nota.
  score smallint not null check (score between 0 and 100),
  reasons text[] not null default '{}' check (cardinality(reasons) <= 10),
  warnings text[] not null default '{}' check (cardinality(warnings) <= 10),
  status text not null default 'nova' check (status in ('nova', 'adicionada', 'descartada')),
  application_id uuid references public.applications (id) on delete set null,
  found_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.job_leads is 'Vagas encontradas pela busca diária, com a nota de compatibilidade.';

create unique index job_leads_user_source_external_idx on public.job_leads (user_id, source, external_id);
create index job_leads_user_status_idx on public.job_leads (user_id, status, score desc);
create index job_leads_application_idx on public.job_leads (application_id);
-- O cron procura os perfis com busca automática pendente.
create index job_profiles_auto_search_idx on public.job_profiles (last_run_at nulls first) where auto_search;

-- -----------------------------------------------------------------------------
-- Permissões e RLS
-- -----------------------------------------------------------------------------
revoke all on public.job_profiles, public.job_leads from anon;
grant select, insert, update, delete on public.job_profiles to authenticated;
grant select, insert, update, delete on public.job_leads to authenticated;
revoke truncate on public.job_profiles, public.job_leads from authenticated;

alter table public.job_profiles enable row level security;
alter table public.job_leads enable row level security;

create policy "Usuário lê o próprio perfil de busca"
  on public.job_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria o próprio perfil de busca"
  on public.job_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza o próprio perfil de busca"
  on public.job_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Usuário exclui o próprio perfil de busca"
  on public.job_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário lê as próprias vagas sugeridas"
  on public.job_leads for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário grava vagas sugeridas para si"
  on public.job_leads for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza as próprias vagas sugeridas"
  on public.job_leads for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      application_id is null
      or exists (
        select 1 from public.applications a
        where a.id = application_id and a.user_id = (select auth.uid())
      )
    )
  );

create policy "Usuário exclui as próprias vagas sugeridas"
  on public.job_leads for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Resumo diário: passa a incluir as vagas novas das últimas 24 horas.
-- -----------------------------------------------------------------------------
create or replace function public.report_snapshot(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.user_from_inbox_token(p_token);
begin
  if v_user is null then
    raise exception 'Token inválido.' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'company', a.company, 'role_title', a.role_title, 'stage', a.stage,
        'platform', a.platform, 'stage_changed_at', a.stage_changed_at,
        'applied_at', a.applied_at, 'created_at', a.created_at
      ))
      from public.applications a where a.user_id = v_user
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'application_id', h.application_id, 'from_stage', h.from_stage,
        'to_stage', h.to_stage, 'changed_at', h.changed_at
      ))
      from public.stage_history h where h.user_id = v_user
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'application_id', t.application_id, 'title', t.title, 'due_date', t.due_date
      ))
      from public.tasks t where t.user_id = v_user and not t.done
    ), '[]'::jsonb),
    'pending_suggestions', (
      select count(*) from public.inbox_items i where i.user_id = v_user and i.status = 'pendente'
    ),
    'new_leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'company', l.company, 'title', l.title, 'url', l.url, 'score', l.score
      ) order by l.score desc, l.found_at desc)
      from (
        select * from public.job_leads l
        where l.user_id = v_user and l.status = 'nova' and l.found_at >= now() - interval '24 hours'
        order by l.score desc, l.found_at desc
        limit 5
      ) l
    ), '[]'::jsonb),
    'new_leads_count', (
      select count(*) from public.job_leads l
      where l.user_id = v_user and l.status = 'nova' and l.found_at >= now() - interval '24 hours'
    )
  );
end;
$$;

revoke all on function public.report_snapshot(text) from public, authenticated;
grant execute on function public.report_snapshot(text) to anon;
