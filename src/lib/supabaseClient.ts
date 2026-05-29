import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-dummy-url.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-dummy-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// When a token refresh fails, Supabase fires SIGNED_OUT. Purge any stale
// localStorage keys so the next page load starts clean instead of looping.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      });
    }
  });
}
