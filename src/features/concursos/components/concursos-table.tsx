"use client";

import { FilterX, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CompanyAvatar } from "@/components/company-avatar";
import { EmptyState } from "@/components/empty-state";
import { Kbd } from "@/components/kbd";
import { FilterSelect, SortableHead } from "@/components/list-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EDUCATION_LEVELS, SPHERES, educationLabel } from "@/lib/concurso-options";
import { CONCURSO_STAGES } from "@/lib/concurso-stages";
import { formatCurrencyCompact, formatDate, formatRelativeDay, timestampToISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CONCURSO_FILTERS,
  filterAndSortConcursos,
  filterOptions,
  hasActiveConcursoFilters,
  parseConcursoFilters,
  placeKey,
  serializeConcursoFilters,
  type ConcursoFilters,
  type ConcursoSortKey,
} from "../list-filters";
import { examCountdown, registrationStatus } from "../schedule";
import type { ConcursoSummary } from "../types";
import { ConcursoStageBadge, SphereBadge } from "./concurso-badges";

function ExamCell({ concurso, today }: { concurso: ConcursoSummary; today: string }) {
  const exam = examCountdown(concurso.dates, today);
  if (!exam) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn(exam.status === "futura" && exam.days <= 7 && "font-medium text-amber-700 dark:text-amber-400")}>
      {formatDate(exam.date)}
      <span className="block text-[11px] text-muted-foreground">{formatRelativeDay(exam.date, today)}</span>
    </span>
  );
}

function RegistrationCell({ concurso, today }: { concurso: ConcursoSummary; today: string }) {
  const status = registrationStatus(concurso.dates, today);
  if (status.status === "sem-data") return <span className="text-muted-foreground">—</span>;
  if (status.status === "encerradas") return <span className="text-muted-foreground">Encerradas</span>;
  if (status.status === "em-breve") return <span>Abrem {formatRelativeDay(status.start, today)}</span>;
  if (!status.end) return <span>Abertas</span>;
  return (
    <span className={cn(status.closesIn !== null && status.closesIn <= 7 && "font-medium text-amber-700 dark:text-amber-400")}>
      Até {formatDate(status.end)}
      <span className="block text-[11px] text-muted-foreground">{formatRelativeDay(status.end, today)}</span>
    </span>
  );
}

