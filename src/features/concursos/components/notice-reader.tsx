"use client";

import { Check, ClipboardPaste, FileSearch, Link2, Loader2, Minus, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dateKindLabel, educationLabel, sphereLabel } from "@/lib/concurso-options";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { readingToFormValues, type NoticeReadResponse } from "../notice-form";
import { formatTime } from "../schedule";
import { ConcursoForm } from "./concurso-form";

type Mode = "texto" | "link";
type Result = Extract<NoticeReadResponse, { status: "ok" }>;

const MODES = [
  { value: "texto" as const, label: "Colar o texto", icon: <ClipboardPaste className="size-3.5" /> },
  { value: "link" as const, label: "Link do edital", icon: <Link2 className="size-3.5" /> },
];
const OTHER_ROLE = "outro";

function Found({ label, value }: { label: string; value: React.ReactNode | null }) {
  const found = value !== null && value !== "" && value !== false;
  return (
    <li className="flex items-start gap-2 text-sm">
      {found ? (
        <Check className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
      ) : (
        <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className={cn(!found && "text-muted-foreground")}>
        <span className="text-muted-foreground">{label}: </span>
        {found ? value : "não encontrado"}
      </span>
    </li>
  );
}

/**
 * "Ler edital": a pessoa cola o texto ou o link, o app sugere os dados e o
 * cronograma, e o formulário já vem preenchido para conferir e salvar.
 */
export function NoticeReader({ today }: { today: string }) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>("texto");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [role, setRole] = useState<string>(OTHER_ROLE);

  async function read() {
    const body = mode === "texto" ? { text } : { url };
    if (mode === "texto" ? text.trim().length < 200 : url.trim().length < 4) {
      toast.error(mode === "texto" ? "Cole o texto do edital (pelo menos um parágrafo)." : "Cole o link do edital.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/concursos/edital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as NoticeReadResponse | null;
      if (data?.status !== "ok") {
        toast.error(data?.message ?? "Não foi possível ler o edital. Tente de novo.");
        return;
      }
      setResult(data);
      setRole(data.reading.roles[0] ?? OTHER_ROLE);
      const found = data.reading.dates.length;
      toast.success("Edital lido", {
        description: found > 0 ? `${found} ${found === 1 ? "data encontrada" : "datas encontradas"} no cronograma.` : "Nenhuma data de cronograma encontrada.",
      });
    } catch {
      toast.error("Não conseguimos falar com o servidor. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }

  if (!result) {
    return (
      <div className="space-y-4">
        <SegmentedControl label="Como enviar o edital" value={mode} options={MODES} onChange={setMode} className="max-w-sm" />
        {mode === "texto" ? (
          <div className="grid gap-1.5">
            <label htmlFor={`${uid}-texto`} className="text-sm font-medium">
              Texto do edital
            </label>
            <Textarea
              id={`${uid}-texto`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={14}
              placeholder="Abra o edital (PDF ou Diário Oficial), selecione tudo, copie e cole aqui. Quanto mais texto, melhor: o cronograma costuma ficar no fim."
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">{text.length.toLocaleString("pt-BR")} caracteres</p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <label htmlFor={`${uid}-link`} className="text-sm font-medium">
              Link do edital
            </label>
            <Input
              id={`${uid}-link`}
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://… (PDF do edital, página do Diário Oficial ou da banca)"
              onKeyDown={(event) => {
                if (event.key === "Enter") void read();
              }}
            />
            <p className="text-xs text-muted-foreground">
              O app baixa o arquivo só para ler, sem login em nenhum site. PDF escaneado não tem texto: nesse caso, copie e cole.
            </p>
          </div>
        )}
        <Button onClick={() => void read()} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <FileSearch />}
          {loading ? "Lendo o edital…" : "Ler edital"}
        </Button>
      </div>
    );
  }

  const { reading } = result;
  const roleIndex = reading.roles.indexOf(role);
  const education = roleIndex >= 0 ? (result.educationByRole[roleIndex] ?? reading.education) : reading.education;
  const defaults = readingToFormValues(reading, {
    role: role === OTHER_ROLE ? null : role,
    education,
    sourceUrl: result.source.url,
    today,
  });

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border bg-card p-4" aria-labelledby={`${uid}-encontrado`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id={`${uid}-encontrado`} className="text-sm font-semibold">
              O que o leitor encontrou
            </h2>
            <p className="text-xs text-muted-foreground">
              {result.source.url ? (result.source.isPdf ? "PDF baixado do link" : "Página baixada do link") : "Texto colado"} ·{" "}
              {result.source.chars.toLocaleString("pt-BR")} caracteres. O leitor usa regras simples e pode errar: confira no edital.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
            <RotateCcw /> Ler outro
          </Button>
        </div>

        <ul className="grid gap-1.5 sm:grid-cols-2">
          <Found label="Órgão" value={reading.organ} />
          <Found label="Banca" value={reading.examBoard} />
          <Found label="Esfera" value={reading.sphere && sphereLabel(reading.sphere)} />
          <Found label="Escolaridade" value={education && educationLabel(education)} />
          <Found
            label="Salário"
            value={reading.salaries.length > 0 ? reading.salaries.map((cents) => formatCurrency(cents)).join(", ") : null}
          />
          <Found
            label="Vagas"
            value={
              reading.vacancies !== null
                ? `${reading.vacancies}${reading.reserveList ? " + cadastro reserva" : ""}`
                : reading.reserveList
                  ? "Cadastro reserva"
                  : null
            }
          />
          <Found label="Link de inscrição" value={reading.registrationUrl} />
          <Found label="Cargos" value={reading.roles.length > 0 ? `${reading.roles.length}` : null} />
        </ul>

        {reading.dates.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Cronograma ({reading.dates.length})</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {reading.dates.map((item) => (
                <li key={`${item.kind}-${item.date}-${item.time}`} className="flex gap-2">
                  <span className="w-32 shrink-0 tabular-nums">
                    {formatDate(item.date)}
                    {item.time && <span className="text-muted-foreground"> {formatTime(item.time)}</span>}
                  </span>
                  <span className="min-w-0 truncate" title={item.note ?? undefined}>
                    {dateKindLabel(item.kind)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma data de cronograma encontrada. Em muitos editais federais o cronograma fica num anexo publicado depois; adicione as
            datas no formulário quando sair.
          </p>
        )}

        {reading.roles.length > 0 && (
          <div className="grid max-w-xl gap-1.5">
            <label htmlFor={`${uid}-cargo`} className="text-sm font-medium">
              Qual cargo você vai acompanhar?
            </label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id={`${uid}-cargo`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {reading.roles.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_ROLE}>Outro (vou digitar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      <section aria-label="Conferir e salvar">
        <h2 className="mb-1 text-base font-semibold">Confira e salve</h2>
        <p className="mb-6 text-sm text-muted-foreground">Os campos já vêm preenchidos com o que foi encontrado. Ajuste o que precisar.</p>
        {/* A chave recria o formulário quando a pessoa troca de cargo. */}
        <ConcursoForm key={role} mode="create" defaultValues={defaults} />
      </section>
    </div>
  );
}
