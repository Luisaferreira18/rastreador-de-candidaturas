import type { Metadata } from "next";
import { NewPasswordForm } from "@/features/auth/components/reset-forms";

export const metadata: Metadata = { title: "Nova senha" };

/** Aberta pelo link do e-mail de recuperação (o /auth/callback já criou a sessão). */
export default function NewPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crie uma nova senha</h1>
        <p className="text-sm text-muted-foreground">Depois de salvar, você já entra direto no painel.</p>
      </div>
      <NewPasswordForm />
    </div>
  );
}
