"use client";

import { Copy, ExternalLink, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAGES, getStage, type StageKey } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { deleteApplication, duplicateApplication, moveApplication, undoMoveApplication } from "../actions";

export function ApplicationActions({
  id,
  company,
  stage,
  stageChangedAt,
  position,
  jobUrl,
}: {
  id: string;
  company: string;
  stage: StageKey;
  stageChangedAt: string;
  position: number;
  jobUrl: string | null;
}) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState(stage);
  const [syncedStage, setSyncedStage] = useState(stage);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moving, startMoving] = useTransition();
  const [busy, startBusy] = useTransition();

  // Sincroniza com o servidor quando a página recarrega os dados.
  if (stage !== syncedStage) {
    setSyncedStage(stage);
    setCurrentStage(stage);
  }

  function handleMove(next: StageKey) {
    const previous = currentStage;
    setCurrentStage(next);
    startMoving(async () => {
      const result = await moveApplication({ id, stage: next });
      if (!result.ok) {
        setCurrentStage(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Movida para ${getStage(next).label}.`, {
        description: "A mudança foi registrada na linha do tempo.",
        action: {
          label: "Desfazer",
          onClick: () =>
            startMoving(async () => {
              setCurrentStage(previous);
              const undo = await undoMoveApplication({
                id,
                movedTo: next,
                movedAt: result.data.stage_changed_at,
                previousStage: previous,
                previousPosition: position,
                previousStageChangedAt: stageChangedAt,
              });
              if (!undo.ok) {
                setCurrentStage(next);
                toast.error(undo.error);
              } else toast.success("Movimento desfeito.");
            }),
        },
      });
    });
  }

  function handleDuplicate() {
    startBusy(async () => {
      const result = await duplicateApplication(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Candidatura duplicada. Ajuste o que for diferente.");
      router.push(`/candidaturas/${result.data.id}/editar`);
    });
  }

  function handleDelete() {
    startBusy(async () => {
      const result = await deleteApplication(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      toast.success(`Candidatura da ${company} excluída.`);
      router.push("/quadro");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentStage} onValueChange={(value) => handleMove(value as StageKey)} disabled={moving}>
        <SelectTrigger size="sm" aria-label="Mudar etapa" className="min-w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {STAGES.map((item) => (
            <SelectItem key={item.key} value={item.key}>
              <span aria-hidden className={cn("size-2 rounded-full", item.dot)} />
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/candidaturas/${id}/editar`}>
          <Pencil /> Editar
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Mais ações" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {jobUrl && (
            <DropdownMenuItem asChild>
              <a href={jobUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Abrir a vaga
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={handleDuplicate}>
            <Copy /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a candidatura da {company}?</AlertDialogTitle>
            <AlertDialogDescription>
              A linha do tempo e os próximos passos dela também serão apagados. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              {busy && <Loader2 className="animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
