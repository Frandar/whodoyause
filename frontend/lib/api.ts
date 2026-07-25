import { getSupabase } from './supabase';

// Fail loudly at build/load time — a missing base URL otherwise surfaces as a
// cryptic "reading 'replace' of undefined" far from the actual cause.
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE;
if (!RAW_API_BASE) {
  throw new Error('NEXT_PUBLIC_API_BASE is not set — add it to frontend/.env.local');
}
// Strip any trailing slash so `${API_BASE}/health` can't become `//health`.
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// A neighbor's note attached to their +1 ("add your take"), with attribution.
export type EndorsementNote = { name: string; note: string };

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
  // Optional contact details the recommender may add (all nullable).
  phone: string | null;
  email: string | null;
  website: string | null;
  contact_name: string | null;
  social_link: string | null;
  // Notes other neighbors left with their +1, oldest first.
  endorsement_notes: EndorsementNote[];
  created_at?: string;
};

// The optional contact fields on the add-recommendation form.
export type ContactInput = {
  phone?: string;
  email?: string;
  website?: string;
  contact_name?: string;
  social_link?: string;
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

export async function getRecommendations(
  category: string,
  limit?: number,
  offset?: number,
): Promise<Recommendation[]> {
  const params = new URLSearchParams({ category });
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  // Public, but send the JWT when present so the backend can fill endorsed_by_me.
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/recommendations?${params.toString()}`, { headers });
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

// The write helpers never throw: fetch() rejects outright on network failure
// (offline, DNS, CORS), and a rejection escaping into component handlers left
// buttons permanently disabled. Errors come back as values like every other
// non-ok outcome.
export async function endorse(id: string, note?: string): Promise<EndorseResult> {
  try {
    // A note upgrades the +1 to a JSON POST ("add your take"); a bare +1 sends no body.
    const trimmed = note?.trim();
    const headers = trimmed
      ? { 'Content-Type': 'application/json', ...(await authHeader()) }
      : await authHeader();
    const res = await fetch(`${API_BASE}/recommendations/${id}/endorse`, {
      method: 'POST',
      headers,
      ...(trimmed ? { body: JSON.stringify({ note: trimmed }) } : {}),
    });
    if (res.ok) return { ok: true, count: (await res.json()).endorsement_count };
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, kind: 'already', count: body?.endorsement_count ?? 0 };
    }
    if (res.status === 401) return { ok: false, kind: 'unauthenticated' };
    return { ok: false, kind: 'error' };
  } catch {
    return { ok: false, kind: 'error' };
  }
}

export async function unendorse(id: string): Promise<{ ok: boolean; count: number }> {
  try {
    const headers = await authHeader();
    const res = await fetch(`${API_BASE}/recommendations/${id}/endorse`, { method: 'DELETE', headers });
    if (res.ok) return { ok: true, count: (await res.json()).endorsement_count };
    return { ok: false, count: 0 };
  } catch {
    return { ok: false, count: 0 };
  }
}

export type SuggestEditInput = { message?: string } & ContactInput;

export type SuggestEditResult =
  | { ok: true }
  | { ok: false; kind: 'unauthenticated' }
  | { ok: false; kind: 'invalid'; message: string }
  | { ok: false; kind: 'error'; message?: string };

// Queue a proposed correction for the founders to review. Never edits the live
// record. Like the other write helpers, it returns errors as values.
export async function suggestEdit(
  id: string,
  input: SuggestEditInput,
): Promise<SuggestEditResult> {
  try {
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
    const res = await fetch(`${API_BASE}/recommendations/${id}/suggest-edit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    if (res.status === 201) return { ok: true };
    if (res.status === 401) return { ok: false, kind: 'unauthenticated' };
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, kind: 'invalid', message: body?.error?.message ?? 'Invalid input' };
    }
    return { ok: false, kind: 'error', message: `Something went wrong (${res.status})` };
  } catch {
    return { ok: false, kind: 'error', message: 'Network error — check your connection and try again' };
  }
}

export async function addRecommendation(
  input: {
    business_name: string;
    category: string;
    note?: string;
  } & ContactInput,
): Promise<AddResult> {
  try {
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
  } catch {
    return { ok: false, kind: 'error', message: 'Network error — check your connection and try again' };
  }
}
