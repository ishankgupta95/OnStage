"use client";

import { useEditorStore } from "@/store/editor";
import { DEVICES } from "@/lib/devices";
import { deviceClassOf } from "@/lib/deviceGeometry";
import { computeLayout, fitFrame } from "@/lib/layout";
import { GRADIENTS } from "@/lib/gradients";
import { SOLID_BACKGROUNDS, PALETTES } from "@/lib/palettes";
import { MESH_GRADIENTS, PATTERNS, meshSwatchStyle, patternSwatchStyle } from "@/lib/backgrounds";
import type { Orientation } from "@/lib/editorDoc";
import type { LayoutPreset } from "@/lib/schema";

const ORIENTATIONS: { id: Orientation; label: string }[] = [
  { id: "portrait", label: "Portrait" },
  { id: "landscape", label: "Landscape" },
];

const LAYOUTS: { id: LayoutPreset; label: string }[] = [
  { id: "freeform", label: "Freeform" },
  { id: "text-above", label: "Text above" },
  { id: "text-below", label: "Text below" },
  { id: "text-overlay-top", label: "Overlay" },
  { id: "headline-over", label: "Headline" },
  { id: "callout-left", label: "Callout L" },
  { id: "callout-right", label: "Callout R" },
  { id: "feature-list", label: "Features" },
  { id: "quote-above", label: "Quote" },
  { id: "stat-callout", label: "Stat" },
  { id: "logo-tagline", label: "Logo" },
  { id: "full-bleed", label: "Full bleed" },
  { id: "frame-bleed", label: "Off-edge" },
  { id: "angled-frame", label: "Angled" },
  { id: "side-by-side", label: "Side by side" },
  { id: "staggered", label: "Staggered" },
  { id: "overlap", label: "Overlap" },
  { id: "triptych", label: "Triptych" },
  { id: "panoramic", label: "Panoramic" },
  { id: "photo-inset", label: "Photo inset" },
];

// A schematic preview of a layout, derived from computeLayout itself so the
// thumbnail always matches the real composition. Frame slots are foreground
// rects; the caption slot is suggested with a couple of accent lines.
function LayoutThumb({ id, orientation }: { id: LayoutPreset; orientation: Orientation }) {
  const landscape = orientation === "landscape";
  const W = landscape ? 56 : 38;
  const H = landscape ? 28 : 82;
  const aspect = landscape ? 2.05 : 0.48;
  const { caption, frames } = computeLayout(id, W, H);
  return (
    <div className="relative overflow-hidden rounded-[3px] bg-muted" style={{ width: W, height: H }}>
      {frames.map((fp, i) => {
        const b = fitFrame(fp.box, aspect);
        return (
          <div
            key={i}
            className={
              id === "freeform"
                ? "absolute rounded-[2px] border border-dashed border-foreground/50 bg-foreground/10"
                : "absolute rounded-[2px] bg-foreground/30"
            }
            style={{
              left: b.x,
              top: b.y,
              width: b.width,
              height: b.height,
              transform: fp.rotation ? `rotate(${fp.rotation}deg)` : undefined,
            }}
          />
        );
      })}
      {caption && (
        <>
          <div className="absolute rounded-full bg-primary/70" style={{ left: caption.x, top: caption.y, width: caption.width, height: 3 }} />
          <div className="absolute rounded-full bg-primary/40" style={{ left: caption.x, top: caption.y + 5, width: caption.width * 0.6, height: 3 }} />
        </>
      )}
    </div>
  );
}

