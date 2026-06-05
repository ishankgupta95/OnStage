import Link from "next/link";
import { ArrowLeftIcon, CheckIcon, CreditCardIcon, SparklesIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveTeam } from "@/lib/workspace";
import { getTeamBilling } from "@/lib/billing/plan";
import { visiblePlans, type PlanDef } from "@/lib/billing/plans";
import { billingConfigured } from "@/lib/stripe";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UpgradeButton, ManageBillingButton } from "@/components/billing/BillingActions";

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusLabel(status: string | null) {
  if (!status) return "Free";
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const { teamId, name, role, personal } = await resolveActiveTeam(supabase, user.id);
  const billing = await getTeamBilling(supabase, teamId);
  const isOwner = role === "owner";
  const configured = billingConfigured();
  const upgradablePlans: PlanDef[] = visiblePlans().filter(
    (p) => p.paid && (!personal || p.id !== "team"),
  );
  const sp = await searchParams;
  const justUpgraded = sp.status === "success";

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-8">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Dashboard
        </Link>
        <ThemeToggle />
      </div>

      <header className="mt-5 border-b border-border pb-7">
        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Billing · {name}
        </span>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {billing.plan === "free" ? "You're on Free" : `You're on ${capitalize(billing.plan)}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {billing.plan === "free"
            ? "Upgrade to drop the watermark and export without limits."
            : "Manage your subscription, seats, or payment method in the Stripe portal."}
        </p>
      </header>

      {justUpgraded && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-3.5" />
          </span>
          <div>
            <p className="font-medium">Thanks — your plan is upgrading.</p>
            <p className="text-muted-foreground">
              Stripe is finalizing your payment. Your plan will switch over within a few seconds.
            </p>
          </div>
        </div>
      )}

      {/* Current plan summary */}
      <section className="mt-7 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <CreditCardIcon className="size-5" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Current plan
              </p>
              <p className="text-base font-semibold">
                {capitalize(billing.plan)} · {statusLabel(billing.planStatus)}
              </p>
            </div>
          </div>
          {isOwner && billing.stripeCustomerId && configured && <ManageBillingButton />}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Seats</dt>
            <dd className="tabular-nums">{billing.seatCount}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Renews</dt>
            <dd>{fmtDate(billing.currentPeriodEnd)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Status</dt>
            <dd className="capitalize">{statusLabel(billing.planStatus).toLowerCase()}</dd>
          </div>
        </dl>
      </section>

      {/* Upgrade panel (free teams only) */}
      {billing.plan === "free" && isOwner && (
        <section className="mt-7">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <SparklesIcon className="-mt-0.5 mr-1 inline size-3.5" />
            Upgrade
          </h2>
          {!configured ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
              Billing isn&apos;t configured yet. Set <code className="font-mono">STRIPE_SECRET_KEY</code> and the price-id
              env vars on the server to enable upgrades.
            </div>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {upgradablePlans.map((p) => (
                <li
                  key={p.id}
                  className={
                    "flex flex-col rounded-2xl border bg-card p-5 " +
                    (p.highlight ? "border-primary ring-1 ring-primary" : "border-border")
                  }
                >
                  <p className="text-base font-semibold">{p.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.blurb}</p>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold tracking-tight">{p.priceLabel}</span>
                    {p.cadence && <span className="text-sm text-muted-foreground">{p.cadence}</span>}
                  </div>
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5">
                        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span className="text-foreground/85">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <UpgradeButton planId={p.id} label="Upgrade" className="mt-5 w-full" />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!isOwner && (
        <p className="mt-7 rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Only the team owner can change the plan. Ask them to upgrade if you&apos;re hitting limits.
        </p>
      )}
    </main>
  );
}

function capitalize(s: string) {
  return s.replace(/^\w/, (c) => c.toUpperCase());
}
