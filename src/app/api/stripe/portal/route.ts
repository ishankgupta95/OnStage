import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveTeam, canManageTeam } from "@/lib/workspace";
import { getStripe, billingConfigured } from "@/lib/stripe";

// POST /api/stripe/portal
// Creates a Customer Portal session for the active team. Owner-only. Returns
// 503 when billing is not configured so the billing page can render a stub.

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST() {
  if (!billingConfigured()) {
    return NextResponse.json({ error: "billing not configured" }, { status: 503 });
  }
  const stripe = getStripe()!;
  const user = await requireUser();
  const supabase = await createClient();
  const { teamId, role } = await resolveActiveTeam(supabase, user.id);

  if (!canManageTeam(role)) {
    return NextResponse.json({ error: "only the team owner can manage billing" }, { status: 403 });
  }

  const { data: teamRow } = await supabase
    .from("teams")
    .select("stripe_customer_id")
    .eq("id", teamId)
    .single();
  const customerId = teamRow?.stripe_customer_id as string | null;
  if (!customerId) {
    return NextResponse.json({ error: "no Stripe customer for this team yet" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/settings/billing`,
  });
  return NextResponse.json({ url: session.url });
}