export default function LeftSidebar({ readOnly = false }: { readOnly?: boolean }) {
  const doc = useEditorStore((s) => s.doc);
  const updateDoc = useEditorStore((s) => s.updateDoc);
  const setLayout = useEditorStore((s) => s.setLayout);
  const setOrientation = useEditorStore((s) => s.setOrientation);
  const setPreviewClass = useEditorStore((s) => s.setPreviewClass);
  const orientation = doc.orientation ?? "portrait";

  return (
    <aside
      className={`w-72 shrink-0 animate-in fade-in slide-in-from-left-2 space-y-6 overflow-y-auto border-r p-4 duration-500 ${readOnly ? "opacity-60" : ""}`}
      inert={readOnly || undefined}
    >
      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Orientation</h3>
        <div className="flex items-center gap-0.5 rounded-md border p-0.5 text-xs">
          {ORIENTATIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOrientation(o.id)}
              className={`flex-1 rounded px-2 py-1 transition-colors ${orientation === o.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Layout</h3>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayout(l.id)}
              title={l.label}
              className={`flex flex-col items-center gap-1 rounded-md border p-1.5 transition-all hover:bg-accent active:scale-[0.97] ${doc.layout === l.id ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <LayoutThumb id={l.id} orientation={orientation} />
              <span className="w-full truncate text-center text-[10px] leading-tight">{l.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Device</h3>
        <div className="space-y-1">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                updateDoc({ device: d.id });
                // Switch the canvas preview to this device's family so the change is visible.
                setPreviewClass(deviceClassOf(d.id));
              }}
              className={`block w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent ${doc.device === d.id ? "border-primary ring-1 ring-primary" : ""}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Background</h3>
        <div className="grid grid-cols-4 gap-2">
          {GRADIENTS.map((g) => {
            const css = `linear-gradient(${g.angle}deg, ${g.stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ")})`;
            const active = doc.background.kind === "gradient" && doc.background.id === g.id;
            return (
              <button
                key={g.id}
                onClick={() => updateDoc({ background: { kind: "gradient", id: g.id } })}
                className={`h-12 rounded-md border transition-transform hover:scale-[1.03] ${active ? "ring-2 ring-primary" : ""}`}
                style={{ background: css }}
                title={g.label}
                aria-label={g.label}
              />
            );
          })}
        </div>
        <p className="mb-2 mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Solid</p>
        <div className="grid grid-cols-8 gap-1.5">
          {SOLID_BACKGROUNDS.map((c) => {
            const active = doc.background.kind === "solid" && doc.background.color === c;
            return (
              <button
                key={c}
                onClick={() => updateDoc({ background: { kind: "solid", color: c } })}
                className={`h-7 rounded border ${active ? "ring-2 ring-primary" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={`solid ${c}`}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mesh</h3>
        <div className="grid grid-cols-3 gap-2">
          {MESH_GRADIENTS.map((m) => {
            const active = doc.background.kind === "mesh" && doc.background.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => updateDoc({ background: { kind: "mesh", id: m.id } })}
                className={`h-14 rounded-md border transition-transform hover:scale-[1.03] ${active ? "ring-2 ring-primary" : ""}`}
                style={meshSwatchStyle(m)}
                title={m.label}
                aria-label={m.label}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Patterns</h3>
        <div className="grid grid-cols-3 gap-2">
          {PATTERNS.map((p) => {
            const active = doc.background.kind === "pattern" && doc.background.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => updateDoc({ background: { kind: "pattern", id: p.id } })}
                className={`h-14 rounded-md border transition-transform hover:scale-[1.03] ${active ? "ring-2 ring-primary" : ""}`}
                style={patternSwatchStyle(p)}
                title={p.label}
                aria-label={p.label}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Palettes</h3>
        <div className="space-y-1.5">
          {PALETTES.map((p) => {
            const active = doc.background.kind === "palette" && doc.background.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => updateDoc({ background: { kind: "palette", id: p.id } })}
                className={`flex w-full items-center gap-2 rounded-md border p-1.5 hover:bg-accent ${active ? "border-primary ring-1 ring-primary" : ""}`}
                title={p.label}
              >
                <span className="flex overflow-hidden rounded">
                  {p.colors.map((c) => (
                    <span key={c} className="h-5 w-5" style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span className="text-[11px]">{p.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
