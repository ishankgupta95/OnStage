import type { Metadata } from "next";
import Link from "next/link";
import { Check as CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { visiblePlans } from "@/lib/billing/plans";
import { billingConfigured } from "@/lib/stripe";
import { getUser } from "@/lib/auth";
import { PricingCta } from "@/components/billing/PricingCta";

export const metadata: Metadata = {
  title: "Pricing — Onstage",
  description: "Start free. Upgrade to export without limits and drop the watermark.",
};

// Public pricing page (not auth-gated). Driven by the visiblePlans() config.
export default async function PricingPage() {
  const plans = visiblePlans();
  const user = await getUser();
  const configured = billingConfigured();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:px-8">
      <div className="text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Pricing</span>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Pricing that ships with you</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Start free. Upgrade when you&apos;re ready to drop the watermark and export without limits.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className={cn(
              "flex flex-col rounded-2xl border bg-card/40 p-6",
              p.highlight && "border-primary ring-1 ring-primary",
            )}
          >
            {p.highlight && (
              <span className="mb-2 self-start rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Most popular
              </span>
            )}
            <h2 className="text-lg font-bold">{p.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.blurb}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight">{p.priceLabel}</span>
              {p.cadence && <span className="text-sm text-muted-foreground">{p.cadence}</span>}
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {p.paid ? (
              <PricingCta planId={p.id} signedIn={Boolean(user)} configured={configured} highlight={Boolean(p.highlight)} />
            ) : (
              <Link
                href={user ? "/dashboard" : "/login"}
                className={cn(buttonVariants({ variant: "outline" }), "mt-6 w-full")}
              >
                {user ? "Open dashboard" : "Get started"}
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Prices in USD. Cancel anytime. Team is billed per seat. By upgrading, you agree to the{" "}
        <Link href="/terms" className="underline-offset-4 hover:underline">terms</Link> and{" "}
        <Link href="/privacy" className="underline-offset-4 hover:underline">privacy policy</Link>.
      </p>
    </main>
  );
}
