"use client";

import { useEffect, useMemo, useRef } from "react";
import { Rect, Text, Line, Group, Transformer, Circle, Image as KonvaImage } from "react-konva";
import Konva from "konva";
import type { EditorDoc, TextLayer, FrameTransform, FrameAdjust, FreeformFrameSpec, ImageLayer, Orientation, DevicePerspective } from "@/lib/editorDoc";

type KonvaNode = {
  x: (v?: number) => number;
  y: (v?: number) => number;
  width: () => number;
  height: () => number;
};
import {
  FONT_FAMILY,
  frameAdjustFor,
  frameScaleAt,
  frameRotationAt,
  framePerspectiveAt,
  frameDeviceOrientationAt,
  resolveFreeformFrames,
  freeformSelId,
  parseFreeformSel,
  DEFAULT_FRAME_ADJUST,
  masterDimsFor,
} from "@/lib/editorDoc";
import { geometryFor, deviceClassOf, type DeviceGeometry } from "@/lib/deviceGeometry";
import { computeLayout, fitFrame, keepCaptionOnCanvas, clearCaptions, type Box } from "@/lib/layout";
import { GRADIENTS } from "@/lib/gradients";
import { PALETTES } from "@/lib/palettes";
import { MESH_GRADIENTS, PATTERNS, hexToRgba, generatePatternTile } from "@/lib/backgrounds";
import DeviceFrame from "./DeviceFrame";
import DeviceFrame3D from "./DeviceFrame3D";
import type { DeviceFrame as DeviceId } from "@/lib/schema";

// Sentinel selection id for the device frame (freeform or preset) vs. a text layer id.
export const FRAME_SELECTION_ID = "__frame__";

// Transformer handle metrics. Konva's Transformer overrides getAbsoluteTransform
// to ignore ancestor transforms, so anchors render at these SCREEN pixels
// regardless of board zoom — use plain constants (do NOT divide by stage scale).
const ANCHOR_PX = 11;
const ANCHOR_RADIUS = 3;
const BORDER_W = 1.5;
const ROTATE_OFFSET = 26;
const BORDER_DASH = [6, 4];

// On-canvas orientation-flip toggle (the small device badge near a selected
// frame's corner). Sized in SCREEN px: a regular Konva node scales with the
// board zoom, so we divide by the board scale (`viewScale`) to keep it constant —
// the OPPOSITE of the Transformer anchors, which Konva already renders at constant
// screen px (it overrides getAbsoluteTransform). viewScale=1 ⇒ ignored (export).
const TOGGLE_PX = 28; // on-screen diameter
const TOGGLE_GAP_PX = 14; // gap from the device corner, on-screen

// Rotate a point (px,py) by `deg` around the origin — used to find a device's
// (rotated) top-right corner in the parent's coordinate space so the flip toggle
// sits beside it without being a child of the transformed node.
function rotatePoint(px: number, py: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: px * cos - py * sin, y: px * sin + py * cos };
}

// Rendered height of a caption at `scale` × its design size (Konva wraps the
// same way the drawn text does).
function textHeight(l: TextLayer, scale: number): number {
  const node = new Konva.Text({
    text: l.content,
    width: l.width * scale,
    fontSize: l.size * scale,
    fontFamily: FONT_FAMILY[l.font],
    fontStyle: l.weight,
    lineHeight: l.lineHeight,
    letterSpacing: l.letterSpacing * scale,
  });
  const h = node.height();
  node.destroy();
  return h;
}

// Scale a box by k about its centre.
function scaleAbout(b: Box, k: number): Box {
  const width = b.width * k;
  const height = b.height * k;
  return { x: b.x + (b.width - width) / 2, y: b.y + (b.height - height) / 2, width, height };
}

function gradientPoints(angleDeg: number, W: number, H: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const len = (Math.abs(dx) * W + Math.abs(dy) * H) / 2;
  return {
    start: { x: W / 2 - dx * len, y: H / 2 - dy * len },
    end: { x: W / 2 + dx * len, y: H / 2 + dy * len },
  };
}

