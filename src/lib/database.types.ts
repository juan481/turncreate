export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_items: {
        Row: {
          appointment_id: string
          buffer_min: number
          created_at: string
          id: string
          name: string
          phases: Json
          price: number
          service_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          buffer_min?: number
          created_at?: string
          id?: string
          name: string
          phases?: Json
          price: number
          service_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          buffer_min?: number
          created_at?: string
          id?: string
          name?: string
          phases?: Json
          price?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_segments: {
        Row: {
          appointment_id: string | null
          created_at: string
          hold_id: string | null
          id: string
          period: unknown
          staff_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          hold_id?: string | null
          id?: string
          period: unknown
          staff_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          hold_id?: string | null
          id?: string
          period?: unknown
          staff_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_segments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_segments_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_segments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_status_history: {
        Row: {
          actor_id: string | null
          appointment_id: string
          at: string
          from_status: string | null
          id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          appointment_id: string
          at?: string
          from_status?: string | null
          id?: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          appointment_id?: string
          at?: string
          from_status?: string | null
          id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          balance: number
          cancel_reason: string | null
          client_id: string
          created_at: string
          deposit_paid: number
          deposit_required: number
          ends_at: string
          hold_expires_at: string | null
          id: string
          manage_token_hash: string | null
          rescheduled_from_id: string | null
          source: string
          staff_id: string
          starts_at: string
          status: string
          tenant_id: string
          token: string | null
          total: number
          updated_at: string
        }
        Insert: {
          balance?: number
          cancel_reason?: string | null
          client_id: string
          created_at?: string
          deposit_paid?: number
          deposit_required?: number
          ends_at: string
          hold_expires_at?: string | null
          id?: string
          manage_token_hash?: string | null
          rescheduled_from_id?: string | null
          source: string
          staff_id: string
          starts_at: string
          status?: string
          tenant_id: string
          token?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          cancel_reason?: string | null
          client_id?: string
          created_at?: string
          deposit_paid?: number
          deposit_required?: number
          ends_at?: string
          hold_expires_at?: string | null
          id?: string
          manage_token_hash?: string | null
          rescheduled_from_id?: string | null
          source?: string
          staff_id?: string
          starts_at?: string
          status?: string
          tenant_id?: string
          token?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          id: string
          impersonated_by: string | null
          target: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          impersonated_by?: string | null
          target: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          id?: string
          impersonated_by?: string | null
          target?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          opens_at: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          opens_at: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          opens_at?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_types: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          cash_session_id: string
          created_at: string
          id: string
          payment_id: string | null
          reason: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          cash_session_id: string
          created_at?: string
          id?: string
          payment_id?: string | null
          reason: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_session_id?: string
          created_at?: string
          id?: string
          payment_id?: string | null
          reason?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          counted_amount: number | null
          created_at: string
          difference: number | null
          difference_reason: string | null
          expected_amount: number | null
          id: string
          opened_at: string
          opened_by: string
          opening_amount: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          created_at?: string
          difference?: number | null
          difference_reason?: string | null
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opened_by: string
          opening_amount?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          created_at?: string
          difference?: number | null
          difference_reason?: string | null
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string
          body: string
          client_id: string
          created_at: string
          id: string
          is_clinical: boolean
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          client_id: string
          created_at?: string
          id?: string
          is_clinical?: boolean
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          is_clinical?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          client_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_stats"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          marketing_opt_in: boolean
          no_show_count: number
          phone_e164: string
          tenant_id: string
          updated_at: string
          whatsapp_opt_in: boolean
          whatsapp_opt_in_at: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          marketing_opt_in?: boolean
          no_show_count?: number
          phone_e164: string
          tenant_id: string
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          marketing_opt_in?: boolean
          no_show_count?: number
          phone_e164?: string
          tenant_id?: string
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_entries: {
        Row: {
          amount: number
          appointment_id: string
          base_amount: number
          created_at: string
          id: string
          payout_id: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id: string
          base_amount: number
          created_at?: string
          id?: string
          payout_id?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string
          base_amount?: number
          created_at?: string
          id?: string
          payout_id?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_entries_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "commission_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_payouts: {
        Row: {
          created_at: string
          id: string
          paid_at: string | null
          period_from: string
          period_to: string
          staff_id: string
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          paid_at?: string | null
          period_from: string
          period_to: string
          staff_id: string
          tenant_id: string
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          paid_at?: string | null
          period_from?: string
          period_to?: string
          staff_id?: string
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          service_id: string | null
          staff_id: string | null
          tenant_id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          service_id?: string | null
          staff_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          service_id?: string | null
          staff_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      holds: {
        Row: {
          created_at: string
          ends_at: string
          expires_at: string
          id: string
          items: Json
          rescheduled_from_id: string | null
          staff_id: string
          starts_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          expires_at?: string
          id?: string
          items: Json
          rescheduled_from_id?: string | null
          staff_id: string
          starts_at: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          expires_at?: string
          id?: string
          items?: Json
          rescheduled_from_id?: string | null
          staff_id?: string
          starts_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holds_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holds_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          country: string
          created_at: string
          date: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          country: string
          created_at?: string
          date: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          channel: string
          created_at: string
          expires_at: string
          id: string
          role: string
          staff_id: string | null
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          channel: string
          created_at?: string
          expires_at: string
          id?: string
          role: string
          staff_id?: string | null
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          role?: string
          staff_id?: string | null
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          content: string | null
          created_at: string | null
          error_details: string | null
          id: string
          message_type: string
          outbox_event_id: string | null
          recipient: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          error_details?: string | null
          id?: string
          message_type: string
          outbox_event_id?: string | null
          recipient: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          error_details?: string | null
          id?: string
          message_type?: string
          outbox_event_id?: string | null
          recipient?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_outbox_event_id_fkey"
            columns: ["outbox_event_id"]
            isOneToOne: false
            referencedRelation: "outbox_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          created_at: string | null
          id: string
          next_retry_at: string | null
          payload: Json
          retries: number | null
          status: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          next_retry_at?: string | null
          payload: Json
          retries?: number | null
          status?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          next_retry_at?: string | null
          payload?: Json
          retries?: number | null
          status?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          cash_session_id: string | null
          created_at: string
          id: string
          kind: string
          method: string
          mp_payment_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          cash_session_id?: string | null
          created_at?: string
          id?: string
          kind: string
          method: string
          mp_payment_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          cash_session_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          method?: string
          mp_payment_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          features?: Json
          id?: string
          limits?: Json
          name: string
          price_monthly: number
          price_yearly: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          price: number
          sku: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          price: number
          sku?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          price?: number
          sku?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          product_id: string
          qty: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          product_id: string
          qty: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          product_id?: string
          qty?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_phases: {
        Row: {
          created_at: string
          id: string
          kind: string
          minutes: number
          position: number
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          minutes: number
          position: number
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          minutes?: number
          position?: number
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_phases_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_templates: {
        Row: {
          buffer_min: number
          business_type_id: string
          created_at: string
          id: string
          name: string
          phases: Json
          price_suggested: number
          updated_at: string
        }
        Insert: {
          buffer_min?: number
          business_type_id: string
          created_at?: string
          id?: string
          name: string
          phases?: Json
          price_suggested: number
          updated_at?: string
        }
        Update: {
          buffer_min?: number
          business_type_id?: string
          created_at?: string
          id?: string
          name?: string
          phases?: Json
          price_suggested?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_templates_business_type_id_fkey"
            columns: ["business_type_id"]
            isOneToOne: false
            referencedRelation: "business_types"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          archived_at: string | null
          buffer_after_min: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          photo_url: string | null
          price: number
          public: boolean
          sort: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          buffer_after_min?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photo_url?: string | null
          price: number
          public?: boolean
          sort?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          buffer_after_min?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          price?: number
          public?: boolean
          sort?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          archived_at: string | null
          color: string | null
          created_at: string
          display_name: string
          id: string
          member_id: string | null
          photo_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          color?: string | null
          created_at?: string
          display_name: string
          id?: string
          member_id?: string | null
          photo_url?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          color?: string | null
          created_at?: string
          display_name?: string
          id?: string
          member_id?: string | null
          photo_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          staff_id: string
          starts_at: string
          updated_at: string
          valid_from: string
          valid_to: string | null
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          staff_id: string
          starts_at: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          staff_id?: string
          starts_at?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          created_at: string
          duration_override: number | null
          id: string
          price_override: number | null
          service_id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_override?: number | null
          id?: string
          price_override?: number | null
          service_id: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_override?: number | null
          id?: string
          price_override?: number | null
          service_id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          product_id: string
          qty: number
          reason: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          qty: number
          reason: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          qty?: number
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          current_period_end: string | null
          id: string
          mp_preapproval_id: string | null
          plan_id: string
          status: string
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          mp_preapproval_id?: string | null
          plan_id: string
          status?: string
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          id?: string
          mp_preapproval_id?: string | null
          plan_id?: string
          status?: string
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          mp_user_id: string | null
          provider: string
          status: string
          tenant_id: string
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          mp_user_id?: string | null
          provider: string
          status?: string
          tenant_id: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          mp_user_id?: string | null
          provider?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          booking_horizon_days: number
          books_by_staff: boolean
          cancel_window_hours: number
          created_at: string
          deposit_min: number
          deposit_on_cancel: string
          deposit_type: string
          deposit_value: number
          id: string
          min_notice_min: number
          reminder_hours: number
          slot_interval_min: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booking_horizon_days?: number
          books_by_staff?: boolean
          cancel_window_hours?: number
          created_at?: string
          deposit_min?: number
          deposit_on_cancel?: string
          deposit_type?: string
          deposit_value?: number
          id?: string
          min_notice_min?: number
          reminder_hours?: number
          slot_interval_min?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booking_horizon_days?: number
          books_by_staff?: boolean
          cancel_window_hours?: number
          created_at?: string
          deposit_min?: number
          deposit_on_cancel?: string
          deposit_type?: string
          deposit_value?: number
          id?: string
          min_notice_min?: number
          reminder_hours?: number
          slot_interval_min?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          business_type_id: string
          created_at: string
          currency: string
          id: string
          instagram_url: string | null
          logo_url: string | null
          name: string
          slug: string
          status: string
          timezone: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          business_type_id: string
          created_at?: string
          currency?: string
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          business_type_id?: string
          created_at?: string
          currency?: string
          id?: string
          instagram_url?: string | null
          logo_url?: string | null
          name?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_business_type_id_fkey"
            columns: ["business_type_id"]
            isOneToOne: false
            referencedRelation: "business_types"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          kind: string
          reason: string | null
          staff_id: string | null
          starts_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          kind: string
          reason?: string | null
          staff_id?: string | null
          starts_at: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          kind?: string
          reason?: string | null
          staff_id?: string | null
          starts_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          external_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      client_stats: {
        Row: {
          appointments_count: number | null
          client_id: string | null
          last_visit_at: string | null
          tenant_id: string | null
          total_spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_cash_movement: {
        Args: {
          p_amount: number
          p_cash_session_id: string
          p_reason: string
          p_type: string
        }
        Returns: {
          amount: number
          cash_session_id: string
          created_at: string
          id: string
          payment_id: string | null
          reason: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_appointment_by_token: { Args: { p_token: string }; Returns: Json }
      close_cash_session: {
        Args: {
          p_counted_amount: number
          p_difference_reason?: string
          p_session_id: string
        }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          counted_amount: number | null
          created_at: string
          difference: number | null
          difference_reason: string | null
          expected_amount: number | null
          id: string
          opened_at: string
          opened_by: string
          opening_amount: number
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_public_hold: {
        Args: { p_client_data: Json; p_hold_id: string }
        Returns: {
          balance: number
          cancel_reason: string | null
          client_id: string
          created_at: string
          deposit_paid: number
          deposit_required: number
          ends_at: string
          hold_expires_at: string | null
          id: string
          manage_token_hash: string | null
          rescheduled_from_id: string | null
          source: string
          staff_id: string
          starts_at: string
          status: string
          tenant_id: string
          token: string | null
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_public_hold: {
        Args: {
          p_ends_at: string
          p_items: Json
          p_rescheduled_from_id?: string
          p_segments: Json
          p_staff_id: string
          p_starts_at: string
          p_tenant_id: string
        }
        Returns: {
          created_at: string
          ends_at: string
          expires_at: string
          id: string
          items: Json
          rescheduled_from_id: string | null
          staff_id: string
          starts_at: string
          tenant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_staff_appointment: {
        Args: {
          p_client_id: string
          p_ends_at: string
          p_items: Json
          p_keep_deposit?: boolean
          p_rescheduled_from_id?: string
          p_segments: Json
          p_staff_id: string
          p_starts_at: string
          p_tenant_id: string
        }
        Returns: {
          balance: number
          cancel_reason: string | null
          client_id: string
          created_at: string
          deposit_paid: number
          deposit_required: number
          ends_at: string
          hold_expires_at: string | null
          id: string
          manage_token_hash: string | null
          rescheduled_from_id: string | null
          source: string
          staff_id: string
          starts_at: string
          status: string
          tenant_id: string
          token: string | null
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_appointment: {
        Args: {
          p_appointment_id: string
          p_cash_session_id?: string
          p_payments: Json
          p_sale_items?: Json
        }
        Returns: {
          balance: number
          cancel_reason: string | null
          client_id: string
          created_at: string
          deposit_paid: number
          deposit_required: number
          ends_at: string
          hold_expires_at: string | null
          id: string
          manage_token_hash: string | null
          rescheduled_from_id: string | null
          source: string
          staff_id: string
          starts_at: string
          status: string
          tenant_id: string
          token: string | null
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_appointment_by_token: { Args: { p_token: string }; Returns: Json }
      get_public_catalog: { Args: { p_tenant_id: string }; Returns: Json }
      get_public_staff: { Args: { p_tenant_id: string }; Returns: Json }
      get_public_staff_for_service: {
        Args: { p_service_id: string; p_tenant_id: string }
        Returns: Json
      }
      get_public_tenant: { Args: { p_slug: string }; Returns: Json }
      has_role: {
        Args: { p_roles: string[]; p_tenant_id: string }
        Returns: boolean
      }
      my_staff_id: { Args: { p_tenant_id: string }; Returns: string }
      onboard_tenant: {
        Args: {
          p_business_hours: Json
          p_business_type_id: string
          p_name: string
          p_slug: string
        }
        Returns: {
          address: string | null
          business_type_id: string
          created_at: string
          currency: string
          id: string
          instagram_url: string | null
          logo_url: string | null
          name: string
          slug: string
          status: string
          timezone: string
          updated_at: string
          whatsapp_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      open_cash_session: {
        Args: { p_opening_amount: number; p_tenant_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          counted_amount: number | null
          created_at: string
          difference: number | null
          difference_reason: string | null
          expected_amount: number | null
          id: string
          opened_at: string
          opened_by: string
          opening_amount: number
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_appointment_deposit: {
        Args: {
          p_amount: number
          p_appointment_id: string
          p_cash_session_id?: string
          p_method: string
        }
        Returns: {
          balance: number
          cancel_reason: string | null
          client_id: string
          created_at: string
          deposit_paid: number
          deposit_required: number
          ends_at: string
          hold_expires_at: string | null
          id: string
          manage_token_hash: string | null
          rescheduled_from_id: string | null
          source: string
          staff_id: string
          starts_at: string
          status: string
          tenant_id: string
          token: string | null
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_appointment: {
        Args: {
          p_appointment_id: string
          p_reason?: string
          p_to_status: string
        }
        Returns: {
          balance: number
          cancel_reason: string | null
          client_id: string
          created_at: string
          deposit_paid: number
          deposit_required: number
          ends_at: string
          hold_expires_at: string | null
          id: string
          manage_token_hash: string | null
          rescheduled_from_id: string | null
          source: string
          staff_id: string
          starts_at: string
          status: string
          tenant_id: string
          token: string | null
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

