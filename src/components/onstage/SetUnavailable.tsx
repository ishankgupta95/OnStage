"use client";

import ErrorState from "@/components/ErrorState";
import { NotFoundScreen } from "./screens/NotFoundScreen";

/**
 * What the editor and guided screens show instead of a set they can't open
 * (plan S2.1): an id this browser's library doesn't list, or a library that
 * couldn't be read. Null when there is nothing to report.
 */
export function SetUnavailable({
  status,
  error,
  retry,
}: {
  status: string;
  error: string | null;
  retry: () => void;
}) {
  if (status === "missing") {
    return (
      <NotFoundScreen
        kicker="SET NOT FOUND"
        title="This set isn't in this browser"
        body="It was deleted, or it was made in another browser — Onstage keeps each set in the browser that made it."
        settingsLink={false}
      />
    );
  }
  if (status === "error") {
    const reason = error ?? "Something went wrong.";
    return (
      <ErrorState
        error={new Error(reason)}
        reset={retry}
        title="Couldn't open a set"
        description={reason}
        homeHref="/dashboard"
        homeLabel="Back to your apps"
        fullScreen
      />
    );
  }
  return null;
}
