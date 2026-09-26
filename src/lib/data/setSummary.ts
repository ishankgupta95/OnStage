import { bgCss } from "@/lib/onstage/data";
import { SOURCE_LOCALE } from "@/lib/onstage/locales";
import type { ScreenshotSet, SetDoc } from "./types";

/** The parts of a set's library record that come from its document. */
export type SetSummary = Pick<ScreenshotSet, "frameCount" | "swatch" | "swatches" | "status" | "sub" | "store">;

/**
 * What a set's library record says about its document (plan S2.2, GAP-10):
 * how many frames, the first frame's background, whether every frame has a
 * screenshot yet, the store it targets and its captions' language. Written by `createSet` and every
 * `saveSetDoc`, so the dashboard shows the set as it was last saved.
 */
export function summarizeDoc(doc: Pick<SetDoc, "frames" | "store">): SetSummary {
  const frames = Array.isArray(doc.frames) ? doc.frames : [];
  const shots = frames.filter((f) => typeof f?.screenshot === "string" && f.screenshot).length;
  const store = doc.store === "play" ? "play" : "apple";
  return {
    frameCount: frames.length,
    swatch: bgCss(frames[0]?.bg ?? ""),
    swatches: frames.slice(0, 4).map((f) => bgCss(f?.bg ?? "")),
    // Ready once every frame has its screenshot; until then a draft.
    status: frames.length > 0 && shots === frames.length ? "Ready" : "Draft",
    // The captions' language — not `lang`, the filmstrip's view chip.
    sub: `${store === "play" ? "Google Play" : "App Store"} · ${SOURCE_LOCALE}`,
    store,
  };
}
