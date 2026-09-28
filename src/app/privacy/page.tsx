import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { ArrowLeftIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Onstage",
  description: "How Onstage handles your data.",
};

// Termly-hosted policy. Drop the data-id and uuid into the env vars below and
// the embed renders the live policy; otherwise we render placeholder copy so
// the route works in development and links from Checkout don't 404.
//
//   NEXT_PUBLIC_TERMLY_PRIVACY_UUID  — the policy uuid from termly.io
//   NEXT_PUBLIC_TERMLY_WEBSITE_UUID  — the website uuid (same for /privacy and /terms)
export default function PrivacyPage() {
  const policyUuid = process.env.NEXT_PUBLIC_TERMLY_PRIVACY_UUID;
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
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Privacy Policy</h1>
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
        <PlaceholderCopy
          title="Privacy policy"
          body="We're finalizing the privacy policy with our legal provider. In the meantime: Onstage runs entirely in your browser. Your projects and the images you add are stored in this browser only and never sent to a server; deleting a project removes it from this browser. There's no account, no analytics and no payment. The site is served by GitHub Pages, and its fonts load from Google Fonts and Fontshare, which see your IP address as with any web request."
        />
      )}
    </main>
  );
}

function PlaceholderCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Placeholder · {title}</p>
      <p className="mt-3 leading-relaxed">{body}</p>
      <p className="mt-4 text-xs text-muted-foreground">
        This page swaps to the full Termly-hosted policy once <code>NEXT_PUBLIC_TERMLY_PRIVACY_UUID</code> is set.
      </p>
    </div>
  );
}
