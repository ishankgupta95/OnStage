import { describe, expect, it, vi } from "vitest";
import type { Backend } from "@/lib/data/backend";
import type { App, ScreenshotSet } from "@/lib/data/types";
import {
  DEFAULT_APP_TINT,
  FALLBACK_APP_NAME,
  appIdentity,
  exportRoot,
  exportSlug,
  resolveAppName,
  zipFileName,
} from "../appName";

type Library = Pick<Backend, "listSets" | "listApps">;

const set = (id: string, appId: string): ScreenshotSet => ({
  id,
  appId,
  name: `Set ${id}`,
  sub: "",
  frameCount: 5,
  status: "Draft",
  updatedAt: "2026-09-26T00:00:00.000Z",
  swatch: "",
});

const app = (id: string, name: string): App => ({
  id,
  name,
  initial: name.charAt(0),
  meta: "",
  tint: "",
  thumbs: [],
  tags: [],
});

/** A library the test controls, with spies so a test can say the backend
 *  was never asked. `listSets` honours its optional app filter, as the real
 *  backends do. */
function fakeLibrary(sets: ScreenshotSet[] = [], apps: App[] = []) {
  const listSets = vi.fn(async (appId?: string) => sets.filter((s) => !appId || s.appId === appId));
  const listApps = vi.fn(async () => [...apps]);
  const backend: Library = { listSets, listApps };
  return { backend, listSets, listApps };
}

/** Two apps with a set each, so a lookup has to pick the right one. */
const twoApps = () =>
  fakeLibrary(
    [set("set-a", "app-a"), set("set-b", "app-b")],
    [app("app-a", "Trailhead"), app("app-b", "Pocket Ledger")],
  );

describe("resolveAppName", () => {
  describe("the set's own name", () => {
    it("wins over the app record and never asks the backend", async () => {
      const { backend, listSets, listApps } = twoApps();
      await expect(resolveAppName({ appName: "My Own Name" }, "set-a", backend)).resolves.toBe("My Own Name");
      expect(listSets).not.toHaveBeenCalled();
      expect(listApps).not.toHaveBeenCalled();
    });

    it("is trimmed", async () => {
      const { backend } = twoApps();
      await expect(resolveAppName({ appName: "  Spaced Out \t\n" }, "set-a", backend)).resolves.toBe(
        "Spaced Out",
      );
    });

    it("counts even when the set has no id", async () => {
      const { backend } = fakeLibrary();
      await expect(resolveAppName({ appName: "Loose" }, null, backend)).resolves.toBe("Loose");
    });

    it("falls through to the app record when it is blank", async () => {
      const { backend } = twoApps();
      await expect(resolveAppName({ appName: "" }, "set-b", backend)).resolves.toBe("Pocket Ledger");
    });

    it("falls through to the app record when it is only whitespace", async () => {
      const { backend } = twoApps();
      await expect(resolveAppName({ appName: "   \t\n " }, "set-b", backend)).resolves.toBe("Pocket Ledger");
    });

    it("falls through to the app record when the doc has none", async () => {
      const { backend } = twoApps();
      await expect(resolveAppName({}, "set-a", backend)).resolves.toBe("Trailhead");
    });

    it("is ignored when a damaged doc holds something other than a string", async () => {
      // Docs come from storage; a hand-edited or corrupted one must not crash
      // the export or print "[object Object]" on the feature graphic.
      const { backend } = twoApps();
      for (const bad of [42, true, { name: "x" }, ["x"], null]) {
        const damaged = { appName: bad as unknown as string };
        await expect(resolveAppName(damaged, "set-a", backend)).resolves.toBe("Trailhead");
      }
    });
  });

  describe("the app record", () => {
    it("names the app the set belongs to, not the first app in the library", async () => {
      const { backend } = twoApps();
      await expect(resolveAppName({}, "set-b", backend)).resolves.toBe("Pocket Ledger");
    });

    it("is trimmed", async () => {
      const { backend } = fakeLibrary([set("s", "a")], [app("a", "  Trailhead  ")]);
      await expect(resolveAppName({}, "s", backend)).resolves.toBe("Trailhead");
    });

    it("gives null when its name is blank", async () => {
      const { backend } = fakeLibrary([set("s", "a")], [app("a", "")]);
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });

    it("gives null when its name is only whitespace", async () => {
      const { backend } = fakeLibrary([set("s", "a")], [app("a", " \t ")]);
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });

    it("gives null when a damaged record's name is not a string", async () => {
      const damaged = { ...app("a", "x"), name: 7 as unknown as string };
      const { backend } = fakeLibrary([set("s", "a")], [damaged]);
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });
  });

  describe("nothing names the app", () => {
    it("gives null for a set with no id, without touching the backend", async () => {
      const { backend, listSets, listApps } = twoApps();
      await expect(resolveAppName({}, null, backend)).resolves.toBeNull();
      expect(listSets).not.toHaveBeenCalled();
      expect(listApps).not.toHaveBeenCalled();
    });

    it("gives null for an empty set id, without touching the backend", async () => {
      const { backend, listSets, listApps } = twoApps();
      await expect(resolveAppName({}, "", backend)).resolves.toBeNull();
      expect(listSets).not.toHaveBeenCalled();
      expect(listApps).not.toHaveBeenCalled();
    });

    it("gives null when the set is not in the library", async () => {
      const { backend } = twoApps();
      await expect(resolveAppName({}, "set-gone", backend)).resolves.toBeNull();
    });

    it("gives null when the set's app is missing", async () => {
      // A set whose app was deleted must not borrow another app's name.
      const { backend } = fakeLibrary([set("s", "app-deleted")], [app("app-other", "Somebody Else")]);
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });

    it("gives null for an empty library", async () => {
      const { backend } = fakeLibrary();
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });
  });

  describe("a library that can't be read", () => {
    // The export must still run; an unreadable library counts as no app record.
    it("gives null when listSets rejects", async () => {
      const backend: Library = {
        listSets: vi.fn(async () => {
          throw new Error("sets unreadable");
        }),
        listApps: vi.fn(async () => [app("a", "Trailhead")]),
      };
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });

    it("gives null when listApps rejects", async () => {
      const backend: Library = {
        listSets: vi.fn(async () => [set("s", "a")]),
        listApps: vi.fn(async () => {
          throw new Error("apps unreadable");
        }),
      };
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });

    it("gives null when the backend throws before returning a promise", async () => {
      const backend: Library = {
        listSets: () => {
          throw new Error("not a promise");
        },
        listApps: async () => [app("a", "Trailhead")],
      };
      await expect(resolveAppName({}, "s", backend)).resolves.toBeNull();
    });

    it("still returns the set's own name without reading the library", async () => {
      const backend: Library = {
        listSets: vi.fn(async () => {
          throw new Error("sets unreadable");
        }),
        listApps: vi.fn(async () => {
          throw new Error("apps unreadable");
        }),
      };
      await expect(resolveAppName({ appName: "Typed In" }, "s", backend)).resolves.toBe("Typed In");
    });
  });
});

