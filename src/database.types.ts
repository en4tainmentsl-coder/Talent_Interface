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
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          performed_by: string | null
          record_id: string
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_codes: {
        Row: {
          actual_amount: number | null
          booking_id: string
          client_approval_id: string
          client_user_id: string
          code: string | null
          code_type: Database["public"]["Enums"]["auth_code_types"]
          expires_at: string | null
          generated_at: string | null
          id: string
          is_used: boolean | null
          max_amount: number | null
          notes: string | null
          status: Database["public"]["Enums"]["auth_status"] | null
          used_at: string
          used_in_payment_id: string
        }
        Insert: {
          actual_amount?: number | null
          booking_id: string
          client_approval_id: string
          client_user_id: string
          code?: string | null
          code_type: Database["public"]["Enums"]["auth_code_types"]
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          is_used?: boolean | null
          max_amount?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["auth_status"] | null
          used_at: string
          used_in_payment_id: string
        }
        Update: {
          actual_amount?: number | null
          booking_id?: string
          client_approval_id?: string
          client_user_id?: string
          code?: string | null
          code_type?: Database["public"]["Enums"]["auth_code_types"]
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          is_used?: boolean | null
          max_amount?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["auth_status"] | null
          used_at?: string
          used_in_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "AuthorizationCodes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AuthorizationCodes_client_approval_id_fkey"
            columns: ["client_approval_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AuthorizationCodes_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AuthorizationCodes_used_in_payment_id_fkey"
            columns: ["used_in_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          available_date_end: string | null
          available_date_start: string | null
          blocked_reason:
            | Database["public"]["Enums"]["availability_blocked_reason"]
            | null
          end_time: string | null
          id: string
          is_blocked: boolean
          notes: string | null
          start_time: string
          talent_id: string
        }
        Insert: {
          available_date_end?: string | null
          available_date_start?: string | null
          blocked_reason?:
            | Database["public"]["Enums"]["availability_blocked_reason"]
            | null
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          notes?: string | null
          start_time: string
          talent_id: string
        }
        Update: {
          available_date_end?: string | null
          available_date_start?: string | null
          blocked_reason?:
            | Database["public"]["Enums"]["availability_blocked_reason"]
            | null
          end_time?: string | null
          id?: string
          is_blocked?: boolean
          notes?: string | null
          start_time?: string
          talent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Availability_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          agreed_gross_amount: number
          auto_completed: boolean
          bank_charge_amount: number
          booking_status: Database["public"]["Enums"]["booking_status"]
          client_total_amount: number
          client_user_id: string
          commission_amount: number
          completed_at: string | null
          completed_by_user_id: string | null
          contract_id: string | null
          created_at: string
          currency: string
          deposit_amount: number | null
          ends_at: string
          event_id: string | null
          gateway_fee_amount: number
          id: string
          message_to_talent: string | null
          payment_advanced: boolean
          payment_advanced_at: string | null
          quote_id: string
          sscl_amount: number
          starts_at: string
          talent_id: string
          talent_net_amount: number | null
          vat_amount: number
          venue_id: string | null
        }
        Insert: {
          agreed_gross_amount?: number
          auto_completed?: boolean
          bank_charge_amount?: number
          booking_status?: Database["public"]["Enums"]["booking_status"]
          client_total_amount?: number
          client_user_id: string
          commission_amount?: number
          completed_at?: string | null
          completed_by_user_id?: string | null
          contract_id?: string | null
          created_at?: string
          currency?: string
          deposit_amount?: number | null
          ends_at: string
          event_id?: string | null
          gateway_fee_amount?: number
          id?: string
          message_to_talent?: string | null
          payment_advanced?: boolean
          payment_advanced_at?: string | null
          quote_id: string
          sscl_amount?: number
          starts_at: string
          talent_id: string
          talent_net_amount?: number | null
          vat_amount?: number
          venue_id?: string | null
        }
        Update: {
          agreed_gross_amount?: number
          auto_completed?: boolean
          bank_charge_amount?: number
          booking_status?: Database["public"]["Enums"]["booking_status"]
          client_total_amount?: number
          client_user_id?: string
          commission_amount?: number
          completed_at?: string | null
          completed_by_user_id?: string | null
          contract_id?: string | null
          created_at?: string
          currency?: string
          deposit_amount?: number | null
          ends_at?: string
          event_id?: string | null
          gateway_fee_amount?: number
          id?: string
          message_to_talent?: string | null
          payment_advanced?: boolean
          payment_advanced_at?: string | null
          quote_id?: string
          sscl_amount?: number
          starts_at?: string
          talent_id?: string
          talent_net_amount?: number | null
          vat_amount?: number
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Bookings_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_completed_by_user_id_fkey"
            columns: ["completed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Bookings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Bookings_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "profiles_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      client_approvals: {
        Row: {
          approval_status: string
          approval_type: Database["public"]["Enums"]["client_approval_type"]
          approved_at: string
          approved_by_user_id: string
          available_credit: number
          created_at: string
          credit_limit: number | null
          current_balance: number
          expires_at: string | null
          id: string
          last_reviewed_at: string | null
          notes: string | null
          payment_terms_days: number
          updated_at: string | null
          venue_user_id: string | null
        }
        Insert: {
          approval_status?: string
          approval_type: Database["public"]["Enums"]["client_approval_type"]
          approved_at?: string
          approved_by_user_id: string
          available_credit?: number
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          expires_at?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          payment_terms_days?: number
          updated_at?: string | null
          venue_user_id?: string | null
        }
        Update: {
          approval_status?: string
          approval_type?: Database["public"]["Enums"]["client_approval_type"]
          approved_at?: string
          approved_by_user_id?: string
          available_credit?: number
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          expires_at?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          payment_terms_days?: number
          updated_at?: string | null
          venue_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ClientApprovals_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ClientApprovals_client_user_id_fkey"
            columns: ["venue_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_methods: {
        Row: {
          bank_name: string | null
          card_brand: string | null
          card_expiry_month: number
          card_expiry_year: number
          card_last_4: string | null
          client_id: string
          created_at: string
          display_label: string
          gateway_token: string
          id: string
          is_active: boolean
          is_default: boolean
          method_type: Database["public"]["Enums"]["client_payment_type"]
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month: number
          card_expiry_year: number
          card_last_4?: string | null
          client_id: string
          created_at?: string
          display_label?: string
          gateway_token: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          method_type: Database["public"]["Enums"]["client_payment_type"]
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month?: number
          card_expiry_year?: number
          card_last_4?: string | null
          client_id?: string
          created_at?: string
          display_label?: string
          gateway_token?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          method_type?: Database["public"]["Enums"]["client_payment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Client_Payment_Methods_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          booking_id: string
          content_text: string | null
          created_at: string
          expires_at: string
          id: string
          signed_by_talent_at: string | null
          signed_by_venue_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          storage_path: string | null
          talent_id: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          booking_id: string
          content_text?: string | null
          created_at?: string
          expires_at: string
          id?: string
          signed_by_talent_at?: string | null
          signed_by_venue_at?: string | null
          status: Database["public"]["Enums"]["contract_status"]
          storage_path?: string | null
          talent_id: string
          title?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          booking_id?: string
          content_text?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          signed_by_talent_at?: string | null
          signed_by_venue_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          storage_path?: string | null
          talent_id?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Contracts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Contracts_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Contracts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "profiles_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_access: {
        Row: {
          id: string
          policy: string
          role: string | null
          sort: number | null
          user: string | null
        }
        Insert: {
          id: string
          policy: string
          role?: string | null
          sort?: number | null
          user?: string | null
        }
        Update: {
          id?: string
          policy?: string
          role?: string | null
          sort?: number | null
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_access_policy_foreign"
            columns: ["policy"]
            isOneToOne: false
            referencedRelation: "directus_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_access_role_foreign"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "directus_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_access_user_foreign"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_activity: {
        Row: {
          action: string
          collection: string
          id: number
          ip: string | null
          item: string
          origin: string | null
          timestamp: string
          user: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          collection: string
          id?: number
          ip?: string | null
          item: string
          origin?: string | null
          timestamp?: string
          user?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          collection?: string
          id?: number
          ip?: string | null
          item?: string
          origin?: string | null
          timestamp?: string
          user?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      directus_collections: {
        Row: {
          accountability: string | null
          archive_app_filter: boolean
          archive_field: string | null
          archive_value: string | null
          autosave_revision_interval: number | null
          collapse: string
          collection: string
          color: string | null
          display_template: string | null
          group: string | null
          hidden: boolean
          icon: string | null
          item_duplication_fields: Json | null
          note: string | null
          preview_url: string | null
          singleton: boolean
          sort: number | null
          sort_field: string | null
          status: string
          translations: Json | null
          unarchive_value: string | null
          versioning: boolean
        }
        Insert: {
          accountability?: string | null
          archive_app_filter?: boolean
          archive_field?: string | null
          archive_value?: string | null
          autosave_revision_interval?: number | null
          collapse?: string
          collection: string
          color?: string | null
          display_template?: string | null
          group?: string | null
          hidden?: boolean
          icon?: string | null
          item_duplication_fields?: Json | null
          note?: string | null
          preview_url?: string | null
          singleton?: boolean
          sort?: number | null
          sort_field?: string | null
          status?: string
          translations?: Json | null
          unarchive_value?: string | null
          versioning?: boolean
        }
        Update: {
          accountability?: string | null
          archive_app_filter?: boolean
          archive_field?: string | null
          archive_value?: string | null
          autosave_revision_interval?: number | null
          collapse?: string
          collection?: string
          color?: string | null
          display_template?: string | null
          group?: string | null
          hidden?: boolean
          icon?: string | null
          item_duplication_fields?: Json | null
          note?: string | null
          preview_url?: string | null
          singleton?: boolean
          sort?: number | null
          sort_field?: string | null
          status?: string
          translations?: Json | null
          unarchive_value?: string | null
          versioning?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "directus_collections_group_foreign"
            columns: ["group"]
            isOneToOne: false
            referencedRelation: "directus_collections"
            referencedColumns: ["collection"]
          },
        ]
      }
      directus_comments: {
        Row: {
          collection: string
          comment: string
          date_created: string | null
          date_updated: string | null
          id: string
          item: string
          user_created: string | null
          user_updated: string | null
        }
        Insert: {
          collection: string
          comment: string
          date_created?: string | null
          date_updated?: string | null
          id: string
          item: string
          user_created?: string | null
          user_updated?: string | null
        }
        Update: {
          collection?: string
          comment?: string
          date_created?: string | null
          date_updated?: string | null
          id?: string
          item?: string
          user_created?: string | null
          user_updated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_comments_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_comments_user_updated_foreign"
            columns: ["user_updated"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_dashboards: {
        Row: {
          color: string | null
          date_created: string | null
          icon: string
          id: string
          name: string
          note: string | null
          user_created: string | null
        }
        Insert: {
          color?: string | null
          date_created?: string | null
          icon?: string
          id: string
          name: string
          note?: string | null
          user_created?: string | null
        }
        Update: {
          color?: string | null
          date_created?: string | null
          icon?: string
          id?: string
          name?: string
          note?: string | null
          user_created?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_dashboards_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_deployment_projects: {
        Row: {
          date_created: string | null
          deployable: boolean
          deployment: string
          external_id: string
          framework: string | null
          id: string
          name: string
          url: string | null
          user_created: string | null
        }
        Insert: {
          date_created?: string | null
          deployable?: boolean
          deployment: string
          external_id: string
          framework?: string | null
          id: string
          name: string
          url?: string | null
          user_created?: string | null
        }
        Update: {
          date_created?: string | null
          deployable?: boolean
          deployment?: string
          external_id?: string
          framework?: string | null
          id?: string
          name?: string
          url?: string | null
          user_created?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_deployment_projects_deployment_foreign"
            columns: ["deployment"]
            isOneToOne: false
            referencedRelation: "directus_deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_deployment_projects_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_deployment_runs: {
        Row: {
          completed_at: string | null
          date_created: string | null
          external_id: string
          id: string
          project: string
          started_at: string | null
          status: string | null
          target: string
          url: string | null
          user_created: string | null
        }
        Insert: {
          completed_at?: string | null
          date_created?: string | null
          external_id: string
          id: string
          project: string
          started_at?: string | null
          status?: string | null
          target: string
          url?: string | null
          user_created?: string | null
        }
        Update: {
          completed_at?: string | null
          date_created?: string | null
          external_id?: string
          id?: string
          project?: string
          started_at?: string | null
          status?: string | null
          target?: string
          url?: string | null
          user_created?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_deployment_runs_project_foreign"
            columns: ["project"]
            isOneToOne: false
            referencedRelation: "directus_deployment_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_deployment_runs_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_deployments: {
        Row: {
          credentials: string | null
          date_created: string | null
          id: string
          last_synced_at: string | null
          options: string | null
          provider: string
          user_created: string | null
          webhook_ids: Json | null
          webhook_secret: string | null
        }
        Insert: {
          credentials?: string | null
          date_created?: string | null
          id: string
          last_synced_at?: string | null
          options?: string | null
          provider: string
          user_created?: string | null
          webhook_ids?: Json | null
          webhook_secret?: string | null
        }
        Update: {
          credentials?: string | null
          date_created?: string | null
          id?: string
          last_synced_at?: string | null
          options?: string | null
          provider?: string
          user_created?: string | null
          webhook_ids?: Json | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_deployments_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_extensions: {
        Row: {
          bundle: string | null
          enabled: boolean
          folder: string
          id: string
          source: string
        }
        Insert: {
          bundle?: string | null
          enabled?: boolean
          folder: string
          id: string
          source: string
        }
        Update: {
          bundle?: string | null
          enabled?: boolean
          folder?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      directus_fields: {
        Row: {
          collection: string
          conditions: Json | null
          display: string | null
          display_options: Json | null
          field: string
          group: string | null
          hidden: boolean
          id: number
          interface: string | null
          note: string | null
          options: Json | null
          readonly: boolean
          required: boolean | null
          searchable: boolean
          sort: number | null
          special: string | null
          translations: Json | null
          validation: Json | null
          validation_message: string | null
          width: string | null
        }
        Insert: {
          collection: string
          conditions?: Json | null
          display?: string | null
          display_options?: Json | null
          field: string
          group?: string | null
          hidden?: boolean
          id?: number
          interface?: string | null
          note?: string | null
          options?: Json | null
          readonly?: boolean
          required?: boolean | null
          searchable?: boolean
          sort?: number | null
          special?: string | null
          translations?: Json | null
          validation?: Json | null
          validation_message?: string | null
          width?: string | null
        }
        Update: {
          collection?: string
          conditions?: Json | null
          display?: string | null
          display_options?: Json | null
          field?: string
          group?: string | null
          hidden?: boolean
          id?: number
          interface?: string | null
          note?: string | null
          options?: Json | null
          readonly?: boolean
          required?: boolean | null
          searchable?: boolean
          sort?: number | null
          special?: string | null
          translations?: Json | null
          validation?: Json | null
          validation_message?: string | null
          width?: string | null
        }
        Relationships: []
      }
      directus_files: {
        Row: {
          charset: string | null
          created_on: string
          description: string | null
          duration: number | null
          embed: string | null
          filename_disk: string | null
          filename_download: string
          filesize: number | null
          focal_point_x: number | null
          focal_point_y: number | null
          folder: string | null
          height: number | null
          id: string
          location: string | null
          metadata: Json | null
          modified_by: string | null
          modified_on: string
          storage: string
          tags: string | null
          title: string | null
          tus_data: Json | null
          tus_id: string | null
          type: string | null
          uploaded_by: string | null
          uploaded_on: string | null
          width: number | null
        }
        Insert: {
          charset?: string | null
          created_on?: string
          description?: string | null
          duration?: number | null
          embed?: string | null
          filename_disk?: string | null
          filename_download: string
          filesize?: number | null
          focal_point_x?: number | null
          focal_point_y?: number | null
          folder?: string | null
          height?: number | null
          id: string
          location?: string | null
          metadata?: Json | null
          modified_by?: string | null
          modified_on?: string
          storage: string
          tags?: string | null
          title?: string | null
          tus_data?: Json | null
          tus_id?: string | null
          type?: string | null
          uploaded_by?: string | null
          uploaded_on?: string | null
          width?: number | null
        }
        Update: {
          charset?: string | null
          created_on?: string
          description?: string | null
          duration?: number | null
          embed?: string | null
          filename_disk?: string | null
          filename_download?: string
          filesize?: number | null
          focal_point_x?: number | null
          focal_point_y?: number | null
          folder?: string | null
          height?: number | null
          id?: string
          location?: string | null
          metadata?: Json | null
          modified_by?: string | null
          modified_on?: string
          storage?: string
          tags?: string | null
          title?: string | null
          tus_data?: Json | null
          tus_id?: string | null
          type?: string | null
          uploaded_by?: string | null
          uploaded_on?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_files_folder_foreign"
            columns: ["folder"]
            isOneToOne: false
            referencedRelation: "directus_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_files_modified_by_foreign"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_files_uploaded_by_foreign"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_flows: {
        Row: {
          accountability: string | null
          color: string | null
          date_created: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          operation: string | null
          options: Json | null
          status: string
          trigger: string | null
          user_created: string | null
        }
        Insert: {
          accountability?: string | null
          color?: string | null
          date_created?: string | null
          description?: string | null
          icon?: string | null
          id: string
          name: string
          operation?: string | null
          options?: Json | null
          status?: string
          trigger?: string | null
          user_created?: string | null
        }
        Update: {
          accountability?: string | null
          color?: string | null
          date_created?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          operation?: string | null
          options?: Json | null
          status?: string
          trigger?: string | null
          user_created?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_flows_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_folders: {
        Row: {
          id: string
          name: string
          parent: string | null
        }
        Insert: {
          id: string
          name: string
          parent?: string | null
        }
        Update: {
          id?: string
          name?: string
          parent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_folders_parent_foreign"
            columns: ["parent"]
            isOneToOne: false
            referencedRelation: "directus_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_migrations: {
        Row: {
          name: string
          timestamp: string | null
          version: string
        }
        Insert: {
          name: string
          timestamp?: string | null
          version: string
        }
        Update: {
          name?: string
          timestamp?: string | null
          version?: string
        }
        Relationships: []
      }
      directus_notifications: {
        Row: {
          collection: string | null
          id: number
          item: string | null
          message: string | null
          recipient: string
          sender: string | null
          status: string | null
          subject: string
          timestamp: string | null
        }
        Insert: {
          collection?: string | null
          id?: number
          item?: string | null
          message?: string | null
          recipient: string
          sender?: string | null
          status?: string | null
          subject: string
          timestamp?: string | null
        }
        Update: {
          collection?: string | null
          id?: number
          item?: string | null
          message?: string | null
          recipient?: string
          sender?: string | null
          status?: string | null
          subject?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_notifications_recipient_foreign"
            columns: ["recipient"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_notifications_sender_foreign"
            columns: ["sender"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_oauth_clients: {
        Row: {
          client_id: string
          client_name: string
          client_secret_hash: string | null
          client_uri: string | null
          date_created: string
          grant_types: Json
          logo_uri: string | null
          metadata_etag: string | null
          metadata_expires_at: string | null
          metadata_fetched_at: string | null
          policy_uri: string | null
          redirect_uris: Json
          registration_type: string
          token_endpoint_auth_method: string
          tos_uri: string | null
        }
        Insert: {
          client_id: string
          client_name: string
          client_secret_hash?: string | null
          client_uri?: string | null
          date_created?: string
          grant_types: Json
          logo_uri?: string | null
          metadata_etag?: string | null
          metadata_expires_at?: string | null
          metadata_fetched_at?: string | null
          policy_uri?: string | null
          redirect_uris: Json
          registration_type?: string
          token_endpoint_auth_method?: string
          tos_uri?: string | null
        }
        Update: {
          client_id?: string
          client_name?: string
          client_secret_hash?: string | null
          client_uri?: string | null
          date_created?: string
          grant_types?: Json
          logo_uri?: string | null
          metadata_etag?: string | null
          metadata_expires_at?: string | null
          metadata_fetched_at?: string | null
          policy_uri?: string | null
          redirect_uris?: Json
          registration_type?: string
          token_endpoint_auth_method?: string
          tos_uri?: string | null
        }
        Relationships: []
      }
      directus_oauth_codes: {
        Row: {
          client: string
          code_challenge: string
          code_challenge_method: string
          code_hash: string
          expires_at: string
          id: string
          redirect_uri: string
          resource: string
          scope: string | null
          used_at: string | null
          user: string
        }
        Insert: {
          client: string
          code_challenge: string
          code_challenge_method: string
          code_hash: string
          expires_at: string
          id: string
          redirect_uri: string
          resource: string
          scope?: string | null
          used_at?: string | null
          user: string
        }
        Update: {
          client?: string
          code_challenge?: string
          code_challenge_method?: string
          code_hash?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          resource?: string
          scope?: string | null
          used_at?: string | null
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "directus_oauth_codes_client_foreign"
            columns: ["client"]
            isOneToOne: false
            referencedRelation: "directus_oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "directus_oauth_codes_user_foreign"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_oauth_consents: {
        Row: {
          client: string
          date_created: string
          date_updated: string
          id: string
          redirect_uri: string
          scope: string | null
          user: string
        }
        Insert: {
          client: string
          date_created: string
          date_updated: string
          id: string
          redirect_uri: string
          scope?: string | null
          user: string
        }
        Update: {
          client?: string
          date_created?: string
          date_updated?: string
          id?: string
          redirect_uri?: string
          scope?: string | null
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "directus_oauth_consents_client_foreign"
            columns: ["client"]
            isOneToOne: false
            referencedRelation: "directus_oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "directus_oauth_consents_user_foreign"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_oauth_tokens: {
        Row: {
          client: string
          code_hash: string
          date_created: string
          expires_at: string
          id: string
          previous_session: string | null
          resource: string
          scope: string | null
          session: string
          user: string
        }
        Insert: {
          client: string
          code_hash: string
          date_created: string
          expires_at: string
          id: string
          previous_session?: string | null
          resource: string
          scope?: string | null
          session: string
          user: string
        }
        Update: {
          client?: string
          code_hash?: string
          date_created?: string
          expires_at?: string
          id?: string
          previous_session?: string | null
          resource?: string
          scope?: string | null
          session?: string
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "directus_oauth_tokens_client_foreign"
            columns: ["client"]
            isOneToOne: false
            referencedRelation: "directus_oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "directus_oauth_tokens_user_foreign"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_operations: {
        Row: {
          date_created: string | null
          flow: string
          id: string
          key: string
          name: string | null
          options: Json | null
          position_x: number
          position_y: number
          reject: string | null
          resolve: string | null
          type: string
          user_created: string | null
        }
        Insert: {
          date_created?: string | null
          flow: string
          id: string
          key: string
          name?: string | null
          options?: Json | null
          position_x: number
          position_y: number
          reject?: string | null
          resolve?: string | null
          type: string
          user_created?: string | null
        }
        Update: {
          date_created?: string | null
          flow?: string
          id?: string
          key?: string
          name?: string | null
          options?: Json | null
          position_x?: number
          position_y?: number
          reject?: string | null
          resolve?: string | null
          type?: string
          user_created?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_operations_flow_foreign"
            columns: ["flow"]
            isOneToOne: false
            referencedRelation: "directus_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_operations_reject_foreign"
            columns: ["reject"]
            isOneToOne: true
            referencedRelation: "directus_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_operations_resolve_foreign"
            columns: ["resolve"]
            isOneToOne: true
            referencedRelation: "directus_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_operations_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_panels: {
        Row: {
          color: string | null
          dashboard: string
          date_created: string | null
          height: number
          icon: string | null
          id: string
          name: string | null
          note: string | null
          options: Json | null
          position_x: number
          position_y: number
          show_header: boolean
          type: string
          user_created: string | null
          width: number
        }
        Insert: {
          color?: string | null
          dashboard: string
          date_created?: string | null
          height: number
          icon?: string | null
          id: string
          name?: string | null
          note?: string | null
          options?: Json | null
          position_x: number
          position_y: number
          show_header?: boolean
          type: string
          user_created?: string | null
          width: number
        }
        Update: {
          color?: string | null
          dashboard?: string
          date_created?: string | null
          height?: number
          icon?: string | null
          id?: string
          name?: string | null
          note?: string | null
          options?: Json | null
          position_x?: number
          position_y?: number
          show_header?: boolean
          type?: string
          user_created?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "directus_panels_dashboard_foreign"
            columns: ["dashboard"]
            isOneToOne: false
            referencedRelation: "directus_dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_panels_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_permissions: {
        Row: {
          action: string
          collection: string
          fields: string | null
          id: number
          permissions: Json | null
          policy: string
          presets: Json | null
          validation: Json | null
        }
        Insert: {
          action: string
          collection: string
          fields?: string | null
          id?: number
          permissions?: Json | null
          policy: string
          presets?: Json | null
          validation?: Json | null
        }
        Update: {
          action?: string
          collection?: string
          fields?: string | null
          id?: number
          permissions?: Json | null
          policy?: string
          presets?: Json | null
          validation?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_permissions_policy_foreign"
            columns: ["policy"]
            isOneToOne: false
            referencedRelation: "directus_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_policies: {
        Row: {
          admin_access: boolean
          app_access: boolean
          description: string | null
          enforce_tfa: boolean
          icon: string
          id: string
          ip_access: string | null
          name: string
        }
        Insert: {
          admin_access?: boolean
          app_access?: boolean
          description?: string | null
          enforce_tfa?: boolean
          icon?: string
          id: string
          ip_access?: string | null
          name: string
        }
        Update: {
          admin_access?: boolean
          app_access?: boolean
          description?: string | null
          enforce_tfa?: boolean
          icon?: string
          id?: string
          ip_access?: string | null
          name?: string
        }
        Relationships: []
      }
      directus_presets: {
        Row: {
          bookmark: string | null
          collection: string | null
          color: string | null
          filter: Json | null
          icon: string | null
          id: number
          layout: string | null
          layout_options: Json | null
          layout_query: Json | null
          refresh_interval: number | null
          role: string | null
          search: string | null
          user: string | null
        }
        Insert: {
          bookmark?: string | null
          collection?: string | null
          color?: string | null
          filter?: Json | null
          icon?: string | null
          id?: number
          layout?: string | null
          layout_options?: Json | null
          layout_query?: Json | null
          refresh_interval?: number | null
          role?: string | null
          search?: string | null
          user?: string | null
        }
        Update: {
          bookmark?: string | null
          collection?: string | null
          color?: string | null
          filter?: Json | null
          icon?: string | null
          id?: number
          layout?: string | null
          layout_options?: Json | null
          layout_query?: Json | null
          refresh_interval?: number | null
          role?: string | null
          search?: string | null
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_presets_role_foreign"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "directus_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_presets_user_foreign"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_relations: {
        Row: {
          id: number
          junction_field: string | null
          many_collection: string
          many_field: string
          one_allowed_collections: string | null
          one_collection: string | null
          one_collection_field: string | null
          one_deselect_action: string
          one_field: string | null
          sort_field: string | null
        }
        Insert: {
          id?: number
          junction_field?: string | null
          many_collection: string
          many_field: string
          one_allowed_collections?: string | null
          one_collection?: string | null
          one_collection_field?: string | null
          one_deselect_action?: string
          one_field?: string | null
          sort_field?: string | null
        }
        Update: {
          id?: number
          junction_field?: string | null
          many_collection?: string
          many_field?: string
          one_allowed_collections?: string | null
          one_collection?: string | null
          one_collection_field?: string | null
          one_deselect_action?: string
          one_field?: string | null
          sort_field?: string | null
        }
        Relationships: []
      }
      directus_revisions: {
        Row: {
          activity: number
          collection: string
          data: Json | null
          delta: Json | null
          id: number
          item: string
          parent: number | null
          version: string | null
        }
        Insert: {
          activity: number
          collection: string
          data?: Json | null
          delta?: Json | null
          id?: number
          item: string
          parent?: number | null
          version?: string | null
        }
        Update: {
          activity?: number
          collection?: string
          data?: Json | null
          delta?: Json | null
          id?: number
          item?: string
          parent?: number | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_revisions_activity_foreign"
            columns: ["activity"]
            isOneToOne: false
            referencedRelation: "directus_activity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_revisions_parent_foreign"
            columns: ["parent"]
            isOneToOne: false
            referencedRelation: "directus_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_revisions_version_foreign"
            columns: ["version"]
            isOneToOne: false
            referencedRelation: "directus_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_roles: {
        Row: {
          description: string | null
          icon: string
          id: string
          name: string
          parent: string | null
        }
        Insert: {
          description?: string | null
          icon?: string
          id: string
          name: string
          parent?: string | null
        }
        Update: {
          description?: string | null
          icon?: string
          id?: string
          name?: string
          parent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_roles_parent_foreign"
            columns: ["parent"]
            isOneToOne: false
            referencedRelation: "directus_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_sessions: {
        Row: {
          expires: string
          ip: string | null
          next_token: string | null
          oauth_client: string | null
          origin: string | null
          share: string | null
          token: string
          user: string | null
          user_agent: string | null
        }
        Insert: {
          expires: string
          ip?: string | null
          next_token?: string | null
          oauth_client?: string | null
          origin?: string | null
          share?: string | null
          token: string
          user?: string | null
          user_agent?: string | null
        }
        Update: {
          expires?: string
          ip?: string | null
          next_token?: string | null
          oauth_client?: string | null
          origin?: string | null
          share?: string | null
          token?: string
          user?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_sessions_oauth_client_foreign"
            columns: ["oauth_client"]
            isOneToOne: false
            referencedRelation: "directus_oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "directus_sessions_share_foreign"
            columns: ["share"]
            isOneToOne: false
            referencedRelation: "directus_shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_sessions_user_foreign"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_settings: {
        Row: {
          ai_anthropic_allowed_models: Json | null
          ai_anthropic_api_key: string | null
          ai_google_allowed_models: Json | null
          ai_google_api_key: string | null
          ai_openai_allowed_models: Json | null
          ai_openai_api_key: string | null
          ai_openai_compatible_api_key: string | null
          ai_openai_compatible_base_url: string | null
          ai_openai_compatible_headers: Json | null
          ai_openai_compatible_models: Json | null
          ai_openai_compatible_name: string | null
          ai_system_prompt: string | null
          ai_translation_default_model: string | null
          ai_translation_glossary: Json | null
          ai_translation_style_guide: string | null
          auth_login_attempts: number | null
          auth_password_policy: string | null
          basemaps: Json | null
          collaborative_editing_enabled: boolean
          custom_aspect_ratios: Json | null
          custom_css: string | null
          default_appearance: string
          default_language: string
          default_save_action: string
          default_theme_dark: string | null
          default_theme_light: string | null
          id: number
          license_key: string | null
          license_token: string | null
          mapbox_key: string | null
          mcp_allow_deletes: boolean
          mcp_enabled: boolean
          mcp_oauth_cimd_enabled: boolean
          mcp_oauth_dcr_enabled: boolean
          mcp_oauth_enabled: boolean
          mcp_prompts_collection: string | null
          mcp_system_prompt: string | null
          mcp_system_prompt_enabled: boolean
          module_bar: Json | null
          org_name: string | null
          product_updates: boolean | null
          project_color: string
          project_descriptor: string | null
          project_id: string | null
          project_logo: string | null
          project_name: string
          project_owner: string | null
          project_status: string | null
          project_url: string | null
          project_usage: string | null
          public_background: string | null
          public_favicon: string | null
          public_foreground: string | null
          public_note: string | null
          public_registration: boolean
          public_registration_email_filter: Json | null
          public_registration_role: string | null
          public_registration_verify_email: boolean
          report_bug_url: string | null
          report_error_url: string | null
          report_feature_url: string | null
          storage_asset_presets: Json | null
          storage_asset_transform: string | null
          storage_default_folder: string | null
          theme_dark_overrides: Json | null
          theme_light_overrides: Json | null
          visual_editor_urls: Json | null
        }
        Insert: {
          ai_anthropic_allowed_models?: Json | null
          ai_anthropic_api_key?: string | null
          ai_google_allowed_models?: Json | null
          ai_google_api_key?: string | null
          ai_openai_allowed_models?: Json | null
          ai_openai_api_key?: string | null
          ai_openai_compatible_api_key?: string | null
          ai_openai_compatible_base_url?: string | null
          ai_openai_compatible_headers?: Json | null
          ai_openai_compatible_models?: Json | null
          ai_openai_compatible_name?: string | null
          ai_system_prompt?: string | null
          ai_translation_default_model?: string | null
          ai_translation_glossary?: Json | null
          ai_translation_style_guide?: string | null
          auth_login_attempts?: number | null
          auth_password_policy?: string | null
          basemaps?: Json | null
          collaborative_editing_enabled?: boolean
          custom_aspect_ratios?: Json | null
          custom_css?: string | null
          default_appearance?: string
          default_language?: string
          default_save_action?: string
          default_theme_dark?: string | null
          default_theme_light?: string | null
          id?: number
          license_key?: string | null
          license_token?: string | null
          mapbox_key?: string | null
          mcp_allow_deletes?: boolean
          mcp_enabled?: boolean
          mcp_oauth_cimd_enabled?: boolean
          mcp_oauth_dcr_enabled?: boolean
          mcp_oauth_enabled?: boolean
          mcp_prompts_collection?: string | null
          mcp_system_prompt?: string | null
          mcp_system_prompt_enabled?: boolean
          module_bar?: Json | null
          org_name?: string | null
          product_updates?: boolean | null
          project_color?: string
          project_descriptor?: string | null
          project_id?: string | null
          project_logo?: string | null
          project_name?: string
          project_owner?: string | null
          project_status?: string | null
          project_url?: string | null
          project_usage?: string | null
          public_background?: string | null
          public_favicon?: string | null
          public_foreground?: string | null
          public_note?: string | null
          public_registration?: boolean
          public_registration_email_filter?: Json | null
          public_registration_role?: string | null
          public_registration_verify_email?: boolean
          report_bug_url?: string | null
          report_error_url?: string | null
          report_feature_url?: string | null
          storage_asset_presets?: Json | null
          storage_asset_transform?: string | null
          storage_default_folder?: string | null
          theme_dark_overrides?: Json | null
          theme_light_overrides?: Json | null
          visual_editor_urls?: Json | null
        }
        Update: {
          ai_anthropic_allowed_models?: Json | null
          ai_anthropic_api_key?: string | null
          ai_google_allowed_models?: Json | null
          ai_google_api_key?: string | null
          ai_openai_allowed_models?: Json | null
          ai_openai_api_key?: string | null
          ai_openai_compatible_api_key?: string | null
          ai_openai_compatible_base_url?: string | null
          ai_openai_compatible_headers?: Json | null
          ai_openai_compatible_models?: Json | null
          ai_openai_compatible_name?: string | null
          ai_system_prompt?: string | null
          ai_translation_default_model?: string | null
          ai_translation_glossary?: Json | null
          ai_translation_style_guide?: string | null
          auth_login_attempts?: number | null
          auth_password_policy?: string | null
          basemaps?: Json | null
          collaborative_editing_enabled?: boolean
          custom_aspect_ratios?: Json | null
          custom_css?: string | null
          default_appearance?: string
          default_language?: string
          default_save_action?: string
          default_theme_dark?: string | null
          default_theme_light?: string | null
          id?: number
          license_key?: string | null
          license_token?: string | null
          mapbox_key?: string | null
          mcp_allow_deletes?: boolean
          mcp_enabled?: boolean
          mcp_oauth_cimd_enabled?: boolean
          mcp_oauth_dcr_enabled?: boolean
          mcp_oauth_enabled?: boolean
          mcp_prompts_collection?: string | null
          mcp_system_prompt?: string | null
          mcp_system_prompt_enabled?: boolean
          module_bar?: Json | null
          org_name?: string | null
          product_updates?: boolean | null
          project_color?: string
          project_descriptor?: string | null
          project_id?: string | null
          project_logo?: string | null
          project_name?: string
          project_owner?: string | null
          project_status?: string | null
          project_url?: string | null
          project_usage?: string | null
          public_background?: string | null
          public_favicon?: string | null
          public_foreground?: string | null
          public_note?: string | null
          public_registration?: boolean
          public_registration_email_filter?: Json | null
          public_registration_role?: string | null
          public_registration_verify_email?: boolean
          report_bug_url?: string | null
          report_error_url?: string | null
          report_feature_url?: string | null
          storage_asset_presets?: Json | null
          storage_asset_transform?: string | null
          storage_default_folder?: string | null
          theme_dark_overrides?: Json | null
          theme_light_overrides?: Json | null
          visual_editor_urls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_settings_project_logo_foreign"
            columns: ["project_logo"]
            isOneToOne: false
            referencedRelation: "directus_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_settings_public_background_foreign"
            columns: ["public_background"]
            isOneToOne: false
            referencedRelation: "directus_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_settings_public_favicon_foreign"
            columns: ["public_favicon"]
            isOneToOne: false
            referencedRelation: "directus_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_settings_public_foreground_foreign"
            columns: ["public_foreground"]
            isOneToOne: false
            referencedRelation: "directus_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_settings_public_registration_role_foreign"
            columns: ["public_registration_role"]
            isOneToOne: false
            referencedRelation: "directus_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_settings_storage_default_folder_foreign"
            columns: ["storage_default_folder"]
            isOneToOne: false
            referencedRelation: "directus_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_shares: {
        Row: {
          collection: string
          date_created: string | null
          date_end: string | null
          date_start: string | null
          id: string
          item: string
          max_uses: number | null
          name: string | null
          password: string | null
          role: string | null
          times_used: number | null
          user_created: string | null
        }
        Insert: {
          collection: string
          date_created?: string | null
          date_end?: string | null
          date_start?: string | null
          id: string
          item: string
          max_uses?: number | null
          name?: string | null
          password?: string | null
          role?: string | null
          times_used?: number | null
          user_created?: string | null
        }
        Update: {
          collection?: string
          date_created?: string | null
          date_end?: string | null
          date_start?: string | null
          id?: string
          item?: string
          max_uses?: number | null
          name?: string | null
          password?: string | null
          role?: string | null
          times_used?: number | null
          user_created?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_shares_collection_foreign"
            columns: ["collection"]
            isOneToOne: false
            referencedRelation: "directus_collections"
            referencedColumns: ["collection"]
          },
          {
            foreignKeyName: "directus_shares_role_foreign"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "directus_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_shares_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_translations: {
        Row: {
          id: string
          key: string
          language: string
          value: string
        }
        Insert: {
          id: string
          key: string
          language: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          language?: string
          value?: string
        }
        Relationships: []
      }
      directus_users: {
        Row: {
          appearance: string | null
          auth_data: Json | null
          avatar: string | null
          description: string | null
          email: string | null
          email_notifications: boolean | null
          external_identifier: string | null
          first_name: string | null
          id: string
          language: string | null
          last_access: string | null
          last_name: string | null
          last_page: string | null
          location: string | null
          password: string | null
          provider: string
          role: string | null
          status: string
          tags: Json | null
          text_direction: string
          tfa_secret: string | null
          theme_dark: string | null
          theme_dark_overrides: Json | null
          theme_light: string | null
          theme_light_overrides: Json | null
          title: string | null
          token: string | null
        }
        Insert: {
          appearance?: string | null
          auth_data?: Json | null
          avatar?: string | null
          description?: string | null
          email?: string | null
          email_notifications?: boolean | null
          external_identifier?: string | null
          first_name?: string | null
          id: string
          language?: string | null
          last_access?: string | null
          last_name?: string | null
          last_page?: string | null
          location?: string | null
          password?: string | null
          provider?: string
          role?: string | null
          status?: string
          tags?: Json | null
          text_direction?: string
          tfa_secret?: string | null
          theme_dark?: string | null
          theme_dark_overrides?: Json | null
          theme_light?: string | null
          theme_light_overrides?: Json | null
          title?: string | null
          token?: string | null
        }
        Update: {
          appearance?: string | null
          auth_data?: Json | null
          avatar?: string | null
          description?: string | null
          email?: string | null
          email_notifications?: boolean | null
          external_identifier?: string | null
          first_name?: string | null
          id?: string
          language?: string | null
          last_access?: string | null
          last_name?: string | null
          last_page?: string | null
          location?: string | null
          password?: string | null
          provider?: string
          role?: string | null
          status?: string
          tags?: Json | null
          text_direction?: string
          tfa_secret?: string | null
          theme_dark?: string | null
          theme_dark_overrides?: Json | null
          theme_light?: string | null
          theme_light_overrides?: Json | null
          title?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_users_role_foreign"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "directus_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      directus_versions: {
        Row: {
          collection: string
          date_created: string | null
          date_updated: string | null
          delta: Json | null
          hash: string | null
          id: string
          item: string | null
          key: string
          name: string | null
          user_created: string | null
          user_updated: string | null
        }
        Insert: {
          collection: string
          date_created?: string | null
          date_updated?: string | null
          delta?: Json | null
          hash?: string | null
          id: string
          item?: string | null
          key: string
          name?: string | null
          user_created?: string | null
          user_updated?: string | null
        }
        Update: {
          collection?: string
          date_created?: string | null
          date_updated?: string | null
          delta?: Json | null
          hash?: string | null
          id?: string
          item?: string | null
          key?: string
          name?: string | null
          user_created?: string | null
          user_updated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directus_versions_collection_foreign"
            columns: ["collection"]
            isOneToOne: false
            referencedRelation: "directus_collections"
            referencedColumns: ["collection"]
          },
          {
            foreignKeyName: "directus_versions_user_created_foreign"
            columns: ["user_created"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directus_versions_user_updated_foreign"
            columns: ["user_updated"]
            isOneToOne: false
            referencedRelation: "directus_users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          file_name: string
          file_path: string
          id: string
          related_entity_id: string
          related_entity_type: Database["public"]["Enums"]["related_entity_type"]
          storage_bucket: string
          uploaded_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          related_entity_id: string
          related_entity_type: Database["public"]["Enums"]["related_entity_type"]
          storage_bucket: string
          uploaded_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          related_entity_id?: string
          related_entity_type?: Database["public"]["Enums"]["related_entity_type"]
          storage_bucket?: string
          uploaded_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Documents_related_entity_id_fkey"
            columns: ["related_entity_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          booking_id: string
          budget_max: number
          budget_min: number
          capacity: number
          created_at: string
          currency: string
          description: string
          end_time: string
          event_date: string
          genre_tags: string
          id: string
          is_public: boolean
          start_time: string
          status: Database["public"]["Enums"]["events_status"]
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          booking_id: string
          budget_max: number
          budget_min: number
          capacity: number
          created_at?: string
          currency?: string
          description: string
          end_time: string
          event_date: string
          genre_tags: string
          id?: string
          is_public?: boolean
          start_time: string
          status?: Database["public"]["Enums"]["events_status"]
          title?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          booking_id?: string
          budget_max?: number
          budget_min?: number
          capacity?: number
          created_at?: string
          currency?: string
          description?: string
          end_time?: string
          event_date?: string
          genre_tags?: string
          id?: string
          is_public?: boolean
          start_time?: string
          status?: Database["public"]["Enums"]["events_status"]
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "profiles_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number
          genre_name: string
          icon_url: string | null
          id: string
          is_active: boolean
          is_dinner_ambiance: boolean
          is_high_energy_club: boolean
          is_lobby_safe: boolean
          is_pub_crowd: boolean
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          genre_name: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_dinner_ambiance?: boolean
          is_high_energy_club?: boolean
          is_lobby_safe?: boolean
          is_pub_crowd?: boolean
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number
          genre_name?: string
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_dinner_ambiance?: boolean
          is_high_energy_club?: boolean
          is_lobby_safe?: boolean
          is_pub_crowd?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          booking_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          booking_id: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          booking_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notifications_channel"]
          id: string
          is_read: boolean
          message_preview: string | null
          related_entity_id: string
          sent_at: string | null
          type: Database["public"]["Enums"]["notifications_type"]
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notifications_channel"]
          id?: string
          is_read?: boolean
          message_preview?: string | null
          related_entity_id: string
          sent_at?: string | null
          type: Database["public"]["Enums"]["notifications_type"]
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notifications_channel"]
          id?: string
          is_read?: boolean
          message_preview?: string | null
          related_entity_id?: string
          sent_at?: string | null
          type?: Database["public"]["Enums"]["notifications_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Notifications_related_entity_id_fkey"
            columns: ["related_entity_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          authorization_code: string | null
          authorization_code_expires_at: string | null
          booking_id: string
          commission_portion: number
          currency: string
          gateway_fee: number
          gateway_order_id: string
          gateway_transaction_id: string | null
          gross_amount: number
          id: string
          is_pre_approved: boolean
          net_to_talent: number
          paid_at: string | null
          payer_user_id: string
          payment_flow: Database["public"]["Enums"]["payments_flow"]
          payment_gateway_provider: string
          payment_method: Database["public"]["Enums"]["payments_methods"]
          payment_status: Database["public"]["Enums"]["payments_status"]
          payment_type: Database["public"]["Enums"]["payments_types"]
          platform_revenue: number
          transaction_reference: string | null
        }
        Insert: {
          authorization_code?: string | null
          authorization_code_expires_at?: string | null
          booking_id: string
          commission_portion: number
          currency?: string
          gateway_fee?: number
          gateway_order_id?: string
          gateway_transaction_id?: string | null
          gross_amount: number
          id?: string
          is_pre_approved?: boolean
          net_to_talent: number
          paid_at?: string | null
          payer_user_id?: string
          payment_flow: Database["public"]["Enums"]["payments_flow"]
          payment_gateway_provider: string
          payment_method: Database["public"]["Enums"]["payments_methods"]
          payment_status: Database["public"]["Enums"]["payments_status"]
          payment_type: Database["public"]["Enums"]["payments_types"]
          platform_revenue: number
          transaction_reference?: string | null
        }
        Update: {
          authorization_code?: string | null
          authorization_code_expires_at?: string | null
          booking_id?: string
          commission_portion?: number
          currency?: string
          gateway_fee?: number
          gateway_order_id?: string
          gateway_transaction_id?: string | null
          gross_amount?: number
          id?: string
          is_pre_approved?: boolean
          net_to_talent?: number
          paid_at?: string | null
          payer_user_id?: string
          payment_flow?: Database["public"]["Enums"]["payments_flow"]
          payment_gateway_provider?: string
          payment_method?: Database["public"]["Enums"]["payments_methods"]
          payment_status?: Database["public"]["Enums"]["payments_status"]
          payment_type?: Database["public"]["Enums"]["payments_types"]
          platform_revenue?: number
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_authorization_code_fkey"
            columns: ["authorization_code"]
            isOneToOne: false
            referencedRelation: "authorization_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Payments_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_admin: {
        Row: {
          admin_level: Database["public"]["Enums"]["admin_level"] | null
          created_at: string | null
          department: string | null
          full_name: string
          id: string
          permissions: string | null
          user_id: string
        }
        Insert: {
          admin_level?: Database["public"]["Enums"]["admin_level"] | null
          created_at?: string | null
          department?: string | null
          full_name?: string
          id?: string
          permissions?: string | null
          user_id: string
        }
        Update: {
          admin_level?: Database["public"]["Enums"]["admin_level"] | null
          created_at?: string | null
          department?: string | null
          full_name?: string
          id?: string
          permissions?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Profiles_Admin_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_clients: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_postal_code: number | null
          address_row_1: string | null
          address_row_2: string | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          avatar_public_id: string | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          full_name: string
          id: string
          preferred_genre: string | null
          preferred_language: string | null
          typical_budget_range: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: number | null
          address_row_1?: string | null
          address_row_2?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_public_id?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          preferred_genre?: string | null
          preferred_language?: string | null
          typical_budget_range?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_postal_code?: number | null
          address_row_1?: string | null
          address_row_2?: string | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          avatar_public_id?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          preferred_genre?: string | null
          preferred_language?: string | null
          typical_budget_range?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Profiles_Clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_talent: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"]
          base_latitude: number | null
          base_longitude: number | null
          bio: string | null
          cover_photo_public_id: string | null
          cover_photo_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          en4tainment_profile_id: string | null
          feature_sort_order: number | null
          featured_at: string | null
          featured_by: string | null
          featured_expires_at: string | null
          full_name: string
          id: string
          is_featured: boolean | null
          is_public: boolean
          is_verified: boolean
          languages: string | null
          mobile: string | null
          optional_location_1: string | null
          optional_location_2: string | null
          optional_location_3: string | null
          optional_location_4: string | null
          pricing_per_session: number | null
          pricing_updated_at: string | null
          primary_genre_id: string
          primary_location: string | null
          profile_photo_public_id: string | null
          profile_photo_url: string | null
          profile_status: Database["public"]["Enums"]["talent_status"]
          rating: number | null
          secondary_genre_id: string | null
          short_bio: string | null
          stage_name: string | null
          tertiary_genre_id: string | null
          travel_radius_km: number | null
          type_of_ensemble: string | null
          type_of_performer: Database["public"]["Enums"]["talent_type"]
          updated_at: string
          url_live_performace_video: string | null
          url_trailer_video: string | null
          user_id: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          base_latitude?: number | null
          base_longitude?: number | null
          bio?: string | null
          cover_photo_public_id?: string | null
          cover_photo_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          en4tainment_profile_id?: string | null
          feature_sort_order?: number | null
          featured_at?: string | null
          featured_by?: string | null
          featured_expires_at?: string | null
          full_name?: string
          id?: string
          is_featured?: boolean | null
          is_public?: boolean
          is_verified?: boolean
          languages?: string | null
          mobile?: string | null
          optional_location_1?: string | null
          optional_location_2?: string | null
          optional_location_3?: string | null
          optional_location_4?: string | null
          pricing_per_session?: number | null
          pricing_updated_at?: string | null
          primary_genre_id: string
          primary_location?: string | null
          profile_photo_public_id?: string | null
          profile_photo_url?: string | null
          profile_status?: Database["public"]["Enums"]["talent_status"]
          rating?: number | null
          secondary_genre_id?: string | null
          short_bio?: string | null
          stage_name?: string | null
          tertiary_genre_id?: string | null
          travel_radius_km?: number | null
          type_of_ensemble?: string | null
          type_of_performer?: Database["public"]["Enums"]["talent_type"]
          updated_at?: string
          url_live_performace_video?: string | null
          url_trailer_video?: string | null
          user_id?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"]
          base_latitude?: number | null
          base_longitude?: number | null
          bio?: string | null
          cover_photo_public_id?: string | null
          cover_photo_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          en4tainment_profile_id?: string | null
          feature_sort_order?: number | null
          featured_at?: string | null
          featured_by?: string | null
          featured_expires_at?: string | null
          full_name?: string
          id?: string
          is_featured?: boolean | null
          is_public?: boolean
          is_verified?: boolean
          languages?: string | null
          mobile?: string | null
          optional_location_1?: string | null
          optional_location_2?: string | null
          optional_location_3?: string | null
          optional_location_4?: string | null
          pricing_per_session?: number | null
          pricing_updated_at?: string | null
          primary_genre_id?: string
          primary_location?: string | null
          profile_photo_public_id?: string | null
          profile_photo_url?: string | null
          profile_status?: Database["public"]["Enums"]["talent_status"]
          rating?: number | null
          secondary_genre_id?: string | null
          short_bio?: string | null
          stage_name?: string | null
          tertiary_genre_id?: string | null
          travel_radius_km?: number | null
          type_of_ensemble?: string | null
          type_of_performer?: Database["public"]["Enums"]["talent_type"]
          updated_at?: string
          url_live_performace_video?: string | null
          url_trailer_video?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_talent_primary_genre_id_fkey"
            columns: ["primary_genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_talent_secondary_genre_id_fkey"
            columns: ["secondary_genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_talent_tertiary_genre_id_fkey"
            columns: ["tertiary_genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Profiles_Talent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_users: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          id: string
          last_login_at: string | null
          phone: string
          role: string
          status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id: string
          last_login_at?: string | null
          phone: string
          role?: string
          status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          phone?: string
          role?: string
          status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: []
      }
      profiles_venues: {
        Row: {
          address_city: string
          address_country: string
          address_postal_code: string
          address_row_1: string
          address_row_2: string
          allowed_breaks: number | null
          approval_status: Database["public"]["Enums"]["approval_status"]
          audience_age_range: string | null
          audience_nationality: string | null
          avatar_public_id: string | null
          avatar_url: string | null
          contact_email: string | null
          contact_mobile: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          language_preference: string | null
          latitude: number | null
          location_of_venue: string | null
          longitude: number | null
          meal_details: string | null
          meals_for_talent: boolean | null
          music_genre_preference: string | null
          name_of_location: string
          name_of_venue: string
          performance_days: string | null
          required_time_slot: string | null
          size_of_space: number | null
          time_per_break: number | null
          type_of_occasion: string | null
          updated_at: string | null
          url_google_maps_pin: string | null
          url_venue_photo: string | null
          user_id: string
        }
        Insert: {
          address_city?: string
          address_country?: string
          address_postal_code?: string
          address_row_1?: string
          address_row_2?: string
          allowed_breaks?: number | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          audience_age_range?: string | null
          audience_nationality?: string | null
          avatar_public_id?: string | null
          avatar_url?: string | null
          contact_email?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          language_preference?: string | null
          latitude?: number | null
          location_of_venue?: string | null
          longitude?: number | null
          meal_details?: string | null
          meals_for_talent?: boolean | null
          music_genre_preference?: string | null
          name_of_location?: string
          name_of_venue?: string
          performance_days?: string | null
          required_time_slot?: string | null
          size_of_space?: number | null
          time_per_break?: number | null
          type_of_occasion?: string | null
          updated_at?: string | null
          url_google_maps_pin?: string | null
          url_venue_photo?: string | null
          user_id: string
        }
        Update: {
          address_city?: string
          address_country?: string
          address_postal_code?: string
          address_row_1?: string
          address_row_2?: string
          allowed_breaks?: number | null
          approval_status?: Database["public"]["Enums"]["approval_status"]
          audience_age_range?: string | null
          audience_nationality?: string | null
          avatar_public_id?: string | null
          avatar_url?: string | null
          contact_email?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          language_preference?: string | null
          latitude?: number | null
          location_of_venue?: string | null
          longitude?: number | null
          meal_details?: string | null
          meals_for_talent?: boolean | null
          music_genre_preference?: string | null
          name_of_location?: string
          name_of_venue?: string
          performance_days?: string | null
          required_time_slot?: string | null
          size_of_space?: number | null
          time_per_break?: number | null
          type_of_occasion?: string | null
          updated_at?: string | null
          url_google_maps_pin?: string | null
          url_venue_photo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Profiles_Venues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          client_user_id: string
          created_at: string
          decline_reason:
            | Database["public"]["Enums"]["quote_decline_reason"]
            | null
          duration_hours: number | null
          ends_at: string
          event_address: string | null
          event_latitude: number | null
          event_longitude: number | null
          event_type: Database["public"]["Enums"]["events_type"]
          id: string
          location: string | null
          special_requirements: string | null
          starts_at: string
          status: Database["public"]["Enums"]["quotation_request_status"]
          talent_id: string
          talent_rate_at_request: number | null
          updated_at: string | null
          venue_id: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          client_user_id: string
          created_at?: string
          decline_reason?:
            | Database["public"]["Enums"]["quote_decline_reason"]
            | null
          duration_hours?: number | null
          ends_at: string
          event_address?: string | null
          event_latitude?: number | null
          event_longitude?: number | null
          event_type: Database["public"]["Enums"]["events_type"]
          id?: string
          location?: string | null
          special_requirements?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["quotation_request_status"]
          talent_id: string
          talent_rate_at_request?: number | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          client_user_id?: string
          created_at?: string
          decline_reason?:
            | Database["public"]["Enums"]["quote_decline_reason"]
            | null
          duration_hours?: number | null
          ends_at?: string
          event_address?: string | null
          event_latitude?: number | null
          event_longitude?: number | null
          event_type?: Database["public"]["Enums"]["events_type"]
          id?: string
          location?: string | null
          special_requirements?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["quotation_request_status"]
          talent_id?: string
          talent_rate_at_request?: number | null
          updated_at?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_preferred_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QuoteRequests_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "QuoteRequests_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "profiles_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          commission_amount: number | null
          commission_rate_percent: number
          created_at: string
          equipment_fee: number | null
          equipment_notes: string | null
          equipment_provided_by: Database["public"]["Enums"]["equipment_responsibility"]
          expires_at: string
          id: string
          notes_to_client: string | null
          performer_count: number | null
          quote_request_id: string
          quote_status: Database["public"]["Enums"]["quotation_status"]
          quoted_amount: number
          sent_at: string
          setup_arrival_at: string | null
          talent_id: string
          talent_net_earnings: number | null
          total_client_price: number | null
          travel_fee: number | null
          updated_at: string | null
        }
        Insert: {
          commission_amount?: number | null
          commission_rate_percent?: number
          created_at?: string
          equipment_fee?: number | null
          equipment_notes?: string | null
          equipment_provided_by?: Database["public"]["Enums"]["equipment_responsibility"]
          expires_at: string
          id?: string
          notes_to_client?: string | null
          performer_count?: number | null
          quote_request_id: string
          quote_status?: Database["public"]["Enums"]["quotation_status"]
          quoted_amount: number
          sent_at?: string
          setup_arrival_at?: string | null
          talent_id: string
          talent_net_earnings?: number | null
          total_client_price?: number | null
          travel_fee?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_amount?: number | null
          commission_rate_percent?: number
          created_at?: string
          equipment_fee?: number | null
          equipment_notes?: string | null
          equipment_provided_by?: Database["public"]["Enums"]["equipment_responsibility"]
          expires_at?: string
          id?: string
          notes_to_client?: string | null
          performer_count?: number | null
          quote_request_id?: string
          quote_status?: Database["public"]["Enums"]["quotation_status"]
          quoted_amount?: number
          sent_at?: string
          setup_arrival_at?: string | null
          talent_id?: string
          talent_net_earnings?: number | null
          total_client_price?: number | null
          travel_fee?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Quotes_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Quotes_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_ledger: {
        Row: {
          amount: number
          booking_id: string
          id: string
          recorded_at: string
          revenue_type: Database["public"]["Enums"]["revenue_type"]
        }
        Insert: {
          amount: number
          booking_id: string
          id?: string
          recorded_at?: string
          revenue_type: Database["public"]["Enums"]["revenue_type"]
        }
        Update: {
          amount?: number
          booking_id?: string
          id?: string
          recorded_at?: string
          revenue_type?: Database["public"]["Enums"]["revenue_type"]
        }
        Relationships: [
          {
            foreignKeyName: "RevenueLedger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews_star: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_talent_id: string | null
          reviewee_venue_id: string | null
          reviewer_user_id: string
          would_book_again: boolean
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_talent_id?: string | null
          reviewee_venue_id?: string | null
          reviewer_user_id?: string
          would_book_again: boolean
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_talent_id?: string | null
          reviewee_venue_id?: string | null
          reviewer_user_id?: string
          would_book_again?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "Reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Reviews_reviewee_talent_id_fkey"
            columns: ["reviewee_talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Reviews_reviewee_venue_id_fkey"
            columns: ["reviewee_venue_id"]
            isOneToOne: false
            referencedRelation: "profiles_venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_asset_access_log: {
        Row: {
          accessed_at: string
          accessed_by_user_id: string
          asset_type: string
          id: string
          ip_address: unknown
          object_key: string
          storage_bucket: string
          subject_entity_id: string | null
          subject_talent_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          accessed_by_user_id: string
          asset_type: string
          id?: string
          ip_address?: unknown
          object_key: string
          storage_bucket: string
          subject_entity_id?: string | null
          subject_talent_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          accessed_by_user_id?: string
          asset_type?: string
          id?: string
          ip_address?: unknown
          object_key?: string
          storage_bucket?: string
          subject_entity_id?: string | null
          subject_talent_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          end_date: string | null
          id: string
          monthly_fee: number | null
          plan_type: Database["public"]["Enums"]["subscription_plan"]
          start_date: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Insert: {
          end_date?: string | null
          id?: string
          monthly_fee?: number | null
          plan_type: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Update: {
          end_date?: string | null
          id?: string
          monthly_fee?: number | null
          plan_type?: Database["public"]["Enums"]["subscription_plan"]
          start_date?: string
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_favourites: {
        Row: {
          app_source: string
          created_at: string
          id: string
          notes: string | null
          talent_id: string
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          app_source?: string
          created_at?: string
          id?: string
          notes?: string | null
          talent_id: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          app_source?: string
          created_at?: string
          id?: string
          notes?: string | null
          talent_id?: string
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Reviews_Heart_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Reviews_Heart_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_identity: {
        Row: {
          created_at: string
          id: string
          kyc_deletion_requested_at: string | null
          kyc_legal_hold: boolean
          kyc_retention_expires_at: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          nic_back_public_id: string | null
          nic_back_url: string | null
          nic_front_public_id: string | null
          nic_front_url: string | null
          nic_hash: string | null
          nic_last_four: string | null
          nic_storage_bucket: string | null
          talent_id: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kyc_deletion_requested_at?: string | null
          kyc_legal_hold?: boolean
          kyc_retention_expires_at?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          nic_back_public_id?: string | null
          nic_back_url?: string | null
          nic_front_public_id?: string | null
          nic_front_url?: string | null
          nic_hash?: string | null
          nic_last_four?: string | null
          nic_storage_bucket?: string | null
          talent_id: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kyc_deletion_requested_at?: string | null
          kyc_legal_hold?: boolean
          kyc_retention_expires_at?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          nic_back_public_id?: string | null
          nic_back_url?: string | null
          nic_front_public_id?: string | null
          nic_front_url?: string | null
          nic_hash?: string | null
          nic_last_four?: string | null
          nic_storage_bucket?: string | null
          talent_id?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_identity_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: true
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_identity_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_media: {
        Row: {
          bytes: number | null
          cloudinary_public_id: string
          cloudinary_secure_url: string | null
          created_at: string
          folder: string | null
          format: string | null
          id: string
          is_featured: boolean
          media_type: Database["public"]["Enums"]["talent_media_type"]
          resource_type: Database["public"]["Enums"]["talent_media_resource_type"]
          sort_order: number
          talent_id: string
          title: string | null
        }
        Insert: {
          bytes?: number | null
          cloudinary_public_id?: string
          cloudinary_secure_url?: string | null
          created_at?: string
          folder?: string | null
          format?: string | null
          id?: string
          is_featured?: boolean
          media_type: Database["public"]["Enums"]["talent_media_type"]
          resource_type: Database["public"]["Enums"]["talent_media_resource_type"]
          sort_order?: number
          talent_id: string
          title?: string | null
        }
        Update: {
          bytes?: number | null
          cloudinary_public_id?: string
          cloudinary_secure_url?: string | null
          created_at?: string
          folder?: string | null
          format?: string | null
          id?: string
          is_featured?: boolean
          media_type?: Database["public"]["Enums"]["talent_media_type"]
          resource_type?: Database["public"]["Enums"]["talent_media_resource_type"]
          sort_order?: number
          talent_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Talent_Media_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_payout_accounts: {
        Row: {
          account_display_name: string
          bank_account_last_4: string
          bank_country: string | null
          bank_name: string
          created_at: string
          currency: string | null
          id: string
          is_default: boolean
          is_verified: boolean
          payable_account_id: string
          payable_onboarding_complete: boolean
          talent_id: string
          updated_at: string
        }
        Insert: {
          account_display_name?: string
          bank_account_last_4?: string
          bank_country?: string | null
          bank_name?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_default?: boolean
          is_verified?: boolean
          payable_account_id?: string
          payable_onboarding_complete?: boolean
          talent_id: string
          updated_at?: string
        }
        Update: {
          account_display_name?: string
          bank_account_last_4?: string
          bank_country?: string | null
          bank_name?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_default?: boolean
          is_verified?: boolean
          payable_account_id?: string
          payable_onboarding_complete?: boolean
          talent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Talent_Payout_Accounts_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_payout_transactions: {
        Row: {
          amount: number
          bank_reference: string | null
          booking_id: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          initiated_by: string
          payout_account_id: string
          payout_date: string | null
          status: Database["public"]["Enums"]["payout_status"]
          talent_id: string
        }
        Insert: {
          amount?: number
          bank_reference?: string | null
          booking_id: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          initiated_by: string
          payout_account_id: string
          payout_date?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          talent_id: string
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          booking_id?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          initiated_by?: string
          payout_account_id?: string
          payout_date?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          talent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Talent_Payout_Transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Talent_Payout_Transactions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Talent_Payout_Transactions_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "talent_payout_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Talent_Payout_Transactions_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_profile_sync_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          status: string
          talent_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          status: string
          talent_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          status?: string
          talent_id?: string
        }
        Relationships: []
      }
      talent_profile_view: {
        Row: {
          id: string
          source_page: string | null
          talent_id: string
          viewed_at: string
          viewer_role: Database["public"]["Enums"]["user_role"] | null
          viewer_user_id: string
        }
        Insert: {
          id?: string
          source_page?: string | null
          talent_id: string
          viewed_at?: string
          viewer_role?: Database["public"]["Enums"]["user_role"] | null
          viewer_user_id: string
        }
        Update: {
          id?: string
          source_page?: string | null
          talent_id?: string
          viewed_at?: string
          viewer_role?: Database["public"]["Enums"]["user_role"] | null
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "TalentProfileView_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TalentProfileView_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_users"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_stats: {
        Row: {
          heart_count: number
          rating_average: number | null
          rating_count: number
          rating_sum: number
          talent_id: string
          updated_at: string
        }
        Insert: {
          heart_count?: number
          rating_average?: number | null
          rating_count?: number
          rating_sum?: number
          talent_id: string
          updated_at?: string
        }
        Update: {
          heart_count?: number
          rating_average?: number | null
          rating_count?: number
          rating_sum?: number
          talent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_stats_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: true
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_unavailability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
          talent_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
          talent_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
          talent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_unavailability_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "profiles_talent"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_payment_accounts: {
        Row: {
          account_purpose: Database["public"]["Enums"]["venue_account_purpose"]
          bank_account_last_4: string | null
          bank_name: string | null
          card_brand: string | null
          card_expiry_month: number | null
          card_expiry_year: number | null
          card_last_4: string | null
          created_at: string
          currency: string
          display_label: string
          gateway_token: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_verified: boolean
          payable_account_id: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          account_purpose?: Database["public"]["Enums"]["venue_account_purpose"]
          bank_account_last_4?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_last_4?: string | null
          created_at?: string
          currency?: string
          display_label?: string
          gateway_token?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_verified?: boolean
          payable_account_id?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          account_purpose?: Database["public"]["Enums"]["venue_account_purpose"]
          bank_account_last_4?: string | null
          bank_name?: string | null
          card_brand?: string | null
          card_expiry_month?: number | null
          card_expiry_year?: number | null
          card_last_4?: string | null
          created_at?: string
          currency?: string
          display_label?: string
          gateway_token?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_verified?: boolean
          payable_account_id?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Venue_Payment_Accounts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "profiles_venues"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events_seen: {
        Row: {
          event_key: string
          id: string
          payload_hash: string | null
          processed_at: string
          provider: string
        }
        Insert: {
          event_key: string
          id?: string
          payload_hash?: string | null
          processed_at?: string
          provider: string
        }
        Update: {
          event_key?: string
          id?: string
          payload_hash?: string | null
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_talent_rating_delta: {
        Args: {
          p_count_delta: number
          p_sum_delta: number
          p_talent_id: string
        }
        Returns: undefined
      }
      check_talent_rating_drift: {
        Args: never
        Returns: {
          actual_average: number
          actual_count: number
          actual_sum: number
          stored_average: number
          stored_count: number
          stored_sum: number
          talent_id: string
        }[]
      }
      distance_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      get_my_role: { Args: never; Returns: string }
      get_nic_hmac_key: { Args: never; Returns: string }
      get_webhook_secret: { Args: never; Returns: string }
      is_18_or_over: { Args: { dob: string }; Returns: boolean }
      is_talent_available: {
        Args: {
          p_buffer?: string
          p_ends_at: string
          p_starts_at: string
          p_talent_id: string
        }
        Returns: boolean
      }
      quote_talent_matches_request: {
        Args: { q_request_id: string; q_talent_id: string }
        Returns: boolean
      }
      recompute_talent_rating_stats: {
        Args: { p_talent_id?: string }
        Returns: number
      }
    }
    Enums: {
      admin_level:
        | "super_admin"
        | "manager"
        | "partner"
        | "support"
        | "executive"
      approval_status: "draft" | "pending_approval" | "approved" | "rejected"
      audit_action:
        | "insert"
        | "update"
        | "delete"
        | "login"
        | "approve"
        | "reject"
      auth_code_types:
        | "deposit"
        | "full_payment"
        | "credit_draw"
        | "refund_credit"
      auth_status: "active" | "used" | "expired" | "cancelled"
      availability_blocked_reason:
        | "booking"
        | "personal"
        | "holiday"
        | "travel"
        | "other"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "disputed"
      client_approval_type:
        | "credit_card"
        | "deferred_payment"
        | "corporate_account"
      client_payment_type:
        | "card"
        | "bank_transfer"
        | "authorization_code"
        | "corporate_account"
      contract_status:
        | "draft"
        | "sent"
        | "signed_by_talent"
        | "signed_by_venue"
        | "fully_signed"
        | "void"
      equipment_responsibility: "talent" | "venue" | "shared"
      events_status:
        | "draft"
        | "published"
        | "booked"
        | "cancelled"
        | "completed"
      events_type:
        | "wedding"
        | "corporate"
        | "birthday"
        | "concert"
        | "private"
        | "dinner_service"
        | "lunch_service"
        | "other"
      kyc_status: "pending" | "submitted" | "verified" | "rejected"
      notifications_channel: "push" | "email" | "sms" | "in_app"
      notifications_type:
        | "booking_confirmed"
        | "booking_cancelled"
        | "booking_completed"
        | "booking_pending"
        | "quote_received"
        | "quote_accepted"
        | "quote_rejected"
        | "payment_received"
        | "payout_processed"
        | "payout_failed"
        | "star_review_received"
        | "heart_review_received"
        | "message_received"
        | "kyc_approved"
        | "kyc_rejected"
        | "contract_signed"
        | "system_alert"
      payments_flow: "immediate" | "deferred" | "escrow"
      payments_methods:
        | "card"
        | "bank_transfer"
        | "payhere"
        | "authorization_code"
      payments_status:
        | "pending"
        | "completed"
        | "failed"
        | "refunded"
        | "disputed"
      payments_types: "deposit" | "balance" | "refund" | "adjustment"
      payout_schedule: "daily" | "weekly" | "monthly" | "manual"
      payout_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "reversed"
      quotation_request_status:
        | "open"
        | "matched"
        | "expired"
        | "cancelled"
        | "converted"
        | "declined"
      quotation_status: "pending" | "accepted" | "rejected" | "expired"
      quote_decline_reason:
        | "schedule_conflict"
        | "outside_service_area"
        | "event_type_mismatch"
        | "other"
      related_entity_type:
        | "talent"
        | "booking"
        | "contract"
        | "venue"
        | "payment"
      revenue_type:
        | "commission"
        | "subscription"
        | "advert"
        | "adjustment"
        | "other"
      subscription_plan: "free" | "basic" | "pro" | "agency"
      subscription_status:
        | "active"
        | "cancelled"
        | "expired"
        | "trialing"
        | "paused"
      talent_media_resource_type: "image" | "video" | "raw" | "audio"
      talent_media_type:
        | "profile_photo"
        | "gallery"
        | "trailer"
        | "live_performance"
        | "press_kit"
        | "document"
      talent_status: "pending" | "active" | "suspended" | "inactive"
      talent_type: "solo" | "duo" | "3-piece" | "full band" | "dj"
      user_role: "client" | "venue" | "talent" | "admin"
      user_status: "active" | "suspended" | "banned" | "pending"
      venue_account_purpose: "payment" | "payout"
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
      admin_level: [
        "super_admin",
        "manager",
        "partner",
        "support",
        "executive",
      ],
      approval_status: ["draft", "pending_approval", "approved", "rejected"],
      audit_action: [
        "insert",
        "update",
        "delete",
        "login",
        "approve",
        "reject",
      ],
      auth_code_types: [
        "deposit",
        "full_payment",
        "credit_draw",
        "refund_credit",
      ],
      auth_status: ["active", "used", "expired", "cancelled"],
      availability_blocked_reason: [
        "booking",
        "personal",
        "holiday",
        "travel",
        "other",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "disputed",
      ],
      client_approval_type: [
        "credit_card",
        "deferred_payment",
        "corporate_account",
      ],
      client_payment_type: [
        "card",
        "bank_transfer",
        "authorization_code",
        "corporate_account",
      ],
      contract_status: [
        "draft",
        "sent",
        "signed_by_talent",
        "signed_by_venue",
        "fully_signed",
        "void",
      ],
      equipment_responsibility: ["talent", "venue", "shared"],
      events_status: ["draft", "published", "booked", "cancelled", "completed"],
      events_type: [
        "wedding",
        "corporate",
        "birthday",
        "concert",
        "private",
        "dinner_service",
        "lunch_service",
        "other",
      ],
      kyc_status: ["pending", "submitted", "verified", "rejected"],
      notifications_channel: ["push", "email", "sms", "in_app"],
      notifications_type: [
        "booking_confirmed",
        "booking_cancelled",
        "booking_completed",
        "booking_pending",
        "quote_received",
        "quote_accepted",
        "quote_rejected",
        "payment_received",
        "payout_processed",
        "payout_failed",
        "star_review_received",
        "heart_review_received",
        "message_received",
        "kyc_approved",
        "kyc_rejected",
        "contract_signed",
        "system_alert",
      ],
      payments_flow: ["immediate", "deferred", "escrow"],
      payments_methods: [
        "card",
        "bank_transfer",
        "payhere",
        "authorization_code",
      ],
      payments_status: [
        "pending",
        "completed",
        "failed",
        "refunded",
        "disputed",
      ],
      payments_types: ["deposit", "balance", "refund", "adjustment"],
      payout_schedule: ["daily", "weekly", "monthly", "manual"],
      payout_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "reversed",
      ],
      quotation_request_status: [
        "open",
        "matched",
        "expired",
        "cancelled",
        "converted",
        "declined",
      ],
      quotation_status: ["pending", "accepted", "rejected", "expired"],
      quote_decline_reason: [
        "schedule_conflict",
        "outside_service_area",
        "event_type_mismatch",
        "other",
      ],
      related_entity_type: [
        "talent",
        "booking",
        "contract",
        "venue",
        "payment",
      ],
      revenue_type: [
        "commission",
        "subscription",
        "advert",
        "adjustment",
        "other",
      ],
      subscription_plan: ["free", "basic", "pro", "agency"],
      subscription_status: [
        "active",
        "cancelled",
        "expired",
        "trialing",
        "paused",
      ],
      talent_media_resource_type: ["image", "video", "raw", "audio"],
      talent_media_type: [
        "profile_photo",
        "gallery",
        "trailer",
        "live_performance",
        "press_kit",
        "document",
      ],
      talent_status: ["pending", "active", "suspended", "inactive"],
      talent_type: ["solo", "duo", "3-piece", "full band", "dj"],
      user_role: ["client", "venue", "talent", "admin"],
      user_status: ["active", "suspended", "banned", "pending"],
      venue_account_purpose: ["payment", "payout"],
    },
  },
} as const
