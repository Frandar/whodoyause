import posthog from 'posthog-js';

// Analytics is optional: if NEXT_PUBLIC_POSTHOG_KEY is unset, every call no-ops
// so local dev and previews work without a PostHog project.
let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: true, // the "visit" in the funnel
    person_profiles: 'identified_only',
  });
  initialized = true;
}

export function capture(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, props);
}

export function identify(id: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.identify(id, props);
}

export function resetIdentity() {
  if (!initialized) return;
  posthog.reset();
}
