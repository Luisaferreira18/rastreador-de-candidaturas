"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldA11y } from "@/components/form-field";
import { Kbd } from "@/components/kbd";
import { PriorityIcon } from "@/components/priority-indicator";
import { SegmentedControl } from "@/components/segmented-control";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATES } from "@/features/job-search/brazil";
import { DATE_KINDS, EDUCATION_LEVELS, SPHERES } from "@/lib/concurso-options";
import { CONCURSO_STAGES } from "@/lib/concurso-stages";
import { centsToInput, parseBRLToCents } from "@/lib/format";
import { PRIORITIES } from "@/lib/options";
import { cn } from "@/lib/utils";
import { createConcurso, updateConcurso } from "../actions";
import { concursoFormSchema, type ConcursoFormValues } from "../schema";

const NO_STATE = "nenhum";

type Props =
  | { mode: "create"; defaultValues: ConcursoFormValues; concursoId?: undefined }
  | { mode: "edit"; defaultValues: ConcursoFormValues; concursoId: string };

/** Seleção simples ligada ao formulário (esfera, escolaridade, etapa...). */
function OptionSelect({
  id,
  value,
  onChange,
  onBlur,
  options,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: readonly { value: string; label: string; dot?: string }[];
  ariaLabel?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full" onBlur={onBlur} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.dot && <span aria-hidden className={cn("size-2 rounded-full", option.dot)} />}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ConcursoForm({ mode, defaultValues, concursoId }: Props) {
  // Ids únicos: o Next mantém páginas visitadas no DOM (ocultas).
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
    formState: { errors, isDirty },
  } = useForm<ConcursoFormValues>({
    resolver: zodResolver(concursoFormSchema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const dates = useFieldArray({ control, name: "dates" });
  const subjects = useFieldArray({ control, name: "subjects", keyName: "fieldKey" });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = mode === "create" ? await createConcurso(values) : await updateConcurso(concursoId, values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof ConcursoFormValues, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Concurso criado." : "Alterações salvas.");
      router.push(`/concursos/${result.data.id}`);
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
        <legend className="sr-only">Concurso</legend>
        <FormField id={fid("organ")} label="Órgão" error={errors.organ?.message}>
          <Input
            {...fieldA11y(fid("organ"), errors.organ?.message)}
            {...register("organ")}
            autoFocus={mode === "create"}
            placeholder="Ex.: Tribunal Regional do Trabalho da 3ª Região"
          />
        </FormField>
        <FormField id={fid("roleTitle")} label="Cargo" error={errors.roleTitle?.message}>
          <Input
            {...fieldA11y(fid("roleTitle"), errors.roleTitle?.message)}
            {...register("roleTitle")}
            placeholder="Ex.: Analista Judiciário - Tecnologia da Informação"
          />
        </FormField>
        <FormField id={fid("examBoard")} label="Banca" optional error={errors.examBoard?.message}>
          <Input
            {...fieldA11y(fid("examBoard"), errors.examBoard?.message)}
            {...register("examBoard")}
            placeholder="Ex.: Cebraspe, FGV, Fundep"
          />
        </FormField>
        <FormField id={fid("area")} label="Área" optional error={errors.area?.message}>
          <Input {...fieldA11y(fid("area"), errors.area?.message)} {...register("area")} placeholder="Ex.: TI, saúde, administrativa" />
        </FormField>
        <FormField id={fid("sphere")} label="Esfera" error={errors.sphere?.message}>
          <Controller
            control={control}
            name="sphere"
            render={({ field }) => (
              <SegmentedControl id={fid("sphere")} label="Esfera" value={field.value} options={SPHERES} onChange={field.onChange} />
            )}
          />
        </FormField>
        <FormField id={fid("education")} label="Escolaridade exigida" error={errors.education?.message}>
          <Controller
            control={control}
            name="education"
            render={({ field }) => (
              <OptionSelect
                id={fid("education")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={EDUCATION_LEVELS}
              />
            )}
          />
        </FormField>
        <FormField id={fid("salary")} label="Salário inicial" optional error={errors.salary?.message}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              {...fieldA11y(fid("salary"), errors.salary?.message)}
              {...register("salary", {
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
        <FormField id={fid("vacancies")} label="Vagas" optional error={errors.vacancies?.message}>
          <div className="flex items-center gap-4">
            <Input
              {...fieldA11y(fid("vacancies"), errors.vacancies?.message)}
              {...register("vacancies")}
              inputMode="numeric"
              placeholder="Ex.: 12"
              className="w-28 tabular-nums"
            />
            <Controller
              control={control}
              name="reserveList"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={field.value} onCheckedChange={(next) => field.onChange(next === true)} />
                  Cadastro reserva
                </label>
              )}
            />
          </div>
        </FormField>
        <FormField id={fid("city")} label="Cidade" optional error={errors.city?.message} hint="Onde fica a vaga. Vazio = vale para o país todo.">
          <Input {...fieldA11y(fid("city"), errors.city?.message)} {...register("city")} placeholder="Ex.: Belo Horizonte" />
        </FormField>
        <FormField id={fid("state")} label="Estado" optional error={errors.state?.message}>
          <Controller
            control={control}
            name="state"
            render={({ field }) => (
              <Select value={field.value || NO_STATE} onValueChange={(next) => field.onChange(next === NO_STATE ? "" : next)}>
                <SelectTrigger id={fid("state")} className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NO_STATE}>Não informado</SelectItem>
                  {STATES.map((state) => (
                    <SelectItem key={state.uf} value={state.uf}>
                      {state.name} ({state.uf})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField id={fid("noticeUrl")} label="Link do edital" optional error={errors.noticeUrl?.message}>
          <Input
            {...fieldA11y(fid("noticeUrl"), errors.noticeUrl?.message)}
            {...register("noticeUrl")}
            type="url"
            inputMode="url"
            placeholder="https://"
          />
        </FormField>
        <FormField
          id={fid("registrationUrl")}
          label="Link da inscrição"
          optional
          error={errors.registrationUrl?.message}
          hint="A página oficial da banca. O app nunca faz a inscrição por você."
        >
          <Input
            {...fieldA11y(fid("registrationUrl"), errors.registrationUrl?.message)}
            {...register("registrationUrl")}
            type="url"
            inputMode="url"
            placeholder="https://"
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
              <OptionSelect
                id={fid("stage")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={CONCURSO_STAGES.map((stage) => ({ value: stage.key, label: stage.label, dot: stage.dot }))}
              />
            )}
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
        <FormField id={fid("notes")} label="Observações" optional error={errors.notes?.message} className="sm:col-span-2">
          <Textarea
            {...fieldA11y(fid("notes"), errors.notes?.message)}
            {...register("notes")}
            rows={4}
            placeholder="Taxa de inscrição, local de prova, requisitos do cargo…"
          />
        </FormField>
      </fieldset>

      <fieldset className="space-y-3 border-t pt-6" disabled={pending}>
        <legend className="float-left mb-1 w-full text-sm font-semibold">Cronograma</legend>
        <p className="text-xs text-muted-foreground">
          Inscrições, isenção, boleto, prova, gabarito, recurso e resultado. Aparecem na linha do tempo e na contagem até a
          prova.
        </p>
        {dates.fields.length > 0 && (
          <ul className="space-y-2">
            {dates.fields.map((field, index) => {
              const rowErrors = errors.dates?.[index];
              return (
                <li key={field.id} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[11rem_9.5rem_6.5rem_1fr_auto] sm:items-start">
                  <Controller
                    control={control}
                    name={`dates.${index}.kind`}
                    render={({ field: kindField }) => (
                      <OptionSelect
                        value={kindField.value}
                        onChange={kindField.onChange}
                        options={DATE_KINDS}
                        ariaLabel={`Tipo da data ${index + 1}`}
                      />
                    )}
                  />
                  <div>
                    <Input
                      {...register(`dates.${index}.date`)}
                      type="date"
                      max="2100-12-31"
                      aria-label={`Data ${index + 1}`}
                      aria-invalid={rowErrors?.date ? true : undefined}
                    />
                    {rowErrors?.date && <p className="mt-1 text-xs font-medium text-destructive">{rowErrors.date.message}</p>}
                  </div>
                  <div>
                    <Input
                      {...register(`dates.${index}.time`)}
                      type="time"
                      aria-label={`Hora ${index + 1} (opcional)`}
                      aria-invalid={rowErrors?.time ? true : undefined}
                    />
                    {rowErrors?.time && <p className="mt-1 text-xs font-medium text-destructive">{rowErrors.time.message}</p>}
                  </div>
                  <Input
                    {...register(`dates.${index}.note`)}
                    placeholder="Observação (opcional)"
                    aria-label={`Observação da data ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => dates.remove(index)}
                    aria-label={`Remover a data ${index + 1}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dates.append({ kind: dates.fields.length === 0 ? "inscricao_inicio" : "prova", date: "", time: "", note: "" })}
        >
          <CalendarPlus /> Adicionar data
        </Button>
      </fieldset>

      <fieldset className="space-y-3 border-t pt-6" disabled={pending}>
        <legend className="float-left mb-1 w-full text-sm font-semibold">Matérias</legend>
        <p className="text-xs text-muted-foreground">
          O peso (ou o número de questões) define quanto cada matéria conta no progresso. O que já foi estudado continua
          marcado ao editar.
        </p>
        {subjects.fields.length > 0 && (
          <ul className="space-y-2">
            {subjects.fields.map((field, index) => {
              const rowErrors = errors.subjects?.[index];
              return (
                <li key={field.fieldKey} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-start">
                  <div className="col-span-2 sm:col-span-1">
                    <Input
                      {...register(`subjects.${index}.name`)}
                      placeholder="Ex.: Língua Portuguesa"
                      aria-label={`Matéria ${index + 1}`}
                      aria-invalid={rowErrors?.name ? true : undefined}
                    />
                    {rowErrors?.name && <p className="mt-1 text-xs font-medium text-destructive">{rowErrors.name.message}</p>}
                  </div>
                  <div>
                    <Input
                      {...register(`subjects.${index}.weight`)}
                      inputMode="decimal"
                      placeholder="Peso"
                      aria-label={`Peso da matéria ${index + 1}`}
                      aria-invalid={rowErrors?.weight ? true : undefined}
                    />
                    {rowErrors?.weight && <p className="mt-1 text-xs font-medium text-destructive">{rowErrors.weight.message}</p>}
                  </div>
                  <div>
                    <Input
                      {...register(`subjects.${index}.questions`)}
                      inputMode="numeric"
                      placeholder="Questões"
                      aria-label={`Questões da matéria ${index + 1}`}
                      aria-invalid={rowErrors?.questions ? true : undefined}
                    />
                    {rowErrors?.questions && (
                      <p className="mt-1 text-xs font-medium text-destructive">{rowErrors.questions.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => subjects.remove(index)}
                    aria-label={`Remover a matéria ${index + 1}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            subjects.append({ id: `nova-${Date.now()}`, name: "", weight: "", questions: "", status: "nao_estudado" })
          }
        >
          <Plus /> Adicionar matéria
        </Button>
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
          {mode === "create" ? "Criar concurso" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
