/**
 * Tipos do banco no formato gerado por `supabase gen types typescript`,
 * com as colunas que têm restrição CHECK refinadas para uniões de texto.
 * Se mudar o esquema, gere de novo com `npm run db:types` e reaplique os refinamentos.
 */

import type { StageKey } from "@/lib/stages";
import type { InboxConfidence, InboxKind, InboxSource, InboxStatus } from "@/features/inbox/types";
import type { JobSource, LeadStatus } from "@/features/job-search/types";
import type { ConcursoStageKey } from "@/lib/concurso-stages";
import type { DateKind, EducationLevel, Sphere, SubjectStatus } from "@/lib/concurso-options";
import type { JobType, Platform, Priority, WorkModel } from "@/lib/options";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ConcursoRow = {
  id: string;
  user_id: string;
  organ: string;
  role_title: string;
  exam_board: string | null;
  sphere: Sphere;
  education: EducationLevel;
  area: string | null;
  salary_cents: number | null;
  vacancies: number | null;
  reserve_list: boolean;
  city: string | null;
  state: string | null;
  notice_url: string | null;
  registration_url: string | null;
  notes: string | null;
  priority: Priority;
  stage: ConcursoStageKey;
  position: number;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
};

type ConcursoStageHistoryRow = {
  id: string;
  concurso_id: string;
  user_id: string;
  from_stage: ConcursoStageKey | null;
  to_stage: ConcursoStageKey;
  changed_at: string;
};

type ConcursoDateRow = {
  id: string;
  concurso_id: string;
  user_id: string;
  kind: DateKind;
  date: string;
  time: string | null;
  note: string | null;
  created_at: string;
};

type ConcursoSubjectRow = {
  id: string;
  concurso_id: string;
  user_id: string;
  name: string;
  weight: number | null;
  questions: number | null;
  status: SubjectStatus;
  position: number;
  created_at: string;
};

type JobProfileRow = {
  user_id: string;
  roles: string[];
  keywords: string[];
  excluded_words: string[];
  city: string | null;
  state: string | null;
  work_models: WorkModel[];
  job_types: JobType[];
  min_salary_cents: number | null;
  use_gupy: boolean;
  use_company_boards: boolean;
  extra_boards: string[];
  auto_search: boolean;
  last_run_at: string | null;
  last_run_stats: Json | null;
  created_at: string;
  updated_at: string;
};

type ResumeRow = {
  user_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  skills: string[];
  /** [{ name: "Inglês", level: "avancado" }] */
  languages: Json;
  course: string | null;
  education_status: "cursando" | "concluido" | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  suggested_roles: string[];
  suggested_job_types: JobType[];
  uploaded_at: string;
};

