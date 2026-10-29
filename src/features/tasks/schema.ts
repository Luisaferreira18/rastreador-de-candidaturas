import { z } from "zod";
import { isValidISODate } from "@/lib/format";

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Descreva o próximo passo.")
    .max(200, "Use no máximo 200 caracteres."),
  dueDate: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidISODate(value), { message: "Data inválida." }),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

/** De quem é a tarefa: de uma candidatura ou de um concurso. */
export type TaskParent = { applicationId: string } | { concursoId: string };

export const taskParentSchema = z.union([
  z.object({ applicationId: z.uuid() }).strict(),
  z.object({ concursoId: z.uuid() }).strict(),
]);

/** As colunas do banco que ligam a tarefa a quem ela pertence. */
export function parentColumns(parent: TaskParent): { application_id: string | null; concurso_id: string | null } {
  return "applicationId" in parent
    ? { application_id: parent.applicationId, concurso_id: null }
    : { application_id: null, concurso_id: parent.concursoId };
}
