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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          code: string
          created_at: string
          id: string
          label: string | null
          notes: string | null
          owner_order_id: string | null
          owner_email: string | null
          owner_user_id: string | null
          product_id: string | null
          quantity: number
          sold_to: string | null
          status: Database["public"]["Enums"]["batch_status"]
          codes_sent_at: string | null
          unit_cost_cents: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          owner_order_id?: string | null
          owner_email?: string | null
          owner_user_id?: string | null
          product_id?: string | null
          quantity?: number
          sold_to?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          codes_sent_at?: string | null
          unit_cost_cents?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          owner_order_id?: string | null
          owner_email?: string | null
          owner_user_id?: string | null
          product_id?: string | null
          quantity?: number
          sold_to?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          codes_sent_at?: string | null
          unit_cost_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_owner_order_id_fkey"
            columns: ["owner_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          category: string | null
          created_at: string
          google_place_id: string | null
          id: string
          name: string
          phone: string | null
          rating: number | null
          review_url: string
          reviews_count: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          name: string
          phone?: string | null
          rating?: number | null
          review_url: string
          reviews_count?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          created_at?: string
          google_place_id?: string | null
          id?: string
          name?: string
          phone?: string | null
          rating?: number | null
          review_url?: string
          reviews_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      checkout_sessions: {
        Row: {
          created_at: string
          data: Json
          expires_at: string
          id: string
          order_id: string | null
          step: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          order_id?: string | null
          step?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          order_id?: string | null
          step?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount_cents: number
          attachment_url: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          id: string
          is_recurring: boolean
          kind: Database["public"]["Enums"]["finance_kind"]
          order_id: string | null
          partner_id: string | null
          recurrence: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          attachment_url?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_recurring?: boolean
          kind: Database["public"]["Enums"]["finance_kind"]
          order_id?: string | null
          partner_id?: string | null
          recurrence?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          attachment_url?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          id?: string
          is_recurring?: boolean
          kind?: Database["public"]["Enums"]["finance_kind"]
          order_id?: string | null
          partner_id?: string | null
          recurrence?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "finance_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_partners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          share_percent: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          share_percent?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          share_percent?: number
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          business_id: string | null
          created_at: string
          customer_document: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          external_reference: string | null
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          id: string
          kind: Database["public"]["Enums"]["order_kind"]
          notes: string | null
          order_number: number
          paid_at: string | null
          payment_method: string | null
          payment_provider: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          plan_id: string | null
          provider_payment_id: string | null
          quantity: number
          ship_city: string | null
          ship_complement: string | null
          ship_district: string | null
          ship_number: string | null
          ship_state: string | null
          ship_street: string | null
          ship_zip: string | null
          shipped_at: string | null
          shipping_cents: number
          subtotal_cents: number
          total_cents: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          external_reference?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          plan_id?: string | null
          provider_payment_id?: string | null
          quantity?: number
          ship_city?: string | null
          ship_complement?: string | null
          ship_district?: string | null
          ship_number?: string | null
          ship_state?: string | null
          ship_street?: string | null
          ship_zip?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          external_reference?: string | null
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          kind?: Database["public"]["Enums"]["order_kind"]
          notes?: string | null
          order_number?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          plan_id?: string | null
          provider_payment_id?: string | null
          quantity?: number
          ship_city?: string | null
          ship_complement?: string | null
          ship_district?: string | null
          ship_number?: string | null
          ship_state?: string | null
          ship_street?: string | null
          ship_zip?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          subtotal_cents?: number
          total_cents?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_packages: {
        Row: {
          badge: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          note: string | null
          plan_id: string
          quantity: number
          sort_order: number
        }
        Insert: {
          badge?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          note?: string | null
          plan_id: string
          quantity: number
          sort_order?: number
        }
        Update: {
          badge?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          note?: string | null
          plan_id?: string
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_packages_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_price_tiers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          min_quantity: number
          plan_id: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          min_quantity: number
          plan_id: string
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          min_quantity?: number
          plan_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_price_tiers_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          audience: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_resale: boolean
          max_quantity: number | null
          min_quantity: number
          name: string
          slug: string
          sort_order: number
          unit_price_cents: number
          updated_at: string
        }
        Insert: {
          audience: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_resale?: boolean
          max_quantity?: number | null
          min_quantity?: number
          name: string
          slug: string
          sort_order?: number
          unit_price_cents: number
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_resale?: boolean
          max_quantity?: number | null
          min_quantity?: number
          name?: string
          slug?: string
          sort_order?: number
          unit_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      plate_scan_events: {
        Row: {
          country: string | null
          created_at: string
          device: string | null
          id: string
          plate_id: string | null
          referrer_host: string | null
          token: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          plate_id?: string | null
          referrer_host?: string | null
          token: string
        }
        Update: {
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          plate_id?: string | null
          referrer_host?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "plate_scan_events_plate_id_fkey"
            columns: ["plate_id"]
            isOneToOne: false
            referencedRelation: "plates"
            referencedColumns: ["id"]
          },
        ]
      }
      plates: {
        Row: {
          activated_at: string | null
          batch_id: string | null
          business_id: string | null
          created_at: string
          destination_url: string | null
          id: string
          last_scan_at: string | null
          order_id: string | null
          product_id: string | null
          scan_count: number
          status: Database["public"]["Enums"]["plate_status"]
          token: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          batch_id?: string | null
          business_id?: string | null
          created_at?: string
          destination_url?: string | null
          id?: string
          last_scan_at?: string | null
          order_id?: string | null
          product_id?: string | null
          scan_count?: number
          status?: Database["public"]["Enums"]["plate_status"]
          token: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          batch_id?: string | null
          business_id?: string | null
          created_at?: string
          destination_url?: string | null
          id?: string
          last_scan_at?: string | null
          order_id?: string | null
          product_id?: string | null
          scan_count?: number
          status?: Database["public"]["Enums"]["plate_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          format: string
          id: string
          image_url: string | null
          name: string
          price_delta_cents: number
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["product_status"]
          tagline: string | null
          updated_at: string
          has_nfc: boolean
          has_qr: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          format: string
          id?: string
          image_url?: string | null
          name: string
          price_delta_cents?: number
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["product_status"]
          tagline?: string | null
          updated_at?: string
          has_nfc?: boolean
          has_qr?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          image_url?: string | null
          name?: string
          price_delta_cents?: number
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["product_status"]
          tagline?: string | null
          updated_at?: string
          has_nfc?: boolean
          has_qr?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      batch_status: "rascunho" | "produzido" | "vendido"
      finance_kind: "entrada" | "saida"
      fulfillment_status:
        | "recebido"
        | "em_producao"
        | "enviado"
        | "entregue"
        | "cancelado"
      order_kind: "individual" | "revenda"
      payment_status:
        | "pendente"
        | "pago"
        | "recusado"
        | "estornado"
        | "cancelado"
      plate_status: "nao_ativada" | "ativada" | "bloqueada"
      product_status: "ativo" | "em_breve" | "oculto"
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
      app_role: ["admin", "staff", "customer"],
      batch_status: ["rascunho", "produzido", "vendido"],
      finance_kind: ["entrada", "saida"],
      fulfillment_status: [
        "recebido",
        "em_producao",
        "enviado",
        "entregue",
        "cancelado",
      ],
      order_kind: ["individual", "revenda"],
      payment_status: [
        "pendente",
        "pago",
        "recusado",
        "estornado",
        "cancelado",
      ],
      plate_status: ["nao_ativada", "ativada", "bloqueada"],
      product_status: ["ativo", "em_breve", "oculto"],
    },
  },
} as const
