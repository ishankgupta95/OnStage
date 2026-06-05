import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { planById, type PlanId, type TeamPlan } from "@/lib/billing/plans";
import { captureError } from "@/lib/observability";

// POST /api/stripe/webhook
// Stripe events drive the source-of-truth for teams.plan / plan_status /
// current_period_end. We DO NOT trust the client redirect from Checkout — only
// the signed webhook upgrades a team. Signature is verified against
// STRIPE_WEBHOOK_SECRET; anything that doesn't pass returns 400 fast.
//
// Events handled:
//   checkout.session.completed       — first upgrade (sub or one-time)
//   customer.subscription.updated    — seat changes, status changes, renewals
//   customer.subscription.deleted    — cancellation → revert to free
//   invoice.payment_failed           — mark plan_status='past_due'

// Stripe requires the raw body for signature verification. Returning JSON from
// `request.text()` keeps the bytes intact (route handlers don't pre-parse).
export const runtime = "nodejs";

type TeamUpdate = {
  plan?: TeamPlan;
  plan_status?: string;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  seat_count?: number;
};

async function updateTeam(teamId: string, patch: TeamUpdate) {
  const admin = createAdminClient();
  const { error } = await admin.from("teams").update(patch).eq("id", teamId);
  if (error) throw new Error(`team update failed: ${error.message}`);
}

// Pulls the team id off any Stripe object that came from one of our flows.
function teamIdFrom(obj: { metadata?: Stripe.Metadata | null; client_reference_id?: string | null }): string | null {
  return (obj.metadata?.team_id as string | undefined) ?? obj.client_reference_id ?? null;
}

function teamPlanFrom(obj: { metadata?: Stripe.Metadata | null }): TeamPlan | null {
  const planIdStr = obj.metadata?.plan_id as PlanId | undefined;
  if (planIdStr) {
    const def = planById(planIdStr);
    if (def) return def.teamPlan;
  }
  const tp = obj.metadata?.team_plan as TeamPlan | undefined;
  return tp ?? null;
}

export async function POST(request: Request) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  const stripe = getStripe()!;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not set" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse("missing signature", { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    return new NextResponse(`signature error: ${e instanceof Error ? e.message : "unknown"}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const teamId = teamIdFrom(session);
        const teamPlan = teamPlanFrom(session);
        if (!teamId || !teamPlan) break;

        const patch: TeamUpdate = {
          plan: teamPlan,
          plan_status: "active",
        };
        if (session.subscription && typeof session.subscription === "string") {
          patch.stripe_subscription_id = session.subscription;
          // Hydrate period end from the subscription.
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          patch.current_period_end = isoFromUnix((sub as unknown as { current_period_end?: number }).current_period_end);
          patch.seat_count = sub.items.data[0]?.quantity ?? 1;
        }
        await updateTeam(teamId, patch);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = teamIdFrom(sub);
        const teamPlan = teamPlanFrom(sub);
        if (!teamId) break;
        await updateTeam(teamId, {
          ...(teamPlan ? { plan: teamPlan } : {}),
          plan_status: sub.status,
          stripe_subscription_id: sub.id,
          current_period_end: isoFromUnix((sub as unknown as { current_period_end?: number }).current_period_end),
          seat_count: sub.items.data[0]?.quantity ?? 1,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const teamId = teamIdFrom(sub);
        if (!teamId) break;
        await updateTeam(teamId, {
          plan: "free",
          plan_status: "canceled",
          stripe_subscription_id: null,
          current_period_end: null,
        });
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        // Invoices can lack metadata; look up the subscription to find the team.
        const subId = (inv as unknown as { subscription?: string | null }).subscription;
        if (!subId || typeof subId !== "string") break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const teamId = teamIdFrom(sub);
        if (!teamId) break;
        await updateTeam(teamId, { plan_status: "past_due" });
        break;
      }

      default:
        // No-op: we acknowledge other events without changing state.
        break;
    }
  } catch (e) {
    // Don't return 500 for "we couldn't find the team" cases — Stripe will
    // retry forever. Log and ack so the queue stays healthy.
    captureError(e, { source: "stripe-webhook", event: event.type });
  }

  return NextResponse.json({ received: true });
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}
