import { z } from "zod";
import { todayISO } from "@/lib/format";
import { parseMessage } from "./parser";

/** Formato que o script do Google envia. */
export const emailBatchSchema = z.object({
  emails: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        from: z.string().max(500).nullish(),
        subject: z.string().max(500).nullish(),
        date: z.string().max(60).nullish(),
        body: z.string().max(20_000).default(""),
      }),
    )
    .max(50),
});

export type EmailBatch = z.infer<typeof emailBatchSchema>;

/** Linha no formato da função inbox_ingest do banco. */
export type IngestRow = {
  external_id: string;
  sender: string | null;
  subject: string | null;
  received_at: string;
  snippet: string;
  kind: string;
  suggested_stage: string | null;
  confidence: string;
  company: string | null;
  role_title: string | null;
  platform: string | null;
  task_title: string | null;
  due_date: string | null;
};

/** Interpreta os e-mails e descarta os que não são sobre processos seletivos. */
export function buildIngestRows(batch: EmailBatch, now: Date = new Date()): IngestRow[] {
  const rows: IngestRow[] = [];
  for (const email of batch.emails) {
    const date = email.date ? new Date(email.date) : now;
    const receivedAt = Number.isNaN(date.getTime()) ? now : date;
    const parsed = parseMessage({
      from: email.from,
      subject: email.subject,
      body: email.body,
      receivedOn: todayISO(receivedAt),
    });
    if (!parsed.relevant) continue;
    rows.push({
      external_id: email.id,
      sender: email.from ?? null,
      subject: email.subject ?? null,
      received_at: receivedAt.toISOString(),
      snippet: parsed.snippet,
      kind: parsed.kind,
      suggested_stage: parsed.stage,
      confidence: parsed.confidence,
      company: parsed.company,
      role_title: parsed.roleTitle,
      platform: parsed.platform,
      task_title: parsed.taskTitle,
      due_date: parsed.dueDate,
    });
  }
  return rows;
}
