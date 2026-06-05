"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircleIcon, CheckIcon, DownloadIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EXPORT_PRESETS, EXPORT_SIZES } from "@/lib/sizes";
import { useEditorStore, type ExportScope, type ExportShot } from "@/store/editor";
import { getProjectScreenshotConfigs } from "@/lib/localData";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export default function ExportDialog({ projectId }: { projectId: string }) {
  const setExportRequest = useEditorStore((s) => s.setExportRequest);
  const setExportProgress = useEditorStore((s) => s.setExportProgress);
  const progress = useEditorStore((s) => s.exportProgress);

  const [open, setOpen] = useState(false);
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>(EXPORT_PRESETS[0].sizeIds);
  const [scope, setScope] = useState<ExportScope>("current");
  const [shots, setShots] = useState<ExportShot[]>([]);

  const busy = progress.state === "running";

  // On open: clear any stale progress and load the project's screenshots so we
  // can offer "export all" and show an accurate count.
  useEffect(() => {
    if (!open) return;
    setExportProgress({ state: "idle" });
    let active = true;
    getProjectScreenshotConfigs(projectId)
      .then((rows) => active && setShots(rows))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, projectId, setExportProgress]);

  // Auto-close shortly after a successful export.
  useEffect(() => {
    if (open && progress.state === "done") {
      const t = setTimeout(() => setOpen(false), 900);
      return () => clearTimeout(t);
    }
  }, [open, progress.state]);

  const canExportAll = shots.length > 1;
  const effectiveScope: ExportScope = canExportAll ? scope : "current";
  const shotCount = effectiveScope === "all" ? Math.max(shots.length, 1) : 1;
  const total = selectedSizeIds.length * shotCount;

  const activePreset = useMemo(
    () => EXPORT_PRESETS.find((p) => sameSet(p.sizeIds, selectedSizeIds))?.id ?? null,
    [selectedSizeIds],
  );

  const toggleSize = (id: string) =>
    setSelectedSizeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Keep canonical order regardless of click order.
      return EXPORT_SIZES.filter((s) => next.includes(s.id)).map((s) => s.id);
    });

  const onExport = () => {
    if (!selectedSizeIds.length || busy) return;
    setExportRequest({
      nonce: Date.now(),
      sizeIds: selectedSizeIds,
      scope: effectiveScope,
      shots: effectiveScope === "all" ? shots : [],
    });
  };

  const pct = progress.state === "running" && progress.total ? (progress.completed / progress.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" data-export data-tour="export" />}>Export</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export screenshots</DialogTitle>
          <DialogDescription>
            Pixel-exact PNGs for every store slot. Each file is verified after rendering.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto">
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Bundle</h3>
            <div className="grid grid-cols-3 gap-2">
              {EXPORT_PRESETS.map((preset) => {
                const active = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedSizeIds(preset.sizeIds)}
                    className={cn(
                      "relative rounded-lg border p-3 text-left transition-colors",
                      active ? "border-foreground/30 bg-accent" : "border-border hover:bg-muted/60",
                    )}
                  >
                    {active && <CheckIcon className="absolute right-2 top-2 size-3.5 text-foreground/70" />}
                    <div className="text-sm font-medium leading-tight">{preset.label}</div>
                    <div className="mt-1 text-xs leading-snug text-muted-foreground">{preset.hint}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sizes</h3>
              <span className="text-[11px] text-muted-foreground">Frame matches each size</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_SIZES.map((s) => {
                const selected = selectedSizeIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSize(s.id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                      selected ? "border-foreground/30 bg-accent" : "border-border hover:bg-muted/60",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          selected ? "border-foreground bg-foreground text-background" : "border-border",
                        )}
                      >
                        {selected && <CheckIcon className="size-3" />}
                      </span>
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {s.w}×{s.h}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {canExportAll && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Scope</h3>
              <div className="inline-flex rounded-lg border bg-muted/60 p-0.5 text-sm">
                {(
                  [
                    ["current", "This screenshot"],
                    ["all", `All ${shots.length} screenshots`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScope(value)}
                    className={cn(
                      "rounded-md px-3 py-1 transition-colors",
                      effectiveScope === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="-mx-4 -mb-4 space-y-3 rounded-b-xl border-t bg-muted/40 p-4">
          {busy && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Rendering &amp; verifying…</span>
                {progress.state === "running" && (
                  <span className="tabular-nums">
                    {progress.completed} / {progress.total}
                  </span>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {progress.state === "error" && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircleIcon className="mt-px size-3.5 shrink-0" />
              <span>{progress.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {selectedSizeIds.length ? (
                <>
                  <span className="font-medium tabular-nums text-foreground">{total}</span> PNG
                  {total !== 1 ? "s" : ""}
                  {effectiveScope === "all" && (
                    <span className="tabular-nums">
                      {" "}
                      · {selectedSizeIds.length}×{shots.length}
                    </span>
                  )}
                </>
              ) : (
                "Select at least one size"
              )}
            </div>
            <Button onClick={onExport} disabled={!selectedSizeIds.length || busy}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" /> Exporting…
                </>
              ) : (
                <>
                  <DownloadIcon /> Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
