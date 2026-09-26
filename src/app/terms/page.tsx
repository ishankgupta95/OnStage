import type { Metadata } from "next";
import { LegalPage } from "@/components/onstage/screens/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Onstage",
  description: "The terms you agree to when you use Onstage.",
};

// Termly-hosted terms; see the note in /privacy for the env vars.
export default function TermsPage() {
  return (
    <LegalPage
      kicker="LEGAL"
      title="Terms of Service"
      policyUuid={process.env.NEXT_PUBLIC_TERMLY_TERMS_UUID}
      websiteUuid={process.env.NEXT_PUBLIC_TERMLY_WEBSITE_UUID}
      sections={[
        {
          h: "Your work is yours",
          p: "You keep every right to the screenshots you upload and the sets you export. Onstage claims no licence over them beyond what it needs to render and store your files.",
        },
        {
          h: "Fonts and templates",
          p: "Templates are yours to use in any store listing. Fonts you upload are embedded in your renders and nothing is licensed on your behalf — check your own licence before you ship.",
        },
        {
          h: "No payment, no account",
          p: "Onstage is free and runs in your browser. There is nothing to buy, no plan to cancel, and no account to create — so nothing here obliges you to pay for anything.",
        },
      ]}
    />
  );
}
