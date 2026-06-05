"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { captureError } from "@/lib/observability";

// Shared fallback for route-segment error.tsx boundaries. On-brand with the
// empty states (rounded card, blueprint grid, mono kicker). Reports the error
// once on mount, then offers a retry (Next 16.2 `unstable_retry`, falling back
// to `reset`) plus an optional escape-hatch link.
export default function ErrorState({
  error,
  reset,
  unstable_retry,
  title = "Something went wrong",
  description = "An unexpected error interrupted this page. Your work is saved as of the last autosave — try again, and if it keeps happening, the issue has been logged.",
  homeHref,
  homeLabel,
  fullScreen = false,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  fullScreen?: boolean;
}) {
  useEffect(() => {
    captureError(error, { digest: error.digest });
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className={cn("grid place-items-center px-6", fullScreen ? "h-screen" : "min-h-[60vh] py-16")}>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card/40 px-6 py-12 text-center">
        <div className="bp-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(70%_60%_at_50%_25%,black,transparent)]" />
        <div className="relative">
          <span className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <TriangleAlertIcon className="size-7" />
          </span>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
          {error.digest && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Ref {error.digest}
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-2">
            {retry && (
              <Button onClick={() => retry()} className="gap-1.5">
                <RotateCcwIcon className="size-4" />
                Try again
              </Button>
            )}
            {homeHref && (
              <Link href={homeHref} className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
                {homeLabel ?? "Go back"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
