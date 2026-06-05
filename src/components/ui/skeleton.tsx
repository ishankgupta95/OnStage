import { cn } from "@/lib/utils";

// Placeholder block for loading states. The pulse is opacity-based (no motion),
// and is disabled under prefers-reduced-motion for the a11y pass.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
