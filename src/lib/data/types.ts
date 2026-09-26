/**
 * The domain the product actually talks about. Every name here is part of the
 * contract a backend implements, so some are exported for implementors rather
 * than because a screen imports them today.
 * These shapes are what the
 * backend returns, so they are also the shapes a Supabase schema should
 * produce — ids are strings so a uuid drops straight in.
 */

/** One artboard in a set. Mirrors the editor's own frame. */
export type SetFrame = {
  caption: string;
  bg: string;
  tiltX: number;
  tiltY: number;
  depth: number;
  scale: number;
  screenshot: string | null;
};

/** The editable document for one set — what the canvas edits and export renders. */
export type SetDoc = {
  frames: SetFrame[];
  device: string;
  frameColor: string;
  captionFont: string;
  align: "left" | "center" | "right";
  captionSize: number;
  panorama: boolean;
  shadow: boolean;
  lang: string;
  store: "apple" | "play";
  workMode: "guided" | "canvas";
};

export type CaptionTone = "Direct" | "Benefit-led" | "Playful";

export type CaptionSuggestion = { text: string; meta: string };

/** What a store-URL import found. */
export type ImportedListing = {
  appName: string;
  subtitle: string;
  tint: string;
  screenshots: string[];
};

export type Session = {
  userId: string;
  email: string;
  name: string;
  initials: string;
  plan: "free" | "indie" | "studio";
  exportsUsed: number;
  exportsAllowed: number | null; // null = unlimited
};

export type AppTag = { label: string; kind: "ok" | "warn" | "neutral" };

export type App = {
  id: string;
  name: string;
  initial: string;
  meta: string;
  tint: string;
  /** Gradient strip shown on the dashboard card. */
  thumbs: string[];
  tags: AppTag[];
};

export type SetStatus = "Ready" | "Missing size" | "Uploaded" | "Draft";

export type ScreenshotSet = {
  id: string;
  appId: string;
  name: string;
  sub: string;
  frameCount: number;
  status: SetStatus;
  updatedAt: string;
  swatch: string;
};

export type SizeRowStatus = "Ready" | "Missing" | "Draft";

export type SizeRow = {
  id: string;
  store: "Apple" | "Google";
  label: string;
  px: string;
  status: SizeRowStatus;
  frames: number;
  action: string;
};

export type Variant = {
  id: string;
  name: string;
  pill: string;
  note: string;
  action: string;
  live: boolean;
  swatches: string[];
};

export type Locale = {
  code: string;
  name: string;
  /** How many of the set's frames have a translated headline. */
  translated: number;
  /** Reflowed = fits, but the copy runs longer than the source. */
  state: "source" | "done" | "reflowed" | "untranslated";
};

export type ActivityEntry = { id: string; text: string; when: string; tint: string };

export type StoreConnection = {
  id: "apple" | "google";
  name: string;
  initial: string;
  connected: boolean;
  sub: string;
  scopes: string[];
  warning: string;
};

export type JobState = "running" | "failed" | "done";

export type Job = {
  id: string;
  title: string;
  sub: string;
  pill: string;
  state: JobState;
  progress: number;
  when: string;
  action: string;
  error: string;
  /** Upload jobs belong to a store; render jobs do not. */
  destination?: "zip" | "apple" | "google";
};

export type Comment = {
  id: string;
  author: string;
  initials: string;
  tint: string;
  when: string;
  frameIndex: number;
  body: string;
  reply?: { author: string; body: string };
  resolved: boolean;
  /** What the comment is about, so "Open frame" lands on the right tool. */
  target: "caption" | "device";
};

export type MemberRole = "Owner" | "Editor" | "Reviewer" | "—";

export type Member = {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  lastSeen: string;
  tint: string;
};

export type Invoice = {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: "Paid" | "Refunded";
};

export type UsageMetric = { id: string; label: string; value: string; pct: number };

export type BrandKit = {
  id: string;
  name: string;
  setCount: number;
  tint: string;
  colors: { role: string; hex: string }[];
  defaults: { label: string; sub: string; value: string }[];
};

export type AbStat = { id: string; label: string; value: string; delta: string; sub: string };

export type AbVariant = {
  id: string;
  name: string;
  pill: string;
  split: string;
  winning: boolean;
  captions: string[];
  backgrounds: string[];
  rows: { label: string; value: string; pct: number }[];
};

export type AbDiff = { frame: string; text: string; effect: string; better: boolean };

/** What an upload attempt reports back. */
export type UploadResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: "not-connected" | "token-expired" | "rejected"; message: string };
