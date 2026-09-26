"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { s } from "@/lib/onstage/css";
import { Async, Shimmer } from "@/components/onstage/Async";
import { getBackend } from "@/lib/data/backend";
import { useQuery } from "@/lib/data/useQuery";
import { useOnstage } from "@/store/onstage";
import { BackButton } from "../chrome";

const PANEL =
  "padding:18px;border:1px solid rgba(var(--ink-rgb),.09);border-radius:14px;background:var(--surface)";

export function BrandScreen() {
  const router = useRouter();
  const applyBrandDefaults = useOnstage((st) => st.applyBrandDefaults);
  const kits = useQuery("brand-kits", () => getBackend().listBrandKits());
  const [kitId, setKitId] = useState("trailhead");
  const kit = kits.data?.find((k) => k.id === kitId) ?? kits.data?.[0];
  const [newKit, setNewKit] = useState("");
  const [font, setFont] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const fontInput = useRef<HTMLInputElement>(null);
  const iconInput = useRef<HTMLInputElement>(null);

  const addKit = async () => {
    const name = newKit.trim();
    if (!name) return;
    const created = await getBackend().createBrandKit(name);
    setNewKit("");
    setKitId(created.id);
    kits.refetch();
  };

  return (
    <div
      style={s(
        "min-height:var(--screen-h,100vh);background:var(--bg);color:var(--text)",
      )}
    >
      <div
        style={s(
          "display:flex;align-items:center;gap:14px;padding:13px 28px;border-bottom:1px solid rgba(var(--ink-rgb),.07);background:var(--chrome)",
        )}
      >
        <BackButton href="/dashboard" />
        <span
          style={s("font-size:14.5px;font-weight:500;letter-spacing:-.015em")}
        >
          Brand kits
        </span>
        <span
          style={s("font-size:11px;letter-spacing:.09em;color:var(--muted-4)")}
        >
          {kits.data ? `${kits.data.length} KITS` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            applyBrandDefaults();
            router.push("/editor");
          }}
          className="hov-accent"
          style={s(
            "margin-left:auto;display:inline-flex;align-items:center;height:32px;padding:0 13px;border:1px solid var(--accent);border-radius:8px;background:transparent;color:var(--accent);font-size:12.5px;font-weight:500;cursor:pointer",
          )}
        >
          Apply to {kit?.name ?? "this"} set
        </button>
      </div>

      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:28px 28px 60px;display:grid;grid-template-columns:212px minmax(0,1fr);gap:26px",
        )}
      >
        <div style={s("display:flex;flex-direction:column;gap:6px")}>
          <Async query={kits} skeleton={<Shimmer style="height:76px" />}>
            {(rows) =>
              rows.map((k) => {
                const on = kitId === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKitId(k.id)}
                    style={s(
                      `display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid ${
                        on ? "rgba(145,132,217,.4)" : "rgba(var(--ink-rgb),.09)"
                      };border-radius:8px;background:${
                        on ? "rgba(var(--accent-rgb),.08)" : "transparent"
                      };color:var(--text);font-size:13px;font-weight:500;cursor:pointer`,
                    )}
                  >
                    <span
                      style={s(
                        `width:14px;height:14px;border-radius:4px;background:${k.tint}`,
                      )}
                    />
                    <span style={s("flex:1;text-align:left")}>{k.name}</span>
                    <span style={s("font-size:11px;color:var(--muted-3)")}>
                      {k.setCount} SETS
                    </span>
                  </button>
                );
              })
            }
          </Async>
          <div
            style={s(
              "display:flex;gap:6px;padding:7px 8px;border:1px dashed rgba(var(--ink-rgb),.16);border-radius:8px",
            )}
          >
            <input
              value={newKit}
              onChange={(e) => setNewKit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addKit();
              }}
              placeholder="New kit"
              aria-label="New brand kit name"
              style={s(
                "flex:1;min-width:0;border:none;background:transparent;color:var(--text);font:400 12.5px 'Inter',sans-serif;outline:none",
              )}
            />
            <button
              type="button"
              onClick={() => void addKit()}
              disabled={!newKit.trim()}
              aria-label="Create brand kit"
              style={s(
                `border:none;background:transparent;color:var(--accent-hi);font-size:16px;line-height:1;cursor:pointer;padding:0 2px;opacity:${
                  newKit.trim() ? 1 : 0.4
                }`,
              )}
            >
              +
            </button>
          </div>
        </div>

        <div style={s("display:flex;flex-direction:column;gap:18px")}>
          <div style={s(PANEL)}>
            <div
              style={s(
                "display:flex;align-items:baseline;justify-content:space-between",
              )}
            >
              <h2
                style={s(
                  "margin:0;font-size:17px;font-weight:500;letter-spacing:-.02em",
                )}
              >
                Palette
              </h2>
              <span
                style={s(
                  "font-size:11px;letter-spacing:.09em;color:var(--muted-4)",
                )}
              >
                PULLED FROM YOUR APP ICON
              </span>
            </div>
            <div
              style={s("display:flex;gap:10px;margin-top:14px;flex-wrap:wrap")}
            >
              {(kit?.colors ?? []).map((c) => (
                <div key={c.role} style={s("width:104px")}>
                  <div
                    style={s(
                      `height:62px;border-radius:8px;background:${c.hex};border:1px solid rgba(var(--ink-rgb),.09)`,
                    )}
                  />
                  <div
                    style={s("margin-top:7px;font-size:12px;font-weight:500")}
                  >
                    {c.role}
                  </div>
                  <div
                    style={s(
                      "margin-top:1px;font-size:11px;letter-spacing:.04em;color:var(--muted-3)",
                    )}
                  >
                    {c.hex}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={s("display:grid;grid-template-columns:1fr 1fr;gap:18px")}>
            <div style={s(PANEL)}>
              <h2
                style={s(
                  "margin:0;font-size:17px;font-weight:500;letter-spacing:-.02em",
                )}
              >
                Type
              </h2>
              <div
                style={s(
                  "margin-top:14px;display:flex;flex-direction:column;gap:11px",
                )}
              >
                <div
                  style={s(
                    "padding:12px;border-radius:8px;background:var(--surface-2);border:1px solid rgba(var(--ink-rgb),.07)",
                  )}
                >
                  <div
                    style={s(
                      "font-size:11px;letter-spacing:.09em;color:var(--muted-3)",
                    )}
                  >
                    HEADLINE
                  </div>
                  <div
                    style={s(
                      "margin-top:5px;font-size:20px;font-weight:500;letter-spacing:-.025em",
                    )}
                  >
                    Every run, mapped
                  </div>
                  <div
                    style={s(
                      "margin-top:5px;font-size:11.5px;color:var(--muted-2)",
                    )}
                  >
                    Inter · 500 · −2.5% tracking
                  </div>
                </div>
                <div
                  style={s(
                    "padding:12px;border-radius:8px;background:var(--surface-2);border:1px solid rgba(var(--ink-rgb),.07)",
                  )}
                >
                  <div
                    style={s(
                      "font-size:11px;letter-spacing:.09em;color:var(--muted-3)",
                    )}
                  >
                    SUBHEAD
                  </div>
                  <div
                    style={s(
                      "margin-top:5px;font-size:13.5px;color:var(--text-2)",
                    )}
                  >
                    Pace, distance and elevation for every route
                  </div>
                  <div
                    style={s(
                      "margin-top:5px;font-size:11.5px;color:var(--muted-2)",
                    )}
                  >
                    Inter · 400
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fontInput.current?.click()}
                  className="hov-ink"
                  style={s(
                    "height:34px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:12.5px;cursor:pointer",
                  )}
                >
                  {font ? `Font: ${font}` : "Upload a font file"}
                </button>
                <input
                  ref={fontInput}
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setFont(file.name);
                    e.target.value = "";
                  }}
                  style={s("display:none")}
                />
              </div>
            </div>

            <div style={s(PANEL)}>
              <h2
                style={s(
                  "margin:0;font-size:17px;font-weight:500;letter-spacing:-.02em",
                )}
              >
                Defaults
              </h2>
              <div
                style={s(
                  "margin-top:14px;display:flex;flex-direction:column;gap:11px",
                )}
              >
                {(kit?.defaults ?? []).map((d) => (
                  <div
                    key={d.label}
                    style={s(
                      "display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:11px;border-bottom:1px solid rgba(var(--ink-rgb),.07)",
                    )}
                  >
                    <div style={s("min-width:0")}>
                      <div style={s("font-size:13px;font-weight:500")}>
                        {d.label}
                      </div>
                      <div
                        style={s(
                          "margin-top:2px;font-size:11.5px;color:var(--muted-2)",
                        )}
                      >
                        {d.sub}
                      </div>
                    </div>
                    <span
                      style={s(
                        "flex:none;white-space:nowrap;padding:4px 9px;border-radius:6px;border:1px solid rgba(var(--ink-rgb),.14);font-size:12px;color:var(--text)",
                      )}
                    >
                      {d.value}
                    </span>
                  </div>
                ))}
                <div style={s("display:flex;align-items:center;gap:10px")}>
                  <span
                    style={s(
                      `display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:${
                        kit?.tint ?? "#1b6f6a"
                      };color:#fff;font-size:16px;font-weight:600`,
                    )}
                  >
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={icon}
                        alt=""
                        style={s(
                          "width:100%;height:100%;border-radius:10px;object-fit:cover",
                        )}
                      />
                    ) : (
                      (kit?.name.charAt(0) ?? "—")
                    )}
                  </span>
                  <div>
                    <div style={s("font-size:13px;font-weight:500")}>
                      App icon
                    </div>
                    <div
                      style={s(
                        "margin-top:2px;font-size:11.5px;color:var(--muted-2)",
                      )}
                    >
                      Used on feature graphics
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => iconInput.current?.click()}
                    style={s(
                      "margin-left:auto;height:28px;padding:0 11px;border:1px solid rgba(var(--ink-rgb),.16);border-radius:8px;background:transparent;color:var(--text);font-size:12px;cursor:pointer",
                    )}
                  >
                    Replace
                  </button>
                  <input
                    ref={iconInput}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setIcon(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                      e.target.value = "";
                    }}
                    style={s("display:none")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
