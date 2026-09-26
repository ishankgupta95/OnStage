import { ImageResponse } from "next/og";

// Site-wide OG image (used by Twitter / iMessage / Slack previews and any
// route that doesn't override it). Statically generated at build time.
//
// Pure inline styles + system fonts so it has no asset dependencies and the
// build doesn't slow down rendering it. The aesthetic mirrors the brand:
// blurple accent, large display type, monospace caption.

export const alt = "Onstage — store screenshots, done in an afternoon";
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
            "linear-gradient(135deg, #161826 0%, #2b2741 55%, #161826 100%)",
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
              background: "#9184d9",
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
            Make a store screenshot right here.
          </div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.78)", maxWidth: 820 }}>
            Drop a screen onto the phone, tilt it, pick a background. Every size the App Store and Google Play ask for, in one export.
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
          <span>1320 × 2868 · 1242 × 2688 · 1080 × 1920</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
