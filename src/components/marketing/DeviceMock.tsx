import type { CSSProperties, ReactNode } from "react";
import { geometryFor } from "@/lib/deviceGeometry";
import type { DeviceFrame } from "@/lib/schema";
import type { Orientation } from "@/lib/editorDoc";

// A pure-CSS device frame that borrows the editor's real geometry (corner radius,
// bezel inset, cutout) so the marketing mockups match what the product renders.
// Sizing is fully fluid: the body is a query container, and every radius/inset is
// expressed in cqw (% of the frame's own width), so one component scales from a
// 90px filmstrip thumb to a 320px hero frame with correct proportions.

type Props = {
  device?: DeviceFrame;
  orientation?: Orientation;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Soft diagonal glare across the screen glass. */
  glare?: boolean;
};

export function DeviceMock({ device = "iphone-16-pro", orientation = "portrait", children, className = "", style, glare = true }: Props) {
  const g = geometryFor(device, orientation);
  const inset = g.insetRatio * 100;
  const corner = g.cornerRatio * 100;
  const screenCorner = g.screenCornerRatio * 100;
  const showButtons = g.buttons && orientation === "portrait";

  return (
    <div className={`relative [container-type:inline-size] ${className}`} style={{ aspectRatio: String(g.aspect), ...style }}>
      {/* side buttons sit behind the body so only the nub shows */}
      {showButtons && (
        <>
          <span className="absolute left-[-0.6cqw] top-[20%] h-[7%] w-[1.2cqw] rounded-l-[1cqw] bg-neutral-700" />
          <span className="absolute right-[-0.6cqw] top-[16%] h-[5%] w-[1.2cqw] rounded-r-[1cqw] bg-neutral-700" />
          <span className="absolute right-[-0.6cqw] top-[26%] h-[10%] w-[1.2cqw] rounded-r-[1cqw] bg-neutral-700" />
        </>
      )}

      {/* body / titanium rail */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: `${corner}cqw`,
          background: "linear-gradient(150deg,#3a3d44,#0b0c0e 42%,#0b0c0e 60%,#33363c)",
          boxShadow: "0 2cqw 6cqw -1cqw rgba(0,0,0,0.55), inset 0 0 0 0.35cqw rgba(255,255,255,0.10)",
        }}
      >
        {/* screen */}
        <div
          className="absolute overflow-hidden bg-neutral-900"
          style={{ inset: `${inset}cqw`, borderRadius: `${screenCorner}cqw` }}
        >
          {children}

          {/* cutout */}
          {g.cutout === "island" && (
            <span className="absolute left-1/2 top-[2.4cqw] h-[5cqw] w-[26cqw] -translate-x-1/2 rounded-full bg-black" />
          )}
          {g.cutout === "punch" && (
            <span className="absolute left-1/2 top-[2.6cqw] size-[4cqw] -translate-x-1/2 rounded-full bg-black/90 ring-[0.6cqw] ring-black/40" />
          )}

          {/* glass glare */}
          {glare && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(118deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 100%)" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
