import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localBackend } from "@/lib/data/local";
import { SET_DOCS_KEY } from "@/lib/data/migrateImages";
import { openSet, useOnstage } from "../onstage";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("autosave", () => {
  it("doesn't serialise anything on non-document state changes", async () => {
    await openSet("autosave-a");
    const stringify = vi.spyOn(JSON, "stringify");
    const save = vi.spyOn(localBackend, "saveSetDoc");

    const st = useOnstage.getState();
    st.setState({ zoom: 80 });
    st.setState({ sel: "bg", pop: "persp" });
    st.setState({ overlay: "export", exportDone: 3, exportTotal: 40 });
    st.setState({ exportDone: 4 });
    await vi.advanceTimersByTimeAsync(2000);

    expect(stringify).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(useOnstage.getState().saveState).toBe("saved");
  });

  it("saves a document edit once, after the debounce, and only then serialises", async () => {
    await openSet("autosave-b");
    const stringify = vi.spyOn(JSON, "stringify");
    const save = vi.spyOn(localBackend, "saveSetDoc");

    useOnstage.getState().patchFrame({ caption: "First" });
    useOnstage.getState().patchFrame({ caption: "First edit" });
    expect(useOnstage.getState().saveState).toBe("saving");
    expect(stringify).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toBe("autosave-b");
    expect(save.mock.calls[0][1].frames[0].caption).toBe("First edit");
    expect(stringify).toHaveBeenCalled();
    expect(useOnstage.getState().saveState).toBe("saved");
    const stored = JSON.parse(localStorage.getItem(SET_DOCS_KEY)!);
    expect(stored["autosave-b"].frames[0].caption).toBe("First edit");
  });
});
