import type {
  AbDiff,
  AbStat,
  AbVariant,
  ActivityEntry,
  App,
  BrandKit,
  Comment,
  Invoice,
  Job,
  Locale,
  Member,
  ScreenshotSet,
  Session,
  SizeRow,
  StoreConnection,
  UsageMetric,
  Variant,
} from "./types";

/**
 * The worked example the whole product is designed around — Trailhead and its
 * two stablemates. This is the seed the local backend serves; a Supabase
 * backend replaces it with rows.
 */

export const SESSION: Session = {
  userId: "u_mia",
  email: "mk@trailhead.app",
  name: "Mia Kerr",
  initials: "MK",
  plan: "free",
  exportsUsed: 3,
  // The allowance this account would have when billing exists. While
  // FEATURES.exportQuota is off, local.ts hands out `null` (= unlimited, see
  // types.ts) instead of this — kept here so flipping the flag restores the
  // metered behaviour exactly.
  exportsAllowed: 5,
};

export const APPS: App[] = [
  {
    id: "trailhead",
    name: "Trailhead",
    initial: "T",
    meta: "3 SETS · IOS + ANDROID",
    tint: "#1b6f6a",
    thumbs: [
      "linear-gradient(150deg,#ff6b53,#c9315f)",
      "linear-gradient(160deg,#1f2b4d,#0e1424)",
      "linear-gradient(155deg,#1b6f6a,#0f3a3d)",
      "linear-gradient(160deg,#1a1917,#0b0b0a)",
    ],
    tags: [
      { label: "App Store live", kind: "ok" },
      { label: "Play missing 7″", kind: "warn" },
    ],
  },
  {
    id: "ferry",
    name: "Ferry",
    initial: "F",
    meta: "2 SETS · IOS",
    tint: "#3f6fa8",
    thumbs: [
      "linear-gradient(160deg,#f4f1ea,#ded8cb)",
      "linear-gradient(150deg,#3aa8c9,#124e73)",
      "linear-gradient(160deg,#f4f1ea,#ded8cb)",
      "linear-gradient(150deg,#3aa8c9,#124e73)",
    ],
    tags: [
      { label: "App Store live", kind: "ok" },
      { label: "4 locales", kind: "neutral" },
    ],
  },
  {
    id: "lumen",
    name: "Lumen",
    initial: "L",
    meta: "1 SET · DRAFT",
    tint: "#a8563f",
    thumbs: [
      "linear-gradient(150deg,#f5b544,#e8672f)",
      "linear-gradient(155deg,#6f5bd6,#2a2159)",
      "linear-gradient(150deg,#f5b544,#e8672f)",
      "linear-gradient(155deg,#6f5bd6,#2a2159)",
    ],
    tags: [{ label: "Draft", kind: "neutral" }],
  },
];

export const SETS: ScreenshotSet[] = [
  {
    id: "trailhead-69",
    appId: "trailhead",
    name: "Trailhead — 6.9″ set",
    sub: "Ember template · EN, DE, JA, ES",
    frameCount: 5,
    status: "Ready",
    updatedAt: "2h ago",
    swatch: "linear-gradient(150deg,#ff6b53,#c9315f)",
  },
  {
    id: "trailhead-play",
    appId: "trailhead",
    name: "Trailhead — Play phone",
    sub: "Ember template · EN, DE",
    frameCount: 5,
    status: "Missing size",
    updatedAt: "Yesterday",
    swatch: "linear-gradient(160deg,#1f2b4d,#0e1424)",
  },
  {
    id: "ferry-69",
    appId: "ferry",
    name: "Ferry — 6.9″ set",
    sub: "Field Notes template · 4 locales",
    frameCount: 6,
    status: "Uploaded",
    updatedAt: "6 Mar",
    swatch: "linear-gradient(160deg,#f4f1ea,#ded8cb)",
  },
  {
    id: "lumen-draft",
    appId: "lumen",
    name: "Lumen — first draft",
    sub: "Sunbelt template · EN",
    frameCount: 3,
    status: "Draft",
    updatedAt: "28 Feb",
    swatch: "linear-gradient(150deg,#f5b544,#e8672f)",
  },
];

export const SIZE_ROWS: SizeRow[] = [
  { id: "apple-69", store: "Apple", label: "iPhone 6.9″", px: "1320 × 2868", status: "Ready", frames: 5, action: "Open" },
  { id: "apple-65", store: "Apple", label: "iPhone 6.5″", px: "1242 × 2688", status: "Ready", frames: 5, action: "Open" },
  { id: "play-phone", store: "Google", label: "Phone", px: "1080 × 1920", status: "Ready", frames: 5, action: "Open" },
  { id: "play-tablet7", store: "Google", label: "Tablet 7″", px: "1200 × 1920", status: "Missing", frames: 0, action: "Generate" },
  { id: "play-feature", store: "Google", label: "Feature graphic", px: "1024 × 500", status: "Draft", frames: 1, action: "Open" },
];

