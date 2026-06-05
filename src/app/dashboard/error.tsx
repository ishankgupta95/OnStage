"use client";

import ErrorState from "@/components/ErrorState";

export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  return (
    <ErrorState
      {...props}
      title="Couldn't load your dashboard"
      description="We hit a snag loading your projects. Try again — if it persists, the error has been logged."
      homeHref="/"
      homeLabel="Back to home"
    />
  );
}