export default function ScreenshotContent({
  doc,
  screenImages,
  editable = false,
  selectedLayerId = null,
  onSelectLayer,
  onDragLayer,
  onDragMoveLayer,
  onAdjustFrame,
  onFreeformFrameChange,
  onFrameScale,
  onFrameRotate,
  onToggleFrameOrientation,
  viewScale = 1,
  selectedFrameIndex = 0,
  onSelectFrame,
  layerImages,
  onImageLayerChange,
  editingTextId,
  onRequestEditText,
  guides,
  width,
  height,
  textEditable,
  watermark = false,
}: {
  doc: EditorDoc;
  screenImages: (HTMLImageElement | null)[];
  editable?: boolean;
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string) => void;
  onDragLayer?: (id: string, x: number, y: number) => void;
  onDragMoveLayer?: (id: string, node: KonvaNode) => void;
  onAdjustFrame?: (index: number, offset: { offsetX: number; offsetY: number }) => void;
  // Commit a change to ONE freeform device (move/resize/rotate/flip/device/src/crop),
  // by id. Absent on export/thumbnail.
  onFreeformFrameChange?: (id: string, partial: Partial<FreeformFrameSpec>) => void;
  // Commit a preset-layout per-slot device-size multiplier (resize handles). Editor only.
  onFrameScale?: (index: number, scale: number) => void;
  // Commit a preset-layout per-slot USER rotation (rotate handle). Editor only.
  onFrameRotate?: (index: number, rotation: number) => void;
  // Flip a preset slot's device orientation (on-canvas toggle). Editor only.
  onToggleFrameOrientation?: (index: number, orientation: Orientation) => void;
  // Board stage scale, used ONLY to keep the on-canvas flip toggle a constant
  // screen size. Absent (=1) on export/thumbnail, where the toggle never renders.
  viewScale?: number;
  // Which frame slot shows the resize transformer (selection lives in the store).
  selectedFrameIndex?: number;
  onSelectFrame?: (index: number) => void;
  // Loaded HTMLImageElements for free-floating image layers, keyed by src.
  layerImages?: Record<string, HTMLImageElement | null>;
  onImageLayerChange?: (id: string, partial: Partial<ImageLayer>) => void;
  // The text layer currently being edited inline — hidden on the canvas so only
  // the HTML textarea overlay shows. Only the live editor stage passes this.
  editingTextId?: string | null;
  onRequestEditText?: (id: string, node: Konva.Text) => void;
  guides?: { x?: number; y?: number };
  width?: number;
  height?: number;
  // Text drag/select; defaults to `editable`. Disabled when previewing a
  // non-master size (text coords are authored in the iPhone master space).
  textEditable?: boolean;
  // Free-plan watermark, baked into the render (export + preview). Default off.
  watermark?: boolean;
}) {
  // Master design space depends on orientation (portrait 1290×2796, landscape
  // 2796×1290). Text/frame/image coords live in this space; a render at W×H
  // scales by sx/sy. The editor renders at the master size, so sx = sy = 1 there
  // and editing/drag math is unaffected.
  // Canvas orientation drives the master space + layout (the export shape).
  const orientation = doc.orientation ?? "portrait";
  // Device orientation is INDEPENDENT of the canvas and resolved PER device/slot
  // (a side-by-side preset can mix upright + sideways; freeform frames each carry
  // their own). Absent = follow the canvas. See frameDeviceOrientationAt + the
  // per-frame resolution below.
  const master = masterDimsFor(orientation);
  const W = width ?? master.w;
  const H = height ?? master.h;
  const textOn = textEditable ?? editable;
  const sx = W / master.w;
  const sy = H / master.h;

  const layout = computeLayout(doc.layout, W, H);
  const cls = deviceClassOf(doc.device);
  const isFreeform = doc.layout === "freeform";
  const frameSelected = selectedLayerId === FRAME_SELECTION_ID;

  // At an export size whose aspect differs from the design (iPad, Play tablet),
  // keep captions on the canvas and fit each device into the space they leave,
  // wherever the two were clear of each other in the design. The editor and
  // thumbnails render at the design's aspect, so nothing changes there.
  const captionY: Record<string, number> = {};
  let frameBoxes = layout.frames.map((fp) => fp.box);
  if (!isFreeform && Math.abs(sx / sy - 1) > 0.01) {
    const captions = doc.textLayers.map((l) => {
      const design = { x: l.x, y: l.y, width: l.width, height: textHeight(l, 1) };
      const render = { x: l.x * sx, y: l.y * sy, width: l.width * sx, height: textHeight(l, sx) };
      render.y = captionY[l.id] = keepCaptionOnCanvas(design, render, master.h, H);
      return { design, render };
    });
    if (!layout.captionOnTop) {
      const designFrames = computeLayout(doc.layout, master.w, master.h).frames;
      frameBoxes = layout.frames.map((fp, i) => {
        const aspect = geometryFor(doc.device, frameDeviceOrientationAt(doc, i)).aspect;
        const fs = frameScaleAt(doc, i);
        const design = scaleAbout(fitFrame(designFrames[i]?.box ?? fp.box, aspect), fs);
        const render = scaleAbout(fitFrame(fp.box, aspect), fs);
        const cleared = clearCaptions({ design, render }, captions, master.h, H);
        return cleared === render ? fp.box : scaleAbout(cleared, 1 / fs);
      });
    }
  }

  const bg = doc.background;
  let bgPts: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;
  let bgStops: (number | string)[] = [];
  if (bg.kind === "gradient") {
    const g = GRADIENTS.find((x) => x.id === bg.id) ?? GRADIENTS[0];
    bgPts = gradientPoints(g.angle, W, H);
    bgStops = g.stops.flatMap((s) => [s.position, s.color]);
  } else if (bg.kind === "palette") {
    const p = PALETTES.find((x) => x.id === bg.id) ?? PALETTES[0];
    const c = p.colors;
    bgPts = gradientPoints(135, W, H);
    bgStops = [0, c[1] ?? c[0], 0.5, c[2] ?? c[c.length - 1], 1, c[3] ?? c[c.length - 1]];
  } else if (bg.kind === "custom-gradient") {
    bgPts = gradientPoints(bg.angle, W, H);
    bgStops = [0, bg.from, 1, bg.to];
  }

  // Pattern backgrounds repeat a generated canvas tile (same-origin → no taint).
  const patternId = bg.kind === "pattern" ? bg.id : null;
  const patternTile = useMemo(
    () => (patternId ? generatePatternTile(PATTERNS.find((x) => x.id === patternId) ?? PATTERNS[0]) : null),
    [patternId],
  );

  const renderBackground = () => {
    if (bg.kind === "solid") {
      return <Rect x={0} y={0} width={W} height={H} fill={bg.color} listening={false} />;
    }
    if (bg.kind === "image") {
      // Cover the canvas, centred; a dark fill shows until the image loads.
      const img = layerImages?.[bg.src];
      const k = img && img.width > 0 ? Math.max(W / img.width, H / img.height) : 0;
      return (
        <>
          <Rect x={0} y={0} width={W} height={H} fill="#111111" listening={false} />
          {img && k > 0 && (
            <KonvaImage
              image={img}
              x={(W - img.width * k) / 2}
              y={(H - img.height * k) / 2}
              width={img.width * k}
              height={img.height * k}
              listening={false}
            />
          )}
        </>
      );
    }
    if (bg.kind === "mesh") {
      const mesh = MESH_GRADIENTS.find((x) => x.id === bg.id) ?? MESH_GRADIENTS[0];
      const maxR = Math.max(W, H);
      return (
        <>
          <Rect x={0} y={0} width={W} height={H} fill={mesh.base} listening={false} />
          {mesh.blobs.map((b, i) => (
            <Rect
              key={i}
              x={0}
              y={0}
              width={W}
              height={H}
              fillRadialGradientStartPoint={{ x: b.x * W, y: b.y * H }}
              fillRadialGradientStartRadius={0}
              fillRadialGradientEndPoint={{ x: b.x * W, y: b.y * H }}
              fillRadialGradientEndRadius={b.r * maxR}
              fillRadialGradientColorStops={[0, hexToRgba(b.color, 0.95), 0.55, hexToRgba(b.color, 0.4), 1, hexToRgba(b.color, 0)]}
              listening={false}
            />
          ))}
        </>
      );
    }
    if (bg.kind === "pattern") {
      const pat = PATTERNS.find((x) => x.id === bg.id) ?? PATTERNS[0];
      return (
        <>
          <Rect x={0} y={0} width={W} height={H} fill={pat.bg} listening={false} />
          {patternTile && (
            <Rect
              x={0}
              y={0}
              width={W}
              height={H}
              // Konva's createPattern accepts any CanvasImageSource at runtime;
              // the prop type only lists HTMLImageElement, hence the cast.
              fillPatternImage={patternTile as unknown as HTMLImageElement}
              fillPatternRepeat="repeat"
              fillPatternScale={{ x: sx, y: sx }}
              listening={false}
            />
          )}
        </>
      );
    }
    // gradient / palette → linear gradient
    return (
      <Rect
        x={0}
        y={0}
        width={W}
        height={H}
        fillLinearGradientStartPoint={bgPts!.start}
        fillLinearGradientEndPoint={bgPts!.end}
        fillLinearGradientColorStops={bgStops}
        listening={false}
      />
    );
  };

  const renderText = (l: TextLayer) => (
    <Text
      key={l.id}
      name="textlayer"
      visible={l.id !== editingTextId}
      text={l.content}
      x={l.x * sx}
      y={captionY[l.id] ?? l.y * sy}
      width={l.width * sx}
      align={l.align}
      fontFamily={FONT_FAMILY[l.font]}
      fontStyle={l.weight}
      fontSize={l.size * sx}
      letterSpacing={l.letterSpacing * sx}
      lineHeight={l.lineHeight}
      fill={l.color}
      draggable={textOn}
      onClick={(e) => {
        onSelectLayer?.(l.id);
        onRequestEditText?.(l.id, e.target as Konva.Text);
      }}
      onTap={(e) => {
        onSelectLayer?.(l.id);
        onRequestEditText?.(l.id, e.target as Konva.Text);
      }}
      onDragMove={(e) => onDragMoveLayer?.(l.id, e.target as unknown as KonvaNode)}
      onDragEnd={(e) => onDragLayer?.(l.id, e.target.x(), e.target.y())}
    />
  );

  const renderOutline = (l: TextLayer) => {
    if (!textOn || l.id !== selectedLayerId || l.id === editingTextId) return null;
    const lines = Math.max(1, l.content.split("\n").length);
    const approxH = lines * l.size * sx * l.lineHeight;
    return (
      <Rect
        key={`o-${l.id}`}
        x={l.x * sx - 10}
        y={l.y * sy - 10}
        width={l.width * sx + 20}
        height={approxH + 20}
        stroke="#3B82F6"
        strokeWidth={8}
        dash={[18, 12]}
        listening={false}
      />
    );
  };

  // NOTE: this renders <Group>s, not <Layer>s, so the board can position N of
  // these inside one Stage (Konva forbids a Layer inside a Group). Every caller
  // must wrap <ScreenshotContent/> in a <Layer> (the board, export, thumbnail all do).
  return (
    <>
      <Group listening={editable}>
        {/* Background never listens, so a click on empty canvas hits the Stage
            itself — the editor uses that to deselect the active layer. */}
        {renderBackground()}
        {isFreeform ? (
          // Multi-device freeform: each device is independent (model, orientation,
          // image, placement, crop). Legacy single-device docs resolve to one frame.
          resolveFreeformFrames(doc).map((ff) => {
            const ffOrientation = ff.deviceOrientation ?? orientation;
            const ffGeo = geometryFor(ff.device, ffOrientation);
            return (
              <FreeformFrame
                key={ff.id}
                transform={{ x: ff.x, y: ff.y, width: ff.width, rotation: ff.rotation }}
                geo={ffGeo}
                device={ff.device}
                perspective={ff.perspective === undefined ? doc.perspective : ff.perspective ?? undefined}
                orientation={ffOrientation}
                screenImage={ff.src ? layerImages?.[ff.src] ?? null : null}
                adjust={ff.adjust ?? DEFAULT_FRAME_ADJUST}
                sx={sx}
                sy={sy}
                viewScale={viewScale}
                interactive={textOn}
                selected={parseFreeformSel(selectedLayerId) === ff.id}
                onSelect={() => onSelectLayer?.(freeformSelId(ff.id))}
                onChange={(partial) => onFreeformFrameChange?.(ff.id, partial)}
              />
            );
          })
        ) : (
          layout.frames.map((fp, i) => {
            // Orientation, geometry and rotation are PER SLOT (a side-by-side
            // layout can mix an upright + a sideways phone, each at its own tilt).
            const slotOrientation = frameDeviceOrientationAt(doc, i);
            const slotGeo = geometryFor(doc.device, slotOrientation);
            return (
              <PresetFrame
                key={i}
                box={frameBoxes[i]}
                layoutRotation={fp.rotation ?? 0}
                userRotation={frameRotationAt(doc, i)}
                geo={slotGeo}
                device={doc.device}
                perspective={framePerspectiveAt(doc, i)}
                orientation={slotOrientation}
                screenImage={screenImages[i] ?? screenImages[0] ?? null}
                adjust={frameAdjustFor(doc, cls, i)}
                frameScale={frameScaleAt(doc, i)}
                viewScale={viewScale}
                editable={editable}
                interactive={textOn}
                selected={frameSelected && selectedFrameIndex === i}
                onSelect={() => {
                  onSelectLayer?.(FRAME_SELECTION_ID);
                  onSelectFrame?.(i);
                }}
                onAdjust={(off) => onAdjustFrame?.(i, off)}
                onResize={(scale) => onFrameScale?.(i, scale)}
                onRotate={(rot) => onFrameRotate?.(i, rot)}
                onToggleOrientation={() =>
                  onToggleFrameOrientation?.(i, slotOrientation === "portrait" ? "landscape" : "portrait")
                }
              />
            );
          })
        )}
        {/* Free-floating image layers sit above the device, below the captions. */}
        {(doc.imageLayers ?? []).map((il) => (
          <ImageLayerNode
            key={il.id}
            layer={il}
            image={layerImages?.[il.src] ?? null}
            sx={sx}
            sy={sy}
            interactive={textOn}
            selected={selectedLayerId === il.id}
            onSelect={() => onSelectLayer?.(il.id)}
            onChange={(partial) => onImageLayerChange?.(il.id, partial)}
          />
        ))}
      </Group>
      <Group listening={textOn}>
        {doc.textLayers.map(renderText)}
        {doc.textLayers.map(renderOutline)}
        {textOn && guides?.x != null && (
          <Line points={[guides.x, 0, guides.x, H]} stroke="#F43F8E" strokeWidth={4} listening={false} />
        )}
        {textOn && guides?.y != null && (
          <Line points={[0, guides.y, W, guides.y]} stroke="#F43F8E" strokeWidth={4} listening={false} />
        )}
      </Group>
      {watermark && (
        <Text
          text="Made with Onstage"
          x={0}
          y={H - H * 0.052}
          width={W}
          align="center"
          fontFamily="Inter"
          fontStyle="600"
          fontSize={W * 0.024}
          fill="rgba(255,255,255,0.66)"
          shadowColor="#000000"
          shadowBlur={W * 0.012}
          shadowOpacity={0.5}
          listening={false}
        />
      )}
    </>
  );
}

