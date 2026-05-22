import { DEVICES } from "@/lib/devices";
import { PALETTES } from "@/lib/palettes";
import { LAYOUT_PRESETS } from "@/lib/schema";

export default function LeftSidebar() {
  return (
    <aside className="w-64 shrink-0 space-y-6 overflow-y-auto border-r p-4">
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Layout
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUT_PRESETS.slice(0, 8).map((preset) => (
            <button
              key={preset}
              className="rounded-md border p-2 text-left text-xs hover:bg-accent"
            >
              {preset}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Device
        </h3>
        <div className="space-y-1">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              className="block w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Palette
        </h3>
        <div className="space-y-2">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              className="flex w-full items-center gap-2 rounded-md border p-2 hover:bg-accent"
            >
              <span className="flex">
                {p.colors.map((c) => (
                  <span
                    key={c}
                    className="h-5 w-5 rounded-sm border first:rounded-l-md last:rounded-r-md"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="text-xs">{p.label}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
