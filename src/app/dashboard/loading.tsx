import { Skeleton } from "@/components/ui/skeleton";

// Streamed while the dashboard server component reads cookies + projects.
// Mirrors dashboard/page.tsx so content swaps in without layout shift.
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:py-14">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="size-9 rounded-[9px]" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="hidden h-4 w-40 sm:block" />
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </header>

      <section className="mt-10 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Skeleton className="h-9 w-48 sm:h-10" />
          <Skeleton className="mt-3 h-3 w-40" />
        </div>
        <Skeleton className="h-9 w-full rounded-md sm:w-72" />
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="relative aspect-[4/3] border-b border-border bg-muted/40">
              <div className="bp-grid absolute inset-0 opacity-50" />
            </div>
            <div className="flex items-start justify-between gap-2 p-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-2.5 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
