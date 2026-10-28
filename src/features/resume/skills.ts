/**
 * Habilidades que um currículo costuma citar, com os outros jeitos de
 * escrever cada uma. O nome é o que aparece na tela e o que a busca procura
 * nas vagas (junto com os outros jeitos).
 *
 * Ficaram de fora nomes de uma letra ou palavras comuns ("R", "C", "Go"),
 * que achariam a habilidade em qualquer texto.
 */

import { containsTerm, fold } from "@/features/job-search/text";

/** Área ligada à habilidade, para sugerir cargos ("Estágio em Dados"). */
export type SkillArea = "Dados" | "Desenvolvimento" | "Design" | "Marketing" | "Finanças" | "Recursos Humanos";

type Skill = { label: string; aliases?: readonly string[]; area?: SkillArea };

export const SKILLS: readonly Skill[] = [
  // Escritório
  { label: "Excel", aliases: ["MS Excel", "Microsoft Excel"] },
  { label: "Google Sheets", aliases: ["Planilhas Google", "Google Planilhas"] },
  { label: "Pacote Office", aliases: ["MS Office", "Microsoft Office", "Office 365", "Microsoft 365"] },
  { label: "Word", aliases: ["MS Word", "Microsoft Word"] },
  { label: "PowerPoint", aliases: ["Power Point"] },
  { label: "VBA" },

  // Dados
  { label: "SQL", aliases: ["MySQL", "PostgreSQL", "SQL Server", "T-SQL", "PL/SQL"], area: "Dados" },
  { label: "Python", area: "Dados" },
  { label: "Power BI", aliases: ["PowerBI"], area: "Dados" },
  { label: "Tableau", area: "Dados" },
  { label: "Looker Studio", aliases: ["Google Data Studio", "Data Studio", "Looker"], area: "Dados" },
  { label: "Pandas", area: "Dados" },
  { label: "NumPy", area: "Dados" },
  { label: "Jupyter", area: "Dados" },
  { label: "Spark", aliases: ["PySpark", "Apache Spark"], area: "Dados" },
  { label: "Databricks", area: "Dados" },
  { label: "ETL", area: "Dados" },
  { label: "Machine Learning", aliases: ["Aprendizado de máquina"], area: "Dados" },
  { label: "Estatística", area: "Dados" },
  { label: "Google Analytics", aliases: ["GA4"], area: "Marketing" },

  // Desenvolvimento
  { label: "JavaScript", area: "Desenvolvimento" },
  { label: "TypeScript", area: "Desenvolvimento" },
  { label: "React", aliases: ["React.js", "ReactJS"], area: "Desenvolvimento" },
  { label: "React Native", area: "Desenvolvimento" },
  { label: "Node.js", aliases: ["NodeJS"], area: "Desenvolvimento" },
  { label: "Next.js", aliases: ["NextJS"], area: "Desenvolvimento" },
  { label: "Angular", area: "Desenvolvimento" },
  { label: "Vue.js", aliases: ["Vue", "VueJS"], area: "Desenvolvimento" },
  { label: "HTML", aliases: ["HTML5"], area: "Desenvolvimento" },
  { label: "CSS", aliases: ["CSS3"], area: "Desenvolvimento" },
  { label: "Tailwind", aliases: ["Tailwind CSS"], area: "Desenvolvimento" },
  { label: "Java", area: "Desenvolvimento" },
  { label: "C#", area: "Desenvolvimento" },
  { label: ".NET", aliases: ["dotnet", "ASP.NET"], area: "Desenvolvimento" },
  { label: "C++", area: "Desenvolvimento" },
  { label: "PHP", area: "Desenvolvimento" },
  { label: "Laravel", area: "Desenvolvimento" },
  { label: "Ruby", aliases: ["Ruby on Rails"], area: "Desenvolvimento" },
  { label: "Kotlin", area: "Desenvolvimento" },
  { label: "Swift", area: "Desenvolvimento" },
  { label: "Flutter", area: "Desenvolvimento" },
  { label: "Django", area: "Desenvolvimento" },
  { label: "Flask", area: "Desenvolvimento" },
  { label: "FastAPI", area: "Desenvolvimento" },
  { label: "Spring", aliases: ["Spring Boot"], area: "Desenvolvimento" },
  { label: "Git", area: "Desenvolvimento" },
  { label: "GitHub" },
  { label: "Docker" },
  { label: "Kubernetes" },
  { label: "AWS", aliases: ["Amazon Web Services"] },
  { label: "Azure" },
  { label: "Google Cloud", aliases: ["GCP"] },
  { label: "Linux" },
  { label: "API REST", aliases: ["APIs REST", "RESTful", "REST API", "REST APIs"], area: "Desenvolvimento" },
  { label: "MongoDB" },
  { label: "Firebase" },
  { label: "Scrum" },
  { label: "Metodologias ágeis", aliases: ["Metodologia ágil", "Métodos ágeis", "Agile"] },

  // Design
  { label: "Figma", area: "Design" },
  { label: "Photoshop", area: "Design" },
  { label: "Illustrator", area: "Design" },
  { label: "InDesign", area: "Design" },
  { label: "Adobe XD", area: "Design" },
  { label: "Canva" },
  { label: "Premiere", aliases: ["Premiere Pro"] },
  { label: "After Effects" },
  { label: "Lightroom" },
  { label: "CorelDRAW", aliases: ["Corel Draw"] },
  { label: "UX", aliases: ["UX Design", "Experiência do usuário"], area: "Design" },
  { label: "UI", aliases: ["UI Design"], area: "Design" },

  // Marketing e vendas
  { label: "Marketing digital", area: "Marketing" },
  { label: "SEO", area: "Marketing" },
  { label: "Google Ads", area: "Marketing" },
  { label: "Meta Ads", aliases: ["Facebook Ads", "Instagram Ads"], area: "Marketing" },
  { label: "Redes sociais", aliases: ["Social media", "Mídias sociais"], area: "Marketing" },
  { label: "Copywriting", area: "Marketing" },
  { label: "E-mail marketing", aliases: ["Email marketing"], area: "Marketing" },
  { label: "Edição de vídeo", aliases: ["Edição de vídeos"] },
  { label: "CRM" },
  { label: "HubSpot", area: "Marketing" },
  { label: "RD Station", area: "Marketing" },
  { label: "Salesforce" },

  // Administração e finanças
  { label: "SAP" },
  { label: "TOTVS", aliases: ["Protheus"] },
  { label: "ERP" },
  { label: "Contas a pagar", area: "Finanças" },
  { label: "Contas a receber", area: "Finanças" },
  { label: "Conciliação bancária", area: "Finanças" },
  { label: "Fluxo de caixa", area: "Finanças" },
  { label: "Análise financeira", area: "Finanças" },
  { label: "Departamento pessoal", area: "Recursos Humanos" },
  { label: "Folha de pagamento", area: "Recursos Humanos" },
  { label: "Recrutamento e seleção", aliases: ["R&S"], area: "Recursos Humanos" },
  { label: "Atendimento ao cliente", aliases: ["Atendimento ao público"] },
  { label: "Gestão de projetos", aliases: ["Gerenciamento de projetos"] },

  // Engenharia e arquitetura
  { label: "AutoCAD" },
  { label: "SolidWorks" },
  { label: "Revit" },
  { label: "SketchUp" },
  { label: "MATLAB" },
  { label: "BIM" },
  { label: "Arduino" },
  { label: "Lean", aliases: ["Lean Manufacturing"] },
  { label: "Six Sigma" },
];

const BY_LABEL = new Map(SKILLS.map((skill) => [fold(skill.label), skill]));

/** Todos os jeitos de escrever a habilidade (para procurar nas vagas). */
export function skillTerms(label: string): string[] {
  const skill = BY_LABEL.get(fold(label));
  return skill ? [skill.label, ...(skill.aliases ?? [])] : [label];
}

/** O texto (já sem acentos) cita a habilidade, de qualquer jeito? */
export function mentionsSkill(foldedText: string, label: string): boolean {
  return skillTerms(label).some((term) => containsTerm(foldedText, term));
}

export function skillArea(label: string): SkillArea | undefined {
  return BY_LABEL.get(fold(label))?.area;
}
