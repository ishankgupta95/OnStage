"use client";

import { useEditorStore } from "@/store/editor";
import { finishesFor } from "@/lib/deviceRenders";
import type { DeviceFrame } from "@/lib/schema";

// Swatch colours for the shared finish ids; an unknown id gets a neutral grey
// (finishes are data, so a new one must not break the UI).
const SWATCH: Record<string, string> = {
  black: "#1c1c20",
  silver: "#d6d7da",
  natural: "#b5a999",
};

// Device colour + screen glare. Both are doc-wide (every device frame), so
// they sit with the 3D angle controls. `device` is the model whose finishes
// are offered; others fall back to their default (resolveFinish).
export default function DeviceLook({ device }: { device: DeviceFrame }) {
  const finish = useEditorStore((s) => s.doc.deviceFinish);
  const glare = useEditorStore((s) => s.doc.deviceGlare ?? false);
  const updateDoc = useEditorStore((s) => s.updateDoc);
  const finishes = finishesFor(device);
  // A stored finish this model lacks is drawn as its default, so show that.
  const current = finishes.find((f) => f.id === finish)?.id ?? finishes[0]?.id;

  return (
    <div className="space-y-2.5">
      {finishes.length > 1 && (
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Finish</p>
          <div className="flex flex-wrap gap-2">
            {finishes.map((f) => {
              const active = f.id === current;
              return (
                <button
                  key={f.id}
                  type="button"
                  title={f.label}
                  aria-label={f.label}
                  aria-pressed={active}
                  onClick={() => updateDoc({ deviceFinish: f.id })}
                  className={`size-7 rounded-full border transition-shadow focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:ring-2 hover:ring-accent"}`}
                  style={{ background: SWATCH[f.id] ?? "#8a8a90" }}
                />
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{finishes.find((f) => f.id === current)?.label}</p>
        </div>
      )}
      <label className="flex cursor-pointer items-center justify-between text-xs">
        <span>Screen glare</span>
        <input
          type="checkbox"
          role="switch"
          checked={glare}
          onChange={(e) => updateDoc({ deviceGlare: e.target.checked || undefined })}
          className="size-4 accent-[var(--primary)]"
        />
      </label>
    </div>
  );
}
