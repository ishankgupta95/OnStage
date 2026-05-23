import type { CSSProperties } from "react";

// Small, abstracted in-app screens that sit inside a DeviceMock to read as "a real
// app screenshot" without impersonating any brand. Each fills its parent (the device
// screen) and scales fluidly via cqw units, so it looks right at any frame size.
// `accent` ties the UI to the surrounding store-slot palette; `tone` flips light/dark.

export type AppUIVariant =
  | "fitness"
  | "finance"
  | "social"
  | "tasks"
  | "music"
  | "chat"
  | "travel";

type Props = {
  variant: AppUIVariant;
  accent?: string;
  tone?: "light" | "dark";
};

const bar = "rounded-full";

function StatusBar({ tone }: { tone: "light" | "dark" }) {
  const dim = tone === "light" ? "bg-black/70" : "bg-white/80";
  return (
    <div className="flex items-center justify-between px-[6cqw] pt-[5cqw] pb-[2cqw] text-[3.4cqw] font-semibold">
      <span className="tabular-nums tracking-tight">9:41</span>
      <div className="flex items-center gap-[1.4cqw]">
        <span className={`h-[2.4cqw] w-[5cqw] ${bar} ${dim}`} />
        <span className={`h-[2.4cqw] w-[3cqw] ${bar} ${dim}`} />
        <span className={`h-[2.6cqw] w-[6cqw] rounded-[1cqw] ${dim}`} />
      </div>
    </div>
  );
}

function Line({ w, h = 2.6, className = "", style }: { w: string; h?: number; className?: string; style?: CSSProperties }) {
  return <span className={`block ${bar} ${className}`} style={{ width: w, height: `${h}cqw`, ...style }} />;
}

