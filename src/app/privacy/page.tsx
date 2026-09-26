import type { Metadata } from "next";
import { LegalPage } from "@/components/onstage/screens/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Onstage",
  description: "How Onstage handles your data.",
};

// Termly-hosted policy. Drop the uuids into the env vars below and the embed
// renders the live policy; otherwise the placeholder copy keeps the route
// working in development so footer links never 404.
//
//   NEXT_PUBLIC_TERMLY_PRIVACY_UUID  — the policy uuid from termly.io
//   NEXT_PUBLIC_TERMLY_WEBSITE_UUID  — the website uuid (same for /privacy and /terms)
export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="LEGAL"
      title="Privacy Policy"
      policyUuid={process.env.NEXT_PUBLIC_TERMLY_PRIVACY_UUID}
      websiteUuid={process.env.NEXT_PUBLIC_TERMLY_WEBSITE_UUID}
      sections={[
        {
          h: "What we store",
          p: "Nothing. Onstage runs entirely in your browser and needs no account. The sets you build and the screenshots you drop in are held in this browser's local storage, and the rendering happens on your own machine.",
        },
        {
          h: "What we never do",
          p: "We do not sell your data, and we do not use your screenshots to train anything. Your screens are never uploaded to us, because there is no server to upload them to.",
        },
        {
          h: "Deleting your data",
          p: "Deleting a set removes it from this browser. Clearing your browser's site data for Onstage removes everything at once; nothing survives it anywhere else.",
        },
      ]}
    />
  );
}
