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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          active: boolean
          code: string
          created_at: string
          criteria: Json
          description_en: string | null
          description_ru: string | null
          icon: string | null
          id: string
          reward_amount: number
          title_en: string
          title_ru: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          criteria?: Json
          description_en?: string | null
          description_ru?: string | null
          icon?: string | null
          id?: string
          reward_amount?: number
          title_en: string
          title_ru: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          criteria?: Json
          description_en?: string | null
          description_ru?: string | null
          icon?: string | null
          id?: string
          reward_amount?: number
          title_en?: string
          title_ru?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      bets: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          client_seed: string
          created_at: string
          game: string
          id: string
          nonce: number
          payout: number
          result: Json
          server_seed: string | null
          server_seed_hash: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          client_seed: string
          created_at?: string
          game: string
          id?: string
          nonce: number
          payout?: number
          result?: Json
          server_seed?: string | null
          server_seed_hash: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          client_seed?: string
          created_at?: string
          game?: string
          id?: string
          nonce?: number
          payout?: number
          result?: Json
          server_seed?: string | null
          server_seed_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      deposit_limits: {
        Row: {
          amount: number
          created_at: string
          effective_from: string
          id: string
          period: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          effective_from?: string
          id?: string
          period: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          effective_from?: string
          id?: string
          period?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_settings: {
        Row: {
          enabled: boolean
          game: string
          max_bet: number
          min_bet: number
          rtp: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          game: string
          max_bet?: number
          min_bet?: number
          rtp?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          game?: string
          max_bet?: number
          min_bet?: number
          rtp?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      kyc_files: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["kyc_file_kind"]
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["kyc_file_kind"]
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["kyc_file_kind"]
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ledger: {
        Row: {
          admin_id: string | null
          amount: number
          created_at: string
          id: number
          reason: string | null
          reference_id: string | null
          tx_hash: string | null
          type: Database["public"]["Enums"]["ledger_type"]
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          created_at?: string
          id?: never
          reason?: string | null
          reference_id?: string | null
          tx_hash?: string | null
          type: Database["public"]["Enums"]["ledger_type"]
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          created_at?: string
          id?: never
          reason?: string | null
          reference_id?: string | null
          tx_hash?: string | null
          type?: Database["public"]["Enums"]["ledger_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mission_installments: {
        Row: {
          amount: number
          created_at: string
          due_at: string
          id: string
          ledger_id: number | null
          mission_id: string
          paid_at: string | null
          sequence: number
          status: Database["public"]["Enums"]["installment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_at: string
          id?: string
          ledger_id?: number | null
          mission_id: string
          paid_at?: string | null
          sequence: number
          status?: Database["public"]["Enums"]["installment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_at?: string
          id?: string
          ledger_id?: number | null
          mission_id?: string
          paid_at?: string | null
          sequence?: number
          status?: Database["public"]["Enums"]["installment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_installments_ledger_id_fkey"
            columns: ["ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_installments_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_installments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      missions: {
        Row: {
          created_at: string
          deposit_amount: number | null
          expires_at: string | null
          id: string
          installments_count: number
          rollover: number
          source_ledger_id: number | null
          status: string
          terms_version: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deposit_amount?: number | null
          expires_at?: string | null
          id?: string
          installments_count: number
          rollover?: number
          source_ledger_id?: number | null
          status?: string
          terms_version?: number
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deposit_amount?: number | null
          expires_at?: string | null
          id?: string
          installments_count?: number
          rollover?: number
          source_ledger_id?: number | null
          status?: string
          terms_version?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_source_ledger_id_fkey"
            columns: ["source_ledger_id"]
            isOneToOne: false
            referencedRelation: "ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          document_number: string | null
          email: string | null
          full_name: string | null
          kyc_submitted_at: string | null
          language: Database["public"]["Enums"]["app_language"]
          nationality: string | null
          referral_code: string
          referral_code_approved_at: string | null
          referral_code_approved_by: string | null
          referral_code_status: string
          referral_requested_at: string | null
          referred_by: string | null
          rejection_reason: string | null
          solana_wallet_address: string | null
          status: Database["public"]["Enums"]["profile_status"]
          status_before_block:
            | Database["public"]["Enums"]["profile_status"]
            | null
          telegram_id: number | null
          telegram_relink_allowed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name?: string | null
          kyc_submitted_at?: string | null
          language?: Database["public"]["Enums"]["app_language"]
          nationality?: string | null
          referral_code: string
          referral_code_approved_at?: string | null
          referral_code_approved_by?: string | null
          referral_code_status?: string
          referral_requested_at?: string | null
          referred_by?: string | null
          rejection_reason?: string | null
          solana_wallet_address?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          status_before_block?:
            | Database["public"]["Enums"]["profile_status"]
            | null
          telegram_id?: number | null
          telegram_relink_allowed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name?: string | null
          kyc_submitted_at?: string | null
          language?: Database["public"]["Enums"]["app_language"]
          nationality?: string | null
          referral_code?: string
          referral_code_approved_at?: string | null
          referral_code_approved_by?: string | null
          referral_code_status?: string
          referral_requested_at?: string | null
          referred_by?: string | null
          rejection_reason?: string | null
          solana_wallet_address?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          status_before_block?:
            | Database["public"]["Enums"]["profile_status"]
            | null
          telegram_id?: number | null
          telegram_relink_allowed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_amount: number
          rewarded_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_amount?: number
          rewarded_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          rewarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      self_exclusions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          reason: string | null
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          reason?: string | null
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          reason?: string | null
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "self_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      slot_sessions: {
        Row: {
          client_seed: string
          created_at: string
          game: string
          id: string
          nonce: number
          revealed_at: string | null
          server_seed: string
          server_seed_hash: string
          status: string
          user_id: string
        }
        Insert: {
          client_seed: string
          created_at?: string
          game: string
          id?: string
          nonce?: number
          revealed_at?: string | null
          server_seed: string
          server_seed_hash: string
          status?: string
          user_id: string
        }
        Update: {
          client_seed?: string
          created_at?: string
          game?: string
          id?: string
          nonce?: number
          revealed_at?: string | null
          server_seed?: string
          server_seed_hash?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spin_requests: {
        Row: {
          created_at: string
          request_id: string
          response: Json
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          request_id: string
          response: Json
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          request_id?: string
          response?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spin_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "slot_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spin_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          destination_address: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          destination_address: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          destination_address?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      user_balances: {
        Row: {
          balance: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      admin_adjust_balance: {
        Args: {
          _amount: number
          _kind: string
          _reason: string
          _tx_hash?: string
          _user_id: string
        }
        Returns: number
      }
      admin_allow_telegram_relink: {
        Args: { _allowed: boolean; _user_id: string }
        Returns: undefined
      }
      admin_reports: { Args: { _from: string; _to: string }; Returns: Json }
      admin_review_kyc: {
        Args: {
          _decision: string
          _reason?: string
          _user_id: string
          _wallet?: string
        }
        Returns: undefined
      }
      admin_review_withdrawal: {
        Args: {
          _decision: string
          _reason?: string
          _tx_hash?: string
          _withdrawal_id: string
        }
        Returns: undefined
      }
      admin_save_achievement: {
        Args: {
          _active: boolean
          _code: string
          _criteria: Json
          _description_en: string
          _description_ru: string
          _icon: string
          _id: string
          _reward_amount: number
          _title_en: string
          _title_ru: string
        }
        Returns: string
      }
      admin_save_cashback_terms: {
        Args: {
          _expires_days: number
          _rollover: number
          _terms: string
          _version: number
          _withdrawal_rules: string
        }
        Returns: undefined
      }
      admin_save_game_settings: {
        Args: {
          _enabled: boolean
          _game: string
          _max_bet: number
          _min_bet: number
          _rtp: number
        }
        Returns: undefined
      }
      admin_save_mission_terms: {
        Args: { _terms: string; _version: number }
        Returns: undefined
      }
      admin_set_referral_code: {
        Args: { _code?: string; _user_id: string }
        Returns: string
      }
      admin_set_user_blocked: {
        Args: { _blocked: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      assert_staff_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: undefined
      }
      evaluate_achievements: { Args: { _user_id: string }; Returns: number }
      generate_referral_code: { Args: never; Returns: string }
      get_balance: { Args: { _user_id?: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_self_excluded: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_staff_mfa: { Args: { _user_id: string }; Returns: boolean }
      play_slot_spins: {
        Args: {
          _bet: number
          _request_id: string
          _response: Json
          _results: Json
          _session_id: string
          _spins: number
        }
        Returns: Json
      }
      player_save_limits: {
        Args: {
          _daily: number
          _monthly: number
          _user_id: string
          _weekly: number
        }
        Returns: undefined
      }
      player_self_exclude: {
        Args: { _days: number; _user_id: string }
        Returns: undefined
      }
      post_ledger_entry: {
        Args: {
          _admin_id?: string
          _amount: number
          _reason?: string
          _reference_id?: string
          _tx_hash?: string
          _type: Database["public"]["Enums"]["ledger_type"]
          _user_id: string
        }
        Returns: number
      }
      release_cashback_installments: { Args: never; Returns: number }
      request_referral_code: { Args: never; Returns: string }
      request_withdrawal: {
        Args: { _amount: number; _destination_address: string }
        Returns: string
      }
      submit_kyc: {
        Args: {
          _address: string
          _document_number: string
          _full_name: string
          _nationality: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_language: "en" | "ru"
      app_role: "admin" | "finance" | "support"
      installment_status: "pending" | "paid" | "cancelled"
      kyc_file_kind: "document_front" | "document_back" | "selfie"
      ledger_type:
        | "deposit"
        | "bet"
        | "win"
        | "bonus"
        | "withdrawal"
        | "adjustment"
      profile_status: "pending" | "approved" | "rejected" | "blocked"
      withdrawal_status: "requested" | "approved" | "paid" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_language: ["en", "ru"],
      app_role: ["admin", "finance", "support"],
      installment_status: ["pending", "paid", "cancelled"],
      kyc_file_kind: ["document_front", "document_back", "selfie"],
      ledger_type: [
        "deposit",
        "bet",
        "win",
        "bonus",
        "withdrawal",
        "adjustment",
      ],
      profile_status: ["pending", "approved", "rejected", "blocked"],
      withdrawal_status: ["requested", "approved", "paid", "rejected"],
    },
  },
} as const
