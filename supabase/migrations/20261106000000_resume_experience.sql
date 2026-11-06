-- =============================================================================
-- Currículo: quantos meses de experiência ele soma, para comparar com o que as
-- vagas pedem. Só o total: empresas e cargos não ficam guardados. Vazio quando
-- o currículo não permitiu somar (a pessoa pode informar no perfil).
-- =============================================================================
alter table public.resumes
  add column experience_months smallint check (experience_months between 0 and 1200);

comment on column public.resumes.experience_months is
  'Total de meses de experiência lido do currículo ou informado pela pessoa.';
