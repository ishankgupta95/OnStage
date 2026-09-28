import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — Onstage",
  description: "Terms for using Onstage.",
};

// Termly-hosted terms. Set NEXT_PUBLIC_TERMLY_TERMS_UUID to swap in the live
// policy; otherwise we render placeholder copy so Checkout's terms_of_service
// link doesn't 404.
export default function TermsPage() {
  const policyUuid = process.env.NEXT_PUBLIC_TERMLY_TERMS_UUID;
  const websiteUuid = process.env.NEXT_PUBLIC_TERMLY_WEBSITE_UUID;
  const live = Boolean(policyUuid && websiteUuid);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Home
      </Link>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Terms of Service</h1>
      {live ? (
        <>
          <Script src="https://app.termly.io/embed-policy.min.js" strategy="afterInteractive" />
          <div
            className="prose-onstage mt-6"
            data-name="termly-embed"
            data-id={policyUuid}
            data-type="iframe"
          />
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Placeholder · Terms</p>
          <p className="mt-3 leading-relaxed">
            We&apos;re finalizing the full terms with our legal provider. By using Onstage, you agree to use the
            service to create your own App Store / Google Play screenshots and to not use images you don&apos;t have
            rights to.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            This page swaps to the full Termly-hosted terms once <code>NEXT_PUBLIC_TERMLY_TERMS_UUID</code> is set.
          </p>
        </div>
      )}
    </main>
  );
}
