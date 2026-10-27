import { z } from "zod";

const email = z.string().trim().min(1, "Informe seu e-mail.").pipe(z.email("E-mail inválido."));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
});

const newPassword = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "Use no máximo 72 caracteres.")
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: "Misture letras e números.",
  });

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Como podemos te chamar?").max(80, "Use no máximo 80 caracteres."),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não são iguais.",
    path: ["confirmPassword"],
  });

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    message: "As senhas não são iguais.",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ResetRequestValues = z.infer<typeof resetRequestSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

/** Só aceita caminhos internos no ?next= (evita redirecionar para outro site). */
export function safeNextPath(next: string | null | undefined, fallback = "/painel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
