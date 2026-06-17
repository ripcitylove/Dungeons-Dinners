import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-dummy-url.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-dummy-key';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: true,
  },
});

if (typeof window !== 'undefined') {
  const purgeAuthStorage = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
  };

  // Silence the benign "Invalid Refresh Token: Refresh Token Not Found" console
  // error. When a stored session's refresh token has been rotated/revoked/expired,
  // auth-js (GoTrueClient._recoverAndRefresh) logs the failure via a HARDCODED
  // console.error before removing the session and firing SIGNED_OUT — there is no
  // option to disable that log. The condition is expected (the user is simply
  // logged out, and the SIGNED_OUT handler below recovers cleanly), so we drop
  // ONLY that exact message; every other console.error passes through untouched.
  //
  // NOTE: we deliberately do NOT pre-delete the stored session to avoid the log —
  // a VALID refresh token legitimately refreshes an expired access token, and
  // deleting it preemptively would log users out on every access-token expiry and
  // break persistent login. So we let the refresh run and only mute its benign
  // failure log.
  const REFRESH_TOKEN_NOISE = /Invalid Refresh Token|Refresh Token Not Found/i;
  const baseConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const text = args
      .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === 'string' ? a : ''))
      .join(' ');
    if (REFRESH_TOKEN_NOISE.test(text)) {
      purgeAuthStorage(); // self-heal: drop the dead token so it can't recur
      return;
    }
    baseConsoleError(...args);
  };

  // When a token refresh fails, Supabase fires SIGNED_OUT. Purge stale tokens
  // and redirect to /auth so the user can sign back in cleanly.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      purgeAuthStorage();
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    }
  });
}
