"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState, useTransition, useId } from "react";
import { useForm } from "react-hook-form";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUp } from "../actions";
import { signUpSchema, type SignUpValues } from "../schema";
import { PasswordInput } from "./password-input";

export function SignUpForm() {
  // Ids únicos: o Next mantém páginas visitadas no DOM (ocultas), então dois
  // formulários iguais podem coexistir.
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUp(values);
      if (!result) return;
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof SignUpValues, { message });
        }
        setFormError(result.error);
        return;
      }
      setSentTo(result.data.email);
    });
  });

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 rounded-xl border bg-card p-5 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="size-5 text-primary" />
        </span>
        <h2 className="font-semibold">Confirme seu e-mail</h2>
        <p className="text-sm text-muted-foreground">
          Enviamos um link para <strong className="text-foreground">{sentTo}</strong>. Clique nele para ativar sua conta.
          Não chegou? Confira o spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <FormField id={fid("name")} label="Nome" error={errors.name?.message}>
        <Input
          {...fieldA11y(fid("name"), errors.name?.message)}
          {...register("name")}
          autoComplete="name"
          placeholder="Como você quer ser chamado(a)"
          disabled={pending}
        />
      </FormField>
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
      <FormField
        id={fid("password")}
        label="Senha"
        error={errors.password?.message}
        hint="Pelo menos 8 caracteres, com letras e números."
      >
        <PasswordInput
          {...fieldA11y(fid("password"), errors.password?.message)}
          {...register("password")}
          autoComplete="new-password"
          disabled={pending}
        />
      </FormField>
      <FormField id={fid("confirmPassword")} label="Confirme a senha" error={errors.confirmPassword?.message}>
        <PasswordInput
          {...fieldA11y(fid("confirmPassword"), errors.confirmPassword?.message)}
          {...register("confirmPassword")}
          autoComplete="new-password"
          disabled={pending}
        />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Criar conta
      </Button>
    </form>
  );
}
