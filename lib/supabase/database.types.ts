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
      accounts: {
        Row: {
          account_identifier: string | null
          account_type: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          family_id: string
          id: string
          institution: string
          is_demo: boolean
          metadata: Json
          opening_balance: number
          opening_balance_date: string | null
          owner_person_id: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_identifier?: string | null
          account_type: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          family_id: string
          id?: string
          institution: string
          is_demo?: boolean
          metadata?: Json
          opening_balance?: number
          opening_balance_date?: string | null
          owner_person_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_identifier?: string | null
          account_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          family_id?: string
          id?: string
          institution?: string
          is_demo?: boolean
          metadata?: Json
          opening_balance?: number
          opening_balance_date?: string | null
          owner_person_id?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_owner_family_fkey"
            columns: ["owner_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "accounts_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          family_id: string
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          family_id: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          family_id?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["record_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      card_invoices: {
        Row: {
          card_id: string
          closed_amount: number | null
          closing_date: string | null
          competence: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_id: string | null
          due_date: string
          expected_amount: number
          family_id: string
          id: string
          notes: string | null
          paid_amount: number | null
          payment_account_id: string | null
          payment_date: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          card_id: string
          closed_amount?: number | null
          closing_date?: string | null
          competence: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id?: string | null
          due_date: string
          expected_amount?: number
          family_id: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          payment_account_id?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          card_id?: string
          closed_amount?: number | null
          closing_date?: string | null
          competence?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_id?: string | null
          due_date?: string
          expected_amount?: number
          family_id?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          payment_account_id?: string | null
          payment_date?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_invoices_account_family_fkey"
            columns: ["payment_account_id", "family_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "card_invoices_card_family_fkey"
            columns: ["card_id", "family_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "card_invoices_document_family_fkey"
            columns: ["document_id", "family_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "card_invoices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          active: boolean
          best_purchase_day: number | null
          brand: string | null
          closing_day: number | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          deleted_at: string | null
          due_day: number | null
          family_id: string
          holder_person_id: string | null
          id: string
          institution: string
          is_demo: boolean
          last_four: string | null
          metadata: Json
          name: string
          payment_account_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          best_purchase_day?: number | null
          brand?: string | null
          closing_day?: number | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          deleted_at?: string | null
          due_day?: number | null
          family_id: string
          holder_person_id?: string | null
          id?: string
          institution: string
          is_demo?: boolean
          last_four?: string | null
          metadata?: Json
          name: string
          payment_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          best_purchase_day?: number | null
          brand?: string | null
          closing_day?: number | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          deleted_at?: string | null
          due_day?: number | null
          family_id?: string
          holder_person_id?: string | null
          id?: string
          institution?: string
          is_demo?: boolean
          last_four?: string | null
          metadata?: Json
          name?: string
          payment_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_account_family_fkey"
            columns: ["payment_account_id", "family_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "credit_cards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_holder_family_fkey"
            columns: ["holder_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      doctors: {
        Row: {
          address: string | null
          clinic: string | null
          created_at: string
          doctor_name: string
          email: string | null
          family_id: string
          id: string
          notes: string | null
          patient_person_id: string | null
          phone: string | null
          specialty: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          clinic?: string | null
          created_at?: string
          doctor_name: string
          email?: string | null
          family_id: string
          id?: string
          notes?: string | null
          patient_person_id?: string | null
          phone?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          clinic?: string | null
          created_at?: string
          doctor_name?: string
          email?: string | null
          family_id?: string
          id?: string
          notes?: string | null
          patient_person_id?: string | null
          phone?: string | null
          specialty?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_patient_family_fkey"
            columns: ["patient_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "doctors_patient_person_id_fkey"
            columns: ["patient_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      document_metadata: {
        Row: {
          confidence_by_field: Json
          created_at: string
          document_id: string
          extracted_text: string | null
          family_id: string
          id: string
          interpreted_fields: Json
          needs_review: boolean
          overall_confidence: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
        }
        Insert: {
          confidence_by_field?: Json
          created_at?: string
          document_id: string
          extracted_text?: string | null
          family_id: string
          id?: string
          interpreted_fields?: Json
          needs_review?: boolean
          overall_confidence?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Update: {
          confidence_by_field?: Json
          created_at?: string
          document_id?: string
          extracted_text?: string | null
          family_id?: string
          id?: string
          interpreted_fields?: Json
          needs_review?: boolean
          overall_confidence?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_metadata_document_family_fkey"
            columns: ["document_id", "family_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "document_metadata_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: true
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_metadata_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      document_ocr_jobs: {
        Row: {
          confidence: number | null
          created_at: string
          document_id: string
          duration_ms: number | null
          error_message: string | null
          extracted_text: string | null
          family_id: string
          finished_at: string | null
          id: string
          provider: string
          started_at: string | null
          status: string
          suggestion_json: Json | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          document_id: string
          duration_ms?: number | null
          error_message?: string | null
          extracted_text?: string | null
          family_id: string
          finished_at?: string | null
          id?: string
          provider: string
          started_at?: string | null
          status?: string
          suggestion_json?: Json | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          document_id?: string
          duration_ms?: number | null
          error_message?: string | null
          extracted_text?: string | null
          family_id?: string
          finished_at?: string | null
          id?: string
          provider?: string
          started_at?: string | null
          status?: string
          suggestion_json?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_ocr_jobs_document_family_fkey"
            columns: ["document_id", "family_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "document_ocr_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_ocr_jobs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          family_id: string
          file_hash_sha256: string
          file_name: string | null
          id: string
          is_current: boolean
          mime_type: string | null
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          document_id: string
          family_id: string
          file_hash_sha256: string
          file_name?: string | null
          id?: string
          is_current?: boolean
          mime_type?: string | null
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          document_id?: string
          family_id?: string
          file_hash_sha256?: string
          file_name?: string | null
          id?: string
          is_current?: boolean
          mime_type?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_family_fkey"
            columns: ["document_id", "family_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_provider: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          document_number: string | null
          document_type: string
          expiration_date: string | null
          family_id: string
          file_name: string | null
          id: string
          is_current: boolean
          issue_date: string | null
          issuing_authority: string | null
          last_ocr_at: string | null
          last_ocr_error: string | null
          metadata: Json
          mime_type: string | null
          ocr_confidence: number | null
          ocr_provider: string | null
          owner_person_id: string | null
          processing_status: string
          property_id: string | null
          review_required: boolean
          status: Database["public"]["Enums"]["record_status"]
          storage_path: string
          storage_provider: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          ai_provider?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_number?: string | null
          document_type: string
          expiration_date?: string | null
          family_id: string
          file_name?: string | null
          id?: string
          is_current?: boolean
          issue_date?: string | null
          issuing_authority?: string | null
          last_ocr_at?: string | null
          last_ocr_error?: string | null
          metadata?: Json
          mime_type?: string | null
          ocr_confidence?: number | null
          ocr_provider?: string | null
          owner_person_id?: string | null
          processing_status?: string
          property_id?: string | null
          review_required?: boolean
          status?: Database["public"]["Enums"]["record_status"]
          storage_path: string
          storage_provider?: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          ai_provider?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          document_number?: string | null
          document_type?: string
          expiration_date?: string | null
          family_id?: string
          file_name?: string | null
          id?: string
          is_current?: boolean
          issue_date?: string | null
          issuing_authority?: string | null
          last_ocr_at?: string | null
          last_ocr_error?: string | null
          metadata?: Json
          mime_type?: string | null
          ocr_confidence?: number | null
          ocr_provider?: string | null
          owner_person_id?: string | null
          processing_status?: string
          property_id?: string | null
          review_required?: boolean
          status?: Database["public"]["Enums"]["record_status"]
          storage_path?: string
          storage_provider?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_family_fkey"
            columns: ["owner_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "documents_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_family_fkey"
            columns: ["property_id", "family_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      entity_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          metadata: Json
          relationship_type: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          family_id: string
          id?: string
          metadata?: Json
          relationship_type: string
          source_id: string
          source_type: string
          target_id: string
          target_type: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          metadata?: Json
          relationship_type?: string
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_relationships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          affected_entity_id: string | null
          affected_entity_type: string
          automation_status: Database["public"]["Enums"]["automation_status"]
          created_at: string
          created_by: string | null
          event_type: string
          evidence_document_id: string | null
          family_id: string
          id: string
          new_state: Json | null
          occurred_at: string
          previous_state: Json | null
          priority: Database["public"]["Enums"]["alert_severity"]
          related_person_id: string | null
          responsible_person_id: string | null
          source: string
          updated_by: string | null
        }
        Insert: {
          affected_entity_id?: string | null
          affected_entity_type: string
          automation_status?: Database["public"]["Enums"]["automation_status"]
          created_at?: string
          created_by?: string | null
          event_type: string
          evidence_document_id?: string | null
          family_id: string
          id?: string
          new_state?: Json | null
          occurred_at?: string
          previous_state?: Json | null
          priority?: Database["public"]["Enums"]["alert_severity"]
          related_person_id?: string | null
          responsible_person_id?: string | null
          source: string
          updated_by?: string | null
        }
        Update: {
          affected_entity_id?: string | null
          affected_entity_type?: string
          automation_status?: Database["public"]["Enums"]["automation_status"]
          created_at?: string
          created_by?: string | null
          event_type?: string
          evidence_document_id?: string | null
          family_id?: string
          id?: string
          new_state?: Json | null
          occurred_at?: string
          previous_state?: Json | null
          priority?: Database["public"]["Enums"]["alert_severity"]
          related_person_id?: string | null
          responsible_person_id?: string | null
          source?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          due_date: string
          expected_amount: number
          family_id: string
          id: string
          metadata: Json
          nature: string | null
          recurrence_id: string | null
          responsible_person_id: string | null
          status: Database["public"]["Enums"]["operational_status"]
          supplier_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description: string
          due_date: string
          expected_amount: number
          family_id: string
          id?: string
          metadata?: Json
          nature?: string | null
          recurrence_id?: string | null
          responsible_person_id?: string | null
          status?: Database["public"]["Enums"]["operational_status"]
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          due_date?: string
          expected_amount?: number
          family_id?: string
          id?: string
          metadata?: Json
          nature?: string | null
          recurrence_id?: string | null
          responsible_person_id?: string | null
          status?: Database["public"]["Enums"]["operational_status"]
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      family_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["family_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          family_id: string
          id?: string
          invited_by: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          created_at: string
          family_id: string
          id: string
          invited_by: string | null
          joined_at: string | null
          person_id: string | null
          role: Database["public"]["Enums"]["family_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          person_id?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          person_id?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      family_tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          family_id: string
          id: string
          priority: string
          related_document_id: string | null
          related_legal_case_id: string | null
          related_person_id: string | null
          related_property_id: string | null
          responsible_person_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          family_id: string
          id?: string
          priority?: string
          related_document_id?: string | null
          related_legal_case_id?: string | null
          related_person_id?: string | null
          related_property_id?: string | null
          responsible_person_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          family_id?: string
          id?: string
          priority?: string
          related_document_id?: string | null
          related_legal_case_id?: string | null
          related_person_id?: string | null
          related_property_id?: string | null
          responsible_person_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tasks_related_document_family_fkey"
            columns: ["related_document_id", "family_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "family_tasks_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tasks_related_legal_case_family_fkey"
            columns: ["related_legal_case_id", "family_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "family_tasks_related_legal_case_id_fkey"
            columns: ["related_legal_case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tasks_related_person_family_fkey"
            columns: ["related_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "family_tasks_related_person_id_fkey"
            columns: ["related_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tasks_related_property_family_fkey"
            columns: ["related_property_id", "family_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "family_tasks_related_property_id_fkey"
            columns: ["related_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_tasks_responsible_family_fkey"
            columns: ["responsible_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "family_tasks_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_alert_rules: {
        Row: {
          active: boolean
          configuration: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          family_id: string
          id: string
          name: string
          rule_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          configuration?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id: string
          id?: string
          name: string
          rule_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          configuration?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id?: string
          id?: string
          name?: string
          rule_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_alert_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          active: boolean
          category_type: string
          color: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          family_id: string
          icon: string | null
          id: string
          is_demo: boolean
          name: string
          parent_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          category_type: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id: string
          icon?: string | null
          id?: string
          is_demo?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          category_type?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id?: string
          icon?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_family_fkey"
            columns: ["parent_id", "family_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          account_id: string | null
          actual_amount: number | null
          card_id: string | null
          card_invoice_id: string | null
          cash_direction: string
          category_id: string | null
          competence: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          difference_amount: number | null
          document_id: string | null
          due_date: string | null
          economic_owner_person_id: string | null
          effective_date: string | null
          entry_type: string
          expected_amount: number
          expected_date: string | null
          family_id: string
          id: string
          installment_count: number | null
          installment_number: number | null
          installment_purchase_id: string | null
          investment_asset_id: string | null
          is_demo: boolean
          lease_contract_id: string | null
          metadata: Json
          notes: string | null
          origin: string
          parent_entry_id: string | null
          property_id: string | null
          property_unit_id: string | null
          purchase_kind: string | null
          recurrence_id: string | null
          responsible_person_id: string | null
          reversal_of_entry_id: string | null
          source_key: string | null
          status: string
          transfer_group_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          actual_amount?: number | null
          card_id?: string | null
          card_invoice_id?: string | null
          cash_direction: string
          category_id?: string | null
          competence: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          difference_amount?: number | null
          document_id?: string | null
          due_date?: string | null
          economic_owner_person_id?: string | null
          effective_date?: string | null
          entry_type: string
          expected_amount: number
          expected_date?: string | null
          family_id: string
          id?: string
          installment_count?: number | null
          installment_number?: number | null
          installment_purchase_id?: string | null
          investment_asset_id?: string | null
          is_demo?: boolean
          lease_contract_id?: string | null
          metadata?: Json
          notes?: string | null
          origin?: string
          parent_entry_id?: string | null
          property_id?: string | null
          property_unit_id?: string | null
          purchase_kind?: string | null
          recurrence_id?: string | null
          responsible_person_id?: string | null
          reversal_of_entry_id?: string | null
          source_key?: string | null
          status?: string
          transfer_group_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          actual_amount?: number | null
          card_id?: string | null
          card_invoice_id?: string | null
          cash_direction?: string
          category_id?: string | null
          competence?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          difference_amount?: number | null
          document_id?: string | null
          due_date?: string | null
          economic_owner_person_id?: string | null
          effective_date?: string | null
          entry_type?: string
          expected_amount?: number
          expected_date?: string | null
          family_id?: string
          id?: string
          installment_count?: number | null
          installment_number?: number | null
          installment_purchase_id?: string | null
          investment_asset_id?: string | null
          is_demo?: boolean
          lease_contract_id?: string | null
          metadata?: Json
          notes?: string | null
          origin?: string
          parent_entry_id?: string | null
          property_id?: string | null
          property_unit_id?: string | null
          purchase_kind?: string | null
          recurrence_id?: string | null
          responsible_person_id?: string | null
          reversal_of_entry_id?: string | null
          source_key?: string | null
          status?: string
          transfer_group_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_account_family_fkey"
            columns: ["account_id", "family_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_asset_family_fkey"
            columns: ["investment_asset_id", "family_id"]
            isOneToOne: false
            referencedRelation: "investment_assets"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_card_family_fkey"
            columns: ["card_id", "family_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_category_family_fkey"
            columns: ["category_id", "family_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_document_family_fkey"
            columns: ["document_id", "family_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_invoice_family_fkey"
            columns: ["card_invoice_id", "family_id"]
            isOneToOne: false
            referencedRelation: "card_invoices"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_lease_family_fkey"
            columns: ["lease_contract_id", "family_id"]
            isOneToOne: false
            referencedRelation: "lease_contracts"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_owner_family_fkey"
            columns: ["economic_owner_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_parent_family_fkey"
            columns: ["parent_entry_id", "family_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_property_family_fkey"
            columns: ["property_id", "family_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_purchase_family_fkey"
            columns: ["installment_purchase_id", "family_id"]
            isOneToOne: false
            referencedRelation: "installment_purchases"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_recurrence_family_fkey"
            columns: ["recurrence_id", "family_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_responsible_family_fkey"
            columns: ["responsible_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_reversal_family_fkey"
            columns: ["reversal_of_entry_id", "family_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "financial_entries_unit_family_fkey"
            columns: ["property_unit_id", "family_id"]
            isOneToOne: false
            referencedRelation: "property_units"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      financial_entry_history: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string | null
          family_id: string
          financial_entry_id: string
          id: string
          new_state: Json | null
          previous_state: Json | null
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by?: string | null
          family_id: string
          financial_entry_id: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string | null
          family_id?: string
          financial_entry_id?: string
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entry_history_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      health_exams: {
        Row: {
          category: string | null
          created_at: string
          due_date: string | null
          exam_name: string
          family_id: string
          file_name: string | null
          file_path: string | null
          id: string
          mime_type: string | null
          next_date: string | null
          notes: string | null
          performed_date: string | null
          periodicity: string | null
          person_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          due_date?: string | null
          exam_name: string
          family_id: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          next_date?: string | null
          notes?: string | null
          performed_date?: string | null
          periodicity?: string | null
          person_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          due_date?: string | null
          exam_name?: string
          family_id?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          mime_type?: string | null
          next_date?: string | null
          notes?: string | null
          performed_date?: string | null
          periodicity?: string | null
          person_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_exams_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_exams_person_family_fkey"
            columns: ["person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "health_exams_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_purchases: {
        Row: {
          card_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          family_id: string
          first_competence: string
          id: string
          installment_count: number
          is_demo: boolean
          purchase_date: string | null
          responsible_person_id: string | null
          status: string
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description: string
          family_id: string
          first_competence: string
          id?: string
          installment_count: number
          is_demo?: boolean
          purchase_date?: string | null
          responsible_person_id?: string | null
          status?: string
          total_amount: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          family_id?: string
          first_competence?: string
          id?: string
          installment_count?: number
          is_demo?: boolean
          purchase_date?: string | null
          responsible_person_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_purchases_card_family_fkey"
            columns: ["card_id", "family_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "installment_purchases_category_family_fkey"
            columns: ["category_id", "family_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "installment_purchases_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_purchases_person_family_fkey"
            columns: ["responsible_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      investment_assets: {
        Row: {
          account_id: string | null
          active: boolean
          asset_type: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          family_id: string
          id: string
          institution: string
          is_demo: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          asset_type: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          family_id: string
          id?: string
          institution: string
          is_demo?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          active?: boolean
          asset_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          family_id?: string
          id?: string
          institution?: string
          is_demo?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_assets_account_family_fkey"
            columns: ["account_id", "family_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "investment_assets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_positions: {
        Row: {
          asset_id: string
          cost_amount: number | null
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          market_value: number
          position_date: string
          quantity: number | null
          unit_price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          asset_id: string
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          family_id: string
          id?: string
          market_value: number
          position_date: string
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          asset_id?: string
          cost_amount?: number | null
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          market_value?: number
          position_date?: string
          quantity?: number | null
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_positions_asset_family_fkey"
            columns: ["asset_id", "family_id"]
            isOneToOne: false
            referencedRelation: "investment_assets"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "investment_positions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_contracts: {
        Row: {
          adjustment_frequency_months: number | null
          adjustment_index: string | null
          base_rent: number
          charges_amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          family_id: string
          guarantee_type: string | null
          id: string
          is_demo: boolean
          next_adjustment_date: string | null
          notes: string | null
          principal_owner_person_id: string | null
          property_id: string
          start_date: string
          status: string
          tenant_person_id: string | null
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjustment_frequency_months?: number | null
          adjustment_index?: string | null
          base_rent: number
          charges_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          family_id: string
          guarantee_type?: string | null
          id?: string
          is_demo?: boolean
          next_adjustment_date?: string | null
          notes?: string | null
          principal_owner_person_id?: string | null
          property_id: string
          start_date: string
          status?: string
          tenant_person_id?: string | null
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjustment_frequency_months?: number | null
          adjustment_index?: string | null
          base_rent?: number
          charges_amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          family_id?: string
          guarantee_type?: string | null
          id?: string
          is_demo?: boolean
          next_adjustment_date?: string | null
          notes?: string | null
          principal_owner_person_id?: string | null
          property_id?: string
          start_date?: string
          status?: string
          tenant_person_id?: string | null
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_contracts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_contracts_owner_family_fkey"
            columns: ["principal_owner_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "lease_contracts_property_family_fkey"
            columns: ["property_id", "family_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "lease_contracts_tenant_family_fkey"
            columns: ["tenant_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "lease_contracts_unit_property_family_fkey"
            columns: ["unit_id", "property_id", "family_id"]
            isOneToOne: false
            referencedRelation: "property_units"
            referencedColumns: ["id", "property_id", "family_id"]
          },
        ]
      }
      lease_owner_shares: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          family_id: string
          fixed_amount: number | null
          id: string
          lease_contract_id: string
          percentage: number | null
          person_id: string
          rule: Json
          share_type: string
          updated_at: string
          updated_by: string | null
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id: string
          fixed_amount?: number | null
          id?: string
          lease_contract_id: string
          percentage?: number | null
          person_id: string
          rule?: Json
          share_type?: string
          updated_at?: string
          updated_by?: string | null
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id?: string
          fixed_amount?: number | null
          id?: string
          lease_contract_id?: string
          percentage?: number | null
          person_id?: string
          rule?: Json
          share_type?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_owner_shares_contract_family_fkey"
            columns: ["lease_contract_id", "family_id"]
            isOneToOne: false
            referencedRelation: "lease_contracts"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "lease_owner_shares_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_owner_shares_person_family_fkey"
            columns: ["person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      legal_cases: {
        Row: {
          case_number: string | null
          case_type: string | null
          claim_value: number | null
          court: string | null
          created_at: string
          expected_value: number | null
          family_id: string
          id: string
          last_update: string | null
          last_update_date: string | null
          lawyer: string | null
          notes: string | null
          person_id: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          case_number?: string | null
          case_type?: string | null
          claim_value?: number | null
          court?: string | null
          created_at?: string
          expected_value?: number | null
          family_id: string
          id?: string
          last_update?: string | null
          last_update_date?: string | null
          lawyer?: string | null
          notes?: string | null
          person_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          case_number?: string | null
          case_type?: string | null
          claim_value?: number | null
          court?: string | null
          created_at?: string
          expected_value?: number | null
          family_id?: string
          id?: string
          last_update?: string | null
          last_update_date?: string | null
          lawyer?: string | null
          notes?: string | null
          person_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_cases_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_cases_person_family_fkey"
            columns: ["person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "legal_cases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_audit_logs: {
        Row: {
          client_name: string | null
          client_version: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          family_id: string | null
          id: string
          input_summary: Json
          ip_address: unknown
          operation: string
          request_id: string
          result_summary: Json
          session_id: string | null
          status: string
          tool_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          client_name?: string | null
          client_version?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          family_id?: string | null
          id?: string
          input_summary?: Json
          ip_address?: unknown
          operation: string
          request_id: string
          result_summary?: Json
          session_id?: string | null
          status: string
          tool_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          client_name?: string | null
          client_version?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          family_id?: string | null
          id?: string
          input_summary?: Json
          ip_address?: unknown
          operation?: string
          request_id?: string
          result_summary?: Json
          session_id?: string | null
          status?: string
          tool_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_audit_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          doctor_id: string | null
          dosage: string | null
          end_date: string | null
          family_id: string
          frequency: string | null
          id: string
          medication_name: string
          notes: string | null
          person_id: string | null
          schedule: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          dosage?: string | null
          end_date?: string | null
          family_id: string
          frequency?: string | null
          id?: string
          medication_name: string
          notes?: string | null
          person_id?: string | null
          schedule?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          dosage?: string | null
          end_date?: string | null
          family_id?: string
          frequency?: string | null
          id?: string
          medication_name?: string
          notes?: string | null
          person_id?: string | null
          schedule?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_doctor_family_fkey"
            columns: ["doctor_id", "family_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "medications_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_person_family_fkey"
            columns: ["person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "medications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          direction: Database["public"]["Enums"]["payment_direction"]
          executed_by_person_id: string | null
          expense_id: string | null
          external_reference: string | null
          family_id: string
          id: string
          metadata: Json
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_document_id: string | null
          status: Database["public"]["Enums"]["operational_status"]
          supplier_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          executed_by_person_id?: string | null
          expense_id?: string | null
          external_reference?: string | null
          family_id: string
          id?: string
          metadata?: Json
          payment_date: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_document_id?: string | null
          status?: Database["public"]["Enums"]["operational_status"]
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          executed_by_person_id?: string | null
          expense_id?: string | null
          external_reference?: string | null
          family_id?: string
          id?: string
          metadata?: Json
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_document_id?: string | null
          status?: Database["public"]["Enums"]["operational_status"]
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_executed_by_person_id_fkey"
            columns: ["executed_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_receipt_document_id_fkey"
            columns: ["receipt_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          birth_date: string | null
          cnh: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          family_id: string
          family_role: string | null
          first_name: string
          id: string
          last_name: string
          nationality: string | null
          phone: string | null
          rg: string | null
          status: Database["public"]["Enums"]["record_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          birth_date?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          family_id: string
          family_role?: string | null
          first_name: string
          id?: string
          last_name: string
          nationality?: string | null
          phone?: string | null
          rg?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          birth_date?: string | null
          cnh?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          family_id?: string
          family_role?: string | null
          first_name?: string
          id?: string
          last_name?: string
          nationality?: string | null
          phone?: string | null
          rg?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          city: string | null
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          family_id: string
          id: string
          is_demo: boolean
          metadata: Json
          municipal_registration: string | null
          postal_code: string | null
          property_type: string | null
          registry_number: string | null
          state: string | null
          status: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address: string
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id: string
          id?: string
          is_demo?: boolean
          metadata?: Json
          municipal_registration?: string | null
          postal_code?: string | null
          property_type?: string | null
          registry_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id?: string
          id?: string
          is_demo?: boolean
          metadata?: Json
          municipal_registration?: string | null
          postal_code?: string | null
          property_type?: string | null
          registry_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      property_owners: {
        Row: {
          created_at: string
          end_date: string | null
          ownership_percentage: number | null
          person_id: string
          property_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          ownership_percentage?: number | null
          person_id: string
          property_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          ownership_percentage?: number | null
          person_id?: string
          property_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_owners_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_owners_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_units: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          family_id: string
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          property_id: string
          status: string
          unit_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id: string
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          property_id: string
          status?: string
          unit_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          family_id?: string
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          property_id?: string
          status?: string
          unit_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_units_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_units_property_family_fkey"
            columns: ["property_id", "family_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      recurrences: {
        Row: {
          account_id: string | null
          active: boolean
          card_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          day_of_month: number | null
          deleted_at: string | null
          description: string | null
          end_date: string | null
          entry_type: string | null
          expected_amount: number | null
          family_id: string
          frequency: string
          id: string
          interval_value: number
          is_demo: boolean
          next_occurrence: string | null
          responsible_person_id: string | null
          rule: Json
          start_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          entry_type?: string | null
          expected_amount?: number | null
          family_id: string
          frequency: string
          id?: string
          interval_value?: number
          is_demo?: boolean
          next_occurrence?: string | null
          responsible_person_id?: string | null
          rule?: Json
          start_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          active?: boolean
          card_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          deleted_at?: string | null
          description?: string | null
          end_date?: string | null
          entry_type?: string | null
          expected_amount?: number | null
          family_id?: string
          frequency?: string
          id?: string
          interval_value?: number
          is_demo?: boolean
          next_occurrence?: string | null
          responsible_person_id?: string | null
          rule?: Json
          start_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_account_family_fkey"
            columns: ["account_id", "family_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "recurrences_card_family_fkey"
            columns: ["card_id", "family_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "recurrences_category_family_fkey"
            columns: ["category_id", "family_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "recurrences_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_person_family_fkey"
            columns: ["responsible_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          family_id: string
          id: string
          legal_name: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["record_status"]
          tax_document: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          family_id: string
          id?: string
          legal_name?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tax_document?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          family_id?: string
          id?: string
          legal_name?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          tax_document?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          alert_id: string | null
          assigned_person_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          family_id: string
          id: string
          priority: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alert_id?: string | null
          assigned_person_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          family_id: string
          id?: string
          priority?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alert_id?: string | null
          assigned_person_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          family_id?: string
          id?: string
          priority?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["record_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_person_id_fkey"
            columns: ["assigned_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_readiness: {
        Row: {
          blocking_reasons: Json
          checked_at: string | null
          created_at: string
          created_by: string | null
          esta_eta_ok: boolean | null
          id: string
          insurance_ok: boolean | null
          passport_ok: boolean | null
          person_id: string
          readiness_score: number | null
          status: Database["public"]["Enums"]["travel_readiness_status"]
          trip_id: string
          updated_at: string
          updated_by: string | null
          vaccine_ok: boolean | null
          visa_ok: boolean | null
        }
        Insert: {
          blocking_reasons?: Json
          checked_at?: string | null
          created_at?: string
          created_by?: string | null
          esta_eta_ok?: boolean | null
          id?: string
          insurance_ok?: boolean | null
          passport_ok?: boolean | null
          person_id: string
          readiness_score?: number | null
          status?: Database["public"]["Enums"]["travel_readiness_status"]
          trip_id: string
          updated_at?: string
          updated_by?: string | null
          vaccine_ok?: boolean | null
          visa_ok?: boolean | null
        }
        Update: {
          blocking_reasons?: Json
          checked_at?: string | null
          created_at?: string
          created_by?: string | null
          esta_eta_ok?: boolean | null
          id?: string
          insurance_ok?: boolean | null
          passport_ok?: boolean | null
          person_id?: string
          readiness_score?: number | null
          status?: Database["public"]["Enums"]["travel_readiness_status"]
          trip_id?: string
          updated_at?: string
          updated_by?: string | null
          vaccine_ok?: boolean | null
          visa_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_readiness_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_readiness_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_participants: {
        Row: {
          created_at: string
          person_id: string
          role: string | null
          trip_id: string
        }
        Insert: {
          created_at?: string
          person_id: string
          role?: string | null
          trip_id: string
        }
        Update: {
          created_at?: string
          person_id?: string
          role?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_participants_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_participants_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          departure_date: string
          destination_city: string | null
          destination_country: string
          family_id: string
          id: string
          metadata: Json
          return_date: string | null
          status: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          departure_date: string
          destination_city?: string | null
          destination_country: string
          family_id: string
          id?: string
          metadata?: Json
          return_date?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          departure_date?: string
          destination_city?: string | null
          destination_country?: string
          family_id?: string
          id?: string
          metadata?: Json
          return_date?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          locale: string
          phone: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          locale?: string
          phone?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_family_invitation: { Args: { p_token: string }; Returns: string }
      bootstrap_family: {
        Args: { p_description?: string; p_family_name: string }
        Returns: string
      }
      create_family_invitation: {
        Args: {
          p_email: string
          p_expires_in?: string
          p_family_id: string
          p_role?: Database["public"]["Enums"]["family_role"]
        }
        Returns: {
          invitation_expires_at: string
          invitation_id: string
          invitation_token: string
        }[]
      }
      get_family_onboarding_state: { Args: never; Returns: string }
      get_pending_family_invitation: {
        Args: never
        Returns: {
          expires_at: string
          family_id: string
          family_name: string
          invitation_id: string
          invitation_role: Database["public"]["Enums"]["family_role"]
        }[]
      }
    }
    Enums: {
      alert_severity: "low" | "medium" | "high" | "critical"
      automation_status:
        | "manual_required"
        | "partially_automated"
        | "automated"
        | "completed"
        | "failed"
      family_role: "owner" | "admin" | "member" | "viewer"
      membership_status: "invited" | "active" | "suspended" | "revoked"
      operational_status:
        | "planned"
        | "issued"
        | "pending"
        | "paid"
        | "received"
        | "overdue"
        | "contested"
        | "cancelled"
      payment_direction: "inflow" | "outflow"
      payment_method:
        | "pix"
        | "ted"
        | "boleto"
        | "automatic_debit"
        | "credit_card"
        | "debit_card"
        | "cash"
        | "other"
      record_status:
        | "active"
        | "inactive"
        | "pending"
        | "expired"
        | "archived"
        | "cancelled"
      travel_readiness_status: "not_checked" | "ready" | "attention" | "blocked"
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
      alert_severity: ["low", "medium", "high", "critical"],
      automation_status: [
        "manual_required",
        "partially_automated",
        "automated",
        "completed",
        "failed",
      ],
      family_role: ["owner", "admin", "member", "viewer"],
      membership_status: ["invited", "active", "suspended", "revoked"],
      operational_status: [
        "planned",
        "issued",
        "pending",
        "paid",
        "received",
        "overdue",
        "contested",
        "cancelled",
      ],
      payment_direction: ["inflow", "outflow"],
      payment_method: [
        "pix",
        "ted",
        "boleto",
        "automatic_debit",
        "credit_card",
        "debit_card",
        "cash",
        "other",
      ],
      record_status: [
        "active",
        "inactive",
        "pending",
        "expired",
        "archived",
        "cancelled",
      ],
      travel_readiness_status: ["not_checked", "ready", "attention", "blocked"],
    },
  },
} as const
