import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classifyDateContext,
  findEducation,
  findExamBoard,
  findLinks,
  findNoticeDates,
  findOrgan,
  findPlace,
  findSalaries,
  findSphere,
  findVacancies,
  parseNotice,
  titleCase,
} from "@/features/concursos/notice-parser";

/** Trechos reais de editais publicados no Diário Oficial da União (outubro de 2026). */
const fixture = (name: string) => readFileSync(`tests/fixtures/editais/${name}.txt`, "utf8");
const TODAY = "2026-10-28";
const short = (dates: { kind: string; date: string; time: string | null }[]) =>
  dates.map((item) => `${item.kind} ${item.date}${item.time ? ` ${item.time}` : ""}`);

describe("leitor de edital: trechos reais", () => {
  it("TRT da 8ª Região (FCC): inscrições com horário, boleto e cargos da tabela", () => {
    const result = parseNotice(fixture("trt8"), TODAY);
    expect(result).toMatchObject({
      organ: "Tribunal Regional do Trabalho da 8ª Região",
      examBoard: "FCC",
      salaries: [1_604_088],
      feeCents: 11_000,
      reserveList: true,
      education: "superior",
      sphere: "federal",
      registrationUrl: "https://www.concursosfcc.com.br",
    });
    expect(result.roles).toEqual([
      "Analista Judiciário - Área Judiciária",
      "Analista Judiciário - Área Judiciária - Especialidade Oficial de Justiça Avaliador Federal",
      "Analista Judiciário - Área Administrativa",
      "Analista Judiciário - Área Apoio Especializado - Especialidade Tecnologia da Informação",
    ]);
    // "A partir de 12/10/2026 o candidato poderá conferir..." não é data do cronograma.
    expect(short(result.dates)).toEqual([
      "inscricao_inicio 2026-10-05 10:00",
      "inscricao_fim 2026-11-05 23:59",
      "boleto 2026-11-06 22:00",
    ]);
  });

  it("CGU (Cebraspe): cargos numerados, subsídio, cadastro reserva e link da banca, sem datas de leis", () => {
    const result = parseNotice(fixture("cgu"), TODAY);
    expect(result).toMatchObject({
      organ: "Controladoria-Geral da União",
      examBoard: "Cebraspe",
      salaries: [2_000_000],
      reserveList: true,
      education: "superior",
      sphere: "federal",
      registrationUrl: "http://www.cebraspe.org.br/concursos/cgu_26_affc",
    });
    expect(result.roles).toHaveLength(4);
    expect(result.roles[2]).toBe(
      "Auditor Federal de Finanças e Controle (AFFC) - Especialidade: Tecnologia da Informação - Infraestrutura de TI",
    );
    // O texto cita Lei nº 8.112, de 11 de dezembro de 1990, e várias outras: nenhuma vira data.
    expect(result.dates).toEqual([]);
  });

  it("UFMS: tabela com a data antes da etapa; impugnação e recursos das inscrições ficam de fora", () => {
    const result = parseNotice(fixture("ufms"), TODAY);
    expect(result.organ).toBe("Fundação Universidade Federal de Mato Grosso do Sul");
    expect(result.roles).toEqual(["Professor do Magistério Superior da UFMS"]);
    expect(short(result.dates)).toEqual([
      "inscricao_inicio 2026-10-12",
      "isencao 2026-10-15",
      "inscricao_fim 2026-10-25",
      "boleto 2026-10-27",
    ]);
    expect(result.dates.find((item) => item.kind === "isencao")?.note).toBe("De 12/10 a 15/10");
  });

  it("IF Sul de Minas: reaplicação da prova no texto e cronograma com a etapa antes da data", () => {
    const result = parseNotice(fixture("ifsuldeminas"), TODAY);
    expect(result.organ).toBe("Instituto Federal de Educação, Ciência e Tecnologia do Sul de Minas Gerais");
    expect(short(result.dates)).toEqual([
      // A prova anulada ("realizada em 13 de setembro") não entra; a reaplicação traz a hora.
      "prova 2026-11-08 09:00",
      "gabarito 2026-11-09",
      "recurso 2026-11-10",
      "gabarito 2026-11-23",
      "recurso 2026-11-24",
      "prova 2026-12-13",
      "resultado 2026-12-28",
      "resultado 2026-12-30",
      "resultado 2026-12-31",
    ]);
    expect(result.dates.find((item) => item.date === "2026-11-09")?.note).toBe(
      "Publicação do Gabarito Preliminar da Prova Objetiva",
    );
  });

  it("UFG: tabela com data, horário, local e atividade em células separadas", () => {
    const result = parseNotice(fixture("ufg"), TODAY);
    expect(result.organ).toBe("Universidade Federal de Goiás");
    expect(result.dates).toEqual([
      { kind: "prova", date: "2027-02-01", time: "14:00", note: "Prova Escrita ou Teórico-Prática" },
      { kind: "prova", date: "2027-02-17", time: "08:00", note: "Prova Didática" },
      { kind: "prova", date: "2027-02-18", time: "08:00", note: "Prova Didática" },
      { kind: "resultado", date: "2027-02-23", time: null, note: "Proclamação do Resultado Preliminar do Concurso" },
    ]);
  });
});

