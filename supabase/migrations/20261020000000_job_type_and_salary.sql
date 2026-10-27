-- O app deixa de ser só para estágio: a "bolsa" vira remuneração (bolsa ou
-- salário) e cada candidatura ganha um tipo de vaga.

alter table public.applications rename column stipend_cents to salary_cents;

comment on column public.applications.salary_cents is
  'Remuneração mensal (bolsa ou salário) em centavos, para evitar erros de arredondamento.';

alter table public.applications
  add column job_type text not null default 'estagio'
  check (job_type in ('estagio', 'trainee', 'clt', 'pj', 'temporario', 'freela'));

comment on column public.applications.job_type is
  'Tipo de vaga: estágio, trainee, CLT, PJ, temporário ou freela.';
