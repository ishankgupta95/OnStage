import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Filmstrip } from "@/components/onstage/editor/Filmstrip";
import { openSet, useOnstage } from "@/store/onstage";

/**
 * GAP-12 (plan S3.3): a control that appears on hover must also appear on
 * keyboard focus, and must always be shown where there is no hover (touch) —
 * never an invisible control that a first tap sets off.
 *
 * The rules are checked as CSS text on purpose. jsdom applies no media
 * queries (there is no `(hover: none)` device to emulate) and its cascade
 * doesn't reliably recompute styles for `:hover` / `:focus-within`, so a
 * getComputedStyle test would pass or fail for jsdom's reasons, not the
 * stylesheet's. Reading the stylesheet itself is the honest check; the
 * Filmstrip test below pins the markup those rules rely on.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Rule = {
  /** The at-rule preludes around the rule, outermost first ("@media …"). */
  at: string[];
  selectors: string[];
  decls: Record<string, string>;
};

const squash = (v: string) => v.replace(/\s+/g, " ").trim();

/** Split on commas that aren't inside parentheses. */
function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const c of list) {
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) {
      out.push(squash(cur));
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(squash(cur));
  return out;
}

/**
 * A small parser for this one stylesheet: style rules with their selectors
 * and declarations, nested inside any at-rule blocks (@media, @layer,
 * @keyframes). Statements such as `@import "tailwindcss";` are skipped.
 */
function parseCss(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  let i = 0;

  const block = (at: string[]) => {
    let buf = "";
    while (i < src.length) {
      const c = src[i++];
      if (c === "}") return;
      if (c !== "{") {
        buf += c;
        continue;
      }
      // Anything up to the last `;` was a statement, not this rule's prelude.
      const prelude = squash(buf.slice(buf.lastIndexOf(";") + 1));
      buf = "";
      const nextOpen = src.indexOf("{", i);
      const nextClose = src.indexOf("}", i);
      if (nextOpen !== -1 && nextOpen < nextClose) {
        // A block of rules (@media, @layer, @keyframes…).
        block([...at, prelude]);
        continue;
      }
      const body = src.slice(i, nextClose);
      i = nextClose + 1;
      const decls: Record<string, string> = {};
      for (const d of body.split(";")) {
        const colon = d.indexOf(":");
        if (colon === -1) continue;
        decls[squash(d.slice(0, colon)).toLowerCase()] = squash(d.slice(colon + 1)).toLowerCase();
      }
      rules.push({ at, selectors: splitTop(prelude), decls });
    }
  };
  block([]);
  return rules;
}

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const rules = parseCss(css);

/** A selector that targets an element with the `reveal` class (not `hov-reveal`). */
const targetsReveal = (sel: string) => /\.reveal(?![\w-])/.test(sel);

/** The media query list of an `@media` prelude, one condition per entry. */
const mediaList = (prelude: string) =>
  splitTop(prelude.replace(/^@media\s+/i, "")).map((q) => q.replace(/\s+/g, "").toLowerCase());

describe("globals.css — hover-revealed controls (GAP-12)", () => {
  it("parses the stylesheet (sanity: the check below sees real rules)", () => {
    expect(rules.length).toBeGreaterThan(20);
    expect(rules.some((r) => r.selectors.includes(".hov-ink:hover"))).toBe(true);
    // A rule nested in @media is seen with its media prelude.
    expect(
      rules.some((r) => r.at.includes("@media (max-width: 899px)") && r.selectors.includes(".wide-only")),
    ).toBe(true);
  });

  it("shows .reveal on hover AND on keyboard focus inside its .hov-reveal container, over the inline opacity:0", () => {
    const shown = rules.filter(
      (r) =>
        r.at.length === 0 &&
        r.selectors.includes(".hov-reveal:hover .reveal") &&
        r.selectors.includes(".hov-reveal:focus-within .reveal"),
    );
    expect(shown).toHaveLength(1);
    // `!important`: the hidden state is an inline style (opacity:0), which a
    // normal stylesheet declaration can't override.
    expect(shown[0].decls.opacity).toBe("1 !important");
  });

  it("always shows .reveal where there is no hover or the pointer is coarse (touch)", () => {
    const touch = rules.filter(
      (r) => r.at.length === 1 && r.at[0].startsWith("@media") && r.selectors.includes(".hov-reveal .reveal"),
    );
    expect(touch).toHaveLength(1);
    // Either condition alone is enough (a comma is "or"): a touch-only
    // screen reports hover:none; a hybrid with a coarse pointer may not.
    const list = mediaList(touch[0].at[0]);
    expect(list).toContain("(hover:none)");
    expect(list).toContain("(pointer:coarse)");
    expect(touch[0].decls.opacity).toBe("1 !important");
  });

  it("no rule hides a .reveal control — on focus or otherwise — or makes it unclickable", () => {
    const aboutReveal = rules.filter((r) => r.selectors.some(targetsReveal));
    // Exactly the two rules above; nothing else styles .reveal.
    expect(aboutReveal).toHaveLength(2);
    for (const r of aboutReveal) {
      const where = `${r.at.join(" ")} ${r.selectors.join(", ")}`;
      expect(r.decls.opacity, where).toBe("1 !important");
      expect(r.decls.visibility, where).toBeUndefined();
      expect(r.decls.display, where).toBeUndefined();
      expect(r.decls["pointer-events"], where).toBeUndefined();
    }
    // In particular no focus selector (e.g. `.reveal:focus`) hides it again.
    const focusRules = aboutReveal.filter((r) => r.selectors.some((sel) => /:focus/.test(sel)));
    expect(focusRules.every((r) => r.decls.opacity === "1 !important")).toBe(true);
    expect(css).not.toMatch(/\.reveal(?![\w-])[^{}]*\{[^}]*opacity\s*:\s*0(?![.\d])/);
  });
});

