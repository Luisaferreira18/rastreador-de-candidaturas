import type { Metadata } from "next";
import Link from "next/link";
import { AuthDivider } from "@/features/auth/components/auth-divider";
import { GoogleButton } from "@/features/auth/components/google-button";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { isGoogleAuthEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crie sua conta</h1>
        <p className="text-sm text-muted-foreground">Leva menos de um minuto. É grátis.</p>
      </div>

      {isGoogleAuthEnabled() && (
        <>
          <GoogleButton label="Criar conta com Google" />
          <AuthDivider>ou com e-mail</AuthDivider>
        </>
      )}

      <SignUpForm />

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
