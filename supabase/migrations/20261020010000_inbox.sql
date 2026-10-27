-- =============================================================================
-- Caixa de entrada: sugestões criadas a partir de e-mails e mensagens coladas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configurações por usuário (token pessoal do e-mail e preferência de automação)
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Só o hash (SHA-256) do token fica guardado; o token aparece uma vez na tela.
  inbox_token_hash text unique,
  inbox_token_created_at timestamptz,
  -- Aplica sozinho as sugestões inequívocas (confirmação de inscrição e reprovação).
  auto_apply boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is 'Preferências do usuário e token da integração de e-mail.';

-- -----------------------------------------------------------------------------
-- Sugestões (itens da caixa de entrada)
-- -----------------------------------------------------------------------------
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('email', 'colado')),
  -- Id da mensagem no Gmail, para não importar o mesmo e-mail duas vezes.
  external_id text check (external_id is null or char_length(external_id) <= 200),
  sender text check (sender is null or char_length(sender) <= 300),
  subject text check (subject is null or char_length(subject) <= 300),
  received_at timestamptz not null default now(),
  -- Trecho da mensagem (não o e-mail inteiro).
  snippet text check (snippet is null or char_length(snippet) <= 1500),
  kind text not null check (kind in (
    'confirmacao', 'teste', 'dinamica', 'entrevista_rh', 'entrevista_tecnica',
    'proposta', 'aprovacao', 'reprovacao', 'outro'
  )),
  suggested_stage text check (suggested_stage is null or suggested_stage in (
    'quero_candidatar', 'enviada', 'teste_online', 'dinamica_case', 'entrevista_rh',
    'entrevista_tecnica', 'proposta', 'aprovada', 'reprovada', 'desisti'
  )),
  confidence text not null default 'media' check (confidence in ('alta', 'media', 'baixa')),
  company text check (company is null or char_length(company) <= 120),
  role_title text check (role_title is null or char_length(role_title) <= 160),
  platform text check (platform is null or platform in ('gupy', 'linkedin', 'site_empresa', 'indicacao', 'outra')),
  task_title text check (task_title is null or char_length(task_title) <= 200),
  due_date date,
  status text not null default 'pendente' check (status in ('pendente', 'aplicada', 'ignorada')),
  auto_applied boolean not null default false,
  application_id uuid references public.applications (id) on delete set null,
  resolution text check (resolution is null or char_length(resolution) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.inbox_items is 'Sugestões de atualização vindas de e-mails ou mensagens coladas.';

create unique index inbox_items_user_external_idx
  on public.inbox_items (user_id, external_id)
  where external_id is not null;
create index inbox_items_user_status_idx on public.inbox_items (user_id, status, received_at desc);
create index inbox_items_application_idx on public.inbox_items (application_id);

-- -----------------------------------------------------------------------------
-- Permissões e RLS
-- -----------------------------------------------------------------------------
revoke all on public.user_settings, public.inbox_items from anon;
grant select, insert, update on public.user_settings to authenticated;
grant select, insert, update, delete on public.inbox_items to authenticated;
revoke truncate on public.user_settings, public.inbox_items from authenticated;

alter table public.user_settings enable row level security;
alter table public.inbox_items enable row level security;

create policy "Usuário lê as próprias configurações"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria as próprias configurações"
  on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza as próprias configurações"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Usuário lê as próprias sugestões"
  on public.inbox_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário cria sugestões para si"
  on public.inbox_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Usuário atualiza as próprias sugestões"
  on public.inbox_items for update to authenticated
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

create policy "Usuário exclui as próprias sugestões"
  on public.inbox_items for delete to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Entrada de e-mails (chamada pelo /api/inbox/email, sem sessão de usuário)
--
-- O script do Google manda os e-mails com o token pessoal. A função confere o
-- hash do token, descobre o dono e grava as sugestões já interpretadas.
-- É "security definer" porque quem chama não está logado; por isso ela só
-- aceita um token válido e só grava na conta dona do token.
-- -----------------------------------------------------------------------------
create or replace function public.inbox_ingest(p_token text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_count integer;
begin
  if p_token is null or char_length(p_token) < 20 then
    raise exception 'Token inválido.' using errcode = '28000';
  end if;

  select s.user_id into v_user
  from public.user_settings s
  where s.inbox_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_user is null then
    raise exception 'Token inválido.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Envie no máximo 50 mensagens por vez.' using errcode = '22023';
  end if;

  insert into public.inbox_items (
    user_id, source, external_id, sender, subject, received_at, snippet, kind,
    suggested_stage, confidence, company, role_title, platform, task_title, due_date
  )
  select
    v_user,
    'email',
    left(item ->> 'external_id', 200),
    left(item ->> 'sender', 300),
    left(item ->> 'subject', 300),
    coalesce((item ->> 'received_at')::timestamptz, now()),
    left(item ->> 'snippet', 1500),
    item ->> 'kind',
    item ->> 'suggested_stage',
    coalesce(item ->> 'confidence', 'media'),
    left(item ->> 'company', 120),
    left(item ->> 'role_title', 160),
    item ->> 'platform',
    left(item ->> 'task_title', 200),
    (item ->> 'due_date')::date
  from jsonb_array_elements(p_items) as item
  on conflict (user_id, external_id) where external_id is not null do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.inbox_ingest(text, jsonb) from public;
grant execute on function public.inbox_ingest(text, jsonb) to anon, authenticated;
