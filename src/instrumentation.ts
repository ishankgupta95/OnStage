import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Server-side observability. register() runs once per server start; it only
// initializes Sentry when SENTRY_DSN is set, so without a key there's zero
// overhead and onRequestError below is a no-op.
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // The Sentry Next.js SDK adapts init() to the current runtime (node/edge).
  Sentry.init({
    dsn,
    tracesSampleRate: 1,
  });
}

// Captures server-rendering, route-handler, and server-action errors. No-ops
// until Sentry is initialized above.
export const onRequestError: Instrumentation.onRequestError = Sentry.captureRequestError;
