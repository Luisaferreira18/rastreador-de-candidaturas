-- =============================================================================
-- Caça-concursos: perfil de busca, catálogo de editais encontrados e sugestões.
--
-- O catálogo (concurso_notices) é compartilhado: os editais do Diário Oficial
-- da União e dos diários municipais são os mesmos para todo mundo, e o arquivo
-- do DOU é grande. Só o cron (com a chave secreta) grava nele; quem está
-- logado só lê. Cada pessoa tem as próprias sugestões (concurso_leads), com a
-- nota e os motivos calculados para o seu perfil.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil de busca
-- -----------------------------------------------------------------------------
create table public.concurso_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  education text not null default 'superior' check (education in ('fundamental', 'medio', 'tecnico', 'superior')),
  areas text[] not null default '{}' check (cardinality(areas) <= 10),
  roles text[] not null default '{}' check (cardinality(roles) <= 10),
  spheres text[] not null default '{federal,estadual,municipal}'
    check (cardinality(spheres) between 1 and 3 and spheres <@ array['federal', 'estadual', 'municipal']),
  -- "Belo Horizonte/MG"
  cities text[] not null default '{}' check (cardinality(cities) <= 10),
  states text[] not null default '{}' check (cardinality(states) <= 27),
  min_salary_cents integer check (min_salary_cents is null or min_salary_cents between 0 and 100000000),
  exam_boards text[] not null default '{}' check (cardinality(exam_boards) <= 10),
  accepts_relocation boolean not null default false,
  auto_search boolean not null default true,
  last_run_at timestamptz,
  last_run_stats jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.concurso_profiles is 'O que a pessoa procura em concursos (usado pelo caça-concursos).';

-- -----------------------------------------------------------------------------
-- Catálogo compartilhado de editais encontrados
-- -----------------------------------------------------------------------------
create table public.concurso_notices (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('dou', 'querido_diario')),
  -- Id na fonte: idMateria no DOU; "<território>:<nº do concurso>" no Querido Diário.
  external_id text not null check (char_length(external_id) between 1 and 200),
  organ text not null check (char_length(organ) between 1 and 200),
  title text check (title is null or char_length(title) <= 300),
  -- [{ "title": "Analista...", "education": "superior" }]
  roles jsonb not null default '[]' check (jsonb_typeof(roles) = 'array'),
  exam_board text check (exam_board is null or char_length(exam_board) <= 80),
  sphere text check (sphere is null or sphere in ('federal', 'estadual', 'municipal')),
  salary_cents integer check (salary_cents is null or salary_cents between 0 and 100000000),
  vacancies integer check (vacancies is null or vacancies between 0 and 100000),
  reserve_list boolean not null default false,
  city text check (city is null or char_length(city) <= 120),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  notice_url text not null check (notice_url ~ '^https?://' and char_length(notice_url) <= 2048),
  registration_url text check (registration_url is null or (registration_url ~ '^https?://' and char_length(registration_url) <= 2048)),
  published_at date,
  -- [{ "kind": "prova", "date": "2026-12-06", "time": "08:00", "note": "..." }]
  dates jsonb not null default '[]' check (jsonb_typeof(dates) = 'array'),
  excerpt text check (excerpt is null or char_length(excerpt) <= 2000),
  found_at timestamptz not null default now(),
  unique (source, external_id)
);

comment on table public.concurso_notices is 'Editais de abertura encontrados pelo caça-concursos (DOU e Querido Diário). Compartilhado.';

create index concurso_notices_found_idx on public.concurso_notices (found_at desc);

-- -----------------------------------------------------------------------------
-- Sugestões de cada pessoa
-- -----------------------------------------------------------------------------
create table public.concurso_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notice_id uuid not null references public.concurso_notices (id) on delete cascade,
  -- O cargo do edital que mais combina com o perfil.
  role text check (role is null or char_length(role) <= 200),
  score smallint not null check (score between 0 and 100),
  reasons text[] not null default '{}' check (cardinality(reasons) <= 10),
  warnings text[] not null default '{}' check (cardinality(warnings) <= 10),
  status text not null default 'nova' check (status in ('nova', 'acompanhando', 'descartada')),
  concurso_id uuid references public.concursos (id) on delete set null,
  found_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- O mesmo edital nunca é sugerido duas vezes, nem depois de descartado.
  unique (user_id, notice_id)
);

create index concurso_leads_user_status_idx on public.concurso_leads (user_id, status, score desc);

-- -----------------------------------------------------------------------------
-- Controle das fontes (até que dia o DOU já foi lido, por exemplo). Só o cron usa.
-- -----------------------------------------------------------------------------
create table public.concurso_source_runs (
  source text primary key check (source in ('dou', 'querido_diario')),
  last_date date,
  last_run_at timestamptz,
  stats jsonb
);

-- -----------------------------------------------------------------------------
-- Permissões e RLS
-- -----------------------------------------------------------------------------
revoke all on public.concurso_profiles, public.concurso_notices, public.concurso_leads, public.concurso_source_runs from anon;
revoke all on public.concurso_source_runs from authenticated;
grant select, insert, update, delete on public.concurso_profiles, public.concurso_leads to authenticated;
-- O catálogo é só leitura para quem está logado; quem grava é o cron (chave secreta).
revoke all on public.concurso_notices from authenticated;
grant select on public.concurso_notices to authenticated;
revoke truncate on public.concurso_profiles, public.concurso_leads from authenticated;

alter table public.concurso_profiles enable row level security;
alter table public.concurso_notices enable row level security;
alter table public.concurso_leads enable row level security;
alter table public.concurso_source_runs enable row level security;

create policy "Usuário lê o próprio perfil de concursos"
  on public.concurso_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria o próprio perfil de concursos"
  on public.concurso_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza o próprio perfil de concursos"
  on public.concurso_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Usuário exclui o próprio perfil de concursos"
  on public.concurso_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Quem está logado lê o catálogo de editais"
  on public.concurso_notices for select to authenticated
  using (true);

create policy "Usuário lê as próprias sugestões de concursos"
  on public.concurso_leads for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário grava sugestões de concursos para si"
  on public.concurso_leads for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza as próprias sugestões de concursos"
  on public.concurso_leads for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      concurso_id is null
      or exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
    )
  );

create policy "Usuário exclui as próprias sugestões de concursos"
  on public.concurso_leads for delete to authenticated
  using ((select auth.uid()) = user_id);
