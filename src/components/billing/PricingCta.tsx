"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { UpgradeButton } from "./BillingActions";
import type { PlanId } from "@/lib/billing/plans";

// CTA on the public pricing page. Three states:
//   - signed out → link to /login (after sign-in they hit /pricing again or
//                                   the dashboard route resumes)
//   - signed in but billing not configured → "Billing not configured" stub
//   - signed in + configured → POSTs to /api/stripe/checkout
export function PricingCta({
  planId,
  signedIn,
  configured,
  highlight,
}: {
  planId: PlanId;
  signedIn: boolean;
  configured: boolean;
  highlight: boolean;
}) {
  if (!signedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent("/pricing")}`}
        className={cn(buttonVariants({ variant: highlight ? "default" : "outline" }), "mt-6 w-full")}
      >
        Sign in to upgrade
      </Link>
    );
  }
  if (!configured) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: "outline" }),
          "pointer-events-none mt-6 w-full opacity-60",
        )}
      >
        Coming soon
      </span>
    );
  }
  return (
    <UpgradeButton
      planId={planId}
      label="Upgrade"
      variant={highlight ? "default" : "outline"}
      className="mt-6 w-full"
    />
  );
}
