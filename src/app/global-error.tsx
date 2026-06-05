"use client";

import "./globals.css";
import ErrorState from "@/components/ErrorState";

// Last-resort boundary: only shown if the root layout itself throws. It replaces
// the root layout, so it must render its own <html>/<body> and pull in globals.
export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-background font-sans text-foreground">
        <ErrorState {...props} fullScreen homeHref="/" homeLabel="Back to home" />
      </body>
    </html>
  );
}