describe("exportSlug", () => {
  it("lower-cases a plain name", () => {
    expect(exportSlug("Trailhead")).toBe("trailhead");
  });

  it("joins words with single dashes", () => {
    expect(exportSlug("Pocket Ledger Pro")).toBe("pocket-ledger-pro");
  });

  it("strips accents instead of dropping the letters", () => {
    expect(exportSlug("Café Ölé")).toBe("cafe-ole");
    expect(exportSlug("Crème Brûlée Naïve Señor")).toBe("creme-brulee-naive-senor");
  });

  it("strips accents written as combining marks too", () => {
    // "e" + U+0301 COMBINING ACUTE ACCENT, as some keyboards and pastes produce.
    expect(exportSlug("Cafe\u0301")).toBe("cafe");
  });

  it("folds compatibility forms such as full-width letters and ligatures", () => {
    expect(exportSlug("\uFF34\uFF52\uFF41\uFF49\uFF4C")).toBe("trail");
    expect(exportSlug("\uFB01nance")).toBe("finance");
  });

  it("collapses runs of punctuation, spaces and emoji into one dash", () => {
    expect(exportSlug("Trail  --  Head")).toBe("trail-head");
    expect(exportSlug("Fit & Fun!!! 🎉🎉 Tracker")).toBe("fit-fun-tracker");
    expect(exportSlug("a_b.c/d\\e:f")).toBe("a-b-c-d-e-f");
  });

  it("trims leading and trailing punctuation", () => {
    expect(exportSlug("  --Trailhead!!  ")).toBe("trailhead");
    expect(exportSlug("🚀 Launchpad 🚀")).toBe("launchpad");
    expect(exportSlug("...(Beta)...")).toBe("beta");
  });

  it("keeps digits", () => {
    expect(exportSlug("2048")).toBe("2048");
    expect(exportSlug("Todo 2 Go v3.1")).toBe("todo-2-go-v3-1");
  });

  it("never leaves path separators or dots that could escape the zip folder", () => {
    expect(exportSlug("../../etc/passwd")).toBe("etc-passwd");
    expect(exportSlug("C:\\Windows")).toBe("c-windows");
  });

  describe("falls back to onstage-export when nothing usable is left", () => {
    it.each([
      ["an emoji-only name", "🎉🚀✨"],
      ["a CJK-only name", "記帳アプリ"],
      ["a Cyrillic-only name", "Трейлхед"],
      ["punctuation only", "!!! --- ???"],
      ["whitespace only", "   \t "],
      ["an empty string", ""],
    ])("%s", (_label, name) => {
      expect(exportSlug(name)).toBe("onstage-export");
    });

    it("null", () => {
      expect(exportSlug(null)).toBe("onstage-export");
    });
  });

  describe("the 60-character cap", () => {
    it("keeps a 60-character name whole", () => {
      const name = "a".repeat(60);
      expect(exportSlug(name)).toBe(name);
    });

    it("cuts a longer unbroken name at 60 characters", () => {
      expect(exportSlug("b".repeat(90))).toBe("b".repeat(60));
    });

    it("never ends in a dash when the cut lands on a word break", () => {
      // 59 letters, a space, then more: the 60th slug character is the dash.
      const slug = exportSlug(`${"a".repeat(59)} tail words here`);
      expect(slug).toBe("a".repeat(59));
      expect(slug.endsWith("-")).toBe(false);
    });

    it("never ends in a dash for any cut position", () => {
      // Words of every length, so the cut lands on every kind of boundary.
      for (let w = 1; w <= 12; w++) {
        const name = Array.from({ length: 40 }, (_, i) => "x".repeat(w) + i).join(" ");
        const slug = exportSlug(name);
        expect(slug.length).toBeLessThanOrEqual(60);
        expect(slug.endsWith("-")).toBe(false);
        expect(slug.startsWith("-")).toBe(false);
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      }
    });

    it("counts the cap after accents are stripped, not before", () => {
      // 60 "é" are 120 code units once decomposed; the slug is 60 plain "e".
      expect(exportSlug("é".repeat(60))).toBe("e".repeat(60));
    });
  });

  it("only ever produces lower-case ASCII letters, digits and single inner dashes", () => {
    for (const name of ["Trailhead", "Café Ölé", "🎉 Party 🎉", "A--B__C", "x".repeat(200), "記帳 Ledger 2"]) {
      expect(exportSlug(name)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("exportRoot and zipFileName", () => {
  it("name the folder and zip after the app", () => {
    expect(exportRoot("Trailhead")).toBe("trailhead-store-assets");
    expect(zipFileName("Trailhead")).toBe("trailhead-store-assets.zip");
  });

  it("use the slug, not the raw name", () => {
    expect(exportRoot("Café Ölé!")).toBe("cafe-ole-store-assets");
    expect(zipFileName("Café Ölé!")).toBe("cafe-ole-store-assets.zip");
  });

  it("fall back to onstage-export when nothing names the app", () => {
    expect(exportRoot(null)).toBe("onstage-export-store-assets");
    expect(zipFileName(null)).toBe("onstage-export-store-assets.zip");
  });

  it("fall back to onstage-export for a name with nothing usable", () => {
    expect(exportRoot("🎉")).toBe("onstage-export-store-assets");
    expect(zipFileName("")).toBe("onstage-export-store-assets.zip");
  });

  it("agree with each other for any name", () => {
    for (const name of [null, "", "Trailhead", "Pocket Ledger", "記帳"]) {
      expect(zipFileName(name)).toBe(`${exportRoot(name)}.zip`);
    }
  });
});

describe("FALLBACK_APP_NAME", () => {
  it("is the product's own neutral label, never the sample app's name", () => {
    expect(FALLBACK_APP_NAME).toBe("Onstage export");
  });

  it("slugs to the same folder as no name at all", () => {
    // The dialog shows the fallback when nothing names the app; the zip it
    // then produces must match the one a null name gives.
    expect(exportRoot(FALLBACK_APP_NAME)).toBe(exportRoot(null));
    expect(zipFileName(FALLBACK_APP_NAME)).toBe(zipFileName(null));
  });
});

describe("appIdentity (the store previews' icon and name)", () => {
  const ferry = { name: "Ferry", initial: "F", tint: "#3f6fa8" };

  it("an app named only by its record shows the record's name, letter and tint", () => {
    expect(appIdentity(undefined, ferry)).toEqual({ name: "Ferry", initial: "F", tint: "#3f6fa8" });
  });

  it("a name the set gives its app brings its own letter and the default tint — never the record's tile", () => {
    expect(appIdentity("Harbour Hopper", ferry)).toEqual({
      name: "Harbour Hopper",
      initial: "H",
      tint: DEFAULT_APP_TINT,
    });
  });

  it("the record's own name, given by the set too, keeps the record's tile", () => {
    expect(appIdentity(" Ferry ", ferry)).toEqual({ name: "Ferry", initial: "F", tint: "#3f6fa8" });
  });

  it("a blank or non-text set name counts as none", () => {
    expect(appIdentity("   ", ferry).name).toBe("Ferry");
    expect(appIdentity(42 as unknown as string, ferry).name).toBe("Ferry");
  });

  it("nothing naming the app: no name, the fallback's letter, the default tint", () => {
    expect(appIdentity(undefined, null)).toEqual({
      name: null,
      initial: FALLBACK_APP_NAME.charAt(0).toUpperCase(),
      tint: DEFAULT_APP_TINT,
    });
  });

  it("a name starting with an emoji keeps the whole emoji as its icon", () => {
    expect(appIdentity("🏔 Summit", ferry).initial).toBe("🏔");
    expect(appIdentity("🏔 Summit", null).initial).toBe("🏔");
  });

  it("a record without a letter or tint takes the name's letter and the default tint", () => {
    expect(appIdentity(undefined, { name: "lumen" })).toEqual({ name: "lumen", initial: "L", tint: DEFAULT_APP_TINT });
  });

  it("the default tint is the one a new app is given", () => {
    expect(DEFAULT_APP_TINT).toBe("#5d5294");
  });
});
