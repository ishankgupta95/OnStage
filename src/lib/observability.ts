// Single entry point for reporting handled errors (error boundaries, caught
// rejections). Works on client and server.
//
// Sentry is imported LAZILY here on purpose: this module is reached from the
// root error.tsx, which is part of every route's shell — a static import would
// pull the Sentry SDK into the global client bundle (and the static landing).
// Sentry.captureException no-ops until init() runs with a DSN (instrumentation*),
// so this is safe whether or not Sentry is configured.
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.error("[onstage]", error, context ?? "");
  }
  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error, context ? { extra: context } : undefined))
    .catch(() => {
      /* Sentry chunk unavailable — reporting is best-effort */
    });
}
