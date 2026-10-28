-- =============================================================================
-- Currículo: o PDF fica num bucket privado do Storage, e a tabela guarda só o
-- que a busca usa (habilidades, idiomas) e as sugestões para o perfil. O texto
-- completo, com telefone, endereço e documentos, não fica guardado.
--
-- A conta demo é compartilhada: ninguém pode enviar nem apagar currículo nela,
-- nem chamando o Supabase direto pelo navegador (ela usa um currículo fictício,
-- gravado pelo script da demo com a chave secreta).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A conta é protegida? (usado nas regras de acesso abaixo)
-- -----------------------------------------------------------------------------
create or replace function private.is_protected_account(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.protected_accounts where user_id = p_user_id);
$$;

-- As regras de acesso rodam com o papel de quem faz a requisição. Só esta
-- função do schema private fica liberada para ele (o schema não é exposto pela API).
grant usage on schema private to authenticated;
revoke all on function private.is_protected_account(uuid) from public, anon;
grant execute on function private.is_protected_account(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Tabela
-- -----------------------------------------------------------------------------
create table public.resumes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Sempre "<user_id>/curriculo.pdf": um currículo por pessoa.
  file_path text not null check (file_path = user_id::text || '/curriculo.pdf'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_size integer not null check (file_size between 1 and 4194304),
  skills text[] not null default '{}' check (cardinality(skills) <= 80),
  -- [{ "name": "Inglês", "level": "avancado" }]
  languages jsonb not null default '[]' check (jsonb_typeof(languages) = 'array'),
  course text check (char_length(course) <= 80),
  education_status text check (education_status in ('cursando', 'concluido')),
  graduation_year smallint check (graduation_year between 1950 and 2100),
  city text check (char_length(city) <= 80),
  state text check (state ~ '^[A-Z]{2}$'),
  suggested_roles text[] not null default '{}' check (cardinality(suggested_roles) <= 5),
  suggested_job_types text[] not null default '{}'
    check (suggested_job_types <@ array['estagio', 'trainee', 'clt', 'pj', 'temporario', 'freela']),
  uploaded_at timestamptz not null default now()
);

comment on table public.resumes is
  'Currículo de cada pessoa: o que foi lido do PDF (o arquivo fica no bucket curriculos).';

revoke all on public.resumes from anon;
grant select, insert, update, delete on public.resumes to authenticated;
revoke truncate on public.resumes from authenticated;

alter table public.resumes enable row level security;

create policy "Usuário lê o próprio currículo"
  on public.resumes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Usuário grava o próprio currículo"
  on public.resumes for insert to authenticated
  with check ((select auth.uid()) = user_id and not private.is_protected_account((select auth.uid())));

create policy "Usuário atualiza o próprio currículo"
  on public.resumes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and not private.is_protected_account((select auth.uid())));

create policy "Usuário exclui o próprio currículo"
  on public.resumes for delete to authenticated
  using ((select auth.uid()) = user_id and not private.is_protected_account((select auth.uid())));

-- -----------------------------------------------------------------------------
-- Arquivo: bucket privado, só PDF, até 4 MB (a Vercel aceita até 4,5 MB por requisição)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('curriculos', 'curriculos', false, 4194304, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada pessoa só mexe na própria pasta ("<user_id>/...").
create policy "Usuário lê o próprio currículo (arquivo)"
  on storage.objects for select to authenticated
  using (bucket_id = 'curriculos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Usuário envia o próprio currículo (arquivo)"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'curriculos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not private.is_protected_account((select auth.uid()))
  );

create policy "Usuário troca o próprio currículo (arquivo)"
  on storage.objects for update to authenticated
  using (bucket_id = 'curriculos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'curriculos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not private.is_protected_account((select auth.uid()))
  );

create policy "Usuário apaga o próprio currículo (arquivo)"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'curriculos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not private.is_protected_account((select auth.uid()))
  );
