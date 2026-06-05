"use client";

import ErrorState from "@/components/ErrorState";

export default function ProjectError(props: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  return (
    <ErrorState
      {...props}
      title="Couldn't load this project"
      description="Something went wrong loading this project's screenshots. Try again, or head back to your dashboard."
      homeHref="/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
