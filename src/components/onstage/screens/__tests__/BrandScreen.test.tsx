import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/brand",
  useSearchParams: () => new URLSearchParams(),
}));

import { localBackend } from "@/lib/data/local";
import { BrandScreen } from "../BrandScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeEach(async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<BrandScreen />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

async function typeAndCreate(name: string) {
  const input = host.querySelector<HTMLInputElement>('input[aria-label="New brand kit name"]')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, name);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    host.querySelector<HTMLButtonElement>('button[aria-label="Create brand kit"]')!.click();
  });
  await act(() => new Promise((r) => setTimeout(r, 10)));
  return input;
}

describe("BrandScreen — creating a kit", () => {
  it("shows why when the browser refuses, and keeps the name", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("refused", "QuotaExceededError");
    });
    const input = await typeAndCreate("Night");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Couldn't create the kit — This browser's storage is full.",
    );
    expect(input.value).toBe("Night");
    vi.restoreAllMocks();
    expect(localStorage.getItem("onstage:brand-kits:v1")).toBeNull();
  });

  it("creates the kit when storage works", async () => {
    const create = vi.spyOn(localBackend, "createBrandKit");
    const input = await typeAndCreate("Night");
    expect(create).toHaveBeenCalledWith("Night");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(input.value).toBe("");
    expect(JSON.parse(localStorage.getItem("onstage:brand-kits:v1")!)[0].name).toBe("Night");
  });
});
