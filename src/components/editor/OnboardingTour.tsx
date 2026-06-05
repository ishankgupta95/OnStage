"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Bump the version suffix to re-show the tour after a meaningful editor change.
const SEEN_KEY = "onstage:tour:seen:v1";

type Side = "right" | "left" | "bottom";
type Step = { sel: string; kicker: string; title: string; body: string; side: Side };

// layouts → device → background → caption → export (plan §5).
const STEPS: Step[] = [
  {
    sel: '[data-tour="layouts"]',
    kicker: "Layout",
    title: "Start with a layout",
    body: "Pick how the screenshot is composed — text above the frame, a callout beside it, a panoramic spread. Each thumbnail previews the real composition.",
    side: "right",
  },
  {
    sel: '[data-tour="device"]',
    kicker: "Device",
    title: "Choose a device frame",
    body: "Wrap your capture in an iPhone, iPad, Pixel, or Galaxy. On export, Onstage swaps in the exact frame each store size needs.",
    side: "right",
  },
  {
    sel: '[data-tour="background"]',
    kicker: "Background",
    title: "Set the background",
    body: "Gradients, solids, mesh, patterns, or a curated palette. Most great store shots lean on one confident background.",
    side: "right",
  },
  {
    sel: '[data-tour="caption"]',
    kicker: "Caption",
    title: "Write your caption",
    body: "Add and style text layers here — font, size, weight, colour, alignment. One sharp line per screenshot tends to convert best.",
    side: "left",
  },
  {
    sel: '[data-tour="export"]',
    kicker: "Export",
    title: "Export pixel-perfect PNGs",
    body: "When it looks right, export exact App Store & Play sizes — one screenshot or the whole set as a zip. Every file is size-verified.",
    side: "bottom",
  },
];

const CARD_W = 320;

export default function OnboardingTour({ enabled }: { enabled: boolean }) {
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  // Show once, on first editor open, for editors (not viewers).
  useEffect(() => {
    if (!enabled) return;
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false; // storage blocked — better to show than to error
    }
    if (seen) return;
    const t = setTimeout(() => setActive(true), 700); // let the sidebars settle
    return () => clearTimeout(t);
  }, [enabled]);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked — tour just won't be remembered */
    }
  }, []);

  const next = useCallback(() => {
    setI((p) => {
      if (p >= STEPS.length - 1) {
        finish();
        return p;
      }
      return p + 1;
    });
  }, [finish]);

  const back = useCallback(() => setI((p) => Math.max(0, p - 1)), []);

  // Position the spotlight + card imperatively (a measure-then-write pass, so it
  // never triggers a re-render). Clamped to the viewport.
  const position = useCallback(
    (doScroll: boolean) => {
      const card = cardRef.current;
      const spot = spotRef.current;
      if (!card) return;
      const el = document.querySelector<HTMLElement>(STEPS[i].sel);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cardH = card.offsetHeight || 200;
      const pad = 12;

      if (!el) {
        if (spot) spot.style.display = "none";
        card.style.top = `${Math.max(pad, (vh - cardH) / 2)}px`;
        card.style.left = `${Math.max(pad, (vw - CARD_W) / 2)}px`;
        return;
      }
      if (doScroll) el.scrollIntoView({ block: "center", inline: "nearest" });
      const r = el.getBoundingClientRect();
      if (spot) {
        spot.style.display = "block";
        spot.style.top = `${r.top - 6}px`;
        spot.style.left = `${r.left - 6}px`;
        spot.style.width = `${r.width + 12}px`;
        spot.style.height = `${r.height + 12}px`;
      }

      const gap = 16;
      const side = STEPS[i].side;
      let top: number;
      let left: number;
      if (side === "right") {
        left = r.right + gap;
        top = r.top;
      } else if (side === "left") {
        left = r.left - CARD_W - gap;
        top = r.top;
      } else {
        top = r.bottom + gap;
        left = r.right - CARD_W;
      }
      card.style.left = `${Math.max(pad, Math.min(left, vw - CARD_W - pad))}px`;
      card.style.top = `${Math.max(pad, Math.min(top, vh - cardH - pad))}px`;
    },
    [i],
  );

  // Measure before paint on activate/step change, then focus the card for AT/keyboard.
  useLayoutEffect(() => {
    if (!active) return;
    position(true);
    cardRef.current?.focus();
  }, [active, i, position]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => position(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, position]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish, next, back]);

  if (!active) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    // The container captures pointer events so the editor isn't interactable mid-tour;
    // the spotlight is purely visual (pointer-events-none).
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="onstage-tour-title">
      <div
        ref={spotRef}
        aria-hidden
        className="pointer-events-none absolute rounded-xl ring-2 ring-primary/70 transition-all"
        style={{ boxShadow: "0 0 0 9999px rgba(3,7,12,0.62)" }}
      />

      <div
        ref={cardRef}
        tabIndex={-1}
        className="absolute w-80 rounded-2xl border border-border bg-popover p-4 shadow-xl shadow-black/20 outline-none"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {step.kicker} · {i + 1}/{STEPS.length}
          </span>
          <button
            onClick={finish}
            aria-label="Skip tour"
            className="-mr-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <h2 id="onstage-tour-title" className="mt-2 text-base font-bold tracking-tight">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-4 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={back}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {last ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
