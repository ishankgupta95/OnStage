import { describe, expect, it } from "vitest";
import { formatUpdated } from "../when";

// Local-time fixtures, so "today" and "yesterday" hold in any time zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (t: number) => new Date(t).toISOString();

describe("formatUpdated", () => {
  const now = at(2026, 9, 26, 15, 30);

  it("reads a recent edit as minutes or hours ago", () => {
    expect(formatUpdated(iso(now - 20_000), now)).toBe("Just now");
    expect(formatUpdated(iso(now - 5 * 60_000), now)).toBe("5 min ago");
    expect(formatUpdated(iso(at(2026, 9, 26, 12, 10)), now)).toBe("3h ago");
  });

  it("reads yesterday's edit as Yesterday, however many hours ago it was", () => {
    expect(formatUpdated(iso(at(2026, 9, 25, 23, 50)), now)).toBe("Yesterday");
    expect(formatUpdated(iso(at(2026, 9, 25, 0, 5)), now)).toBe("Yesterday");
  });

  it("reads older edits as a date, with the year only when it isn't this one", () => {
    expect(formatUpdated(iso(at(2026, 3, 6)), now)).toBe("6 Mar");
    expect(formatUpdated(iso(at(2025, 12, 31)), now)).toBe("31 Dec 2025");
  });

  it("treats a timestamp from a clock that runs ahead as just now", () => {
    expect(formatUpdated(iso(now + 90_000), now)).toBe("Just now");
  });

  it("shows a stored display string as it is", () => {
    for (const v of ["2h ago", "Yesterday", "6 Mar", "Just now", ""]) expect(formatUpdated(v, now)).toBe(v);
  });
});
