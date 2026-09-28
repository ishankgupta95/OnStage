# Fixes

One line per item: item — what changed — files.

## Batch 1: undo and saving

- A3 — Undo records a step only when screenshot content changes (selection, the save badge and the internal mirror sync no longer add steps or wipe redo), and a slider drag or typing burst is one step (500 ms idle ends a burst) — `src/store/editor.ts`, `src/lib/history.ts`
- A2 — Undo/redo keep the set of screenshots following the filmstrip (undo no longer drops a just-added screenshot or revives a deleted one), clear a selection whose layer the undo removed, and clamp the selected device slot; an edit to a missing screenshot does nothing — `src/store/editor.ts`, `src/lib/history.ts`, `src/components/editor/Canvas.tsx`
- A6 — Pending edits are written as soon as the tab is hidden, closed or the editor is left (a synchronous write that survives unload, then the normal save); "Saved" shows only when nothing newer is waiting; the failure toast no longer blames the connection — `src/components/editor/Editor.tsx`, `src/lib/localData.ts`
- A1 (related) — Ask the browser to keep this site's storage rather than evict it (skipped on Firefox, which would prompt) — `src/lib/localData.ts`
- B5 (related) — Crop sliders and drag-to-pan target the device family the canvas draws, so they keep working after switching e.g. iPhone → Pixel — `src/components/editor/RightSidebar.tsx`, `src/components/editor/Canvas.tsx`
- Tests — `npm test` runs Node's built-in test runner (Vitest couldn't be installed: npm 11 crashes resolving its optional-peer chain) — `package.json`, `scripts/test-resolve.mjs`, `src/lib/history.test.ts`, `src/store/editor.test.ts`

## Batch 2: export correctness

- B6 — At export sizes whose proportions differ from the design (iPad, Play tablet), a caption that fit the design is kept on the canvas and a device it didn't touch is shrunk (aspect kept, ≤3% gap) to sit clear of it; phone screenshots in a tablet frame are letterboxed instead of cover-cropped unless you set a tablet crop; the export dialog says so. The editor canvas is unchanged — `src/lib/layout.ts`, `src/lib/sizes.ts`, `src/components/editor/ScreenshotContent.tsx`, `src/components/editor/ExportController.tsx`, `src/components/editor/ExportDialog.tsx`
- B8 — Loads the weights the weight picker offers but weren't loaded (Fraunces 800, JetBrains Mono 600); an export whose fonts can't load now fails with "Couldn't load the X font…" instead of silently using a fallback — `src/app/layout.tsx`, `src/components/editor/ExportController.tsx`
- B10 — A set holds at most 10 screenshots (App Store limit; add/duplicate explain why they refuse); Google Play sizes export only the first 8; the export dialog's PNG counts and a one-line note reflect the limits — `src/lib/sizes.ts`, `src/lib/localData.ts`, `src/components/editor/Filmstrip.tsx`, `src/components/editor/ScreenshotGrid.tsx`, `src/app/project/page.tsx`, `src/components/editor/ExportDialog.tsx`, `src/components/editor/ExportController.tsx`
- Export (related) — "All screenshots" exports use each screenshot's live doc, not the last-saved one, so edits made in the last 1.5 s are included — `src/components/editor/ExportController.tsx`

## Batch 3: export robustness (B9)

- B9 lazy 3D load — A failed load of the 3D renderer is no longer cached, so "Export" again (or reopening the editor) retries; the export error says to check the connection — `src/components/editor/device3d/loader.ts`, `src/components/editor/DeviceFrame3D.tsx`
- B9 render cache — Cached full-size 3D renders are dropped and the GPU buffer shrunk after every export — `src/components/editor/device3d/renderDevice.ts`, `src/components/editor/device3d/loader.ts`, `src/components/editor/ExportController.tsx`
- B9 double render — The export layer draws at 1× and its canvas is read directly (no screen-pixel-ratio draw followed by a second 1× render; no hit-canvas draws) — `src/components/editor/ExportController.tsx`
- B9 context loss — A lost WebGL context is replaced with a fresh renderer; if a device still can't be drawn the export fails with a clear message instead of writing a PNG without it (the editor falls back to the flat frame) — `src/components/editor/device3d/renderDevice.ts`, `src/components/editor/device3d/loader.ts`, `src/components/editor/DeviceFrame3D.tsx`, `src/components/editor/ExportController.tsx`
- B9 texture — The 3D screen texture matches the rendered device width (1024–2048 px) instead of a fixed 1024 px — `src/components/editor/device3d/renderDevice.ts`
- B9 cancel — "Cancel" in the export dialog's progress row stops a running export at its next step; a new export can start straight away — `src/store/editor.ts`, `src/components/editor/ExportController.tsx`, `src/components/editor/ExportDialog.tsx`
- B9 not present on master (skipped): leaked stages, "Done" re-running the export, RGBA feature graphic

## Batch 4: honest copy

