import { Skeleton } from "@/components/ui/skeleton";

// Streamed while the project server component loads its screenshots.
// Mirrors project/[id]/page.tsx (portrait screenshot tiles in a 2/3/4-col grid).
export default function ProjectLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8">
      <Skeleton className="h-3 w-24" />

      <header className="mt-4 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="mt-2 h-9 w-64 sm:h-10" />
          <Skeleton className="mt-3 h-4 w-44" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-2.5">
            <Skeleton className="w-full rounded-xl" style={{ aspectRatio: "1290 / 2796" }} />
            <div className="flex items-center justify-between gap-1 px-0.5 pb-1 pt-2.5">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="mt-1.5 h-2 w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
