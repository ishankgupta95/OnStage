"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { editorMounted, editorUnmounted, setWorkMode, useOnstage } from "@/store/onstage";
import { FEATURES } from "@/lib/features";
import { s } from "@/lib/onstage/css";
import { setHref } from "@/lib/onstage/setLinks";
import { useSetRoute } from "@/lib/onstage/useSetRoute";
import { SetUnavailable } from "../SetUnavailable";
import { BrandMark, STORE_TABS, ThemeButton, storeTab } from "../chrome";
import {
  IcoExport,
  IcoEye,
  IcoGrid,
  IcoImage,
  IcoShield,
  IcoSparkle,
  IcoText,
  IcoUpload,
} from "../icons";
import { CanvasStage } from "./CanvasStage";
import {
  ContextBar,
  DevicePopover,
  FontPopover,
  PerspectivePopover,
} from "./ContextBar";
import { Filmstrip } from "./Filmstrip";
import { Inspector } from "./Inspector";
import { ExportOverlay } from "./ExportOverlay";
import { AiOverlay } from "./AiOverlay";
import { StoreOverlay } from "./StoreOverlay";
import { NarrowBlock } from "./NarrowBlock";
import { SaveBadge } from "./SaveBadge";

/**
 * ⌘Z / ⌘⇧Z over the canvas. The design's top bar has no undo buttons, so the
 * history is keyboard-only — zundo's `temporal` tracks the document slice,
 * and the store's undo/redo keep the selection on a frame that exists.
 */
function useUndoRedo(setId: string) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      // Nothing to undo in a set that hasn't loaded yet.
      if (useOnstage.getState().loadedSetId !== setId) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable)
        return;
      e.preventDefault();
      const st = useOnstage.getState();
      if (e.shiftKey) st.redo();
      else st.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setId]);
}

const modeTab = (on: boolean) =>
  `padding:5px 12px;border:none;border-radius:6px;background:${
    on ? "rgba(var(--accent-rgb),.14)" : "transparent"
  };color:${on ? "var(--accent-hi)" : "var(--muted-2)"};font-size:12.5px;font-weight:${
    on ? 600 : 400
  };cursor:pointer`;

/** Guided ⇄ Canvas, shared with the guided screen's top bar. `setId` is the
 *  set in the page's URL, which may still be loading (empty while the page
 *  is still finding which set to open — the other mode then finds it too). */
export function ModeSwitch({ mode, setId }: { mode: "guided" | "canvas"; setId: string }) {
  const router = useRouter();
  const go = (m: "guided" | "canvas") => {
    // The switch is the work-mode preference too (Settings says so). If it
    // can't be stored, this visit still switches.
    setWorkMode(m).catch((e: unknown) => console.warn("[onstage] couldn't store the work mode", e));
    router.push(setHref(m, setId));
  };
  return (
    <div
      style={s(
        "display:flex;gap:2px;padding:2px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:8px",
      )}
    >
      <button
        type="button"
        onClick={() => go("guided")}
        style={s(modeTab(mode === "guided"))}
      >
        Guided
      </button>
      <button
        type="button"
        onClick={() => go("canvas")}
        style={s(modeTab(mode === "canvas"))}
      >
        Canvas
      </button>
    </div>
  );
}

/** The tool rail. "AI captions" opens the AI drawer, which exists only with
 *  `FEATURES.aiAssist` (plan D3/D9). */
const TOOLS = [
  { id: "templates", label: "Templates", Icon: IcoGrid },
  { id: "screens", label: "Screens", Icon: IcoUpload },
  { id: "text", label: "Text", Icon: IcoText },
  { id: "bg", label: "Background", Icon: IcoImage },
  ...(FEATURES.aiAssist ? [{ id: "ai", label: "AI captions", Icon: IcoSparkle } as const] : []),
  { id: "brand", label: "Brand kit", Icon: IcoShield },
] as const;

