"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PlanId } from "@/lib/billing/plans";

// Small client buttons that POST to the Stripe route handlers and follow the
// returned redirect URL. Auth-gated paths only — the server enforces owner-only
// in the route, this is just UI ergonomics (loading state + toast on error).

async function startCheckout(planId: PlanId): Promise<string> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(body.error ?? `checkout failed (${res.status})`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

async function openPortal(): Promise<string> {
  const res = await fetch("/api/stripe/portal", { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(body.error ?? `portal failed (${res.status})`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

export function UpgradeButton({
  planId,
  label,
  variant = "default",
  size = "default",
  className,
}: {
  planId: PlanId;
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const onClick = () =>
    start(async () => {
      setBusy(true);
      try {
        const url = await startCheckout(planId);
        window.location.assign(url);
      } catch (e) {
        setBusy(false);
        toast.error("Couldn't start checkout", {
          description: e instanceof Error ? e.message : "Try again in a moment.",
        });
      }
    });
  return (
    <Button onClick={onClick} disabled={pending || busy} variant={variant} size={size} className={className}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : label}
    </Button>
  );
}

export function ManageBillingButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const onClick = () =>
    start(async () => {
      setBusy(true);
      try {
        const url = await openPortal();
        window.location.assign(url);
      } catch (e) {
        setBusy(false);
        toast.error("Couldn't open billing portal", {
          description: e instanceof Error ? e.message : "Try again in a moment.",
        });
      }
    });
  return (
    <Button onClick={onClick} disabled={pending || busy} variant="outline" size="sm" className={className}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : "Manage in Stripe"}
    </Button>
  );
}
