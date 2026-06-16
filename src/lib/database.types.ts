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
      campaign_characters: {
        Row: {
          campaign_id: string
          cantrips_known: Json
          character_id: string
          class_resources: Json | null
          hp: number
          id: string
          inventory: Json
          joined_at: string
          level: number
          max_hp: number
          spell_slots_used: Json
          spells_prepared: Json
          status_effects: Json
          updated_at: string
          user_id: string | null
          xp: number
        }
        Insert: {
          campaign_id: string
          cantrips_known?: Json
          character_id: string
          class_resources?: Json | null
          hp?: number
          id?: string
          inventory?: Json
          joined_at?: string
          level?: number
          max_hp?: number
          spell_slots_used?: Json
          spells_prepared?: Json
          status_effects?: Json
          updated_at?: string
          user_id?: string | null
          xp?: number
        }
        Update: {
          campaign_id?: string
          cantrips_known?: Json
          character_id?: string
          class_resources?: Json | null
          hp?: number
          id?: string
          inventory?: Json
          joined_at?: string
          level?: number
          max_hp?: number
          spell_slots_used?: Json
          spells_prepared?: Json
          status_effects?: Json
          updated_at?: string
          user_id?: string | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_characters_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_messages: {
        Row: {
          campaign_id: string
          content: string
          created_at: string | null
          id: string
          role: string
          sender: string | null
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string | null
          id?: string
          role: string
          sender?: string | null
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          sender?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          character_id: string | null
          created_at: string
          current_turn_index: number | null
          description: string | null
          id: string
          party_leader_id: string | null
          status: string | null
          title: string
          turn_order: string[] | null
          user_id: string
        }
        Insert: {
          character_id?: string | null
          created_at?: string
          current_turn_index?: number | null
          description?: string | null
          id?: string
          party_leader_id?: string | null
          status?: string | null
          title: string
          turn_order?: string[] | null
          user_id: string
        }
        Update: {
          character_id?: string | null
          created_at?: string
          current_turn_index?: number | null
          description?: string | null
          id?: string
          party_leader_id?: string | null
          status?: string | null
          title?: string
          turn_order?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          alignment: string | null
          background: string | null
          campaign_id: string | null
          cantrips_known: Json
          charisma: number | null
          class: string
          constitution: number | null
          created_at: string
          dexterity: number | null
          hp: number | null
          id: string
          intelligence: number | null
          inventory: Json | null
          level: number | null
          max_hp: number | null
          name: string
          portrait_url: string | null
          race: string
          sex: string
          skill_proficiencies: string[] | null
          spell_slots_used: Json
          spells_prepared: Json
          status_effects: Json
          strength: number | null
          title: string | null
          user_id: string
          wisdom: number | null
          xp: number
        }
        Insert: {
          alignment?: string | null
          background?: string | null
          campaign_id?: string | null
          cantrips_known?: Json
          charisma?: number | null
          class: string
          constitution?: number | null
          created_at?: string
          dexterity?: number | null
          hp?: number | null
          id?: string
          intelligence?: number | null
          inventory?: Json | null
          level?: number | null
          max_hp?: number | null
          name: string
          portrait_url?: string | null
          race: string
          sex?: string
          skill_proficiencies?: string[] | null
          spell_slots_used?: Json
          spells_prepared?: Json
          status_effects?: Json
          strength?: number | null
          title?: string | null
          user_id: string
          wisdom?: number | null
          xp?: number
        }
        Update: {
          alignment?: string | null
          background?: string | null
          campaign_id?: string | null
          cantrips_known?: Json
          charisma?: number | null
          class?: string
          constitution?: number | null
          created_at?: string
          dexterity?: number | null
          hp?: number | null
          id?: string
          intelligence?: number | null
          inventory?: Json | null
          level?: number | null
          max_hp?: number | null
          name?: string
          portrait_url?: string | null
          race?: string
          sex?: string
          skill_proficiencies?: string[] | null
          spell_slots_used?: Json
          spells_prepared?: Json
          status_effects?: Json
          strength?: number | null
          title?: string | null
          user_id?: string
          wisdom?: number | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          created_at: string | null
          image_url: string
          name: string
        }
        Insert: {
          created_at?: string | null
          image_url: string
          name: string
        }
        Update: {
          created_at?: string | null
          image_url?: string
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          stripe_customer_id: string | null
          subscription_status: string
          subscription_tier: string
          updated_at: string | null
        }
        Insert: {
          id: string
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          stripe_customer_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          updated_at?: string | null
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