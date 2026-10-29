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
import { isUF } from "@/features/job-search/brazil";
import { EDUCATION_LEVELS, SPHERES, type Sphere } from "@/lib/concurso-options";
import { centsToInput, parseBRLToCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveConcursoProfile } from "../search/actions";
import { concursoProfileFormSchema, normalizePlace, type ConcursoProfileFormValues } from "../search/profile";

const arrayError = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (Array.isArray(error)) return error.find((item) => item?.message)?.message;
  return (error as { message?: string }).message;
};

function CheckRow({ id, checked, onChange, title, description }: { id: string; checked: boolean; onChange: (value: boolean) => void; title: string; description: string }) {
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

export function ConcursoProfileForm({ defaultValues, isNew }: { defaultValues: ConcursoProfileFormValues; isNew: boolean }) {
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
  } = useForm<ConcursoProfileFormValues>({
    resolver: zodResolver(concursoProfileFormSchema),
    defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveConcursoProfile(values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof ConcursoProfileFormValues, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(isNew ? "Perfil criado. Buscando concursos…" : "Perfil salvo. Buscando com o perfil novo…");
      router.push("/concursos/sugeridos");
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="float-left w-full text-sm font-semibold sm:col-span-2">O que você procura</legend>
        <FormField id={fid("education")} label="Sua escolaridade" error={errors.education?.message} hint="Concursos que exigem mais do que isso ficam de fora.">
          <Controller
            control={control}
            name="education"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={fid("education")} className="w-full" onBlur={field.onBlur}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          id={fid("minSalary")}
          label="Salário mínimo"
          optional
          error={errors.minSalary?.message}
          hint="Abaixo disso, o concurso aparece com um aviso."
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
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
        <FormField
          id={fid("areas")}
          label="Áreas"
          optional
          error={arrayError(errors.areas)}
          hint="Ex.: TI, dados, administrativa, jurídica, saúde, educação. Aperte Enter depois de cada uma."
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="areas"
            render={({ field }) => (
              <TagInput {...fieldA11y(fid("areas"), arrayError(errors.areas))} value={field.value} onChange={field.onChange} max={10} placeholder="Ex.: TI, dados" />
            )}
          />
        </FormField>
        <FormField
          id={fid("roles")}
          label="Cargos"
          optional
          error={arrayError(errors.roles)}
          hint="Palavras do nome do cargo, como Analista, Técnico, Auditor ou Professor."
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="roles"
            render={({ field }) => (
              <TagInput {...fieldA11y(fid("roles"), arrayError(errors.roles))} value={field.value} onChange={field.onChange} max={10} placeholder="Ex.: Analista, Técnico" />
            )}
          />
        </FormField>
        <FormField id={fid("spheres")} label="Esferas" error={errors.spheres?.message} className="sm:col-span-2">
          <Controller
            control={control}
            name="spheres"
            render={({ field }) => (
              <div id={fid("spheres")} role="group" aria-label="Esferas" className="flex flex-wrap gap-2">
                {SPHERES.map((sphere) => {
                  const checked = field.value.includes(sphere.value);
                  return (
                    <label
                      key={sphere.value}
                      className={cn(
                        "flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors select-none hover:bg-accent",
                        checked && "border-primary/40 bg-primary/5 hover:bg-primary/10",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          field.onChange(next ? [...field.value, sphere.value] : field.value.filter((item: Sphere) => item !== sphere.value))
                        }
                      />
                      {sphere.label}
                    </label>
                  );
                })}
              </div>
            )}
          />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-6 sm:grid-cols-2" disabled={pending}>
        <legend className="float-left w-full text-sm font-semibold sm:col-span-2">Onde</legend>
        <FormField
          id={fid("cities")}
          label="Cidades"
          optional
          error={arrayError(errors.cities)}
          hint="No formato Cidade/UF. Os diários oficiais delas entram na busca (quando o Querido Diário cobre a cidade)."
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="cities"
            render={({ field }) => (
              <TagInput
                {...fieldA11y(fid("cities"), arrayError(errors.cities))}
                value={field.value}
                onChange={field.onChange}
                max={10}
                splitOnComma={false}
                transform={(text) => normalizePlace(text)}
                invalidMessage="Use o formato Cidade/UF, como Belo Horizonte/MG."
                placeholder="Ex.: Belo Horizonte/MG"
              />
            )}
          />
        </FormField>
        <FormField
          id={fid("states")}
          label="Estados"
          optional
          error={arrayError(errors.states)}
          hint="Para concursos estaduais e de qualquer cidade do estado. Use a sigla (MG, SP...)."
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="states"
            render={({ field }) => (
              <TagInput
                {...fieldA11y(fid("states"), arrayError(errors.states))}
                value={field.value}
                onChange={field.onChange}
                max={27}
                transform={(text) => (isUF(text.trim().toUpperCase()) ? text.trim().toUpperCase() : null)}
                invalidMessage="Use a sigla do estado, como MG."
                placeholder="Ex.: MG, SP"
              />
            )}
          />
        </FormField>
        <Controller
          control={control}
          name="acceptsRelocation"
          render={({ field }) => (
            <div className="sm:col-span-2">
              <CheckRow
                id={fid("acceptsRelocation")}
                checked={field.value}
                onChange={field.onChange}
                title="Aceito mudar de cidade"
                description="Concursos de outras cidades e estados também aparecem, com nota menor."
              />
            </div>
          )}
        />
      </fieldset>

      <fieldset className="grid gap-5 border-t pt-6" disabled={pending}>
        <legend className="float-left w-full text-sm font-semibold">Preferências</legend>
        <FormField id={fid("examBoards")} label="Bancas preferidas" optional error={arrayError(errors.examBoards)} hint="Concursos dessas bancas ganham pontos.">
          <Controller
            control={control}
            name="examBoards"
            render={({ field }) => (
              <TagInput {...fieldA11y(fid("examBoards"), arrayError(errors.examBoards))} value={field.value} onChange={field.onChange} max={10} placeholder="Ex.: Cebraspe, FGV" />
            )}
          />
        </FormField>
        <Controller
          control={control}
          name="autoSearch"
          render={({ field }) => (
            <CheckRow
              id={fid("autoSearch")}
              checked={field.value}
              onChange={field.onChange}
              title="Buscar todo dia automaticamente"
              description="Os concursos novos aparecem em Sugeridos e no resumo diário."
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
          {isNew ? "Criar perfil e buscar" : "Salvar e buscar de novo"}
        </Button>
      </div>
    </form>
  );
}
