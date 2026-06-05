"use client";

import ErrorState from "@/components/ErrorState";

export default function RootError(props: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  return <ErrorState {...props} homeHref="/" homeLabel="Back to home" />;
}
