import type KonvaNS from "konva";
import { bgCss, capInk } from "../data";

/**
 * The Play feature graphic's layout (EXPORT-7), pure so it can be checked
 * without a renderer: the set's own frame-0 background and caption ink, the
 * app name only when something names the app, and every line inside Play's
 * safe zone — the middle of the graphic, which Play never crops
 * (templates-v2 spec: x 8–92 %, y 12–88 %).
 */

export type FeatureText = {
  /** The app's name, or frame 0's caption (the line the renderer measures). */
  role: "name" | "caption";
  text: string;
  x: number;
  y: number;
  width: number;
  /** The box the text must fit in: longer text wraps, then ends in "…". */
  height: number;
  fontSize: number;
  fontStyle: string;
  lineHeight: number;
  fill: string;
  wrap: "none" | "word";
};

export type FeatureLayout = {
  /** The CSS gradient the graphic is painted with. */
  background: string;
  texts: FeatureText[];
};

/** Play's safe zone, as fractions of the graphic. */
export const FEATURE_SAFE = { left: 0.08, right: 0.92, top: 0.12, bottom: 0.88 } as const;

/** The most lines the caption may take: under the name, and alone. */
export const FEATURE_CAPTION_LINES = { named: 3, alone: 4 } as const;

/** The caption ink at 78 % — the tagline's softer tone. */
function soften(ink: string): string {
  const hex = ink.replace("#", "");
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},0.78)`;
}

export function featureGraphicLayout(input: {
  /** Null when nothing names the app: no name line at all. */
  appName: string | null;
  /** Frame 0's caption, already in the locale being written. */
  caption: string;
  /** Frame 0's background id. */
  bg: string;
  w: number;
  h: number;
  /**
   * The lines the caption really takes, once the renderer has wrapped it in
   * the box this function gave it without this (the most lines allowed). The
   * block is centred on what is drawn, not on the room it might need.
   */
  captionLines?: number;
}): FeatureLayout {
  const { w, h } = input;
  // One paragraph, single-spaced and trimmed: the graphic is a wider layout
  // than a frame, so the caption's own line breaks don't carry over, and
  // stray spaces or blank lines would count as drawn lines (and Konva ends a
  // line with "…" when it thinks text is left over).
  const caption = input.caption.replace(/\s+/g, " ").trim();
  const x = Math.round(w * FEATURE_SAFE.left);
  const safeW = Math.round(w * (FEATURE_SAFE.right - FEATURE_SAFE.left));
  const top = Math.round(h * FEATURE_SAFE.top);
  const bottom = Math.round(h * FEATURE_SAFE.bottom);
  const ink = capInk(input.bg);
  const k = h / 500; // designed against Play's 1024 × 500
  const linesOf = (max: number) => Math.min(max, Math.max(1, Math.round(input.captionLines ?? max)));
  // Konva fits a line to the box, then may swap its last three characters
  // for a wider "…": a font size of slack keeps even that inside the zone.
  const widthFor = (fontSize: number) => safeW - fontSize;
  // Half a line of spare height: Konva's running line total mustn't round
  // past the box and drop the last line.
  const boxFor = (lines: number, linePx: number) => Math.ceil((lines + 0.5) * linePx);

  const texts: FeatureText[] = [];
  if (input.appName && !caption) {
    // A name and no caption: the name alone, in the middle.
    const nameSize = Math.round(68 * k);
    const nameLine = nameSize * 1.15;
    texts.push({
      role: "name",
      text: input.appName,
      x,
      y: Math.round(top + (bottom - top - nameLine) / 2),
      width: widthFor(nameSize),
      height: Math.ceil(nameLine),
      fontSize: nameSize,
      fontStyle: "600",
      lineHeight: 1.15,
      fill: ink,
      wrap: "none",
    });
  } else if (input.appName) {
    const nameSize = Math.round(68 * k);
    const nameLine = nameSize * 1.15;
    const capSize = Math.round(32 * k);
    const capLine = capSize * 1.25;
    const lines = linesOf(FEATURE_CAPTION_LINES.named);
    const gap = Math.round(14 * k);
    // The name and the caption's drawn lines sit in the middle of the zone.
    const y = Math.round(top + (bottom - top - (nameLine + gap + lines * capLine)) / 2);
    texts.push({
      role: "name",
      text: input.appName,
      x,
      y,
      width: widthFor(nameSize),
      height: Math.ceil(nameLine),
      fontSize: nameSize,
      fontStyle: "600",
      lineHeight: 1.15,
      fill: ink,
      wrap: "none",
    });
    texts.push({
      role: "caption",
      text: caption,
      x,
      y: Math.round(y + nameLine + gap),
      width: widthFor(capSize),
      height: boxFor(lines, capLine),
      fontSize: capSize,
      fontStyle: "normal",
      lineHeight: 1.25,
      fill: soften(ink),
      wrap: "word",
    });
  } else if (caption) {
    // No app name: the caption alone, larger, in the middle.
    const capSize = Math.round(44 * k);
    const capLine = capSize * 1.2;
    const lines = linesOf(FEATURE_CAPTION_LINES.alone);
    texts.push({
      role: "caption",
      text: caption,
      x,
      y: Math.round(top + (bottom - top - lines * capLine) / 2),
      width: widthFor(capSize),
      height: boxFor(lines, capLine),
      fontSize: capSize,
      fontStyle: "600",
      lineHeight: 1.2,
      fill: ink,
      wrap: "word",
    });
  }
  return { background: bgCss(input.bg), texts };
}

/**
 * The graphic's text as Konva nodes (renderSet draws them; Konva itself is
 * passed in, so it stays a lazy import). Konva wraps the caption in the most
 * room it may have, says how many lines it really takes, and the block is
 * then centred on those.
 */
export function featureTextNodes(
  Konva: typeof KonvaNS,
  spec: Omit<Parameters<typeof featureGraphicLayout>[0], "captionLines">,
  fontFamily: string,
): InstanceType<typeof KonvaNS.Text>[] {
  const layout = featureGraphicLayout(spec);
  const nodes = layout.texts.map(
    (t) =>
      new Konva.Text({
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        text: t.text,
        fontFamily,
        fontStyle: t.fontStyle,
        fontSize: t.fontSize,
        lineHeight: t.lineHeight,
        fill: t.fill,
        wrap: t.wrap,
        ellipsis: true,
      }),
  );
  const caption = nodes[layout.texts.findIndex((t) => t.role === "caption")];
  if (caption) {
    const placed = featureGraphicLayout({ ...spec, captionLines: caption.textArr.length });
    placed.texts.forEach((t, i) => nodes[i].setAttrs({ y: t.y, height: t.height }));
  }
  return nodes;
}
