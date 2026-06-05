"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createProject } from "@/lib/localData";
import { editorHref } from "@/lib/routes";
import { computeLayout, fitFrame } from "@/lib/layout";
import { GRADIENTS } from "@/lib/gradients";
import { PALETTES } from "@/lib/palettes";
import {
  TEMPLATES,
  PLATFORM_LABEL,
  backgroundCssFor,
  captionColorFor,
  type Platform,
} from "@/lib/templates";
import type { LayoutPreset } from "@/lib/schema";
import type { BackgroundChoice } from "@/lib/editorDoc";

type ColorChoice = { kind: "gradient" | "palette"; id: string };

const PHONE_ASPECT = 0.48;

// A small schematic of one screen: the chosen color as the canvas, a dark device
// silhouette per the layout's frame box, and caption lines in the caption color.
// Derived from computeLayout so it tracks the real composition.
function ScreenThumb({ layout, bgCss, color }: { layout: LayoutPreset; bgCss: string; color: string }) {
  const W = 32;
  const H = 67;
  const { caption, frames } = computeLayout(layout, W, H);
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[4px] ring-1 ring-black/10"
      style={{ width: W, height: H, background: bgCss }}
    >
      {frames.map((fp, i) => {
        const b = fitFrame(fp.box, PHONE_ASPECT);
        return (
          <div
            key={i}
            className="absolute rounded-[2px] bg-black/30"
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
          <div className="absolute rounded-full" style={{ left: caption.x, top: caption.y, width: caption.width, height: 2.5, background: color, opacity: 0.9 }} />
          <div className="absolute rounded-full" style={{ left: caption.x, top: caption.y + 4, width: caption.width * 0.6, height: 2.5, background: color, opacity: 0.55 }} />
        </>
      )}
    </div>
  );
}

function Swatch({ css, label, active, onSelect }: { css: string; label: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-lg border border-border transition-transform hover:scale-[1.04]",
        active && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
      style={{ background: css }}
    />
  );
}

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[1]?.id ?? "blank");
  const [platform, setPlatform] = useState<Platform>("ios");
  const [color, setColor] = useState<ColorChoice>({ kind: "gradient", id: "emerald-fade" });
  const [creating, setCreating] = useState(false);

  const bgCss = backgroundCssFor(color);
  const capColor = captionColorFor(color);
  const selected = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const background: BackgroundChoice = { kind: color.kind, id: color.id };
      const { projectId, firstScreenshotId } = await createProject({ name, templateId, platform, background });
      // Land straight on the board (the editor), open on the first screen.
      router.push(editorHref(projectId, firstScreenshotId));
    } catch {
      setCreating(false);
      toast.error("Couldn't create the project");
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        Dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">New project</h1>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
        Pick a starting template, a device platform and a color. Your project lands on the board with every screen ready —
        drop in your screenshots and edit the captions. Everything stays editable per screen.
      </p>

      <form onSubmit={handleCreate} className="mt-8 space-y-9 pb-28">
        <section className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="project-name" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              App name
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Habit Tracker"
              className="h-10"
              autoFocus
            />
          </div>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              {(["ios", "android"] as Platform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  aria-pressed={platform === p}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                    platform === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {p === "ios" ? "iOS" : "Android"}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{PLATFORM_LABEL[platform]} · change any frame later</p>
          </div>
        </section>

        <section>
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Color</p>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
            {GRADIENTS.map((g) => {
              const id = g.id;
              const css = backgroundCssFor({ kind: "gradient", id });
              return (
                <Swatch
                  key={`g-${id}`}
                  css={css}
                  label={g.label}
                  active={color.kind === "gradient" && color.id === id}
                  onSelect={() => setColor({ kind: "gradient", id })}
                />
              );
            })}
          </div>
          <p className="mb-2 mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Palettes</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {PALETTES.map((p) => {
              const css = backgroundCssFor({ kind: "palette", id: p.id });
              return (
                <Swatch
                  key={`p-${p.id}`}
                  css={css}
                  label={p.label}
                  active={color.kind === "palette" && color.id === p.id}
                  onSelect={() => setColor({ kind: "palette", id: p.id })}
                />
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Template</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => {
              const isSel = t.id === templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  aria-pressed={isSel}
                  className={cn(
                    "group flex flex-col gap-3 rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5",
                    isSel ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/20",
                  )}
                >
                  <div className="flex items-end gap-1.5 overflow-hidden rounded-xl bg-muted/40 p-3">
                    {t.screens.slice(0, 6).map((s, i) => (
                      <ScreenThumb key={i} layout={s.layout} bgCss={bgCss} color={capColor} />
                    ))}
                  </div>
                  <div className="flex items-start justify-between gap-2 px-1 pb-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight">{t.label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.description}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t.screens.length} screen{t.screens.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3 sm:px-8">
            <p className="truncate text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selected.label}</span> · {selected.screens.length} screen
              {selected.screens.length === 1 ? "" : "s"} · {platform === "ios" ? "iOS" : "Android"}
            </p>
            <Button type="submit" size="lg" disabled={creating} className="gap-1.5">
              {!creating && <PlusIcon className="size-4" />}
              {creating ? "Creating…" : "Create project"}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
