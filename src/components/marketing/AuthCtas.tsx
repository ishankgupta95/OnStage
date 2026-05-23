"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSignedIn } from "./useSignedIn";

const PRIMARY = cn(
  buttonVariants({ size: "lg" }),
  "h-12 rounded-xl px-7 text-[0.95rem] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
);
const SECONDARY = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  "h-12 rounded-xl px-7 text-[0.95rem] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
);

// Final-CTA buttons that reflect auth state: signed-out visitors get a "Sign in"
// secondary; signed-in visitors just get the primary into the editor.
export function FinalCtas() {
  const signedIn = useSignedIn();
  return (
    <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
      <Link href="/dashboard" className={PRIMARY}>
        Open the editor
      </Link>
      {signedIn === false && (
        <Link href="/login" className={SECONDARY}>
          Sign in
        </Link>
      )}
    </div>
  );
}
