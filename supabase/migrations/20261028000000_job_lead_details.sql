-- =============================================================================
-- Bolsa, benefícios e horário das vagas sugeridas.
-- Tirados da descrição da vaga na hora da busca (src/features/job-search/details.ts).
-- A bolsa ou salário usa a coluna salary_cents, que já existia.
-- =============================================================================

alter table public.job_leads
  add column benefits text[] not null default '{}' check (cardinality(benefits) <= 20),
  add column workload text check (char_length(workload) <= 40);

comment on column public.job_leads.benefits is 'Benefícios citados na vaga ("Vale-transporte", "Plano de saúde").';
comment on column public.job_leads.workload is 'Jornada citada na vaga ("6h por dia", "Das 9h às 15h").';
