-- =============================================================================
-- Concursos públicos: cadastro, etapas, cronograma e matérias.
--
-- Concurso não segue as etapas de vaga (não tem entrevista), então tem tabelas
-- próprias, no mesmo padrão das candidaturas: histórico de etapa gravado por
-- trigger, posição no quadro, RLS em tudo. As tarefas com prazo passam a poder
-- pertencer a uma candidatura OU a um concurso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela: concursos
-- -----------------------------------------------------------------------------
create table public.concursos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  organ text not null check (char_length(organ) between 1 and 160),
  role_title text not null check (char_length(role_title) between 1 and 160),
  exam_board text check (exam_board is null or char_length(exam_board) <= 80),
  sphere text not null default 'federal' check (sphere in ('federal', 'estadual', 'municipal')),
  education text not null default 'superior' check (education in ('fundamental', 'medio', 'tecnico', 'superior')),
  area text check (area is null or char_length(area) <= 80),
  -- Salário inicial em centavos, para evitar erros de arredondamento.
  salary_cents integer check (salary_cents is null or salary_cents between 0 and 100000000),
  vacancies integer check (vacancies is null or vacancies between 0 and 100000),
  reserve_list boolean not null default false,
  city text check (city is null or char_length(city) <= 120),
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  notice_url text check (notice_url is null or char_length(notice_url) <= 2048),
  registration_url text check (registration_url is null or char_length(registration_url) <= 2048),
  notes text check (notes is null or char_length(notes) <= 10000),
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  stage text not null default 'acompanhando'
    check (stage in (
      'acompanhando', 'edital_publicado', 'inscricao_feita', 'taxa_paga', 'prova_marcada',
      'prova_feita', 'resultado', 'aprovacao', 'nomeacao', 'sem_aprovacao', 'desisti'
    )),
  -- Ordem do card na coluna do quadro (menor = mais acima); novos vão para o topo.
  position double precision not null default (-extract(epoch from now())),
  stage_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.concursos is 'Concursos públicos acompanhados pela pessoa.';

create index concursos_user_stage_position_idx on public.concursos (user_id, stage, position);

-- -----------------------------------------------------------------------------
-- Tabela: concurso_stage_history (preenchida por trigger, nunca editada)
-- -----------------------------------------------------------------------------
create table public.concurso_stage_history (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_stage text check (from_stage is null or from_stage in (
    'acompanhando', 'edital_publicado', 'inscricao_feita', 'taxa_paga', 'prova_marcada',
    'prova_feita', 'resultado', 'aprovacao', 'nomeacao', 'sem_aprovacao', 'desisti'
  )),
  to_stage text not null check (to_stage in (
    'acompanhando', 'edital_publicado', 'inscricao_feita', 'taxa_paga', 'prova_marcada',
    'prova_feita', 'resultado', 'aprovacao', 'nomeacao', 'sem_aprovacao', 'desisti'
  )),
  changed_at timestamptz not null default now()
);

create index concurso_stage_history_concurso_idx on public.concurso_stage_history (concurso_id, changed_at);

-- -----------------------------------------------------------------------------
-- Tabela: concurso_dates (cronograma)
-- -----------------------------------------------------------------------------
create table public.concurso_dates (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'inscricao_inicio', 'inscricao_fim', 'isencao', 'boleto', 'prova', 'gabarito', 'recurso',
    'resultado', 'validade'
  )),
  date date not null,
  time time,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index concurso_dates_user_date_idx on public.concurso_dates (user_id, date);
create index concurso_dates_concurso_idx on public.concurso_dates (concurso_id);