export function EditorScreen() {
  const st = useOnstage();
  const router = useRouter();
  // The set in the URL, opened by id (a bare /editor first finds the last
  // one). Until it has loaded, the canvas shows no frames: anything on
  // screen before then is a placeholder, and an edit to it would be lost.
  const route = useSetRoute("canvas");
  const setId = route.setId ?? "";
  useUndoRedo(setId);
  // Dialogs belong to this visit: leaving closes them (GAP-16). Screens
  // that send the person here with a dialog open say so with `?apply=`.
  useEffect(() => {
    editorMounted();
    return editorUnmounted;
  }, []);
  const loaded =
    route.setId !== null &&
    st.loadedSetId === route.setId &&
    (route.status === "ready" || route.status === "checking");

  const toolActive = (id: string) =>
    (id === "bg" && st.sel === "bg") ||
    (id === "text" && st.sel === "caption") ||
    (id === "screens" && st.sel === "device");

  const onTool = (id: string) => {
    // Every tool acts on the set, so none does anything until it has loaded
    // (Templates and Brand kit would otherwise send their result to whatever
    // set was loaded before).
    if (!loaded) return;
    if (id === "ai") st.setState({ overlay: "ai" });
    else if (id === "templates") router.push("/templates");
    else if (id === "brand") router.push("/brand");
    else if (id === "bg") st.setState({ sel: "bg", pop: null });
    else if (id === "text") st.setState({ sel: "caption", pop: null });
    else st.setState({ sel: "device", pop: null });
  };

  if (route.status === "missing" || route.status === "error") {
    return <SetUnavailable status={route.status} error={route.error} retry={route.retry} />;
  }

  return (
    <>
      <NarrowBlock />
      <div className="wide-only">
        <div
          style={s(
            "height:var(--screen-h,100vh);min-height:760px;display:flex;flex-direction:column;background:var(--bg);color:var(--text);overflow:hidden",
          )}
        >
          {/* ── top bar ─────────────────────────────────────────────────── */}
          <div
            style={s(
              "height:52px;flex:none;display:flex;align-items:center;gap:14px;padding:0 14px;background:var(--chrome);border-bottom:1px solid rgba(var(--ink-rgb),.08)",
            )}
          >
            <Link
              href="/dashboard"
              style={s(
                "display:flex;align-items:center;gap:9px;cursor:pointer;padding-right:6px;color:var(--text)",
              )}
            >
              <BrandMark withNib font={15} weight={700} tracking="-.02em" />
            </Link>
            <div
              style={s(
                "width:1px;height:22px;background:rgba(var(--ink-rgb),.1)",
              )}
            />
            <div
              style={s("display:flex;align-items:center;gap:8px;min-width:0")}
            >
              <span
                style={s(
                  "font-size:13.5px;font-weight:500;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
                )}
              >
                {route.set?.name}
              </span>
              <SaveBadge />
            </div>
            <div
              style={s(`${STORE_TABS};margin-left:8px`)}
            >
              <button
                type="button"
                disabled={!loaded}
                onClick={() => st.setStore("apple")}
                style={s(storeTab(st.store === "apple"))}
              >
                App Store
              </button>
              <button
                type="button"
                disabled={!loaded}
                onClick={() => st.setStore("play")}
                style={s(storeTab(st.store === "play"))}
              >
                Play Store
              </button>
            </div>

            <div
              style={s(
                "margin-left:auto;display:flex;align-items:center;gap:8px",
              )}
            >
              <ModeSwitch mode="canvas" setId={setId} />
              <ThemeButton radius={6} />
              <div
                style={s(
                  "display:flex;align-items:center;gap:6px;padding:0 4px 0 8px;height:30px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:6px",
                )}
              >
                <span
                  style={s(
                    "font:400 11px 'Inter',ui-sans-serif;color:var(--muted)",
                  )}
                >
                  {st.zoom}%
                </span>
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={st.zoomOut}
                  style={s(
                    "display:grid;place-items:center;width:20px;height:22px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:15px;line-height:1",
                  )}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={st.zoomIn}
                  style={s(
                    "display:grid;place-items:center;width:20px;height:22px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:15px;line-height:1",
                  )}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => st.setState({ overlay: "store" })}
                style={s(
                  "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.11);border-radius:6px;background:transparent;color:var(--text);font-size:12.5px;font-weight:500;cursor:pointer",
                )}
              >
                <IcoEye size={14} />
                Store preview
              </button>
              <button
                type="button"
                onClick={() => st.setState({ overlay: "export" })}
                style={s(
                  "display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 13px;border:1px solid var(--accent);border-radius:6px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer",
                )}
              >
                <IcoExport size={14} />
                Export
              </button>
            </div>
          </div>

          {/* ── canvas + inspector ──────────────────────────────────────── */}
          <div style={s("flex:1;display:flex;min-height:0;position:relative")}>
            <div
              style={s(
                "position:absolute;top:16px;left:14px;z-index:30;display:flex;flex-direction:column;gap:4px;padding:6px;border-radius:8px;background:var(--pop);border:1px solid rgba(var(--ink-rgb),.09);box-shadow:0 12px 34px rgba(0,0,0,.5);backdrop-filter:blur(14px)",
              )}
            >
              {TOOLS.map(({ id, label, Icon }) => {
                const on = toolActive(id);
                return (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => onTool(id)}
                    style={s(
                      `display:grid;place-items:center;width:34px;height:34px;border:none;border-radius:6px;cursor:pointer;background:${
                        on ? "rgba(var(--accent-rgb),.14)" : "transparent"
                      };color:${on ? "var(--accent)" : "var(--muted)"}`,
                    )}
                  >
                    <span
                      style={s(
                        "width:17px;height:17px;display:grid;place-items:center",
                      )}
                    >
                      <Icon size={14} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              style={s(
                "flex:1;min-width:0;position:relative;overflow:hidden;background:var(--bg)",
              )}
            >
              <div
                style={s(
                  "position:absolute;inset:0;background-image:radial-gradient(rgba(var(--ink-rgb),.075) 1px, transparent 1px);background-size:26px 26px",
                )}
              />
              <div
                style={s(
                  "position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 0%, rgba(var(--accent-rgb),.07), transparent 60%)",
                )}
              />

              {loaded && (
                <>
                  <CanvasStage />
                  <ContextBar />
                  {st.pop === "persp" && <PerspectivePopover />}
                  {st.pop === "device" && <DevicePopover />}
                  {st.pop === "font" && <FontPopover />}
                  <Filmstrip />
                </>
              )}
            </div>

            {loaded && st.sel && <Inspector />}
          </div>

          {loaded && st.overlay === "export" && <ExportOverlay />}
          {FEATURES.aiAssist && loaded && st.overlay === "ai" && <AiOverlay />}
          {loaded && st.overlay === "store" && <StoreOverlay />}
        </div>
      </div>
    </>
  );
}
