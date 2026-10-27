import { describe, expect, it } from "vitest";
import { extractDueDate, parseMessage, parseSender } from "@/features/inbox/parser";

const ON = "2026-10-20";

describe("leitura de mensagens de processos seletivos", () => {
  it("confirmação da Gupy: cria a vaga com empresa e cargo", () => {
    const parsed = parseMessage({
      from: "Nuvem Pay <noreply@gupy.io>",
      subject: "Recebemos sua candidatura para a vaga de Estágio em Dados",
      body:
        "Olá, Ana! Recebemos sua candidatura para a vaga de Estágio em Dados na Nuvem Pay. " +
        "Nas próximas etapas, você poderá ser convidada para testes online e entrevistas.\n\n" +
        "Equipe de Recrutamento da Nuvem Pay",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({
      relevant: true,
      kind: "confirmacao",
      stage: "enviada",
      confidence: "alta",
      company: "Nuvem Pay",
      roleTitle: "Estágio em Dados",
      platform: "gupy",
      dueDate: null,
    });
  });

  it("confirmação do LinkedIn", () => {
    const parsed = parseMessage({
      from: "LinkedIn <jobs-noreply@linkedin.com>",
      subject: "Ana, sua candidatura foi enviada para Banco Aurora",
      body: "Sua candidatura foi enviada para Banco Aurora\nEstágio em Engenharia de Software\nSão Paulo, SP",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({ kind: "confirmacao", confidence: "alta", company: "Banco Aurora", platform: "linkedin" });
  });

  it("reprovação com frase clara: confiança alta", () => {
    const parsed = parseMessage({
      from: "Recrutamento Quantum Bank <talentos@quantumbank.com.br>",
      subject: "Atualização sobre o processo seletivo",
      body:
        "Olá! Agradecemos seu interesse na vaga de Trainee em Segurança da Informação. " +
        "Infelizmente, optamos por seguir com outros candidatos neste momento.",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({
      kind: "reprovacao",
      stage: "reprovada",
      confidence: "alta",
      company: "Quantum Bank",
      roleTitle: "Trainee em Segurança da Informação",
      platform: "site_empresa",
    });
  });

  it("'aprovado para a próxima etapa' é avanço (teste), não aprovação final", () => {
    const parsed = parseMessage({
      from: "Casa Viva Varejo via Gupy <noreply@gupy.io>",
      subject: "Você avançou! Próxima etapa: teste online",
      body:
        "Parabéns! Você foi aprovado(a) para a próxima etapa do processo seletivo da Casa Viva Varejo: " +
        "o teste online de lógica. Faça o teste até 25/10, às 23h59.",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({
      kind: "teste",
      stage: "teste_online",
      confidence: "media",
      company: "Casa Viva Varejo",
      dueDate: "2026-10-25",
      taskTitle: "Fazer o teste online",
    });
  });

  it("convite para entrevista com data por extenso", () => {
    const parsed = parseMessage({
      from: "Carla Souza <carla.souza@lumensaude.com.br>",
      subject: "Convite para entrevista - Lumen Saúde",
      body:
        "Oi, Ana, tudo bem? Gostaria de agendar uma conversa com você sobre a vaga de Estágio em Produto. " +
        "Você tem disponibilidade no dia 28 de outubro, às 14h?",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({
      kind: "entrevista_rh",
      company: "Lumen Saúde",
      roleTitle: "Estágio em Produto",
      dueDate: "2026-10-28",
      taskTitle: "Entrevista com o RH",
    });
  });

  it("entrevista técnica e case", () => {
    expect(
      parseMessage({
        subject: "Próxima etapa: entrevista técnica com o time de dados",
        body: "Sua entrevista técnica ficou agendada para 30/10 às 10h.",
        receivedOn: ON,
      }),
    ).toMatchObject({ kind: "entrevista_tecnica", stage: "entrevista_tecnica", dueDate: "2026-10-30" });

    expect(
      parseMessage({
        from: "Verde Agro Tech <talentos@verdeagro.com.br>",
        subject: "Desafio técnico - Verde Agro Tech",
        body: "Segue o case para a próxima etapa. Entregue até sexta-feira, 24/10.",
        receivedOn: ON,
      }),
    ).toMatchObject({ kind: "dinamica", stage: "dinamica_case", company: "Verde Agro Tech", dueDate: "2026-10-24" });
  });

  it("proposta e aprovação final", () => {
    expect(
      parseMessage({
        subject: "Proposta",
        body:
          "Temos uma proposta para você! Segue a carta oferta para a posição de Estágio em Produto na Lumen Saúde. " +
          "Pedimos retorno até 29/10.",
        receivedOn: ON,
      }),
    ).toMatchObject({ kind: "proposta", stage: "proposta", company: "Lumen Saúde", roleTitle: "Estágio em Produto", dueDate: "2026-10-29" });

    expect(
      parseMessage({
        subject: "Bem-vindo(a)!",
        body:
          "Parabéns! Você foi aprovado para a vaga de Estágio em Desenvolvimento Mobile. " +
          "Seja bem-vindo ao time Kappa Educação! Envie os documentos para admissão até 05/11.",
        receivedOn: ON,
      }),
    ).toMatchObject({ kind: "aprovacao", stage: "aprovada", company: "Kappa Educação", dueDate: "2026-11-05" });
  });

  it("mensagem colada do WhatsApp", () => {
    const parsed = parseMessage({
      body:
        "Oi Ana! Aqui é a Júlia, do RH da Trilha Mobilidade. Você passou para a próxima fase! " +
        "Queremos marcar uma entrevista com o gestor na quinta, dia 23/10 às 15h. Pode ser?",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({
      kind: "entrevista_tecnica",
      company: "Trilha Mobilidade",
      dueDate: "2026-10-23",
      platform: null,
    });
  });

  it("vale a próxima etapa, não a que já passou", () => {
    expect(
      parseMessage({
        body: "Oi Ana! Seu case ficou ótimo! Queremos marcar uma entrevista com o gestor no dia 30/10 às 9h. Pode ser?",
        receivedOn: ON,
      }),
    ).toMatchObject({ kind: "entrevista_tecnica", dueDate: "2026-10-30" });

    expect(
      parseMessage({
        body: "Recebemos o resultado do seu teste online. A próxima etapa será uma dinâmica de grupo no dia 05/11.",
        receivedOn: ON,
      }),
    ).toMatchObject({ kind: "dinamica", dueDate: "2026-11-05" });

    // Sem pistas de "próxima etapa", vale a primeira etapa citada.
    expect(
      parseMessage({
        subject: "Convite",
        body: "Você está convidada para o teste online até 25/10. Depois, os aprovados seguem para entrevistas.",
        receivedOn: ON,
      }),
    ).toMatchObject({ kind: "teste" });
  });

  it("'infelizmente' sozinho não vira reprovação se a mensagem é sobre entrevista", () => {
    const parsed = parseMessage({
      body: "Infelizmente não conseguimos falar com você por telefone. Podemos agendar a entrevista para amanhã?",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({ kind: "entrevista_rh", dueDate: "2026-10-21" });
  });

  it("'não poderemos seguir com a sua candidatura' é reprovação certa", () => {
    const parsed = parseMessage({
      subject: "Retorno do processo seletivo",
      body: "Agradecemos a participação. Infelizmente, não poderemos seguir com a sua candidatura.",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({ kind: "reprovacao", confidence: "alta" });
  });

  it("ignora alertas de vagas e e-mails sem relação com processos", () => {
    expect(
      parseMessage({
        from: "LinkedIn Vagas <jobalerts-noreply@linkedin.com>",
        subject: "10 novas vagas de Estágio em Dados em São Paulo",
        body: "Confira as vagas que combinam com seu perfil. Entrevista com quem contrata, salários e mais.",
        receivedOn: ON,
      }).relevant,
    ).toBe(false);
    expect(
      parseMessage({ subject: "Sua fatura chegou", body: "O valor da sua fatura é R$ 120,00.", receivedOn: ON }).relevant,
    ).toBe(false);
  });

  it("mensagem sobre a vaga sem etapa clara vira 'outro' para você decidir", () => {
    const parsed = parseMessage({
      subject: "Sobre sua candidatura",
      body: "Olá! Estamos analisando os perfis e em breve daremos retorno.",
      receivedOn: ON,
    });
    expect(parsed).toMatchObject({ relevant: true, kind: "outro", stage: null, confidence: "baixa" });
  });

  it("recorta o nome da empresa e usa o domínio quando quem escreve é uma pessoa", () => {
    expect(
      parseMessage({
        body: "Recebemos sua inscrição no processo seletivo da Nuvem Pay e gostaríamos de agradecer.",
        receivedOn: ON,
      }).company,
    ).toBe("Nuvem Pay");
    expect(
      parseMessage({
        from: "Pedro Lima <pedro@pontefintech.com>",
        subject: "Entrevista",
        body: "Podemos conversar amanhã?",
        receivedOn: ON,
      }).company,
    ).toBe("Pontefintech");
  });
});

describe("datas", () => {
  it("entende vários formatos e ignora datas passadas", () => {
    expect(extractDueDate("Faça até 25/10", ON)).toBe("2026-10-25");
    expect(extractDueDate("Prazo: 03/11/2026", ON)).toBe("2026-11-03");
    expect(extractDueDate("no dia 3 de novembro", ON)).toBe("2026-11-03");
    expect(extractDueDate("responda em até 2 dias", ON)).toBe("2026-10-22");
    expect(extractDueDate("Sua candidatura de 10/10 foi recebida", ON)).toBeNull();
    expect(extractDueDate("Sem datas aqui", ON)).toBeNull();
  });

  it("janeiro citado em dezembro é do ano seguinte", () => {
    expect(extractDueDate("Entrevista dia 05/01", "2026-12-20")).toBe("2027-01-05");
  });

  it("separa nome e e-mail do remetente", () => {
    expect(parseSender('"Banco Aurora via Gupy" <noreply@gupy.io>')).toEqual({
      name: "Banco Aurora via Gupy",
      email: "noreply@gupy.io",
      domain: "gupy.io",
    });
    expect(parseSender("rh@empresa.com.br")).toEqual({ name: null, email: "rh@empresa.com.br", domain: "empresa.com.br" });
  });
});