type JobLeadRow = {
  id: string;
  user_id: string;
  source: JobSource;
  external_id: string;
  company: string;
  title: string;
  url: string;
  location: string | null;
  work_model: WorkModel | null;
  job_type: JobType | null;
  salary_cents: number | null;
  benefits: string[];
  workload: string | null;
  published_at: string | null;
  deadline: string | null;
  score: number;
  reasons: string[];
  warnings: string[];
  status: LeadStatus;
  application_id: string | null;
  found_at: string;
  resolved_at: string | null;
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      applications: {
        Row: {
          id: string;
          user_id: string;
          company: string;
          role_title: string;
          job_type: JobType;
          job_url: string | null;
          platform: Platform;
          location: string | null;
          work_model: WorkModel;
          salary_cents: number | null;
          applied_at: string | null;
          stage: StageKey;
          priority: Priority;
          notes: string | null;
          position: number;
          stage_changed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          company: string;
          role_title: string;
          job_type?: JobType;
          job_url?: string | null;
          platform?: Platform;
          location?: string | null;
          work_model?: WorkModel;
          salary_cents?: number | null;
          applied_at?: string | null;
          stage?: StageKey;
          priority?: Priority;
          notes?: string | null;
          position?: number;
          stage_changed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company?: string;
          role_title?: string;
          job_type?: JobType;
          job_url?: string | null;
          platform?: Platform;
          location?: string | null;
          work_model?: WorkModel;
          salary_cents?: number | null;
          applied_at?: string | null;
          stage?: StageKey;
          priority?: Priority;
          notes?: string | null;
          position?: number;
          stage_changed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stage_history: {
        Row: {
          id: string;
          application_id: string;
          user_id: string;
          from_stage: StageKey | null;
          to_stage: StageKey;
          changed_at: string;
        };
        Insert: {
          id?: string;
          application_id: string;
          user_id?: string;
          from_stage?: StageKey | null;
          to_stage: StageKey;
          changed_at?: string;
        };
        Update: {
          id?: string;
          application_id?: string;
          user_id?: string;
          from_stage?: StageKey | null;
          to_stage?: StageKey;
          changed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stage_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          id: string;
          /** Uma das duas é preenchida (CHECK no banco). */
          application_id: string | null;
          concurso_id: string | null;
          user_id: string;
          title: string;
          due_date: string | null;
          done: boolean;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_id?: string | null;
          concurso_id?: string | null;
          user_id?: string;
          title: string;
          due_date?: string | null;
          done?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          application_id?: string | null;
          concurso_id?: string | null;
          user_id?: string;
          title?: string;
          due_date?: string | null;
          done?: boolean;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          user_id: string;
          inbox_token_hash: string | null;
          inbox_token_created_at: string | null;
          auto_apply: boolean;
          updated_at: string;
          whatsapp_wa_id: string | null;
          whatsapp_linked_at: string | null;
          whatsapp_link_code_hash: string | null;
          whatsapp_link_expires_at: string | null;
        };
        Insert: {
          user_id?: string;
          inbox_token_hash?: string | null;
          inbox_token_created_at?: string | null;
          auto_apply?: boolean;
          updated_at?: string;
          whatsapp_wa_id?: string | null;
          whatsapp_linked_at?: string | null;
          whatsapp_link_code_hash?: string | null;
          whatsapp_link_expires_at?: string | null;
        };
        Update: {
          user_id?: string;
          inbox_token_hash?: string | null;
          inbox_token_created_at?: string | null;
          auto_apply?: boolean;
          updated_at?: string;
          whatsapp_wa_id?: string | null;
          whatsapp_linked_at?: string | null;
          whatsapp_link_code_hash?: string | null;
          whatsapp_link_expires_at?: string | null;
        };
        Relationships: [];
      };
      whatsapp_events: {
        Row: { message_id: string; created_at: string };
        Insert: { message_id: string; created_at?: string };
        Update: { message_id?: string; created_at?: string };
        Relationships: [];
      };
      concursos: {
        Row: ConcursoRow;
        Insert: Partial<ConcursoRow> & Pick<ConcursoRow, "organ" | "role_title">;
        Update: Partial<ConcursoRow>;
        Relationships: [];
      };
      concurso_stage_history: {
        Row: ConcursoStageHistoryRow;
        Insert: Partial<ConcursoStageHistoryRow> & Pick<ConcursoStageHistoryRow, "concurso_id" | "to_stage">;
        Update: Partial<ConcursoStageHistoryRow>;
        Relationships: [];
      };
      concurso_dates: {
        Row: ConcursoDateRow;
        Insert: Partial<ConcursoDateRow> & Pick<ConcursoDateRow, "concurso_id" | "kind" | "date">;
        Update: Partial<ConcursoDateRow>;
        Relationships: [];
      };
      concurso_subjects: {
        Row: ConcursoSubjectRow;
        Insert: Partial<ConcursoSubjectRow> & Pick<ConcursoSubjectRow, "concurso_id" | "name">;
        Update: Partial<ConcursoSubjectRow>;
        Relationships: [];
      };
      job_profiles: {
        Row: JobProfileRow;
        Insert: Partial<JobProfileRow> & { roles: string[] };
        Update: Partial<JobProfileRow>;
        Relationships: [];
      };
      resumes: {
        Row: ResumeRow;
        Insert: Partial<ResumeRow> & Pick<ResumeRow, "user_id" | "file_path" | "file_name" | "file_size">;
        Update: Partial<ResumeRow>;
        Relationships: [];
      };
      job_leads: {
        Row: JobLeadRow;
        Insert: Partial<JobLeadRow> &
          Pick<JobLeadRow, "source" | "external_id" | "company" | "title" | "url" | "score">;
        Update: Partial<JobLeadRow>;
        Relationships: [
          {
            foreignKeyName: "job_leads_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      inbox_items: {
        Row: {
          id: string;
          user_id: string;
          source: InboxSource;
          external_id: string | null;
          sender: string | null;
          subject: string | null;
          received_at: string;
          snippet: string | null;
          kind: InboxKind;
          suggested_stage: StageKey | null;
          confidence: InboxConfidence;
          company: string | null;
          role_title: string | null;
          platform: Platform | null;
          task_title: string | null;
          due_date: string | null;
          status: InboxStatus;
          auto_applied: boolean;
          application_id: string | null;
          resolution: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          source: InboxSource;
          external_id?: string | null;
          sender?: string | null;
          subject?: string | null;
          received_at?: string;
          snippet?: string | null;
          kind: InboxKind;
          suggested_stage?: StageKey | null;
          confidence?: InboxConfidence;
          company?: string | null;
          role_title?: string | null;
          platform?: Platform | null;
          task_title?: string | null;
          due_date?: string | null;
          status?: InboxStatus;
          auto_applied?: boolean;
          application_id?: string | null;
          resolution?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: InboxSource;
          external_id?: string | null;
          sender?: string | null;
          subject?: string | null;
          received_at?: string;
          snippet?: string | null;
          kind?: InboxKind;
          suggested_stage?: StageKey | null;
          confidence?: InboxConfidence;
          company?: string | null;
          role_title?: string | null;
          platform?: Platform | null;
          task_title?: string | null;
          due_date?: string | null;
          status?: InboxStatus;
          auto_applied?: boolean;
          application_id?: string | null;
          resolution?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inbox_items_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      inbox_ingest: {
        Args: { p_token: string; p_items: Json };
        Returns: number;
      };
      report_snapshot: {
        Args: { p_token: string };
        Returns: Json;
      };
      protect_demo_account: {
        Args: { p_user_id: string; p_password: string };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
