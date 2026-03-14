import { createClient } from '@supabase/supabase-js';

const getEnvVar = (name: string) => {
  return (import.meta as any).env?.[`VITE_${name}`] || process.env[name];
};

const rawUrl = getEnvVar('SUPABASE_URL');
const rawKey = getEnvVar('SUPABASE_ANON_KEY');

const isValidUrl = (url: any): url is string => {
  return typeof url === 'string' && url.trim().startsWith('http');
};

// Mock implementation for previewing without real Supabase
const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: { provider_token: 'mock-token', user: { id: 'mock-id', email: 'test@example.com', user_metadata: { full_name: 'Test Artist', avatar_url: 'https://picsum.photos/200' } } } }, error: null }),
    onAuthStateChange: (cb: any) => {
      cb('SIGNED_IN', { user: { id: 'mock-id', email: 'test@example.com', user_metadata: { full_name: 'Test Artist', avatar_url: 'https://picsum.photos/200' } } });
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithOAuth: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: { id: 'mock-id', email: 'test@example.com', user_metadata: { full_name: 'Test Artist', avatar_url: 'https://picsum.photos/200' } } }, error: null }),
  },
  from: (table: string) => {
    const queryBuilder: any = {
      select: () => queryBuilder,
      eq: () => queryBuilder,
      in: () => queryBuilder,
      order: () => queryBuilder,
      single: async () => ({ data: null, error: null }),
      upsert: async () => ({ data: null, error: null }),
      insert: async () => ({ data: null, error: null }),
      update: () => queryBuilder,
      then: (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled),
    };
    return queryBuilder;
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'mock' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://picsum.photos/200' } }),
    }),
  },
} as any;

// Add some mock data for genres if using mock
if (!(isValidUrl(rawUrl) && rawKey)) {
  const originalFrom = mockSupabase.from;
  mockSupabase.from = (table: string) => {
    if (table === 'genres') {
      return {
        select: () => ({
          order: async () => ({
            data: [
              { id: '1', name: 'Jazz' },
              { id: '2', name: 'Pop' },
              { id: '3', name: 'Rock' },
              { id: '4', name: 'Classical' },
              { id: '5', name: 'Hip Hop' },
              { id: '6', name: 'Electronic' },
              { id: '7', name: 'Blues' },
              { id: '8', name: 'Country' },
              { id: '9', name: 'Reggae' },
              { id: '10', name: 'Funk' }
            ],
            error: null
          })
        })
      };
    }
    return originalFrom(table);
  };
}

export const supabase = (isValidUrl(rawUrl) && rawKey) ? createClient(rawUrl, rawKey) : mockSupabase;

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

export type Genre = {
  id: string;
  name: string;
};
