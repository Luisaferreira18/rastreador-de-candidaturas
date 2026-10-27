-- =============================================================================
-- Proteção da conta demo no próprio Auth.
--
-- A tela do app já recusa trocar a senha da demo, mas qualquer visitante logado
-- nela poderia chamar o Supabase direto pelo navegador:
--   supabase.auth.updateUser({ password: "..." })   ou   ({ email: "..." })
-- e tomar a conta para si. O Supabase não tem um Auth Hook que rode antes de
-- alterar um usuário, então a regra fica num gatilho em auth.users:
--   * e-mail e telefone da conta protegida não mudam (nem o pedido de troca);
--   * a senha só pode virar a senha oficial, guardada criptografada no Vault.
--     É exatamente o que o cron de reset faz (auth.admin.updateUserById), então
--     ele continua funcionando; qualquer outra senha é recusada.
-- =============================================================================

-- Contas protegidas (hoje, só a demo). Fora do schema exposto pela API.
create table private.protected_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.protected_accounts from public, anon, authenticated;

comment on table private.protected_accounts is
  'Contas cujo e-mail e senha não podem ser trocados pelo próprio usuário (conta demo).';

-- -----------------------------------------------------------------------------
-- Marca a conta como protegida e guarda a senha oficial no Vault.
-- Chamada pelo servidor (chave secreta) antes de redefinir a senha da demo.
-- -----------------------------------------------------------------------------
create or replace function public.protect_demo_account(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := 'protected_account_password:' || p_user_id::text;
  v_secret uuid;
begin
  if p_user_id is null or p_password is null or char_length(p_password) < 8 then
    raise exception 'Informe a conta e uma senha com pelo menos 8 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Conta não encontrada.' using errcode = '22023';
  end if;

  insert into private.protected_accounts (user_id) values (p_user_id) on conflict (user_id) do nothing;

  select s.id into v_secret from vault.secrets s where s.name = v_name;
  if v_secret is null then
    perform vault.create_secret(p_password, v_name, 'Senha oficial da conta demo');
  else
    perform vault.update_secret(v_secret, p_password);
  end if;
end;
$$;

-- Só o servidor (chave secreta) chama; o navegador nunca.
revoke all on function public.protect_demo_account(uuid, text) from public, anon, authenticated;
grant execute on function public.protect_demo_account(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- O gatilho
-- -----------------------------------------------------------------------------
create or replace function private.guard_protected_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_password text;
begin
  if not exists (select 1 from private.protected_accounts p where p.user_id = old.id) then
    return new;
  end if;

  if new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or (coalesce(new.email_change, '') <> '' and new.email_change is distinct from old.email_change)
    or (coalesce(new.phone_change, '') <> '' and new.phone_change is distinct from old.phone_change)
  then
    raise exception 'O e-mail da conta de demonstração não pode ser alterado.' using errcode = '42501';
  end if;

  if new.encrypted_password is distinct from old.encrypted_password then
    select s.decrypted_secret into v_password
    from vault.decrypted_secrets s
    where s.name = 'protected_account_password:' || old.id::text;

    -- Aceita só a senha oficial (o hash muda a cada vez por causa do salt,
    -- então a comparação é refazendo o hash com o salt do novo valor).
    if v_password is null
      or coalesce(new.encrypted_password, '') = ''
      or extensions.crypt(v_password, new.encrypted_password) is distinct from new.encrypted_password
    then
      raise exception 'A senha da conta de demonstração não pode ser alterada.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_protected_account() from public, anon, authenticated;

-- Só dispara quando muda algo sensível: logins comuns (last_sign_in_at) passam direto.
create trigger guard_protected_account
  before update on auth.users
  for each row
  when (
    old.email is distinct from new.email
    or old.phone is distinct from new.phone
    or old.encrypted_password is distinct from new.encrypted_password
    or old.email_change is distinct from new.email_change
    or old.phone_change is distinct from new.phone_change
  )
  execute function private.guard_protected_account();
