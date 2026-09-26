import { afterEach, describe, expect, it, vi } from "vitest";

/** Every flag and the build-time variable that switches it on. */
const VARS = {
  accounts: "NEXT_PUBLIC_FEATURE_ACCOUNTS",
  teams: "NEXT_PUBLIC_FEATURE_TEAMS",
  billing: "NEXT_PUBLIC_FEATURE_BILLING",
  exportQuota: "NEXT_PUBLIC_FEATURE_EXPORT_QUOTA",
  storeUpload: "NEXT_PUBLIC_FEATURE_STORE_UPLOAD",
  aiAssist: "NEXT_PUBLIC_FEATURE_AI_ASSIST",
  abTest: "NEXT_PUBLIC_FEATURE_AB_TEST",
  jobQueue: "NEXT_PUBLIC_FEATURE_JOB_QUEUE",
  storeImport: "NEXT_PUBLIC_FEATURE_STORE_IMPORT",
  designBoards: "NEXT_PUBLIC_FEATURE_DESIGN_BOARDS",
} as const;

type Flag = keyof typeof VARS;

/** FEATURES is read once at import, so each case re-imports it. */
async function loadWith(env: Partial<Record<Flag, string>>) {
  vi.resetModules();
  for (const [flag, name] of Object.entries(VARS)) vi.stubEnv(name, env[flag as Flag] ?? "");
  return (await import("@/lib/features")).FEATURES;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("FEATURES", () => {
  it("defines exactly the documented flags", async () => {
    const features = await loadWith({});
    expect(Object.keys(features).sort()).toEqual(Object.keys(VARS).sort());
  });

  it("is entirely off when no variable is set", async () => {
    const features = await loadWith({});
    expect(Object.values(features).every((on) => on === false)).toBe(true);
  });

  it.each(Object.keys(VARS) as Flag[])("turns on %s alone when its variable is \"true\"", async (flag) => {
    const features = await loadWith({ [flag]: "true" });
    for (const other of Object.keys(VARS) as Flag[]) expect(features[other]).toBe(other === flag);
  });

  it.each(["1", "TRUE", "yes", "on", " true"])("stays off for %j", async (value) => {
    const features = await loadWith({ storeUpload: value, designBoards: value });
    expect(features.storeUpload).toBe(false);
    expect(features.designBoards).toBe(false);
  });
});
