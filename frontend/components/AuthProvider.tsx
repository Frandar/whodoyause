'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { capture, identify, resetIdentity } from '@/lib/analytics';

// First-time-signup detection. Magic-link auth creates the user row when the
// link is *requested* but only fires SIGNED_IN when it's *clicked* (often
// minutes later), so a tight "created moments ago" window misses real signups.
// Instead we record which user ids this device has already counted and fire
// once per genuinely new account (created within the link's lifetime — a
// generous 24h guards against clock skew while still excluding existing users
// signing in on a fresh device).
const SEEN_USERS_KEY = 'wdyu_seen_users';
const SIGNUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isNewSignup(userId: string, createdAt: string | undefined): boolean {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(SEEN_USERS_KEY) || '[]');
    if (seen.includes(userId)) return false;
    localStorage.setItem(SEEN_USERS_KEY, JSON.stringify([...seen, userId]));
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() < SIGNUP_MAX_AGE_MS;
  } catch {
    // localStorage unavailable (private mode) — can't dedupe, so skip rather
    // than risk counting a signup on every sign-in.
    return false;
  }
}

export type SendLinkResult =
  | { ok: true }
  | { ok: false; rateLimited: boolean; message: string };

type AuthValue = {
  email: string | null;
  userId: string | null;
  signedIn: boolean;
  loading: boolean;
  sendMagicLink: (email: string) => Promise<SendLinkResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
      if (user) identify(user.id, { email: user.email });
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      setEmail(user?.email ?? null);
      setUserId(user?.id ?? null);
      if (user) {
        identify(user.id, { email: user.email });
        if (event === 'SIGNED_IN' && isNewSignup(user.id, user.created_at)) {
          capture('signup');
        }
      } else if (event === 'SIGNED_OUT') {
        resetIdentity();
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function sendMagicLink(addr: string): Promise<SendLinkResult> {
    const { error } = await getSupabase().auth.signInWithOtp({ email: addr });
    if (!error) return { ok: true };
    const rateLimited = error.message.toLowerCase().includes('rate limit');
    return { ok: false, rateLimited, message: error.message };
  }

  async function signOut() {
    await getSupabase().auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        email,
        userId,
        signedIn: !!userId,
        loading,
        sendMagicLink,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
