"use client";

import { ExternalLink, FileText, FileUp, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/format";
import { jobTypeLabel, type JobType } from "@/lib/options";
import { cn } from "@/lib/utils";
import { deleteResume } from "../actions";
import { LANGUAGE_LEVEL_LABELS } from "../extract";
import {
  DEMO_RESUME_MESSAGE,
  MAX_RESUME_BYTES,
  parseLanguages,
  type Resume,
  type ResumeUploadResponse,
} from "../resume";

/** O que o currículo sugere para o perfil de busca. */
export type ResumeSuggestion = {
  roles: string[];
  jobTypes: JobType[];
  city: string | null;
  state: string | null;
};

type SuggestionKey = "roles" | "jobTypes" | "place";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function listLabel(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function educationLabel(resume: Resume): string | null {
  if (!resume.course) return null;
  if (resume.education_status === "cursando") {
    return resume.graduation_year
      ? `${resume.course}, cursando (formatura prevista para ${resume.graduation_year})`
      : `${resume.course}, cursando`;
  }
  if (resume.education_status === "concluido") {
    return resume.graduation_year ? `${resume.course}, concluído em ${resume.graduation_year}` : `${resume.course}, concluído`;
  }
  return resume.course;
}

/**
 * Currículo no perfil de busca: envio do PDF, o que foi lido dele e as
 * sugestões para o formulário (que a pessoa confere antes de salvar).
 */
export function ResumeCard({
  resume: savedResume,
  isDemo,
  onApply,
}: {
  resume: Resume | null;
  isDemo: boolean;
  onApply: (suggestion: ResumeSuggestion) => void;
}) {
  const router = useRouter();
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // O currículo recém-enviado aparece na hora, antes de a página recarregar os dados.
  const [uploaded, setUploaded] = useState<Resume | null | undefined>(undefined);
  const resume = uploaded === undefined ? savedResume : uploaded;
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [chosen, setChosen] = useState<Record<SuggestionKey, boolean>>({ roles: true, jobTypes: true, place: true });

  const busy = uploading || deleting;

  async function upload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Envie o currículo em PDF.");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      toast.error("O arquivo passa de 4 MB. Exporte o PDF de novo, sem fotos em alta resolução.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.set("arquivo", file);
      const response = await fetch("/api/curriculo", { method: "POST", body });
      const result = (await response.json().catch(() => null)) as ResumeUploadResponse | null;
      if (result?.status !== "ok") {
        toast.error(result?.message ?? "Não foi possível enviar o currículo. Tente de novo.");
        return;
      }
      setUploaded(result.resume);
      setChosen({ roles: true, jobTypes: true, place: true });
      const skills = result.resume.skills.length;
      toast.success("Currículo lido", {
        description:
          skills > 0
            ? `${skills} ${skills === 1 ? "habilidade passa" : "habilidades passam"} a contar na nota das vagas.`
            : "Não achamos habilidades conhecidas nele; as palavras-chave do perfil continuam valendo.",
      });
      router.refresh();
    } catch {
      toast.error("Não conseguimos enviar o arquivo. Verifique sua conexão e tente de novo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteResume();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      setUploaded(null);
      toast.success("Currículo apagado", { description: "As próximas buscas usam só o perfil." });
      router.refresh();
    });
  }

  function handleApply() {
    if (!resume) return;
    onApply({
      roles: chosen.roles ? resume.suggested_roles : [],
      jobTypes: chosen.jobTypes ? resume.suggested_job_types : [],
      city: chosen.place ? resume.city : null,
      state: chosen.place ? resume.state : null,
    });
    toast.success("Sugestões no formulário", { description: "Confira os campos abaixo e salve o perfil." });
  }

  const fileInput = (
    <input
      ref={inputRef}
      id={`${uid}-file`}
      type="file"
      accept="application/pdf,.pdf"
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void upload(file);
      }}
    />
  );
  const pickFile = () => inputRef.current?.click();

  // -------------------------------------------------------------------------
  // Sem currículo
  // -------------------------------------------------------------------------
  if (!resume) {
    if (isDemo) {
      return (
        <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{DEMO_RESUME_MESSAGE}</section>
      );
    }
    return (
      <section
        aria-labelledby={`${uid}-title`}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
          dragging && "border-primary bg-primary/5",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !busy) void upload(file);
        }}
      >
        {fileInput}
        <div className="flex size-11 items-center justify-center rounded-xl border bg-background shadow-sm">
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          ) : (
            <FileUp className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
          )}
        </div>
        <div className="max-w-md space-y-1">
          <h2 id={`${uid}-title`} className="text-sm font-semibold">
            {uploading ? "Lendo seu currículo…" : "Comece pelo currículo"}
          </h2>
          <p className="text-sm text-muted-foreground">
            As habilidades dele entram na nota das vagas, e sugerimos cargos, tipo de vaga e cidade para este perfil.
          </p>
        </div>
        <Button type="button" size="sm" onClick={pickFile} disabled={busy}>
          <FileUp /> Escolher PDF
        </Button>
        <p className="text-xs text-muted-foreground">
          Ou arraste o arquivo para cá. Até 4 MB. Fica guardado de forma privada: só você acessa, e dá para apagar
          quando quiser.
        </p>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Com currículo
  // -------------------------------------------------------------------------
  const languages = parseLanguages(resume.languages);
  const education = educationLabel(resume);
  const place = resume.city ? [resume.city, resume.state].filter(Boolean).join(", ") : null;
  const suggestions: { key: SuggestionKey; label: string; value: string }[] = [
    resume.suggested_roles.length > 0 && {
      key: "roles" as const,
      label: resume.suggested_roles.length === 1 ? "Cargo" : "Cargos",
      value: listLabel(resume.suggested_roles),
    },
    resume.suggested_job_types.length > 0 && {
      key: "jobTypes" as const,
      label: "Tipo de vaga",
      value: listLabel(resume.suggested_job_types.map(jobTypeLabel)),
    },
    place && { key: "place" as const, label: "Cidade", value: place },
  ].filter((item): item is { key: SuggestionKey; label: string; value: string } => Boolean(item));
  const anyChosen = suggestions.some((item) => chosen[item.key]);

  return (
    <section aria-labelledby={`${uid}-title`} className={cn("rounded-xl border bg-card", busy && "opacity-70")}>
      {fileInput}
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileText className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={`${uid}-title`} className="truncate text-sm font-semibold">
            {uploading ? "Lendo o currículo novo…" : resume.file_name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatSize(resume.file_size)} · enviado em {formatDateTime(resume.uploaded_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/api/curriculo" target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Ver PDF
            </a>
          </Button>
          {!isDemo && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={pickFile} disabled={busy}>
                <RefreshCw /> Trocar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 /> Apagar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-4">
        {isDemo && <p className="text-xs text-muted-foreground">{DEMO_RESUME_MESSAGE} Este é um currículo fictício.</p>}

        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr] sm:gap-y-3">
          {education && (
            <>
              <dt className="text-muted-foreground not-first:mt-3 sm:not-first:mt-0">Formação</dt>
              <dd>{education}</dd>
            </>
          )}
          {languages.length > 0 && (
            <>
              <dt className="text-muted-foreground not-first:mt-3 sm:not-first:mt-0">Idiomas</dt>
              <dd>
                {languages
                  .map((language) =>
                    language.level ? `${language.name} (${LANGUAGE_LEVEL_LABELS[language.level]})` : language.name,
                  )
                  .join(", ")}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground not-first:mt-3 sm:not-first:mt-0">Habilidades</dt>
          <dd className="space-y-2">
            {resume.skills.length > 0 ? (
              <>
                <ul className="flex flex-wrap gap-1.5" aria-label="Habilidades encontradas no currículo">
                  {resume.skills.map((skill) => (
                    <li key={skill} className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs">
                      {skill}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Contam sozinhas na nota das vagas, junto com as palavras-chave do perfil.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                Nenhuma habilidade da nossa lista apareceu. Use as palavras-chave abaixo para dizer o que você sabe fazer.
              </p>
            )}
          </dd>
        </dl>

        {suggestions.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4 text-primary" aria-hidden /> Sugestões para o perfil
            </p>
            <ul className="grid gap-2">
              {suggestions.map((item) => (
                <li key={item.key} className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    id={`${uid}-${item.key}`}
                    checked={chosen[item.key]}
                    onCheckedChange={(next) => setChosen((current) => ({ ...current, [item.key]: next === true }))}
                    className="mt-0.5"
                  />
                  <label htmlFor={`${uid}-${item.key}`} className="cursor-pointer">
                    <span className="text-muted-foreground">{item.label}: </span>
                    {item.value}
                  </label>
                </li>
              ))}
            </ul>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={handleApply} disabled={!anyChosen || busy}>
              Usar no perfil
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar o currículo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo e o que foi lido dele saem do app. As próximas buscas usam só o perfil e as palavras-chave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {deleting && <Loader2 className="animate-spin" />}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
