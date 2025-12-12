export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'manager'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          roles: UserRole[]
          salary_percent: number
          can_view_analytics: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          roles?: UserRole[]
          salary_percent?: number
          can_view_analytics?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          roles?: UserRole[]
          salary_percent?: number
          can_view_analytics?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      columns: {
        Row: {
          id: string
          name: string
          color: string
          position: number
          is_success: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color?: string
          position: number
          is_success?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          position?: number
          is_success?: boolean
          created_at?: string
        }
      }
      executors: {
        Row: {
          id: string
          name: string
          phone: string
          salary_percent: number
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          salary_percent?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          salary_percent?: number
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      deals: {
        Row: {
          id: string
          column_id: string
          position: number
          client_name: string
          client_phone: string
          address: string
          price: number
          executor_id: string | null
          manager_id: string | null
          scheduled_at: string | null
          completed_at: string | null
          notes: string | null
          is_repeated_client: boolean
          source: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          column_id: string
          position?: number
          client_name: string
          client_phone: string
          address: string
          price?: number
          executor_id?: string | null
          manager_id?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
          is_repeated_client?: boolean
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          column_id?: string
          position?: number
          client_name?: string
          client_phone?: string
          address?: string
          price?: number
          executor_id?: string | null
          manager_id?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
          is_repeated_client?: boolean
          source?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calls: {
        Row: {
          id: string
          deal_id: string | null
          client_phone: string
          direction: 'incoming' | 'outgoing'
          duration: number
          recording_url: string | null
          transcript: string | null
          ai_summary: string | null
          is_spam: boolean
          created_at: string
        }
        Insert: {
          id?: string
          deal_id?: string | null
          client_phone: string
          direction: 'incoming' | 'outgoing'
          duration?: number
          recording_url?: string | null
          transcript?: string | null
          ai_summary?: string | null
          is_spam?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          deal_id?: string | null
          client_phone?: string
          direction?: 'incoming' | 'outgoing'
          duration?: number
          recording_url?: string | null
          transcript?: string | null
          ai_summary?: string | null
          is_spam?: boolean
          created_at?: string
        }
      }
      call_comments: {
        Row: {
          id: string
          call_id: string
          user_id: string
          comment: string
          created_at: string
        }
        Insert: {
          id?: string
          call_id: string
          user_id: string
          comment: string
          created_at?: string
        }
        Update: {
          id?: string
          call_id?: string
          user_id?: string
          comment?: string
          created_at?: string
        }
      }
      bonuses: {
        Row: {
          id: string
          executor_id: string | null
          manager_id: string | null
          deal_id: string | null
          amount: number
          reason: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          executor_id?: string | null
          manager_id?: string | null
          deal_id?: string | null
          amount: number
          reason: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          executor_id?: string | null
          manager_id?: string | null
          deal_id?: string | null
          amount?: number
          reason?: string
          created_by?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: 'deal' | 'call' | 'system'
          is_read: boolean
          deal_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: 'deal' | 'call' | 'system'
          is_read?: boolean
          deal_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: 'deal' | 'call' | 'system'
          is_read?: boolean
          deal_id?: string | null
          created_at?: string
        }
      }
      ai_settings: {
        Row: {
          id: string
          openrouter_api_key: string | null
          selected_model: string
          temperature: number
          auto_process_webhooks: boolean
          auto_transcribe_calls: boolean
          system_prompt: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          openrouter_api_key?: string | null
          selected_model?: string
          temperature?: number
          auto_process_webhooks?: boolean
          auto_transcribe_calls?: boolean
          system_prompt?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          openrouter_api_key?: string | null
          selected_model?: string
          temperature?: number
          auto_process_webhooks?: boolean
          auto_transcribe_calls?: boolean
          system_prompt?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      call_direction: 'incoming' | 'outgoing'
      notification_type: 'deal' | 'call' | 'system'
    }
  }
}

// Удобные типы для использования
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Column = Database['public']['Tables']['columns']['Row']
export type Executor = Database['public']['Tables']['executors']['Row']
export type Deal = Database['public']['Tables']['deals']['Row']
export type Call = Database['public']['Tables']['calls']['Row']
export type CallComment = Database['public']['Tables']['call_comments']['Row']
export type Bonus = Database['public']['Tables']['bonuses']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type AISettings = Database['public']['Tables']['ai_settings']['Row']

// Сделка с связанными данными
export type DealWithRelations = Deal & {
  executor: Executor | null
  manager: Profile | null
  column: Column
}
