"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState, useTransition, useId } from "react";
import { useForm } from "react-hook-form";
import { FormField, fieldA11y } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, updatePassword } from "../actions";
import {
  newPasswordSchema,
  resetRequestSchema,
  type NewPasswordValues,
  type ResetRequestValues,
} from "../schema";
import { PasswordInput } from "./password-input";

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

export function ResetRequestForm() {
  // Ids únicos: o Next mantém páginas visitadas no DOM (ocultas), então dois
  // formulários iguais podem coexistir.
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetRequestValues>({ resolver: zodResolver(resetRequestSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (result.ok) setSent(true);
      else setFormError(result.error);
    });
  });

  if (sent) {
    return (
      <div role="status" className="space-y-3 rounded-xl border bg-card p-5 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="size-5 text-primary" />
        </span>
        <h2 className="font-semibold">Verifique seu e-mail</h2>
        <p className="text-sm text-muted-foreground">
          Se existir uma conta com esse endereço, você vai receber um link para criar uma nova senha.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
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
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Enviar link
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  // Ids únicos: o Next mantém páginas visitadas no DOM (ocultas), então dois
  // formulários iguais podem coexistir.
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result && !result.ok) setFormError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <FormField
        id={fid("password")}
        label="Nova senha"
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
      <FormField id={fid("confirmPassword")} label="Confirme a nova senha" error={errors.confirmPassword?.message}>
        <PasswordInput
          {...fieldA11y(fid("confirmPassword"), errors.confirmPassword?.message)}
          {...register("confirmPassword")}
          autoComplete="new-password"
          disabled={pending}
        />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Salvar nova senha
      </Button>
    </form>
  );
}
