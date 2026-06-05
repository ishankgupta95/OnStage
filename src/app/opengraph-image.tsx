import { ImageResponse } from "next/og";

// Site-wide OG image (used by Twitter / iMessage / Slack previews and any
// route that doesn't override it). Statically generated at build time.
//
// Pure inline styles + system fonts so it has no asset dependencies and the
// build doesn't slow down rendering it. The aesthetic mirrors the brand:
// emerald accent, large display type, monospace caption.

export const alt = "Onstage — App Store screenshots that ship";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Required for `output: export` — render the OG PNG statically at build time.
export const dynamic = "force-static";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #0B1A14 0%, #0F5132 55%, #0B1A14 100%)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          padding: "72px",
          justifyContent: "space-between",
          fontFamily: "system-ui, -apple-system, Segoe UI, Helvetica, Arial",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: "rgba(255,255,255,0.7)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#56b8e6",
            }}
          />
          Onstage
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            App Store screenshots that ship.
          </div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.78)", maxWidth: 820 }}>
            A web editor for indie devs and small teams. Side-by-side board, real device frames, exact-dimension PNG export.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "rgba(255,255,255,0.62)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 18,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          <span>onstage.app</span>
          <span>1290 × 2796 · 1284 × 2778 · 2064 × 2752</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
