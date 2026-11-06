import { describe, expect, it } from "vitest";
import { experienceDemand, experienceFit } from "@/features/job-search/experience";
import { fold } from "@/features/job-search/text";
import { experienceLabel, findExperienceMonths } from "@/features/resume/extract";

/** Os textos abaixo vieram de descrições reais da Gupy (nov/2026). */
describe("quantos anos a vaga pede", () => {
  it.each([
    ["ou areas afins;04 anos de experiencia na area ou funcao similar.", 4],
    ["experiencia minima: 3 a 5 anos em analise de dados.", 3],
    ["experiencia comprovada de 1 a 3 anos atuando com suporte a dados", 1],
    ["ou areas afins;5 anos ou mais de experiencia em ciencia de dados", 5],
    ["ou areas afins;cerca de 2 anos de experiencia com ciencia de dados", 2],
    ["ensino medio completo;vivencia de 1 ano na area comercial", 1],
    ["experiencia minima de 05 anos em suprimentos/procurement, sendo 02 anos com sap", 5],
    ["vivencia: tres anos de experiencia atuando em assessoria de imprensa", 3],
    ["mais de 2 anos de experiencia em marketing digital", 2],
    ["ou areas correlatas; experiencia acima de 5 anos;ingles", 5],
    ["experiencia comprovada minima de 2 anos na area de contas a pagar", 2],
    ["experiencia de 5 anos ou mais em software; experiencia de pelo menos 1 ano em lideranca", 5],
    ["experiencia: entre 3 e 4 anos em analise e desenvolvimento", 3],
    ["experiencia no mercado financeiro de no minimo 10 anos em cargos de gestao", 10],
    ["experiencia minima de 5 anos en posiciones similares", 5],
    ["3+ years of experience with python", 3],
    ["at least 2 years of relevant work experience", 2],
  ])("%s", (text, years) => {
    expect(experienceDemand(fold(text)).required).toBe(years);
  });

  it.each([
    "em 2025, completamos 50 anos de experiencia no setor, escrevendo uma historia",
    "sao cerca de 50 anos de experiencia, transformando o mercado",
    "com mais de 30 anos de experiencia no mercado, proporcionamos solucoes",
    "com mais de 12 anos de experiencia no setor, somos referencia",
    "a experiencia e a tradicao de mais de 25 anos fortalecem nossa eficiencia",
    "com cerca de 50 anos de atuacao, a solvi desenvolve solucoes",
    "experiencia em recursos humanos generalista",
    "experiencia anterior; ter no minimo 18 anos de idade",
    "ter, no minimo, 1 ano disponivel para estagio",
    "experiencia solida em desenvolvimento humano e organizacional",
  ])("não pede: %s", (text) => {
    expect(experienceDemand(fold(text)).required).toBeNull();
  });

  it("desejável fica separado do exigido", () => {
    expect(experienceDemand(fold("desejavel 3 anos de experiencia com vendas"))).toEqual({ required: null, desired: 3, strong: null });
    expect(experienceDemand(fold("sera um diferencial: experiencia de 2 anos"))).toEqual({ required: null, desired: 2, strong: null });
    expect(experienceDemand(fold("experiencia de 2 anos; desejavel 5 anos de experiencia em lideranca"))).toEqual({ required: 2, desired: 5, strong: null });
  });
});

