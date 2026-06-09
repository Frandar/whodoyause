import { getSupabase } from './supabase';

// Strip any trailing slash so `${API_BASE}/health` can't become `//health`.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE!.replace(/\/+$/, '');

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getHealth(): Promise<{ status: string; db: boolean }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function whoami(): Promise<{ user_id: string }> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/whoami`, { headers });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}
