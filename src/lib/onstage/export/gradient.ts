/**
 * Translate the design's CSS `linear-gradient(<angle>, <stops>)` strings into
 * the start/end points and colour stops Konva wants, so an exported frame is
 * painted from exactly the same source of truth the canvas renders.
 */
type KonvaGradient = {
  start: { x: number; y: number };
  end: { x: number; y: number };
  stops: (number | string)[];
};

type Stop = { color: string; at: number | null };

function parseStops(body: string): { angle: number; stops: Stop[] } {
  // Split on top-level commas (colour functions can contain their own).
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  let angle = 180; // CSS default is `to bottom`
  if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift()!);

  const stops = parts.map((p) => {
    const m = p.match(/^(.*?)\s+([\d.]+)%$/);
    return m ? { color: m[1].trim(), at: parseFloat(m[2]) / 100 } : { color: p, at: null };
  });
  return { angle, stops };
}

/** Fill in the stops CSS would interpolate, so Konva gets explicit offsets. */
function normalise(stops: Stop[]): { color: string; at: number }[] {
  const out = stops.map((s, i) => ({
    color: s.color,
    at: s.at ?? (i === 0 ? 0 : i === stops.length - 1 ? 1 : NaN),
  }));
  for (let i = 0; i < out.length; i++) {
    if (!Number.isNaN(out[i].at)) continue;
    let prev = i - 1;
    while (prev >= 0 && Number.isNaN(out[prev].at)) prev--;
    let next = i + 1;
    while (next < out.length && Number.isNaN(out[next].at)) next++;
    const a = out[prev].at;
    const b = out[next].at;
    out[i].at = a + ((b - a) * (i - prev)) / (next - prev);
  }
  return out as { color: string; at: number }[];
}

/**
 * @param w,h        the box the gradient paints
 * @param spanScale  panorama: how many frame-widths the gradient spans
 * @param offsetX    panorama: where this frame sits along that span
 */
export function cssGradientToKonva(
  css: string,
  w: number,
  h: number,
  spanScale = 1,
  offsetX = 0,
): KonvaGradient {
  const body = css.slice(css.indexOf("(") + 1, css.lastIndexOf(")"));
  const { angle, stops } = parseStops(body);

  const gw = w * spanScale;
  // CSS gradient geometry: 0deg points up, angles run clockwise, and the line
  // is long enough that the corners land on its ends.
  const rad = (angle * Math.PI) / 180;
  const len = Math.abs(gw * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  const cx = offsetX + gw / 2;
  const cy = h / 2;
  const dx = (Math.sin(rad) * len) / 2;
  const dy = (-Math.cos(rad) * len) / 2;

  const konvaStops: (number | string)[] = [];
  for (const s of normalise(stops)) {
    konvaStops.push(s.at, s.color);
  }
  return {
    start: { x: cx - dx, y: cy - dy },
    end: { x: cx + dx, y: cy + dy },
    stops: konvaStops,
  };
}
