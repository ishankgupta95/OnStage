> **Templates v2 — full design + engineering spec.** Produced by the Sept 2026 audit (three independent design proposals — P1 conversion, P2 editorial, P3 dimensional — scored and merged by a judge).
> Executed through `onstage-plan.md`. **Phase mapping:** this spec's "Phase 1/2/3/4" = the plan's **T1/T2/T3/T4** (plan Phases 5, 7, 8 and 9).
> Mockup data for every template (5 example frames each, CSS-renderable) lives in `docs/templates-v2-examples.json`; the conventions for that file are its `conventions` key.
> Line numbers cited below were correct on 2026-09-26 — re-locate by symbol if the code has moved.
> **Where this spec and `onstage-plan.md` differ, the plan wins** — the plan was reviewed for sequencing after this spec was written. Notably: `SetDoc.appName` arrives earlier (S3.4); the font gate `ensureFonts()` is built in S4.4; per-slot layout and `layout/phase1.ts` start in S4.3; "today's layout" for `classic` means the frozen S4.6 baseline (`classic.golden.json`), not the pre-fix code; `applyTemplate` runs only inside the editor or on a new doc before `createSet` (plan D10); `CAPTION_LOCALES` keeps its old keys until the S9.1 migration.

# Onstage templates: verdict and final system

Judge + synthesiser pass over `00-critique.md` and the three proposals (`01` conversion, `02` editorial, `03` dimensional).
Feasibility claims were spot-checked against `data.ts`, `onstage.ts`, `CanvasStage.tsx`, `renderSet.ts`, `gradient.ts`, `geometry.ts`,
`sampleScreen.ts`, `types.ts` and `layout.tsx`. The companion file `final-templates.json` holds the machine-readable mockup data.

## 0. Summary

- **Architecture.** Take P1's pure resolver and its single Canvas2D painter, which both renderers call. Add P2's editor, rendered at design size and
  scaled with one CSS transform, plus P2's per-aspect patches. Add P3's `sequence {first, cycle, last}` and anchored vertical units. Reject P3's
  SVG editor painter: two separate 2D implementations would drift again.
- **The 12 templates.** Ridgeline, Headliner, Marker, Big Number, Field Notes, Nocturne, Index, Monolith, Duo, Gallery, Signal, Blueprint
  (3 from P1, 4 from P2, 5 from P3). They use 12 different compositions: caption on top, bottom or beside the device; 0, 1 or 2 devices; framed and
  frameless; flat and 3D. Five are light and seven dark. The set includes one panorama that crosses seams, one type-only frame, one social-proof beat
  with a Play fallback, two serif sets and one frameless set.
- **Default first-open set.** Ridgeline in Trailhead's own kit (petrol and teal with amber), with five sample screens that each match their caption.
- **Phase 1 ships on its own.** It covers five templates (Ridgeline, Headliner, Field Notes, Signal, Gallery), the new default, the new sample screens
  and the parity fixes. It needs only primitives the renderer already has: one linear gradient (hard stops included), one text node and one Three
  device. Those gain a few new parameters: weight, case, per-frame ink, and device x and top.

## 1. Scores (1–10)

| Criterion | P1 Conversion | P2 Editorial | P3 Dimensional |
|---|---|---|---|
| Visual quality and distinctiveness | **7**: 12 real compositions, but four are variations of "big flat phone bleeding off the bottom" (Headliner, Marker, Split, Pocket), and Pop's candy stickers look generic. | **9**: the most original. The caption moves (top, bottom, beside, behind, on a panel), and the giant word, numeral, mat and scrim have no equivalent in competing tools. | **8**: the most "wow" (a phone spanning a seam, ridge panorama, aurora mesh, three-phone fan), but tape strips, sticky notes, rings and stars add clutter. |
| Conversion / ASO at search-thumbnail size | **9**: the only one designed for a ~115pt thumbnail. Headlines are .12–.15W and devices .80–.92W; the device line is fixed; the keyword is highlighted; proof swaps out on Play and banned words are checked before export. | **6**: allows headlines as small as .06W. Nocturne, Gallery and Monolith put small captions at the bottom, against the 42-of-49 top-caption data, and tone-on-tone words disappear at thumbnail size. | **6**: devices are often only .56–.66W and headlines .086–.112W. Phones tilted back 34° and the phone split across the 3\|4 seam put unreadable UI into the frames search shows. |
| Implementability with canvas↔export parity here | **8**: one painter serves both renderers, and the fixes are concrete (`screenRect`, `setViewOffset`, texture size, Euler order). Loses a point for 12 eager fonts and projected-bbox fits everywhere. | **8**: the cleanest parity story, with reference units, one `paint2D` and a CSS-scaled editor. It is honest about risks: Loupe's 1.30W raster cost, opsz pinning, Instrument Serif shipping only weight 400. | **6**: SVG in the editor and Konva in export are two 2D implementations, where baselines, strokes and gradients can drift. Up to three devices plus heavy pitch and roll stress the render box and the 16MP cap. |
| Variety across the set | **7**: role sequences give each set a hero → proof → closer arc, but most templates keep one flat pose, so the rhythm mostly comes from swapping two grounds. | **6**: excellent between templates, weak within one. Nocturne, Index, Monolith and Gallery keep one composition for all five frames and only change the colour. | **9**: every template alternates dramatic and quiet frames, and `{first, cycle, last}` handles any frame count. Best rhythm within a set. |
| Fit with the Nocturne brand | **6**: Headliner in the Trailhead kit fits, but Pop, Split and the pastel Duo pull toward loud consumer-ad styling that the product UI doesn't share. | **9**: near-black with one electric hue, mono folios and restraint are Nocturne's own vocabulary. | **7**: Ridgeline in brand colours and the dark sets fit; Fanfare and Pop Card lean toward generic marketing gloss. |
| **Total /50** | **37** | **38** | **36** |

No proposal wins on its own. P1 has the conversion discipline and the most buildable renderer, P2 has the taste, and P3 has the rhythm. The synthesis
uses P1's contract with P2's editor and aspect patches, and P3's sequencing, then draws the best compositions from all three.

## 2. What the synthesis keeps, and what it rejects

**Kept**
- From P1:
  - `resolveArtboard()` plus one Canvas2D `paint2D()` used by the editor `<canvas>` layers and by the export (inside `Konva.Shape.sceneFunc`).
  - Store rules inside the resolver: proof becomes feature on Play, the Play text area stays ≤20%, and a banned-word preflight runs.
  - Thumbnail type floors, `*starred*` accent runs, fixed device lines, and `minVisible` bleed fits.
  - `proof.placeholder`, `screenRect()` and screen texture sized to the on-artboard pixels.
- From P2:
  - The editor lays out at design size and scales with one CSS transform, which fixes the 72%-zoom drift for good.
  - Caption blocks: kicker, rule, headline, sub.
  - `bigWord`, numerals and mats; per-aspect patches; one hard font gate; `frame.i18n`.
  - Kept slugs whose old promises now become true: `field-notes`, `nocturne`, `blueprint`, `signal`.
- From P3:
  - `sequence {first, cycle, last}`, so `addFrame` asks the template instead of cloning frame 0.
  - Vertical anchors (top, bottom or fraction), so type and bleed survive aspect changes.
  - Strip-space items, where one seam device is rendered once and drawn into both frames.
  - Hex-only colours with same-RGB fade stops; shadows on unrotated wrappers.
  - Old slugs kept as static aliases.

**Rejected or fixed**
- P3's SVG editor painter: replaced by the single Canvas2D painter.
- P3's phone split across the F3\|F4 seam (and P1's across 2\|3): frame 3 is a search thumbnail. It becomes a 25% peek across the **4\|5** seam, so
  every PNG still reads on its own.
- P2's .06W headline floor: raised. No headline goes below .085W, and templates with bottom captions carry a large element that does read at
  thumbnail size (the Monolith word, the Index numeral).
- Tone-on-tone words (P2 Monolith): now a readable tint, with the phone's top edge sitting on the word's baseline.
- Dropped outright:
  - Pocket: the same composition as Nocturne.
  - Loupe: a 1.30W device is too costly to rasterise.
  - Horizon at pitch 34°: illegible UI.
  - Fanfare: three phones become clutter at thumbnail size.
  - Pop and Playground: generic.
  - Aurora: overlaps with Nocturne.
  - Orbit.
  - Pop Card: its floating chips survive as Ridgeline's stat card and Duo's chat chips.
- A placeholder rating in the default set: removed. Social proof lives in Headliner only, and is dashed and flagged until the user enters a real value.
- Fonts: 12 new families loaded eagerly is too many. `layout.tsx` gets only the default set's weights; everything else loads through a lazy
  `FONT_REGISTRY`.

## 3. Final data model

```ts
// ═══ src/lib/onstage/templates/model.ts ═══ static data only: no React, Konva or Three imports
//
// UNITS
//   U      multiples of artboard WIDTH. export px = u × slot.w; design px = u × 268. Every size (type, device width,
//          stroke, radius, blur, grid pitch) and every x offset.
//   Y      a vertical ANCHOR, so type sized in U keeps its offset on every aspect and a bleeding device keeps its bleed.
//   strip  panorama items use x in frame units 0..5 (authored on a 5-frame strip, stretched to N).
// AUTHORING artboard = iPhone 6.9″ at 268×580 design px (h/w 2.164). Every other aspect is derived, then patched.
export type U = number;
export type Deg = number;
export type Hex = `#${string}`;                         // #rrggbb | #rrggbbaa; artwork colour, never a theme token
export type AspectClass = "phone" | "play" | "tablet" | "feature";
//   phone w/h ≈ .46 · play .5625 · tablet .625 (Play 7″) / .75 (iPad 13″) · feature 1024×500
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export type Y =
  | { top: U }                                          // from the top edge (text, top-anchored devices)
  | { bottom: U }                                       // element's BOTTOM edge this far above the bottom; <0 = bleed
  | { frac: number }                                    // fraction of H (split lines, mats, horizons)
  | { after: TextField | "rule" | "proof"; gap: U };    // flows under a resolved block

export type Stop = readonly [offset: number, color: Hex];
export type Paint =
  | { kind: "solid"; color: Hex }
  | { kind: "linear"; angle: Deg; stops: Stop[] }       // CSS angle convention, any deg; hard stop = repeated offset
  | { kind: "radial"; cx: number; cy: Y; rx: U; ry?: U; stops: Stop[] };  // fade stop = same RGB at alpha 00
export type Shadow = { color: Hex; opacity: number; blur: U; x?: U; y: U };

// ── palette: every ground carries the inks that were contrast-checked against it ──
export type Ground = {
  paint: Paint;
  layers?: Decoration[];                                // glows / grain / grid / dots that belong to this ground
  ink: Hex; muted: Hex; accent: Hex;
  accentInk: Hex;                                       // text colour on a marker or pill
  line?: Hex; mat?: Hex; word?: Hex; shade?: Hex;
};
export type KitRole = "Primary" | "Deep" | "Surface" | "Accent" | "Paper";   // = BrandKit.colors[].role
export type BrandMap = Partial<Record<"ground0" | "ground1" | "ink" | "accent" | "mat", KitRole>>;

// ── type ──
export type FontFamily =
  | "Inter" | "Fraunces" | "Plus Jakarta Sans" | "JetBrains Mono"           // eager: layout.tsx <link>
  | "Bricolage Grotesque" | "Space Grotesk" | "Geist" | "Geist Mono" | "Instrument Sans"
  | "DM Serif Display" | "DM Sans" | "Instrument Serif" | "Anton";       // lazy: FONT_REGISTRY
export type TextStyle = {
  family: FontFamily; weight: 400 | 500 | 600 | 700 | 800; italic?: boolean;
  size: U; minSize?: U;                                 // auto-fit: shrink in 2% steps to minSize, then warn
  lineHeight: number; tracking: number;                 // × size; em
  case?: "none" | "upper" | "lower";                    // engine applies toLocaleUpperCase(locale) before measuring
  color?: "ink" | "muted" | "accent" | "word" | Hex;
};
export type Emphasis =                                  // what the one *starred* run in a caption becomes
  | { kind: "color"; color?: "accent" | "muted" }       // muted = the two-tone "dim" treatment
  | { kind: "italic"; family: FontFamily; weight: TextStyle["weight"]; scale: number }   // face swap, in accent
  | { kind: "marker"; height: number; drop: number; padX: number; rotate: Deg; radius: number }  // em
  | { kind: "pill"; padX: number; padY: number }                                         // em, full radius
  | { kind: "underline"; thickness: U; offset: U };
