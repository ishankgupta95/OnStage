"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { s } from "@/lib/onstage/css";
import { IcoBack, IcoLogo, IcoMoon, IcoPhone, IcoSun } from "./icons";

/** The accent tile + wordmark, at the weights each screen uses. */
export function BrandMark({
  size = 26,
  font = 15,
  weight = 700,
  tracking = "-.025em",
  withNib = false,
  label = "Onstage",
}: {
  size?: number;
  font?: number;
  weight?: number;
  tracking?: string;
  withNib?: boolean;
  label?: string;
}) {
  const Ico = withNib ? IcoLogo : IcoPhone;
  return (
    <>
      <span
        style={s(
          `display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:6px;background:var(--accent);color:var(--on-accent)`,
        )}
      >
        <Ico size={Math.round(size * 0.577)} />
      </span>
      <span style={s(`font-size:${font}px;font-weight:${weight};letter-spacing:${tracking}`)}>
        {label}
      </span>
    </>
  );
}

/** Dark ⇄ light switch. Both glyphs render; CSS picks one, so no flash. */
export function ThemeButton({ radius = 6 }: { radius?: number }) {
  const { resolvedTheme, setTheme } = useTheme();
  const label = resolvedTheme === "light" ? "Light" : "Dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      title={label}
      aria-label="Toggle theme"
      style={s(
        `display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:${radius}px;background:transparent;color:var(--muted);cursor:pointer`,
      )}
    >
      <IcoSun size={15} className="only-dark" />
      <IcoMoon size={15} className="only-light" />
    </button>
  );
}

export function BackButton({ href, radius = 8 }: { href: string; radius?: number }) {
  return (
    <Link
      href={href}
      aria-label="Back"
      style={s(
        `display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:${radius}px;background:transparent;color:var(--muted);cursor:pointer;flex:none`,
      )}
    >
      <IcoBack size={14} />
    </Link>
  );
}
