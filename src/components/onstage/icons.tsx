import type { CSSProperties } from "react";

/**
 * Every icon in the design file, kept as the same 24×24 stroked paths the
 * mockup drew. `size`/`w` mirror the per-use width and stroke width.
 */
type IconProps = { size?: number; w?: number; style?: CSSProperties; className?: string };

function Svg({
  size = 14,
  w = 1.8,
  d,
  style,
  className,
  children,
  round = true,
}: IconProps & { d?: string; children?: React.ReactNode; round?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap={round ? "round" : undefined}
      strokeLinejoin={round ? "round" : undefined}
      style={style}
      className={className}
      aria-hidden
    >
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export const IcoPhone = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 2.1}>
    <rect x="7.5" y="2.5" width="9" height="19" rx="2.6" />
  </Svg>
);

export const IcoLogo = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 2.1}>
    <rect x="7.5" y="2.5" width="9" height="19" rx="2.6" />
    <path d="M10.6 5.4h2.8" strokeLinecap="round" />
  </Svg>
);

export const IcoPhoneWide = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.6" />
  </Svg>
);

export const IcoSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path
      d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"
      strokeLinecap="round"
    />
  </Svg>
);

export const IcoMoon = (p: IconProps) => (
  <Svg {...p} d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
);

export const IcoEye = (p: IconProps) => (
  <Svg {...p} round={false}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.4" />
  </Svg>
);

export const IcoExport = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 2.2} d="M12 16V4M7.5 11.5L12 16l4.5-4.5M4 19.5h16" />
);

export const IcoUpload = (p: IconProps) => (
  <Svg {...p} d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" />
);

export const IcoChevron = (p: IconProps) => <Svg {...p} w={p.w ?? 2.4} d="M6 9l6 6 6-6" />;

export const IcoBack = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 2.1} d="M19 12H6M11.5 6.5L6 12l5.5 5.5" />
);

export const IcoCube = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 1.7} round={false}>
    <path d="M4 6.5l7-3 9 3.5v11l-9 3.5-7-3z" />
    <path d="M11 3.5v17.5" opacity=".55" />
  </Svg>
);

export const IcoShadow = (p: IconProps) => (
  <Svg {...p} round={false}>
    <circle cx="12" cy="9.5" r="5.5" />
    <ellipse cx="12" cy="18.5" rx="7.5" ry="2" opacity=".5" />
  </Svg>
);

export const IcoShrink = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 1.9} d="M9 15L4 20M4 15v5h5M15 9l5-5M20 9V4h-5" />
);

export const IcoGrow = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 1.9} d="M4 10V4h6M20 14v6h-6M4 4l6 6M20 20l-6-6" />
);

export const IcoSparkle = (p: IconProps) => (
  <Svg {...p} round={false} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
);

export const IcoCursor = (p: IconProps) => <Svg {...p} w={p.w ?? 1.7} d="M4 4l7 16 2.5-6.5L20 11z" />;

export const IcoPanorama = (p: IconProps) => (
  <Svg {...p} round={false} d="M3 7.5c6-2 12-2 18 0v9c-6 2-12 2-18 0z" />
);

export const IcoClose = (p: IconProps) => <Svg {...p} w={p.w ?? 2} d="M6 6l12 12M18 6L6 18" />;

export const IcoPlus = (p: IconProps) => <Svg {...p} w={p.w ?? 1.9} d="M12 5v14M5 12h14" />;

export const IcoSearch = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 1.9} round={false}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" strokeLinecap="round" />
  </Svg>
);

export const IcoAlert = (p: IconProps) => (
  <Svg {...p} w={p.w ?? 2} round={false}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
  </Svg>
);

export const IcoGrid = (p: IconProps) => (
  <Svg {...p} d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />
);

export const IcoText = (p: IconProps) => <Svg {...p} d="M5 6h14M12 6v13M9 19h6" />;

export const IcoImage = (p: IconProps) => (
  <Svg {...p} d="M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4" />
);

export const IcoShield = (p: IconProps) => <Svg {...p} d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7z" />;

export const IcoGlobe = (p: IconProps) => (
  <Svg {...p} d="M4 12a8 8 0 1016 0 8 8 0 10-16 0M4 12h16M12 4c2.5 2.2 2.5 13.6 0 16" />
);

export const IcoAlign = ({ dir, ...p }: IconProps & { dir: "left" | "center" | "right" }) => (
  <Svg
    {...p}
    size={p.size ?? 13}
    w={p.w ?? 1.9}
    d={
      dir === "left"
        ? "M4 7h16M4 12h10M4 17h13"
        : dir === "center"
          ? "M4 7h16M7 12h10M6 17h12"
          : "M4 7h16M10 12h10M7 17h13"
    }
  />
);
