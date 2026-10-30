-- =============================================================================
-- Concursos no resumo diário e na conta de demonstração.
--
-- 1. O resumo diário (report_snapshot, usado pelo script do Google) passa a
--    trazer os concursos, as datas do cronograma, as tarefas dos concursos e
--    os concursos sugeridos nas últimas 24 horas.
-- 2. O catálogo de editais aceita a fonte 'exemplo': editais fictícios da
--    conta demo, que a busca de verdade ignora.
-- =============================================================================

alter table public.concurso_notices drop constraint concurso_notices_source_check;
alter table public.concurso_notices
  add constraint concurso_notices_source_check check (source in ('dou', 'querido_diario', 'exemplo'));

comment on column public.concurso_notices.source is
  'dou, querido_diario ou exemplo (editais fictícios da conta demo, fora da busca).';

create or replace function public.report_snapshot(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := private.user_from_inbox_token(p_token);
  -- "Hoje" no fuso do app; ontem entra por segurança e o filtro fino é feito no app.
  v_since date := (now() at time zone 'America/Sao_Paulo')::date - 1;
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
        'application_id', t.application_id, 'concurso_id', t.concurso_id,
        'title', t.title, 'due_date', t.due_date
      ))
      from public.tasks t where t.user_id = v_user and not t.done
    ), '[]'::jsonb),
    'pending_suggestions', (
      select count(*) from public.inbox_items i where i.user_id = v_user and i.status = 'pendente'
    ),
    'new_leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'company', l.company, 'title', l.title, 'url', l.url, 'score', l.score
      ) order by l.score desc, l.found_at desc)
      from (
        select * from public.job_leads l
        where l.user_id = v_user and l.status = 'nova' and l.found_at >= now() - interval '24 hours'
        order by l.score desc, l.found_at desc
        limit 5
      ) l
    ), '[]'::jsonb),
    'new_leads_count', (
      select count(*) from public.job_leads l
      where l.user_id = v_user and l.status = 'nova' and l.found_at >= now() - interval '24 hours'
    ),
    'concursos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'organ', c.organ, 'role_title', c.role_title, 'stage', c.stage
      ))
      from public.concursos c where c.user_id = v_user
    ), '[]'::jsonb),
    'concurso_dates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'concurso_id', d.concurso_id, 'kind', d.kind, 'date', d.date, 'time', d.time
      ))
      from public.concurso_dates d where d.user_id = v_user and d.date >= v_since
    ), '[]'::jsonb),
    'new_concurso_leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'organ', l.organ, 'role', l.role, 'url', l.url, 'score', l.score
      ) order by l.score desc, l.found_at desc)
      from (
        select n.organ, cl.role, coalesce(n.registration_url, n.notice_url) as url, cl.score, cl.found_at
        from public.concurso_leads cl
        join public.concurso_notices n on n.id = cl.notice_id
        where cl.user_id = v_user and cl.status = 'nova' and cl.found_at >= now() - interval '24 hours'
        order by cl.score desc, cl.found_at desc
        limit 5
      ) l
    ), '[]'::jsonb),
    'new_concurso_leads_count', (
      select count(*) from public.concurso_leads cl
      where cl.user_id = v_user and cl.status = 'nova' and cl.found_at >= now() - interval '24 hours'
    )
  );
end;
$$;

revoke all on function public.report_snapshot(text) from public, authenticated;
grant execute on function public.report_snapshot(text) to anon;
