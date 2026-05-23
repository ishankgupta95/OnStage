"use client";

import { useEffect, useMemo, useRef } from "react";
import { Layer, Rect, Text, Line, Group, Transformer, Image as KonvaImage } from "react-konva";
import type Konva from "konva";
import type { EditorDoc, TextLayer, FrameTransform, FrameAdjust, ImageLayer } from "@/lib/editorDoc";

type KonvaNode = {
  x: (v?: number) => number;
  y: (v?: number) => number;
  width: () => number;
  height: () => number;
};
import { FONT_FAMILY, frameAdjustFor, DEFAULT_FRAME_TRANSFORM, masterDimsFor } from "@/lib/editorDoc";
import { geometryFor, deviceClassOf, type DeviceGeometry } from "@/lib/deviceGeometry";
import { computeLayout, fitFrame } from "@/lib/layout";
import { GRADIENTS } from "@/lib/gradients";
import { PALETTES } from "@/lib/palettes";
import { MESH_GRADIENTS, PATTERNS, hexToRgba, generatePatternTile } from "@/lib/backgrounds";
import DeviceFrame from "./DeviceFrame";

// Sentinel selection id for the freeform device frame (vs. a text layer id).
export const FRAME_SELECTION_ID = "__frame__";

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
  onFrameTransform,
  layerImages,
  onImageLayerChange,
  editingTextId,
  onRequestEditText,
  guides,
  width,
  height,
  textEditable,
}: {
  doc: EditorDoc;
  screenImages: (HTMLImageElement | null)[];
  editable?: boolean;
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string) => void;
  onDragLayer?: (id: string, x: number, y: number) => void;
  onDragMoveLayer?: (id: string, node: KonvaNode) => void;
  onAdjustFrame?: (index: number, offset: { offsetX: number; offsetY: number }) => void;
  // Commit a freeform frame transform (master-space). Absent on export/thumbnail.
  onFrameTransform?: (partial: Partial<FrameTransform>) => void;
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
}) {
  // Master design space depends on orientation (portrait 1290×2796, landscape
  // 2796×1290). Text/frame/image coords live in this space; a render at W×H
  // scales by sx/sy. The editor renders at the master size, so sx = sy = 1 there
  // and editing/drag math is unaffected.
  const orientation = doc.orientation ?? "portrait";
  const master = masterDimsFor(orientation);
  const W = width ?? master.w;
  const H = height ?? master.h;
  const textOn = textEditable ?? editable;
  const sx = W / master.w;
  const sy = H / master.h;

  const layout = computeLayout(doc.layout, W, H);
  const geo = geometryFor(doc.device, orientation);
  const cls = deviceClassOf(doc.device);
  const isFreeform = doc.layout === "freeform";
  const frameSelected = selectedLayerId === FRAME_SELECTION_ID;

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
      y={l.y * sy}
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

  return (
    <>
      <Layer listening={editable}>
        {/* Background never listens, so a click on empty canvas hits the Stage
            itself — the editor uses that to deselect the active layer. */}
        {renderBackground()}
        {isFreeform ? (
          <FreeformFrame
            transform={doc.frameTransform ?? DEFAULT_FRAME_TRANSFORM}
            geo={geo}
            orientation={orientation}
            screenImage={screenImages[0] ?? null}
            adjust={frameAdjustFor(doc, cls, 0)}
            sx={sx}
            sy={sy}
            interactive={textOn}
            selected={frameSelected}
            onSelect={() => onSelectLayer?.(FRAME_SELECTION_ID)}
            onChange={(partial) => onFrameTransform?.(partial)}
          />
        ) : (
          layout.frames.map((fp, i) => (
            <DeviceFrame
              key={i}
              f={fitFrame(fp.box, geo.aspect)}
              geo={geo}
              orientation={orientation}
              screenImage={screenImages[i] ?? screenImages[0] ?? null}
              rotation={fp.rotation}
              adjust={frameAdjustFor(doc, cls, i)}
              editable={editable}
              onAdjust={(off) => onAdjustFrame?.(i, off)}
            />
          ))
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
      </Layer>
      <Layer listening={textOn}>
        {doc.textLayers.map(renderText)}
        {doc.textLayers.map(renderOutline)}
        {textOn && guides?.x != null && (
          <Line points={[guides.x, 0, guides.x, H]} stroke="#F43F8E" strokeWidth={4} listening={false} />
        )}
        {textOn && guides?.y != null && (
          <Line points={[0, guides.y, W, guides.y]} stroke="#F43F8E" strokeWidth={4} listening={false} />
        )}
      </Layer>
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
  orientation,
  screenImage,
  adjust,
  sx,
  sy,
  interactive,
  selected,
  onSelect,
  onChange,
}: {
  transform: FrameTransform;
  geo: DeviceGeometry;
  orientation: "portrait" | "landscape";
  screenImage: HTMLImageElement | null;
  adjust: FrameAdjust;
  sx: number;
  sy: number;
  interactive: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (partial: Partial<FrameTransform>) => void;
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
        <DeviceFrame f={{ x: 0, y: 0, width: fw, height: fh }} geo={geo} orientation={orientation} screenImage={screenImage} adjust={adjust} editable={false} />
      </Group>
      {interactive && selected && (
        <Transformer
          ref={trRef}
          keepRatio
          rotationSnaps={[0, 90, 180, 270]}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          anchorSize={26}
          anchorCornerRadius={6}
          anchorStroke="#56b8e6"
          anchorFill="#ffffff"
          borderStroke="#56b8e6"
          borderStrokeWidth={3}
          borderDash={[12, 8]}
          rotateAnchorOffset={48}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 60 ? oldBox : newBox)}
        />
      )}
    </>
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
          anchorSize={26}
          anchorCornerRadius={6}
          anchorStroke="#56b8e6"
          anchorFill="#ffffff"
          borderStroke="#56b8e6"
          borderStrokeWidth={3}
          borderDash={[12, 8]}
          rotateAnchorOffset={48}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 30 ? oldBox : newBox)}
        />
      )}
    </>
  );
}