export const VARIANTS: Variant[] = [
  {
    id: "a",
    name: "Variant A — headline first",
    pill: "LIVE",
    note: "Installs +0% baseline",
    action: "Duplicate",
    live: true,
    swatches: ["var(--accent)", "#c9315f", "#1f2b4d", "#1b6f6a"],
  },
  {
    id: "b",
    name: "Variant B — screenshot first",
    pill: "READY",
    note: "Not yet published",
    action: "Push live",
    live: false,
    swatches: ["#1f2b4d", "#1b6f6a", "var(--accent)", "#1a1917"],
  },
];

export const LOCALES: Locale[] = [
  { code: "EN", name: "English (US)", translated: 5, state: "source" },
  { code: "DE", name: "German", translated: 5, state: "reflowed" },
  { code: "JA", name: "Japanese", translated: 5, state: "done" },
  { code: "ES", name: "Spanish", translated: 5, state: "done" },
  { code: "FR", name: "French", translated: 0, state: "untranslated" },
  { code: "PT-BR", name: "Portuguese (BR)", translated: 0, state: "untranslated" },
];

export const ACTIVITY: ActivityEntry[] = [
  { id: "a1", text: "6.9″ set uploaded to App Store Connect", when: "2H AGO", tint: "var(--ok)" },
  { id: "a2", text: "Ember background applied to all frames", when: "2H AGO", tint: "var(--accent)" },
  { id: "a3", text: "JA captions generated and reflowed", when: "YESTERDAY", tint: "var(--accent)" },
  { id: "a4", text: "Play 7″ tablet size detected as missing", when: "YESTERDAY", tint: "#f5b544" },
];

export const CONNECTIONS: StoreConnection[] = [
  {
    id: "apple",
    name: "App Store Connect",
    initial: "A",
    connected: true,
    // No address here: this row renders on the project board and in Settings,
    // both of which survive every feature flag, so it must not name a person.
    sub: "Token expires in 41 days",
    scopes: ["App metadata", "Screenshots"],
    warning: "",
  },
  {
    id: "google",
    name: "Google Play Console",
    initial: "G",
    connected: false,
    sub: "Service account key was revoked on 2 March",
    scopes: ["Store listings"],
    warning:
      "Uploads to Play are paused until you reconnect. Exports still download normally.",
  },
];

export const JOBS: Job[] = [
  {
    id: "j1",
    title: "Trailhead — 6.9″ + 6.5″ · EN, DE",
    sub: "40 files · Apple + Google",
    pill: "RENDERING",
    state: "running",
    progress: 68,
    when: "Started 40s ago",
    action: "Cancel",
    error: "",
  },
  {
    id: "j2",
    title: "Trailhead — Play upload",
    sub: "Google Play Console · phone slot",
    pill: "FAILED",
    state: "failed",
    progress: 100,
    when: "6 min ago",
    action: "Retry",
    error:
      "Play rejected the upload: service account key revoked. Reconnect in Settings → Store connections, then retry.",
    destination: "google",
  },
  {
    id: "j3",
    title: "Trailhead — App Store upload",
    sub: "App Store Connect · 6.9″ slot",
    pill: "UPLOADED",
    state: "done",
    progress: 100,
    when: "2h ago",
    action: "View",
    error: "",
    destination: "apple",
  },
  {
    id: "j4",
    title: "Ferry — 6.9″ set · 4 locales",
    sub: "120 files · zip download",
    pill: "DOWNLOADED",
    state: "done",
    progress: 100,
    when: "6 Mar",
    action: "Re-download",
    error: "",
    destination: "zip",
  },
  {
    id: "j5",
    title: "Lumen — feature graphic",
    sub: "1 file · 1024×500",
    pill: "DOWNLOADED",
    state: "done",
    progress: 100,
    when: "28 Feb",
    action: "Re-download",
    error: "",
    destination: "zip",
  },
];

export const COMMENTS: Comment[] = [
  {
    id: "c1",
    author: "Jamie Doyle",
    initials: "JD",
    tint: "#3f6fa8",
    when: "2H AGO",
    frameIndex: 0,
    body: "The headline sits too close to the phone at 6.5″. Can we push the caption up 24px so it clears the notch area?",
    reply: { author: "You", body: "Moved it and locked the safe margin in the brand kit." },
    resolved: false,
    target: "caption",
  },
  {
    id: "c2",
    author: "Ana Ruiz",
    initials: "AR",
    tint: "#1b6f6a",
    when: "YESTERDAY",
    frameIndex: 2,
    body: "German caption wraps to three lines here. Shorter verb?",
    resolved: false,
    target: "caption",
  },
  {
    id: "c3",
    author: "Jamie Doyle",
    initials: "JD",
    tint: "#3f6fa8",
    when: "YESTERDAY",
    frameIndex: 0,
    body: "Tilt on the first frame reads as a mistake — everything else leans right and this one is flat.",
    resolved: false,
    target: "device",
  },
];

