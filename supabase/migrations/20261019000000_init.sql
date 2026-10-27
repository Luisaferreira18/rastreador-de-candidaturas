-- =============================================================================
-- Rastreador de candidaturas — esquema inicial
-- Tabelas: applications (candidaturas), stage_history (histórico de etapas)
-- e tasks (próximos passos). Todas protegidas por Row Level Security.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: applications
-- -----------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null check (char_length(company) between 1 and 120),
  role_title text not null check (char_length(role_title) between 1 and 160),
  job_url text check (job_url is null or char_length(job_url) <= 2048),
  platform text not null default 'linkedin'
    check (platform in ('gupy', 'linkedin', 'site_empresa', 'indicacao', 'outra')),
  location text check (location is null or char_length(location) <= 120),
  work_model text not null default 'presencial'
    check (work_model in ('presencial', 'hibrido', 'remoto')),
  -- Valor da bolsa em centavos, para evitar erros de arredondamento.
  stipend_cents integer check (stipend_cents is null or stipend_cents between 0 and 100000000),
  applied_at date,
  stage text not null default 'quero_candidatar'
    check (stage in (
      'quero_candidatar', 'enviada', 'teste_online', 'dinamica_case', 'entrevista_rh',
      'entrevista_tecnica', 'proposta', 'aprovada', 'reprovada', 'desisti'
    )),
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  notes text check (notes is null or char_length(notes) <= 10000),
  -- Ordem do card dentro da coluna do Kanban (menor = mais acima).
  -- O padrão coloca candidaturas novas no topo da coluna.
  position double precision not null default (-extract(epoch from now())),
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.applications is 'Candidaturas a vagas de estágio.';

create index applications_user_stage_position_idx
  on public.applications (user_id, stage, position);

-- -----------------------------------------------------------------------------
-- Tabela: stage_history (preenchida automaticamente por trigger)
-- -----------------------------------------------------------------------------
create table public.stage_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_stage text check (from_stage is null or from_stage in (
    'quero_candidatar', 'enviada', 'teste_online', 'dinamica_case', 'entrevista_rh',
    'entrevista_tecnica', 'proposta', 'aprovada', 'reprovada', 'desisti'
  )),
  to_stage text not null check (to_stage in (
    'quero_candidatar', 'enviada', 'teste_online', 'dinamica_case', 'entrevista_rh',
    'entrevista_tecnica', 'proposta', 'aprovada', 'reprovada', 'desisti'
  )),
  changed_at timestamptz not null default now()
);

comment on table public.stage_history is 'Linha do tempo das mudanças de etapa de cada candidatura.';

create index stage_history_application_idx on public.stage_history (application_id, changed_at);
create index stage_history_user_idx on public.stage_history (user_id);

-- -----------------------------------------------------------------------------
-- Tabela: tasks (próximos passos)
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.tasks is 'Próximos passos (tarefas com prazo) ligados a uma candidatura.';

create index tasks_user_due_idx on public.tasks (user_id, done, due_date);
create index tasks_application_idx on public.tasks (application_id);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Antes de atualizar: mantém updated_at e stage_changed_at em dia.
-- Se quem atualiza já informou um stage_changed_at diferente (ex.: dados de
-- exemplo com datas no passado), o valor informado é respeitado.
create or replace function public.applications_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage
     and new.stage_changed_at is not distinct from old.stage_changed_at then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger applications_before_update
  before update on public.applications
  for each row execute function public.applications_before_update();

-- Depois de criar ou mudar de etapa: registra no histórico.
-- Fica no banco para que nenhuma mudança escape do histórico,
-- venha ela do Kanban, do formulário ou de qualquer outro cliente.
create or replace function public.applications_log_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.stage_history (application_id, user_id, from_stage, to_stage, changed_at)
    values (new.id, new.user_id, null, new.stage, new.stage_changed_at);
  elsif new.stage is distinct from old.stage then
    insert into public.stage_history (application_id, user_id, from_stage, to_stage, changed_at)
    values (new.id, new.user_id, old.stage, new.stage, new.stage_changed_at);
  end if;
  return null;
end;
$$;

create trigger applications_log_stage_insert
  after insert on public.applications
  for each row execute function public.applications_log_stage();

create trigger applications_log_stage_update
  after update of stage on public.applications
  for each row execute function public.applications_log_stage();

-- Marca/desmarca a data de conclusão das tarefas.
create or replace function public.tasks_set_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.completed_at := now();
  elsif not new.done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_set_completed_at
  before insert or update on public.tasks
  for each row execute function public.tasks_set_completed_at();

-- -----------------------------------------------------------------------------
-- Permissões e Row Level Security
-- Cada usuário só enxerga e altera as próprias linhas.
-- -----------------------------------------------------------------------------
revoke all on public.applications, public.stage_history, public.tasks from anon;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, delete on public.stage_history to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

alter table public.applications enable row level security;
alter table public.stage_history enable row level security;
alter table public.tasks enable row level security;

-- applications
create policy "Usuário lê as próprias candidaturas"
  on public.applications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria candidaturas para si"
  on public.applications for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza as próprias candidaturas"
  on public.applications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Usuário exclui as próprias candidaturas"
  on public.applications for delete to authenticated
  using ((select auth.uid()) = user_id);

-- stage_history (o histórico não pode ser editado, só lido, criado e apagado)
create policy "Usuário lê o próprio histórico"
  on public.stage_history for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário registra histórico das próprias candidaturas"
  on public.stage_history for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy "Usuário apaga o próprio histórico"
  on public.stage_history for delete to authenticated
  using ((select auth.uid()) = user_id);

-- tasks
create policy "Usuário lê as próprias tarefas"
  on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria tarefas nas próprias candidaturas"
  on public.tasks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy "Usuário atualiza as próprias tarefas"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = (select auth.uid())
    )
  );

create policy "Usuário exclui as próprias tarefas"
  on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);