// The freeform device: a draggable group with a Konva Transformer for
// resize + rotate. The transform is stored in master (1290×2796) space; the
// transformer only attaches in the master (iPhone) preview where sx = sy = 1,
// so node coordinates read back directly as master values. Other previews and
// the export path render it statically, scaled by sx.
function FreeformFrame({
  transform,
  geo,
  device,
  perspective,
  orientation,
  screenImage,
  adjust,
  sx,
  sy,
  viewScale,
  interactive,
  selected,
  onSelect,
  onChange,
}: {
  transform: FrameTransform;
  geo: DeviceGeometry;
  device: DeviceId;
  perspective?: DevicePerspective;
  orientation: "portrait" | "landscape";
  screenImage: HTMLImageElement | null;
  adjust: FrameAdjust;
  sx: number;
  sy: number;
  viewScale: number;
  interactive: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<FreeformFrameSpec>) => void;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Re-attach/refresh the transformer when selection or the committed transform
  // changes, so its handle box tracks a programmatic resize (we bake scale into
  // width on transform end, which doesn't fire a Konva transform event).
  useEffect(() => {
    const tr = trRef.current;
    const node = groupRef.current;
    if (!tr) return;
    if (interactive && selected && node) {
      tr.nodes([node]);
      tr.forceUpdate();
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [interactive, selected, transform.x, transform.y, transform.width, transform.rotation, sx, sy]);

  const fw = transform.width * sx;
  const fh = fw / geo.aspect;

  return (
    <>
      <Group
        ref={groupRef}
        x={transform.x * sx}
        y={transform.y * sy}
        rotation={transform.rotation}
        draggable={interactive}
        onMouseDown={interactive ? onSelect : undefined}
        onTap={interactive ? onSelect : undefined}
        onDragEnd={(e) => onChange({ x: e.target.x() / sx, y: e.target.y() / sy })}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: node.x() / sx,
            y: node.y() / sy,
            width: Math.max(160, transform.width * scaleX),
            rotation: node.rotation(),
          });
        }}
      >
        {perspective ? (
          <DeviceFrame3D f={{ x: 0, y: 0, width: fw, height: fh }} geo={geo} device={device} perspective={perspective} orientation={orientation} screenImage={screenImage} adjust={adjust} />
        ) : (
          <DeviceFrame f={{ x: 0, y: 0, width: fw, height: fh }} geo={geo} orientation={orientation} screenImage={screenImage} adjust={adjust} editable={false} />
        )}
      </Group>
      {interactive && selected && (
        <Transformer
          ref={trRef}
          keepRatio
          rotationSnaps={[0, 90, 180, 270]}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          anchorSize={ANCHOR_PX}
          anchorCornerRadius={ANCHOR_RADIUS}
          anchorStroke="#56b8e6"
          anchorFill="#ffffff"
          borderStroke="#56b8e6"
          borderStrokeWidth={BORDER_W}
          borderDash={BORDER_DASH}
          rotateAnchorOffset={ROTATE_OFFSET}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 60 ? oldBox : newBox)}
        />
      )}
      {interactive && selected &&
        (() => {
          // Flip toggle beside the device's (rotated) top-right corner. The device
          // is drawn from the group's top-left origin, so its top-right corner is
          // (fw,0) rotated by transform.rotation, in the parent's space.
          const c = rotatePoint(fw, 0, transform.rotation);
          return (
            <OrientationToggle
              cornerX={transform.x * sx + c.x}
              cornerY={transform.y * sy + c.y}
              viewScale={viewScale}
              orientation={orientation}
              onToggle={() => onChange({ deviceOrientation: orientation === "portrait" ? "landscape" : "portrait" })}
            />
          );
        })()}
    </>
  );
}

