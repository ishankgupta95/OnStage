import Link from "next/link";
import Script from "next/script";
import { s } from "@/lib/onstage/css";
import { IcoBack } from "@/components/onstage/icons";

/**
 * Prose pages that sit outside the product design but inside its palette —
 * either a Termly embed, or the placeholder copy that keeps the route real.
 */
export function LegalPage({
  kicker,
  title,
  sections,
  policyUuid,
  websiteUuid,
}: {
  kicker: string;
  title: string;
  sections: { h: string; p: string }[];
  policyUuid?: string;
  websiteUuid?: string;
}) {
  const live = Boolean(policyUuid && websiteUuid);

  return (
    <main
      style={s(
        "min-height:100vh;background:var(--bg);color:var(--text);max-width:820px;margin:0 auto;padding:40px 28px 80px",
      )}
    >
      <Link
        href="/"
        style={s(
          "display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.2em;color:var(--muted-3)",
        )}
      >
        <IcoBack size={13} />
        HOME
      </Link>
      <div style={s("margin-top:30px;font-size:11px;letter-spacing:.12em;color:var(--muted-3)")}>
        {kicker}
      </div>
      <h1 style={s("margin:12px 0 0;font-size:34px;font-weight:500;letter-spacing:-.03em")}>{title}</h1>

      {live ? (
        <>
          <div
            data-name="termly-embed"
            data-id={policyUuid}
            style={s("margin-top:28px")}
          />
          <Script id="termly-jssdk" src="https://app.termly.io/embed-policy.min.js" />
        </>
      ) : (
        <div style={s("margin-top:28px;display:flex;flex-direction:column;gap:24px")}>
          {sections.map((sec) => (
            <section key={sec.h}>
              <h2 style={s("margin:0;font-size:17px;font-weight:500;letter-spacing:-.02em")}>
                {sec.h}
              </h2>
              <p
                style={s(
                  "margin:8px 0 0;max-width:70ch;font-size:14.5px;line-height:1.65;color:var(--muted)",
                )}
              >
                {sec.p}
              </p>
            </section>
          ))}
          <p style={s("margin:8px 0 0;font-size:12.5px;color:var(--muted-3)")}>
            Placeholder summary — the full policy renders here once the Termly environment variables
            are set.
          </p>
        </div>
      )}
    </main>
  );
}
