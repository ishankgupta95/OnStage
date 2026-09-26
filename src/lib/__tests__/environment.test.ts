import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("runs in a DOM with IndexedDB available", () => {
    expect(typeof window).not.toBe("undefined");
    expect(typeof indexedDB).not.toBe("undefined");
    expect(typeof indexedDB.open).toBe("function");
  });

  it("clears localStorage before each test (1/2: write)", () => {
    localStorage.setItem("onstage:test:v1", "x");
    expect(localStorage.getItem("onstage:test:v1")).toBe("x");
  });

  it("clears localStorage before each test (2/2: read)", () => {
    expect(localStorage.getItem("onstage:test:v1")).toBeNull();
  });
});
