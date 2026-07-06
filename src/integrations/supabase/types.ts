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
      access_requests: {
        Row: {
          email: string
          id: string
          note: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          email: string
          id?: string
          note?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          email?: string
          id?: string
          note?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      advertencias: {
        Row: {
          created_at: string
          data: string
          diarista_id: string
          id: string
          motivo: string
        }
        Insert: {
          created_at?: string
          data?: string
          diarista_id: string
          id?: string
          motivo: string
        }
        Update: {
          created_at?: string
          data?: string
          diarista_id?: string
          id?: string
          motivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertencias_diarista_id_fkey"
            columns: ["diarista_id"]
            isOneToOne: false
            referencedRelation: "diaristas"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          nome: string
          observacao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome: string
          observacao?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome?: string
          observacao?: string
          updated_at?: string
        }
        Relationships: []
      }
      diaristas: {
        Row: {
          cpf: string
          created_at: string
          email: string
          endereco: string
          foto: string | null
          id: string
          lider: string
          localidade: string
          nome: string
          sexo: string | null
          status: string
          telefone: string
          turno: string
          uniforme: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cpf?: string
          created_at?: string
          email?: string
          endereco?: string
          foto?: string | null
          id?: string
          lider?: string
          localidade?: string
          nome: string
          sexo?: string | null
          status?: string
          telefone?: string
          turno?: string
          uniforme?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string
          endereco?: string
          foto?: string | null
          id?: string
          lider?: string
          localidade?: string
          nome?: string
          sexo?: string | null
          status?: string
          telefone?: string
          turno?: string
          uniforme?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      epi_entregas: {
        Row: {
          created_at: string
          devolvido_em: string | null
          diarista_id: string
          entregue_em: string
          id: string
          observacao: string
          tamanho: string
          tipo: string
        }
        Insert: {
          created_at?: string
          devolvido_em?: string | null
          diarista_id: string
          entregue_em?: string
          id?: string
          observacao?: string
          tamanho: string
          tipo: string
        }
        Update: {
          created_at?: string
          devolvido_em?: string | null
          diarista_id?: string
          entregue_em?: string
          id?: string
          observacao?: string
          tamanho?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "epi_entregas_diarista_id_fkey"
            columns: ["diarista_id"]
            isOneToOne: false
            referencedRelation: "diaristas"
            referencedColumns: ["id"]
          },
        ]
      }
      epi_estoque: {
        Row: {
          created_at: string
          id: string
          quantidade_total: number
          tamanho: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantidade_total?: number
          tamanho: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          quantidade_total?: number
          tamanho?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      escalas: {
        Row: {
          created_at: string
          data: string
          demanda_id: string | null
          diarista_id: string
          eh_feriado: boolean
          id: string
          observacao: string
          updated_at: string
          valor_diaria: number
          valor_passagem: number
        }
        Insert: {
          created_at?: string
          data: string
          demanda_id?: string | null
          diarista_id: string
          eh_feriado?: boolean
          id?: string
          observacao?: string
          updated_at?: string
          valor_diaria?: number
          valor_passagem?: number
        }
        Update: {
          created_at?: string
          data?: string
          demanda_id?: string | null
          diarista_id?: string
          eh_feriado?: boolean
          id?: string
          observacao?: string
          updated_at?: string
          valor_diaria?: number
          valor_passagem?: number
        }
        Relationships: [
          {
            foreignKeyName: "escalas_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_diarista_id_fkey"
            columns: ["diarista_id"]
            isOneToOne: false
            referencedRelation: "diaristas"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_links: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number | null
          revoked_at: string | null
          token: string
          used_at: string | null
          used_diarista_id: string | null
          uses_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token?: string
          used_at?: string | null
          used_diarista_id?: string | null
          uses_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token?: string
          used_at?: string | null
          used_diarista_id?: string | null
          uses_count?: number
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_users_overview: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_sign_in_at: string
          request_status: string
          requested_at: string
          reviewed_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      approve_access_request: { Args: { _user_id: string }; Returns: undefined }
      can_signup: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      my_access_status: { Args: never; Returns: string }
      public_check_signup_link: { Args: { _token: string }; Returns: Json }
      public_consume_signup_link: {
        Args: { _payload: Json; _token: string }
        Returns: Json
      }
      revoke_access: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user" | "leader"
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
    Enums: {
      app_role: ["admin", "user", "leader"],
    },
  },
} as const