export function AppUI({ variant, accent = "#56b8e6", tone = "light" }: Props) {
  const ac = { ["--ac" as string]: accent } as CSSProperties;
  const isLight = tone === "light";
  const surface = isLight ? "bg-white text-neutral-900" : "bg-neutral-950 text-neutral-50";
  const soft = isLight ? "bg-neutral-100" : "bg-white/[0.07]";
  const softer = isLight ? "bg-neutral-200/70" : "bg-white/[0.13]";
  const faint = isLight ? "bg-neutral-300/70" : "bg-white/20";
  const ring = isLight ? "ring-black/[0.06]" : "ring-white/10";

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden ${surface}`} style={ac}>
      <StatusBar tone={tone} />

      {variant === "fitness" && (
        <div className="flex flex-1 flex-col gap-[3.5cqw] px-[6cqw] pt-[3cqw]">
          <div className="flex items-center justify-between">
            <Line w="34%" h={4.4} className={softer} />
            <span className="size-[7cqw] rounded-full" style={{ background: "var(--ac)" }} />
          </div>
          <div className="flex items-center justify-center pt-[2cqw]">
            <div className="relative grid size-[42cqw] place-items-center rounded-full" style={{ background: `conic-gradient(var(--ac) 72%, ${isLight ? "#e9eaec" : "#26282d"} 0)` }}>
              <div className={`grid size-[31cqw] place-items-center rounded-full ${surface}`}>
                <span className="text-[8.5cqw] font-extrabold leading-none tracking-tight">72%</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[2.5cqw] pt-[1cqw]">
            {["1,840", "32", "6.2k"].map((v) => (
              <div key={v} className={`flex flex-col gap-[1.6cqw] rounded-[3cqw] p-[3cqw] ring-1 ${ring} ${soft}`}>
                <span className="text-[5cqw] font-bold leading-none tracking-tight">{v}</span>
                <Line w="70%" h={2} className={faint} />
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-end justify-between gap-[2cqw] pb-[6cqw]">
            {[40, 62, 30, 78, 52, 88, 46].map((h, i) => (
              <span key={i} className="flex-1 rounded-[1.5cqw]" style={{ height: `${h * 0.34}cqw`, background: i === 5 ? "var(--ac)" : isLight ? "#e6e7e9" : "#2a2c31" }} />
            ))}
          </div>
        </div>
      )}

      {variant === "finance" && (
        <div className="flex flex-1 flex-col gap-[3cqw] px-[6cqw] pt-[3cqw]">
          <Line w="40%" h={3} className={faint} />
          <span className="text-[12cqw] font-extrabold leading-none tracking-tighter">$8,240</span>
          <div className="flex items-center gap-[2cqw]">
            <span className="rounded-full px-[3cqw] py-[1cqw] text-[3.2cqw] font-bold text-white" style={{ background: "var(--ac)" }}>+12.4%</span>
            <Line w="28%" h={2.4} className={faint} />
          </div>
          <div className="relative mt-[1cqw] h-[34cqw] w-full overflow-hidden rounded-[3cqw]" style={{ background: isLight ? "#f4f5f7" : "rgba(255,255,255,0.04)" }}>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="fin-ac" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={accent} stopOpacity="0.45" />
                  <stop offset="1" stopColor={accent} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 30 L14 24 L28 27 L42 16 L56 19 L70 9 L84 13 L100 4 L100 40 L0 40 Z" fill="url(#fin-ac)" />
              <path d="M0 30 L14 24 L28 27 L42 16 L56 19 L70 9 L84 13 L100 4" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mt-auto flex flex-col gap-[2.5cqw] pb-[6cqw] pt-[2cqw]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-[3cqw]">
                <span className={`size-[8cqw] rounded-full ${softer}`} />
                <div className="flex flex-1 flex-col gap-[1.4cqw]">
                  <Line w={`${60 - i * 12}%`} h={2.6} className={softer} />
                  <Line w="34%" h={2} className={faint} />
                </div>
                <Line w="14%" h={2.8} className={softer} />
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === "social" && (
        <div className="flex flex-1 flex-col gap-[3cqw] pt-[2cqw]">
          <div className="flex gap-[3cqw] px-[6cqw]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="size-[11cqw] rounded-full ring-[0.8cqw] ring-offset-[1cqw]" style={{ background: i === 0 ? "var(--ac)" : isLight ? "#e6e7e9" : "#2a2c31", ["--tw-ring-color" as string]: i === 0 ? accent : "transparent" }} />
            ))}
          </div>
          <div className={`mx-[5cqw] mt-[1cqw] flex flex-col gap-[3cqw] rounded-[4cqw] p-[4cqw] ring-1 ${ring} ${soft}`}>
            <div className="flex items-center gap-[3cqw]">
              <span className="size-[9cqw] rounded-full" style={{ background: "var(--ac)" }} />
              <div className="flex flex-1 flex-col gap-[1.4cqw]">
                <Line w="44%" h={2.8} className={softer} />
                <Line w="26%" h={2} className={faint} />
              </div>
            </div>
            <div className="h-[40cqw] w-full rounded-[3cqw]" style={{ background: `linear-gradient(135deg, ${accent}, ${isLight ? "#cbd5e1" : "#1f2937"})` }} />
            <div className="flex gap-[4cqw]">
              <Line w="9%" h={3} className={faint} />
              <Line w="9%" h={3} className={faint} />
              <Line w="9%" h={3} className={faint} />
            </div>
            <Line w="80%" h={2.4} className={softer} />
          </div>
        </div>
      )}

      {variant === "tasks" && (
        <div className="flex flex-1 flex-col gap-[3.4cqw] px-[6cqw] pt-[3cqw]">
          <Line w="50%" h={5} className={softer} />
          <Line w="30%" h={2.4} className={faint} />
          <div className="mt-[1cqw] flex flex-col gap-[2.6cqw]">
            {[true, true, false, false, false].map((done, i) => (
              <div key={i} className={`flex items-center gap-[3cqw] rounded-[3cqw] p-[3.2cqw] ring-1 ${ring} ${soft}`}>
                <span className="grid size-[6.5cqw] place-items-center rounded-[1.8cqw]" style={{ background: done ? "var(--ac)" : "transparent", boxShadow: done ? "none" : `inset 0 0 0 0.8cqw ${isLight ? "#d4d4d8" : "#3a3d44"}` }}>
                  {done && (
                    <svg viewBox="0 0 24 24" className="size-[4.4cqw]" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <Line w={`${64 - i * 7}%`} h={2.8} className={done ? faint : softer} />
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === "music" && (
        <div className="flex flex-1 flex-col items-center gap-[4cqw] px-[7cqw] pt-[5cqw]">
          <div className="aspect-square w-[64cqw] rounded-[5cqw] shadow-lg" style={{ background: `linear-gradient(145deg, ${accent}, ${isLight ? "#0f172a" : "#000"})` }} />
          <div className="flex w-full flex-col items-center gap-[2cqw] pt-[1cqw]">
            <Line w="60%" h={4} className={softer} />
            <Line w="36%" h={2.6} className={faint} />
          </div>
          <div className="mt-[1cqw] flex w-full flex-col gap-[2cqw]">
            <div className={`h-[2cqw] w-full overflow-hidden rounded-full ${softer}`}>
              <span className="block h-full w-[42%] rounded-full" style={{ background: "var(--ac)" }} />
            </div>
            <div className="flex justify-between">
              <Line w="10%" h={2} className={faint} />
              <Line w="10%" h={2} className={faint} />
            </div>
          </div>
          <div className="mt-[1cqw] flex items-center gap-[7cqw]">
            <span className={`size-[6cqw] rounded-full ${softer}`} />
            <span className="size-[13cqw] rounded-full" style={{ background: "var(--ac)" }} />
            <span className={`size-[6cqw] rounded-full ${softer}`} />
          </div>
        </div>
      )}

      {variant === "chat" && (
        <div className="flex flex-1 flex-col gap-[3cqw] px-[5cqw] pt-[3cqw]">
          <div className="flex items-center gap-[3cqw] pb-[1cqw]">
            <span className="size-[8cqw] rounded-full" style={{ background: "var(--ac)" }} />
            <Line w="38%" h={3} className={softer} />
          </div>
          {[
            { me: false, w: "70%" },
            { me: true, w: "55%" },
            { me: false, w: "62%" },
            { me: true, w: "44%" },
          ].map((b, i) => (
            <div key={i} className={`flex ${b.me ? "justify-end" : "justify-start"}`}>
              <div
                className="flex flex-col gap-[1.6cqw] rounded-[4cqw] p-[3.2cqw]"
                style={{ width: b.w, background: b.me ? "var(--ac)" : isLight ? "#f1f2f4" : "rgba(255,255,255,0.08)" }}
              >
                <Line w="90%" h={2.2} className={b.me ? "bg-white/70" : faint} />
                <Line w="64%" h={2.2} className={b.me ? "bg-white/70" : faint} />
              </div>
            </div>
          ))}
          <div className={`mt-auto mb-[6cqw] flex items-center gap-[2cqw] rounded-full p-[2cqw] pl-[5cqw] ring-1 ${ring} ${soft}`}>
            <Line w="50%" h={2.4} className={faint} />
            <span className="ml-auto size-[8cqw] rounded-full" style={{ background: "var(--ac)" }} />
          </div>
        </div>
      )}

      {variant === "travel" && (
        <div className="flex flex-1 flex-col gap-[3cqw] pt-[2cqw]">
          <div className="relative mx-[5cqw] h-[46cqw] overflow-hidden rounded-[4cqw]" style={{ background: `linear-gradient(160deg, ${accent}, ${isLight ? "#fde68a" : "#0f172a"})` }}>
            <div className="absolute bottom-[3cqw] left-[3cqw] flex flex-col gap-[1.6cqw]">
              <Line w="22cqw" h={3.4} className="bg-white/90" />
              <Line w="14cqw" h={2.2} className="bg-white/60" />
            </div>
            <span className="absolute right-[3cqw] top-[3cqw] rounded-full bg-white/85 px-[3cqw] py-[1cqw] text-[3cqw] font-bold text-neutral-900">★ 4.9</span>
          </div>
          <div className="grid grid-cols-2 gap-[2.5cqw] px-[5cqw]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`flex flex-col gap-[2cqw] rounded-[3cqw] p-[2.6cqw] ring-1 ${ring} ${soft}`}>
                <span className="h-[16cqw] rounded-[2cqw]" style={{ background: i % 2 ? (isLight ? "#e2e8f0" : "#1f2937") : accent, opacity: i % 2 ? 1 : 0.85 }} />
                <Line w="76%" h={2.2} className={softer} />
                <Line w="40%" h={1.8} className={faint} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