describe("a vaga combina com a experiência da pessoa?", () => {
  const fit = (text: string, months: number | null, jobType: "clt" | "estagio" | "trainee" = "clt") =>
    experienceFit(fold(text), jobType, { months });

  it("falta mais de um ano: sai da lista", () => {
    expect(fit("Experiência mínima de 3 anos.", 12).excluded).toBe("Pede 3 anos de experiência: seu currículo soma 1 ano");
    expect(fit("Experiência mínima de 2 anos.", 0).excluded).toBe("Pede 2 anos de experiência: seu currículo não soma experiência");
  });

  it("falta até um ano: fica, com aviso", () => {
    expect(fit("Experiência mínima de 2 anos.", 15)).toEqual({
      excluded: null,
      warnings: ["Pede 2 anos de experiência: seu currículo soma 1 ano e 3 meses"],
    });
    expect(fit("Experiência mínima de 2 anos.", 12).excluded).toBeNull();
    expect(fit("Vivência de 1 ano na área.", 0).excluded).toBeNull();
  });

  it("com a experiência pedida, nada muda", () => {
    expect(fit("Experiência mínima de 2 anos.", 24)).toEqual({ excluded: null, warnings: [] });
  });

  it("sem conseguir somar, só avisa: nunca tira a vaga da lista", () => {
    expect(fit("Experiência mínima de 5 anos.", null)).toEqual({
      excluded: null,
      warnings: ["Pede 5 anos de experiência: não achamos no seu currículo"],
    });
  });

  it.each([
    "requisitos e qualificacoesexperiencia solida em desenvolvimento utilizando python",
    "requisitosexperiencia solida com engenharia de dados em ambientes digitais",
    "experiencia previa consolidada como analista de rh",
    "familiaridade com frameworks de rh;forte experiencia com estruturacao",
    "experiencia consolidada em rotinas de departamento pessoal",
  ])("experiência forte, em palavras: %s", (text) => {
    expect(experienceDemand(fold(text)).strong).toBe("exigida");
    expect(fit(text, 6).excluded).toBe("Pede experiência sólida na área");
    expect(fit(text, 24)).toEqual({ excluded: null, warnings: [] });
    expect(fit(text, null)).toEqual({ excluded: null, warnings: ["Pede experiência sólida: não achamos no seu currículo"] });
  });

  it("experiência comum, ou forte só como desejável, não tira a vaga", () => {
    expect(fit("Experiência em rotinas administrativas.", 0)).toEqual({ excluded: null, warnings: [] });
    expect(fit("Experiência com Excel e conhecimento sólido em SQL.", 0)).toEqual({ excluded: null, warnings: [] });
    expect(fit("Diferencial: experiência sólida em vendas.", 0)).toEqual({ excluded: null, warnings: ["Experiência sólida é desejável"] });
  });

  it("desejável só avisa, e só para quem tem menos", () => {
    expect(fit("Desejável 3 anos de experiência.", 6)).toEqual({ excluded: null, warnings: ["3 anos de experiência é desejável"] });
    expect(fit("Desejável 3 anos de experiência.", 48).warnings).toEqual([]);
    expect(fit("Desejável 3 anos de experiência.", null).warnings).toEqual([]);
  });

  it("estágio não é filtrado por experiência, e trainee é", () => {
    expect(fit("Experiência mínima de 3 anos.", 0, "estagio")).toEqual({ excluded: null, warnings: [] });
    expect(fit("Experiência mínima de 3 anos.", 0, "trainee").excluded).not.toBeNull();
  });

  it("sem currículo, nada muda", () => {
    expect(experienceFit(fold("Experiência mínima de 3 anos."), "clt", null)).toEqual({ excluded: null, warnings: [] });
  });
});

describe("experiência somada do currículo", () => {
  const YEAR = 2026;
  const cv = (...lines: string[]) => ["Ana Lima", "Formação", "Direito 2015 - 2019", "Experiência", ...lines, "Habilidades", "Excel 2020 - 2021"].join("\n");

  it("soma os períodos com mês e não conta a formação nem o que vem depois", () => {
    expect(findExperienceMonths(cv("Empresa A · 01/2020 - 12/2020", "Empresa B · mar/2021 - fev/2022"), YEAR)).toBe(24);
  });

  it("aceita os jeitos comuns de escrever datas", () => {
    expect(findExperienceMonths(cv("Março de 2020 a dezembro de 2020"), YEAR)).toBe(10);
    expect(findExperienceMonths(cv("Jan 2020 – Jun 2020"), YEAR)).toBe(6);
    expect(findExperienceMonths(cv("Sep 2020 to Dec 2020"), YEAR)).toBe(4);
    expect(findExperienceMonths(cv("01/03/2020 - 31/08/2020"), YEAR)).toBe(6);
  });

  it("emprego atual vai até o fim deste ano; só com o ano, conta o ano inteiro", () => {
    expect(findExperienceMonths(cv("mar/2025 - atual"), YEAR)).toBe(22);
    expect(findExperienceMonths(cv("jan/2026 - o momento"), YEAR)).toBe(12);
    expect(findExperienceMonths(cv("2020 - 2021"), YEAR)).toBe(24);
    expect(findExperienceMonths(cv("2020 - 2020"), YEAR)).toBe(12);
  });

  it("períodos sobrepostos contam uma vez só", () => {
    expect(findExperienceMonths(cv("01/2020 - 12/2020", "06/2020 - 06/2021", "03/2020 - 04/2020"), YEAR)).toBe(18);
  });

  it("ignora data invertida e corta data no futuro", () => {
    expect(findExperienceMonths(cv("2022 - 2020"), YEAR)).toBeNull();
    expect(findExperienceMonths(cv("01/2026 - 12/2030"), YEAR)).toBe(12);
  });

  it("sem título claro ou sem períodos, não dá para somar", () => {
    expect(findExperienceMonths("Formação\nDireito 2015 - 2019\nTenho experiência em vendas desde 2020 - 2021", YEAR)).toBeNull();
    expect(findExperienceMonths(cv("Monitoria em 2025"), YEAR)).toBeNull();
    expect(findExperienceMonths("Experiência Empresa 2020 - 2021 tudo numa linha só", YEAR)).toBeNull();
  });

  it("escreve o total por extenso", () => {
    expect(experienceLabel(1)).toBe("1 mês");
    expect(experienceLabel(8)).toBe("8 meses");
    expect(experienceLabel(12)).toBe("1 ano");
    expect(experienceLabel(25)).toBe("2 anos e 1 mês");
    expect(experienceLabel(27)).toBe("2 anos e 3 meses");
  });
});
