// Frontend error reporting (ARCHITECTURE §8: "Sentry on frontend from day one").
//
// Optional and dynamically imported, mirroring lib/analytics.ts: with no
// NEXT_PUBLIC_SENTRY_DSN set, every call no-ops and the SDK is never fetched, so
// local dev and previews work unchanged and the landing-page bundle is untouched.
//
// @sentry/browser rather than @sentry/nextjs deliberately: this is a static
// export with no server, so the Next-specific build plugin, tunnel route and
// server instrumentation have nothing to do. The browser SDK is the whole
// useful surface here and costs far less.

let initialized = false;

export function initErrorReporting() {
  if (initialized || typeof window === 'undefined') return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  initialized = true;
  import('@sentry/browser')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        // A validation MVP does not need transaction volume; errors are the point.
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend(event) {
          // Never ship the user's JWT or email to a third party. Supabase keeps
          // the session in localStorage, which Sentry does not read, but query
          // strings can carry a magic-link token on the post-auth redirect.
          if (event.request?.url) {
            event.request.url = event.request.url.split('#')[0].split('?')[0];
          }
          return event;
        },
      });
    })
    .catch(() => {
      initialized = false;
    });
}
