-- O Supabase concede todas as permissões nas tabelas novas ao papel
-- "authenticated" por padrão. Sem política de UPDATE, o RLS já impedia
-- alterações no histórico (0 linhas afetadas); aqui a regra fica explícita:
-- o histórico de etapas só pode ser lido, criado e apagado, nunca editado.
revoke update, truncate on public.stage_history from authenticated;
revoke truncate on public.applications, public.tasks from authenticated;