export const MEMBERS: Member[] = [
  { id: "m1", name: "Mia Kerr", email: "mk@trailhead.app", role: "Owner", lastSeen: "Now", tint: "#5d5294" },
  { id: "m2", name: "Jamie Doyle", email: "jamie@trailhead.app", role: "Editor", lastSeen: "2h ago", tint: "#3f6fa8" },
  { id: "m3", name: "Ana Ruiz", email: "ana@ruiz.studio", role: "Reviewer", lastSeen: "Yesterday", tint: "#1b6f6a" },
  { id: "m4", name: "seat available", email: "Invite a teammate", role: "—", lastSeen: "", tint: "" },
];

export const INVOICES: Invoice[] = [
  { id: "i1", date: "3 March 2026", description: "Indie · monthly", amount: "$12.00", status: "Paid" },
  { id: "i2", date: "3 February 2026", description: "Indie · monthly", amount: "$12.00", status: "Paid" },
  { id: "i3", date: "3 January 2026", description: "Indie · monthly", amount: "$12.00", status: "Paid" },
  { id: "i4", date: "18 December 2025", description: "Single export", amount: "$4.00", status: "Refunded" },
];

export const USAGE: UsageMetric[] = [
  { id: "exports", label: "EXPORTS THIS MONTH", value: "18 of ∞", pct: 34 },
  { id: "locales", label: "LOCALES IN USE", value: "4 of 30", pct: 13 },
  { id: "storage", label: "STORAGE", value: "1.2 of 10 GB", pct: 12 },
];

export const BRAND_KITS: BrandKit[] = [
  {
    id: "trailhead",
    name: "Trailhead",
    setCount: 5,
    tint: "#1b6f6a",
    colors: [
      { role: "Primary", hex: "#1B6F6A" },
      { role: "Deep", hex: "#134F63" },
      { role: "Surface", hex: "#0F1114" },
      { role: "Accent", hex: "#E8A33F" },
      { role: "Paper", hex: "#F0EFE9" },
    ],
    defaults: [
      { label: "Device frame", sub: "Applied to new frames", value: "Graphite" },
      { label: "Perspective", sub: "Starting tilt", value: "Right 17°" },
      { label: "Caption position", sub: "Above the device", value: "Top" },
      { label: "Safe margins", sub: "Store-safe padding", value: "On" },
    ],
  },
  {
    id: "ferry",
    name: "Ferry",
    setCount: 2,
    tint: "#3f6fa8",
    colors: [
      { role: "Primary", hex: "#3F6FA8" },
      { role: "Deep", hex: "#124E73" },
      { role: "Surface", hex: "#0E1424" },
      { role: "Accent", hex: "#3AA8C9" },
      { role: "Paper", hex: "#F4F1EA" },
    ],
    defaults: [
      { label: "Device frame", sub: "Applied to new frames", value: "Silver" },
      { label: "Perspective", sub: "Starting tilt", value: "Flat" },
      { label: "Caption position", sub: "Above the device", value: "Top" },
      { label: "Safe margins", sub: "Store-safe padding", value: "On" },
    ],
  },
];

export const AB_STATS: AbStat[] = [
  { id: "s1", label: "IMPRESSIONS", value: "48.2K", delta: "", sub: "Split evenly, 14 days" },
  { id: "s2", label: "VARIANT A INSTALL RATE", value: "3.1%", delta: "", sub: "Baseline" },
  { id: "s3", label: "VARIANT B INSTALL RATE", value: "3.7%", delta: "+19%", sub: "Better" },
  { id: "s4", label: "CONFIDENCE", value: "96%", delta: "", sub: "Above the 95% bar" },
];

export const AB_VARIANTS: AbVariant[] = [
  {
    id: "a",
    name: "Variant A",
    pill: "LIVE",
    split: "50% of traffic",
    winning: false,
    captions: ["Every run, mapped", "Know your pace", "Trails near you"],
    backgrounds: ["ember", "dusk", "moss"],
    rows: [
      { label: "Install rate", value: "3.1%", pct: 62 },
      { label: "Screenshot taps", value: "11%", pct: 44 },
      { label: "Scroll past frame 3", value: "28%", pct: 28 },
    ],
  },
  {
    id: "b",
    name: "Variant B",
    pill: "WINNING",
    split: "50% of traffic",
    winning: true,
    captions: ["8.4 km, logged in one tap", "Pace you can trust", "Every trail near you"],
    backgrounds: ["moss", "ink", "sea"],
    rows: [
      { label: "Install rate", value: "3.7%", pct: 74 },
      { label: "Screenshot taps", value: "17%", pct: 68 },
      { label: "Scroll past frame 3", value: "41%", pct: 41 },
    ],
  },
];

export const AB_DIFFS: AbDiff[] = [
  {
    frame: "FRAME 01",
    text: "Headline names the number instead of the feature — “8.4 km, logged in one tap”.",
    effect: "+11%",
    better: true,
  },
  { frame: "FRAME 02", text: "Phone tilted 17° right rather than flat, shadow softened.", effect: "+4%", better: true },
  {
    frame: "FRAME 03",
    text: "Background swapped from teal to near-black, caption moved above the device.",
    effect: "−2%",
    better: false,
  },
];
