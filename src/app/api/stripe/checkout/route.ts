import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveTeam, canManageTeam } from "@/lib/workspace";
import { getStripe, billingConfigured } from "@/lib/stripe";
import { planById, priceIdFor, type PlanId } from "@/lib/billing/plans";

// POST /api/stripe/checkout  body: { planId: PlanId }
// Creates a subscription Checkout Session for the active team's owner. The
// team id rides along in metadata so the webhook can find the right row to
// upgrade.
//
// Scaffold-only when STRIPE_SECRET_KEY is unset: returns 503 so the pricing
// page can show "Billing not configured" without crashing.

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST(request: Request) {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  const stripe = getStripe()!;
  const user = await requireUser();
  const supabase = await createClient();
  const { teamId, role, personal } = await resolveActiveTeam(supabase, user.id);

  // Only owners can upgrade a team's plan (mirrors team-actions.ts gates).
  if (!canManageTeam(role)) {
    return NextResponse.json({ error: "only the team owner can upgrade" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { planId?: PlanId };
  const plan = body.planId ? planById(body.planId) : undefined;
  if (!plan || !plan.paid) {
    return NextResponse.json({ error: "invalid planId" }, { status: 400 });
  }
  if (plan.id === "team" && personal) {
    return NextResponse.json(
      { error: "team plan requires a non-personal workspace — create or switch to a team first" },
      { status: 400 },
    );
  }
  const priceId = priceIdFor(plan);
  if (!priceId) {
    return NextResponse.json({ error: `price id missing for ${plan.id}` }, { status: 500 });
  }

  // Reuse or create the team's Stripe customer. The admin client writes the
  // stripe_customer_id back so the next upgrade reuses it (RLS allows owners
  // to update their team, but admin keeps this resilient to future RLS shifts).
  const admin = createAdminClient();
  const { data: teamRow } = await admin
    .from("teams")
    .select("stripe_customer_id, name")
    .eq("id", teamId)
    .single();
  let customerId = teamRow?.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: teamRow?.name ?? undefined,
      metadata: { team_id: teamId, user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("teams").update({ stripe_customer_id: customerId }).eq("id", teamId);
  }

  const successUrl = `${siteUrl()}/settings/billing?status=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${siteUrl()}/pricing?status=cancelled`;

  // Per-seat for team plan: default seat count = current members (the webhook
  // will reconcile on subscription.updated when seats change).
  let quantity = 1;
  if (plan.perSeat) {
    const { count } = await admin
      .from("team_members")
      .select("user_id", { count: "exact", head: true })
      .eq("team_id", teamId);
    quantity = Math.max(1, count ?? 1);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    client_reference_id: teamId,
    metadata: { team_id: teamId, plan_id: plan.id, team_plan: plan.teamPlan },
    subscription_data: { metadata: { team_id: teamId, plan_id: plan.id } },
    // Legal links surface inside Checkout itself (configure the Termly URLs
    // in Stripe dashboard → checkout settings; nothing to wire here).
  });

  if (!session.url) {
    return NextResponse.json({ error: "stripe did not return a redirect url" }, { status: 500 });
  }
  return NextResponse.json({ url: session.url });
}
