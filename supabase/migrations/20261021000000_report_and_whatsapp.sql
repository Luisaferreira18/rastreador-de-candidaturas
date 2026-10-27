-- =============================================================================
-- Relatório diário (via script do Google) e assistente no WhatsApp.
-- =============================================================================

-- Funções internas ficam fora do schema "public" (que é exposto pela API).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Descobre o dono de um token do script (só o hash fica no banco).
create or replace function private.user_from_inbox_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.user_id
  from public.user_settings s
  where p_token is not null
    and char_length(p_token) >= 20
    and s.inbox_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke all on function private.user_from_inbox_token(text) from public;

-- -----------------------------------------------------------------------------
-- Dados do relatório diário (chamada pelo /api/report, com o token do script).
-- Devolve só o necessário para montar o resumo; nada de observações ou links.
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
    )
  );
end;
$$;

revoke all on function public.report_snapshot(text) from public, authenticated;
-- Chamada sem sessão (pelo script do Google); recusa qualquer token inválido.
grant execute on function public.report_snapshot(text) to anon;

-- -----------------------------------------------------------------------------
-- WhatsApp: número vinculado e código temporário de vinculação.
-- -----------------------------------------------------------------------------
alter table public.user_settings
  add column whatsapp_wa_id text unique check (whatsapp_wa_id is null or whatsapp_wa_id ~ '^[0-9]{8,15}$'),
  add column whatsapp_linked_at timestamptz,
  add column whatsapp_link_code_hash text,
  add column whatsapp_link_expires_at timestamptz;

comment on column public.user_settings.whatsapp_wa_id is
  'Número de WhatsApp vinculado (só dígitos). Gravado apenas pelo servidor, depois da prova de posse.';

-- O navegador pode gravar o pedido de vinculação, mas nunca o número vinculado:
-- só o servidor (chave secreta) grava whatsapp_wa_id, depois que a pessoa manda
-- o código pelo próprio WhatsApp.
revoke insert, update on public.user_settings from authenticated;
grant insert (user_id, inbox_token_hash, inbox_token_created_at, auto_apply, updated_at,
              whatsapp_link_code_hash, whatsapp_link_expires_at)
  on public.user_settings to authenticated;
grant update (user_id, inbox_token_hash, inbox_token_created_at, auto_apply, updated_at,
              whatsapp_link_code_hash, whatsapp_link_expires_at)
  on public.user_settings to authenticated;

-- Mensagens já processadas (a Meta pode reenviar a mesma notificação).
-- RLS ligado e nenhuma política: de propósito, só o servidor (chave secreta) usa.
create table public.whatsapp_events (
  message_id text primary key check (char_length(message_id) <= 200),
  created_at timestamptz not null default now()
);
alter table public.whatsapp_events enable row level security;
revoke all on public.whatsapp_events from anon, authenticated;

-- Mensagens encaminhadas ao assistente também viram sugestões.
alter table public.inbox_items drop constraint inbox_items_source_check;
alter table public.inbox_items
  add constraint inbox_items_source_check check (source in ('email', 'colado', 'whatsapp'));
