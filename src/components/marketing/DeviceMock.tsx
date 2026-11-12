import type { CSSProperties, ReactNode } from "react";
import type { DeviceFrame } from "@/lib/schema";
import type { Orientation } from "@/lib/editorDoc";
import { deviceRender, frontScreenRect, renderSrcSet, renderUrl, shadowSrcSet, shadowUrl } from "@/lib/deviceRenders";

// The marketing device mockup: the editor's own photoreal front-on render
// (src/lib/deviceRenders.ts) with live HTML laid into its screen. The render's
// screen is a transparent hole, so the content sits underneath it and the
// device's bezel, glass and cutout draw on top — the page shows exactly the
// frames the product exports.
//
// Sizing is fluid: the frame is a query container with the render's aspect,
// and the screen rect is positioned in % of it, so one component scales from a
// filmstrip thumb to a hero frame. Children may size themselves in cqw (% of
// the frame's width).
//
// Loading: images are lazy (fetched as they near the viewport) unless
// `priority`, and offered via srcset as a small thumb + the full render, so a
// thumbnail never downloads or decodes the full-size image. `sizes="auto"`
// lets the browser use the laid-out width; the fallback after it is for
// browsers without auto-sizes.

type Props = {
  device?: DeviceFrame;
  orientation?: Orientation;
  /** Finish id (e.g. "silver"); absent or unavailable = the model's default. */
  finish?: string;
  /** Above the fold: load eagerly at high priority instead of lazily. */
  priority?: boolean;
  /** Displayed width hint for srcset (CSS `sizes`); defaults suit a thumb-sized mock. */
  sizes?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const PRIORITY_SIZES = "(min-width: 1024px) 320px, 45vw";
const LAZY_SIZES = "auto, 320px";

export function DeviceMock({ device = "iphone-16-pro", orientation = "portrait", finish, priority, sizes, children, className = "", style }: Props) {
  const r = deviceRender(device, orientation);
  // Work in render pixels, then convert to % of the frame.
  const s = r && frontScreenRect(r, r.w, r.h);
  if (!r || !s) return null;
  // A hair of bleed so the hole's anti-aliased edge never shows a seam; the
  // overlap is hidden under the opaque bezel.
  const bleed = r.w * 0.002;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const shadow = r.shadow ? shadowUrl(r) : null;
  // sizes="auto" is only valid on lazy images.
  const load = priority
    ? ({ loading: "eager", fetchPriority: "high", sizes: sizes?.replace(/^auto,\s*/, "") ?? PRIORITY_SIZES } as const)
    : ({ loading: "lazy", sizes: sizes ?? LAZY_SIZES } as const);

  return (
    <div
      className={`relative [container-type:inline-size] ${className}`}
      style={{ aspectRatio: `${r.w} / ${r.h}`, ...style }}
    >
      {shadow && r.shadow && (
        // The render's own soft shadow, behind the device; it may spill past the box.
        // eslint-disable-next-line @next/next/no-img-element -- static export: next/image can't optimize
        <img
          src={shadow}
          srcSet={shadowSrcSet(r) ?? undefined}
          {...load}
          alt=""
          aria-hidden
          draggable={false}
          decoding="async"
          className="pointer-events-none absolute select-none"
          style={{
            left: pct(r.shadow.x, r.w),
            top: pct(r.shadow.y, r.h),
            width: pct(r.shadow.w, r.w),
            height: pct(r.shadow.h, r.h),
          }}
        />
      )}
      <div
        className="absolute overflow-hidden bg-neutral-900"
        style={{
          left: pct(s.x - bleed, r.w),
          top: pct(s.y - bleed, r.h),
          width: pct(s.w + 2 * bleed, r.w),
          height: pct(s.h + 2 * bleed, r.h),
          borderRadius: `${pct(s.r, s.w + 2 * bleed)} / ${pct(s.r, s.h + 2 * bleed)}`,
        }}
      >
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image can't optimize */}
      <img
        src={renderUrl(r, finish)}
        srcSet={renderSrcSet(r, finish)}
        {...load}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
        // Fallback shadow when the render has no shadow layer of its own.
        style={shadow ? undefined : { filter: "drop-shadow(0 2.2cqw 3.2cqw rgba(0,0,0,0.42))" }}
      />
    </div>
  );
}