export type TypeSpec = {
  headline: TextStyle & { maxLines: 2 | 3 | 5; balance: boolean };
  emphasis: Emphasis;
  sub?: TextStyle & { maxLines: 1 | 2 | 5 };
  kicker?: TextStyle & { format: string };              // tokens {nn} {n} {count} {LABEL} {APP}
  stat?: TextStyle & { unitScale: number; unitWeight: TextStyle["weight"] };   // "7h 42m": units at unitScale
  bigWord?: TextStyle & { source: "kicker" | "accent" | "appName"; maxWidth: U };
  numeral?: TextStyle & { outline?: { width: U; opacity: number } };
};

// ── placement ──
export type TextField = "caption" | "sub" | "kicker" | "stat" | "numeral" | "bigWord";
export type TextSlot = {
  field: TextField;
  x: number; w: number;                                 // fractions of W
  y: Y; maxH?: U;                                       // fixed box: text shrinks to fit and NEVER pushes a device
  align: "left" | "center" | "right"; valign?: "top" | "middle" | "bottom";
  sizeMul?: number;                                     // hero 1.08, proof .85 …
  z?: "under" | "over";                                 // bigWord and numerals sit under the device
};
export type Pose = { yaw: Deg; pitch: Deg; roll: Deg }; // CSS rotateY / rotateX / rotateZ conventions
export type Finish = "graphite" | "silver" | "gold" | "black" | "white";
export type DeviceSlot = {
  cx: number;                                           // centre x as a fraction of W; <0 or >1 bleeds sideways
  w: U;                                                 // face width before fit (phone class)
  y: Y;                                                 // anchors the TOP edge, or the bottom edge with { bottom }
  fit: { minVisible: number; clearText?: U; maxH?: number; minW?: U };  // shrink until satisfied; < minW → drop
  pose: Pose; lift?: U;                                 // lift = translateZ in camera space (after rotation)
  body: "device" | "card";                              // card = frameless screen in the slot's screenshot aspect
  source: "self" | "next" | "prev" | "b";               // b = frame.screenshotB
  seam?: "next";                                        // strip: also drawn in frame i+1 at x − W (rendered once)
  shadow?: Shadow | null; finish?: Finish;
};
export type Crop = { x: number; y: number; w: number; h: number };   // fractions of the screen image
export type Decoration = { z: "under" | "over"; space?: "frame" | "strip"; opacity?: number } & (
  | { kind: "rect"; x: number; y: Y; w: U; h: U | { frac: number }; radius?: U; fill: Paint | "mat" | "accent"; rotate?: Deg }
  | { kind: "poly"; points: [number, number][]; fill: Paint | "ink" | "accent" }       // (W, H) fractions; antialiased
  | { kind: "path"; points: [number, number][]; smooth?: boolean; close?: "bottom"; fill?: Hex; stroke?: Hex; width?: U; dash?: U[] }
  | { kind: "glow"; cx: number; cy: Y; rx: U; ry: U; color: Hex; alpha: number; mid?: number }
  | { kind: "grain"; seed: number; opacity: number; tile: U }                          // seeded 256px tile (mulberry32)
  | { kind: "grid"; pitch: U; width: U; color: Hex; majorEvery?: number; majorWidth?: U; majorColor?: Hex; origin: [number, Y] }
  | { kind: "dots"; pitch: U; r: U; color: Hex }                                       // procedural arcs, never a bitmap
  | { kind: "rule"; x: number; w: number; y: Y; width: U; color: "line" | "ink" | "accent" }
  | { kind: "laurel"; cx: number; y: Y; w: U }                                         // reads frame.proof; Apple slots only
  | { kind: "chip"; x: number; y: Y; w: U; fill: Hex; ink: Hex; rotate?: Deg; callout: number }
  | { kind: "statCard"; x: number; y: Y; w: U; rotate?: Deg }                          // reads frame.callouts[0]
  | { kind: "zoom"; crop?: Crop; scale: number; cx: number; cy: Y; radius: U; ring: U; leader?: boolean }  // device 0
  | { kind: "annotations"; gutter: [number, number]; labelY: Y[] }                     // frame.notes; device 0 must be flat
  | { kind: "dimension"; side: "right" | "top"; offset: U; tick: U }                   // label = screenshot px width | "SAMPLE"
  | { kind: "titleBlock"; x: number; y: Y; w: number; h: U }
);

// ── roles, sequence, template ──
export type Layout = { ground: number | "cycle"; texts: TextSlot[]; devices: DeviceSlot[]; decor?: Decoration[]; mirror?: boolean };
export type Role = {
  id: string; label: string;                            // filmstrip chip: "Hero", "Proof", "Zoom" …
  layout: Layout;
  aspect?: { play?: DeepPartial<Layout>; tablet?: DeepPartial<Layout> };  // deep-merged over the phone layout
  store?: { play?: string };                            // role used on Play slots (proof → feature)
  needs?: ("proof" | "stat" | "notes" | "callouts" | "screenshotB")[]; fallback?: string;
  typeOnly?: boolean;                                   // Apple 2.3.3: allowed only as sequence.last, once
};
export type Template = {
  slug: string; version: number; name: string; vibe: string;
  source: "conversion" | "editorial" | "dimensional";
  categories: string[];                                 // "Suits …"; filter tags are DERIVED from data, never authored
  fonts: { family: FontFamily; weights: number[]; italics?: number[]; axes?: string }[];   // exact css2 request
  palette: { grounds: Ground[]; brand?: BrandMap };
  type: TypeSpec;
  device: { finish: Finish; lens: number /* camera distance in device widths; today ≈ 7.95 */; shadow: Shadow | null };
  roles: Role[];
  sequence: { first: string[]; cycle: string[]; last?: string; minForLast?: number };
  strip?: { paint?: Paint; decor: Decoration[] };       // panorama layer under every frame
  feature: Layout;                                      // 1024×500; focal content inside x .08–.92, y .12–.88
  sample: { app: "trailhead" | "ledger" | "quill"; captions: string[]; subs?: string[]; kickers?: string[];
            stats?: string[]; callouts?: Callout[][]; notes?: string[][]; proof?: Proof };    // previews only
  phase1?: Phase1Cut;                                   // what applyTemplate writes before the resolver ships
  since: 1 | 2 | 3;                                     // phase in which the full spec renders; the gallery hides later ones
};
// Derived tags: Light/Dark (luminance under the headline box), Panoramic (strip), Multi-device, Frameless (card body),
// Callouts (zoom|annotations), Social proof (laurel), Bold type (headline ≥ .14W), Serif, Mono, Type-only.

// ── phase 1: a template expressed in the existing renderer's parameters (no new draw primitives) ──
export type Phase1Cut = {
  captionFont: FontFamily; captionSize: number;         // px = captionSize × .62 on the 268 grid (today's formula)
  captionStyle: { weight: number; case: "none" | "upper"; tracking: number; lineHeight: number; maxLines: 2 | 3 };
  align: "left" | "center"; frameColor: Finish; shadow: boolean; panorama: boolean; device?: "none";
  frames: { bg: string /* raw linear-gradient() */; ink: Hex; tiltX: number; tiltY: number; depth: number;
            scale: number; x: number; top: number /* fraction of 580 */ }[];
  extend: number[];                                     // indices of frames[] that addFrame cycles through
};

// ═══ src/lib/data/types.ts ═══ additive only: every new field is optional, so stored docs still load
export type SampleScreenId = "map" | "pace" | "nearby" | "share" | "season" | "today";
export type Proof = { value: string; label: string; placeholder?: boolean };   // placeholder → dashed + preflight warning
export type Callout = { label?: string; value?: string; unit?: string; text?: string };
export type SetFrame = {
  caption: string;                                      // one *starred* run = the emphasis; "\*" = literal asterisk
  sub?: string; kicker?: string; stat?: string;
  proof?: Proof; callouts?: Callout[]; notes?: string[]; zoom?: Crop;
  screenshot: string | null; screenshotB?: string | null;
  sample?: SampleScreenId;                              // painted while screenshot is null
  role?: string;                                        // pinned role; default = sequence(i, N)
  pose?: Partial<Pose> & { scale?: number; dx?: U; dy?: U };   // user overrides; undefined = template value
  i18n?: Record<string, { caption?: string; sub?: string; kicker?: string }>;   // phase 4
  // legacy fields, read by "classic" and by phase-1 cuts; phase 2 migrates edited values into `pose`
  bg: string; tiltX: number; tiltY: number; depth: number; scale: number;
  ink?: Hex; x?: number; top?: number;                  // phase-1 parameters (undefined = legacy centring)
};
export type SetDoc = {
  schema?: 2 | 3;                                       // missing = a pre-template doc
  frames: SetFrame[];
  template?: { slug: string; version: number; brandKitId?: string };   // missing = "classic" (today's layout, exact)
  appName?: string;                                     // feature graphic + zip name (hard-coded "Trailhead" today)
  style?: { font?: FontFamily; typeScale?: number; align?: "left" | "center" | "right"; finish?: Finish; shadow?: boolean };
  captionStyle?: Phase1Cut["captionStyle"];             // phase 1 only
  device: string; frameColor: string; captionFont: string; align: "left" | "center" | "right";
  captionSize: number; panorama: boolean; shadow: boolean; lang: string; store: "apple" | "play"; workMode: "guided" | "canvas";
};
export declare function migrateSetDoc(raw: unknown): SetDoc;   // src/lib/data/migrate.ts

// ═══ src/lib/onstage/templates/resolve.ts ═══ the ONLY place layout math lives
export type Rect = { x: number; y: number; w: number; h: number };
export type SlotInfo = { w: number; h: number; cls: "iphone" | "ipad" | "android-phone" | "android-tablet";
                         aspect: AspectClass; store: "apple" | "play" };
export type Measure = (text: string, font: string, trackingPx: number) => { w: number; ascent: number; descent: number };
export type Draw =                                      // absolute px, painted in order
  | { t: "fill"; paint: unknown /* resolved px gradient */; path: unknown; opacity?: number }
  | { t: "stroke"; path: unknown; width: number; color: string; dash?: number[]; cap?: "round" | "butt" }
  | { t: "text"; x: number; baseline: number; text: string; font: string; trackingPx: number; fill: string;
      box?: Rect & { r: number; rotate: number; fill: string } }                     // marker / pill behind the run
  | { t: "image"; src: "screen0" | "screen1" | "grain"; crop: Crop; x: number; y: number; w: number; h: number;
      radius: number; rotate: number; border?: { color: string; width: number }; shadow?: unknown };
export type ResolvedDevice = {
  cx: number; cy: number; w: number; h: number;          // unrotated face, artboard px
  pose: Pose; liftPx: number; lensPx: number; finish: Finish; geomClass: SlotInfo["cls"] | "frameless";
  shadow: { color: string; blur: number; y: number } | null; screen: "screen0" | "screen1";
  bbox: Rect;                                           // 8 projected corners + 4% pad → render box (replaces dw×1.55 / dh×1.2)
  visible: Rect;                                        // bbox ∩ artboard → camera.setViewOffset window
  seamFrom?: number;                                    // drawn here but owned (and rendered) by frame seamFrom
};
export type Warning = "text-shrunk" | "text-overflow" | "placeholder-proof" | "play-text-area" | "play-banned-word"
  | "missing-screenshotB" | "screen-upscaled" | "font-missing" | "type-only-frame";
export type ResolvedArtboard = { w: number; h: number; under: Draw[]; devices: ResolvedDevice[]; over: Draw[];
                                 hit: { caption: Rect; devices: Rect[] }; warnings: Warning[] };
