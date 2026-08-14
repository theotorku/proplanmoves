export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      addresses: {
        Row: {
          id: string;
          customer_id: string | null;
          line1: string;
          line2: string | null;
          city: string;
          state: string;
          postal_code: string;
          access_notes: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          line1: string;
          line2?: string | null;
          city: string;
          state: string;
          postal_code: string;
          access_notes?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          actor_profile_id: string | null;
          entity_type: string;
          entity_id: string;
          event_type: string;
          previous_values: Json | null;
          new_values: Json | null;
          request_correlation_id: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          actor_profile_id?: string | null;
          entity_type: string;
          entity_id: string;
          event_type: string;
          previous_values?: Json | null;
          new_values?: Json | null;
          request_correlation_id?: string | null;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          reference: string;
          first_name: string;
          last_name: string;
          email: string | null;
          email_normalized: string | null;
          phone: string | null;
          phone_normalized: string | null;
          preferred_contact_method: string;
          marketing_consent: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          reference?: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          preferred_contact_method?: string;
          marketing_consent?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          reference: string;
          customer_id: string;
          status: string;
          move_type: string;
          origin_address_id: string | null;
          destination_address_id: string | null;
          requested_move_date: string | null;
          flexible_move_date: boolean;
          bedroom_count: number | null;
          origin_floor: number | null;
          destination_floor: number | null;
          origin_has_elevator: boolean | null;
          destination_has_elevator: boolean | null;
          needs_packing: boolean;
          needs_storage: boolean;
          specialty_items: Json;
          estimated_boxes: number | null;
          notes: string | null;
          lead_source: string;
          assigned_profile_id: string | null;
          lost_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          customer_id: string;
          status?: string;
          move_type: string;
          origin_address_id?: string | null;
          destination_address_id?: string | null;
          requested_move_date?: string | null;
          flexible_move_date?: boolean;
          bedroom_count?: number | null;
          origin_floor?: number | null;
          destination_floor?: number | null;
          origin_has_elevator?: boolean | null;
          destination_has_elevator?: boolean | null;
          needs_packing?: boolean;
          needs_storage?: boolean;
          specialty_items?: Json;
          estimated_boxes?: number | null;
          notes?: string | null;
          lead_source?: string;
          assigned_profile_id?: string | null;
          lost_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      lead_activities: {
        Row: {
          id: string;
          lead_id: string;
          activity_type: string;
          outcome: string | null;
          occurred_at: string;
          created_by: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          lead_id: string;
          activity_type: string;
          outcome?: string | null;
          occurred_at?: string;
          created_by?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["lead_activities"]["Insert"]>;
        Relationships: [];
      };
      lead_notes: {
        Row: {
          id: string;
          lead_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lead_notes"]["Insert"]>;
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_rules"]["Insert"]>;
        Relationships: [];
      };
      pricing_rule_versions: {
        Row: {
          id: string;
          pricing_rule_id: string;
          version_number: number;
          effective_from: string;
          effective_to: string | null;
          rules_json: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pricing_rule_id: string;
          version_number: number;
          effective_from?: string;
          effective_to?: string | null;
          rules_json: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_rule_versions"]["Insert"]>;
        Relationships: [];
      };
      estimates: {
        Row: {
          id: string;
          reference: string;
          lead_id: string;
          customer_id: string;
          pricing_rule_version_id: string;
          status: string;
          suggested_crew_size: number;
          suggested_truck_count: number;
          estimated_minutes: number;
          travel_allowance_minutes: number;
          low_total_cents: number;
          high_total_cents: number;
          currency: string;
          confidence: string;
          assumptions: Json;
          warnings: Json;
          has_manual_adjustment: boolean;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          lead_id: string;
          customer_id: string;
          pricing_rule_version_id: string;
          status?: string;
          suggested_crew_size: number;
          suggested_truck_count: number;
          estimated_minutes: number;
          travel_allowance_minutes?: number;
          low_total_cents: number;
          high_total_cents: number;
          currency?: string;
          confidence: string;
          assumptions?: Json;
          warnings?: Json;
          has_manual_adjustment?: boolean;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["estimates"]["Insert"]>;
        Relationships: [];
      };
      estimate_line_items: {
        Row: {
          id: string;
          estimate_id: string;
          code: string;
          description: string;
          quantity: number;
          unit: string;
          unit_amount_cents: number;
          total_amount_cents: number;
          category: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          estimate_id: string;
          code: string;
          description: string;
          quantity: number;
          unit: string;
          unit_amount_cents: number;
          total_amount_cents: number;
          category: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["estimate_line_items"]["Insert"]>;
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          reference: string;
          estimate_id: string;
          lead_id: string;
          customer_id: string;
          status: string;
          subtotal_cents: number;
          discount_cents: number;
          tax_cents: number;
          total_cents: number;
          deposit_cents: number;
          currency: string;
          expires_on: string | null;
          terms_version: string;
          customer_notes: string | null;
          internal_notes: string | null;
          decision_notes: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          accepted_at: string | null;
          rejected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          estimate_id: string;
          lead_id: string;
          customer_id: string;
          status?: string;
          subtotal_cents: number;
          discount_cents?: number;
          tax_cents?: number;
          total_cents: number;
          deposit_cents?: number;
          currency?: string;
          expires_on?: string | null;
          terms_version: string;
          customer_notes?: string | null;
          internal_notes?: string | null;
          decision_notes?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          accepted_at?: string | null;
          rejected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [];
      };
      quote_line_items: {
        Row: {
          id: string;
          quote_id: string;
          source_estimate_line_item_id: string | null;
          code: string;
          description: string;
          quantity: number;
          unit: string;
          unit_amount_cents: number;
          total_amount_cents: number;
          category: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          quote_id: string;
          source_estimate_line_item_id?: string | null;
          code: string;
          description: string;
          quantity: number;
          unit: string;
          unit_amount_cents: number;
          total_amount_cents: number;
          category: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["quote_line_items"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          reference: string;
          customer_id: string;
          lead_id: string;
          estimate_id: string;
          quote_id: string;
          status: string;
          scheduled_date: string | null;
          arrival_window_start: string | null;
          arrival_window_end: string | null;
          origin_address_id: string | null;
          destination_address_id: string | null;
          crew_size: number;
          truck_count: number;
          estimated_duration_minutes: number;
          estimated_revenue_cents: number;
          operational_notes: string | null;
          customer_notes: string | null;
          decision_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference?: string;
          customer_id: string;
          lead_id: string;
          estimate_id: string;
          quote_id: string;
          status?: string;
          scheduled_date?: string | null;
          arrival_window_start?: string | null;
          arrival_window_end?: string | null;
          origin_address_id?: string | null;
          destination_address_id?: string | null;
          crew_size: number;
          truck_count: number;
          estimated_duration_minutes: number;
          estimated_revenue_cents: number;
          operational_notes?: string | null;
          customer_notes?: string | null;
          decision_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      profile_roles: {
        Row: {
          profile_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          role_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profile_roles"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          code: string;
          name: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      add_lead_note_with_activity: {
        Args: {
          p_lead_id: string;
          p_body: string;
        };
        Returns: Json;
      };
      assign_lead: {
        Args: {
          p_lead_id: string;
          p_expected_profile_id: string | null;
          p_assignee_profile_id: string | null;
        };
        Returns: Json;
      };
      bootstrap_initial_owner: {
        Args: {
          p_user_id: string;
          p_email: string;
          p_full_name: string;
        };
        Returns: Json;
      };
      create_estimate_from_calculation: {
        Args: {
          p_actor_profile_id: string;
          p_lead_id: string;
          p_pricing_rule_version_id: string;
          p_calculation: Json;
        };
        Returns: Json;
      };
      consume_public_rate_limit: {
        Args: {
          p_bucket_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: Json;
      };
      list_assignable_staff: {
        Args: Record<string, never>;
        Returns: {
          staff_id: string;
          staff_name: string;
          staff_roles: string[];
        }[];
      };
      create_job_from_quote: {
        Args: {
          p_quote_id: string;
          p_scheduled_date?: string | null;
          p_arrival_window_start?: string | null;
          p_arrival_window_end?: string | null;
        };
        Returns: Json;
      };
      schedule_job: {
        Args: {
          p_job_id: string;
          p_scheduled_date: string;
          p_arrival_window_start: string;
          p_arrival_window_end: string;
        };
        Returns: Json;
      };
      update_job_requirements: {
        Args: {
          p_job_id: string;
          p_crew_size: number;
          p_truck_count: number;
          p_estimated_duration_minutes: number;
          p_operational_notes?: string | null;
        };
        Returns: Json;
      };
      transition_job_status: {
        Args: {
          p_job_id: string;
          p_expected_status: string;
          p_next_status: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      create_quote_from_estimate: {
        Args: {
          p_estimate_id: string;
          p_expires_on?: string | null;
          p_terms_version?: string;
        };
        Returns: Json;
      };
      update_quote_line_item: {
        Args: {
          p_line_item_id: string;
          p_quantity: number;
          p_unit_amount_cents: number;
        };
        Returns: Json;
      };
      update_quote_terms: {
        Args: {
          p_quote_id: string;
          p_discount_cents: number;
          p_tax_cents: number;
          p_deposit_cents: number;
          p_expires_on: string | null;
          p_customer_notes?: string | null;
        };
        Returns: Json;
      };
      transition_quote_status: {
        Args: {
          p_quote_id: string;
          p_expected_status: string;
          p_next_status: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      review_estimate: {
        Args: {
          p_estimate_id: string;
          p_expected_status: string;
          p_next_status: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      update_estimate_line_item: {
        Args: {
          p_line_item_id: string;
          p_quantity: number;
          p_unit_amount_cents: number;
        };
        Returns: Json;
      };
      submit_public_lead_request: {
        Args: { payload: Json };
        Returns: Json;
      };
      transition_lead_status: {
        Args: {
          p_lead_id: string;
          p_expected_status: string;
          p_next_status: string;
          p_reason?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
