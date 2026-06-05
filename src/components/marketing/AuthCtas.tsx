"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRIMARY = cn(
  buttonVariants({ size: "lg" }),
  "h-12 rounded-xl px-7 text-[0.95rem] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
);

// Final-CTA button into the editor. The demo needs no login, so there's no
// "Sign in" — anyone can open the editor and start for free.
export function FinalCtas() {
  return (
    <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
      <Link href="/dashboard" className={PRIMARY}>
        Open the editor
      </Link>
    </div>
  );
}
