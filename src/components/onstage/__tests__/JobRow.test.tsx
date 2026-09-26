import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/data/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.doUnmock("@/lib/features");
});

const failedUpload: Job = {
  id: "j1",
  title: "Trailhead — Play phone",
  sub: "Google Play · 10 files",
  pill: "FAILED",
  state: "failed",
  progress: 60,
  when: "2 min ago",
  action: "Retry",
  error: "Play rejected the upload: service account key revoked.",
  destination: "google",
};

/** JobRow built with the given flags (it lives behind jobQueue's screens). */
async function render(job: Job, flags: { storeUpload: boolean }) {
  vi.resetModules();
  vi.doMock("@/lib/features", async (importOriginal) => {
    const real = await importOriginal<typeof import("@/lib/features")>();
    return { FEATURES: { ...real.FEATURES, ...flags } };
  });
  const { JobRow } = await import("../JobRow");
  await act(async () => root.render(<JobRow job={job} />));
}

const storeLink = () => host.querySelector('a[href="/settings?tab=Store+connections"]');

describe("JobRow — a failed store upload (S3.1 cross-flag link)", () => {
  it("shows the error but no link to Store connections without storeUpload (the tab doesn't exist)", async () => {
    await render(failedUpload, { storeUpload: false });
    expect(host.textContent).toContain("service account key revoked");
    expect(storeLink()).toBeNull();
  });

  it("links to Store connections under storeUpload", async () => {
    await render(failedUpload, { storeUpload: true });
    expect(storeLink()?.textContent).toContain("Open store connections");
  });

  it("never links a zip job to Store connections", async () => {
    await render({ ...failedUpload, destination: "zip", error: "Render failed." }, { storeUpload: true });
    expect(storeLink()).toBeNull();
  });
});