// A preset-layout device: positioned + sized by computeLayout's frame box, then
// scaled by the per-screenshot frameScale. When selected it gets a centered,
// corner-only transformer for resize PLUS a rotate handle (free tilt). The device
// is drawn centered at the group origin so centeredScaling AND rotation both pivot
// about the device centre; the box-derived position is re-applied every render, so
// neither resize nor rotate drifts. The on-canvas total tilt = the layout's own
// built-in tilt (layoutRotation, e.g. angled-frame −9°) + the user's rotation.
function PresetFrame({
  box,
  layoutRotation,
  userRotation,
  geo,
  device,
  perspective,
  orientation,
  screenImage,
  adjust,
  frameScale,
  viewScale,
  editable,
  interactive,
  selected,
  onSelect,
  onAdjust,
  onResize,
  onRotate,
  onToggleOrientation,
}: {
  box: Box;
  layoutRotation: number;
  userRotation: number;
  geo: DeviceGeometry;
  device: DeviceId;
  perspective?: DevicePerspective;
  orientation: "portrait" | "landscape";
  screenImage: HTMLImageElement | null;
  adjust: FrameAdjust;
  frameScale: number;
  viewScale: number;
  editable: boolean;
  interactive: boolean;
  selected: boolean;
  onSelect: () => void;
  onAdjust: (offset: { offsetX: number; offsetY: number }) => void;
  onResize: (scale: number) => void;
  onRotate: (rotation: number) => void;
  onToggleOrientation: () => void;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Base fit (centered in the box) × this slot's scale, centered at (cx,cy).
  const base = fitFrame(box, geo.aspect);
  const sw = base.width * frameScale;
  const sh = base.height * frameScale;
  const cx = base.x + base.width / 2;
  const cy = base.y + base.height / 2;
  // The node's rotation is the layout tilt + the user's added rotation.
  const total = layoutRotation + userRotation;

  // Re-attach/refresh the transformer when selection / size / rotation changes
  // (we bake scale→frameScale and rotation→userRotation on transform end, which
  // doesn't fire a Konva transform event), so its handle box tracks the device.
  useEffect(() => {
    const tr = trRef.current;
    const node = groupRef.current;
    if (!tr) return;
    if (interactive && selected && node) {
      tr.nodes([node]);
      tr.forceUpdate();
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [interactive, selected, sw, sh, cx, cy, total]);

  return (
    <>
      <Group
        ref={groupRef}
        x={cx}
        y={cy}
        rotation={total}
        onMouseDown={interactive ? onSelect : undefined}
        onTap={interactive ? onSelect : undefined}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          // A transformer gesture is EITHER a corner resize (scaleX≠1, rotation
          // unchanged) OR a rotate (scaleX==1, rotation changed). Reset scale and
          // commit whichever changed as its own undoable step. Position never moves
          // because both pivot about the centre (= the group origin), so we don't
          // read node.x()/y() — the box-derived (cx,cy) is re-applied on re-render.
          const k = node.scaleX();
          node.scaleX(1);
          node.scaleY(1);
          if (Math.abs(k - 1) > 0.001) {
            onResize(frameScale * k);
          } else {
            // Bake the user's rotation by subtracting the layout's own tilt.
            onRotate(node.rotation() - layoutRotation);
          }
        }}
      >
        {perspective ? (
          <DeviceFrame3D
            f={{ x: -sw / 2, y: -sh / 2, width: sw, height: sh }}
            geo={geo}
            device={device}
            perspective={perspective}
            orientation={orientation}
            screenImage={screenImage}
            adjust={adjust}
          />
        ) : (
          <DeviceFrame
            f={{ x: -sw / 2, y: -sh / 2, width: sw, height: sh }}
            geo={geo}
            orientation={orientation}
            screenImage={screenImage}
            adjust={adjust}
            editable={editable}
            onAdjust={onAdjust}
          />
        )}
      </Group>
      {interactive && selected && (
        <Transformer
          ref={trRef}
          keepRatio
          centeredScaling
          rotationSnaps={[0, 90, 180, 270]}
          rotateAnchorOffset={ROTATE_OFFSET}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          anchorSize={ANCHOR_PX}
          anchorCornerRadius={ANCHOR_RADIUS}
          anchorStroke="#56b8e6"
          anchorFill="#ffffff"
          borderStroke="#56b8e6"
          borderStrokeWidth={BORDER_W}
          borderDash={BORDER_DASH}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 60 ? oldBox : newBox)}
        />
      )}
      {interactive && selected &&
        (() => {
          // Flip toggle beside the device's (rotated) top-right corner. The device
          // is centred on the group origin (cx,cy), so its top-right corner is
          // (sw/2,−sh/2) rotated by `total`, in the parent's space.
          const c = rotatePoint(sw / 2, -sh / 2, total);
          return (
            <OrientationToggle
              cornerX={cx + c.x}
              cornerY={cy + c.y}
              viewScale={viewScale}
              orientation={orientation}
              onToggle={onToggleOrientation}
            />
          );
        })()}
    </>
  );
}

