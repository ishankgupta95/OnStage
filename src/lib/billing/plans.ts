// Billing plans — the single source of truth for tiers, entitlements, and the
// pricing page. Stripe PRICE IDs are NOT hardcoded; they come from env (the
// founder creates the products in Stripe and sets these keys), so this file is
// safe to commit and the app boots without billing configured.
//
// Founder-confirmed prices (2026-05-28): solo $9/mo, team $19/seat/mo.
// Subscriptions only — the lifetime tier was dropped before launch (it
// cannibalizes MRR and §7 of the plan flagged this as a real risk; the founder
// chose a clean subs-only surface).

// What the `teams.plan` column stores (the DB check is 'free'|'solo'|'team').
export type TeamPlan = "free" | "solo" | "team";

export type PlanId = "free" | "solo_monthly" | "team";

export type PlanDef = {
  id: PlanId;
  name: string;
  teamPlan: TeamPlan; // what teams.plan becomes once on this plan
  paid: boolean; // false for free, true for paid subscription tiers
  priceEnvKey?: string; // env var holding the Stripe price id
  priceLabel: string; // display only
  cadence: string; // "/mo", "/seat/mo", ""
  perSeat?: boolean;
  blurb: string;
  features: string[];
  available?: boolean; // false hides it
  highlight?: boolean;
};

// Entitlements keyed by the stored team plan — what enforcement actually reads.
export const ENTITLEMENTS: Record<
  TeamPlan,
  { exportsPerMonth: number | null; projectLimit: number | null; watermark: boolean }
> = {
  free: { exportsPerMonth: 3, projectLimit: 1, watermark: true },
  solo: { exportsPerMonth: null, projectLimit: null, watermark: false },
  team: { exportsPerMonth: null, projectLimit: null, watermark: false },
};

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Free",
    teamPlan: "free",
    paid: false,
    priceLabel: "$0",
    cadence: "",
    blurb: "Try it out.",
    features: ["1 project", "3 exports / month", "Onstage watermark", "All layouts & devices"],
  },
  {
    id: "solo_monthly",
    name: "Solo",
    teamPlan: "solo",
    paid: true,
    priceEnvKey: "STRIPE_PRICE_SOLO_MONTHLY",
    priceLabel: "$9",
    cadence: "/mo",
    blurb: "For indie devs who ship.",
    features: ["Unlimited projects", "Unlimited exports", "No watermark", "Cancel anytime"],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    teamPlan: "team",
    paid: true,
    priceEnvKey: "STRIPE_PRICE_TEAM",
    priceLabel: "$19",
    cadence: "/seat/mo",
    perSeat: true,
    blurb: "For design teams.",
    features: ["Everything in Solo", "Shared team workspace", "Per-seat billing", "Roles & invites"],
  },
];

export function planById(id: PlanId): PlanDef | undefined {
  return PLANS.find((p) => p.id === id);
}

// The plans the pricing page + checkout should expose right now. Filters by
// `available` so any future "hide this plan" toggle still works without code
// changes elsewhere.
export function visiblePlans(): PlanDef[] {
  return PLANS.filter((p) => p.available !== false);
}

export function entitlements(plan: TeamPlan) {
  return ENTITLEMENTS[plan] ?? ENTITLEMENTS.free;
}

// The Stripe price id for a plan, from env (undefined until the founder sets it).
export function priceIdFor(plan: PlanDef): string | undefined {
  return plan.priceEnvKey ? process.env[plan.priceEnvKey] : undefined;
}