- C1 — Landing page, metadata and FAQ: "24 frames" → the 8 frames the picker offers; "8 store slots / 8 sizes" → 13 (11 Apple, 2 Play), both now read from the data; "free tier / paid plans / free to start · no card" → free, no account, no watermark, no limit; "version history" and team claims → projects live in one browser, share via project file — `src/app/page.tsx`
- C1 — Terms no longer mention plans or a watermark — `src/app/terms/page.tsx`
- C4 — Privacy placeholder no longer describes the old hosted version (uploads, Stripe, Supabase, Vercel); it says what happens: browser-only storage, delete removes it, GitHub Pages hosting, Google Fonts/Fontshare requests — `src/app/privacy/page.tsx`
- C2, C3 — Not present on master (no sample data posing as yours, no fake-feature entry points); nothing changed

## D1: templates

- D1 — Four new templates built from what the renderer draws: Editorial (Fraunces headlines + Inter subheading layer), Angled Hero (Inter 800 with the 3D angle alternating right/left/subtle), Stat & Proof (200 px stat, testimonial, bullet feature list, CTA), Dev Tool (JetBrains Mono on the dark grid pattern). Screens can now set font/weight, a subcaption layer, size, alignment and 3D angle; a template can bring its own background (the form previews it). "Panoramic Story" renamed "Wide Frames" (nothing joined its screens into one story) — `src/lib/templates.ts`, `src/components/project/NewProjectForm.tsx`, `src/lib/templates.test.ts`

## D2: feature gaps

- D2 custom backgrounds — A "Custom" swatch ends the Solid row (any colour, via the browser's colour picker); a "Custom gradient" row with start/end pickers; an "Image" button that fills the canvas with an uploaded picture (cover). New background kinds `custom-gradient` and `image` are additive, so saved projects load unchanged; export and thumbnails render them — `src/lib/editorDoc.ts`, `src/components/editor/LeftSidebar.tsx`, `src/components/editor/ScreenshotContent.tsx`, `src/components/editor/Canvas.tsx`, `src/components/editor/ExportController.tsx`, `src/lib/templates.ts`
- D2 devices — iPhone 17 Pro and Pixel 10 added (same frame shapes as 16 Pro / Pixel 9) and made the picker's iPhone and Pixel entries, the new-project platform devices and the export's family representatives; a project saved with an older model that shares a frame keeps showing that model in the picker — `src/lib/schema.ts`, `src/lib/deviceGeometry.ts`, `src/lib/devices.ts`, `src/lib/templates.ts`, `src/lib/editorDoc.ts`, `src/components/editor/LeftSidebar.tsx`, `src/lib/devices.test.ts`
- D2 project files — "Import project" next to "New project" on the dashboard, and a download icon beside each project's delete icon (master has no ··· menu, so it sits with the existing hover action). The file is JSON with the images inline; import validates it (clear messages for wrong/newer/damaged files) and always creates a new project — `src/lib/localData.ts`, `src/app/dashboard/page.tsx`, `src/lib/localData.test.ts`
- D2 per-locale captions — A language dropdown above the caption textarea (26 App Store/Play languages; ✓ marks ones this caption has) edits that language's caption; the canvas shows the chosen language, falling back to the default text. The export dialog lists languages that have translations, all ticked, and writes one top-level folder per language (`default/…`, `de-DE/…`); exports without translations keep today's paths. Stored as an optional `translations` map on each text layer (additive) — `src/lib/locales.ts`, `src/lib/editorDoc.ts`, `src/store/editor.ts`, `src/components/editor/RightSidebar.tsx`, `src/components/editor/Canvas.tsx`, `src/components/editor/ExportDialog.tsx`, `src/components/editor/ExportController.tsx`, `src/lib/locales.test.ts`

## Follow-ups found during the work

- Editor layout — With 8+ screenshots on a narrow window the filmstrip pushed the right sidebar off-screen; the canvas column can now shrink (the filmstrip scrolls instead) — `src/components/editor/Editor.tsx`
- Project delete — Deleting a project takes two clicks: the first arms a red "Delete?" button, the second deletes; it disarms after 4 s — `src/app/dashboard/page.tsx`
- Share — The editor's "Share" button copied a link that only works in the same browser; it's now "Copy link" and the toast says so and points to project files for sharing — `src/components/editor/TopBar.tsx`
- "Demo" — Removed the dashboard's "Demo" badge and "demo" wording on the not-found pages — `src/app/dashboard/page.tsx`, `src/app/project/page.tsx`, `src/app/editor/page.tsx`
- Side-by-side layouts (Callout L/R, Features, Stat; portrait) — Redesigned as "peek": a larger phone (70% of the width) bleeds off the side, the stat's off the side and bottom, leaving a wide caption column that never runs under it; templates size side captions to fit the column (up to 88 px, the stat up to 220 px as a big number). Existing projects keep their captions where they were saved; only the phone moves, clear of them — `src/lib/layout.ts`, `src/lib/templates.ts`, `src/lib/layout.test.ts`, `src/lib/templates.test.ts`
