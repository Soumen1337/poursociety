import { createClient } from '@supabase/supabase-js';

// Only the publishable key is used in browser code. RLS is the security boundary.
// Vite env vars override these public project defaults for other environments.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://qdlohormyrumfhzdaxum.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_FGFlX-siLsJIHJboSTMNPQ_HTM225gs';
export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
export const backendReady = Boolean(supabase);