-- -----------------------------------------------------------------------------
-- Tabela: concurso_subjects (matérias da prova)
-- -----------------------------------------------------------------------------
create table public.concurso_subjects (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  weight numeric(6, 2) check (weight is null or weight between 0 and 1000),
  questions integer check (questions is null or questions between 0 and 1000),
  status text not null default 'nao_estudado' check (status in ('nao_estudado', 'estudado', 'revisado')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index concurso_subjects_concurso_idx on public.concurso_subjects (concurso_id, position);

-- -----------------------------------------------------------------------------
-- Tarefas: de uma candidatura OU de um concurso
-- -----------------------------------------------------------------------------
alter table public.tasks alter column application_id drop not null;
alter table public.tasks add column concurso_id uuid references public.concursos (id) on delete cascade;
alter table public.tasks
  add constraint tasks_one_parent check (num_nonnulls(application_id, concurso_id) = 1);
create index tasks_concurso_idx on public.tasks (concurso_id) where concurso_id is not null;

comment on table public.tasks is 'Próximos passos (tarefas com prazo) de uma candidatura ou de um concurso.';

-- -----------------------------------------------------------------------------
-- Triggers (os mesmos das candidaturas)
-- -----------------------------------------------------------------------------
create or replace function public.concursos_before_update()
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

create trigger concursos_before_update
  before update on public.concursos
  for each row execute function public.concursos_before_update();

-- Toda mudança de etapa entra no histórico, venha do quadro, do formulário ou
-- de qualquer outro cliente.
create or replace function public.concursos_log_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.concurso_stage_history (concurso_id, user_id, from_stage, to_stage, changed_at)
    values (new.id, new.user_id, null, new.stage, new.stage_changed_at);
  elsif new.stage is distinct from old.stage then
    insert into public.concurso_stage_history (concurso_id, user_id, from_stage, to_stage, changed_at)
    values (new.id, new.user_id, old.stage, new.stage, new.stage_changed_at);
  end if;
  return null;
end;
$$;

create trigger concursos_log_stage_insert
  after insert on public.concursos
  for each row execute function public.concursos_log_stage();

create trigger concursos_log_stage_update
  after update of stage on public.concursos
  for each row execute function public.concursos_log_stage();

-- -----------------------------------------------------------------------------
-- Permissões e Row Level Security
-- -----------------------------------------------------------------------------
revoke all on public.concursos, public.concurso_stage_history, public.concurso_dates, public.concurso_subjects from anon;
grant select, insert, update, delete on public.concursos, public.concurso_dates, public.concurso_subjects to authenticated;
-- O histórico só pode ser lido, criado e apagado, nunca editado.
grant select, insert, delete on public.concurso_stage_history to authenticated;
revoke update on public.concurso_stage_history from authenticated;
revoke truncate on public.concursos, public.concurso_stage_history, public.concurso_dates, public.concurso_subjects
  from authenticated;

alter table public.concursos enable row level security;
alter table public.concurso_stage_history enable row level security;
alter table public.concurso_dates enable row level security;
alter table public.concurso_subjects enable row level security;

-- concursos
create policy "Usuário lê os próprios concursos"
  on public.concursos for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria concursos para si"
  on public.concursos for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza os próprios concursos"
  on public.concursos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Usuário exclui os próprios concursos"
  on public.concursos for delete to authenticated
  using ((select auth.uid()) = user_id);

-- histórico
create policy "Usuário lê o histórico dos próprios concursos"
  on public.concurso_stage_history for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário registra histórico dos próprios concursos"
  on public.concurso_stage_history for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
  );

create policy "Usuário apaga o histórico dos próprios concursos"
  on public.concurso_stage_history for delete to authenticated
  using ((select auth.uid()) = user_id);

-- cronograma
create policy "Usuário lê o próprio cronograma"
  on public.concurso_dates for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria datas nos próprios concursos"
  on public.concurso_dates for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
  );

create policy "Usuário atualiza as próprias datas"
  on public.concurso_dates for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
  );

create policy "Usuário exclui as próprias datas"
  on public.concurso_dates for delete to authenticated
  using ((select auth.uid()) = user_id);

-- matérias
create policy "Usuário lê as próprias matérias"
  on public.concurso_subjects for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria matérias nos próprios concursos"
  on public.concurso_subjects for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
  );

create policy "Usuário atualiza as próprias matérias"
  on public.concurso_subjects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
  );

create policy "Usuário exclui as próprias matérias"
  on public.concurso_subjects for delete to authenticated
  using ((select auth.uid()) = user_id);

-- tarefas: a dona da tarefa também precisa ser dona da candidatura ou do concurso
drop policy "Usuário cria tarefas nas próprias candidaturas" on public.tasks;
drop policy "Usuário atualiza as próprias tarefas" on public.tasks;

create policy "Usuário cria tarefas nas próprias candidaturas e concursos"
  on public.tasks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
      or exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
    )
  );

create policy "Usuário atualiza as próprias tarefas"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid()))
      or exists (select 1 from public.concursos c where c.id = concurso_id and c.user_id = (select auth.uid()))
    )
  );
