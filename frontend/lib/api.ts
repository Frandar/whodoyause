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

export type Recommendation = {
  id: string;
  business_name: string;
  category: string;
  note: string | null;
  endorsement_count: number;
  created_by_name: string;
  created_at: string;
};

export type AddResult =
  | { ok: true; recommendation: Recommendation }
  | { ok: false; kind: 'duplicate'; existingId: string | null }
  | { ok: false; kind: 'unauthenticated' }
  | { ok: false; kind: 'invalid'; message: string }
  | { ok: false; kind: 'error'; message: string };

export type CategoryCount = { category: string; count: number };

export async function getCategoryCounts(): Promise<CategoryCount[]> {
  const res = await fetch(`${API_BASE}/recommendations/categories`);
  if (!res.ok) throw new Error('Failed to load categories');
  return res.json();
}

export async function getRecommendations(category: string): Promise<Recommendation[]> {
  const res = await fetch(`${API_BASE}/recommendations?category=${encodeURIComponent(category)}`);
  if (!res.ok) throw new Error('Failed to load recommendations');
  return res.json();
}

export async function addRecommendation(input: {
  business_name: string;
  category: string;
  note?: string;
}): Promise<AddResult> {
  const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
  const res = await fetch(`${API_BASE}/recommendations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (res.status === 201) {
    return { ok: true, recommendation: await res.json() };
  }
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, kind: 'duplicate', existingId: body?.existing_recommendation_id ?? null };
  }
  if (res.status === 401) {
    return { ok: false, kind: 'unauthenticated' };
  }
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, kind: 'invalid', message: body?.error?.message ?? 'Invalid input' };
  }
  return { ok: false, kind: 'error', message: `Something went wrong (${res.status})` };
}
