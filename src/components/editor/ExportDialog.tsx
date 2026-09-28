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
import { EXPORT_PRESETS, EXPORT_SIZES, STORE_SCREENSHOT_LIMIT, exportFileCount, sizeById } from "@/lib/sizes";
import { useEditorStore, type ExportScope, type ExportShot } from "@/store/editor";
import { getProjectScreenshotConfigs } from "@/lib/localData";
import { docLocales, localeLabel } from "@/lib/locales";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export default function ExportDialog({ projectId }: { projectId: string }) {
  const setExportRequest = useEditorStore((s) => s.setExportRequest);
  const setExportProgress = useEditorStore((s) => s.setExportProgress);
  const cancelExport = useEditorStore((s) => s.cancelExport);
  const progress = useEditorStore((s) => s.exportProgress);

  const [open, setOpen] = useState(false);
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>(EXPORT_PRESETS[0].sizeIds);
  const [scope, setScope] = useState<ExportScope>("current");
  const [shots, setShots] = useState<ExportShot[]>([]);
  // Languages with translated captions (found when the dialog opens) and the
  // ones to export; null = the default captions.
  const [langs, setLangs] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<(string | null)[]>([null]);

  const onOpenChange = (next: boolean) => {
    if (next) {
      const found = docLocales(Object.values(useEditorStore.getState().docs));
      setLangs(found);
      setSelectedLangs([null, ...found]);
    }
    setOpen(next);
  };
  const toggleLang = (id: string | null) =>
    setSelectedLangs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      return [null, ...langs].filter((x) => next.includes(x)); // keep list order
    });
  const locales = langs.length ? selectedLangs : [null];

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
  const total = exportFileCount(selectedSizeIds, shotCount) * locales.length;
  // Stores whose screenshot limit this export runs into (later ones are skipped).
  const limitNote = (["iOS", "Android"] as const)
    .filter((os) => shotCount > STORE_SCREENSHOT_LIMIT[os] && selectedSizeIds.some((sid) => sizeById(sid)?.os === os))
    .map((os) => `${os === "iOS" ? "App Store" : "Google Play"} sizes include only the first ${STORE_SCREENSHOT_LIMIT[os]} screenshots, the store's limit.`)
    .join(" ");

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
    if (!selectedSizeIds.length || !locales.length || busy) return;
    setExportRequest({
      nonce: Date.now(),
      sizeIds: selectedSizeIds,
      scope: effectiveScope,
      shots: effectiveScope === "all" ? shots : [],
      locales,
    });
  };

  // One-click: every accepted App Store + Play size, foldered by OS/resolution.
  const everythingTotal =
    exportFileCount(
      EXPORT_SIZES.map((s) => s.id),
      shotCount,
    ) * locales.length;
  const onExportEverything = () => {
    if (busy || !locales.length) return;
    const all = EXPORT_PRESETS.find((p) => p.id === "all")?.sizeIds ?? EXPORT_SIZES.map((s) => s.id);
    setSelectedSizeIds(all);
    setExportRequest({
      nonce: Date.now(),
      sizeIds: all,
      scope: effectiveScope,
      shots: effectiveScope === "all" ? shots : [],
      locales,
    });
  };

  const pct = progress.state === "running" && progress.total ? (progress.completed / progress.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button size="sm" data-export data-tour="export" />}>Export</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export screenshots</DialogTitle>
          <DialogDescription>
            Pixel-exact PNGs for every store slot. Each file is verified after rendering. iPad and Play tablet
            sizes use a tablet frame, with phone screenshots letterboxed rather than cropped.
          </DialogDescription>
        </DialogHeader>

        <Button onClick={onExportEverything} disabled={busy || !locales.length} className="w-full">
          {busy ? (
            <>
              <Loader2 className="animate-spin" /> Exporting…
            </>
          ) : (
            <>
              <DownloadIcon /> Export every store size
              <span className="tabular-nums opacity-80">
                · {everythingTotal} PNG{everythingTotal !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </Button>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto">
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Or pick a bundle
            </h3>
            <div className="grid grid-cols-2 gap-2">
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

          {langs.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Languages</h3>
                <span className="text-[11px] text-muted-foreground">A folder per language</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[null, ...langs].map((id) => {
                  const on = selectedLangs.includes(id);
                  return (
                    <button
                      key={id ?? "default"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLang(id)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        on ? "border-foreground/30 bg-accent" : "border-border hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                          on ? "border-foreground bg-foreground text-background" : "border-border",
                        )}
                      >
                        {on && <CheckIcon className="size-3" />}
                      </span>
                      <span className="truncate">{localeLabel(id)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">Captions without a translation use the default text.</p>
            </section>
          )}

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
                <span className="flex items-center gap-3">
                  {progress.state === "running" && (
                    <span className="tabular-nums">
                      {progress.completed} / {progress.total}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={cancelExport}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Cancel
                  </button>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {limitNote && !busy && <p className="text-xs text-muted-foreground">{limitNote}</p>}

          {progress.state === "error" && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircleIcon className="mt-px size-3.5 shrink-0" />
              <span>{progress.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {!locales.length ? (
                "Select at least one language"
              ) : selectedSizeIds.length ? (
                <>
                  <span className="font-medium tabular-nums text-foreground">{total}</span> PNG
                  {total !== 1 ? "s" : ""}
                  {effectiveScope === "all" && (
                    <span className="tabular-nums">
                      {" "}
                      · {selectedSizeIds.length}×{shots.length}
                      {locales.length > 1 ? `×${locales.length}` : ""}
                    </span>
                  )}
                </>
              ) : (
                "Select at least one size"
              )}
            </div>
            <Button onClick={onExport} disabled={!selectedSizeIds.length || !locales.length || busy}>
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
