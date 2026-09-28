"use client";

import { useRef, type ReactNode } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ImagePlusIcon,
  Layers2Icon,
  LayoutTemplateIcon,
  PaletteIcon,
  PlusIcon,
  SmartphoneIcon,
  Trash2Icon,
  TypeIcon,
} from "lucide-react";
import { useEditorStore, type ApplyAttr } from "@/store/editor";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { FONTS } from "@/lib/schema";
import { FONT_LABEL, FONT_FAMILY, CAPTION_COLORS, CAPTION_WEIGHTS, DEFAULT_FRAME_ADJUST, FRAME_SCALE_MIN, FRAME_SCALE_MAX, masterDimsFor, frameAdjustFor, frameScaleAt, frameRotationAt, resolveFreeformFrames, parseFreeformSel, freeformSelId, PERSPECTIVE_PRESETS, perspectivePresetId, type FrameAdjust } from "@/lib/editorDoc";
import { DEVICE_BY_ID } from "@/lib/devices";
import { PREVIEW_CLASSES } from "@/lib/sizes";
import { deviceClassOf } from "@/lib/deviceGeometry";
import { STORE_LOCALES, textFor, withText } from "@/lib/locales";
import { computeLayout } from "@/lib/layout";
import { uploadImage } from "@/lib/uploadImage";
import { toast } from "sonner";

const ALIGNS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

