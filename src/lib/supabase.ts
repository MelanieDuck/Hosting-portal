import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Subscription = {
  id: string;
  user_id: string;
  plan_name: string;
  status: 'active' | 'cancelled' | 'past_due' | 'suspended';
  billing_cycle: string;
  amount: number;
  currency: string;
  next_payment_date: string | null;
  started_at: string;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  payment_date: string;
  invoice_number: string | null;
  payment_method_label: string | null;
  description: string | null;
  is_one_off: boolean;
  note: string | null;
  created_at: string;
};

export type PaymentMethod = {
  id: string;
  user_id: string;
  type: 'card' | 'direct_debit';
  label: string;
  brand: string | null;
  last4: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  account_name: string | null;
  sort_code_masked: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Backup = {
  id: string;
  user_id: string;
  filename: string;
  file_size: number;
  storage_path: string;
  backup_type: 'full' | 'files' | 'database';
  created_at: string;
  expires_at: string | null;
};

export type Profile = {
  id: string;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  website_url: string;
  website_server: string;
  website_ip: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientNote = {
  id: string;
  user_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type StripeSubscription = {
  customer_id: string;
  subscription_id: string | null;
  subscription_status: string;
  price_id: string | null;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
};

export type StripeOrder = {
  customer_id: string;
  order_id: number;
  checkout_session_id: string;
  payment_intent_id: string;
  amount_subtotal: number;
  amount_total: number;
  currency: string;
  payment_status: string;
  order_status: string;
  order_date: string;
};

export type PendingClient = {
  id: string;
  full_name: string;
  email: string;
  notes: string | null;
  status: 'pending' | 'invited' | 'completed';
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InviteToken = {
  id: string;
  token: string;
  client_id: string;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export type NotificationLog = {
  id: string;
  user_id: string | null;
  type: string;
  recipient: string;
  subject: string;
  body: string | null;
  sent_at: string;
  status: string;
};