/**
 * The Filmstrip's "Delete frame" button is the one control that rests at
 * opacity 0 until its thumbnail is hovered. It is shown on focus and on touch
 * only because it carries `reveal` inside a `hov-reveal` thumbnail — the
 * structure the rules above select — and it must be a real, tabbable button.
 */
describe("Filmstrip — the frame delete button follows the reveal contract", () => {
  let root: Root;
  let host: HTMLDivElement;
  let n = 0;

  beforeEach(async () => {
    // Autosave is debounced on setTimeout; keep it from firing after a test.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // A loaded document (an unknown id opens the default cut).
    await openSet(`reveal-${++n}`);
    useOnstage.setState({
      active: 0,
      sel: "device",
      pop: null,
      frames: useOnstage.getState().frames.map((f) => ({ ...f, screenshot: null })),
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const deletes = () =>
    [...host.querySelectorAll<HTMLElement>("[aria-label^='Delete frame']")];

  it("each delete is a <button> with class reveal inside its .hov-reveal thumbnail", async () => {
    const count = useOnstage.getState().frames.length;
    expect(count).toBeGreaterThan(1);
    await act(async () => root.render(createElement(Filmstrip)));

    const buttons = deletes();
    expect(buttons).toHaveLength(count);
    buttons.forEach((b, i) => {
      expect(b.tagName, `frame ${i + 1}`).toBe("BUTTON");
      expect(b.getAttribute("aria-label")).toBe(`Delete frame ${i + 1}`);
      expect(b.classList.contains("reveal"), `frame ${i + 1}`).toBe(true);
      // The container the CSS keys on is the frame's own thumbnail.
      const thumb = b.closest(".hov-reveal");
      expect(thumb, `frame ${i + 1}`).not.toBeNull();
      expect(thumb!.parentElement!.children[i]).toBe(thumb);
      expect(thumb!.textContent).toContain(String(i + 1).padStart(2, "0"));
      // Hidden at rest by an inline style — which is why the CSS needs !important.
      expect(b.style.opacity).toBe("0");
    });
    // Every reveal control in the strip has a hov-reveal container.
    for (const el of host.querySelectorAll(".reveal")) {
      expect(el.closest(".hov-reveal")).not.toBeNull();
    }
  });

  it("is reachable by keyboard: focusable, not taken out of the tab order, not hidden from assistive tech", async () => {
    await act(async () => root.render(createElement(Filmstrip)));
    for (const b of deletes() as HTMLButtonElement[]) {
      expect(b.tabIndex).toBe(0);
      expect(b.getAttribute("tabindex")).not.toBe("-1");
      expect(b.disabled).toBe(false);
      expect(b.getAttribute("aria-hidden")).toBeNull();
      expect(b.closest("[aria-hidden='true'], [inert]")).toBeNull();

      b.focus();
      expect(document.activeElement).toBe(b);
      // Focus inside the thumbnail is exactly what `.hov-reveal:focus-within`
      // selects (selector matching, which jsdom does do).
      expect(b.closest(".hov-reveal")!.matches(":focus-within")).toBe(true);
      b.blur();
    }
  });

  it("activating it deletes that frame (and only that one)", async () => {
    const before = useOnstage.getState().frames.map((f) => f.caption);
    await act(async () => root.render(createElement(Filmstrip)));

    const second = deletes()[1];
    second.focus();
    await act(async () => second.click());

    expect(useOnstage.getState().frames.map((f) => f.caption)).toEqual(before.filter((_, i) => i !== 1));
    expect(deletes()).toHaveLength(before.length - 1);
  });

  it("a single-frame set shows no delete button at all", async () => {
    useOnstage.setState({ frames: useOnstage.getState().frames.slice(0, 1) });
    await act(async () => root.render(createElement(Filmstrip)));
    expect(deletes()).toHaveLength(0);
    expect(host.querySelector(".reveal")).toBeNull();
  });
});
