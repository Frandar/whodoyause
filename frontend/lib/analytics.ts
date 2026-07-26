import type posthogType from 'posthog-js';

// Analytics is optional: if NEXT_PUBLIC_POSTHOG_KEY is unset, every call no-ops
// so local dev and previews work without a PostHog project.
//
// posthog-js is loaded with a DYNAMIC import so it stays out of the initial
// bundle. It was statically imported from the root layout, so ~60KB of
// analytics shipped on the critical path of the marketing landing page — the
// page that has to convert a cold visitor arriving from Facebook. Events fired
// before the module resolves are queued below rather than dropped.
let posthog: typeof posthogType | null = null;
let initialized = false;

// Calls made during the load window, replayed in order once PostHog is ready.
type QueuedCall = { fn: 'capture' | 'identify' | 'reset'; args: unknown[] };
const queue: QueuedCall[] = [];

function flush() {
  if (!posthog) return;
  for (const { fn, args } of queue.splice(0)) {
    if (fn === 'capture') posthog.capture(args[0] as string, args[1] as Record<string, unknown>);
    else if (fn === 'identify') posthog.identify(args[0] as string, args[1] as Record<string, unknown>);
    else posthog.reset();
  }
}

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  initialized = true; // set eagerly so queued calls are retained, not dropped
  import('posthog-js')
    .then((mod) => {
      posthog = mod.default;
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        // 'history_change' fires $pageview on pushState/replaceState too — plain
        // `true` only captures the initial load, silently dropping every SPA
        // navigation (App Router links AND the browse page's manual pushState).
        capture_pageview: 'history_change',
        person_profiles: 'identified_only',
      });
      flush();
    })
    .catch(() => {
      // Blocked by an ad-blocker or offline — analytics must never break the app.
      initialized = false;
      queue.length = 0;
    });
}

export function capture(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  if (!posthog) return void queue.push({ fn: 'capture', args: [event, props] });
  posthog.capture(event, props);
}

export function identify(id: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  if (!posthog) return void queue.push({ fn: 'identify', args: [id, props] });
  posthog.identify(id, props);
}

export function resetIdentity() {
  if (!initialized) return;
  if (!posthog) return void queue.push({ fn: 'reset', args: [] });
  posthog.reset();
}
