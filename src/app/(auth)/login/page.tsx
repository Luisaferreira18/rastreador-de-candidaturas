import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthDivider } from "@/features/auth/components/auth-divider";
import { DemoButton } from "@/features/auth/components/demo-button";
import { GoogleButton } from "@/features/auth/components/google-button";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { getDemoCredentials, isGoogleAuthEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  link: "O link expirou ou já foi usado. Entre com sua senha ou peça um novo link.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const showGoogle = isGoogleAuthEnabled();
  const showDemo = getDemoCredentials() !== null;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Que bom te ver de novo</h1>
        <p className="text-sm text-muted-foreground">Entre para acompanhar suas candidaturas.</p>
      </div>

      <Suspense fallback={<LoginSkeleton />}>
        <LoginContent searchParams={searchParams} showGoogle={showGoogle} />
      </Suspense>

      {showDemo && (
        <div className="space-y-3 rounded-xl border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            Só quer dar uma olhada? A conta de demonstração já vem com dados de exemplo.
          </p>
          <DemoButton />
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

async function LoginContent({
  searchParams,
  showGoogle,
}: {
  searchParams: PageProps<"/login">["searchParams"];
  showGoogle: boolean;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.erro === "string" ? ERRORS[params.erro] : undefined;

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {showGoogle && (
        <>
          <GoogleButton next={next} />
          <AuthDivider>ou com e-mail</AuthDivider>
        </>
      )}
      <SignInForm next={next} />
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-8" />
    </div>
  );
}
