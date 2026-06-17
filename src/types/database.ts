// Supabase veritabanı tip tanımları.
//
// NOT: Bu dosya normalde `supabase gen types typescript` ile üretilir. Üretim
// için ayrıcalıklı erişim (access token / DB şifresi) bu ortamda bulunmadığından
// supabase/migrations şemasına BİREBİR uygun olarak elle yazılmıştır. Şema
// değiştiğinde güncellenmeli; mümkünse şu komutla yeniden üretilmelidir:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts

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
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          advisor_id: string | null;
          vision: string | null;
          logo_url: string | null;
          cover_url: string | null;
          category: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          whatsapp_url: string | null;
          instagram_url: string | null;
          requires_advisor_approval: boolean;
          iban: string | null;
          ticket_enabled: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          advisor_id?: string | null;
          vision?: string | null;
          logo_url?: string | null;
          cover_url?: string | null;
          category?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          whatsapp_url?: string | null;
          instagram_url?: string | null;
          requires_advisor_approval?: boolean;
          iban?: string | null;
          ticket_enabled?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          advisor_id?: string | null;
          vision?: string | null;
          logo_url?: string | null;
          cover_url?: string | null;
          category?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          whatsapp_url?: string | null;
          instagram_url?: string | null;
          requires_advisor_approval?: boolean;
          iban?: string | null;
          ticket_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "clubs_advisor_id_fkey";
            columns: ["advisor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      club_members: {
        Row: {
          club_id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          club_id: string;
          user_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          club_id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          id: string;
          club_id: string;
          title: string;
          description: string | null;
          event_date: string;
          location: string | null;
          status: string;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          ticket_price: number | null;
          ticket_capacity: number | null;
          ticket_deadline: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          title: string;
          description?: string | null;
          event_date: string;
          location?: string | null;
          status?: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          ticket_price?: number | null;
          ticket_capacity?: number | null;
          ticket_deadline?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          title?: string;
          description?: string | null;
          event_date?: string;
          location?: string | null;
          status?: string;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          ticket_price?: number | null;
          ticket_capacity?: number | null;
          ticket_deadline?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      event_attendees: {
        Row: {
          event_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_documents: {
        Row: {
          id: string;
          event_id: string;
          uploaded_by: string;
          file_url: string;
          file_name: string;
          note: string | null;
          created_at: string;
        };
        // Kolon-grant: yalnızca içerik kolonları yazılabilir.
        Insert: {
          event_id: string;
          uploaded_by: string;
          file_url: string;
          file_name: string;
          note?: string | null;
        };
        Update: {
          event_id?: string;
          uploaded_by?: string;
          file_url?: string;
          file_name?: string;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          token: string;
          status: string;
          receipt_url: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          checked_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // Kolon-grant: yalnızca event_id + user_id yazılabilir (talep açma).
        Insert: {
          event_id: string;
          user_id: string;
        };
        Update: {
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_super_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_club_admin: {
        Args: { p_club_id: string };
        Returns: boolean;
      };
      is_club_advisor: {
        Args: { p_club_id: string };
        Returns: boolean;
      };
      event_submit: {
        Args: { p_event_id: string };
        Returns: string;
      };
      event_advisor_decision: {
        Args: { p_event_id: string; p_decision: string; p_note?: string };
        Returns: string;
      };
      event_school_decision: {
        Args: { p_event_id: string; p_decision: string; p_note?: string };
        Returns: string;
      };
      ticket_submit_receipt: {
        Args: { p_ticket_id: string; p_receipt_url: string };
        Returns: undefined;
      };
      ticket_approve: {
        Args: { p_ticket_id: string; p_decision: string; p_note?: string };
        Returns: undefined;
      };
      ticket_checkin: {
        Args: { p_token: string };
        Returns: {
          ticket_id: string;
          full_name: string | null;
          event_title: string;
        }[];
      };
      analytics_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          total_clubs: number;
          total_members: number;
          total_events: number;
          approved_events: number;
          total_tickets: number;
          total_checkins: number;
        }[];
      };
      analytics_clubs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          club_id: string;
          club_name: string;
          member_count: number;
          event_count: number;
          approved_event_count: number;
          total_checkins: number;
        }[];
      };
      analytics_member_growth: {
        Args: Record<PropertyKey, never>;
        Returns: {
          month: string;
          new_members: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
