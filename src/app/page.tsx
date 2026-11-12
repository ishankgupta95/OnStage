import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { FinalCtas } from "@/components/marketing/AuthCtas";
import { Reveal } from "@/components/marketing/Reveal";
import { DeviceMock } from "@/components/marketing/DeviceMock";
import { AppUI } from "@/components/marketing/AppUI";
import { StoreSlot, type StoreSlotConfig, gradientCss } from "@/components/marketing/StoreSlot";
import { EXAMPLES } from "@/components/marketing/examples";
import { GRADIENTS } from "@/lib/gradients";
import { MESH_GRADIENTS, PATTERNS, meshSwatchStyle, patternSwatchStyle } from "@/lib/backgrounds";
import { EXPORT_SIZES, EXPORT_PRESETS } from "@/lib/sizes";
import { DEVICE_PICKER } from "@/lib/devices";

// Counts quoted in the copy, read from the data so they can't drift.
const FRAME_COUNT = DEVICE_PICKER.length;
const APPLE_SIZE_COUNT = EXPORT_SIZES.filter((s) => s.os === "iOS").length;
const PLAY_SIZE_COUNT = EXPORT_SIZES.length - APPLE_SIZE_COUNT;

export const metadata: Metadata = {
  title: "Onstage — App Store & Google Play screenshots that earn the install",
  description:
    `Turn raw app captures into polished store screenshots. ${FRAME_COUNT} device frames, 20 layouts, and pixel-exact exports for every Apple and Google Play slot. Built for indie devs and small teams.`,
};

// Upgrade synthetic mockups to real exports when PNGs are dropped in /public/examples
// (named by example id, e.g. fitness.png). Until then the CSS mockups stand in, so the
// page never looks broken either way.
function withExampleImages(configs: StoreSlotConfig[]): StoreSlotConfig[] {
  let files: string[] = [];
  try {
    files = readdirSync(join(process.cwd(), "public", "examples"));
  } catch {
    files = [];
  }
  if (!files.length) return configs;
  return configs.map((c) => {
    const f = files.find((name) => name.replace(/\.[^.]+$/, "") === c.id);
    return f ? { ...c, image: `/examples/${f}` } : c;
  });
}

const CTA_PRIMARY = cn(
  buttonVariants({ size: "lg" }),
  "h-12 rounded-xl px-7 text-[0.95rem] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
);
const CTA_SECONDARY = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  "h-12 rounded-xl px-7 text-[0.95rem] font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]",
);

function Eyebrow({ children, dot = false }: { children: ReactNode; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
      {dot && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
      {children}
    </span>
  );
}

// Blueprint registration ticks — the product's "pixel-exact" personality.
function CropMarks({ className = "" }: { className?: string }) {
  const arm = "absolute h-px w-3.5 bg-primary/50";
  const armV = "absolute h-3.5 w-px bg-primary/50";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className={`${arm} left-0 top-0`} />
      <span className={`${armV} left-0 top-0`} />
      <span className={`${arm} right-0 top-0`} />
      <span className={`${armV} right-0 top-0`} />
      <span className={`${arm} bottom-0 left-0`} />
      <span className={`${armV} bottom-0 left-0`} />
      <span className={`${arm} bottom-0 right-0`} />
      <span className={`${armV} bottom-0 right-0`} />
    </div>
  );
}

function MonoChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
      {children}
    </span>
  );
}

/* ------------------------------- hero cluster ------------------------------ */

function HeroCluster({ examples }: { examples: StoreSlotConfig[] }) {
  const pick = (id: string) => examples.find((e) => e.id === id) ?? examples[0];
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] sm:max-w-[40rem] lg:max-w-none">
      <CropMarks className="-m-4 sm:-m-6" />
      {/* back-left */}
      <div className="absolute left-0 top-[8%] w-[42%] -rotate-[9deg]">
        <div className="onstage-float" style={{ animationDelay: "-3s" }}>
          <StoreSlot priority config={pick("social")} className="opacity-95 shadow-2xl ring-black/20" />
        </div>
      </div>
      {/* front-right */}
      <div className="absolute bottom-[2%] right-0 z-30 w-[40%] rotate-[7deg]">
        <div className="onstage-float" style={{ animationDelay: "-6s" }}>
          <StoreSlot priority config={pick("ai")} className="shadow-2xl ring-black/20" />
        </div>
      </div>
      {/* hero center */}
      <div className="absolute left-1/2 top-1/2 z-20 w-[54%] -translate-x-1/2 -translate-y-1/2 -rotate-[2deg]">
        <div className="onstage-float">
          <StoreSlot priority config={pick("finance")} className="shadow-[0_50px_90px_-30px_rgba(0,0,0,0.6)] ring-black/20" />
        </div>
        <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 translate-x-full rotate-90 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80 sm:inline-block">
          1290 × 2796
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ before / after ----------------------------- */

