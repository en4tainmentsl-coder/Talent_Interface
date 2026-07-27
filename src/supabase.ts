import { createClient } from '@supabase/supabase-js';

const rawUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (import.meta as any).env?.SUPABASE_URL ||
  '';

const rawKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.SUPABASE_ANON_KEY ||
  '';

const isValidUrl = (url: any): url is string => {
  return typeof url === 'string' && url.trim().startsWith('http');
};

if (!isValidUrl(rawUrl) || !rawKey) {
  throw new Error('Supabase environment variables are missing or invalid. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(rawUrl, rawKey);

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
  profile_cover_url?: string;
  profile_feature_urls?: string[];
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
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  details: string;
  created_at: string;
  google_calendar_event_link?: string;
};

export type QuoteRequest = {
  id: string;
  client_user_id: string;
  event_date: string;
  event_time: string;
  duration_hours: number;
  budget_min: number;
  budget_max: number;
  status: string;
  venue_name: string;
  details: string;
  created_at: string;
};

export type CalendarEventLink = {
  booking_id: string;
  google_calendar_event_link: string;
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

export type Genre = {
  id: string;
  name: string;
};
