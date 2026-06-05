import posthog from "posthog-js";

// Funnel events (plan §10: visit → signup → activation). Client-side only.
// No-ops when PostHog isn't configured — gated on the same key that the init in
// instrumentation-client.ts checks, so the two stay in lockstep and the app
// behaves identically with or without analytics keys.
export type FunnelEvent =
  | "editor_opened"
  | "export_started"
  | "screenshot_exported"
  | "export_blocked"
  | "magic_link_requested";

export function track(event: FunnelEvent, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props);
  } catch {
    /* analytics is best-effort — never let it break a user action */
  }
}
