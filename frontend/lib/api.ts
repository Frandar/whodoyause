import { getSupabase } from './supabase';

// Strip any trailing slash so `${API_BASE}/health` can't become `//health`.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE!.replace(/\/+$/, '');

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type Recommendation = {
  id: string;
  business_name: string;
  category: string;
  note: string | null;
  endorsement_count: number;
  created_by_name: string;
  // True when the signed-in viewer has already +1'd this. Always false for
  // anonymous reads (the backend only computes it when a valid JWT is sent).
  endorsed_by_me: boolean;
  created_at?: string;
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
  // Public, but send the JWT when present so the backend can fill endorsed_by_me.
  const headers = await authHeader();
  const res = await fetch(
    `${API_BASE}/recommendations?category=${encodeURIComponent(category)}`,
    { headers },
  );
  if (!res.ok) throw new Error('Failed to load recommendations');
  return res.json();
}

export async function searchRecommendations(
  query: string,
  category?: string,
): Promise<Recommendation[]> {
  const params = new URLSearchParams({ q: query });
  if (category) params.set('category', category);
  // Public, but send the JWT when present so the backend can fill endorsed_by_me.
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/recommendations/search?${params.toString()}`, { headers });
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export type EndorseResult =
  | { ok: true; count: number }
  | { ok: false; kind: 'already'; count: number }
  | { ok: false; kind: 'unauthenticated' }
  | { ok: false; kind: 'error' };

export async function endorse(id: string): Promise<EndorseResult> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/recommendations/${id}/endorse`, { method: 'POST', headers });
  if (res.ok) return { ok: true, count: (await res.json()).endorsement_count };
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, kind: 'already', count: body?.endorsement_count ?? 0 };
  }
  if (res.status === 401) return { ok: false, kind: 'unauthenticated' };
  return { ok: false, kind: 'error' };
}

export async function unendorse(id: string): Promise<{ ok: boolean; count: number }> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/recommendations/${id}/endorse`, { method: 'DELETE', headers });
  if (res.ok) return { ok: true, count: (await res.json()).endorsement_count };
  return { ok: false, count: 0 };
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