describe("leitor de edital: datas", () => {
  it("entende faixas, listas e datas por extenso", () => {
    const text = [
      "Período de inscrições: 3 a 28 de novembro de 2026",
      "Pedido de isenção da taxa: de 03/11 a 07/11/2026",
      "Vencimento do boleto: 30/11/2026",
      "Data provável da prova objetiva: 1º de fevereiro de 2027, às 8h",
      "Divulgação do gabarito preliminar: 02/02/2027",
      "Prazo para recurso contra o gabarito: 03 e 04/02/2027",
      "Resultado final do concurso: 15/03/2027",
    ].join("\n");
    expect(short(findNoticeDates(text, TODAY))).toEqual([
      "inscricao_inicio 2026-11-03",
      "isencao 2026-11-07",
      "inscricao_fim 2026-11-28",
      "boleto 2026-11-30",
      "prova 2027-02-01 08:00",
      "gabarito 2027-02-02",
      "recurso 2027-02-03",
      "resultado 2027-03-15",
    ]);
  });

  it("ignora datas de leis, de outros editais e de publicações", () => {
    const text =
      "Nos termos da Lei nº 8.112, de 11 de dezembro de 2025, e do Edital nº 188/2026, de 22 de julho de 2026, publicado no Diário Oficial da União de 18/03/2026, a prova objetiva será aplicada em 10/01/2027.";
    expect(short(findNoticeDates(text, TODAY))).toEqual(["prova 2027-01-10"]);
  });

  it("sem ano, usa o ano mais citado no edital; datas antigas ficam de fora", () => {
    const text = "Concurso 2027\nProva objetiva: 15 de março\nInscrições até 10/01/2027\nResultado final do concurso: 05/05/2019";
    expect(short(findNoticeDates(text, TODAY))).toEqual(["inscricao_fim 2027-01-10", "prova 2027-03-15"]);
  });

  it("classifica pela etapa e ignora o que não é data do cronograma", () => {
    expect(classifyDateContext("Período de inscrições on-line")).toBe("inscricao_inicio");
    expect(classifyDateContext("Prazo final para o pagamento da taxa de inscrição")).toBe("boleto");
    expect(classifyDateContext("Divulgação do resultado preliminar das solicitações de isenção")).toBeNull();
    expect(classifyDateContext("Período de impugnação do Edital de Abertura")).toBeNull();
    expect(classifyDateContext("Resultado Final da Prova de Títulos")).toBeNull();
    expect(classifyDateContext("Prova de Títulos: envio dos documentos")).toBeNull();
    expect(classifyDateContext("Convocação para realização das provas")).toBeNull();
    expect(classifyDateContext("Recurso contra o resultado preliminar da prova didática")).toBeNull();
    expect(classifyDateContext("Homologação do Resultado Final")).toBe("resultado");
  });
});

describe("leitor de edital: outros dados", () => {
  it("órgão pela abertura do texto, arrumando o que vem em maiúsculas", () => {
    expect(findOrgan("A PREFEITA DO MUNICÍPIO DE CONTAGEM, no uso de suas atribuições, torna pública...")).toBe(
      "Município de Contagem",
    );
    expect(findOrgan("O Reitor da Universidade Federal de Minas Gerais, usando de suas atribuições...")).toBe(
      "Universidade Federal de Minas Gerais",
    );
    expect(titleCase("ANALISTA DE TI - ÁREA III")).toBe("Analista de TI - Área III");
    expect(titleCase("Já Está Normal")).toBe("Já Está Normal");
  });

  it("banca, salários, vagas e escolaridade", () => {
    expect(findExamBoard("Execução: Instituto AOCP. Mais informações em www.institutoaocp.org.br")).toBe("Instituto AOCP");
    expect(findExamBoard("Sem banca citada")).toBeNull();
    expect(findSalaries("Vencimento básico: R$ 4.500,00 · Remuneração inicial: R$ 9.776,71 · Taxa: R$ 90,00")).toEqual([
      977_671, 450_000,
    ]);
    expect(findVacancies("concurso público para provimento de 60 (sessenta) vagas de auditor")).toBe(60);
    expect(findVacancies("vagas reservadas a pessoas com deficiência")).toBeNull();
    expect(findEducation("", "Técnico Judiciário - Área Administrativa")).toBe("medio");
    expect(findEducation("exige ensino médio e curso técnico em enfermagem", "Técnico em Enfermagem")).toBe("tecnico");
    expect(findEducation("graduação em qualquer área", null)).toBe("superior");
  });

  it("esfera e local: prefeitura vira concurso municipal com cidade e estado", () => {
    const text = "PREFEITURA MUNICIPAL DE NOVA SERRANA/MG\nEdital de concurso público nº 1/2026";
    const organ = "Prefeitura Municipal de Nova Serrana";
    expect(findSphere(text, organ)).toBe("municipal");
    expect(findPlace(organ, "municipal", text)).toEqual({ city: "Nova Serrana", state: "MG" });
    expect(findSphere("", "Governo do Estado de Minas Gerais")).toBe("estadual");
    expect(findPlace("Governo do Estado de Minas Gerais", "estadual", "")).toEqual({ city: null, state: "MG" });
  });

  it("links: o da inscrição e o PDF do edital", () => {
    expect(
      findLinks("Inscrições em https://www.gestaodeconcursos.com.br/inscricao, edital em https://site.org/edital-01.pdf."),
    ).toEqual({
      registrationUrl: "https://www.gestaodeconcursos.com.br/inscricao",
      noticeUrl: "https://site.org/edital-01.pdf",
    });
  });
});
