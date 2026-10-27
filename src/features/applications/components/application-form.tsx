"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldA11y } from "@/components/form-field";
import { Kbd } from "@/components/kbd";
import { PriorityIcon } from "@/components/priority-indicator";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput, parseBRLToCents, todayISO } from "@/lib/format";
import { JOB_TYPES, PLATFORMS, PRIORITIES, WORK_MODELS } from "@/lib/options";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { createApplication, updateApplication } from "../actions";
import { applicationFormSchema, type ApplicationFormValues } from "../schema";

type Props =
  | { mode: "create"; defaultValues: ApplicationFormValues; applicationId?: undefined }
  | { mode: "edit"; defaultValues: ApplicationFormValues; applicationId: string };

export function ApplicationForm({ mode, defaultValues, applicationId }: Props) {
  // Ids únicos: o Next mantém páginas visitadas no DOM (ocultas), então dois
  // formulários iguais podem coexistir.
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues,
    // Valida ao enviar e, depois disso, a cada alteração. Validar ao sair do
    // campo faria a mensagem de erro empurrar o botão no meio do clique.
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result =
        mode === "create" ? await createApplication(values) : await updateApplication(applicationId, values);

      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof ApplicationFormValues, { message });
        }
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Candidatura criada." : "Alterações salvas.");
      router.push(`/candidaturas/${result.data.id}`);
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        // Ctrl+Enter (ou Cmd+Enter) salva de qualquer campo.
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void onSubmit();
        }
      }}
      noValidate
      className="space-y-8"
    >
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="sr-only">Vaga</legend>
        <FormField id={fid("company")} label="Empresa" error={errors.company?.message}>
          <Input
            {...fieldA11y(fid("company"), errors.company?.message)}
            {...register("company")}
            autoFocus={mode === "create"}
            placeholder="Ex.: Banco Aurora"
            autoComplete="organization"
          />
        </FormField>
        <FormField id={fid("roleTitle")} label="Cargo" error={errors.roleTitle?.message}>
          <Input
            {...fieldA11y(fid("roleTitle"), errors.roleTitle?.message)}
            {...register("roleTitle")}
            placeholder="Ex.: Desenvolvedor(a) Front-end"
          />
        </FormField>

        <FormField id={fid("jobType")} label="Tipo de vaga" error={errors.jobType?.message}>
          <Controller
            control={control}
            name="jobType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={fid("jobType")} className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((jobType) => (
                    <SelectItem key={jobType.value} value={jobType.value}>
                      {jobType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          id={fid("salary")}
          label="Remuneração mensal"
          optional
          error={errors.salary?.message}
          hint="Bolsa ou salário."
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              {...fieldA11y(fid("salary"), errors.salary?.message)}
              {...register("salary", {
                // Ao sair do campo, formata "1800" como "1.800,00".
                onBlur: (event) => {
                  const cents = parseBRLToCents(event.target.value);
                  if (cents !== null) setValue("salary", centsToInput(cents), { shouldValidate: true });
                },
              })}
              inputMode="decimal"
              placeholder="0,00"
              className="pl-9 tabular-nums"
            />
          </div>
        </FormField>

        <FormField id={fid("platform")} label="Onde encontrou a vaga" error={errors.platform?.message}>
          <Controller
            control={control}
            name="platform"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={fid("platform")} className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField id={fid("jobUrl")} label="Link da vaga" optional error={errors.jobUrl?.message}>
          <Input
            {...fieldA11y(fid("jobUrl"), errors.jobUrl?.message)}
            {...register("jobUrl")}
            type="url"
            inputMode="url"
            placeholder="https://"
          />
        </FormField>

        <FormField id={fid("workModel")} label="Modelo de trabalho" error={errors.workModel?.message}>
          <Controller
            control={control}
            name="workModel"
            render={({ field }) => (
              <SegmentedControl
                id={fid("workModel")}
                label="Modelo de trabalho"
                value={field.value}
                options={WORK_MODELS}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField id={fid("location")} label="Local" optional error={errors.location?.message}>
          <Input
            {...fieldA11y(fid("location"), errors.location?.message)}
            {...register("location")}
            placeholder="Ex.: São Paulo, SP"
          />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-6 sm:grid-cols-2" disabled={pending}>
        <legend className="sr-only">Andamento</legend>
        <FormField id={fid("stage")} label="Etapa atual" error={errors.stage?.message}>
          <Controller
            control={control}
            name="stage"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(stage) => {
                  field.onChange(stage);
                  // Saiu de "Quero me candidatar" sem data? Usa hoje como data da candidatura.
                  if (stage !== "quero_candidatar" && !getValues("appliedAt")) {
                    setValue("appliedAt", todayISO(), { shouldDirty: true });
                  }
                }}
              >
                <SelectTrigger id={fid("stage")} className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((stage) => (
                    <SelectItem key={stage.key} value={stage.key}>
                      <span aria-hidden className={cn("size-2 rounded-full", stage.dot)} />
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          id={fid("appliedAt")}
          label="Data em que se candidatou"
          optional
          error={errors.appliedAt?.message}
          hint="Preenchida com hoje quando você muda a etapa."
        >
          <Input
            {...fieldA11y(fid("appliedAt"), errors.appliedAt?.message)}
            {...register("appliedAt")}
            type="date"
            max="2100-12-31"
          />
        </FormField>
        <FormField id={fid("priority")} label="Prioridade" error={errors.priority?.message}>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <SegmentedControl
                id={fid("priority")}
                label="Prioridade"
                value={field.value}
                options={PRIORITIES.map((priority) => ({
                  value: priority.value,
                  label: priority.label,
                  icon: <PriorityIcon priority={priority.value} />,
                }))}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField
          id={fid("notes")}
          label="Observações"
          optional
          error={errors.notes?.message}
          className="sm:col-span-2"
        >
          <Textarea
            {...fieldA11y(fid("notes"), errors.notes?.message)}
            {...register("notes")}
            rows={5}
            placeholder="Contato da recrutadora, impressões da entrevista, requisitos da vaga…"
          />
        </FormField>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <p className="mr-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> para salvar
        </p>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || (mode === "edit" && !isDirty)}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "create" ? "Criar candidatura" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
