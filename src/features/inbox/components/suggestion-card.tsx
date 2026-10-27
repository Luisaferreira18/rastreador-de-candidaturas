"use client";

import { ClipboardPaste, Loader2, Mail } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { StageDot } from "@/components/stage-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { STAGES, getStage, type StageKey } from "@/lib/stages";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";
import { applyInboxItem, ignoreInboxItem } from "../actions";
import { matchApplication, planInboxItem, type PlanApplication } from "../plan";
import { KIND_INFO } from "../types";

const KEEP = "manter";
const NEW = "nova";

/** Uma sugestão da caixa de entrada: confira, ajuste se precisar e aplique. */
export function SuggestionCard({
  item,
  applications,
}: {
  item: Tables<"inbox_items">;
  applications: PlanApplication[];
}) {
  const uid = useId();
  const matched = useMemo(
    () => matchApplication(item.company, item.role_title, applications),
    [item.company, item.role_title, applications],
  );
  const [applicationId, setApplicationId] = useState<string>(matched?.id ?? NEW);
  const [stage, setStage] = useState<string>(item.suggested_stage ?? KEEP);
  const [company, setCompany] = useState(item.company ?? "");
  const [roleTitle, setRoleTitle] = useState(item.role_title ?? "");
  const [taskTitle, setTaskTitle] = useState(item.task_title ?? "");
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  const overrides = {
    applicationId,
    stage: stage === KEEP ? null : (stage as StageKey),
    company: company.trim() || undefined,
    roleTitle: roleTitle.trim() || undefined,
    taskTitle: taskTitle.trim() || null,
    dueDate: dueDate || null,
  };
  const plan = planInboxItem(item, applications, overrides);
  const preview =
    plan.action === "nada"
      ? plan.reason
      : [
          plan.summary,
          plan.task && `próximo passo "${plan.task.title}"${plan.task.dueDate ? ` até ${plan.task.dueDate.split("-").reverse().join("/")}` : ""}`,
        ]
          .filter(Boolean)
          .join(" · ");

  const kind = KIND_INFO[item.kind];
  const SourceIcon = item.source === "email" ? Mail : ClipboardPaste;

  function handleApply() {
    startTransition(async () => {
      const result = await applyInboxItem(item.id, overrides);
      if (result.ok) toast.success(result.data.summary, { description: "Sugestão aplicada." });
      else toast.error(result.error);
    });
  }

  function handleIgnore() {
    startTransition(async () => {
      const result = await ignoreInboxItem(item.id);
      if (result.ok) toast.success("Sugestão ignorada.");
      else toast.error(result.error);
    });
  }

  return (
    <Card className={cn("gap-0 p-0 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
          <SourceIcon className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
              {kind.stage && <StageDot stage={kind.stage} className="size-1.5" />}
              {kind.label}
            </span>
            {item.confidence === "baixa" && (
              <span className="text-xs text-muted-foreground">Não reconheci a etapa: escolha abaixo.</span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {item.source === "email" ? "E-mail" : "Mensagem colada"} · {formatDateTime(item.received_at)}
            </span>
          </div>
          <p className="truncate text-sm font-medium">{item.subject || "(sem assunto)"}</p>
          {item.sender && <p className="truncate text-xs text-muted-foreground">De: {item.sender}</p>}
          {item.snippet && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className={cn(
                "block w-full text-left text-sm text-muted-foreground",
                !expanded && "line-clamp-2",
              )}
              aria-expanded={expanded}
              title={expanded ? "Mostrar menos" : "Mostrar a mensagem toda"}
            >
              {item.snippet}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid min-w-0 content-start gap-1.5">
          <Label htmlFor={`${uid}-app`} className="text-xs text-muted-foreground">
            Candidatura
          </Label>
          <Select value={applicationId} onValueChange={setApplicationId} disabled={pending}>
            <SelectTrigger
              id={`${uid}-app`}
              size="sm"
              className="w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-72">
              <SelectItem value={NEW}>+ Nova candidatura</SelectItem>
              <SelectSeparator />
              {applications.map((application) => (
                <SelectItem key={application.id} value={application.id}>
                  <StageDot stage={application.stage} className="size-1.5" />
                  <span className="min-w-0 truncate">
                    {application.company} · {application.role_title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {applicationId === NEW && (
          <>
            <div className="grid min-w-0 content-start gap-1.5">
              <Label htmlFor={`${uid}-company`} className="text-xs text-muted-foreground">
                Empresa
              </Label>
              <Input
                id={`${uid}-company`}
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Nome da empresa"
                className="h-7"
                disabled={pending}
              />
            </div>
            <div className="grid min-w-0 content-start gap-1.5">
              <Label htmlFor={`${uid}-role`} className="text-xs text-muted-foreground">
                Cargo
              </Label>
              <Input
                id={`${uid}-role`}
                value={roleTitle}
                onChange={(event) => setRoleTitle(event.target.value)}
                placeholder="Cargo a confirmar"
                className="h-7"
                disabled={pending}
              />
            </div>
          </>
        )}

        <div className="grid min-w-0 content-start gap-1.5">
          <Label htmlFor={`${uid}-stage`} className="text-xs text-muted-foreground">
            Etapa
          </Label>
          <Select value={stage} onValueChange={setStage} disabled={pending}>
            <SelectTrigger id={`${uid}-stage`} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={KEEP}>Não mudar a etapa</SelectItem>
              <SelectSeparator />
              {STAGES.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  <span aria-hidden className={cn("size-2 rounded-full", option.dot)} />
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={cn("grid content-start gap-1.5", applicationId === NEW ? "sm:col-span-2 lg:col-span-3" : "lg:col-span-1")}>
          <Label htmlFor={`${uid}-task`} className="text-xs text-muted-foreground">
            Próximo passo (opcional)
          </Label>
          <Input
            id={`${uid}-task`}
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder="Ex.: Fazer o teste online"
            className="h-7"
            disabled={pending}
          />
        </div>
        <div className="grid min-w-0 content-start gap-1.5">
          <Label htmlFor={`${uid}-due`} className="text-xs text-muted-foreground">
            Prazo
          </Label>
          <Input
            id={`${uid}-due`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-7"
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center">
        <p className={cn("min-w-0 flex-1 text-xs", plan.action === "nada" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
          {plan.action !== "nada" && plan.action === "atualizar" && plan.stage && (
            <StageDot stage={plan.stage} className="mr-1.5 size-1.5 align-middle" />
          )}
          {plan.action === "criar" && <StageDot stage={plan.stage} className="mr-1.5 size-1.5 align-middle" />}
          {preview}
        </p>
        <div className="flex gap-2 sm:shrink-0">
          <Button variant="ghost" size="sm" onClick={handleIgnore} disabled={pending}>
            Ignorar
          </Button>
          <Button size="sm" onClick={handleApply} disabled={pending || plan.action === "nada"}>
            {pending && <Loader2 className="animate-spin" />}
            Aplicar
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Rótulo curto de uma etapa (usado no histórico). */
export function stageLabel(stage: StageKey | null): string {
  return stage ? getStage(stage).label : "—";
}
