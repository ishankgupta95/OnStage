"use client";

import { useRef, type ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon, ImagePlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEditorStore } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { FONTS } from "@/lib/schema";
import { FONT_LABEL, FONT_FAMILY, CAPTION_COLORS, CAPTION_WEIGHTS, DEFAULT_FRAME_ADJUST, DEFAULT_FRAME_TRANSFORM, masterDimsFor, frameAdjustFor } from "@/lib/editorDoc";
import { PREVIEW_CLASSES } from "@/lib/sizes";
import { computeLayout } from "@/lib/layout";
import { uploadImage } from "@/lib/uploadImage";
import { toast } from "sonner";

const ALIGNS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{children}</h3>
      {action}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-foreground/70">{display ?? value}</span>
      </div>
      <Slider
        className="mt-2"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(typeof v === "number" ? v : v[0])}
      />
    </div>
  );
}

const addBtn = "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export default function RightSidebar({ readOnly = false }: { readOnly?: boolean }) {
  const doc = useEditorStore((s) => s.doc);
  const setFrameImage = useEditorStore((s) => s.setFrameImage);
  const updateFrameAdjust = useEditorStore((s) => s.updateFrameAdjust);
  const updateFrameTransform = useEditorStore((s) => s.updateFrameTransform);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const removeImageLayer = useEditorStore((s) => s.removeImageLayer);
  const previewClass = useEditorStore((s) => s.previewClass);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const addTextLayer = useEditorStore((s) => s.addTextLayer);
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const removeTextLayer = useEditorStore((s) => s.removeTextLayer);
  const moveTextLayer = useEditorStore((s) => s.moveTextLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef(0);

  // Add a free-floating image layer: read its natural aspect, place it
  // optimistically, then swap the object URL for the uploaded URL.
  const onPickImage = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const probe = new window.Image();
    probe.onload = () => {
      addImageLayer(objectUrl, probe.naturalWidth / probe.naturalHeight || 1);
      const id = useEditorStore.getState().selectedLayerId;
      uploadImage(file)
        .then((url) => id && updateImageLayer(id, { src: url }))
        .catch(() => toast.error("Image upload failed"));
    };
    probe.src = objectUrl;
  };

  const selected = doc.textLayers.find((l) => l.id === selectedLayerId) ?? null;
  const fcMaster = masterDimsFor(doc.orientation);
  const frameCount = computeLayout(doc.layout, fcMaster.w, fcMaster.h).frames.length;
  const classLabel = PREVIEW_CLASSES.find((c) => c.id === previewClass)?.label ?? "iPhone";
  const set = (partial: Parameters<typeof updateTextLayer>[1]) => selected && updateTextLayer(selected.id, partial);

  const ft = doc.frameTransform ?? DEFAULT_FRAME_TRANSFORM;
  const masterW = masterDimsFor(doc.orientation).w;

  return (
    <aside
      className={`w-80 shrink-0 animate-in fade-in slide-in-from-right-2 space-y-6 overflow-y-auto border-l p-4 duration-500 ${readOnly ? "opacity-60" : ""}`}
      inert={readOnly || undefined}
    >
      {doc.layout === "freeform" && (
        <section className="space-y-3.5">
          <SectionTitle>Frame placement</SectionTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Drag the device to move it. Click it, then drag a corner to resize or the top handle to rotate.
          </p>
          <SliderRow
            label="Size"
            value={Math.min(ft.width, masterW)}
            min={200}
            max={masterW}
            step={10}
            display={`${Math.round((ft.width / masterW) * 100)}%`}
            onChange={(v) => updateFrameTransform({ width: v })}
          />
          <SliderRow
            label="Rotation"
            value={ft.rotation}
            min={-45}
            max={45}
            step={1}
            display={`${Math.round(ft.rotation)}°`}
            onChange={(v) => updateFrameTransform({ rotation: v })}
          />
          <button
            onClick={() => updateFrameTransform(DEFAULT_FRAME_TRANSFORM)}
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Reset placement
          </button>
        </section>
      )}

      <section>
        <SectionTitle>{frameCount > 1 ? "Screenshots" : "Screenshot"}</SectionTitle>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const slot = pendingSlot.current;
            if (file) {
              setFrameImage(slot, URL.createObjectURL(file)); // optimistic preview
              uploadImage(file)
                .then((url) => setFrameImage(slot, url)) // swap to the persisted URL
                .catch(() => toast.error("Image upload failed"));
            }
            e.target.value = "";
          }}
        />
        <div className="space-y-2.5">
          {Array.from({ length: frameCount }).map((_, i) => {
            const hasImg = Boolean(doc.frameImages[i]);
            const adj = frameAdjustFor(doc, previewClass, i);
            return (
              <div key={i} className="space-y-3 rounded-lg border bg-card/40 p-2.5">
                <div className="flex items-center gap-2">
                  {frameCount > 1 && <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">Frame {i + 1}</span>}
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      pendingSlot.current = i;
                      fileRef.current?.click();
                    }}
                  >
                    Upload
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setFrameImage(i, null)}>
                    Clear
                  </Button>
                </div>
                {hasImg && (
                  <div className="space-y-3 pt-0.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Crop · {classLabel}</p>
                    <div className="flex items-center gap-1">
                      {([["cover", "Fill"], ["contain", "Fit"]] as const).map(([fit, label]) => (
                        <button
                          key={fit}
                          onClick={() => updateFrameAdjust(previewClass, i, { fit })}
                          className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent ${adj.fit === fit ? "border-primary ring-1 ring-primary" : ""}`}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={() => updateFrameAdjust(previewClass, i, DEFAULT_FRAME_ADJUST)}
                        className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        Reset
                      </button>
                    </div>
                    <SliderRow label="Zoom" value={adj.scale} min={1} max={3} step={0.05} display={`${adj.scale.toFixed(2)}×`} onChange={(v) => updateFrameAdjust(previewClass, i, { scale: v })} />
                    <SliderRow label="Horizontal" value={adj.offsetX} min={-1} max={1} step={0.02} display={`${Math.round(adj.offsetX * 100)}%`} onChange={(v) => updateFrameAdjust(previewClass, i, { offsetX: v })} />
                    <SliderRow label="Vertical" value={adj.offsetY} min={-1} max={1} step={0.02} display={`${Math.round(adj.offsetY * 100)}%`} onChange={(v) => updateFrameAdjust(previewClass, i, { offsetY: v })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">or drag an image onto the canvas</p>
      </section>

      <section>
        <SectionTitle
          action={
            <button className={addBtn} onClick={() => imageInputRef.current?.click()}>
              <ImagePlusIcon className="size-3" /> Add
            </button>
          }
        >
          Images
        </SectionTitle>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickImage(file);
            e.target.value = "";
          }}
        />
        {(doc.imageLayers ?? []).length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">Add a logo or graphic to place anywhere on the canvas.</p>
        ) : (
          <div className="space-y-1">
            {(doc.imageLayers ?? []).map((il, i) => (
              <div
                key={il.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${il.id === selectedLayerId ? "border-primary ring-1 ring-primary" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={il.src} alt="" className="h-8 w-8 shrink-0 rounded bg-muted object-contain" />
                <button className="flex-1 truncate text-left text-xs" onClick={() => selectLayer(il.id)}>
                  Image {i + 1}
                </button>
                <button
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => removeImageLayer(il.id)}
                  aria-label="Delete image"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          action={
            <button className={addBtn} onClick={addTextLayer}>
              <PlusIcon className="size-3" /> Add
            </button>
          }
        >
          Text layers
        </SectionTitle>
        <div className="space-y-1">
          {doc.textLayers.map((l, i) => (
            <div
              key={l.id}
              className={`flex items-center gap-1 rounded-md border px-2 py-1.5 ${l.id === selectedLayerId ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <button className="flex-1 truncate text-left text-xs" onClick={() => selectLayer(l.id)}>
                {l.content.replace(/\n/g, " ") || "(empty)"}
              </button>
              {doc.textLayers.length > 1 && (
                <>
                  <button
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    onClick={() => moveTextLayer(l.id, "up")}
                    disabled={i === 0}
                    aria-label="Move layer up"
                  >
                    <ChevronUpIcon className="size-3.5" />
                  </button>
                  <button
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                    onClick={() => moveTextLayer(l.id, "down")}
                    disabled={i === doc.textLayers.length - 1}
                    aria-label="Move layer down"
                  >
                    <ChevronDownIcon className="size-3.5" />
                  </button>
                  <button className="text-muted-foreground transition-colors hover:text-destructive" onClick={() => removeTextLayer(l.id)} aria-label="Delete layer">
                    <Trash2Icon className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {selected ? (
        <>
          <section>
            <SectionTitle>Text</SectionTitle>
            <textarea
              value={selected.content}
              onChange={(e) => set({ content: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-md border bg-background p-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </section>

          <section>
            <SectionTitle>Font</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {FONTS.map((fnt) => (
                <button
                  key={fnt}
                  onClick={() => set({ font: fnt })}
                  style={{ fontFamily: FONT_FAMILY[fnt] }}
                  className={`truncate rounded-md border p-2 text-left text-[13px] transition-colors hover:bg-accent ${selected.font === fnt ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  {FONT_LABEL[fnt]}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3.5">
            <SectionTitle>Typography</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {ALIGNS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => set({ align: a.value })}
                  className={`rounded-md border p-2 text-xs transition-colors hover:bg-accent ${selected.align === a.value ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CAPTION_WEIGHTS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => set({ weight: w.value })}
                  className={`rounded-md border p-2 text-xs transition-colors hover:bg-accent ${selected.weight === w.value ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <SliderRow label="Size" value={selected.size} min={28} max={220} step={2} display={`${selected.size}px`} onChange={(v) => set({ size: v })} />
            <SliderRow label="Letter spacing" value={selected.letterSpacing} min={-5} max={30} step={1} display={`${selected.letterSpacing}`} onChange={(v) => set({ letterSpacing: v })} />
            <SliderRow label="Line height" value={selected.lineHeight} min={0.9} max={1.6} step={0.02} display={selected.lineHeight.toFixed(2)} onChange={(v) => set({ lineHeight: v })} />
          </section>

          <section>
            <SectionTitle>Color</SectionTitle>
            <div className="flex gap-2">
              {CAPTION_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set({ color: c })}
                  className={`h-8 w-8 rounded-full border ${selected.color === c ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Select a text layer to edit it, or add one.</p>
      )}
    </aside>
  );
}