export function ConcursosTable({ concursos, today }: { concursos: ConcursoSummary[]; today: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFilters = useMemo(() => parseConcursoFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  // A busca fica num estado local para as letras não sumirem ao digitar rápido.
  const [query, setQuery] = useState(urlFilters.q);

  const filters = useMemo(() => ({ ...urlFilters, q: query }), [urlFilters, query]);
  const rows = useMemo(() => filterAndSortConcursos(concursos, filters, today), [concursos, filters, today]);
  const options = useMemo(() => filterOptions(concursos), [concursos]);

  /** Atualiza a URL sem ir ao servidor (os dados já estão no navegador). */
  function update(patch: Partial<ConcursoFilters>) {
    const next = { ...filters, ...patch };
    if (patch.q !== undefined) setQuery(patch.q);
    const search = serializeConcursoFilters(next);
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }

  function toggleSort(key: ConcursoSortKey) {
    if (filters.sort === key) update({ direction: filters.direction === "asc" ? "desc" : "asc" });
    else update({ sort: key, direction: ["orgao", "etapa", "prova", "inscricao", "prioridade"].includes(key) ? "asc" : "desc" });
  }

  const head = (label: string, key: ConcursoSortKey, className?: string) => (
    <SortableHead
      label={label}
      active={filters.sort === key}
      direction={filters.direction}
      onSort={() => toggleSort(key)}
      className={className}
    />
  );

  const filtering = hasActiveConcursoFilters(filters);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:max-w-xs lg:min-w-60 lg:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-search-input
            type="search"
            value={filters.q}
            onChange={(event) => update({ q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape") (event.target as HTMLInputElement).blur();
            }}
            placeholder="Buscar órgão, cargo, banca…"
            aria-label="Buscar concursos"
            className="h-8 pr-8 pl-8"
          />
          <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            label="Filtrar por etapa"
            value={filters.stage}
            allLabel="Todas as etapas"
            options={CONCURSO_STAGES.map((stage) => ({ value: stage.key, label: stage.label, dot: stage.dot }))}
            onChange={(value) => update({ stage: value as ConcursoFilters["stage"] })}
          />
          <FilterSelect
            label="Filtrar por esfera"
            value={filters.sphere}
            allLabel="Todas as esferas"
            options={SPHERES}
            onChange={(value) => update({ sphere: value as ConcursoFilters["sphere"] })}
          />
          {options.examBoards.length > 0 && (
            <FilterSelect
              label="Filtrar por banca"
              value={filters.examBoard}
              allLabel="Todas as bancas"
              options={options.examBoards.map((board) => ({ value: board, label: board }))}
              onChange={(value) => update({ examBoard: value })}
            />
          )}
          <FilterSelect
            label="Filtrar por escolaridade"
            value={filters.education}
            allLabel="Todas as escolaridades"
            options={EDUCATION_LEVELS.map((level) => ({ value: level.value, label: level.short }))}
            onChange={(value) => update({ education: value as ConcursoFilters["education"] })}
          />
          {options.places.length > 0 && (
            <FilterSelect
              label="Filtrar por cidade ou estado"
              value={filters.place}
              allLabel="Todos os locais"
              options={options.places.map((place) => ({ value: place, label: place }))}
              onChange={(value) => update({ place: value })}
            />
          )}
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ ...DEFAULT_CONCURSO_FILTERS, sort: filters.sort, direction: filters.direction })}
              className="col-span-2 sm:col-span-1"
            >
              <FilterX /> Limpar filtros
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground lg:ml-auto" aria-live="polite">
          {filtering ? `${rows.length} de ${concursos.length}` : concursos.length}{" "}
          {concursos.length === 1 ? "concurso" : "concursos"}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nada encontrado com esses filtros"
          description="Tente outra palavra na busca ou remova algum filtro."
          compact
        >
          <Button variant="outline" size="sm" onClick={() => update({ ...DEFAULT_CONCURSO_FILTERS })}>
            <FilterX /> Limpar filtros
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Tabela (telas médias e grandes) */}
          <div className="hidden overflow-hidden rounded-xl border md:block">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  {head("Órgão e cargo", "orgao", "pl-4")}
                  {head("Etapa", "etapa")}
                  <TableHead className="text-xs">Banca</TableHead>
                  <TableHead className="hidden text-xs lg:table-cell">Esfera</TableHead>
                  <TableHead className="hidden text-xs xl:table-cell">Escolaridade</TableHead>
                  {head("Salário", "salario", "text-right")}
                  {head("Inscrições", "inscricao")}
                  {head("Prova", "prova")}
                  {head("Atualizado", "atualizado", "hidden pr-4 xl:table-cell")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((concurso) => (
                  <TableRow
                    key={concurso.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a")) return;
                      router.push(`/concursos/${concurso.id}`);
                    }}
                  >
                    <TableCell className="max-w-72 pl-4">
                      <Link
                        href={`/concursos/${concurso.id}`}
                        className="flex items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <CompanyAvatar name={concurso.organ} className="size-7" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{concurso.organ}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {concurso.role_title}
                            {placeKey(concurso) && ` · ${placeKey(concurso)}`}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ConcursoStageBadge stage={concurso.stage} short />
                    </TableCell>
                    <TableCell className="text-xs">{concurso.exam_board ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <SphereBadge sphere={concurso.sphere} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {educationLabel(concurso.education, true)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatCurrencyCompact(concurso.salary_cents)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <RegistrationCell concurso={concurso} today={today} />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <ExamCell concurso={concurso} today={today} />
                    </TableCell>
                    <TableCell className="hidden pr-4 text-xs text-muted-foreground xl:table-cell">
                      {formatRelativeDay(timestampToISODate(concurso.updated_at), today)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Lista compacta (celular) */}
          <ul className="divide-y overflow-hidden rounded-xl border md:hidden">
            {rows.map((concurso) => {
              const exam = examCountdown(concurso.dates, today);
              return (
                <li key={concurso.id}>
                  <Link
                    href={`/concursos/${concurso.id}`}
                    className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50"
                  >
                    <CompanyAvatar name={concurso.organ} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{concurso.organ}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {concurso.role_title}
                        {exam && exam.status !== "passou" && ` · prova ${formatRelativeDay(exam.date, today)}`}
                      </span>
                    </span>
                    <ConcursoStageBadge stage={concurso.stage} short />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