function RawCapture() {
  // A bare, unstyled screen capture — the "before". Definite width so it matches
  // the "after" box exactly (a StoreSlot has no intrinsic width to size against).
  return (
    <div className="relative w-[13.5rem]">
      <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-md ring-1 ring-black/10 dark:ring-white/10 [container-type:inline-size]" style={{ aspectRatio: String(1290 / 2796) }}>
        <AppUI variant="tasks" accent="#9aa1a9" tone="light" />
      </div>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/90">
        IMG_4821.PNG
      </span>
    </div>
  );
}

/* -------------------------------- features -------------------------------- */

function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: ReactNode;
  body: string;
  points?: string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={reverse ? "lg:order-2" : ""}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-4 text-pretty text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h3>
        <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-muted-foreground">{body}</p>
        {points && (
          <ul className="mt-6 grid gap-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-foreground/85">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      <Reveal delay={120} className={reverse ? "lg:order-1" : ""}>
        {visual}
      </Reveal>
    </div>
  );
}

function FramesFan() {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-lg">
      <div className="absolute left-[2%] top-[20%] w-[26%] -rotate-[14deg]">
        <DeviceMock device="galaxy-z-fold-6"><AppUI variant="travel" accent="#5ee0c0" tone="dark" /></DeviceMock>
      </div>
      <div className="absolute right-[3%] top-[8%] w-[40%] rotate-[10deg]">
        <DeviceMock device="ipad-air-11" finish="silver"><AppUI variant="finance" accent="#a78bfa" tone="light" /></DeviceMock>
      </div>
      <div className="absolute bottom-[2%] right-[10%] z-10 w-[27%] rotate-[6deg]">
        <DeviceMock device="pixel-9" finish="silver"><AppUI variant="chat" accent="#56b8e6" tone="dark" /></DeviceMock>
      </div>
      <div className="absolute bottom-0 left-[8%] z-20 w-[30%] -rotate-[5deg]">
        <DeviceMock device="iphone-16-pro" finish="natural"><AppUI variant="fitness" accent="#16a34a" tone="light" /></DeviceMock>
      </div>
      <div className="absolute left-1/2 top-1/2 z-30 w-[30%] -translate-x-1/2 -translate-y-[55%] rotate-[2deg]">
        <DeviceMock device="galaxy-s24-ultra"><AppUI variant="music" accent="#f97316" tone="dark" /></DeviceMock>
      </div>
    </div>
  );
}

