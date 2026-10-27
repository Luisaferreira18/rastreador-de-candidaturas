"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormField, fieldA11y } from "@/components/form-field";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { centsToInput, parseBRLToCents } from "@/lib/format";
import { JOB_TYPES, WORK_MODELS } from "@/lib/options";
import { cn } from "@/lib/utils";
import { saveJobProfile } from "../actions";
import { COMPANY_BOARDS, boardKey, parseBoardInput } from "../boards";
import { STATES } from "../brazil";
import { MAX_ROLES, jobProfileFormSchema, type JobProfileFormValues } from "../profile";
import { announceSearch, requestSearch } from "../search-client";

const ANY_STATE = "todos";

function CheckboxPills<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  options: readonly { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
  invalid?: boolean;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <label
            key={option.value}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors select-none hover:bg-accent",
              checked && "border-primary/40 bg-primary/5 hover:bg-primary/10",
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(next) =>
                onChange(next ? [...value, option.value] : value.filter((item) => item !== option.value))
              }
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

function CheckboxRow({
  id,
  checked,
  onChange,
  title,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} className="mt-0.5" />
      <div className="grid gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {title}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function JobProfileForm({ defaultValues, isNew }: { defaultValues: JobProfileFormValues; isNew: boolean }) {
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
    formState: { errors },
  } = useForm<JobProfileFormValues>({
    resolver: zodResolver(jobProfileFormSchema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveJobProfile(values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof JobProfileFormValues, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(isNew ? "Perfil criado. Buscando vagas…" : "Perfil salvo. Buscando vagas com o perfil novo…");
      router.push("/vagas");
      // A busca continua depois da navegação; a página mostra o andamento.
      void requestSearch(true).then((search) => {
        announceSearch(search, { onOpen: () => router.push("/vagas") });
        router.refresh();
      });
    });
  });

  const arrayError = (error: unknown): string | undefined => {
    if (!error) return undefined;
    if (Array.isArray(error)) return error.find((item) => item?.message)?.message;
    return (error as { message?: string }).message;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="float-left w-full text-sm font-semibold sm:col-span-2">O que você procura</legend>
        <FormField
          id={fid("roles")}
          label="Cargos"
          error={arrayError(errors.roles)}
          hint={`Até ${MAX_ROLES}. Aperte Enter depois de cada um. Sem nível no nome, a busca foca em vagas de entrada (inclua "Pleno" ou "Sênior" se for o caso).`}
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="roles"
            render={({ field }) => (
              <TagInput
                {...fieldA11y(fid("roles"), arrayError(errors.roles))}
                value={field.value}
                onChange={field.onChange}
                max={MAX_ROLES}
                placeholder="Ex.: Estágio em Dados, Analista de BI"
              />
            )}
          />
        </FormField>

        <FormField id={fid("jobTypes")} label="Tipos de vaga" error={errors.jobTypes?.message} className="sm:col-span-2">
          <Controller
            control={control}
            name="jobTypes"
            render={({ field }) => (
              <CheckboxPills
                id={fid("jobTypes")}
                label="Tipos de vaga"
                options={JOB_TYPES}
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.jobTypes)}
              />
            )}
          />
        </FormField>

        <FormField
          id={fid("workModels")}
          label="Modelos de trabalho"
          error={errors.workModels?.message}
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="workModels"
            render={({ field }) => (
              <CheckboxPills
                id={fid("workModels")}
                label="Modelos de trabalho"
                options={WORK_MODELS}
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.workModels)}
              />
            )}
          />
        </FormField>

        <FormField
          id={fid("city")}
          label="Cidade"
          optional
          error={errors.city?.message}
          hint="Para vagas presenciais e híbridas. Remotas valem de qualquer lugar."
        >
          <Input
            {...fieldA11y(fid("city"), errors.city?.message)}
            {...register("city")}
            placeholder="Ex.: São Paulo"
            autoComplete="address-level2"
          />
        </FormField>
        <FormField id={fid("state")} label="Estado" optional error={errors.state?.message}>
          <Controller
            control={control}
            name="state"
            render={({ field }) => (
              <Select
                value={field.value || ANY_STATE}
                onValueChange={(next) => field.onChange(next === ANY_STATE ? "" : next)}
              >
                <SelectTrigger id={fid("state")} className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ANY_STATE}>Qualquer estado</SelectItem>
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

        <FormField
          id={fid("minSalary")}
          label="Remuneração mínima"
          optional
          error={errors.minSalary?.message}
          hint="Quando a vaga informa um valor menor, ela aparece com um aviso."
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              {...fieldA11y(fid("minSalary"), errors.minSalary?.message)}
              {...register("minSalary", {
                onBlur: (event) => {
                  const cents = parseBRLToCents(event.target.value);
                  if (cents !== null) setValue("minSalary", centsToInput(cents), { shouldValidate: true });
                },
              })}
              inputMode="decimal"
              placeholder="0,00"
              className="pl-9 tabular-nums"
            />
          </div>
        </FormField>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-6" disabled={pending}>
        <legend className="float-left w-full text-sm font-semibold">Seu currículo</legend>
        <FormField
          id={fid("keywords")}
          label="Palavras-chave"
          optional
          error={arrayError(errors.keywords)}
          hint="Habilidades e ferramentas do seu currículo. Vagas que citam mais delas sobem na lista."
        >
          <Controller
            control={control}
            name="keywords"
            render={({ field }) => (
              <TagInput
                {...fieldA11y(fid("keywords"), arrayError(errors.keywords))}
                value={field.value}
                onChange={field.onChange}
                max={30}
                placeholder="Ex.: SQL, Python, Power BI, Excel, inglês"
              />
            )}
          />
        </FormField>
        <FormField
          id={fid("excludedWords")}
          label="Palavras para evitar"
          optional
          error={arrayError(errors.excludedWords)}
          hint="Vagas com essas palavras no título não aparecem."
        >
          <Controller
            control={control}
            name="excludedWords"
            render={({ field }) => (
              <TagInput
                {...fieldA11y(fid("excludedWords"), arrayError(errors.excludedWords))}
                value={field.value}
                onChange={field.onChange}
                max={30}
                placeholder="Ex.: vendas, telemarketing"
              />
            )}
          />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-6" disabled={pending}>
        <legend className="float-left w-full text-sm font-semibold">Onde buscar</legend>
        <div className="grid gap-4">
          <Controller
            control={control}
            name="useGupy"
            render={({ field }) => (
              <CheckboxRow
                id={fid("useGupy")}
                checked={field.value}
                onChange={field.onChange}
                title="Gupy"
                description="Busca pública do portal de vagas da Gupy, sem login."
              />
            )}
          />
          <Controller
            control={control}
            name="useCompanyBoards"
            render={({ field }) => (
              <CheckboxRow
                id={fid("useCompanyBoards")}
                checked={field.value}
                onChange={field.onChange}
                title={`Páginas de carreira de ${COMPANY_BOARDS.length} empresas`}
                description={`Greenhouse e Lever: ${COMPANY_BOARDS.map((board) => board.company).join(", ")}.`}
              />
            )}
          />
          {errors.useGupy?.message && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {errors.useGupy.message}
            </p>
          )}
        </div>

        <FormField
          id={fid("extraBoards")}
          label="Outras empresas"
          optional
          error={arrayError(errors.extraBoards)}
          hint="Cole o link da página de vagas de empresas que usam Greenhouse ou Lever (boards.greenhouse.io/... ou jobs.lever.co/...)."
        >
          <Controller
            control={control}
            name="extraBoards"
            render={({ field }) => (
              <TagInput
                {...fieldA11y(fid("extraBoards"), arrayError(errors.extraBoards))}
                value={field.value}
                onChange={field.onChange}
                max={20}
                splitOnComma={false}
                transform={(text) => {
                  const board = parseBoardInput(text);
                  return board ? boardKey(board) : null;
                }}
                invalidMessage="Esse link não é de uma página de vagas do Greenhouse ou do Lever."
                placeholder="https://jobs.lever.co/empresa"
              />
            )}
          />
        </FormField>

        <Controller
          control={control}
          name="autoSearch"
          render={({ field }) => (
            <CheckboxRow
              id={fid("autoSearch")}
              checked={field.value}
              onChange={field.onChange}
              title="Buscar todo dia automaticamente"
              description="As vagas novas aparecem no app e no resumo diário por e-mail."
            />
          )}
        />
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {isNew ? "Criar perfil e buscar vagas" : "Salvar e buscar de novo"}
        </Button>
      </div>
    </form>
  );
}
