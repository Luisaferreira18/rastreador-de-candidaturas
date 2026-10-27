import { describe, expect, it } from "vitest";
import { companyKey, decideStage, matchApplication, planInboxItem, type PlanApplication, type PlanItem } from "@/features/inbox/plan";

const apps: PlanApplication[] = [
  { id: "a1", company: "Banco Aurora S.A.", role_title: "Estágio em Engenharia de Software", stage: "entrevista_tecnica", applied_at: "2026-09-21", updated_at: "2026-10-15T00:00:00Z" },
  { id: "a2", company: "Nuvem Pay", role_title: "Estágio em Dados", stage: "quero_candidatar", applied_at: null, updated_at: "2026-10-10T00:00:00Z" },
  { id: "a3", company: "Nuvem Pay", role_title: "Estágio em Produto", stage: "reprovada", applied_at: "2026-08-01", updated_at: "2026-10-18T00:00:00Z" },
  { id: "a4", company: "Rota Logística", role_title: "Estágio em TI", stage: "reprovada", applied_at: "2026-09-01", updated_at: "2026-09-10T00:00:00Z" },
];

function item(partial: Partial<PlanItem>): PlanItem {
  return {
    kind: "outro",
    suggested_stage: null,
    company: null,
    role_title: null,
    platform: null,
    task_title: null,
    due_date: null,
    received_at: "2026-10-20T13:00:00Z",
    ...partial,
  };
}

describe("encontrar a candidatura da mensagem", () => {
  it("compara nomes ignorando acentos, espaços e 'S.A.'", () => {
    expect(companyKey("Banco Aurora S.A.")).toBe("bancoaurora");
    expect(matchApplication("banco aurora", null, apps)?.id).toBe("a1");
    expect(matchApplication("Bancoaurora", null, apps)?.id).toBe("a1");
  });

  it("prefere a candidatura em andamento quando a empresa tem mais de uma", () => {
    expect(matchApplication("Nuvem Pay", null, apps)?.id).toBe("a2");
  });

  it("não inventa correspondência", () => {
    expect(matchApplication("Pixel Studio", null, apps)).toBeNull();
    expect(matchApplication(null, null, apps)).toBeNull();
    expect(matchApplication("TI", null, apps)).toBeNull();
  });
});

describe("decidir a nova etapa", () => {
  it("avança, mas nunca volta", () => {
    expect(decideStage("enviada", "entrevista_rh")).toBe("entrevista_rh");
    expect(decideStage("entrevista_tecnica", "enviada")).toBeNull();
    expect(decideStage("teste_online", "teste_online")).toBeNull();
  });

  it("reprovação vale de qualquer etapa em andamento; vagas encerradas não mudam", () => {
    expect(decideStage("entrevista_tecnica", "reprovada")).toBe("reprovada");
    expect(decideStage("aprovada", "reprovada")).toBeNull();
    expect(decideStage("reprovada", "entrevista_rh")).toBeNull();
  });
});

describe("plano para cada sugestão", () => {
  it("confirmação de vaga nova: cria em 'Candidatura enviada' com a data do e-mail", () => {
    const plan = planInboxItem(
      item({ kind: "confirmacao", suggested_stage: "enviada", company: "Pixel Studio", role_title: "Estágio em Front-end", platform: "gupy" }),
      apps,
    );
    expect(plan).toMatchObject({
      action: "criar",
      company: "Pixel Studio",
      roleTitle: "Estágio em Front-end",
      stage: "enviada",
      platform: "gupy",
      appliedAt: "2026-10-20",
      summary: "Pixel Studio adicionada em Candidatura enviada",
    });
  });

  it("confirmação de vaga que estava em 'Quero me candidatar': avança e registra a data", () => {
    const plan = planInboxItem(item({ kind: "confirmacao", suggested_stage: "enviada", company: "Nuvem Pay" }), apps);
    expect(plan).toMatchObject({ action: "atualizar", applicationId: "a2", stage: "enviada", setAppliedAt: "2026-10-20" });
  });

  it("convite para teste cria a tarefa com prazo", () => {
    const plan = planInboxItem(
      item({ kind: "teste", suggested_stage: "teste_online", company: "Nuvem Pay", task_title: "Fazer o teste online", due_date: "2026-10-25" }),
      apps,
    );
    expect(plan).toMatchObject({
      action: "atualizar",
      applicationId: "a2",
      stage: "teste_online",
      task: { title: "Fazer o teste online", dueDate: "2026-10-25" },
      summary: "Nuvem Pay → Teste online",
    });
  });

  it("e-mail atrasado de uma etapa anterior não muda nada", () => {
    const plan = planInboxItem(item({ kind: "confirmacao", suggested_stage: "enviada", company: "Banco Aurora" }), apps);
    expect(plan).toEqual({ action: "nada", reason: "Banco Aurora S.A. já está em Entrevista técnica." });
  });

  it("respeita as escolhas feitas na tela", () => {
    const plan = planInboxItem(item({ kind: "outro", company: "Empresa Misteriosa" }), apps, {
      applicationId: "a1",
      stage: "proposta",
      taskTitle: "Ligar para a recrutadora",
      dueDate: "2026-10-22",
    });
    expect(plan).toMatchObject({
      action: "atualizar",
      applicationId: "a1",
      stage: "proposta",
      task: { title: "Ligar para a recrutadora", dueDate: "2026-10-22" },
    });

    const forcedNew = planInboxItem(item({ kind: "entrevista_rh", suggested_stage: "entrevista_rh", company: "Nuvem Pay" }), apps, {
      applicationId: "nova",
      roleTitle: "Estágio em Marketing",
    });
    expect(forcedNew).toMatchObject({ action: "criar", company: "Nuvem Pay", roleTitle: "Estágio em Marketing", stage: "entrevista_rh" });
  });

  it("sem empresa e sem candidatura escolhida, pede para completar", () => {
    expect(planInboxItem(item({ kind: "entrevista_rh", suggested_stage: "entrevista_rh" }), apps)).toMatchObject({ action: "nada" });
  });
});
