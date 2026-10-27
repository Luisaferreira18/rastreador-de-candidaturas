-- A entrada de e-mails só é chamada pelo /api/inbox/email, sem sessão (papel
-- "anon"), protegida pelo token pessoal. Usuários logados não precisam dela.
-- O alerta do Supabase sobre "security definer executável por anon" é
-- esperado para esta função: ela recusa qualquer chamada sem token válido.
revoke execute on function public.inbox_ingest(text, jsonb) from authenticated;
