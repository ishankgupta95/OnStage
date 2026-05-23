import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const STATS = [
  { k: "23", label: "device frames" },
  { k: "16", label: "layout presets" },
  { k: "8", label: "store sizes, pixel-exact" },
];

const FEATURES = [
  { tag: "EXPORT", title: "Every slot, exact", body: "iPhone, iPad and Android sizes rendered to the precise pixel dimensions Apple and Google require — verified on the way out." },
  { tag: "DESIGN", title: "Frames + layouts", body: "23 devices and 16 composition presets. Drag a screenshot into any frame and nudge the crop until it sits right." },
  { tag: "SHIP", title: "Bundle in one click", body: "Apple, Google Play, or everything — zipped and ready to upload, for one screenshot or the whole project." },
];

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      {/* atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14rem] h-[42rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]" />
        <div className="absolute inset-0 text-foreground opacity-[0.04] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:52px_52px]" />
      </div>

      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="text-lg font-extrabold tracking-tight">Onstage</span>
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/login" className="px-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }))}>
            Open editor
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 pb-16 pt-20 text-center sm:pt-28">
        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
          <span className="size-1.5 rounded-full bg-primary" /> App Store · Google Play
        </span>
        <h1 className="text-balance text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
          Screenshots that
          <br />
          <span className="text-primary">sell the download.</span>
        </h1>
        <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
          Design once, export pixel-exact frames for every iPhone, iPad and Android slot. Built for indie devs and small teams.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "px-6")}>
            Start designing →
          </Link>
          <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-6")}>
            Sign in
          </Link>
        </div>

        <div className="mt-20 grid w-full max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {STATS.map((s) => (
            <div key={s.label} className="bg-card px-4 py-6">
              <div className="font-mono text-3xl font-bold tracking-tight text-foreground">{s.k}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.tag} className="rounded-2xl border border-border bg-card/50 p-6 text-left">
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">{f.tag}</span>
            <h3 className="mt-3 text-lg font-bold tracking-tight">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border px-6 py-8 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/60 sm:px-10">
        Onstage · App Store &amp; Play screenshots
      </footer>
    </main>
  );
}
