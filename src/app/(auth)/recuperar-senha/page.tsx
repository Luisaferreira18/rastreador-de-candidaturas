import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/features/auth/components/reset-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ResetRequestPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
        </p>
      </div>
      <ResetRequestForm />
      <p className="text-center text-sm text-muted-foreground">
        Lembrou?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
