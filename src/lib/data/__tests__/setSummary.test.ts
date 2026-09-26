import { describe, expect, it } from "vitest";
import { BGS, bgCss } from "@/lib/onstage/data";
import { summarizeDoc } from "../setSummary";
import type { SetDoc } from "../types";
import { doc, frame } from "./helpers";

/**
 * What a set's library record says about its document (plan S2.2, GAP-10).
 * Pure: the backend writes exactly this on createSet and every saveSetDoc.
 */

const shot = (id: string) => `img:${id}`;

describe("summarizeDoc", () => {
  it("an empty document is a Draft with no frames, not 'Ready' (0 of 0 screenshots)", () => {
    expect(summarizeDoc(doc([]))).toEqual({
      frameCount: 0,
      // No first frame: the first background stands in, as bgCss does for any unknown id.
      swatch: BGS[0].css,
      swatches: [],
      status: "Draft",
      sub: "App Store · EN",
      store: "apple",
    });
  });

  it("is Ready only once every frame has a screenshot", () => {
    const all = doc([frame({ screenshot: shot("a") }), frame({ screenshot: shot("b") }), frame({ screenshot: shot("c") })]);
    expect(summarizeDoc(all).status).toBe("Ready");
    expect(summarizeDoc(all).frameCount).toBe(3);

    const partial = doc([frame({ screenshot: shot("a") }), frame({ screenshot: null }), frame({ screenshot: shot("c") })]);
    expect(summarizeDoc(partial).status).toBe("Draft");
    expect(summarizeDoc(partial).frameCount).toBe(3);

    const none = doc([frame(), frame()]);
    expect(summarizeDoc(none).status).toBe("Draft");
  });

  it("counts a legacy data: URL as a screenshot, but not an empty string or a value of the wrong type", () => {
    expect(summarizeDoc(doc([frame({ screenshot: "data:image/png;base64,AAAA" })])).status).toBe("Ready");
    expect(summarizeDoc(doc([frame({ screenshot: "" })])).status).toBe("Draft");
    const wrongType = doc([frame({ screenshot: 42 as unknown as string })]);
    expect(summarizeDoc(wrongType).status).toBe("Draft");
    const objectShot = doc([frame({ screenshot: { id: "a" } as unknown as string })]);
    expect(summarizeDoc(objectShot).status).toBe("Draft");
  });

  it("takes the swatch from the first frame and up to four swatches in frame order", () => {
    const d = doc(["moss", "dusk", "sun", "iris", "sea", "clay"].map((bg) => frame({ bg })));
    const s = summarizeDoc(d);
    expect(s.frameCount).toBe(6);
    expect(s.swatch).toBe(bgCss("moss"));
    expect(s.swatch).toBe("linear-gradient(155deg,#1b6f6a,#0f3a3d)");
    expect(s.swatches).toEqual([bgCss("moss"), bgCss("dusk"), bgCss("sun"), bgCss("iris")]);
  });

  it("an unknown background falls back to the first background rather than an empty swatch", () => {
    const s = summarizeDoc(doc([frame({ bg: "no-such-bg" }), frame({ bg: "ink" })]));
    expect(s.swatch).toBe(BGS[0].css);
    expect(s.swatches).toEqual([BGS[0].css, bgCss("ink")]);
  });

  it("names the store and the captions' language: App Store vs Google Play", () => {
    expect(summarizeDoc(doc([frame()], { store: "apple", lang: "EN" }))).toMatchObject({
      store: "apple",
      sub: "App Store · EN",
    });
    expect(summarizeDoc(doc([frame()], { store: "play", lang: "EN" }))).toMatchObject({
      store: "play",
      sub: "Google Play · EN",
    });
    // The captions' language, not the filmstrip's language chip.
    expect(summarizeDoc(doc([frame()], { store: "play", lang: "JA" })).sub).toBe("Google Play · EN");
    expect(summarizeDoc(doc([frame()], { store: "apple", lang: "de-DE" })).sub).toBe("App Store · EN");
  });

  it("a missing language reads as EN, and an unknown store as the App Store", () => {
    expect(summarizeDoc(doc([frame()], { lang: "" })).sub).toBe("App Store · EN");
    const legacy = { frames: [frame()] } as Pick<SetDoc, "frames" | "store" | "lang">;
    expect(summarizeDoc(legacy)).toMatchObject({ store: "apple", sub: "App Store · EN" });
    const odd = doc([frame()], { store: "windows" as unknown as SetDoc["store"] });
    expect(summarizeDoc(odd)).toMatchObject({ store: "apple", sub: "App Store · EN" });
  });

  it("a damaged document (frames not a list, null frames) summarises without throwing", () => {
    const notAList = { frames: { 0: frame({ screenshot: shot("a") }) }, store: "play", lang: "EN" } as unknown as SetDoc;
    expect(summarizeDoc(notAList)).toEqual({
      frameCount: 0,
      swatch: BGS[0].css,
      swatches: [],
      status: "Draft",
      sub: "Google Play · EN",
      store: "play",
    });

    const withNull = { ...doc([]), frames: [null, frame({ bg: "moss", screenshot: shot("b") })] } as unknown as SetDoc;
    const s = summarizeDoc(withNull);
    expect(s.frameCount).toBe(2);
    expect(s.status).toBe("Draft"); // the null frame has no screenshot
    expect(s.swatch).toBe(BGS[0].css);
    expect(s.swatches).toEqual([BGS[0].css, bgCss("moss")]);
  });
});