// The on-canvas 90° flip control — a small accent badge beside a selected
// device's corner, showing a phone glyph in the CURRENT orientation (tall =
// upright, wide = sideways); clicking flips it. Sized in constant screen px via
// `viewScale` (see TOGGLE_PX). Rendered in the PARENT's (unrotated) space so the
// glyph stays upright and it's NOT a child of the transformed node (which would
// otherwise pull the transformer's bounding box off-centre).
function OrientationToggle({
  cornerX,
  cornerY,
  viewScale,
  orientation,
  onToggle,
}: {
  cornerX: number;
  cornerY: number;
  viewScale: number;
  orientation: "portrait" | "landscape";
  onToggle: () => void;
}) {
  const s = TOGGLE_PX / viewScale;
  const out = (TOGGLE_GAP_PX + TOGGLE_PX / 2) / viewScale; // push up-right of the corner
  const r = s / 2;
  const landscape = orientation === "landscape";
  const pw = landscape ? s * 0.46 : s * 0.3;
  const ph = landscape ? s * 0.3 : s * 0.46;
  const setCursor = (stage: { container: () => HTMLElement } | null | undefined, cursor: string) => {
    if (stage) stage.container().style.cursor = cursor;
  };
  return (
    <Group
      x={cornerX + out}
      y={cornerY - out}
      onMouseDown={(e) => {
        e.cancelBubble = true; // don't start a drag / deselect the frame
        onToggle();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onToggle();
      }}
      onMouseEnter={(e) => setCursor(e.target.getStage(), "pointer")}
      onMouseLeave={(e) => setCursor(e.target.getStage(), "default")}
    >
      <Circle radius={r} fill="#56b8e6" stroke="#0b0b0f" strokeWidth={s * 0.05} shadowColor="#000000" shadowBlur={r * 0.7} shadowOpacity={0.4} />
      <Rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} cornerRadius={s * 0.08} stroke="#ffffff" strokeWidth={s * 0.08} />
    </Group>
  );
}

