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
export type SectionStatus = "draft" | "published" | "archived";
export type AdminUserStatus = "active" | "disabled";

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
      // The central NCloud template library, shared by every site. The table
      // predates this repository's migrations; the only changes made here are
      // additive columns: `css_code` (20260819000000) and
      // `preview_storage_path` (20260819003000). CSS is stored separately from
      // the shortcode. `preview_storage_path` is preferred when set, with
      // `preview_screenshot_url` kept for older records.
      sections: {
        Row: {
          id: string;
          name: string;
          category: string;
          section_type: string;
          style: string | null;
          shortcode: string;
          css_code: string | null;
          original_prompt: string | null;
          preview_screenshot_url: string | null;
          preview_storage_path: string | null;
          status: SectionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          section_type: string;
          style?: string | null;
          shortcode: string;
          css_code?: string | null;
          original_prompt?: string | null;
          preview_screenshot_url?: string | null;
          preview_storage_path?: string | null;
          status?: SectionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          section_type?: string;
          style?: string | null;
          shortcode?: string;
          css_code?: string | null;
          original_prompt?: string | null;
          preview_screenshot_url?: string | null;
          preview_storage_path?: string | null;
          status?: SectionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Per-site "My Saved" library, created by
      // 20260819001000_saved_sections.sql. Distinct from `sections`: a row here
      // belongs to exactly one site and is never shared.
      saved_sections: {
        Row: {
          id: string;
          site_id: string;
          name: string;
          shortcode: string;
          css_code: string | null;
          preview_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          site_id: string;
          name: string;
          shortcode: string;
          css_code?: string | null;
          preview_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          site_id?: string;
          name?: string;
          shortcode?: string;
          css_code?: string | null;
          preview_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Per-site visibility preference for central templates, created by
      // 20260819002000_site_hidden_sections.sql. Hiding is site-local: the
      // sections row is untouched and other sites are unaffected.
      site_hidden_sections: {
        Row: {
          site_id: string;
          section_id: string;
          created_at: string;
        };
        Insert: {
          site_id: string;
          section_id: string;
          created_at?: string;
        };
        Update: {
          site_id?: string;
          section_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      // NCloud administrator accounts, created by
      // 20260819004000_admin_users.sql. Only a versioned scrypt hash is
      // stored; a plaintext password never reaches the database.
      admin_users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          must_change_password: boolean;
          status: AdminUserStatus;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          must_change_password?: boolean;
          status?: AdminUserStatus;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          password_hash?: string;
          must_change_password?: boolean;
          status?: AdminUserStatus;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Relationships: [];
      };
      // Shared login throttling, created by
      // 20260819005000_admin_login_attempts.sql. One row per salted identity
      // hash; no password, address, or plaintext username is stored.
      admin_login_attempts: {
        Row: {
          identity_hash: string;
          failure_count: number;
          window_started_at: string;
          blocked_until: string | null;
          updated_at: string;
        };
        Insert: {
          identity_hash: string;
          failure_count?: number;
          window_started_at?: string;
          blocked_until?: string | null;
          updated_at?: string;
        };
        Update: {
          identity_hash?: string;
          failure_count?: number;
          window_started_at?: string;
          blocked_until?: string | null;
          updated_at?: string;
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
      record_admin_login_failure: {
        Args: {
          p_identity_hash: string;
          p_window_seconds: number;
          p_max_failures: number;
          p_block_seconds: number;
        };
        Returns: string | null;
      };
      admin_login_blocked_until: {
        Args: { p_identity_hash: string };
        Returns: string | null;
      };
      clear_admin_login_failures: {
        Args: { p_identity_hash: string };
        Returns: undefined;
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
