"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Campo de etiquetas: digite e aperte Enter (ou vírgula) para adicionar.
 * Colar "SQL, Python, Excel" adiciona as três. Backspace no campo vazio
 * remove a última.
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
  max,
  transform,
  invalidMessage = "Valor não reconhecido.",
  splitOnComma = true,
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  /** Ajusta o texto antes de adicionar; devolva null para recusar. */
  transform?: (text: string) => string | null;
  invalidMessage?: string;
  splitOnComma?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = useState("");
  const [rejected, setRejected] = useState<string | null>(null);
  const full = max !== undefined && value.length >= max;

  function add(raw: string) {
    const parts = (splitOnComma ? raw.split(/[,;\n]/) : raw.split(/\n/)).map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    let refused: string | null = null;
    for (const part of parts) {
      if (max !== undefined && next.length >= max) break;
      const item = transform ? transform(part) : part;
      if (item === null) {
        refused = part;
        continue;
      }
      if (!next.some((existing) => existing.toLowerCase() === item.toLowerCase())) next.push(item);
    }
    setRejected(refused);
    // O que foi recusado fica no campo, para a pessoa corrigir.
    setDraft(refused ?? "");
    if (next.length !== value.length) onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, position) => position !== index));
  }

  return (
    <div className="grid gap-1.5">
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          ariaInvalid && "border-destructive ring-destructive/20",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {value.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-secondary py-0.5 pr-1 pl-2 text-xs font-medium text-secondary-foreground"
          >
            <span className="truncate">{item}</span>
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={`Remover ${item}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled || full}
          onChange={(event) => {
            const text = event.target.value;
            if (splitOnComma && /[,;]/.test(text)) add(text);
            else {
              setDraft(text);
              if (rejected) setRejected(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(draft);
            } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value.length - 1);
            }
          }}
          onBlur={() => add(draft)}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (/[,;\n]/.test(text)) {
              event.preventDefault();
              add(text);
            }
          }}
          placeholder={full ? `Limite de ${max}` : value.length === 0 ? placeholder : "Adicionar…"}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className="h-6 min-w-32 flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>
      {rejected && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {invalidMessage} ({rejected})
        </p>
      )}
    </div>
  );
}
