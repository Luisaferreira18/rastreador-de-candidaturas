"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, useId } from "react";
import { useForm } from "react-hook-form";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "../actions";
import { signInSchema, type SignInValues } from "../schema";
import { PasswordInput } from "./password-input";

export function SignInForm({ next }: { next?: string }) {
  // Ids únicos: o Next mantém páginas visitadas no DOM (ocultas), então dois
  // formulários iguais podem coexistir.
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signIn(values, next);
      if (result && !result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof SignInValues, { message });
        }
        setFormError(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <FormField id={fid("email")} label="E-mail" error={errors.email?.message}>
        <Input
          {...fieldA11y(fid("email"), errors.email?.message)}
          {...register("email")}
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          disabled={pending}
        />
      </FormField>
      <FormField id={fid("password")} label="Senha" error={errors.password?.message}>
        <PasswordInput
          {...fieldA11y(fid("password"), errors.password?.message)}
          {...register("password")}
          autoComplete="current-password"
          disabled={pending}
        />
      </FormField>
      <div className="-mt-1 text-right">
        <Link href="/recuperar-senha" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}
