-- =============================================================================
-- Vagas dos alertas do LinkedIn que chegam no Gmail da própria pessoa. A rota do
-- script do Google não tem sessão nem chave secreta: estas funções conferem o
-- token pessoal e só leem e gravam na conta dona dele, como a inbox_ingest.
-- =============================================================================
alter table public.job_leads drop constraint job_leads_source_check;
alter table public.job_leads
  add constraint job_leads_source_check check (source in ('gupy', 'greenhouse', 'lever', 'linkedin'));

-- -----------------------------------------------------------------------------
-- O necessário para dar a nota: perfil, currículo e o que já foi visto.
-- -----------------------------------------------------------------------------
create or replace function public.job_alert_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_profile jsonb;
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

  select jsonb_build_object(
    'roles', p.roles,
    'keywords', p.keywords,
    'excluded_words', p.excluded_words,
    'city', p.city,
    'state', p.state,
    'work_models', p.work_models,
    'job_types', p.job_types,
    'min_salary_cents', p.min_salary_cents,
    'auto_search', p.auto_search
  ) into v_profile
  from public.job_profiles p
  where p.user_id = v_user;

  -- Sem perfil de busca, não há com o que comparar.
  if v_profile is null then
    return null;
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'resume', (
      select jsonb_build_object(
        'skills', r.skills,
        'languages', r.languages,
        'course', r.course,
        'education_status', r.education_status,
        'graduation_year', r.graduation_year,
        'experience_months', r.experience_months
      )
      from public.resumes r
      where r.user_id = v_user
    ),
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object('company', a.company, 'role_title', a.role_title, 'job_url', a.job_url))
      from public.applications a
      where a.user_id = v_user
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', l.source, 'external_id', l.external_id, 'company', l.company, 'title', l.title, 'url', l.url
      ))
      from (
        select * from public.job_leads
        where user_id = v_user
        order by found_at desc
        limit 5000
      ) l
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Grava as vagas escolhidas. Só aceita link de vaga do LinkedIn.
-- -----------------------------------------------------------------------------
create or replace function public.job_alert_ingest(p_token text, p_leads jsonb)
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

  if jsonb_typeof(p_leads) <> 'array' or jsonb_array_length(p_leads) > 100 then
    raise exception 'Envie no máximo 100 vagas por vez.' using errcode = '22023';
  end if;

  insert into public.job_leads (
    user_id, source, external_id, company, title, url, location, work_model, job_type, score, reasons, warnings
  )
  select
    v_user,
    'linkedin',
    item ->> 'external_id',
    left(item ->> 'company', 120),
    left(item ->> 'title', 200),
    item ->> 'url',
    left(item ->> 'location', 200),
    item ->> 'work_model',
    item ->> 'job_type',
    (item ->> 'score')::smallint,
    array(select jsonb_array_elements_text(item -> 'reasons')),
    array(select jsonb_array_elements_text(item -> 'warnings'))
  from jsonb_array_elements(p_leads) as item
  where item ->> 'external_id' ~ '^[0-9]+$'
    and item ->> 'url' = 'https://www.linkedin.com/jobs/view/' || (item ->> 'external_id') || '/'
  on conflict (user_id, source, external_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Só a rota do script usa, com o token. Como a inbox_ingest: anon, nunca authenticated.
revoke all on function public.job_alert_context(text) from public, authenticated;
revoke all on function public.job_alert_ingest(text, jsonb) from public, authenticated;
grant execute on function public.job_alert_context(text) to anon;
grant execute on function public.job_alert_ingest(text, jsonb) to anon;
