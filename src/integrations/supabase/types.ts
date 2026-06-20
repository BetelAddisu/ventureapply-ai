export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_logs: {
        Row: {
          action: string
          application_id: string | null
          company: string | null
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          application_id?: string | null
          company?: string | null
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          application_id?: string | null
          company?: string | null
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      cvs: {
        Row: {
          created_at: string
          id: string
          raw_json_data: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          raw_json_data?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          raw_json_data?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cvs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applied_at: string | null
          company: string
          created_at: string
          cv_label: string | null
          id: string
          job_id: string | null
          location: string | null
          match_score: number
          note: string | null
          salary: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          company: string
          created_at?: string
          cv_label?: string | null
          id?: string
          job_id?: string | null
          location?: string | null
          match_score?: number
          note?: string | null
          salary?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          company?: string
          created_at?: string
          cv_label?: string | null
          id?: string
          job_id?: string | null
          location?: string | null
          match_score?: number
          note?: string | null
          salary?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraped_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_matches: {
        Row: {
          created_at: string
          id: string
          job_id: string
          match_score: number
          status: string
          tailor_suggestions: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          match_score?: number
          status?: string
          tailor_suggestions?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          match_score?: number
          status?: string
          tailor_suggestions?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraped_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agent_active: boolean
          created_at: string
          current_tier: string
          experience_level: string | null
          full_name: string | null
          id: string
          notification_preference: string | null
          onboarded: boolean
          phone_number: string | null
          search_urgency: string | null
          target_title: string | null
          telegram_chat_id: string | null
          telegram_handle: string | null
          trial_ends_at: string | null
          trial_tier: string | null
          updated_at: string
        }
        Insert: {
          agent_active?: boolean
          created_at?: string
          current_tier?: string
          experience_level?: string | null
          full_name?: string | null
          id: string
          notification_preference?: string | null
          onboarded?: boolean
          phone_number?: string | null
          search_urgency?: string | null
          target_title?: string | null
          telegram_chat_id?: string | null
          telegram_handle?: string | null
          trial_ends_at?: string | null
          trial_tier?: string | null
          updated_at?: string
        }
        Update: {
          agent_active?: boolean
          created_at?: string
          current_tier?: string
          experience_level?: string | null
          full_name?: string | null
          id?: string
          notification_preference?: string | null
          onboarded?: boolean
          phone_number?: string | null
          search_urgency?: string | null
          target_title?: string | null
          telegram_chat_id?: string | null
          telegram_handle?: string | null
          trial_ends_at?: string | null
          trial_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scraped_jobs: {
        Row: {
          company: string
          created_at: string
          id: string
          job_description: string | null
          job_title: string
          location: string | null
          salary_range: string | null
          source: string | null
          url: string | null
        }
        Insert: {
          company: string
          created_at?: string
          id?: string
          job_description?: string | null
          job_title: string
          location?: string | null
          salary_range?: string | null
          source?: string | null
          url?: string | null
        }
        Update: {
          company?: string
          created_at?: string
          id?: string
          job_description?: string | null
          job_title?: string
          location?: string | null
          salary_range?: string | null
          source?: string | null
          url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