const APPLY_ITEMS: { attr: ApplyAttr; label: string; Icon: typeof PaletteIcon }[] = [
  { attr: "background", label: "Background", Icon: PaletteIcon },
  { attr: "typography", label: "Typography", Icon: TypeIcon },
  { attr: "device", label: "Device", Icon: SmartphoneIcon },
  { attr: "layout", label: "Layout", Icon: LayoutTemplateIcon },
];
const APPLY_LABEL: Record<ApplyAttr, string> = {
  background: "Background",
  typography: "Typography",
  device: "Device",
  layout: "Layout",
};

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
  const addFreeformFrame = useEditorStore((s) => s.addFreeformFrame);
  const updateFreeformFrame = useEditorStore((s) => s.updateFreeformFrame);
  const removeFreeformFrame = useEditorStore((s) => s.removeFreeformFrame);
  const setFrameScale = useEditorStore((s) => s.setFrameScale);
  const setFrameRotation = useEditorStore((s) => s.setFrameRotation);
  const selectedFrameIndex = useEditorStore((s) => s.selectedFrameIndex);
  const applyToAll = useEditorStore((s) => s.applyToAll);
  const screenCount = useEditorStore((s) => s.order.length);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const updateImageLayer = useEditorStore((s) => s.updateImageLayer);
  const removeImageLayer = useEditorStore((s) => s.removeImageLayer);
  // Crop edits target the family the canvas renders (the active doc's device),
  // so they keep working after the device is switched to another family.
  const previewClass = useEditorStore((s) => deviceClassOf(s.doc.device));
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const previewLocale = useEditorStore((s) => s.previewLocale);
  const setPreviewLocale = useEditorStore((s) => s.setPreviewLocale);
  const addTextLayer = useEditorStore((s) => s.addTextLayer);
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer);
  const removeTextLayer = useEditorStore((s) => s.removeTextLayer);
  const moveTextLayer = useEditorStore((s) => s.moveTextLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const freeformFileRef = useRef<HTMLInputElement>(null);
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

  const applyAll = (attr: ApplyAttr) => {
    applyToAll(attr);
    toast.success(`${APPLY_LABEL[attr]} applied to all ${screenCount} screens`);
  };

  const masterW = masterDimsFor(doc.orientation).w;

  // Multi-device freeform: the device list + the currently-selected device.
  const isFreeform = doc.layout === "freeform";
  const freeformFrames = isFreeform ? resolveFreeformFrames(doc) : [];
  const selectedFreeformId = isFreeform ? parseFreeformSel(selectedLayerId) : null;
  const selectedFreeform = selectedFreeformId ? freeformFrames.find((f) => f.id === selectedFreeformId) ?? null : null;
  const setFreeformAdjust = (partial: Partial<FrameAdjust>) => {
    if (!selectedFreeform) return;
    updateFreeformFrame(selectedFreeform.id, {
      adjust: { ...DEFAULT_FRAME_ADJUST, ...(selectedFreeform.adjust ?? {}), ...partial },
    });
  };
  const onPickFreeformImage = (file: File, frameId: string) => {
    updateFreeformFrame(frameId, { src: URL.createObjectURL(file) }); // optimistic preview
    uploadImage(file)
      .then((url) => updateFreeformFrame(frameId, { src: url })) // swap to the persisted URL
      .catch(() => toast.error("Image upload failed"));
  };

  return (
    <aside
      className={`w-80 shrink-0 animate-in fade-in slide-in-from-right-2 space-y-6 overflow-y-auto border-l p-4 duration-500 ${readOnly ? "opacity-60" : ""}`}
      inert={readOnly || undefined}
    >
      {screenCount > 1 && (
        <section>
          <SectionTitle>Apply to all</SectionTitle>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-expanded:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="flex items-center gap-2">
                <Layers2Icon className="size-4" />
                Push this screen&apos;s style…
              </span>
              <ChevronDownIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.16em]">
                  Apply to all {screenCount} screens
                </DropdownMenuLabel>
                {APPLY_ITEMS.map(({ attr, label, Icon }) => (
                  <DropdownMenuItem key={attr} onClick={() => applyAll(attr)} className="gap-2.5">
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Copies just that attribute from this screen to every other. One ⌘Z undoes it.
          </p>
        </section>
      )}

      {isFreeform && (
        <section className="space-y-3">
          <SectionTitle
            action={
              <button className={addBtn} onClick={() => addFreeformFrame()}>
                <PlusIcon className="size-3" /> Add
              </button>
            }
          >
            Devices
          </SectionTitle>
          {freeformFrames.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Add a device, then drag it on the canvas. Each device has its own model, image, size and tilt.
            </p>
          ) : (
            <div className="space-y-1">
              {freeformFrames.map((f, i) => {
                const label = DEVICE_BY_ID[f.device]?.label ?? f.device;
                const active = f.id === selectedFreeformId;
                return (
                  <div
                    key={f.id}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${active ? "border-primary ring-1 ring-primary" : ""}`}
                  >
                    <button className="flex-1 truncate text-left text-xs" onClick={() => selectLayer(freeformSelId(f.id))}>
                      <span className="font-mono text-muted-foreground">{i + 1}.</span> {label}
                    </button>
                    <button
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => removeFreeformFrame(f.id)}
                      aria-label="Delete device"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectedFreeform ? (
            <div className="space-y-3.5 rounded-lg border bg-card/40 p-2.5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Drag to move. Drag a corner to resize, the top handle to rotate, or the badge to flip
                upright/sideways. Pick a model in the left panel.
              </p>
              <SliderRow
                label="Size"
                value={Math.min(selectedFreeform.width, masterW)}
                min={200}
                max={masterW}
                step={10}
                display={`${Math.round((selectedFreeform.width / masterW) * 100)}%`}
                onChange={(v) => updateFreeformFrame(selectedFreeform.id, { width: v })}
              />
              <SliderRow
                label="Rotation"
                value={selectedFreeform.rotation}
                min={-45}
                max={45}
                step={1}
                display={`${Math.round(selectedFreeform.rotation)}°`}
                onChange={(v) => updateFreeformFrame(selectedFreeform.id, { rotation: v })}
              />
              <div>
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">3D Angle</p>
                <div className="grid grid-cols-2 gap-0.5 rounded-md border p-0.5 text-xs">
                  {PERSPECTIVE_PRESETS.map((p) => {
                    const resolved =
                      selectedFreeform.perspective !== undefined ? selectedFreeform.perspective : doc.perspective ?? null;
                    const active = perspectivePresetId(resolved ?? undefined) === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => updateFreeformFrame(selectedFreeform.id, { perspective: p.value })}
                        aria-pressed={active}
                        className={`rounded px-2 py-1.5 transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="flex-1" onClick={() => freeformFileRef.current?.click()}>
                  Upload image
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateFreeformFrame(selectedFreeform.id, { src: null })}>
                  Clear
                </Button>
              </div>
              {selectedFreeform.src && (
                <div className="space-y-3 pt-0.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Crop</p>
                  <div className="flex items-center gap-1">
                    {([["cover", "Fill"], ["contain", "Fit"]] as const).map(([fit, label]) => (
                      <button
                        key={fit}
                        onClick={() => setFreeformAdjust({ fit })}
                        aria-pressed={(selectedFreeform.adjust?.fit ?? "cover") === fit}
                        className={`flex-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent ${(selectedFreeform.adjust?.fit ?? "cover") === fit ? "border-primary ring-1 ring-primary" : ""}`}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      onClick={() => setFreeformAdjust(DEFAULT_FRAME_ADJUST)}
                      className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      Reset
                    </button>
                  </div>
                  <SliderRow label="Zoom" value={selectedFreeform.adjust?.scale ?? 1} min={1} max={3} step={0.05} display={`${(selectedFreeform.adjust?.scale ?? 1).toFixed(2)}×`} onChange={(v) => setFreeformAdjust({ scale: v })} />
                  <SliderRow label="Horizontal" value={selectedFreeform.adjust?.offsetX ?? 0} min={-1} max={1} step={0.02} display={`${Math.round((selectedFreeform.adjust?.offsetX ?? 0) * 100)}%`} onChange={(v) => setFreeformAdjust({ offsetX: v })} />
                  <SliderRow label="Vertical" value={selectedFreeform.adjust?.offsetY ?? 0} min={-1} max={1} step={0.02} display={`${Math.round((selectedFreeform.adjust?.offsetY ?? 0) * 100)}%`} onChange={(v) => setFreeformAdjust({ offsetY: v })} />
                </div>
              )}
            </div>
          ) : freeformFrames.length > 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">Select a device on the canvas or above to edit it.</p>
          ) : null}

          <input
            ref={freeformFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && selectedFreeform) onPickFreeformImage(file, selectedFreeform.id);
              e.target.value = "";
            }}
          />
        </section>
      )}

      {doc.layout !== "freeform" &&
        (() => {
          // The sliders target the SELECTED frame slot (clamped, in case the layout
          // changed to fewer frames since selection).
          const slot = Math.max(0, Math.min(selectedFrameIndex, frameCount - 1));
          const scale = frameScaleAt(doc, slot);
          const rotation = frameRotationAt(doc, slot);
          return (
            <section className="space-y-3.5">
              <SectionTitle>Device{frameCount > 1 ? ` · Frame ${slot + 1}` : ""}</SectionTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Click the device on the canvas, then drag a corner to resize, the top handle to
                rotate, or the badge to flip it upright/sideways — or use the sliders.
              </p>
              <SliderRow
                label="Size"
                value={scale}
                min={FRAME_SCALE_MIN}
                max={FRAME_SCALE_MAX}
                step={0.05}
                display={`${Math.round(scale * 100)}%`}
                onChange={(v) => setFrameScale(slot, v)}
              />
              <SliderRow
                label="Rotation"
                value={rotation}
                min={-45}
                max={45}
                step={1}
                display={`${Math.round(rotation)}°`}
                onChange={(v) => setFrameRotation(slot, v)}
              />
              <button
                onClick={() => {
                  setFrameScale(slot, 1);
                  setFrameRotation(slot, 0);
                }}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Reset size &amp; rotation
              </button>
            </section>
          );
        })()}

      {!isFreeform && (
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
                          aria-pressed={adj.fit === fit}
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
      )}

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

      <section data-tour="caption">
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
            <select
              value={previewLocale ?? ""}
              onChange={(e) => setPreviewLocale(e.target.value || null)}
              aria-label="Caption language"
              className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Default language</option>
              {STORE_LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                  {selected.translations?.[l.id] ? " ✓" : ""}
                </option>
              ))}
            </select>
            <textarea
              value={previewLocale ? selected.translations?.[previewLocale] ?? "" : selected.content}
              placeholder={previewLocale ? textFor(selected, null) : undefined}
              onChange={(e) => set(withText(selected, previewLocale, e.target.value))}
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
                  aria-pressed={selected.font === fnt}
                  aria-label={FONT_LABEL[fnt]}
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
                  aria-pressed={selected.align === a.value}
                  aria-label={`Align ${a.label.toLowerCase()}`}
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
                  aria-pressed={selected.weight === w.value}
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
                  aria-pressed={selected.color === c}
                  className={`h-8 w-8 rounded-full border ${selected.color === c ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Text color ${c}`}
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
