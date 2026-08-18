export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SiteStatus = "active" | "disabled";
export type RunnerStatus = "online" | "offline" | "disabled";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type JobType = "generate_section";

export type Database = {
  public: {
    Tables: {
      sites: {
        Row: {
          id: string;
          name: string;
          domain: string;
          site_token_hash: string;
          status: SiteStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain: string;
          site_token_hash: string;
          status?: SiteStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string;
          site_token_hash?: string;
          status?: SiteStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      runners: {
        Row: {
          id: string;
          name: string;
          token_hash: string;
          status: RunnerStatus;
          last_seen_at: string | null;
          current_job_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          token_hash: string;
          status?: RunnerStatus;
          last_seen_at?: string | null;
          current_job_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          token_hash?: string;
          status?: RunnerStatus;
          last_seen_at?: string | null;
          current_job_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          site_id: string;
          type: JobType;
          prompt: string;
          context_json: Json;
          status: JobStatus;
          result_shortcode: string | null;
          error_message: string | null;
          claimed_by_runner_id: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          site_id: string;
          type?: JobType;
          prompt: string;
          context_json?: Json;
          status?: JobStatus;
          result_shortcode?: string | null;
          error_message?: string | null;
          claimed_by_runner_id?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          site_id?: string;
          type?: JobType;
          prompt?: string;
          context_json?: Json;
          status?: JobStatus;
          result_shortcode?: string | null;
          error_message?: string | null;
          claimed_by_runner_id?: string | null;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_next_job: {
        Args: { p_runner_id: string };
        Returns: {
          id: string;
          type: JobType;
          prompt: string;
          context_json: Json;
        }[];
      };
      complete_runner_job: {
        Args: {
          p_runner_id: string;
          p_job_id: string;
          p_result_shortcode: string;
        };
        Returns: boolean;
      };
      fail_runner_job: {
        Args: {
          p_runner_id: string;
          p_job_id: string;
          p_error_message: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TableRow<Table extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Table]["Row"];
