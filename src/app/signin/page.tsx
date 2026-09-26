import type { Metadata } from "next";
import { FEATURES } from "@/lib/features";
import { NOT_INDEXED } from "@/lib/site";
import { AuthScreen } from "@/components/onstage/screens/AuthScreen";
import { NotFoundScreen } from "@/components/onstage/screens/NotFoundScreen";

export const metadata: Metadata = {
  title: FEATURES.accounts ? "Sign in — Onstage" : "Not found — Onstage",
  // Flagged off it renders the 404 body: keep it out of search.
  ...(FEATURES.accounts ? {} : { robots: NOT_INDEXED }),
};

// `output: export` has no redirects, rewrites, headers or middleware, so the
// route file stays and renders the app's own 404 body instead. See
// src/lib/features.ts.
export default function SignInPage() {
  return FEATURES.accounts ? <AuthScreen /> : <NotFoundScreen />;
}