// A free-floating image layer: a Konva image with the same transformer-based
// move/resize/rotate as the freeform device. width+height keep the image's own
// aspect (keepRatio). Authored in master space; non-master previews scale by sx.
function ImageLayerNode({
  layer,
  image,
  sx,
  sy,
  interactive,
  selected,
  onSelect,
  onChange,
}: {
  layer: ImageLayer;
  image: HTMLImageElement | null;
  sx: number;
  sy: number;
  interactive: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<ImageLayer>) => void;
}) {
  const ref = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const tr = trRef.current;
    const node = ref.current;
    if (!tr) return;
    if (interactive && selected && node) {
      tr.nodes([node]);
      tr.forceUpdate();
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [interactive, selected, layer.x, layer.y, layer.width, layer.height, layer.rotation, sx, sy]);

  return (
    <>
      <KonvaImage
        ref={ref}
        image={image ?? undefined}
        x={layer.x * sx}
        y={layer.y * sy}
        width={layer.width * sx}
        height={layer.height * sx}
        rotation={layer.rotation}
        draggable={interactive}
        onMouseDown={interactive ? onSelect : undefined}
        onTap={interactive ? onSelect : undefined}
        onDragEnd={(e) => onChange({ x: e.target.x() / sx, y: e.target.y() / sy })}
        onTransformEnd={() => {
          const node = ref.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: node.x() / sx,
            y: node.y() / sy,
            width: Math.max(40, layer.width * scaleX),
            height: Math.max(40, layer.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {interactive && selected && (
        <Transformer
          ref={trRef}
          keepRatio
          rotationSnaps={[0, 90, 180, 270]}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          anchorSize={ANCHOR_PX}
          anchorCornerRadius={ANCHOR_RADIUS}
          anchorStroke="#56b8e6"
          anchorFill="#ffffff"
          borderStroke="#56b8e6"
          borderStrokeWidth={BORDER_W}
          borderDash={BORDER_DASH}
          rotateAnchorOffset={ROTATE_OFFSET}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 30 ? oldBox : newBox)}
        />
      )}
    </>
  );
}
