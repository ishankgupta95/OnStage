"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#gallery", label: "Examples" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

// Small device-frame mark — the product's signature object, in the accent color.
function Mark() {
  return (
    <span className="grid size-7 place-items-center rounded-[7px] bg-primary/12 text-primary ring-1 ring-primary/25">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="7" y="2.5" width="10" height="19" rx="3" />
        <line x1="10.5" y1="5" x2="13.5" y2="5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[1.05rem] font-extrabold tracking-tight">Onstage</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <ThemeToggle />
          <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "h-9 px-4 text-[0.84rem]")}>
            Open editor
          </Link>
        </div>
      </div>
    </header>
  );
}
