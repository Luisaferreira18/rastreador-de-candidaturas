"use client";

import { ExternalLink, FileText, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { CONCURSO_STAGES, getConcursoStage, type ConcursoStageKey } from "@/lib/concurso-stages";
import { cn } from "@/lib/utils";
import { deleteConcurso, moveConcurso, undoMoveConcurso } from "../actions";

export function ConcursoActions({
  id,
  organ,
  stage,
  stageChangedAt,
  position,
  noticeUrl,
  registrationUrl,
}: {
  id: string;
  organ: string;
  stage: ConcursoStageKey;
  stageChangedAt: string;
  position: number;
  noticeUrl: string | null;
  registrationUrl: string | null;
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

  function handleMove(next: ConcursoStageKey) {
    const previous = currentStage;
    setCurrentStage(next);
    startMoving(async () => {
      const result = await moveConcurso({ id, stage: next });
      if (!result.ok) {
        setCurrentStage(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Agora em ${getConcursoStage(next).label}.`, {
        description: "A mudança foi registrada na linha do tempo.",
        action: {
          label: "Desfazer",
          onClick: () =>
            startMoving(async () => {
              setCurrentStage(previous);
              const undo = await undoMoveConcurso({
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

  function handleDelete() {
    startBusy(async () => {
      const result = await deleteConcurso(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setConfirmOpen(false);
      toast.success(`Concurso de ${organ} excluído.`);
      router.push("/concursos");
    });
  }

  // "Ir para a inscrição" leva ao site oficial; sem link de inscrição, ao edital.
  const goTo = registrationUrl ?? noticeUrl;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {goTo && (
        <Button size="sm" asChild>
          <a href={goTo} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> {registrationUrl ? "Ir para a inscrição" : "Abrir o edital"}
            <span className="sr-only">(abre o site oficial em outra aba)</span>
          </a>
        </Button>
      )}

      <Select value={currentStage} onValueChange={(value) => handleMove(value as ConcursoStageKey)} disabled={moving}>
        <SelectTrigger size="sm" aria-label="Mudar etapa" className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          {CONCURSO_STAGES.map((item) => (
            <SelectItem key={item.key} value={item.key}>
              <span aria-hidden className={cn("size-2 rounded-full", item.dot)} />
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/concursos/${id}/editar`}>
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
          {noticeUrl && registrationUrl && (
            <DropdownMenuItem asChild>
              <a href={noticeUrl} target="_blank" rel="noopener noreferrer">
                <FileText /> Abrir o edital
              </a>
            </DropdownMenuItem>
          )}
          {noticeUrl && registrationUrl && <DropdownMenuSeparator />}
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o concurso de {organ}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cronograma, as matérias, os próximos passos e a linha do tempo também serão apagados. Não dá para desfazer.
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
