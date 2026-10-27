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