export declare function resolveArtboard(doc: SetDoc, i: number, slot: SlotInfo, locale: string, measure: Measure): ResolvedArtboard;
// src/lib/onstage/paint/paint2D.ts: ONE painter for the editor <canvas> layers AND the export (Konva.Shape sceneFunc → ctx._context)
export declare function paint2D(ctx: CanvasRenderingContext2D, draws: Draw[], images: Record<string, CanvasImageSource>): void;
// src/lib/onstage/templates/device.ts: the one file where pose conventions live
//   CSS  : wrapper {left, top, width, height from cx/cy/w/h; perspective: lensPx; perspective-origin: 50% 50%}
//          body transform: translate3d(0,0,liftPx) rotateX(pitch) rotateY(yaw) rotateZ(roll)     (matrix Rx·Ry·Rz)
//   Three: group.rotation.set(-pitch, yaw, -roll, "XYZ"); group.position.z = lift              (same matrix, y mirrored)
//          perspectiveDistance = lensPx / w; setViewOffset(visible within bbox); texture = clamp(screen px, 1024, 4096)
export declare function deviceCss(d: ResolvedDevice): { wrapper: Record<string, string>; body: Record<string, string> };
export declare function deviceThree(d: ResolvedDevice): unknown /* render3D params */;
```

Why the sign flips are right: CSS space is Three space mirrored in y (S = diag(1,−1,1)). S·Rx(a)·S = Rx(−a), S·Ry(a)·S = Ry(a) and
S·Rz(a)·S = Rz(−a). So CSS `rotateX(p) rotateY(y) rotateZ(r)` equals Three Euler `XYZ(−p, y, −r)`. With lift applied last (in camera space), the
current translateZ-before-rotate mismatch (critique, CanvasStage.tsx:74-77 vs renderDevice.ts:303-305) disappears.

## 4. The 12 templates

### 4.0 Conventions (used in the specs and in `final-templates.json`)
- **Artboard.** 268×580 design px (iPhone 6.9″). "W" is the width. Device `x`/`y` in the JSON are the **device centre** as fractions of
  268 and 580; y > 1 means the device bleeds.
- **Device scale.** `scale` is the device width ÷ 176 design px, which is today's `SetFrame.scale` unit: 1.0 = .657W. iPhone height is
  369.75 × scale design px (aspect .476). A frameless card is 380.95 × scale (screenshot aspect .462). The phase-1 scale clamp widens from
  0.7–1.3 to 0.6–1.6.
- **Pose.** tiltX = pitch (CSS rotateX; + tips the top away), tiltY = yaw (CSS rotateY; − turns the screen toward the left, which is how a phone on
  the right faces the centre), roll = CSS rotateZ (+ is clockwise). The presets stay `Right` (y −17, d 40), `Left` (y +17, d 40), `Hero`
  (9/−22/68), plus a new **`Rise`** preset (x 10, y 0, d 0) used by Ridgeline and Nocturne.
- **Type sizes** are in W. Design px = size × 268, and the phase-1 `captionSize` = px ÷ 0.62. The thumbnail read is 1W ≈ 115pt, so .13W ≈ 15pt.
  Examples: .18W = 48.2px (cs 78), .15W = 40.2 (65), .135W = 36.2 (58), .125W = 33.5 (54), .112W = 30.0 (48), .10W = 26.8 (43),
  .09W = 24.1 (39).
- **Captions** mark one accent run with `*asterisks*`. Captions are stored in sentence case; `case: upper` is applied by the engine.
- **Degrades.** Unless a template says otherwise:
  - **Play (0.5625, H 476):** top-anchored text and device tops keep their W offsets. A bleeding device shows less of itself and shrinks only to
    meet `minVisible`. `{frac}` items (splits, mats) scale with H.
  - **Tablet (0.625 or 0.75; iPad H 357):** type ×0.8. The device family switches to tablet at w ×0.8 of the phone value, subject to `minVisible`.
    A back device whose width falls below `minW` is dropped.
  - **Feature graphic (1024×500):** always a dedicated landscape layout, never a squashed portrait. It is never a flat white or dark-grey ground
    (Play rule), and focal content stays inside x .08–.92, y .12–.88.

### 4.1 Overview

| # | Template | From | Ground | Composition (why it is not a recolour) | Caption | Accent | Fonts | Example app | Ships |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Ridgeline** `ridgeline` | P3 | dark teal panorama | one strip of ridges and a route line; phones rise from the ridges; one phone peeks across the 4\|5 seam | top-left + kicker | colour | Plus Jakarta Sans 800 | outdoor nav (and the Trailhead default) | P1 cut → full in P3 |
| 2 | **Headliner** `headliner` | P1 | dark cobalt | giant centred headline over a giant flat phone bleeding off the bottom; rating laurel on frame 2 | top-centre | colour | Inter 800 | language learning | P1 cut → full in P2 |
| 3 | **Marker** `marker` | P1 | light chalk | left headline with a highlighter swipe; the phone zig-zags off the left and right edges | top-left | highlighter | Bricolage Grotesque 800 | study / flashcards | P2 |
| 4 | **Big Number** `big-number` | P1 | dark mint | one giant stat, an accent rule and a short line; the phone angles in from the side | top-left, under the stat | colour | Space Grotesk 700 | sleep tracker | P2 |
| 5 | **Field Notes** `field-notes` | P2 | light paper / ink | mono folio, rule and serif headline; flat phone rising from the bottom, stepping centre → right → centre → left | top (left on paper, centred on ink) | italic serif | Fraunces 600 + italic | journaling | P1 cut → full in P2 |
| 6 | **Nocturne** `nocturne` | P2 | near-black + glow | phone hangs from the top edge into a coloured glow; caption sits at the bottom under a hairline; frame 3 is a close-up | bottom-left | two-tone dim | Geist 600 | AI writing / dev tool | P2 |
| 7 | **Index** `index` | P2 | light cool grey / night | Swiss: huge frame numeral, a text column BESIDE a phone pushed 30% off the right edge; frame 5 is a type-only contents page | beside the device | colour | Instrument Sans 600 | calendar / planner | P2 |
| 8 | **Monolith** `monolith` | P2 | dark jewel, one per frame | giant lowercase serif word behind a small phone; small serif caption at the bottom | bottom-centre | italic serif | DM Serif Display | meditation | P2 |
| 9 | **Duo** `duo` | P3 | light blush / lilac | two overlapping phones facing each other; alternating pair / single + chat chips | top-centre | serif-italic swap | DM Sans 700 + Instrument Serif Italic | resale marketplace | P3 |
| 10 | **Gallery** `gallery` | P3 | light wall + pastel mats | frameless screens hung on mats like prints; wall-label caption below; single and pair frames | bottom-left | colour (per mat) | Inter 600 + JetBrains Mono | photo editor | P1 cut → full in P3 |
| 11 | **Signal** `signal` | P3 | volt / black split | a diagonal split that zig-zags continuously across the strip; condensed caps; rolled phone straddling the split | top-left, uppercase | pill | Anton 400 | live sports | P1 cut → full in P2 |
| 12 | **Blueprint** `blueprint` | P3 (+P1, P2) | dark blueprint / whiteprint | drafting grid, flat near-orthographic phone, one technical callout per frame (dimension, zoom, leaders), title block | top-left, mono | underline | JetBrains Mono 700 | API / uptime monitor | P2 (zoom in P3) |

Coverage:
- Light: Marker, Field Notes, Index, Duo, Gallery. Dark: the other seven.
- Panoramic and seam-crossing: Ridgeline. Signal's seams also chain across frames.
- Type-only frame: Index F5. Monolith's feature graphic is type-only too.
- Social proof with a Play fallback: Headliner F2.
- Serif editorial: Field Notes and Monolith.
- Frameless card: Gallery.
- Caption positions: top, bottom and beside. Device counts: 0, 1 and 2.

---

### 4.2 Ridgeline (`ridgeline`): dimensional · dark · panoramic · **default**
**Idea.** One continuous mountain dusk in the app's own brand colours. Phones rise out of the ridges, and one phone leans across the 4|5 seam.
Frames 1–3 each read on their own in search.

**Fonts.**
- Headline: Plus Jakarta Sans 800. Sub: Inter 500. Kicker: JetBrains Mono 500.
- **layout.tsx:** add Plus Jakarta Sans 500 and 800, because the default set must paint without a flash of fallback text.

**Palette** (the Trailhead kit):
- **Strip paint:** `linear 90°` across the whole strip: #0F3A3D 0 → #1B6F6A .30 → #145A66 .62 → #0E2A36 1. Per-frame slices for 5 frames:
  #0F3A3D→#175D5B · #175D5B→#1B6F6A→#196869 · #196869→#145B66 · #145B66→#11434F · #11434F→#0E2A36.
- **Ridges and route:**
  - far ridge #0B2F33 @.85; near ridge #081F23
  - dashed route #E8A33F @.90, width .009W, dash [.022W, .018W], with waypoint dots r .014W on the seams
- **Glows:** sunrise #E8A33F @.35 behind F1; teal #2FB5A5 @.20 behind F2–F3; paper #F0EFE9 @.10 on F5. Grain .05, tile .12W.
- **Type colours:**
  - ink #F0EFE9 (≥5.2:1 on the lightest slice)
  - accent #F2B65A (3.3:1 on #1B6F6A; #E8A33F measures only 2.8:1 there, so text uses the lighter amber)
  - muted #F0EFE9B8
- Ridge points are P3's (x = strip frame units, y = W above the bottom):
  - far: 0,.95 .4,1.12 .8,.88 1.3,1.22 1.7,.92 2.2,1.10 2.7,.84 3.1,1.0 3.6,.82 4.1,1.14 4.6,.90 5,1.02
  - near: 0,.46 .5,.62 .9,.40 1.4,.70 1.9,.44 2.4,.58 2.9,.36 3.4,.52 3.9,.34 4.4,.60 5,.42
  - route: (.2,.30) (.9,.52) (1.5,.34) (2.2,.60) (3.0,.44) (3.8,.66) (4.5,.40) (4.9,.55)

**Caption.**
- Position: top-left, x .08–.92, sentence case.
- Kicker: JetBrains Mono 500 .032W, UPPER, +.14em, #F2B65A, at .050H. Only on F1, where it holds the app name.
- Headline: from .085H (F1) or .052H. Size .135W on the hero, .125W elsewhere; lh 1.04; tracking −.03em; maxLines 3; minSize .10W; balanced.
- Accent: colour #F2B65A.
- Sub: Inter 500 .042W, lh 1.32, muted, maxLines 2, .025W below the headline.

**Device.** Graphite finish; lens 6.0 device widths; shadow #04191B @.55, blur .08W, y .05W; `minVisible` .60.

**Decor.**
- Ridges and route in strip space, under the devices.
- F5 stat card (P3), over the device:
  - card: #F0EFE9, r .04W, pad .035W, rotated −4°, with a .012W #E8A33F left bar
  - label: Inter 600 .026W, UPPER, "THIS WEEK" in #134F63B3
  - value: Plus Jakarta Sans 800 .07W #0F1114 "42.8", with the unit " km" in Inter 600 .034W
  - text comes from `frame.callouts[0]`

| # | Role | Example (outdoor nav "Summit") | Device (x · y · scale · pose) | Notes |
|---|---|---|---|---|
| 1 | hero | kicker SUMMIT · "Find your *next peak*" | .50 · .76 · 1.28 · **Rise** pitch 10 | top edge .35H, 21% bleeds off the bottom; sunrise glow |
| 2 | turn | "Weather for *every ridge*" + sub | .46 · .67 · 1.10 · Left yaw +17 | fully visible, standing on the ridge |
| 3 | spread | "Maps that work *offline*" | .50 · .745 · 1.30 · flat | the legibility frame; 19% bleed |
| 4 | lean | "Share your *live location*" | .80 · .745 · 1.20 · Right yaw −17, roll −6 | about 25% of its width crosses into frame 5 |
| 5 | close | "Plan the *whole trip*" + sub | .62 · .73 · 1.00 · flat | frame 4's phone peeks in at the left; stat card at (.30, .62) |

- **Extend.** For N = 6–8, insert [turn-left (x .54, yaw −17), turn-right (x .46, yaw +17)] before the lean. The lean always sits on the last seam. N ≤ 3
  gives hero, turn, close. If a frame is deleted so the seam loses its neighbour, the peek collapses back into its owner frame.
- **Play.** Device tops keep their W offsets; the hero shows about 62%. Ridges are bottom-anchored.
- **iPad.** Type ×.8; iPad frame at .67W on the hero; ridges scale with W. The peek is kept, since the iPad frame at .64W still crosses the seam.
- **Feature graphic.** The strip is compressed to 1024 wide, with the sunrise glow at (.70W, .55H) and the ridges across the bottom 30%. Kicker and headline
  sit left at x .07–.50, middle, .058W. A Pixel sits at cx .78, w .22, top .14, pitch 10, bleeding off the bottom.
- **Phase 1 cut.**
  - Type: `panorama:true` with `frames[0].bg` = the strip gradient; Plus Jakarta Sans 800 at cs 54, align left.
  - Per-frame poses and scales as above; F4 at x .62 until the seam device exists.
  - Ink #F0EFE9; no kicker, accent, ridges or glow.
- **P2** adds the accent, kicker, sub, glows, ridges and route. **P3** adds the 4|5 peek.

### 4.3 Headliner (`headliner`): conversion · dark cobalt · social proof
**Idea.** The top-grossing baseline: a huge centred benefit headline with one yellow keyword, over a giant flat phone running off the bottom. Frame 2 is a
rating laurel on Apple and a normal feature frame on Play.

**Fonts.** Inter 800 (headline, laurel figure), 700 (laurel label), 500 (sub). **layout.tsx:** add Inter 800.

**Palette.**
- Ground A: `linear 180°` #3050FF → #1F37D9, plus a top sheen (radial at 50% 0, 90%×40%, #FFFFFF @.15 → 0).
- Ground B: #2238C9 → #152491, sheen @.10.
- ink #FFFFFF (5.7:1 on #3050FF, ≥8:1 on B).
- accent #FFD84A (4.1:1 on A, display only; 6.5:1 on B); accentInk #152491; muted #FFFFFFB8; shade #0A1466.

**Caption.**
- Top-centre, fixed box x .07–.93, .055–.275H. Text shrinks to fit and never pushes the phone.
- Headline .15W on the hero, .135W elsewhere; minSize .105W; lh 1.02; tracking −.035em; maxLines 3.
- Accent: colour. Sub (closer only): Inter 500 .048W, muted.

**Device.** Black finish; flat on every frame except F4 (`Right`); lens 7.95; shadow #0A1466 @.50, blur .09W, y .05W; `minVisible` .60.

**Proof frame (F2).**
- **Laurel** (Apple slots only): 7 leaves per branch, each an ellipse .026×.012W on an arc of r .12W, ink @.9. It wraps:
  - the value, Inter 800 .11W ("4.8")
  - ★★★★★ at .042W in #FFD84A
  - the label, Inter 700 .034W, UPPER, +.08em, muted ("120K RATINGS")
- The laurel starts at .05H. The headline box moves to .17–.285H at ×.85, and the device top to .33H.
- `frame.proof.placeholder` draws dashed in the editor and raises an export preflight warning until the user types their real rating.
- **Play fallback:** the role swaps from `proof` to `feature`. The laurel, stars and label are dropped, the headline returns to .055H at full size, and the
  device top returns to .30H. The caption itself is Play-safe ("Lessons that stick"); the proof lives only in the laurel.
- Preflight still checks the text area (≤18%) and banned words.

| # | Role | Ground | Example (language learning) | Device (x · y · scale · pose) |
|---|---|---|---|---|
| 1 | hero | A | "Talk like a *local*" (.15W) | .50 · .746 · 1.40 · flat (top .30H, 79% visible) |
| 2 | proof | B | laurel 4.8 · 120K RATINGS / "Lessons that *stick*" | .50 · .757 · 1.34 · flat (top .33H) |
| 3 | feature | A | "Chat with *AI tutors*" | .50 · .727 · 1.34 · flat |
| 4 | feature | B | "Never lose your *streak*" | .52 · .74 · 1.28 · Right yaw −17 |
| 5 | closer | A | "Ready for your *trip*" + sub "Travel phrases for 40 countries, offline" | .50 · .768 · 1.28 · flat (top .36H) |

- **Extend:** [feature B, feature A with `Right`].
- **Play:** 62–66% of the phone visible; F2 renders as a feature frame.
- **iPad:** type ×.8, iPad frame w .80W, top .35H (≈81% visible), laurel ×.8.
- **Feature graphic:** ground A. Kicker = appName at x .07, top .26. Headline x .07, w .46, middle, .058W. A Pixel at cx .76, w .25, top .14, bleeding off the
  bottom.
- **Phase 1 cut:** A/B grounds; Inter 800 centred at cs 60 (set-level); flat phones at 1.28–1.40, x .50, tops as above. F2 renders as a plain feature
  frame (nothing claims proof until P2). **P2** adds the accent, per-frame sizes, laurel and Play swap.

### 4.4 Marker (`marker`): conversion · light
**Idea.** Warm, editorial energy. A heavy left-aligned headline has a yellow highlighter swipe behind its keyword, and a huge phone zig-zags off the left
and right edges.

**Fonts.** Bricolage Grotesque 800 (headline) and 500 (sub), from the registry with opsz pinned to 96.

**Palette.**
- **A:** solid #F7F6F2 with faint ruled lines behind the device (horizontal .0025W every .09W, #151515 @.06, from .30H down).
  - ink #151515 (17:1), muted #5E574D, marker #FFE14D, accentInk #151515.
- **B** (F3, inverted): solid #151515.
  - ink #F7F6F2, muted #A39A8C, marker #FFE14D, accentInk #151515.

**Caption.**
- Top-left, x .07–.87, box .06–.27H.
- Headline .155W on the hero, .14W elsewhere; minSize .11W; lh 1.0; tracking −.03em; maxLines 3.
- **Accent:** a marker rect under the run. Height .62em, bottom edge at baseline +.10em, padX .06em, radius .08em, rotated −1.5°, fill #FFE14D. The run text
  stays ink (#151515 on B as well).
- Sub (closer only): 500 .048W, muted.

**Device.** Silver finish; flat; lens 7.95; warm shadow #3B2F1E @.28, blur .08W, y .04W. Width .92W (1.40), top .30H, `minVisible` .60. That puts about 10% of
W off the side and shows 80% of the height on iPhone.

| # | Ground | Example (study app) | Device (x · y · scale) |
|---|---|---|---|
| 1 | A | "Flashcards that *stick*" (.155W) | .64 · .746 · 1.40 (right bleed) |
| 2 | A | "Your notes, *sorted*" | .36 · .746 · 1.40 (left bleed) |
| 3 | B | "Exam week, *handled*" | .64 · .746 · 1.40 |
| 4 | A | "Study with *friends*" | .36 · .746 · 1.40 |
| 5 | A | "Every subject, *one app*" + sub "Cards, notes and quizzes that sync everywhere" | .50 · .76 · 1.28 |

- **Extend:** [left, right].
- **Play:** about 64% visible. **iPad:** type ×.8 at w .70; device w .80, cx .62/.38, top .35H.
- **Feature graphic:** A, with the headline plus marker at x .07, w .52, middle, .06W; device cx .78, w .26, top .12, bleeding.
- **Ships in P2.** The marker needs measured runs; without it the template would be generic.

### 4.5 Big Number (`big-number`): conversion · dark · stat-led
**Idea.** Each frame opens on one huge accent number with a short line under it, while the phone angles in from alternating sides.

**Fonts.** Space Grotesk 700 (stat, headline) and 500 (units, sub), from the registry.

**Palette.**
- Ground A: `linear 180°` #0F1419 → #0A0D10. Ground B: #13201A → #0B120E.
- A side glow on the device's side: #7CF29A @.08, r .6W.
- ink #F2F5F7 (16.9:1), accent #7CF29A (13:1), accentInk #0A0D10, muted #8A96A3 (6.2:1).

**Caption.**
- **Stat:** x .07, top .055H, one line. Auto-fit from .34W (hero) / .30W down to .20W; lh .90; tracking −.05em; accent colour.
  - Units ("h", "m", "%", "/100", "nights") are drawn at .40× size, weight 500, muted, on the shared baseline.
- **Accent rule:** w .12W, .008W thick, .02W under the stat.
- **Headline:** flows .045W under the rule. Size .105W; lh 1.08; tracking −.02em; left; maxLines 2; accent colour on the run.
- **Sub:** 500 .045W, muted.
- A frame whose `stat` is empty falls back to the feature role.

**Device.** Black finish; lens 5.5; pitch 6 with yaw ∓16 (the phone always turns toward the centre); shadow #000 @.55, blur .10W, y .06W. Width .78W (1.19),
top .345H, `minVisible` .60 (86% visible on iPhone).

| # | Ground | Stat · example (sleep tracker) | Device (x · y · scale · pose) |
|---|---|---|---|
| 1 | A | **7h 42m** · "of real sleep, *measured*" | .62 · .724 · 1.19 · pitch 6, yaw −16 |
| 2 | B | **+18%** · "*deep sleep* in three weeks" | .38 · .724 · 1.19 · pitch 6, yaw +16 |
| 3 | A | (none, palate cleanser) "Wake up *gently*" at .13W from .055H | .50 · .708 · 1.28 · flat |
| 4 | B | **92/100** · "your nightly *sleep score*" | .62 · .724 · 1.19 · pitch 6, yaw −16 |
| 5 | A | **5 nights** · "to a *better routine*" + sub "Wind-down plans built from your own data" | .38 · .78 · 1.19 · pitch 6, yaw +16 |

- **Extend:** [stat-right, stat-left].
- **Play:** about 72% visible. Stats go through the banned-word check ("#1", "million").
- **iPad:** stat .22W; device .66W, top .38H.
- **Feature graphic:** B plus a glow #7CF29A r .45W @.18 at (.30W, .50H). Stat at x .06, top .16, .15W; headline under it, w .44; device cx .78, w .22, top .12,
  yaw −16.
- **Ships in P2.**

### 4.6 Field Notes (`field-notes`): editorial · light · serif
**Idea.** A printed field journal: warm paper, a mono folio, a hairline rule, a serif headline with one italic terracotta word, and a flat phone rising from
the bottom edge that steps centre, right, centre, left.

**Fonts.**
- Fraunces 600 roman plus 600 italic (accent). JetBrains Mono 500 (kicker). Inter 400 (sub).
- **layout.tsx:** add Fraunces `1,600`, and add `0,700`, which also fixes today's bug where 700-weight captions fall back.

**Palette.**
- **P0 Paper:** solid #F2EEE5, plus a warm corner radial (85% 8%, 80%×50%, #FFF7E8 @.7 → 0) and grain (seed 11, @.045, tile .25W).
  - ink #1C1A17 (15:1), muted #6B645A, accent #C8472B (4.7:1), line #1C1A17 @.22, shade #3A2E1F.
- **P1 Ink:** solid #1C1A17.
  - ink #F2EEE5, muted #A39C8F, accent #E9795A, line #F2EEE5 @.22, shade #000.

**Caption.**
- Top. Left-aligned on paper (x .08–.92), centred on ink.
- **Kicker:** Mono 500 .028W, UPPER, +.08em, muted, format "N° {nn} — {LABEL}", at .055H.
- **Rule:** hairline .0025W in the line colour, .022W below the kicker.
- **Headline:** from .095H. Size .135W on the hero, .118W elsewhere; lh 1.04; tracking −.02em; maxLines 3; minSize .095W; balanced.
- **Accent:** italic swap to Fraunces 600 italic, in the accent colour.
- **Sub:** Inter 400 .036W, lh 1.35, muted, maxLines 2.

**Device.** Graphite finish, flat. Shadow in the shade colour @.28 (@.45 on ink), blur .09W, y .04W. It bleeds 20% of its height off the bottom. Width .76W
(1.157) on the hero and .74W (1.126) elsewhere, which puts the top at .41–.43H.

| # | Ground | Kicker · example (journaling) | Device (x · y · scale) |
|---|---|---|---|
| 1 | P0 | N° 01 — TODAY · "A quieter place to *write*" + sub "One prompt a day. No feeds, no streaks." | .50 · .779 · 1.157 |
| 2 | P0 | N° 02 — PROMPTS · "Prompts that *find you*" | .60 · .785 · 1.126 |
| 3 | P1 (centred) | N° 03 — MEMORIES · "On this day, *years ago*" | .50 · .785 · 1.126 |
| 4 | P0 | N° 04 — PRIVATE · "Private *by default*" | .40 · .785 · 1.126 |
| 5 | P1 (centred) | N° 05 — BOOKS · "Print your year as a *book*" + sub "Hardcover, 120 pages, shipped to your door" | .50 · .785 · 1.126 |

- **Rhythm.** The search frames go paper, paper, ink. **Extend** from 2, cycling [right, pull, left, pull].
- **Play:** headline .105W (.118W on the hero); device .62W, bleed .20.
- **iPad:** kicker .02W, headline .082W (.09W on the hero), sub .026W; device .66W, bleed .18.
- **Feature graphic:** P0. Caption at x .06–.54, middle, left: appName plus caption 1 at .072W, kicker "N° 00". Device at x .77W, w .25W, bleeding .30,
  flat.
- **Phase 1 cut:** P0/P1 grounds with per-frame ink; Fraunces 600 left at cs 51; the x steps and top ≈ .42H bleed as above. **P2** adds the kicker, rule,
  italic accent, sub, grain and centred ink frames.

### 4.7 Nocturne (`nocturne`): editorial · dark · device from the top
**Idea.** Near-black lit by one electric hue per frame, like Linear or Raycast. The phone hangs from the top edge into its own glow, and the caption sits at
the bottom under a hairline.

**Fonts.** Geist 600 and 400, plus Geist Mono 500, from the registry. Fallback: Inter Tight 600/400 and JetBrains Mono if Geist isn't served.

**Palette.**
- ground #08090C; ink #F4F5F8 (19:1); muted #8A8F98 (6.3:1); line #FFFFFF @.10.
- Frame hues: P0 violet #7A74FF, P1 indigo #5B7CFF, P2 cyan #3FB8FF.
- Dot field: pitch .036W, r .0024W, #FFFFFF @.045, drawn as procedural arcs.
- Glow: radial at (.5W, .30H), rx .78W, hue @.42 → @.12 at .5 → 0.

**Caption.**
- Bottom-left, x .08–.92. A hairline .002W sits at .655H (.675H on the hero).
- Kicker: Geist Mono 500 .027W, UPPER, +.06em, in the frame hue, format "{nn} / {LABEL}".
- Headline: from .705H (.725H on the hero). Size .112W (.122W on the hero); lh 1.04; tracking −.035em; maxLines 2; minSize .09W; balanced.
- Accent: **two-tone dim**, where the starred run is drawn in muted.
- Sub: Geist 400 .036W, lh 1.4, muted.

**Device.**
- Black finish; **Rise** pitch 10; lens 6.0. The shadow is a glow: the frame hue @.30, blur .14W, y .02W.
- Anchored `{bottom}` with the bottom edge at .62H (.65H on the hero). Width .78W (1.187), or .84W (1.28) on the hero, so 18–20% is cropped off the top.
- **F3 close-up:** w 1.05W (1.6), flat, bottom .62H. That crops 39% off the top and bleeds 2.5% off each side.

| # | Hue | Kicker · example (AI writing tool) | Device (x · y · scale · pose) |
|---|---|---|---|
| 1 | violet | 01 / WRITE · "Write less. *Ship more.*" | .50 · .242 · 1.28 · pitch 10 |
| 2 | indigo | 02 / SEARCH · "Answers from *your docs*" | .50 · .242 · 1.187 · pitch 10 |
| 3 | cyan | 03 / DRAFT · "Drafts in *seconds*" | .50 · .11 · 1.60 · flat (close-up) |
| 4 | indigo | 04 / PRIVACY · "Private by *design*" | .50 · .242 · 1.187 · pitch 10 |
| 5 | violet | 05 / SYNC · "Works where *you work*" + sub "Mac, iPhone and the web, always in sync" | .50 · .242 · 1.187 · pitch 10 |

- **Extend:** mirror.
- **Thumbnail read:** the lit phone plus a .122W caption (14pt), accepted as the editorial trade-off.
- **Play:** device .66W, bottom .63H. **Tablet:** device .72W, bottom .61H; caption .66–.95H at .075W.
- **Feature graphic:** glow at (.72W, .5H), r .45W; caption at x .07–.50, middle; device at x .74W, w .30W, bleeding .35 off the bottom, pitch 10.
- **Ships in P2**, since it needs the bottom caption and the projected-bbox top bleed.

### 4.8 Index (`index`): editorial · light · Swiss · type-only closer
**Idea.** International style. A giant frame numeral and a ragged-right text column sit **beside** a phone pushed 30% off the right edge, and the set closes
on a type-only contents page.

**Fonts.** Instrument Sans 600, 500 and 400, from the registry with wdth pinned to 100.

**Palette.**
- **P0 cool grey:** #E9ECF0. ink #0B1220 (16:1), muted #5B6576, accent #E4322B (3.7:1; numeral and display accent only), line #0B1220.
- **P1 night:** #0B1220. ink #FFFFFF, muted #9AA3B2, accent #FF4A3D (5.2:1), line #FFFFFF.

**Layout.**
- Top rule x .075–.925 at .062H, .004W thick.
- Label kicker right-aligned in x .52–.925 at .07H: 500 .026W, UPPER, +.10em, muted.
- **Numeral** (the frame index): 500 .36W, tracking −.06em, left at x .068, baseline .205H. Accent colour (#FFFFFF @.92 on P1).
- **Column** x .075–.46, y .245–.66H, top-aligned:
  - headline 600 .09W, lh 1.04, tracking −.03em, ragged-right (not balanced), maxLines 5, minSize .07W, colour accent
  - sub 400 .032W, lh 1.38, muted, maxLines 5, .035W below the headline
- **Device:** flat; lens 7.95; finish black on P0 and silver on P1; shadow @.22, blur .06W, y .03W. Width .70W (1.066) with its centre at x .85W, top .245H,
  keepClear .04W.
- **F5 type-only "Contents":**
  - no device
  - headline at .13W from .16H, full width
  - five rows from .40–.82H: 600 .075W, numerals in accent, hairlines between rows; each row comes from a frame's kicker or `frame.notes`
  - allowed only as `sequence.last`; Apple 2.3.3 gets an info-level preflight

| # | Ground | Kicker · numeral · example (planner) | Device (x · y · scale) |
|---|---|---|---|
| 1 | P1 | WEEK · 01 · "Plan the week in *one view*" + sub "Calendar, tasks and focus time on one page" | .85 · .585 · 1.066 (silver) |
| 2 | P0 | BLOCKS · 02 · "Blocks that *reflow*" + sub | .85 · .585 · 1.066 |
| 3 | P0 | FOCUS · 03 · "Focus, *on a timer*" | .85 · .585 · 1.066 |
| 4 | P0 | SHARED · 04 · "Lists you *share*" + sub | .85 · .585 · 1.066 |
| 5 | P1 | CONTENTS · "Everything, *indexed*" + 5-row list | none |

- **Extend:** cycle [P0, P0, P0, P1] with Contents kept last.
- **Play:** numeral .32W at baseline .19H; column .235–.66H; device .62W at x .84W, top .24H.
- **iPad** (true side-by-side): numeral .22W; column x .075–.44, y .25–.80H, vertically centred; headline .056W; device .56W at x .76W, centre .54H, no bleed.
  The list uses 2 columns.
- **Feature graphic:** rule; column at x .06–.50, middle, .07W; device at x .78W, w .26W, bleeding .30.
- **Ships in P2.**

### 4.9 Monolith (`monolith`): editorial · dark · serif word
**Idea.** Five covers of one magazine. A giant lowercase serif word sits behind a small phone, each frame has a new jewel colour, and a quiet serif caption
sits below.

**Fonts.** DM Serif Display 400, roman and italic, from the registry.

**Palettes** (ground / word / ink / accent):
- P0 oxblood: #3A0F16 / #F4C3AE / #F7EDE3 / #F2B880
- P1 forest: #0F2B22 / #BFE3C4 / #EAF2EC / #C9E3A5
- P2 navy: #111C3A / #BFD0FF / #EEF1FA / #A9C1FF
- P3 umber: #2E1B10 / #F2CFA6 / #F6EBDD / #F2B880
- P4 graphite: #161616 / #E6E6E6 / #F2F2F2 / #D9D9D9
- Each also gets a radial lift at (.5W, .42H), rx .95W, #FFFFFF @.06 → 0 at .7, plus grain (seed 23, @.04). muted = ink @.7.

**Word.** Source is `frame.kicker`, else the starred run, else the last word. DM Serif Display 400, lowercase, fitted to maxWidth .96W from .40W down to .22W;
tracking −.03em; centred; baseline .285H; word colour; drawn **under** the device. It is a readable tint, not tone-on-tone, so it reads at thumbnail size
(a .40W word is about 46pt).

**Caption.** Bottom-centre, region x .08–.92, .855–.965H. DM Serif Display 400 .085W, lh 1.08, tracking −.01em, maxLines 2, minSize .07W. Accent: italic swap in
the accent colour.

**Device.** Black finish; lens 7.95; width .56W (0.85); x .5. Its **top edge sits on the word's baseline** (.285H), so descenders tuck behind the phone and the
letters stay legible. Bottom at .827H. Yaw 0 / −10 / +10 / −10 / 0, with lift .03W on the turned frames. Shadow #000 @.5, blur .09W, y .045W.

| # | Palette | Word · example (meditation) | Device yaw |
|---|---|---|---|
| 1 | oxblood | breathe · "Calm, in *two minutes*" | 0 |
| 2 | forest | sleep · "Fall asleep *faster*" | −10 |
| 3 | navy | focus · "Sound for *deep work*" | +10 |
| 4 | umber | move · "Stretch *between calls*" | −10 |
| 5 | graphite | daily · "A calmer *every day*" | 0 |

- **Extend:** cycle.
- **Play:** word .36W at baseline .265H; device .52W from .265H; caption .075W at .87–.975H.
- **iPad:** word .30W at .28H; iPad frame .50W from .28H; caption .06W.
- **Feature graphic** (type-only, allowed on Play): the word is the appName fitted to .92W at baseline .66H; caption 1 centred at .80–.93H, .042W.
- **Ships in P2.**

### 4.10 Duo (`duo`): dimensional · light · two phones
**Idea.** Two phones in conversation, facing each other and overlapping in depth. Each pair shows this frame's screen next to the next frame's screen, so
the row reads as a flow. Single frames get chat chips instead.

**Fonts.** DM Sans 700 (headline) and 500 (sub), opsz pinned. Instrument Serif Italic 400 (accent). All from the registry.

**Palette.**
- **A blush:** `linear 180°` #FFEDE6 → #FFD6C9, plus glows at (12% 28%) #FFB4D6 @.55 r .42W and (92% 88%) #9AD8FF @.45 r .45W.
- **B lilac:** #EFEAFF → #DCD3FF, with the glows mirrored.
- ink #24121A (15:1), muted #5A4750, accent #D6336C (4.1:1; display only), shade #5B3FD9.

**Caption.** Top-centre, x .08–.92, from .055H. Size .112W on the hero, .104W elsewhere; lh 1.04; tracking −.035em; maxLines 2; minSize .088W. **Accent:** serif
italic swap to Instrument Serif Italic at 1.14×, in accent. Sub: 500 .038W, muted.

**Devices.**
- Silver finish; lens 6.0. Each device gets its own violet-tinted shadow: #5B3FD9 @.22, blur .07W, y .045W.
- **Pair:**
  - back device (source `next`): w .56W (.853), cx .34, centre .58, yaw +22, roll −6
  - front device (source `self`): w .62W (.944), cx .64, centre .63, yaw −14, roll +4; top .33H, bottom .93H
  - the mirrored pair swaps x and the signs; the pair shrinks as a group with clearText .06W
- **Single:** w .66W (1.005), centre .61, flat.
  - 1–2 chat chips from `frame.callouts`: white card, r .05W, Inter 600 .034W #1A1530, shadow #1A1530 @.14; a second chip in #6C4CF5 with white text
  - no emoji, because the fallback font differs between renderers
- The back screen comes from `screenshotB`, else the next frame's screenshot, else the next sample screen. The Inspector names the borrowed screen.

| # | Ground | Example (resale marketplace) | Devices |
|---|---|---|---|
| 1 | A | "List it. *Sold.*" | pair: front .64/.63/.944 yaw −14 r +4 · back .34/.58/.853 yaw +22 |
| 2 | B | "Offers, *in chat*" + chips "Still available?" / "Yes, $40 today" | single .50/.61/1.005 flat |
| 3 | A (glows mirrored) | "Snap, price, *post*" | mirrored pair: front .36 yaw +14 r −4 · back .66 yaw −22 |
| 4 | B | "Pickup or *shipping*" + chip "Label ready · 2 min" | single |
| 5 | A | "Declutter, *get paid*" + sub "Payouts to your bank in 1–2 days" | pair at .65/.60 |

- **Extend:** cycle [single, mirrored pair, single, pair].
- **Play:** the group shrinks. **iPad:** the back device drops when its w < .42W; otherwise back .50 and front .54.
- **Feature graphic:** headline at x .07, w .42, middle; back at cx .66, w .20, top .20, yaw 14; front at cx .82, w .21, top .12, yaw −10.
- **Ships in P3**, since it needs two devices and `screenshotB`.

### 4.11 Gallery (`gallery`): dimensional · light · frameless
**Idea.** A quiet museum wall. Frameless screens hang on pastel mats like framed prints, with a wall-label caption underneath. Single and pair frames alternate.
This is the calm, flat counterpoint to the 3D sets.

**Fonts.** Inter 600 (headline) and 400 (sub), JetBrains Mono 500 (kicker). All are already in `layout.tsx`.

**Palette.**
- Wall #F1F2F4 with grain @.03.
- Mats rotate per frame, and the accent follows (mat / accent): Sky #DCE6FF / #2E5BD8 · Peach #FFE2D1 / #D1622C · Mint #D9F1E1 / #23865A · Lilac #EAE1FF / #6A4BD6 ·
  Butter #FFF0BF / #A87A00.
- ink #15171C; muted #5A5F6B; the shadow is tinted with the accent.
- Mat: rect x .06–.94, y .04–.745H, radius .05W.

**Caption.** Bottom-left wall label, x .08–.92, .775–.965H.
- Kicker: Mono 500 .028W, UPPER, +.10em, accent, "{nn} · {LABEL}", preceded by a dot r .009W.
- Headline: Inter 600 .09W, lh 1.1, tracking −.025em, maxLines 2, minSize .075W; the accent run in the mat's accent.
- Sub: 400 .034W, lh 1.4, muted.

**Screens.**
- Body `card`: no bezel, in the slot's screenshot aspect. Radius .06 of the card width; border .004W #15171C @.08; shadow in the accent @.22, blur .09W, y .04W.
- Single: w .56W (0.853), centred in the mat (centre .3925H).
- Pair: two cards w .40W (0.61) at (.31, .37H) and (.69, .42H), sources `self` and `next`.

| # | Mat | Kicker · example (photo editor) | Screens |
|---|---|---|---|
| 1 | Sky | 01 · PRESETS · "Edits that stay *subtle*" | single |
| 2 | Peach | 02 · COMPARE · "Before and *after*" | pair (before / after) |
| 3 | Mint | 03 · FILM · "Film looks, *zero fuss*" | single |
| 4 | Lilac | 04 · BATCH · "Batch edit a *whole trip*" | pair |
| 5 | Butter | 05 · LIBRARY · "Your camera roll, *calmer*" + sub "Private by default. Nothing leaves your phone." | single |

- **Play:** mat .04–.72H; card .50W; caption .75–.965H at .085W.
- **iPad:** the card takes the iPad screenshot's aspect (.75) at w .62W; headline .06W.
- **Feature graphic** (caption beside): mat at x .04–.50W, .08–.92H with the card fitted inside; caption at x .55–.94, middle.
- **Phase 1 cut:** `device:'none'` (the canvas finally honours it) with the mat colours as full solid grounds, Inter 600 left at the top (cs 39), card scale 0.9.
  **P2** adds the mat, bottom label and kicker; **P3** adds the pair frames.

### 4.12 Signal (`signal`): dimensional · bold · split
**Idea.** A sports poster. A diagonal split zig-zags **continuously** across the store row with the colours swapping at every seam, condensed caps sit on
top, and a rolled phone straddles the split.

**Fonts.** Anton 400 (headline, uppercase). Inter 700 (sub, UPPER, +.06em). Both from the registry. Anton ships only weight 400, so phase 1 needs
`captionStyle.weight`; today's hard-coded 700 would be faux-bolded.

**Palette.** Black #0E0E0E, volt #D7FF3A, flare #FF4D1C.
- **Odd frames:** black above, volt below. The line runs (0, .52H) → (1, .42H): `linear-gradient(168deg, #0E0E0E 0%, #0E0E0E 47.3%, #D7FF3A 47.3%, #D7FF3A 100%)`.
- **Even frames:** volt above, black below. The line runs (0, .42H) → (1, .52H): `linear-gradient(192deg, #D7FF3A 0%, #D7FF3A 47.3%, #0E0E0E 47.3%, #0E0E0E 100%)`.
  Each frame's right edge height equals the next frame's left edge.
- The angle and stop position are exact for 268×580: the normal is (58, 268), L = 623.6, stop = .5 − 17.0/623.6.
- The existing parser already accepts these gradients. P2 redraws them as antialiased polygons so the edge stays smooth at 2868 px.
- Ink: odd #D7FF3A (16:1 on black); even #0E0E0E (17:1 on volt).
- **Accent: pill.** Fill #FF4D1C, padX .14em, padY .04em, full radius; the run text is #0E0E0E (5.8:1).

**Caption.** Top-left, x .07–.93, from .05H. Size .18W on the hero, .165W elsewhere; lh .92; tracking +.005em; UPPERCASE via `toLocaleUpperCase`; maxLines 3;
minSize .12W.

**Device.** Black finish; lens 5.5; pitch 6. Yaw −12 / +12 and roll −4 / +4 alternate. Width .79W (1.2), cx .52 / .48, top .38H (so it straddles the split),
`minVisible` .60 (81% visible on iPhone). Short, hard shadow: #000 @.5, blur .06W, y .05W.

**Decor.** An outlined frame numeral in Anton .50W with no fill, stroked .004W in the lower block's opposite colour @.25, at bottom-right behind the device.

| # | Split | Example (live sports) | Device (x · y · scale · pose) |
|---|---|---|---|
| 1 | odd (black top) | "Every goal, *live*" (.18W) | .52 · .763 · 1.20 · pitch 6, yaw −12, roll −4 |
| 2 | even (volt top) | "Your teams, *first*" | .48 · .763 · 1.20 · pitch 6, yaw +12, roll +4 |
| 3 | odd | "Stats that *settle debates*" | as 1 |
| 4 | even | "Kickoff *alerts*" | as 2 |
| 5 | odd | "Never miss a *match*" + sub "SCORES · LINEUPS · HIGHLIGHTS" | .50 · .767 · 1.15 · pitch 6 only |

- **Extend:** parity, so any N stays continuous.
- **Play:** split at `{frac}` .40/.50H; headline .15W.
- **iPad:** split .40/.50H; type ×.8; iPad frame w .80, top .40H.
- **Feature graphic:** a vertical-ish volt polygon (0,0)(.60,0)(.56,1)(0,1); headline left at x .06, w .46, middle, Anton .075W in black; device at cx .78, w .24,
  top .10, roll −4, on the black side.
- **Phase 1 cut:**
  - Grounds: the hard-stop gradients above, with per-frame ink.
  - Type: Anton at weight 400, `case:'upper'`, tracking +.005, cs 71.
  - Device: yaw and pitch alternation; x and top as above; no roll yet.
- **P2** adds the pill, roll, numeral and polygon edge.

### 4.13 Blueprint (`blueprint`): dimensional + P1/P2 · dark · technical callouts
**Idea.** A technical drawing. It has a drafting grid, a flat near-orthographic phone and exactly one real callout per frame: a dimension line, a zoom
card or annotation leaders. A whiteprint negative sits in the middle of the set.

**Fonts.** JetBrains Mono 700 (headline) and 500 (kicker, labels); Inter 400 (sub). All are already loaded.

**Palette.**
- **Blueprint ground:** `linear 180°` #0D2B52 → #0A2140, with a centre glow at (.5W, .60H), rx .70W, #1E4E9C @.45 → 0.
- **Grid:** minor pitch .0425W, stroke .0012W, #FFFFFF @.07. Every 4th line is major (.17W), .0018W, @.13. The origin is (.075W, .05H), so major lines land on
  both margins.
- ink #F2F6FB (13:1), muted #B7C8E0, accent #FFB547 (9:1), line #9CC3FF.
- **Whiteprint (F3):** #EEF3F8, grid #0D2B52 @.07/.12, ink #0D2B52, muted #4E6A8C, accent #D9480F, line #2F5E99.

**Caption.**
- Top-left, x .075–.925.
- Kicker: Mono 500 .028W, UPPER, +.08em, line colour, "SHEET {nn} — {LABEL}", at .05H.
- Headline: from .085H. Mono 700 .10W; lh 1.12; tracking −.035em; maxLines 3; minSize .08W; balanced.
- **Accent: underline.** The run is drawn in accent with a .008W underline at offset .012W.
- Sub: Inter 400 .034W, muted.

**Device.** Silver finish; always flat; lens 20 (reads as orthographic); tight shadow #031020 @.35, blur .03W, y .015W. Width .66–.70W, top .30–.36H,
`minVisible` .75 (whole on iPhone).

**Callouts** (at most one per frame; all real data):
- **Dimension:** a vertical line .003W in accent at the device's right edge +.06W, with .02W end ticks. The label (Mono 500 .024W) is the screenshot's real
  pixel width, or "SAMPLE".
- **Zoom** (P3): a crop of the device's own screen (`frame.zoom`, default {x .06, y .18, w .88, h .22}) at 1.6×.
  - card: filled with the ground, stroked .004W in accent, radius .02W
  - placed over the device's edge on the free side, with a dashed leader [.012W, .010W] back to the source rect
- **Annotations** (P1): up to 2 leaders from anchor dots (r .012W, accent) on screen points (`frame.notes`) to mono labels in the free gutter.
- **Title block** (P2): at x .535–.925W, .938–.972H; stroke .003W in the line colour; text "{APP} · {nn}/{count}".

| # | Sheet | Example (API uptime monitor) | Device (x · y · scale) | Callout |
|---|---|---|---|---|
| 1 | blue | SHEET 01 — MONITORS · "Every endpoint, *watched*" | .50 · .64 · 1.066 | dimension "1320 PX" |
| 2 | blue | SHEET 02 — LATENCY · "Latency to the *millisecond*" | .62 · .629 · 1.00 | zoom on the chart, left |
| 3 | whiteprint | SHEET 03 — ALERTS · "Alerts before *users notice*" | .38 · .629 · 1.00 | 2 annotations, right: P95 SPIKE / AUTO-PAGE |
| 4 | blue | SHEET 04 — LOGS · "Logs you can *actually read*" | .62 · .629 · 1.00 | zoom on a log row, left |
| 5 | blue | SHEET 05 — STATUS · "Status pages in *one click*" + sub "Public or private, on your own domain" | .50 · .663 · 0.95 | title block only |

- **Extend:** cycle [2, 4].
- **Play:** `minVisible` .75 shrinks the device to about .60W.
- **iPad:** iPad frame .56W; gutter .05–.30; type and zoom ×.8.
- **Feature graphic:** grid; headline top-left at x .06, w .50; device at cx .72, w .20, top .10, with 2 annotations to its left and the title block.
- **Ships in P2** (grid, dimension, annotations, title block). The zoom cards arrive in **P3**, since they need the shared `screenRect()` and screen crops.

## 5. Fonts

**`src/app/layout.tsx` (eager).** This covers the default set, the Font picker's four families, and phase-1 templates that use already-listed families.
```
https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fraunces:ital,wght@0,400;0,600;0,700;1,300;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap
```
The additions over today:
- **Inter 800** (Headliner)
- **Fraunces 0,700** (fixes the existing weight-700 fallback) and **1,600** (Field Notes accent)
- **Plus Jakarta Sans 500 and 800** (Ridgeline, the default)

**`src/lib/onstage/templates/fonts.ts` → `FONT_REGISTRY` (lazy).** A `<link>` is injected once per family, when a template is previewed or applied. Gallery
thumbnails use `&text=` subsets. Axes are pinned so the file is identical everywhere:

| Family | css2 request | Used by |
|---|---|---|
| Bricolage Grotesque | `opsz,wght@96,500;96,800` | Marker |
| Space Grotesk | `wght@500;700` | Big Number |
| Geist, Geist Mono | `wght@400;600` / `wght@500` (fallback Inter Tight) | Nocturne |
| Instrument Sans | `wdth,wght@100,400;100,500;100,600` | Index |
| DM Serif Display | `ital@0;1` | Monolith |
| DM Sans | `opsz,wght@24,500;24,700` | Duo |
| Instrument Serif | `ital@1` | Duo accent |
| Anton | (400 only) | Signal |
| Noto Sans JP / Noto Serif JP | `wght@500;700;900` | CJK fallback (phase 4) |

**Export gate** (`renderSet.ts:58-63`):
- Preload every (family, weight, style) the resolved frames use, not just 700 and 500.
- Then call `document.fonts.check()` for each. On failure, **stop** with "Couldn't load Fraunces italic 600. Check your connection." Today it silently
  falls back.
- The Font picker (ContextBar.tsx:409) lists the registry families, grouped by "Loaded" and "On demand".

## 6. The new default first-open set

Ridgeline in Trailhead's own kit. The kit is #1B6F6A Primary, #134F63 Deep, #F0EFE9 Paper and #E8A33F Accent, and the kit accent is finally used.

The document:
- `template: {slug:'ridgeline', version:1}`, `appName:'Trailhead'`
- device ip16pm, graphite, shadow on, panorama on
- captionFont 'Plus Jakarta Sans', align left

| # | Kicker | Headline | Sub | Sample screen | Device (full spec) | Phase-1 cut (legacy fields) |
|---|---|---|---|---|---|---|
| 1 | TRAILHEAD | Every run, *mapped* | — | **map** | x .50, centre .76 (top .352H), 1.28, Rise (pitch 10), 21% bleed, amber sunrise behind | tiltX 10, tiltY 0, d 0, scale 1.28, x .50, top .352 |
| 2 | — | Know your *pace* | Live splits against your last ten runs | **pace** | x .46, centre .67, 1.10, Left (yaw +17) | tiltY 17, d 40, scale 1.10, x .46, top .319 |
| 3 | — | Trails *near you* | — | **nearby** | x .50, centre .745, 1.30, flat, 19% bleed | flat, scale 1.30, x .50, top .331 |
| 4 | — | Send the route to *anyone* | — | **share** | x .80, centre .745, 1.20, Right (yaw −17), roll −6, 25% crosses into F5 | tiltY −17, d 40, scale 1.20, **x .62**, top .362 |
| 5 | — | Built for the *long haul* | Offline maps, splits and elevation in one app | **season** | x .62, centre .73, 1.00, flat; F4's phone peeks in; stat card "42.8 km · THIS WEEK" | flat, scale 1.00, x .55, top .411 |

**Phase-1 settings.**
- `frames[0].bg` = `linear-gradient(90deg,#0F3A3D 0%,#1B6F6A 30%,#145A66 62%,#0E2A36 100%)`, with the other frames mirroring it, and ink #F0EFE9 on every
  frame.
- `captionStyle {weight 800, case none, tracking −0.03, lineHeight 1.04, maxLines 3}`, captionSize 54.
- In phase 1 every caption is plain text: the `*markers*` are stored but render as plain words until the phase-2 painter.

**Localisation.** Re-key `slots.ts` CAPTION_LOCALES to the new strings, keeping the markers, until phase 4 moves them into `frame.i18n`.
- DE:
  - "Jeder Lauf, *kartiert*"
  - "Kenne dein *Tempo*"
  - "Trails *in deiner Nähe*"
  - "Teile die Route mit *allen*"
  - "Gebaut für die *lange Strecke*"
- ES:
  - "Cada carrera, *en el mapa*"
  - "Conoce tu *ritmo*"
  - "Senderos *cerca de ti*"
  - "Envía la ruta a *quien sea*"
  - "Hecha para la *larga distancia*"
- JA:
  - "すべてのランを*地図に*"
  - "*ペース*を知る"
  - "*近くの*トレイル"
  - "ルートを*誰にでも*"
  - "*長く*走るために"
  - JA uses a system fallback until the Noto Sans JP registry entry lands in phase 4.

**Why this default beats today's.**
1. **Brand.** Today's grounds are Ember → Dusk → Moss → Ember → Ink (onstage.ts:98-106): a swatch sampler of unrelated colours. The new strip is one brand
   family, so the three search frames read as one product.
2. **Frames 1 and 3.** The teal sample card no longer disappears into Moss. The screens are now light and the brightest thing in every frame, and frame 5
   is no longer a graphite phone on near-black.
3. **Tilts.** Today's arbitrary tilts (−16/+6, +15, −22/+6) become presets: Rise, Left, flat, Right, flat. The Inspector stops saying "Custom tilt", and
   frames 2 and 4 face the centre.
4. **Level strip.** Device tops are fixed per role, so a 2-line caption no longer drops the phone by about 15.5 design px.
5. **Screens match captions.** Every sample screen shows what its caption says (map, pace, nearby, share, season).
6. **Showcase.** The first open demonstrates, once each: accent words, a kicker, a sub-line, bleed, 3D rhythm, a panorama, one seam moment and a stat card.
7. **Feature graphic.** The Play feature graphic finally matches the set (§4.2 feature layout), instead of a fixed teal card that reads 'Trailhead'
   (renderSet.ts:206-248).
8. **No fabricated proof.** Social proof stays in Headliner only.

## 7. Sample screens: replacing the single "Today · 8.4 km" dashboard

**Problems today.**
1. The same dark dashboard sits in all five phones, and nothing on it matches the captions.
2. It uses only the top 64% of the screen.
3. Its 7.5–8.5px text becomes a dark blob at thumbnail size.
4. It is drawn twice (`PhoneScreenUI` and `sampleScreen.ts`), and the two copies drift at 72% zoom.
5. Export paints it at 664 px into a fixed 1024 texture (sampleScreen.ts:32, renderDevice.ts:139), so it comes out soft at 1320 wide and cropped on iPad.

**Plan.** Keep Trailhead, since a concrete fictional brand makes templates look real, and rebuild it.
- **One painter:** `paintSample(id, theme, cls, ctx, pxW, pxH)` in `src/lib/onstage/sample/paintSample.ts`. It has no heavy dependencies (today's module
  imports only `data.ts`).
  - It is authored on a real **390×844 pt** grid (the 1290×2796 aspect), with a **1032×1376 pt tablet variant** (sidebar plus detail) for iPad and 7″ slots.
  - The editor paints it into a `<canvas>` inside the CSS device at device px × dpr, cached per (id, size).
  - Export paints it at the on-artboard screen size: `clamp(screen px, 1024, 4096)`, matching the new texture size.
  - **`PhoneScreenUI` is deleted**, and `export/sampleScreen.ts` becomes a re-export.
- **Rules:**
  - ≥60% light surfaces (#F7F5EF base) so the phone is the brightest thing on a dark ground; one amber accent element per screen
  - minimum text 13pt; one hero figure ≥34pt
  - full height used; status bar reads 9:41 with a full battery; tab bar at the bottom
  - no real brands, logos or people
- **The five screens.** `SetFrame.sample` defaults to `['map','pace','nearby','share','season'][i % 5]`.
  1. **map**
     - light topo: base #E9EFE3, contours #C9D6BF, water #BFDDEA, forest #D6E4C8
     - an 8pt #E8A33F route with a 3pt white casing, a #1B6F6A start pin and a finish flag
     - a search pill at the top
     - a white bottom sheet (r 24): "Ridge Loop" 700 28pt #102A2E; "12.4 km · +640 m · 1:04:12" 500 17pt #5C6B66; a 56pt #1B6F6A "Start run" button
  2. **pace**
     - "Morning run" 600 17pt; "4:58" 700 96pt #0F3F4E with "/km" 500 28pt
     - 10 split bars, 120pt tall, in #1B6F6A, with the current split in #E8A33F
     - a chip "−0:06 vs last 10 runs" (#E7F2EF / #1B6F6A)
     - three tiles: 8.4 km · 41:44 · 172 spm
  3. **nearby**
     - a 220pt mini-map header; "Trails near you" 700 28pt
     - three cards with route thumbnails (#2F8F86, #3F6FA8, #A8563F), each with a name (600 20pt) and chips "3.1 km", "+84 m", "Gravel"
  4. **share**
     - a route card with a sunset gradient #F2A65A → #8C3B5E, a #3A1F3F ridge silhouette, a white route line, and "21.1 km · 1:52:10" 700 34pt in white
     - a generic share sheet: five neutral initial-avatars (#1B6F6A, #134F63, #E8A33F, #8C3B5E, #5C6B66) and four action tiles (Copy link, Message,
       Save image, More)
  5. **season**
     - "This week" 600 17pt; "42.8 km" 700 72pt #0F3F4E, the same number as the Ridgeline stat card
     - a 12-of-14-day streak ring (teal and amber), Mon–Sun bars, and tiles "+1,240 m" and "Longest 16.2 km"
  6. **today**: the old dashboard repainted light by the same painter. Classic docs keep it, so they stay recognisable.
- **Chrome, not artwork:**
  - a "Sample screen · drop yours" chip on hover, never exported
  - one multi-file drop fills frames in order
  - the export dialog warns "3 frames still show the Trailhead sample"
  - Blueprint's dimension label reads SAMPLE
- **appName.** `SetDoc.appName` replaces the hard-coded 'Trailhead' in the feature graphic and the zip name (renderSet.ts:47, 231, 274; onstage.ts:325).
- **Phase 4:**
  - dark variants (`theme`) for Nocturne and Monolith
  - two more sample apps with 5 screens each ('ledger', a light finance app, and 'quill', a dark notes/AI app), so the gallery previews for Headliner,
    Index, Blueprint and Nocturne show category-appropriate UI instead of trail maps

## 8. Implementation plan

### 8.1 The shared resolver, and why the two renderers can't drift
- **Layout happens once.** `resolveArtboard(doc, i, slot, locale, measure)` is pure: no DOM, no React, no Konva. It owns:
  - sequence and role lookup; aspect patches; store rules; fit rules (`minVisible`, `clearText`, `maxH`, `minW`)
  - **line breaking** (balanced, orphan-free, maxLines → shrink to minSize → warning), case transforms and emphasis boxes
  - strip slicing (−i·W), device placement, projected bboxes, Play swaps and warnings
- **The painters only paint.**
  - Everything 2D goes through **one function**, `paint2D(ctx, draws, images)`. The editor calls it on two `<canvas>` layers per artboard (under and over
    the devices). Export calls it from `Konva.Shape({ sceneFunc: c => paint2D(c._context, …) })`. Same function, same browser, same measure.
  - The only thing drawn two ways is the 3D device, and both read the same `ResolvedDevice` numbers through one module, `templates/device.ts`
    (`deviceCss`, `deviceThree`). Both use a per-device on-axis camera, the same lens, the same transform order and the same `screenRect()`.
- **The editor lays out at design size.** Each artboard is 268×580 px inside `transform: scale(zoom/100)`. Canvases draw at display px × dpr. Perspective,
  radii, shadows and the sample screen therefore scale together, and the 72%-zoom drift can't happen again.
- **One component, many surfaces.** `<ArtboardView>` replaces the 8 bespoke mini-renderers: the Templates card, the TemplateDetail strip, the Landing strip,
  GuidedScreen, StorePageScreen, StoreOverlay, ReviewScreen/AbTest and the Filmstrip.
  - The gallery card becomes a simulated App Store search row: the first 3 frames at thumbnail scale, drawn by the real painter.
  - Detail-page facts (fonts, frame count, caption position, palette, 3D or flat, fits, "uses N screenshots") are **derived** from the Template object.
- **`classic`** is a resolver branch that reproduces today's layout exactly: headline at 30 px with 24 px padding, device 176 px wide and centred below. Every
  saved doc renders unchanged.

### 8.2 Phases

**Phase 1: honest templates on today's renderer (ships on its own).** No new draw primitives. Existing ones gain parameters, and the parity bugs every
template depends on are fixed.

| File | Change |
|---|---|
| `src/lib/onstage/templates/model.ts` (new) | the types in §3 (static only) |
| `src/lib/onstage/templates/catalog.ts` (new) | all 12 definitions with `since` and `phase1` cuts; the gallery shows `since ≤ currentPhase` (phase 1: ridgeline, headliner, field-notes, signal, gallery) |
| `src/lib/onstage/templates/fonts.ts` (new) | FONT_REGISTRY, `ensureFonts(specs)` (inject the link, `fonts.load`, `fonts.check`) |
| `src/lib/onstage/layout/breakLines.ts` + `layout/phase1.ts` (new, pure) | balanced line breaker with an injected `measure`. `layoutPhase1(doc, i, slot, measure)` → {lines, fontPx, fixed caption box (maxLines × lh), ink, bg slice, device {cx, top, w}}. Classic docs keep legacy centring; template docs use a fixed box, so the device never moves with line count. This seeds `resolve.ts` |
| `src/lib/onstage/data.ts` | `TEMPLATES` derived from the catalog (same `{slug, name, tagline, tags}` for generateStaticParams, sitemap and landing); `bgCss()` passes raw `linear-gradient(` strings through; `capInk` → `inkFor(frame)` = `frame.ink` ?? luminance of the first stop (deletes LIGHT_BGS, LIGHT_TEMPLATES and the landing `name === 'Field Notes'` check); TILT_PRESETS + `Rise`; FRAME_COLORS + `white`; TEMPLATE_FILTERS derived; slug aliases ember→headliner, cold-open→index, moss→ridgeline, sunbelt→signal, iris→nocturne, harbour→gallery, clay→duo, bone→field-notes |
| `src/lib/data/types.ts` | SetFrame `ink?`, `x?`, `top?`, `sample?`; SetDoc `schema?`, `template?`, `captionStyle?`, `appName?` |
| `src/lib/data/migrate.ts` (new) + `src/lib/data/local.ts` (`loadSetDoc`) | `migrateSetDoc`: a missing `schema` → `schema:2`, `template:{slug:'classic',version:1}`, `sample:'today'` on frames without a screenshot; everything else untouched. Also called in `openSet` before the spread (onstage.ts:463-468) |
| `src/store/onstage.ts` | `initialFrames`/defaults = the Ridgeline cut. `applyTemplate(slug)` writes the cut per frame via the sequence, keeps captions, screenshots and sample ids, and stores `template` (and restores `device` when leaving a `device:'none'` template). `addFrame` cycles `phase1.extend`. New `resetFrameToTemplate(i)`. `applyBrandDefaults` recolours the cut's grounds from the kit instead of forcing −17°. `readDoc`, `partialize` and `equality` gain `template`, `captionStyle`, `appName`. Scale clamp widens to 0.6–1.6 (onstage.ts:339). Zoom opens at "fit" |
| `src/components/onstage/editor/CanvasStage.tsx` | artboard at 268×580 inside `scale(zoom/100)`; caption from `layoutPhase1` lines (`white-space:pre`, no `text-wrap:pretty`); device absolutely placed at (cx, top) in its own perspective wrapper (origin = device centre); transform `translate3d(0,0,depth×.35px) rotateX() rotateY()`, which fixes the translateZ order; artboard `overflow:hidden` clips the bleed |
| `src/components/onstage/device.tsx` | delete the unconditional bevel `box-shadow` (the shadow-toggle parity bug); frameless variant when `device==='none'`; `white` finish; `PhoneScreenUI` → `<SampleCanvas>` |
| `src/lib/onstage/sample/paintSample.ts` (new) + `export/sampleScreen.ts` | the five light screens plus `today` (§7) |
| `src/lib/onstage/export/renderSet.ts` | `layoutPhase1` for text (`Konva.Text` with `lines.join('\n')`, `wrap:'none'`, `fontStyle` = weight, fill = ink) and device placement (x = cx·W − cw/2, y = top + dh/2 − ch/2), replacing the hard-centring at :184-186; full weight preload plus the hard font gate; feature graphic uses frame-0 bg, ink, font and `appName` |
| `src/lib/onstage/export/renderDevice.ts` | screen texture = clamp(on-artboard screen px, 1024, 4096) (:139) |
| `src/lib/onstage/export/geometry.ts` | `FRAME_FINISH.white {0xEDEDEA, .35}`; FRAMELESS aspect = the slot's screen aspect (today it is hard .476, so an iPad card would be phone-shaped) |
| `src/lib/onstage/export/gradient.ts` | reject `to <side>`, `turn` and `rad` angles loudly (catalog lint), since templates now own raw strings |
| `src/components/onstage/ArtboardThumb.tsx` (new) | DOM thumbnail built on `layoutPhase1` plus the sample canvas; used by `screens/TemplatesScreen.tsx` (3-frame search row; **remove the invisible full-card apply button**, so the card opens the detail page and "Use this set" is an explicit button), `screens/TemplateDetailScreen.tsx` (strip plus derived facts; delete "USED BY 1,840", "Inter 500 · −2.5%", the constant FITS list and the fixed copy) and `screens/LandingScreen.tsx` |
| copy | "240 sets" → the real count (TemplatesScreen:42, LandingScreen:393, OnboardingScreen:36, MobileScreen:31) |
| `src/app/layout.tsx`, `editor/ContextBar.tsx` | the font link in §5; the Font picker lists the registry families plus a weight option |
| `src/lib/onstage/export/slots.ts` | CAPTION_LOCALES re-keyed to the new default captions |

**Phase 2: the resolver and the shared 2D painter.** This is the core. It ships Marker, Big Number, Nocturne, Index, Monolith and Blueprint (without zoom),
and upgrades the five phase-1 templates to their full spec as `version: 2`, with a "Template updated · apply" chip.

- **New modules:**
  - `templates/resolve.ts`, which replaces `layoutPhase1`
  - `templates/text.ts`: rich runs, emphasis boxes (marker, pill, underline, italic swap), shrink-to-fit, kicker tokens, stat units
  - `templates/device.ts`
  - `paint/paint2D.ts` and `paint/grain.ts`: seeded 256px tile, solid/linear/radial fills, polygons, paths, dashed strokes, rounded-rect image clips,
    the grid, and dots as arcs
- **`components/onstage/artboard/ArtboardView.tsx`:** the under canvas, CSS devices and over canvas, with hit boxes that drive selection. It replaces
  CanvasStage's body, Filmstrip, GuidedScreen, StorePageScreen, StoreOverlay, ReviewScreen, AbTestScreen and ArtboardThumb.
- **`renderSet.ts`:**
  - under and over layers as `Konva.Shape` → `paint2D`; devices from `ResolvedDevice`
  - the feature graphic from `template.feature`
  - Play rules, with warnings surfaced in `ExportOverlay` preflight
- **`renderDevice.ts`:**
  - roll via `rotation.set(-p, y, -r, 'XYZ')`; lens per device
  - the render box from the **projected 8-corner bbox**, replacing dw×1.55 × dh×1.2 (:177-178)
  - `camera.setViewOffset` for the visible window of bleeding devices; tinted 2D shadows
- **`geometry.ts`:** `screenRect(geom, w)`, shared by the CSS device and Three. It fixes the .028 vs .019 inset mismatch.
- **`types.ts`:**
  - SetFrame gains `sub`, `kicker`, `stat`, `proof`, `notes`, `callouts`, `pose`, `role`; SetDoc gains `style`
  - `migrateSetDoc` v2→v3: any phase-1 legacy pose equal to the cut is dropped (template default); edited values become `frame.pose` overrides
- **Inspector:** "Template angle" / "Reset frame to template"; an aspect preview toggle (iPhone, Play, iPad, Feature); fields for proof, stat and notes.
- **Export preflight:** placeholder proof, Play banned words and text area, type-only frames on Apple, and upscaled screens.

**Phase 3: multiple sources and the strip.** This ships Duo, Blueprint's zoom cards, Ridgeline's 4|5 seam and Gallery's pairs.
- **Second screenshot:** `screenshotB` plus a second drop target (`DropZone.tsx`, `EditorScreen`), and device `source: next | prev | b`. Multi-device frames
  are composited back to front, with a per-device `render3D` cache key.
- **Zoom cards:** a crop of the device's own screen through `screenRect`, plus a draggable crop handle on the canvas.
- **Strip layer:**
  - the resolver emits strip-space draws into every frame they overlap, offset by −i·W
  - a `seam:'next'` device is rendered once and drawn into both frames
  - if a neighbour is missing, the item collapses into its owner frame
- **localStorage:** `screenshotB` roughly doubles data-URL weight, so warn at 4 MB (local.ts:232-242).

**Phase 4: content and polish.**
- **`frame.i18n`:** replaces the exact-string CAPTION_LOCALES (slots.ts:39-64); `rewriteAllCaptions` writes the same structure; Noto JP fallbacks.
- **Sample content:** dark sample variants; the 'ledger' and 'quill' sample apps; tablet sample screens.
- **Optional "settled preview":** once a pose has been idle for 400 ms, the editor swaps the selected frame's CSS device for a lazily loaded Three snapshot
  (three stays behind `import()`). That gives exact parity for the frame being judged.

### 8.3 Migrating saved localStorage docs
- **Read path:** `local.ts loadSetDoc` → `migrateSetDoc(raw)` → `openSet`, which spreads the result, never the raw doc.
- **Rules:**
  - Never delete fields; every addition is optional with a legacy default.
  - Unknown template slugs map through the alias table; otherwise they fall back to `classic`.
  - The migration is idempotent: `schema` is stamped once.
- **Undo:** zundo's `partialize` and `equality` gain the new doc fields in the same commit that adds them to `readDoc`. Otherwise autosave and undo diverge.
- **Tests:** round-trip fixtures of today's docs (`trailhead-69`, a doc with screenshots, one with panorama on, one with `device:'none'`) must resolve
  byte-for-byte to today's layout under `classic`.

### 8.4 Parity test strategy
1. **Resolver unit tests** (add `vitest`; `src/lib/onstage/templates/__tests__/`), pure with a deterministic `measure` stub. Run for every template ×
   frame counts 3/5/7 × the 6 slots × locales en, de (+35% length) and ja. Assert:
   - the device boxes of a role are identical for 1-line and 3-line captions
   - text stays inside its box, lines ≤ maxLines, and any shrink below the size raises `text-shrunk`
   - nothing is drawn outside the artboard except declared bleed
   - Play slots contain no laurel draws, and the text area is ≤20%
   - seam items appear only in the two neighbouring frames
   - `classic` matches golden JSON snapshots of today's geometry
   - every catalog colour is valid hex and every gradient string parses (catalog lint)
2. **2D painter identity** (Playwright). A dev-only `/dev/parity` route renders `NotFoundScreen` in production, as the gated routes already do. It mounts
   `<ArtboardView>` at export size and runs the export frame function for the same slot. Assert a **0-pixel diff** on the under and over layers: it is the
   same function in the same browser.
3. **Device silhouettes.** Cover a pose matrix: yaw {−22, −17, 0, 17, 22} × pitch {0, 6, 10} × roll {−6, 0, 6} × lens {5.5, 7.95, 20} × {inside, bleed}.
   - Screenshot the CSS device, with the screen and bevel filled in solid colours.
   - Compare it with the alpha mask of the Three render.
   - Require IoU ≥ 0.98 and the four screen corners within 0.5% of W.
   - This locks the roll sign, the transform order, lift-after-rotate and `screenRect`.
4. **Golden PNGs.** In CI (headless Chrome with SwiftShader WebGL), export the default set plus frame 1 of every shipped template at 1320×2868, 1080×1920
   and 2064×2752. Compare with pixelmatch at threshold 0.1, allowing ≤0.5% differing pixels for antialiasing noise. The existing decode-and-assert-dimensions
   check stays.
5. **Font gate.** With Google Fonts blocked in Playwright, export must fail with the message, and must never ship a fallback face.
6. **Zoom invariance.** Render the editor artboard at 44%, 72% and 100% zoom, downscale all three to 268 wide, and require them to match within 1% pixel
   difference. This is the regression test for the 72% bug.
