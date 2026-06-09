'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { getHealth, whoami } from '../lib/api';

export default function Home() {
  const [healthStatus, setHealthStatus] = useState<string>('checking…');
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getHealth()
      .then((h) => setHealthStatus(h.status === 'ok' && h.db ? 'ok' : 'error'))
      .catch(() => setHealthStatus('error'));
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) fetchWhoami();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchWhoami();
      else setUserId(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function fetchWhoami() {
    try {
      const result = await whoami();
      setUserId(result.user_id);
    } catch {
      setUserId(null);
    }
  }

  async function signIn() {
    setLoading(true);
    const { error } = await getSupabase().auth.signInWithOtp({ email });
    setLoading(false);
    if (error) alert(error.message);
    else setMagicLinkSent(true);
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    setUserId(null);
  }

  return (
    <main>
      <h1>WhoDoYaUse</h1>
      <p>API health: <strong>{healthStatus}</strong></p>

      {userId ? (
        <>
          <p>Signed-in user: <code>{userId}</code></p>
          <button onClick={signOut}>Sign out</button>
        </>
      ) : magicLinkSent ? (
        <p>Magic link sent — check your email.</p>
      ) : (
        <div>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginRight: 8, padding: '6px 10px' }}
          />
          <button onClick={signIn} disabled={loading || !email}>
            {loading ? 'Sending…' : 'Sign in with magic link'}
          </button>
        </div>
      )}
    </main>
  );
}
