import type { CSSProperties } from "react";
import { GRADIENTS, type GradientPreset } from "@/lib/gradients";
import { MESH_GRADIENTS, PATTERNS, meshSwatchStyle, patternSwatchStyle } from "@/lib/backgrounds";
import { PALETTES } from "@/lib/palettes";
import { FONT_FAMILY } from "@/lib/editorDoc";
import type { Font } from "@/lib/schema";
import type { DeviceFrame } from "@/lib/schema";
import type { Orientation } from "@/lib/editorDoc";
import { DeviceMock } from "./DeviceMock";
import { AppUI, type AppUIVariant } from "./AppUI";

// A finished "store screenshot" exactly like the product exports: a real Onstage
// background (gradient / mesh / pattern / palette / solid), a caption set in one of
// the six bundled fonts, and the app shown inside a real device frame. Compose a
// handful of these with varied inputs and the page demonstrates the product's range
// instead of describing it.

export type BgChoice =
  | { kind: "gradient"; id: string }
  | { kind: "mesh"; id: string }
  | { kind: "pattern"; id: string }
  | { kind: "palette"; id: string }
  | { kind: "solid"; color: string };

export function gradientCss(p: GradientPreset): string {
  return `linear-gradient(${p.angle}deg, ${p.stops.map((s) => `${s.color} ${Math.round(s.position * 100)}%`).join(", ")})`;
}

export function bgStyle(bg: BgChoice): CSSProperties {
  switch (bg.kind) {
    case "gradient": {
      const p = GRADIENTS.find((x) => x.id === bg.id) ?? GRADIENTS[0];
      return { backgroundImage: gradientCss(p) };
    }
    case "mesh": {
      const p = MESH_GRADIENTS.find((x) => x.id === bg.id) ?? MESH_GRADIENTS[0];
      return meshSwatchStyle(p);
    }
    case "pattern": {
      const p = PATTERNS.find((x) => x.id === bg.id) ?? PATTERNS[0];
      return patternSwatchStyle(p);
    }
    case "palette": {
      const p = PALETTES.find((x) => x.id === bg.id) ?? PALETTES[0];
      return { backgroundImage: `linear-gradient(150deg, ${p.colors[1]}, ${p.colors[3]})` };
    }
    case "solid":
      return { backgroundColor: bg.color };
  }
}

export type StoreSlotConfig = {
  id: string;
  device?: DeviceFrame;
  orientation?: Orientation;
  /** Device finish id; absent or unavailable = the model's default. */
  finish?: string;
  bg: BgChoice;
  caption?: string;
  captionFont?: Font;
  captionColor?: string;
  captionPlacement?: "top" | "bottom";
  ui: AppUIVariant;
  uiTone?: "light" | "dark";
  accent?: string;
  /** Optional real export PNG (drop in public/examples). Falls back to the synthetic UI. */
  image?: string;
};

export function StoreSlot({
  config,
  className = "",
  style,
  radius = "1.5rem",
  priority,
  sizes,
}: {
  config: StoreSlotConfig;
  className?: string;
  style?: CSSProperties;
  /** Card corner radius. Fixed value (cqw can't self-reference), pass smaller for tiny slots. */
  radius?: string;
  /** Above the fold: load the device render eagerly (see DeviceMock). */
  priority?: boolean;
  /** srcset width hint for the device render (see DeviceMock). */
  sizes?: string;
}) {
  const {
    device = "iphone-16-pro",
    orientation = "portrait",
    finish,
    bg,
    caption,
    captionFont = "plus-jakarta-sans",
    captionColor = "#ffffff",
    captionPlacement = "top",
    ui,
    uiTone = "light",
    accent = "#56b8e6",
    image,
  } = config;

  const landscape = orientation === "landscape";
  const slotAspect = landscape ? 2796 / 1290 : 1290 / 2796;
  const top = captionPlacement === "top";

  const deviceNode = (
    <DeviceMock
      device={device}
      orientation={orientation}
      finish={finish}
      priority={priority}
      // a landscape slot's device is ~half the slot; default to a wide hint
      sizes={sizes ?? (landscape ? "auto, 45vw" : undefined)}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <AppUI variant={ui} accent={accent} tone={uiTone} />
      )}
    </DeviceMock>
  );

  return (
    <div
      className={`relative isolate overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/10 [container-type:inline-size] ${className}`}
      style={{ aspectRatio: String(slotAspect), borderRadius: radius, ...bgStyle(bg), ...style }}
    >
      {landscape ? (
        // Wide slot → caption left, device right, both fully contained.
        <div className="flex h-full w-full items-center gap-[3cqw] px-[5cqw] py-[5cqw]">
          {caption && (
            <p
              className="flex-1 whitespace-pre-line text-balance font-bold leading-[1.06] tracking-tight"
              style={{ fontFamily: FONT_FAMILY[captionFont], color: captionColor, fontSize: "6.4cqw" }}
            >
              {caption}
            </p>
          )}
          {/* plain block (not flex) so the DeviceMock fills the given width;
              the parent row's items-center handles vertical centering */}
          <div className="shrink-0" style={{ width: "46cqw" }}>
            {deviceNode}
          </div>
        </div>
      ) : (
        // Tall slot → caption on one edge, device centered and fully visible.
        <div className={`flex h-full w-full flex-col ${top ? "" : "flex-col-reverse"}`}>
          {caption && (
            <div className="flex-none px-[8cqw] pt-[8cqw] pb-[1cqw]">
              <p
                className="whitespace-pre-line text-balance text-center font-bold leading-[1.05] tracking-tight"
                style={{ fontFamily: FONT_FAMILY[captionFont], color: captionColor, fontSize: "9cqw" }}
              >
                {caption}
              </p>
            </div>
          )}
          <div className="flex min-h-0 flex-1 items-center justify-center px-[6cqw] pb-[7cqw]">
            <div style={{ width: caption ? "70cqw" : "78cqw" }}>{deviceNode}</div>
          </div>
        </div>
      )}
    </div>
  );
}
