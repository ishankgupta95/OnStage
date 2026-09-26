import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The theme provider is next-themes' concern, not this test's.
vi.mock("next-themes", () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.resetModules();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** A fresh page: the root providers from a fresh module graph, and its store. */
async function boot() {
  const { default: Providers } = await import("../providers");
  const store = await import("@/store/onstage");
  const links = await import("@/lib/onstage/setLinks");
  await act(async () =>
    root.render(
      <Providers>
        <span>page</span>
      </Providers>,
    ),
  );
  // Let the preference read land.
  await act(async () => new Promise((r) => setTimeout(r, 0)));
  return { ...store, ...links };
}

/** A cancelable drag event carrying files, dispatched from inside the page. */
function fileDrag(type: "dragover" | "drop") {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "dataTransfer", { value: { types: ["Files"], dropEffect: "copy" } });
  document.body.dispatchEvent(e);
  return e;
}

describe("Providers — what every page gets at boot (S3.2)", () => {
  it("reads the work-mode preference into the store, so set links open where the person works", async () => {
    localStorage.setItem("onstage:prefs:v1", JSON.stringify({ workMode: "guided", defaultStore: "apple" }));
    const { useOnstage, openSetHref } = await boot();
    expect(useOnstage.getState().workMode).toBe("guided");
    expect(openSetHref("x")).toBe("/guided?set=x");
    expect(host.textContent).toBe("page");
  });

  it("keeps a file dropped outside any drop target from taking the tab away — until the app unmounts", async () => {
    await boot();
    expect(fileDrag("dragover").defaultPrevented).toBe(true);
    expect(fileDrag("drop").defaultPrevented).toBe(true);
    act(() => root.unmount());
    root = createRoot(host);
    expect(fileDrag("dragover").defaultPrevented).toBe(false);
    expect(fileDrag("drop").defaultPrevented).toBe(false);
  });
});
