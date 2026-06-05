// Centralized route hrefs + basePath handling for the static portfolio build.
//
// The demo build has no server, so the runtime dynamic routes (/project/[id],
// /project/[id]/screenshot/[sid]) are flattened to static query-param pages:
//   /project?p=<projectId>
//   /editor?p=<projectId>&s=<screenshotId>
//
// next/link and next/navigation's router prepend the configured basePath
// automatically. Only RAW window.history/window.location calls need withBase().
// basePath is env-gated to match next.config.ts (empty in dev, /OnStage in CI).

const BASE =
  process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"
    ? process.env.NEXT_PUBLIC_BASE_PATH ?? ""
    : "";

/** Prefix a path with the deploy basePath — for imperative window.* navigation only. */
export function withBase(path: string): string {
  return BASE + path;
}

export const dashboardHref = () => "/dashboard";
export const newProjectHref = () => "/project/new";

export const projectHref = (projectId: string) =>
  `/project?p=${encodeURIComponent(projectId)}`;

export const editorHref = (projectId: string, screenshotId: string) =>
  `/editor?p=${encodeURIComponent(projectId)}&s=${encodeURIComponent(screenshotId)}`;
