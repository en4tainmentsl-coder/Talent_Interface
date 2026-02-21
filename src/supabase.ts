import { createClient } from '@supabase/supabase-js';

const getEnvVar = (name: string) => {
  return (import.meta as any).env?.[`VITE_${name}`] || process.env[name];
};

const rawUrl = getEnvVar('SUPABASE_URL');
const supabaseUrl = rawUrl && rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY') || 'placeholder';

if (!rawUrl || !rawUrl.startsWith('http')) {
  console.warn('Invalid or missing SUPABASE_URL. Please ensure it starts with http:// or https://');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  stage_name: string;
  full_name: string;
  email: string;
  mobile: string;
  fb_trailer_link: string;
  fb_live_link: string;
  price_per_session: number;
  primary_location: string;
  secondary_locations: string[];
  bank_name_on_account: string;
  bank_account_number: string;
  bank_name: string;
  bank_branch_code: string;
  preferred_days: string[];
  languages: string[];
  performance_type: 'solo' | 'duo' | '3 piece' | 'full band';
  ensemble_type: string;
  national_id_number: string;
  bio: string;
  genres: string[];
  profile_picture_url?: string;
  nic_front_url?: string;
  nic_back_url?: string;
  created_at?: string;
};

export type BookingRequest = {
  id: string;
  talent_id: string;
  venue_name: string;
  venue_type: string;
  event_date: string;
  event_time: string;
  duration: string;
  status: 'pending' | 'quoted' | 'confirmed' | 'rejected' | 'completed';
  details: string;
  created_at: string;
};

export type Quotation = {
  id: string;
  booking_id: string;
  talent_id: string;
  price: number;
  terms: string;
  valid_until: string;
  created_at: string;
};

export type Earning = {
  id: string;
  talent_id: string;
  booking_id: string;
  amount: number;
  date: string;
  venue_name: string;
  created_at: string;
};
