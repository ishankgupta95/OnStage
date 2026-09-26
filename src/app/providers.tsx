"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { clearStaleAccountKeys } from "@/lib/data/local";
import { loadPrefs } from "@/store/onstage";
import { usePreventFileDrop } from "@/lib/onstage/usePreventFileDrop";

/**
 * The design is dark-first with an explicit switch in every header, so the
 * palette is a deliberate choice rather than an OS reading. next-themes stamps
 * `.light` on <html> before paint, which is what the token layer keys off.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  // After mount, so the server-rendered markup and the first client render
  // agree. No set is opened here: only the editor and guided screens open
  // one, by the id in their URL (plan D10).
  useEffect(() => {
    // Before the first read, so a stale "out" sentinel or export meter from
    // the account era can't reach getSession().
    clearStaleAccountKeys();
    // The work-mode preference, for every "open this set" link.
    void loadPrefs();
  }, []);
  // On every page: a file dropped outside a drop target stays in the app.
  usePreventFileDrop();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