function ExportSpec() {
  const ticks = Array.from({ length: 9 });
  return (
    <div className="relative rounded-3xl border border-border bg-card/40 p-6 sm:p-8">
      <div className="bp-grid pointer-events-none absolute inset-0 rounded-3xl opacity-60" />
      <div className="relative">
        <div className="relative mx-auto w-[58%] max-w-[14rem]">
          {/* top ruler */}
          <div className="absolute -top-5 left-0 flex w-full justify-between">
            {ticks.map((_, i) => (
              <span key={i} className="h-2 w-px bg-primary/40" />
            ))}
          </div>
          <span className="absolute -top-9 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80">
            1290 px
          </span>
          {/* left ruler */}
          <div className="absolute -left-5 top-0 flex h-full flex-col justify-between">
            {ticks.map((_, i) => (
              <span key={i} className="h-px w-2 bg-primary/40" />
            ))}
          </div>
          <CropMarks className="-m-3" />
          <StoreSlot config={{ id: "spec", device: "iphone-16-pro", bg: { kind: "gradient", id: "sky" }, caption: "Pixel\nperfect.", captionFont: "geist", captionColor: "#0b1220", captionPlacement: "top", ui: "fitness", uiTone: "light", accent: "#0ea5e9" }} />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-1.5">
          {EXPORT_SIZES.map((s) => (
            <span key={s.id} className="rounded-md border border-border bg-background/70 px-2 py-1 font-mono text-[10px] tracking-tight text-muted-foreground">
              {s.w}×{s.h}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {EXPORT_PRESETS.map((p) => (
            <span key={p.id} className="rounded-full bg-primary/12 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary ring-1 ring-primary/20">
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BackgroundsWall() {
  const swatch = "aspect-square rounded-xl ring-1 ring-black/10 dark:ring-white/10";
  return (
    <div className="rounded-3xl border border-border bg-card/40 p-5 sm:p-6">
      <div className="grid grid-cols-6 gap-2">
        {GRADIENTS.map((g) => (
          <div key={g.id} className={swatch} style={{ backgroundImage: gradientCss(g) }} title={g.label} />
        ))}
        {MESH_GRADIENTS.map((m) => (
          <div key={m.id} className={swatch} style={meshSwatchStyle(m)} title={m.label} />
        ))}
        {PATTERNS.map((p) => (
          <div key={p.id} className={swatch} style={patternSwatchStyle(p)} title={p.label} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {["12 gradients", "6 mesh", "6 patterns", "10 palettes", "solids"].map((t) => (
          <MonoChip key={t}>{t}</MonoChip>
        ))}
      </div>
    </div>
  );
}

function FreeformCanvas() {
  const handle = "absolute size-2 rounded-[2px] bg-primary ring-2 ring-background";
  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-3xl border border-border bg-muted/40">
      <div className="bp-grid absolute inset-0 opacity-70" />
      {/* tilted device */}
      <div className="absolute left-[12%] top-[16%] w-[34%] rotate-[-8deg]">
        <DeviceMock device="iphone-16-pro"><AppUI variant="social" accent="#56b8e6" tone="light" /></DeviceMock>
      </div>
      {/* selected text layer with handles */}
      <div className="absolute right-[8%] top-[18%] w-[44%]">
        <div className="relative rounded-md px-3 py-2 outline-2 outline-dashed outline-primary/70">
          <div className="text-lg font-extrabold leading-tight tracking-tight text-foreground">Drag me anywhere</div>
          <span className={`${handle} -left-1 -top-1`} />
          <span className={`${handle} -right-1 -top-1`} />
          <span className={`${handle} -bottom-1 -left-1`} />
          <span className={`${handle} -bottom-1 -right-1`} />
        </div>
      </div>
      {/* floating image/logo layer */}
      <div className="absolute bottom-[12%] right-[16%] flex size-16 rotate-[6deg] items-center justify-center rounded-2xl bg-primary/15 outline-2 outline-dashed outline-primary/50 ring-1 ring-primary/20">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/80 text-background">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <span className="absolute left-3 top-3 rounded-md bg-background/80 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
        Freeform · 60°
      </span>
    </div>
  );
}

function FilmstripRow({ examples }: { examples: StoreSlotConfig[] }) {
  const strip = examples.slice(0, 3);
  return (
    <div className="rounded-3xl border border-border bg-card/40 p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>Filmstrip</Eyebrow>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <svg viewBox="0 0 24 24" className="size-3 text-primary" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          Autosaved
        </span>
      </div>
      <div className="flex items-stretch gap-3 overflow-hidden">
        {strip.map((cfg, i) => (
          <div key={cfg.id} className="relative w-[22%] shrink-0">
            <StoreSlot config={cfg} radius="0.55rem" className="ring-black/10" />
            <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-md bg-background/85 font-mono text-[10px] font-semibold text-foreground backdrop-blur">
              {i + 1}
            </span>
          </div>
        ))}
        <div className="grid w-[22%] shrink-0 place-items-center rounded-[6%] border-2 border-dashed border-border text-muted-foreground" style={{ aspectRatio: String(1290 / 2796) }}>
          <span className="flex flex-col items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="font-mono text-[9px] uppercase tracking-wider">Add</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- how it works ------------------------------ */

const STEPS = [
  { n: "01", title: "Drop in your screens", body: "Upload raw captures from the simulator or your phone. One project holds every screenshot for an app." },
  { n: "02", title: "Frame, caption, restyle", body: "Pick a device and layout, write the caption, choose a background. Or go freeform and place everything by hand." },
  { n: "03", title: "Export the exact pixels", body: "Download an Apple, Google Play, or everything bundle — each PNG rendered to the precise size the store wants." },
];

/* ----------------------------------- FAQ ----------------------------------- */

const FAQS = [
  {
    q: "Will the exports match the exact sizes Apple and Google require?",
    a: `Yes — that's the whole point. Onstage renders to the precise pixel dimensions of all ${EXPORT_SIZES.length} store slots (${APPLE_SIZE_COUNT} Apple, ${PLAY_SIZE_COUNT} Google Play), and each file is decode-verified before it lands in your bundle.`,
  },
  {
    q: "Do I need design skills?",
    a: "No. Start from one of 20 layouts and a curated background, write a caption, and you have a clean store screenshot. When you want full control, freeform mode lets you drag, resize, and rotate the device, text, and images anywhere on the canvas.",
  },
  {
    q: "Which devices and stores are covered?",
    a: `${FRAME_COUNT} device frames — iPhone, iPad, Pixel and Galaxy, including a fold and tablets — for the Apple App Store and Google Play, in both portrait and landscape.`,
  },
  {
    q: "Does Onstage upload to the stores for me?",
    a: "Not yet. You export a ready-to-upload bundle and drop it into App Store Connect or Play Console. Direct upload is on the roadmap, not something we pretend to do today.",
  },
  {
    q: "Is it free?",
    a: "Yes. There's no account, no watermark and no export limit. Everything runs in your browser.",
  },
  {
    q: "Can a small team use it?",
    a: "Yes, with one caveat: projects are saved in the browser that made them, not on a server. To hand one to a teammate, download its project file and they import it.",
  },
];

/* ----------------------------------- page ---------------------------------- */

export default function Home() {
  const examples = withExampleImages(EXAMPLES);
  const portraitShots = examples.filter((e) => e.orientation !== "landscape").slice(0, 8);
  const landscapeShot = examples.find((e) => e.orientation === "landscape");

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      {/* ----------------------------------- HERO ---------------------------------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bp-grid absolute inset-0 opacity-[0.5] [mask-image:radial-gradient(120%_90%_at_70%_0%,black,transparent)]" />
          <div className="absolute right-[-6rem] top-[-10rem] h-[34rem] w-[44rem] rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute left-[-8rem] top-[14rem] h-[26rem] w-[26rem] rounded-full bg-primary/10 blur-[110px]" />
        </div>

        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
          <div className="max-w-xl">
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both">
              <Eyebrow dot>App Store · Google Play</Eyebrow>
            </div>
            <h1 className="mt-6 animate-in fade-in slide-in-from-bottom-4 text-balance text-5xl font-extrabold leading-[0.95] tracking-tight delay-100 duration-700 fill-mode-both sm:text-6xl lg:text-7xl">
              Raw screenshots don’t sell.{" "}
              <span className="text-primary">Framed ones do.</span>
            </h1>
            <p className="mt-6 max-w-lg animate-in fade-in slide-in-from-bottom-3 text-balance text-lg leading-relaxed text-muted-foreground delay-200 duration-700 fill-mode-both">
              Onstage turns plain app captures into polished store screenshots — framed, captioned, and exported at the exact pixels Apple and Google demand. Design once, ship every slot.
            </p>
            <div className="mt-9 flex animate-in fade-in slide-in-from-bottom-3 flex-wrap items-center gap-3 delay-300 duration-700 fill-mode-both">
              <Link href="/dashboard" className={CTA_PRIMARY}>
                Open the editor
              </Link>
              <a href="#gallery" className={CTA_SECONDARY}>
                See examples
              </a>
            </div>
            <div className="mt-7 flex animate-in fade-in flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground delay-500 duration-700 fill-mode-both">
              <span className="text-foreground/80">{FRAME_COUNT} frames</span>
              <span className="text-border">/</span>
              <span className="text-foreground/80">20 layouts</span>
              <span className="text-border">/</span>
              <span className="text-foreground/80">{EXPORT_SIZES.length} pixel-exact sizes</span>
              <span className="text-border">/</span>
              <span>free · no sign-up</span>
            </div>
          </div>

          <div className="animate-in fade-in zoom-in-95 delay-300 duration-1000 fill-mode-both">
            <HeroCluster examples={examples} />
          </div>
        </div>

        {/* value strip */}
        <div className="border-y border-border bg-card/30">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground sm:px-8">
            <span>Pixel-exact exports</span>
            <span className="text-primary/60">◆</span>
            <span>Apple + Play bundles</span>
            <span className="text-primary/60">◆</span>
            <span>Gradients · mesh · patterns</span>
            <span className="text-primary/60">◆</span>
            <span>Portrait &amp; landscape</span>
            <span className="text-primary/60">◆</span>
            <span>Light &amp; dark</span>
          </div>
        </div>
      </section>

      {/* -------------------------------- BEFORE / AFTER -------------------------------- */}
      <section className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>Before / After</Eyebrow>
          <h2 className="mt-4 text-pretty text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            From camera roll to storefront.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Same screenshot. One stays a flat PNG nobody taps. The other earns the install.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-14">
          <div className="flex flex-col items-center justify-center gap-6 lg:flex-row lg:gap-10">
            <div className="flex flex-col items-center gap-3">
              <RawCapture />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Raw capture</span>
            </div>

            <div className="grid size-12 shrink-0 place-items-center rounded-full border border-border bg-card text-primary shadow-sm lg:rotate-0">
              <svg viewBox="0 0 24 24" className="size-5 rotate-90 lg:rotate-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-[13.5rem]">
                <StoreSlot config={{ id: "after", device: "iphone-16-pro", bg: { kind: "gradient", id: "ocean" }, caption: "Plan your day\nin seconds.", captionFont: "geist", captionPlacement: "top", ui: "tasks", uiTone: "light", accent: "#0ea5e9" }} />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Onstage</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ----------------------------------- GALLERY ---------------------------------- */}
      <section id="gallery" className="scroll-mt-16 border-y border-border bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <Reveal className="max-w-2xl">
            <Eyebrow>The gallery</Eyebrow>
            <h2 className="mt-4 text-pretty text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Twenty layouts. Every device. One afternoon.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              A spread of what ships out of Onstage — different industries, backgrounds, fonts, and frames. Every one of these is built from the same blocks you get in the editor.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {portraitShots.map((cfg, i) => (
              <Reveal key={cfg.id} delay={(i % 4) * 70}>
                <StoreSlot config={cfg} className="transition-transform duration-300 hover:-translate-y-1" />
              </Reveal>
            ))}
          </div>
          {landscapeShot && (
            <Reveal delay={120} className="mt-4">
              <StoreSlot config={landscapeShot} className="transition-transform duration-300 hover:-translate-y-1" />
            </Reveal>
          )}
        </div>
      </section>

      {/* ----------------------------------- FEATURES --------------------------------- */}
      <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-16 space-y-24 px-5 py-20 sm:px-8 lg:space-y-32 lg:py-28">
        <FeatureRow
          eyebrow="Frames + layouts"
          title={<>{FRAME_COUNT} frames. 20 layouts. <span className="text-primary">No Figma.</span></>}
          body="Drop a screenshot into any frame — iPhone, iPad, Pixel, Galaxy, folds and tablets — and snap it to a layout. Per-device crop with zoom and drag-to-pan keeps every slot looking deliberate."
          points={["iPhone, iPad, Pixel & Galaxy — folds and tablets included", "20 presets, from clean text-above to triptychs", "Per-device crop: fill or fit, zoom, drag to pan"]}
          visual={<FramesFan />}
        />
        <FeatureRow
          reverse
          eyebrow="Export"
          title={<>Every slot, to the <span className="text-primary">exact pixel.</span></>}
          body="Onstage renders to the precise dimensions each store requires and verifies every file on the way out. Grab one size, or a whole store bundle zipped and ready to upload."
          points={["8 store sizes, decode-verified pixel-perfect", "Apple, Google Play, or everything as a .zip", "Portrait and landscape from the same design"]}
          visual={<ExportSpec />}
        />
        <FeatureRow
          eyebrow="Backgrounds"
          title={<>Color that does the <span className="text-primary">heavy lifting.</span></>}
          body="Twelve gradients, mesh gradients, dot/grid/noise patterns, ten curated palettes, and solids. Tasteful out of the box, so the screenshot reads before anyone scrolls past it."
          visual={<BackgroundsWall />}
        />
        <FeatureRow
          reverse
          eyebrow="Freeform"
          title={<>Or throw out the grid <span className="text-primary">entirely.</span></>}
          body="Freeform mode hands you the canvas: drag, resize and rotate the device, drop multiple text layers and floating images — logos, badges, arrows — wherever you want them."
          points={["Drag, resize & rotate the device frame", "Multiple text layers with inline on-canvas editing", "Free-floating image layers for logos & graphics"]}
          visual={<FreeformCanvas />}
        />
        <FeatureRow
          eyebrow="Workflow"
          title={<>A whole listing, <span className="text-primary">in one place.</span></>}
          body="Build every screenshot for an app in one project and switch between them in the filmstrip — add, duplicate, reorder in place. Autosave and version history mean you never lose a good frame."
          points={["In-editor filmstrip: switch, add, duplicate, reorder", "Autosave with version history", "Light and dark, six bundled fonts"]}
          visual={<FilmstripRow examples={examples} />}
        />
      </section>

      {/* ----------------------------------- HOW IT WORKS ----------------------------- */}
      <section id="how" className="scroll-mt-16 border-y border-border bg-muted/30 py-20 lg:py-28">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <Reveal className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 text-pretty text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Three steps to a finished set.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <div className="flex h-full flex-col bg-card p-7 lg:p-8">
                  <span className="font-mono text-3xl font-bold tracking-tight text-primary/80">{s.n}</span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2.5 text-[0.95rem] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------- PROOF / FOUNDER -------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
        <Reveal>
          <div className="grid gap-10 rounded-3xl border border-border bg-card/40 p-8 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:p-14">
            <div>
              <Eyebrow>Built in the open</Eyebrow>
              <div className="mt-6 grid grid-cols-3 gap-y-7">
                {[
                  ["24", "device frames"],
                  ["20", "layouts"],
                  ["8", "pixel-exact sizes"],
                  ["12", "gradients"],
                  ["6", "fonts"],
                  ["2", "stores"],
                ].map(([k, v]) => (
                  <div key={v}>
                    <div className="font-mono text-3xl font-bold tracking-tight sm:text-4xl">{k}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <figure className="flex flex-col justify-center border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
              <blockquote className="text-pretty text-lg leading-relaxed text-foreground/90">
                “I built Onstage because I was tired of rebuilding the same store frames in Figma for every app I shipped. It&apos;s early and honest — no inflated install counts or borrowed logos here, just the tool I wanted to exist. If it saves you an afternoon, that&apos;s the whole point.”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-primary/15 font-mono text-sm font-bold text-primary ring-1 ring-primary/25">I</span>
                <span className="text-sm">
                  <span className="font-semibold">Ishank</span>
                  <span className="text-muted-foreground"> · solo founder, building for indie devs &amp; small teams</span>
                </span>
              </figcaption>
            </figure>
          </div>
        </Reveal>
      </section>

      {/* ----------------------------------- FAQ -------------------------------------- */}
      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-16 px-5 pb-20 sm:px-8 lg:pb-28">
        <Reveal className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-4 text-pretty text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            Answers, before you ask.
          </h2>
        </Reveal>
        <Reveal delay={100} className="mt-12 divide-y divide-border border-y border-border">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[1.05rem] font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
                {f.q}
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="mt-3 max-w-2xl text-[0.97rem] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      {/* ----------------------------------- FINAL CTA -------------------------------- */}
      <section className="relative overflow-hidden border-t border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="bp-grid absolute inset-0 opacity-60 [mask-image:radial-gradient(80%_120%_at_50%_0%,black,transparent)]" />
          <div className="absolute left-1/2 top-[-8rem] h-[24rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 py-24 text-center sm:px-8 lg:py-32">
          <Reveal className="flex flex-col items-center">
            <h2 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Put your app onstage.
            </h2>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Open the editor and have your first store screenshot exported in the next ten minutes.
            </p>
            <FinalCtas />
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------- FOOTER ----------------------------------- */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-[7px] bg-primary/12 text-primary ring-1 ring-primary/25">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2.5" width="10" height="19" rx="3" /><line x1="10.5" y1="5" x2="13.5" y2="5" strokeLinecap="round" /></svg>
            </span>
            <span className="text-[1.05rem] font-extrabold tracking-tight">Onstage</span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#gallery" className="transition-colors hover:text-foreground">Examples</a>
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
            <Link href="/dashboard" className="transition-colors hover:text-foreground">Open editor</Link>
          </nav>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
            App Store &amp; Play screenshots
          </span>
        </div>
      </footer>
    </div>
  );
}
