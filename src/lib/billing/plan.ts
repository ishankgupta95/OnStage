import type { SupabaseClient } from "@supabase/supabase-js";
import { entitlements, type TeamPlan } from "./plans";

// A team's billing state, read from the teams row (plan + Stripe linkage).
export type TeamBilling = {
  plan: TeamPlan;
  planStatus: string | null; // 'active' | 'trialing' | 'past_due' | 'canceled' | null
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  seatCount: number;
};

export async function getTeamBilling(supabase: SupabaseClient, teamId: string): Promise<TeamBilling> {
  const { data } = await supabase
    .from("teams")
    .select("plan, plan_status, current_period_end, stripe_customer_id, stripe_subscription_id, seat_count")
    .eq("id", teamId)
    .maybeSingle();
  return {
    plan: (data?.plan as TeamPlan) ?? "free",
    planStatus: (data?.plan_status as string | null) ?? null,
    currentPeriodEnd: (data?.current_period_end as string | null) ?? null,
    stripeCustomerId: (data?.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (data?.stripe_subscription_id as string | null) ?? null,
    seatCount: (data?.seat_count as number) ?? 1,
  };
}

// Convenience: the entitlements (export/project limits, watermark) for a team's plan.
export function teamEntitlements(billing: Pick<TeamBilling, "plan">) {
  return entitlements(billing.plan);
}
