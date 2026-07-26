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
// is_mine marks the signed-in viewer's own note so the UI can offer edit/delete.
export type EndorsementNote = { name: string; note: string; is_mine: boolean };

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
  // True when the signed-in viewer created this recommendation — gates the
  // edit/delete controls on its own note. False for anonymous reads.
  created_by_me: boolean;
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

// --- runtime validation at the network boundary ---
// The API responses are typed above, but TypeScript can't police what actually
// arrives. A backend shape change (a renamed field, a deploy skew) would
// type-check clean and then blow up mid-render with no error boundary to catch
// it. These guards are deliberately shallow: they check the fields the UI
// actually dereferences, and normalise nullable ones — not a schema library.

function isRecommendation(v: unknown): v is Recommendation {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.business_name === 'string' &&
    typeof r.category === 'string' &&
    typeof r.endorsement_count === 'number' &&
    typeof r.created_by_name === 'string'
  );
}

function parseRecommendations(data: unknown): Recommendation[] {
  if (!Array.isArray(data)) throw new Error('Malformed response: expected a list');
  const rows = data.filter(isRecommendation);
  if (rows.length !== data.length) {
    // Drop bad rows rather than failing the whole page, but make it visible.
    console.error('Dropped %d malformed recommendation(s)', data.length - rows.length);
  }
  // endorsement_notes is dereferenced directly by the card — guarantee an array.
  return rows.map((r) => ({
    ...r,
    endorsement_notes: Array.isArray(r.endorsement_notes) ? r.endorsement_notes : [],
  }));
}

function parseCategoryCounts(data: unknown): CategoryCount[] {
  if (!Array.isArray(data)) throw new Error('Malformed response: expected a list');
  return data.filter(
    (c): c is CategoryCount =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as CategoryCount).category === 'string' &&
      typeof (c as CategoryCount).count === 'number',
  );
}

// Read helpers throw on failure; write helpers return result unions (see the
// note above endorse()). That split is deliberate and now documented in one
// place: a failed read has exactly one sensible UI response — show the error
// state and offer a retry — whereas a failed write has several distinct
// outcomes (duplicate, unauthenticated, invalid) the caller must branch on.
// Every read call site MUST attach a .catch; the browse page's `error` state and
// the landing page's silent-placeholder fallback are the two accepted handlers.

export async function getCategoryCounts(): Promise<CategoryCount[]> {
  const res = await fetch(`${API_BASE}/recommendations/categories`);
  if (!res.ok) throw new Error('Failed to load categories');
  return parseCategoryCounts(await res.json());
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
  return parseRecommendations(await res.json());
}

export async function searchRecommendations(
  query: string,
  category?: string,
  limit?: number,
  offset?: number,
): Promise<Recommendation[]> {
  const params = new URLSearchParams({ q: query });
  if (category) params.set('category', category);
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  // Public, but send the JWT when present so the backend can fill endorsed_by_me.
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/recommendations/search?${params.toString()}`, { headers });
  if (!res.ok) throw new Error('Search failed');
  return parseRecommendations(await res.json());
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

export type UpdateNoteResult =
  | { ok: true; note: string | null }
  | { ok: false; kind: 'unauthenticated' | 'notfound' | 'invalid' | 'error'; message?: string };

// Edit or clear the recommendation's OWN note (creator-scoped on the server).
// Pass '' to clear it. Editing/deleting the initial note both go through here.
export async function updateRecommendationNote(
  id: string,
  note: string,
): Promise<UpdateNoteResult> {
  try {
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
    const res = await fetch(`${API_BASE}/recommendations/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: true, note: body?.note ?? null };
    }
    if (res.status === 401) return { ok: false, kind: 'unauthenticated' };
    if (res.status === 404) return { ok: false, kind: 'notfound' };
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, kind: 'invalid', message: body?.error?.message ?? 'Invalid input' };
    }
    return { ok: false, kind: 'error' };
  } catch {
    return { ok: false, kind: 'error' };
  }
}

// Remove your own +1 note while keeping the +1 itself. Editing a note goes
// through endorse(id, newNote) (which upserts); this is the "delete" path.
export async function deleteNote(id: string): Promise<{ ok: boolean }> {
  try {
    const headers = await authHeader();
    const res = await fetch(`${API_BASE}/recommendations/${id}/note`, {
      method: 'DELETE',
      headers,
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
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
