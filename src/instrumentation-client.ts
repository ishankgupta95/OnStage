// Analytics + client error tracking. Loaded GUARDED and LAZILY: the SDKs are
// dynamically imported only when their keys are set, so a keyless build — and
// the static marketing landing in particular — never ships posthog-js or the
// Sentry browser SDK in its initial bundle. When keys exist, they load async
// right after the document is ready, off the critical path.
//
// (Sentry navigation tracing + source-map upload come with the full
// `withSentryConfig` wizard at launch; this scaffold covers error capture.)

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: "history_change", // auto pageviews across App Router navigations
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
  });
}

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: sentryDsn,
      tracesSampleRate: 1,
    });
  });
}
