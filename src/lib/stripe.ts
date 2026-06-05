import Stripe from "stripe";

// Server-side Stripe client, lazily created. Returns null when STRIPE_SECRET_KEY
// is unset so the app boots without billing configured (mirrors the Resend /
// PostHog scaffold-only pattern). Server-only — never import from a Client
// Component (the secret key must not reach the browser).
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // No explicit apiVersion → uses the account's default (avoids pinning a literal
  // the installed SDK's types might not know about).
  _stripe = new Stripe(key);
  return _stripe;
}

export function requireStripe(): Stripe {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured (set STRIPE_SECRET_KEY).");
  return stripe;
}

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
