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
  | { ok: false; rateLimited: boolean; notFound: boolean; message: string };

export type SignupName = { firstName: string; lastName: string };

// The neighbor-facing name shown across the app: first name + last initial
// ("Mike R.") for privacy — mirrors the backend's _display_name so the user sees
// exactly how they appear to neighbors. Never the email.
function nameFromUser(user: { user_metadata?: Record<string, unknown> } | undefined): string | null {
  const meta = user?.user_metadata ?? {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  let first = str(meta.first_name);
  let last = str(meta.last_name);
  if (!first && !last) {
    const parts = str(meta.name).split(/\s+/).filter(Boolean);
    if (parts.length) {
      first = parts[0];
      last = parts.length > 1 ? parts[parts.length - 1] : '';
    }
  }
  if (first && last) return `${first} ${last[0].toUpperCase()}.`;
  return first || last || null;
}

type AuthValue = {
  email: string | null;
  displayName: string | null;
  userId: string | null;
  signedIn: boolean;
  loading: boolean;
  sendMagicLink: (email: string, name?: SignupName) => Promise<SendLinkResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setEmail(user?.email ?? null);
      setDisplayName(nameFromUser(user));
      setUserId(user?.id ?? null);
      if (user) identify(user.id, { email: user.email });
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      setEmail(user?.email ?? null);
      setDisplayName(nameFromUser(user));
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

  async function sendMagicLink(addr: string, name?: SignupName): Promise<SendLinkResult> {
    const first = name?.firstName.trim() ?? '';
    const last = name?.lastName.trim() ?? '';
    const isSignup = Boolean(first || last);
    // Signup collects a name and creates the account (data → user_metadata, which
    // Supabase applies only on creation). Login passes no name and shouldCreateUser
    // false, so accounts only ever exist with a name attached — a returning user
    // never re-enters their name, and a typo'd login can't spawn a nameless account.
    const options = isSignup
      ? {
          data: {
            first_name: first,
            last_name: last,
            name: [first, last].filter(Boolean).join(' '),
          },
        }
      : { shouldCreateUser: false };
    const { error } = await getSupabase().auth.signInWithOtp({ email: addr, options });
    if (!error) return { ok: true };
    const msg = error.message.toLowerCase();
    const rateLimited = msg.includes('rate limit');
    // shouldCreateUser:false against an unknown email → Supabase refuses to sign up.
    const notFound =
      !isSignup &&
      (error.status === 422 ||
        msg.includes('signup') ||
        msg.includes('not allowed') ||
        msg.includes('not found'));
    return { ok: false, rateLimited, notFound, message: error.message };
  }

  async function signOut() {
    await getSupabase().auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        email,
        displayName,
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
