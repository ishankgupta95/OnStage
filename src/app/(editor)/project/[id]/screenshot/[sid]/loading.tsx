import { Skeleton } from "@/components/ui/skeleton";

// Streamed while the editor server component loads the project's screenshots.
// Mirrors the Editor 3-pane shell (top bar, left/right sidebars, canvas, filmstrip).
export default function EditorLoading() {
  return (
    <div className="flex h-screen flex-col">
      {/* top bar */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-7 rounded-[7px]" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* left sidebar */}
        <aside className="hidden w-72 shrink-0 space-y-6 border-r p-4 md:block">
          {[3, 6, 8].map((n, s) => (
            <section key={s}>
              <Skeleton className="mb-2 h-2.5 w-20" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: n }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            </section>
          ))}
        </aside>

        {/* canvas */}
        <main className="relative flex flex-1 flex-col bg-muted/30">
          <div className="flex flex-1 items-center justify-center">
            <Skeleton className="h-[70%] max-h-[620px] w-auto rounded-2xl" style={{ aspectRatio: "1290 / 2796" }} />
          </div>
          {/* filmstrip */}
          <div className="flex items-center gap-2 border-t bg-card/40 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-8 rounded-md" />
            ))}
          </div>
        </main>

        {/* right sidebar */}
        <aside className="hidden w-80 shrink-0 space-y-6 border-l p-4 md:block">
          {[2, 4, 3].map((n, s) => (
            <section key={s}>
              <Skeleton className="mb-2.5 h-2.5 w-24" />
              <div className="space-y-2">
                {Array.from({ length: n }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
