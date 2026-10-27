"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, FilterX, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CompanyAvatar } from "@/components/company-avatar";
import { JobTypeBadge } from "@/components/job-type-badge";
import { EmptyState } from "@/components/empty-state";
import { Kbd } from "@/components/kbd";
import { PriorityLabel } from "@/components/priority-indicator";
import { StageBadge } from "@/components/stage-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrencyCompact, formatDate, formatRelativeDay, timestampToISODate } from "@/lib/format";
import { JOB_TYPES, PLATFORMS, PRIORITIES, WORK_MODELS, platformLabel, workModelLabel } from "@/lib/options";
import { STAGES } from "@/lib/stages";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FILTERS,
  filterAndSortApplications,
  hasActiveFilters,
  parseListFilters,
  serializeListFilters,
  type ListFilters,
  type SortKey,
} from "../list-filters";
import type { ApplicationSummary } from "../types";

const ALL = "todas";

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  allLabel: string;
  options: readonly { value: string; label: string; dot?: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? null : next)}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className={cn("w-full min-w-0 sm:w-auto sm:min-w-36", value && "border-primary/40 bg-primary/5")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
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

function SortableHead({
  label,
  sortKey,
  filters,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  filters: ListFilters;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = filters.sort === sortKey;
  const Icon = !active ? ArrowUpDown : filters.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (filters.direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "-ml-2 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-accent",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

export function ApplicationsTable({ applications, today }: { applications: ApplicationSummary[]; today: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlFilters = useMemo(() => parseListFilters(new URLSearchParams(searchParams.toString())), [searchParams]);

  // O texto da busca vem da URL ao abrir a página e depois fica num estado
  // local: a URL atualiza um instante depois, e usá-la direto no campo faria
  // letras sumirem ao digitar rápido.
  const [query, setQuery] = useState(urlFilters.q);

  const filters = useMemo(() => ({ ...urlFilters, q: query }), [urlFilters, query]);
  const rows = useMemo(() => filterAndSortApplications(applications, filters), [applications, filters]);

  /**
   * Atualiza a URL sem ir ao servidor (os dados já estão no navegador).
   * O Next.js sincroniza o useSearchParams com o history.replaceState.
   */
  function update(patch: Partial<ListFilters>) {
    const next = { ...filters, ...patch };
    if (patch.q !== undefined) setQuery(patch.q);
    const search = serializeListFilters(next);
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }

  function toggleSort(key: SortKey) {
    if (filters.sort === key) update({ direction: filters.direction === "asc" ? "desc" : "asc" });
    else update({ sort: key, direction: key === "empresa" || key === "etapa" || key === "prioridade" ? "asc" : "desc" });
  }

  const filtering = hasActiveFilters(filters);

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
            placeholder="Buscar empresa, cargo, local…"
            aria-label="Buscar candidaturas"
            className="h-8 pr-8 pl-8"
          />
          <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            label="Filtrar por etapa"
            value={filters.stage}
            allLabel="Todas as etapas"
            options={STAGES.map((stage) => ({ value: stage.key, label: stage.label, dot: stage.dot }))}
            onChange={(value) => update({ stage: value as ListFilters["stage"] })}
          />
          <FilterSelect
            label="Filtrar por tipo de vaga"
            value={filters.jobType}
            allLabel="Todos os tipos"
            options={JOB_TYPES}
            onChange={(value) => update({ jobType: value as ListFilters["jobType"] })}
          />
          <FilterSelect
            label="Filtrar por plataforma"
            value={filters.platform}
            allLabel="Todas as plataformas"
            options={PLATFORMS}
            onChange={(value) => update({ platform: value as ListFilters["platform"] })}
          />
          <FilterSelect
            label="Filtrar por modelo"
            value={filters.workModel}
            allLabel="Todos os modelos"
            options={WORK_MODELS}
            onChange={(value) => update({ workModel: value as ListFilters["workModel"] })}
          />
          <FilterSelect
            label="Filtrar por prioridade"
            value={filters.priority}
            allLabel="Todas as prioridades"
            options={PRIORITIES}
            onChange={(value) => update({ priority: value as ListFilters["priority"] })}
          />
          {filtering && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ ...DEFAULT_FILTERS, sort: filters.sort, direction: filters.direction })}
              className="col-span-2 sm:col-span-1"
            >
              <FilterX /> Limpar filtros
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground lg:ml-auto" aria-live="polite">
          {filtering ? `${rows.length} de ${applications.length}` : applications.length}{" "}
          {applications.length === 1 ? "candidatura" : "candidaturas"}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nada encontrado com esses filtros"
          description="Tente outra palavra na busca ou remova algum filtro."
          compact
        >
          <Button variant="outline" size="sm" onClick={() => update({ ...DEFAULT_FILTERS })}>
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
                  <SortableHead label="Empresa e cargo" sortKey="empresa" filters={filters} onSort={toggleSort} className="pl-4" />
                  <SortableHead label="Etapa" sortKey="etapa" filters={filters} onSort={toggleSort} />
                  <TableHead className="text-xs">Tipo</TableHead>
                  <SortableHead label="Prioridade" sortKey="prioridade" filters={filters} onSort={toggleSort} />
                  <TableHead className="hidden text-xs lg:table-cell">Plataforma</TableHead>
                  <TableHead className="hidden text-xs xl:table-cell">Modelo</TableHead>
                  <SortableHead label="Remuneração" sortKey="remuneracao" filters={filters} onSort={toggleSort} className="text-right" />
                  <SortableHead label="Candidatura" sortKey="candidatura" filters={filters} onSort={toggleSort} />
                  <SortableHead label="Atualizada" sortKey="atualizada" filters={filters} onSort={toggleSort} className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((application) => (
                  <TableRow
                    key={application.id}
                    className="cursor-pointer"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a")) return;
                      router.push(`/candidaturas/${application.id}`);
                    }}
                  >
                    <TableCell className="max-w-72 pl-4">
                      <Link
                        href={`/candidaturas/${application.id}`}
                        className="flex items-center gap-2.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <CompanyAvatar name={application.company} className="size-7" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{application.company}</span>
                          <span className="block truncate text-xs text-muted-foreground">{application.role_title}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StageBadge stage={application.stage} short />
                    </TableCell>
                    <TableCell>
                      <JobTypeBadge jobType={application.job_type} />
                    </TableCell>
                    <TableCell>
                      <PriorityLabel priority={application.priority} className="text-xs" />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {platformLabel(application.platform)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                      {workModelLabel(application.work_model)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatCurrencyCompact(application.salary_cents)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {formatDate(application.applied_at)}
                    </TableCell>
                    <TableCell className="pr-4 text-xs text-muted-foreground">
                      {formatRelativeDay(timestampToISODate(application.updated_at), today)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Lista compacta (celular) */}
          <ul className="divide-y overflow-hidden rounded-xl border md:hidden">
            {rows.map((application) => (
              <li key={application.id}>
                <Link
                  href={`/candidaturas/${application.id}`}
                  className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/50"
                >
                  <CompanyAvatar name={application.company} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{application.company}</span>
                    <span className="block truncate text-xs text-muted-foreground">{application.role_title}</span>
                  </span>
                  <StageBadge stage={application.stage} short />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
