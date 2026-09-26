# Onstage — Plan

> **What this is.** The single source of truth for the work in front of us: every verified defect from the Sept 2026 audit, the template redesign, and the missing features, sequenced into phases with acceptance criteria.
> **Status:** Phase 0 complete (2026-09-26); Phase 1 not started. Last rewritten 2026-09-26 (replaces the May 2026 SaaS plan, which no longer matches the product).
> **Audit report (visual, filterable):** https://claude.ai/artifact/5vMzRaDH6BQhFo8YfT2mHU
> **Template spec:** [`docs/templates-v2-spec.md`](docs/templates-v2-spec.md) + mockup data [`docs/templates-v2-examples.json`](docs/templates-v2-examples.json)

---

## 0. The product today

Onstage is a **free, browser-only App Store / Google Play screenshot generator** for indie developers. No account, no server, no watermark. It deploys as a static export to GitHub Pages. You drop app screenshots into 3D-tilted device frames on gradient backgrounds, add captions, and export every store size as exact-dimension PNGs in a zip.

**What is genuinely good:** the Three.js device tilt (pitch, yaw, depth, scale), panorama slicing, and the exact-size PNG export with a decode-and-assert dimension gate. `tsc`, ESLint and the static export build are all clean. Three.js, Konva and JSZip stay in lazy chunks.

**What the audit found (2026-09-26, 27 agents, every finding adversarially verified):**
- **101 distinct defects** — 3 critical, 30 high, 45 medium, 23 low. 36 of them are UI that claims something the code doesn't do.
- **7 of 47 user-facing features fully work.** The device picker, AI captions, localisation, store upload, A/B test, jobs queue and store-URL import are UI over fixtures.
- **Templates are shallow:** a template is `{bg, ty, panoramic}` — one of 9 diagonal gradients, one yaw, a panorama flag. 12 templates share 9 backgrounds and Blueprint applies exactly what Cold Open does. Names promise effects ("grid lines", "split colour blocks", "serif captions") that are never rendered.

**Market position (23 competitors reviewed):** only AppMockUp Studio is also free, account-free and unwatermarked, and it is known for stale frames and few templates. Localisation, clean exports and 3D are paywalled almost everywhere else. The opening: *the best free, private, local-first tool* — which requires the core to be trustworthy first.

---

## 1. Ground rules (hard constraints — every step must respect these)

1. **Free, local, no account.** No server exists. Anything needing one (OAuth, store upload, scraping store listings, server-side AI) stays gated behind `src/lib/features.ts`.
2. **Gate, never delete.** Account-shaped and fixture-backed surfaces are *built and gated* — keep every screen, component, `Backend` method, type and fixture. Gated routes keep their `page.tsx` and render `<NotFoundScreen />`. Gate at the call site or return an empty value; never shrink the `Backend` interface (adding methods is fine); never gate by throwing; conditionally **mount** gated hook clusters, never early-return above hooks. Every new flag gets an env var in `.env.local.example`, a comment in `.github/workflows/deploy.yml`, a row in the CLAUDE.md flag table, and removal from `sitemap.ts` + a `disallow` in `robots.ts` for its routes.
3. **Static export.** No redirects, rewrites, headers or middleware. Client routing by query string (`useSearchParams`) is fine — `EditorScreen` already reads `?set=`. Read `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` before touching routing (every `useSearchParams` reader sits under a `<Suspense>` boundary). Next.js 16: check `node_modules/next/dist/docs/` before any Next-specific code.
4. **Canvas ↔ export parity.** What the editor shows is what the PNG contains. Any layout number or logic used by both renderers comes from one shared module, never two copies.
5. **Heavy renderers stay lazy.** `three`, `konva`, `jszip` are reachable only via dynamic `import()` inside `src/lib/onstage/export/`.
6. **Pixel-exact output.** `renderSet` keeps decoding every PNG and asserting its dimensions.
7. **Style conventions.** Screens use the mockup's `style="…"` strings through `s()` in `src/lib/onstage/css.ts` — don't translate to Tailwind or camelCase objects. Chrome colours come from Nocturne tokens in `globals.css`; **artwork** (anything inside a device frame, backgrounds, captions) uses fixed colours and must look identical in both themes and the PNG.
8. **All data through `getBackend()`.** No screen imports `sample.ts`. New persistence = new `Backend` methods with a local implementation and a `SUPABASE SEAM` comment.
9. **The design handoff is the spec for chrome** — except where this plan explicitly supersedes it: template artwork, the default set and the template gallery/detail cards (D5), and WCAG AA contrast fixes to chrome tokens (S6.2), which change token values in `globals.css` only, never the style strings.
10. **Saved user data is sacred.** Every document change is additive with a legacy default, migrations are idempotent and never destroy the only copy of anything, and old docs keep opening.
11. **Never `git commit` or `git push`.** The owner reviews and commits.

---

## 2. Decisions (defaults — the owner can change any of these before a phase starts)

| # | Decision | Why |
|---|---|---|
| D1 | **Screenshot bytes move to IndexedDB** as Blobs under random ids; frames store a short ref `img:<id>`. localStorage keeps only small JSON docs. Images are deleted only by `deleteSet` (reference-checked) or an explicit "clear all data". | Data URLs in one localStorage key overflow the ~5 MB quota with a normal set and the save then drops every screenshot (EDITOR-4). |
| D2 | **The Trailhead sample becomes seeded data**: written once on first run under its existing ids (`trailhead` / `trailhead-69`) as a normal app + set the user can rename or delete, and never re-seeded. `listApps`/`listSets` stop prepending fixtures. | Today every dashboard row except one is fixture data that can't be opened or deleted; keeping the ids keeps existing users' saved work attached. |
| D3 | **Fixture-only surfaces are gated behind new flags, all off:** `storeUpload` (store destinations, Settings → Store connections, Reconnect, "Push live"), `aiAssist` (AI drawer), `abTest` (`/ab-test`, variant cards), `jobQueue` (`/queue`, Uploads and Activity), `storeImport` (store-URL import), `designBoards` (`/states`, `/mobile`). | Honesty: each shows invented data or can never succeed without a server. Gating (not deleting) keeps them for the day a backend exists. |
| D4 | **Localisation becomes real and local**: per-frame, per-locale caption overrides edited in the canvas; CSV import/export (plus `.xcstrings` / `strings.xml`). No machine translation in core. Until it ships, the export offers only locales that have captions. | Today non-EN folders contain English for any user-written caption (EDITOR-6). |
| D5 | **Templates v2** per `docs/templates-v2-spec.md`, in four template phases T1–T4. The new default set is Ridgeline in Trailhead's brand kit. This **supersedes the handoff mockup** for template artwork, the default set and the template gallery/detail cards. | Owner rejected the current templates; the audit shows why. |
| D6 | **Fonts stay on the Google Fonts `<link>`**, not `next/font`. | Konva/Canvas2D need the real family names (`ctx.font = "700 40px Inter"`); `next/font` renames families. Fix the README instead (PLATFORM-4). |
| D7 | **Add Play "Tablet 10″" export slot (1600×2560, folder `TABLET_10`)**. | The landing page already promises it (EXPORT-21), and it is a standard Play size. |
| D8 | **Tests:** Vitest in a `jsdom` environment with `fake-indexeddb` for pure modules, the store and the local backend. Playwright parity tests arrive with templates T2 in their own workflow. | There are no tests today; the fixes below touch data integrity. |
| D9 | **No server-side AI.** A later, optional bring-your-own-key AI (S10.8) un-gates `aiAssist`. | Keeps the tool free to run. |
| D10 | **One entry point per document.** Only the editor and guided screens open a set (`openSet`), always by id. Every other screen that produces a document (template "Use this set", onboarding "Pick a look", brand "Apply") creates or targets a set explicitly and navigates to `/editor?set=<id>`. | Today the root layout opens the default set on every route and template/brand screens mutate whichever set happens to be in memory. |

---

## 3. How to work this plan

- Work **phases in order**, and steps within a phase in order. Each step lists the finding IDs it closes; the full text of every finding (problem, evidence, fix) is in **Appendix A**, grouped by step.
- **The step text wins.** An Appendix A "Fix" line is the auditor's suggestion. Where it differs from the step, follow the step; superseded fix lines point to their step.
- **Line numbers are from 2026-09-26.** Re-locate by symbol before editing; trust the code over this document, and note any finding that turns out already fixed or wrong.
- After each step: tick its box in §4 and its findings in Appendix A, and add a one-line entry to the Log (§7).
- **After every step:** `npm run verify` (from S0.1 on; before that `npx tsc --noEmit && npm run lint -- --max-warnings 0`).
- **After every phase:**
  1. Build the Pages export: `NEXT_PUBLIC_STATIC_EXPORT=true NEXT_PUBLIC_BASE_PATH=/OnStage npx next build`. It writes the site to `out/`. Next 16 builds `next dev` into `.next/dev`, so this is safe while dev runs. **Do not set `ONSTAGE_BUILD_DIST_DIR`** — under `output: 'export'` it moves the site out of `out/`.
  2. Serve it at its basePath: `rm -rf /tmp/onstage-pages && mkdir -p /tmp/onstage-pages && cp -R out /tmp/onstage-pages/OnStage && python3 -m http.server 4173 -d /tmp/onstage-pages`, then open http://localhost:4173/OnStage/ (a `.claude/launch.json` entry running this is fine).
  3. Exercise the phase's "Verify" flows there, plus the golden path (dashboard → open a set → drop real screenshots → reload → edit → export), and open the exported PNGs to compare them with the canvas.
- **Stop at the end of each phase** and report: what changed, what was verified and how, anything deferred or found wrong. Do not start the next phase until the owner says so.

---

## 4. Progress

| Phase | Theme | Steps | Status |
|---|---|---|---|
| 0 | Baseline, tests & flags | S0.1–S0.3 | ☑ |
| 1 | Stop data loss & corruption | S1.1–S1.4 | ☐ |
| 2 | Real apps & sets | S2.1–S2.3 | ☐ |
| 3 | Honesty pass | S3.1–S3.5 | ☐ |
| 4 | Rendering parity & export correctness | S4.1–S4.6 | ☐ |
| 5 | Templates v2 — T1 (5 templates, new default) | S5.1–S5.6 (incl. S5.2b) | ☐ |
| 6 | Accessibility & editor UX | S6.1–S6.4 | ☐ |
| 7 | Templates v2 — T2 (resolver + shared painter, 6 templates) | S7.1–S7.4 | ☐ |
| 8 | Templates v2 — T3 (multi-source + strip) | S8.1–S8.3 | ☐ |
| 9 | Localisation + Templates v2 — T4 | S9.1–S9.3 | ☐ |
| 10 | Feature roadmap | S10.1–S10.10 | ☐ |

---

## 5. Phases

### Phase 0 — Baseline, tests & flags

**S0.1 · Test harness** ☑
- Add dev dependencies `vitest`, `jsdom`, `fake-indexeddb`. `vitest.config.ts`: `environment: 'jsdom'`, `setupFiles: ['fake-indexeddb/auto', <setup that runs localStorage.clear() in beforeEach>]`, and the `@/` alias. Tests live next to code in `__tests__/`.
- Scripts: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"verify": "npm run typecheck && npm run lint -- --max-warnings 0 && npm test"`. Add `npm test` to `.github/workflows/deploy.yml` after lint.
- **Done when:** `npm run verify` passes with one test asserting `typeof window !== 'undefined'` and that `indexedDB` exists.

**S0.2 · Baseline record** ☑
- Build and serve the export (§3), run the golden path, and record the current behaviour in the Log (§7) so regressions are obvious.

**S0.3 · Define the new flags (D3)** ☑
- Add `storeUpload`, `aiAssist`, `abTest`, `jobQueue`, `storeImport`, `designBoards` to `FEATURES` in `src/lib/features.ts` (same `NEXT_PUBLIC_FEATURE_*` pattern, all off), plus `.env.local.example`, the `deploy.yml` comment and the CLAUDE.md flag table. Nothing is gated yet; S3.1 applies them, and earlier steps may already use them.
- **Done when:** the flags exist and `npm run verify` passes.

---

### Phase 1 — Stop data loss & corruption

**S1.1 · Screenshots to IndexedDB (D1)** ☐ — fixes EDITOR-4 (critical), EDITOR-5, GAP-18
- Add to the `Backend` interface (additive): `putImage(blob: Blob): Promise<string>`, `getImage(id: string): Promise<Blob | null>`, `deleteImages(ids: string[]): Promise<void>`. Local implementation in a new `src/lib/data/imageStore.ts` using IndexedDB (database `onstage`, stores `images` and `backups`), with a `SUPABASE SEAM` comment (Storage bucket).
- `putImage` returns a fresh random id (`crypto.randomUUID()`), **never a content hash**. `SetFrame.screenshot` holds `img:<id>` (type stays `string | null`). No downscaling on import.
- Images are deleted in exactly two places: `deleteSet` (S2.2) and a future "Clear all Onstage data". Never in `removeFrame`, `setScreenshots` or on undo — undo can bring a ref back.
- A `useImageUrl(ref)` hook resolves refs to object URLs through a ref-counted cache that revokes URLs on release; `data:` refs pass through unchanged. `CanvasDevice`, Filmstrip, Guided and every thumbnail use it. `loadExportImage` resolves `img:` refs via `getBackend().getImage` and passes `data:` refs through.
- `DropZone`/`readImageFiles` store the `File` Blob directly (no `readAsDataURL`).
- **Migration (first boot with this step):** before rewriting anything, copy the raw value of `onstage:set-docs:v1` into the IndexedDB `backups` store. Then, for every doc (not just the open one) and every `data:` screenshot: decode to a Blob, `putImage`, read it back with `getImage` to verify, and only then replace the ref. If any put or verify fails, leave that doc's data URLs untouched and log it. Idempotent.
- Delete the screenshot-stripping fallback in `saveSetDoc` (it rewrites every frame with `screenshot: null` on quota errors): a failed save rejects and leaves stored data unchanged (S1.4 surfaces it).
- Autosave (EDITOR-5): the subscription compares the partialized doc fields by reference (the same check as zundo's `equality`) and calls `JSON.stringify` only inside the debounced flush.
- localStorage keys are already namespaced `onstage:*:v1`; keep new keys in that scheme. The IndexedDB database name is `onstage` (GAP-18: the github.io origin is shared with the owner's other Pages sites).
- **Tests:** image round-trip; migration converts data URLs and a second run is a no-op; an IndexedDB failure mid-migration leaves the stored doc byte-identical; autosave doesn't stringify on non-doc state changes.
- **Verify:** drop 8 full-size PNGs (≥1 MB each), reload → all still there; the localStorage doc stays under ~50 KB; the export includes them.

**S1.2 · Undo/redo and history correctness** ☐ — fixes EDITOR-1 (critical), EDITOR-2, EDITOR-12, EDITOR-24
- After undo/redo, clamp `active` into range (wrap `undo`/`redo` in store actions). `patchFrame` must no-op if `frames[active]` is undefined — never create a partial frame.
- One gesture = one history entry: `temporal.getState().pause()` on pointerdown and `resume()` on pointerup for the tilt pad, depth slider and scale; debounce history for typing via zundo's `handleSet`.
- `removeFrame(index)`: if `index < active` → `active - 1`; if `index === active` → `min(active, len - 1)`.
- Autosave flushes the pending debounced save on `pagehide` and `visibilitychange → hidden`; a write sequence number makes the badge show SAVED only when the latest edit is stored.
- **Tests:** add frame → undo → edit leaves no malformed frame; one drag = one entry; removing a frame before the selection keeps the same frame selected.

**S1.3 · `openSet` correctness (D10)** ☐ — fixes DATA-4 (and the load-sequencing half of SCREENSB-1)
- Remove `openSet()` from `src/app/providers.tsx` (keep `clearStaleAccountKeys()`). Only `EditorScreen` and `GuidedScreen` open a set; both read `?set=` (GuidedScreen gets the same `<Suspense>` wrapper in `src/app/guided/page.tsx`) and call `openSet(id)`.
- Export `defaultDoc(): SetDoc` from `src/store/onstage.ts` (today's `initialFrames` and defaults); S2.2 and S5.4 reuse it. When a set has no saved doc, `openSet` resets to `defaultDoc()` — never keeps the previous set's frames.
- Sequence loads with a request token so only the latest `openSet` call applies; flush the previous set's pending save before switching.
- **Tests:** `openSet('B')` then `openSet('A')` before either resolves leaves A loaded and B's stored doc unchanged; opening a set with no doc shows the default and leaves other sets untouched.

**S1.4 · Surface storage failures** ☐ — fixes DATA-5
- Every mutating `Backend` method in `local.ts` rejects with a user-readable message on write failure instead of swallowing it. `SaveBadge` distinguishes saving / saved / "Couldn't save — <reason>". Ungated callers show errors through the existing `useQuery`/`<Async>` patterns.
- **Verify:** monkeypatch `localStorage.setItem` to throw in devtools → a visible error, no silent revert, stored data unchanged.

---

### Phase 2 — Real apps & sets (D2, D10)

**S2.1 · Route by id** ☐ — fixes SCREENSB-1 (critical; also DATA-1, EDITOR-13)
- Every "open set" control pushes `/editor?set=<id>` (or `/guided?set=<id>` when the work-mode preference is guided). `ProjectScreen` reads `?app=<id>` with `useSearchParams` under `<Suspense>` instead of `const APP_ID = "trailhead"`.
- Remember the last opened set in `onstage:last-set:v1`. Bare `/editor` or `/guided` opens that id if it still exists in `listSets()`, otherwise the newest set, otherwise creates one with `createSet` and opens it. Never fall back to a hardcoded `DEFAULT_SET_ID`.
- An unknown `?set=` renders an in-page "This set isn't in this browser" state linking to `/dashboard`, and does not call `openSet` (so nothing is autosaved).
- No screen outside the editor or guided mutates the document store. Templates "Use this set", onboarding "Pick a look" and similar flows call `createSet` with the resulting document and push `/editor?set=<newId>`. Brand "Apply to set" pushes `/editor?set=<currentId>&apply=brand:<kitId>`; `EditorScreen` applies it after `openSet` resolves, as one undo entry.
- ProjectScreen's Sets tab lists `getBackend().listSets(appId)` (name, frame count, updatedAt, swatch) with Open / Rename / Duplicate / Delete. The fixture variant cards (live pill, Push live) mount only under `FEATURES.abTest`; Activity and Uploads only under `FEATURES.jobQueue`.
- **Verify:** two sets with different content open to different documents from the dashboard and the project page, survive reload, and a template applied from the gallery lands in a new set without touching the others.

**S2.2 · Create, rename, delete, seed** ☐ — fixes DATA-3, GAP-10, GAP-11
- Wire the existing `createApp`/`createSet`/`renameSet`/`deleteSet` into the dashboard and project page ("New app", "New set", inline rename, delete with an in-page confirm — `confirm()` is not used). New sets start from `defaultDoc()`.
- `deleteSet` removes the doc and the library record, and deletes each of its image ids **only if no other stored doc references it** (scan every ref field: `screenshot`, and later `screenshotTablet`/`screenshotB`). This makes the privacy page's "deleting a set removes it from this browser" true.
- **Seeding (D2):** guarded by `onstage:seeded:v1`. Write the app `{id:'trailhead', …}` and set `{id:'trailhead-69', appId:'trailhead', …}` with the fixture ids, so an existing doc at `onstage:set-docs:v1['trailhead-69']` stays attached. Never overwrite an existing doc and don't create one (openSet's default fills it). Set the marker even if the user later deletes the sample, so it is never re-seeded. Seeding runs in a helper called before the first list read; if its write fails, the list methods return the in-memory seed and do not reject. Then remove the fixture prepend in `listApps`/`listSets`.
- `saveSetDoc` updates the set's library record: `frameCount`, `updatedAt`, `swatch` (frame 0 background), derived `status`.
- **Tests:** a pre-existing `trailhead-69` doc is listed and opens unchanged after seeding; create → save → list shows the updated count; deleting a set removes its unshared images and keeps images shared with another set.

**S2.3 · Derived numbers on the dashboard and project board** ☐ — fixes SCREENSB-2, SCREENSB-7, DATA-2, GAP-8, GAP-9
- Replace hardcoded strings ("Three apps · 6 sets · last export 2 days ago", "APPLE 2 OF 2 · GOOGLE 2 OF 3", the permanent "Google will reject" alert) with values derived from real records, or remove them.
- "Required sizes" becomes per set: rows come from `EXPORT_SLOTS` for the selected set's `store`; a row is Ready when the set has ≥1 frame with a screenshot for that slot class. The screen stops calling `listSizeRows` (the Backend method stays).
- Row actions do what they say: Open → that set; Duplicate → a new additive `duplicateSet` backend method that copies the doc and **keeps the same image refs** (safe because of the reference check in `deleteSet`); "Push live" mounts only under `FEATURES.storeUpload`.
- The Locales tab derives from real per-locale captions; until Phase 9 it shows only the source locale.
- **Tests:** duplicate, then delete the original → the copy's images still resolve.

---

### Phase 3 — Honesty pass

**S3.1 · Gate fixture-only surfaces (D3)** ☐ — fixes EDITOR-14, SCREENSB-3, SCREENSB-4, GAP-4, GAP-16, GAP-17, EDITOR-7, SCREENSB-8, SCREENSB-10
- Apply the S0.3 flags per rule 2: `/ab-test`, `/queue`, `/states`, `/mobile` render `<NotFoundScreen />` when off; every link or button to them is hidden at the call site; sitemap/robots updated.
- Export destinations collapse to "Download zip" while `storeUpload` is off; Settings → Store connections and the Reconnect path (GAP-16) go with it.
- The AI drawer mounts only under `aiAssist`; no ungated control triggers `rewriteAllCaptions`.
- Store-URL import (onboarding, guided) mounts only under `storeImport`.
- `/store-preview` "Listing checks": remove the panel and its "PASS / FLAGS" pill now; S10.5 brings back computed checks.
- NotificationsPanel (behind `accounts`): persist toggles through a new additive backend method so they don't revert.

**S3.2 · Remove fabricated numbers and static copy** ☐ — fixes SCREENSA-1, SCREENSA-2, GAP-15, SCREENSA-8, EDITOR-16, EDITOR-23, GAP-2, GAP-14, GAP-6
- "240 sets/templates" → the real count everywhere (TemplatesScreen, LandingScreen, OnboardingScreen, MobileScreen), read from the template list (`TEMPLATES.length` now; S5.1 switches it to `GALLERY_TEMPLATES.length`). Delete "USED BY 1,840 sets"; the template detail page's facts (type, fits, caption position, palette) are derived from the template data.
- Guided flow's "Export 40 files / 16.8 MB" and the export dialog's file tree, warnings and "Missing frames" badge are computed from the actual selection (`EXPORT_SLOTS` × frames × locales).
- Inspector sample text that looks like user data → real values or neutral placeholders.
- Landing hero: change "Drop a screen onto the phone below" to "Open the canvas and drop your screens"; the hero keeps its local tilt/background demo. Add a page-level `dragover`/`drop` `preventDefault` so a dropped file never navigates away.
- Inspector/landing references to an on-canvas tilt handle: change the copy; fix the landing demo's inverted drag direction.
- Settings: move `workMode` out of `SetDoc` into a global preference `onstage:prefs:v1` (old docs keep the field, unread); set-opening links route to `/guided?set=` when it is "guided". Remove the Interface language and Units rows; "Default store target" writes the default `store` for new sets.

**S3.3 · Flows do what they say** ☐ — fixes SCREENSA-4, SCREENSA-5, SCREENSA-6, SCREENSA-7, SCREENSA-9, SCREENSA-10, GAP-1, GAP-5, GAP-7, GAP-12, SCREENSB-9, and the interim half of EDITOR-6
- Define `MAX_FRAMES = { apple: 10, play: 8 }` in `src/lib/onstage/export/slots.ts` (S4.5 builds on it).
- Onboarding: "Pick a look" creates a set with the chosen template (D10). Remove the decorative screenshot-picker step and the "Import a zip instead" link (zip import arrives with S10.1).
- Guided flow shows the user's own screenshots, lists the files actually dropped, and can reach every frame.
- A multi-file drop creates frames as needed up to `MAX_FRAMES[store]` instead of silently dropping extras; guided never exports frames it didn't show.
- Keep the App Store / Play toggle; it sets the default export picks (Apple: 6.9″ + 6.5″; Play: Phone + Feature graphic) and the store preview.
- Export defaults: EN only. Until Phase 9, locale chips offer only locales that have captions (interim fix for EDITOR-6).
- Template cards: the card body navigates to `/templates/<slug>`; "Use this set" is a visible button on the card and the detail page, using the create-and-open flow (D10). Hover-only controls (frame delete etc.) are visible on touch and keyboard focus, and never act on a first tap of an invisible control.
- DropZone validates type, size and minimum dimensions and shows why a file was rejected.

**S3.4 · Stop leaking the sample brand into user output** ☐ — fixes EXPORT-20, EXPORT-7, EXPORT-5
- Add optional `SetDoc.appName`, wired into `readDoc`, `partialize` and `equality` in the same change. Resolve it as `doc.appName ?? <app name via the set's appId> ?? 'Onstage export'`; the editor top-bar title edits it. The zip name, dialog title and upload app id derive from it — no more `trailhead-store-assets.zip`.
- The Play feature graphic uses the set's own frame-0 background, caption font and `appName`, keeps content inside Play's safe zone, and never says "Trailhead" unless that is the app.
- A screenshot that fails to decode stops the export with an error naming the frame — never a silent swap to the sample screen.

**S3.5 · Platform & SEO quick fixes** ☐ — fixes PLATFORM-1, PLATFORM-3, PLATFORM-4, PLATFORM-5, PLATFORM-6, RUN-1, EDITOR-27
- `metadataBase` from `NEXT_PUBLIC_SITE_URL` with the production fallback `https://ishankgupta95.github.io/OnStage` (not `localhost`); set the env var in `deploy.yml`. Confirm `og:image` in the exported HTML.
- Per-route `title`/`description` and a canonical URL for public routes.
- Sitemap entries use trailing slashes to match `trailingSlash: true`.
- Fonts: keep the existing preconnect hints and the `<link>` (D6); correct the README's `next/font` claim.
- Remove stale comments in `next.config.ts` (`routes.ts`, `localData.ts` don't exist) and unreferenced `public/` assets (grep each first).
- `s()` in `css.ts`: don't split on `;` inside parentheses or quotes; add a unit test.

---

### Phase 4 — Rendering parity & export correctness

This phase builds the foundation Templates v2 T1 needs (spec §8.1–8.2). It deliberately changes how existing docs render (fixing the parity bugs); S4.6 then freezes that result as the "classic" baseline.

**S4.1 · One source for layout numbers + shared line breaking** ☐ — fixes HYGIENE-001, EDITOR-9, EXPORT-24
- New `src/lib/onstage/layout/constants.ts` (artboard 268×580, device 176×374, caption factor 0.62, depth factor 0.35, perspective…) imported by canvas and export. One sample-screen data source (removes the `BARS`/`ROWS` duplication).
- New pure `layout/breakLines.ts` (balanced, orphan-free, `maxLines`, injected `measure`). Both renderers call it with a measure at **design size** — unrounded font px on the 268 grid, via one offscreen 2D context — and lines are computed once per frame and slot, never at zoom. The canvas renders the resolved lines with `white-space: pre`; export feeds the same lines to Konva with `wrap: 'none'`. Manual line breaks behave identically.
- **Tests:** identical lines for both renderers' inputs; manual `\n` preserved.

**S4.2 · Canvas lays out at design size** ☐ — fixes EDITOR-10, EXPORT-12, EXPORT-13, RUN-2
- Each artboard renders at 268×580 inside one `transform: scale(zoom/100)`, so perspective, radii, shadows and depth scale together (spec §8.1). Don't also multiply individual properties by zoom.
- CSS applies depth after rotation (`translate3d(0,0,lift) rotateX() rotateY()`), matching Three's camera-space lift; the Three side stays as is.
- Remove the unconditional bevel `box-shadow`; the shadow toggle controls one shadow in both renderers, and the export shadow follows scale and tilt.
- The first artboard's SELECTED tag must not sit under the tool rail at default zoom.
- **Verify:** at 44%, 72% and 110% zoom, a tilted frame's silhouette matches the exported PNG (overlay check).

**S4.3 · Device choice and aspect-aware layout** ☐ — fixes EDITOR-3, EXPORT-1, EXPORT-4
- The device picker offers phone-class devices plus "No frame". The canvas draws that device's geometry (island, punch-hole, frameless) from `geometry.ts`, and phone slots export the same geometry. iPad and Android-tablet geometry is used only for tablet slots, automatically; the picker says so ("Tablets use iPad / Android tablet frames automatically").
- Per-slot layout: text and device positioned from the slot's own aspect (a fixed caption box; the device fits the remaining area and never covers the headline) instead of scaling by width only. Implement it as the classic branch of a new `src/lib/onstage/layout/phase1.ts` (`layoutPhase1(doc, i, slot, measure)`), which both `CanvasStage` and `renderSet` call; S5.2b adds the template branch.
- Tablet screenshots: add optional `SetFrame.screenshotTablet` (an `img:` ref), wired into `readDoc`/`partialize`/`equality`, the `deleteSet` reference scan and spec §3. The Inspector gets a second "Tablet screen (optional)" drop target. Without one, tablet slots letterbox the phone screenshot inside the tablet screen (no cover-crop), and the export dialog shows "N frames use the phone screenshot on tablet".
- **Verify:** export one set to all slots; no headline overlap on Play phone, 7″/10″ tablets or iPad; the canvas device matches the phone PNGs.

**S4.4 · Export pipeline robustness** ☐ — fixes EXPORT-10, EXPORT-11, EXPORT-14, EXPORT-15, EXPORT-16, EXPORT-17, EXPORT-18, EXPORT-22, EXPORT-23, EXPORT-28, EDITOR-15, PLATFORM-2
- Fonts: create `src/lib/onstage/templates/fonts.ts` with `ensureFonts(specs)` (preload every family/weight/style the frames use, `document.fonts.check()` each, stop with a named error on failure); S5.1 extends it with `FONT_REGISTRY`. Update the layout `<link>` to the exact eager URL in spec §5 (adds Fraunces 700 and the weights templates need).
- Screen texture sized to the on-artboard screen pixels, clamped 1024–4096.
- Render each Konva stage once at `pixelRatio: 1`; destroy stages in `finally`; clear or bound the render cache after export and never key it by data URLs.
- Keep materials alive across frames within one export; dispose at the end.
- Handle WebGL context loss (re-create the renderer or fail clearly); fail clearly if WebGL is unavailable.
- Failed lazy loads are not cached forever — "Try again" retries the import.
- Cancellation: a Cancel button sets `signal.cancelled`; partial results are discarded cleanly.
- "Download instead" only offers files from the current render; "Done — download ready" downloads, it doesn't re-run the export.
- The Play feature graphic is written as 24-bit PNG (no alpha).

**S4.5 · Store rules and slots** ☐ — fixes EDITOR-19, EXPORT-27, EXPORT-21
- The Add button is disabled at 10 frames and explains why. When Play slots are picked and there are more than 8 frames, the export dialog warns and exports only frames 1–8 to Play folders. Frames are never removed on load or on a store switch.
- Switch `exportPicks` from array indices to slot ids (`folder`; the feature graphic gets `id: 'FEATURE'`). The export dialog derives its rows from `EXPORT_SLOTS` (no second copy of labels and sizes). Append the Play `TABLET_10` slot (D7).
- **Tests:** a saved doc with old index-based `exportPicks` migrates to ids; an 11-frame doc loads with all 11 frames.

**S4.6 · Classic baseline** ☐
- Write golden JSON snapshots of `layoutPhase1`'s output for fixture docs (default; with screenshots; panorama on; `device: 'none'`) × every `EXPORT_SLOTS` entry — caption lines, font px, caption box, device cx/cy/w/h/pose — to `src/lib/onstage/layout/__tests__/classic.golden.json`, with a test that compares against it. Wherever spec §8.1/§8.3 says "today's layout" for `classic`, it means this baseline.

---

### Phase 5 — Templates v2, T1 (spec "Phase 1")

Read `docs/templates-v2-spec.md` §0–§8 first. T1 ships five templates (Ridgeline, Headliner, Field Notes, Signal, Gallery), the new default set and sample screens, on the Phase 4 foundation — no new drawing primitives.

**S5.1 · Model, catalog, fonts** ☐ — spec §3, §5, §8.2 (Phase 1 table)
- `src/lib/onstage/templates/model.ts` (types), `catalog.ts` (all 12 definitions with `since` and `phase1` cuts), and `FONT_REGISTRY` added to the S4.4 `fonts.ts`.
- `data.ts`: `TEMPLATES` derived from the catalog (keep `{slug, name, tagline, tags}`); export `GALLERY_TEMPLATES` (`since ≤ 1`) and use its length for every UI count. Raw `linear-gradient(` strings pass through `bgCss`; per-frame ink replaces `capInk`/`LIGHT_BGS`/`LIGHT_TEMPLATES` and the landing `name === 'Field Notes'` check; add the `Rise` tilt preset and the `white` frame finish.
- Slugs: `generateStaticParams` emits the shipped slugs plus the alias slugs (ember → headliner, cold-open → index, moss → ridgeline, sunbelt → signal, iris → nocturne, harbour → gallery, clay → duo, bone → field-notes). An alias page renders its target with `alternates.canonical` pointing at the new slug. Alias and unshipped slugs are left out of `sitemap.ts`; unshipped templates get no page yet.

**S5.2 · Document schema + migration** ☐ — spec §8.3
- Optional fields on `SetFrame` (`ink`, `x`, `top`, `sample`) and `SetDoc` (`schema`, `template`, `captionStyle`) — `appName` already exists from S3.4. New `src/lib/data/migrate.ts` (`migrateSetDoc`), called in `loadSetDoc` and before the spread in `openSet`. Docs without `template` render as `classic`, **identical to the S4.6 baseline**.
- `readDoc`, zundo `partialize` and `equality` gain the new doc fields in the same change.
- **Tests:** fixture docs match `classic.golden.json` after migration; migration is idempotent.

**S5.2b · Phase-1 layout and renderer parameters** ☐ — spec §8.2 Phase-1 table
- `layoutPhase1` gains the template branch: it honours `frame.x`, `frame.top`, `frame.ink` and `doc.captionStyle` (weight, case, tracking, lineHeight, maxLines), returning `{lines, fontPx, captionBox, ink, bgSlice, device {cx, top, w}}`. `CanvasStage` and `renderSet` both render from it; neither keeps its own layout maths.
- Add `plainCaption(s)` (removes unescaped `*`, turns `\*` into `*`): the canvas, `breakLines` measure, `renderSet` text and `localise()` all use plain text until S7.1's painter renders emphasis.
- `geometry.ts`: `FRAME_FINISH.white {0xEDEDEA, .35}`; the FRAMELESS aspect comes from the slot's screen aspect. `device.tsx` gets frameless and white variants. `gradient.ts` throws on `to <side>`, `turn` and `rad`; a catalog lint test runs every template gradient through it. The ContextBar font picker lists `FONT_REGISTRY` families.
- **Tests:** `layoutPhase1` honours x/top/ink/captionStyle; classic output still matches the golden; `plainCaption('Every run, *mapped*')` → "Every run, mapped"; a white-finish export differs from graphite.

**S5.3 · Applying templates** ☐ — fixes SCREENSA-3 (also EDITOR-18)
- `applyTemplate(slug)` writes the template's phase-1 cut per frame via its sequence, keeps captions, screenshots and sample ids, records `template` on the doc, and restores `device` when leaving a frameless template. It is called only inside the editor or on a new doc before `createSet` (D10). `addFrame` follows the template's `extend` cycle. New `resetFrameToTemplate(i)`. `applyBrandDefaults` recolours the cut from the brand kit instead of forcing −17°.
- Scale clamp widens to 0.6–1.6. Zoom opens at "fit".

**S5.4 · New default set + sample screens** ☐ — fixes GAP-13; spec §6, §7
- `defaultDoc()` becomes the Ridgeline cut in Trailhead's kit (captions, sub-lines, kicker, tilts, positions per spec §6). Existing saved docs are untouched (they stay classic).
- `src/lib/onstage/sample/paintSample.ts`: the five light sample screens (map, pace, nearby, share, season) plus `today` for classic docs — one painter for canvas and export. Delete `PhoneScreenUI`; `export/sampleScreen.ts` re-exports. A hover chip "Sample screen · drop yours" (never exported); the export dialog warns when frames still show the sample.
- Add the spec §6 DE/ES/JA strings to `CAPTION_LOCALES`, keyed by the new marked captions. **Keep the existing keys** so saved classic docs still localise.
- **Tests:** old and new English keys both localise.

**S5.5 · Gallery, detail, landing, store preview** ☐ — fixes EDITOR-17 (and completes GAP-15)
- New `ArtboardThumb` built on `layoutPhase1` + the sample painter; used by the Templates gallery (a mock App Store search row of the first 3 frames), the template detail strip, the landing strip and the store preview overlay (which also honours the App Store/Play toggle, panorama and the user's screenshots).
- Rebuild the card visuals on `ArtboardThumb` (the apply behaviour was already fixed in S3.3).

**S5.6 · T1 verification** ☐
- Apply each T1 template to a new set with real screenshots; export all slots; compare canvas vs PNG for every frame; check light/dark ink contrast; check that old saved docs open unchanged and that alias slug pages resolve.

---

### Phase 6 — Accessibility & editor UX

**S6.1 · Dialogs and keyboard** ☐ — fixes A11Y-1 (also EDITOR-20), A11Y-4, A11Y-5, EDITOR-8
- Export, AI and Store overlays and all popovers: `role="dialog"`, `aria-modal`, labelled, focus trap, Escape closes, focus returns to the trigger.
- Tilt pad and depth/scale sliders: keyboard operable (arrows; Shift for larger steps) with `aria-valuenow`; keyboard changes coalesce into one history entry per key-hold.
- Filmstrip: keyboard reorder (Alt+←/→) and "Move left/right" actions.
- Clicking the headline, the phone or the background selects that element — a hit test on the caption and device rects returned by `layoutPhase1`, so S7.2 can reuse it with `ResolvedArtboard.hit`.

**S6.2 · Semantics, focus, contrast** ☐ — fixes A11Y-2, A11Y-3, A11Y-6, A11Y-7, A11Y-8
- Interactive `div`/`span` → `button`/`a` (or role + tabIndex + key handlers). No `outline:none` without a visible replacement. Live regions for export progress and save state.
- Raise `--muted-3`/`--muted-4` to AA contrast on `--bg` in both themes (token values only, rule 9); replace hardcoded `#f5b544` with `--warn`.

**S6.3 · Responsive and drop targets** ☐ — fixes A11Y-9, EDITOR-21, EDITOR-25
- Non-editor screens get breakpoints so nothing overflows at 375–768 px.
- Dropping files anywhere on the canvas targets the frame under the pointer (multi-file fills forward up to `MAX_FRAMES`); dropping never navigates away.
- Overlays position against the editor and work on windows shorter than 760 px.

**S6.4 · Editor correctness and performance** ☐ — fixes EDITOR-11, GAP-19
- In panoramic mode, background picks apply to the strip (and say so); "This frame only" is explicit about turning panorama off.
- Replace whole-store `useOnstage()` subscriptions with selectors (`useShallow`) so progress ticks and pointermoves don't re-render the editor.

---

### Phase 7 — Templates v2, T2 (spec "Phase 2")

**S7.1 · Resolver + shared painter** ☐
- `templates/resolve.ts`, `templates/text.ts`, `templates/device.ts`, `paint/paint2D.ts`, `paint/grain.ts` per spec §3 and §8.1. `resolveArtboard` replaces `layoutPhase1` (classic stays a branch). The editor and the export (`Konva.Shape` `sceneFunc`) call the same `paint2D`. Emphasis runs render (marker, pill, underline, italic swap).
- **Tests:** the resolver matrix in spec §8.4-1; classic still matches `classic.golden.json`.

**S7.2 · ArtboardView** ☐
- `components/onstage/artboard/ArtboardView.tsx` replaces CanvasStage's body, Filmstrip, GuidedScreen, StorePageScreen, StoreOverlay, the ReviewScreen/AbTest mini-renderers and `ArtboardThumb`. Port the S6.1 selection and S6.3 drop targets onto its hit boxes.
- **Done when:** no bespoke artboard renderer remains; zoom invariance holds (the same layout numbers at every zoom).

**S7.3 · Six templates + full specs** ☐
- Ship Marker, Big Number, Nocturne, Index, Monolith, Blueprint (without zoom); upgrade the five T1 templates to `version: 2` with a "Template updated · apply" chip. `SetFrame` gains `sub`, `kicker`, `stat`, `proof`, `notes`, `callouts`, `pose`, `role`; `SetDoc` gains `style`; `readDoc`/`partialize`/`equality` gain them in the same change; `migrateSetDoc` v2→v3.
- **Tests:** v2→v3 migration idempotent; fixture docs round-trip.

**S7.4 · Renderer, preflight, parity tests** ☐
- `renderDevice.ts`: roll, per-device lens, render box from the projected 8-corner bbox, `camera.setViewOffset` for bleeding devices; `screenRect()` shared by CSS and Three. Export preflight: placeholder proof, Play banned words and 20% text area, type-only frames on Apple, upscaled screens.
- A `/dev/parity` route renders `<NotFoundScreen />` unless `process.env.NODE_ENV !== 'production'`; it is absent from the sitemap and disallowed in robots. Playwright tests (painter 0-px diff, device silhouette IoU ≥ 0.98, golden PNGs, font gate — spec §8.4-2..5) run in a separate `.github/workflows/parity.yml` against `next dev`, not in `deploy.yml`.

### Phase 8 — Templates v2, T3 (spec "Phase 3")

**S8.1 · Second screenshot** ☐ — `screenshotB` (wired like `screenshotTablet`, including the `deleteSet` reference scan), a second drop target, device `source: next | prev | b`, back-to-front compositing. **Tests:** refs survive duplicate/delete; multi-device frames export in the right order.
**S8.2 · Zoom cards** ☐ — crops of the device's own screen through `screenRect`, a draggable crop handle. **Done when:** Blueprint's zoom frames match the spec on canvas and in the PNG.
**S8.3 · Strip layer** ☐ — strip-space items rendered once and drawn into both neighbours; if a neighbour is missing the item collapses into its owner frame. Ships Duo, Blueprint zoom, Ridgeline's 4|5 seam, Gallery pairs. **Tests:** seam items appear only in the two neighbouring frames; each PNG still reads on its own.

### Phase 9 — Localisation (D4) + Templates v2, T4

**S9.1 · Per-locale captions** ☐ — fixes EDITOR-6 (also EXPORT-3), completes GAP-9
- `frame.i18n: Record<locale, {caption?, sub?, kicker?}>`. The filmstrip language chips switch the canvas to that locale; edits write to it; missing translations are flagged. Export writes each locale's captions into its folder; locales without captions are warned about or skipped.
- **Migration** (schema bump in `migrateSetDoc`): for each frame whose caption exactly matches a `CAPTION_LOCALES` key (old or new), write `frame.i18n[locale].caption` from the table without overwriting existing entries. Only then delete `CAPTION_LOCALES` and `localise()`.
- **Tests:** a fixture doc with the old default captions exports the same DE/JA/ES text before and after migration; the migration is idempotent.
**S9.2 · Import/export strings** ☐ — CSV round-trip of every caption × locale; `.xcstrings` and Android `strings.xml` import. CJK fallbacks (Noto Sans JP/Serif JP) via `FONT_REGISTRY`; auto-fit for longer languages. **Tests:** CSV round-trip is lossless; a 35%-longer German caption fits or warns.
**S9.3 · T4 content** ☐ — dark sample variants, the `ledger` and `quill` sample apps, tablet sample screens (spec §7, §8.2 Phase 4). **Done when:** gallery previews show category-appropriate sample UI.

---

### Phase 10 — Feature roadmap (after the fixes; order by priority)

| Step | Pri | Feature | Scope and acceptance | Local? |
|---|---|---|---|---|
| S10.1 | P1 | **Project files** | Export/import a set as `.onstage` (zip of doc JSON + images). The zip reader/writer lives in `src/lib/onstage/export/projectFile.ts`, loaded by dynamic `import()`. Round-trips losslessly; replaces cloud backup/sharing. | Yes |
| S10.2 | P1 | **Backgrounds beyond presets** | Solid colour, custom 2–3 stop gradient, image upload, brand-kit colours; all render identically in export. | Yes |
| S10.3 | P1 | **Current device frames + styles** | iPhone 17-class, Pixel 10, Galaxy S-series geometry; clay, flat and frameless styles. | Yes |
| S10.4 | P1 | **Brand kits that work** — fixes SCREENSB-5 | Editable palette, fonts and defaults; "Apply to set" uses the selected kit (D10 flow); kit colours feed templates' `BrandMap`. | Yes |
| S10.5 | P2 | **Store-readiness checks** | 160 px search-thumbnail preview, contrast and text-size warnings, Play banned-claims and 20% text-area lint, Apple bezel-guideline note (builds on the T2 preflight); brings back `/store-preview` checks, computed. | Yes |
| S10.6 | P2 | **Keyboard shortcuts** | Escape, arrow nudges, duplicate frame, zoom, a `?` help sheet. | Yes |
| S10.7 | P2 | **Offline install (PWA)** | Installable, works offline after first load. | Yes |
| S10.8 | P2 | **Bring-your-own-key AI** | Headline suggestions and three style directions from the user's own key; un-gates `aiAssist`. | Yes (user key) |
| S10.9 | P3 | **Motion export** | Animate the Three.js tilt into MP4/WebM for App Previews and socials. | Yes |
| S10.10 | P3 | **Headless renderer / RTL** | Node + Playwright CLI that renders a saved project for every locale × size; RTL mirroring for Arabic/Hebrew. | Yes |

Direct store upload stays gated (`storeUpload`) until a backend exists.

---

## 6. Open questions for the owner

1. Keep `/states` and `/mobile` (design-review boards) public at all? Default: gated off (`designBoards`).
2. Custom domain? It would isolate browser storage from other `github.io` pages and help SEO. Default: stay on `ishankgupta95.github.io/OnStage`.
3. `onstage-v1.1-scope.md` and `onstage-free-mode-prompt.md` describe superseded plans (a server-backed v1.1; the already-completed free-mode gating). Delete them?
4. Bring-your-own-key AI (S10.8) — wanted at all?

---

## 7. Log

| Date | Step | Note |
|---|---|---|
| 2026-09-26 | — | Plan rewritten from the audit and reviewed for sequencing and facts. Old SaaS plan removed. |
| 2026-09-26 | S0.1 | Vitest 4.1 + jsdom 29 + fake-indexeddb 6 (Vitest 5 / jsdom 30 need Node ≥ 22; CI runs Node 20). `vitest.config.ts` (jsdom, `fake-indexeddb/auto` + `vitest.setup.ts` clearing localStorage before each test, `@/` alias, tests only in `src/**/__tests__/`); scripts `test` / `typecheck` / `verify`; `npm test` added to `deploy.yml` after lint. npm 11.4.2 crashed (`Cannot read properties of null (reading 'edgesOut')`) resolving Vite 8's optional devtools peers, so `vite@^7.3.6` is an explicit devDependency plus `"overrides": {"vite": "$vite"}`; `npm ci` verified from a clean copy of the lockfile. Test: `src/lib/__tests__/environment.test.ts`. |
| 2026-09-26 | S0.2 | Baseline recorded on the Pages export before any behaviour change — see *Baseline record (S0.2)* below. Audit findings reproduced live: EDITOR-1, EDITOR-4 (under a simulated 5 M-char quota), EDITOR-3, EDITOR-6, EDITOR-16, EXPORT-1, EXPORT-4, EXPORT-7, EXPORT-18, EXPORT-24, SCREENSB-1, PLATFORM-1, RUN-1. |
| 2026-09-26 | S0.3 | `storeUpload`, `aiAssist`, `abTest`, `jobQueue`, `storeImport`, `designBoards` added to `FEATURES` (`NEXT_PUBLIC_FEATURE_*`, all off) + `.env.local.example`, `deploy.yml` comment, CLAUDE.md table. Per rule 2 their routes already leave `sitemap.ts` and are disallowed in `robots.ts` (`/ab-test`, `/queue`, `/states`, `/mobile`); nothing renders differently — the NotFound/call-site gating is still S3.1, so GAP-17 stays unticked until then. Tests: `src/lib/__tests__/features.test.ts` (exact-"true" parsing per flag), `src/app/__tests__/seo.test.ts` (sitemap/robots follow every flag; mutation-checked). |
| 2026-09-26 | Phase 0 check | `npm run verify` green (3 files, 23 tests). Rebuilt the Pages export: robots.txt disallows `/ab-test`, `/queue`, `/states`, `/mobile`; the sitemap omits them. Golden path from empty storage: dashboard row → project → Open → `/editor/`; 3 PNGs dropped, reload kept all 3, caption edit saved; default export = 40 PNGs, all exact slot sizes; en-US 6.9″ PNGs match the canvas apart from the known EXPORT-24 wrap. Server stopped, `/tmp/onstage-pages` and `out/` removed. |

**Baseline record (S0.2)** — `NEXT_PUBLIC_STATIC_EXPORT=true NEXT_PUBLIC_BASE_PATH=/OnStage next build` (39 static pages, clean), served at `localhost:4173/OnStage/`, built-in Chromium at 1440×900, empty storage. Test screenshots were generated 1320×2868 app-like PNGs (~1.1 MB each) dropped through the real DropZone.
- **Routes:** every route answers 200. `/review`, `/pricing`, `/signin`, `/auth/callback` render *Not found*; `/ab-test`, `/queue`, `/states`, `/mobile` render their fixture pages. No page has a canonical link; every `og:image` is `http://localhost:3000/opengraph-image?…` (PLATFORM-1). Sitemap URLs have no trailing slash (RUN-1).
- **Dashboard:** fixture apps Trailhead / Ferry / Lumen and 4 fixture sets; "Three apps · 6 sets · last export 2 days ago" and the permanent "Google will reject" banner. Clicking the *Ferry — 6.9″ set* row goes to bare `/project/`, which shows Trailhead with "APPLE 2 OF 2 · GOOGLE 2 OF 3" (SCREENSB-1); every Open goes to bare `/editor/`.
- **Editor:** opens `trailhead-69` (5 frames, mixed backgrounds and tilts, 72%). Nothing is written to localStorage until the first edit. The Inspector DropZone takes one file per drop; filmstrip thumbnails never show screenshots. 5 PNGs → `onstage:set-docs:v1` = 7.27 M chars of data URLs, SAVED, survive reload.
- **Storage quota:** this embedded Chromium allows ~52 M chars of localStorage per origin (standard browsers ~5 M), so 8 PNGs (11.56 M chars) saved here. With `Storage.setItem` patched to a 5,242,880-char quota, one caption keystroke stored the stripped doc (1,023 chars), the badge read NOT SAVED ("storage is full — the layout was saved, screenshots were not"), and after reload all 8 screenshots were gone (EDITOR-4).
- **Undo:** Add frame → ⌘Z → type in Headline saves a 9th frame `{caption: "…X"}` with no other fields (EDITOR-1).
- **Export:** defaults are 6.9″ + 6.5″ + Play phone + Tablet 7″ × EN + DE = 40 files. All six slots × EN + DE with 5 screenshots: 52 PNGs in 21.4 s, `trailhead-store-assets.zip` 149.7 MB (the dialog estimated 75.8 MB). Every PNG decodes at its exact slot size and is RGBA (colour type 6, EXPORT-18). The dialog's file tree and "stretched to fit" warning are static (EDITOR-16). Feature graphic = "Trailhead" + frame 1's caption on fixed teal (EXPORT-7); `de-DE/` holds the English user caption (EDITOR-6); Tablet 7″ and iPad cover-crop the phone screenshot (status bar and title cut) and the device runs off the bottom edge (EXPORT-1, EXPORT-4); Play phone draws a punch-hole device the canvas never shows (EDITOR-3); "Built for the long haul" breaks "Built for the / long haul" on canvas but "Built for the long / haul" in the PNG (EXPORT-24). Otherwise the 6.9″ PNGs match the canvas (captions, backgrounds, tilt, screenshots).

---

## Appendix A — Findings register (grouped by the step that fixes them)

Every finding was verified by a second agent that tried to refute it. "Partly true" findings carry the verifier's correction. Merged duplicates are listed under "Also reported as". **Where a Fix line and its step disagree, the step wins.** Tick each finding when fixed.

### S1.1 · Screenshots to IndexedDB

- [ ] **EDITOR-4** · critical · bug — Screenshots are base64 data URLs in one localStorage key, so a real set overflows the ~5 MB quota and every screenshot is gone after reload
  - **Where:** `src/lib/data/local.ts:232`
  - **Problem:** Five 1320×2868 PNG screenshots (typically 1-3 MB each, +33% as base64) exceed localStorage. The user keeps working, reloads, and every screenshot in the set has been stripped, not only the one that overflowed. A 12 MB PNG, which the UI invites, can never be persisted.
  - **Evidence:** readImageFile stores `reader.readAsDataURL(file)` directly in frame.screenshot, with no size check or downscale (readImageFile.ts:5-16). The Inspector promises "PNG up to 12 MB" (Inspector.tsx:141). saveSetDoc writes every set into one key, `onstage:set-docs:v1`. On quota failure it saves a copy with `screenshot: null` on EVERY frame, then throws (L232-241).
  - **Fix:** → see S1.1 — IndexedDB Blobs under random ids, no downscaling, verified migration with a backup.
- [ ] **EDITOR-5** · medium · perf — Autosave JSON.stringifies the whole document, multi-MB screenshots included, on every store change
  - **Where:** `src/store/onstage.ts:476`
  - **Problem:** With a few dropped screenshots (tens of MB of data-URL text), every tilt-drag frame and every export progress update serialises the full document twice and re-renders the entire editor. Drags stutter and the main thread is blocked during export.
  - **Evidence:** `useOnstage.subscribe((st) => { const doc = readDoc(st); const next = JSON.stringify(doc); if (next === prev) return; ...` (L476-485) runs on every setState: zoom, sel, pop, overlay, exportDone progress ticks, pointermove during drags, and its own nested `setState({ saveState: "saving" })`. Each flush then re-parses and re-serialises all sets (local.ts:233-234).
  - **Fix:** Detect document changes by reference, e.g. `subscribe` with a selector on the partialized fields and a shallow compare, as the temporal `equality` already does. Only stringify inside the debounced flush. Use selectors with `useShallow` in the components.
- [ ] **GAP-18** · low · security — Deployed on a shared github.io origin, so saved sets share storage quota and readability with every other page on that origin
  - **Where:** `src/app/robots.ts:7`
  - **Problem:** Every other page on ishankgupta95.github.io (the user site and all project pages) shares the same ~5 MB localStorage quota, which EDITOR-4 shows is already too small. Any script on those pages can read users' screenshots, which weakens the privacy page's 'held in this browser' promise.
  - **Evidence:** The site URL is https://ishankgupta95.github.io/OnStage (basePath /OnStage, next.config.ts:14). localStorage is per origin, and every set doc with its base64 screenshots lives under `onstage:set-docs:v1` (local.ts:49).
  - **Fix:** Serve from a dedicated origin (a custom domain or <name>.github.io), and move screenshots to IndexedDB/OPFS, which EDITOR-4 needs anyway.

### S1.2 · Undo/redo and history correctness

- [ ] **EDITOR-1** · critical · bug — Undo/redo never restores `active`, so edits after ⌘Z write a malformed ghost frame that gets saved
  - **Where:** `src/store/onstage.ts:146`
  - **Problem:** Add a frame, press ⌘Z, then type in the Headline box or click a background swatch. The Inspector shows frame 1's caption, but the edit lands at frames[N] as `{caption}` or `{bg}` with no tiltX/tiltY/depth/scale/screenshot. A new frame appears on the canvas and autosave persists it. In export `fr.scale` is undefined, so `dw = 176*k*fr.scale` is NaN and the NaN reaches the Three.js renderer. nudgeScale and applyBgToAll throw TypeErrors. The same happens after redo of a removeFrame. Undoing a moveFrame silently moves the selection to a different frame.
  - **Evidence:** partialize (L391-400) tracks `frames` but not `active`. addFrame sets `active: st.frames.length` (L166). zundo's undo calls `userSet(pastState)`, which puts the old `frames` back but leaves `active` where it was. patchFrame then does `frames[st.active] = { ...frames[st.active], ...patch }` (L149) with no bounds check.
  - **Fix:** Clamp `active` whenever `frames` changes: subscribe to the store (or wrap undo/redo) and run `setState({active: Math.min(active, frames.length-1)})`. Guard patchFrame, nudgeScale and applyBgToAll with `if (!st.frames[st.active]) return {}`. Also reset `active: 0` in openSet.
- [ ] **EDITOR-2** · high · bug — Every pointermove and keystroke is its own undo entry, so one drag wipes the 80-step history
  - **Where:** `src/components/onstage/editor/ContextBar.tsx:262`
  - **Problem:** A one-second tilt drag at 60 Hz records about 60 history entries. Pressing ⌘Z steps back through tiny tilt deltas instead of undoing the drag, and two drags push every earlier edit (template apply, deleted frame, background change) out of the history. Typing a headline records one entry per character.
  - **Evidence:** The tilt pad's `move` calls `st.patchFrame({ tiltY, tiltX })` on every pointermove (L262). The depth slider does the same (L277). Inspector's caption-size slider calls `st.setState({ captionSize })` per move (Inspector.tsx:26), and the caption textarea calls `patchFrame` per keystroke (Inspector.tsx:81). The store sets `limit: 80` (onstage.ts:390) and never uses zundo's pause/resume or handleSet throttling.
  - **Fix:** On pointerdown call `useOnstage.temporal.getState().pause()`. On pointerup, `resume()` and record one entry, using handleSet or by setting the pre-drag snapshot into pastStates. Coalesce caption typing with a debounced handleSet (e.g. lodash.throttle/debounce as the zundo docs show).
- [ ] **EDITOR-12** · medium · bug — Deleting a frame before the selected one moves the selection to a different frame
  - **Where:** `src/store/onstage.ts:175`
  - **Problem:** With frame 4 selected, deleting frame 2 from the filmstrip moves the selection (and the Inspector) to what was frame 5. The user's next edit lands on the wrong artboard.
  - **Evidence:** `return { frames, active: Math.min(st.active, frames.length - 1) };` (L175) never decrements `active` when `index < st.active`.
  - **Fix:** `active: index < st.active ? st.active - 1 : Math.min(st.active, frames.length - 1)`.
- [ ] **EDITOR-24** · low · bug — Autosave is lost on tab close, and with an async backend the SAVED badge can show while a newer edit is unsaved
  - **Where:** `src/store/onstage.ts:482`
  - **Problem:** Closing or reloading the tab within 400 ms of an edit drops that edit. Once saveSetDoc is a network call (the Supabase seam), an older save that finishes late turns the badge to SAVED while unsaved changes are still pending.
  - **Evidence:** Saves wait for `setTimeout(() => void flush(id, doc), 400)` (L482-484), and nothing flushes on `pagehide` or `visibilitychange`. flush always sets `saveState: "saved"` when it resolves (L441-442), even if a newer edit has started another pending timer in the meantime.
  - **Fix:** Flush synchronously on `pagehide`/`visibilitychange=hidden`. Track a save sequence number and only set "saved" when the finished save is the latest and no timer is pending.

### S1.3 · openSet correctness

- [ ] **DATA-4** · medium · bug — openSet() doesn't reset the document when a set has no saved doc — it keeps the previous set's frames and will autosave them under the new setId
  - **Where:** `src/store/onstage.ts:461`
  - **Problem:** Opening a set that has never been saved does not start from a blank/default document; it silently continues editing (and will silently overwrite) with whatever content happened to be in memory from the last-opened set. Currently unreachable in the shipped UI because nothing ever calls `openSet`/navigates to `/editor?set=` with an id other than the single `DEFAULT_SET_ID` (see DATA-1/DATA-3), but it is a live defect in the one function the codebase's own comment says owns 'the set document is a backend record,' and it will corrupt data the moment DATA-1/DATA-3 are fixed and a second set becomes reachable.
  - **Evidence:** `if (useOnstage.getState().setId !== setId || !subscribed) { const doc = await getBackend().loadSetDoc(setId); useOnstage.setState({ setId, saveState: "saved", saveError: null, ...(doc && Array.isArray(doc.frames) && doc.frames.length ? doc : {}) }); ... }` (onstage.ts:461-468). When `loadSetDoc(setId)` returns `null` (no doc saved for that id yet, e.g.
  - **Fix:** When `loadSetDoc` returns null, reset `frames`/`device`/`frameColor`/etc. to an explicit default document (or a template) instead of spreading `{}`, so a new/unsaved set never inherits another set's in-memory state.

### S1.4 · Surface storage failures

- [ ] **DATA-5** · medium · bug — Almost every mutating Backend method silently swallows localStorage write failures with no user-facing error, then the caller's refetch silently reverts the action
  - **Where:** `src/lib/data/local.ts:69`
  - **Problem:** In any environment where `localStorage.setItem` throws for every write (e.g. Safari Private Browsing, or a browser with storage blocked by policy — a realistic case for a tool advertised as running 'entirely in the browser'), every one of these actions appears to succeed from the caller's point of view (the awaited promise resolves, no error state is set) but nothing was actually persisted. Because the caller immediately calls `.refetch()`, which re-reads from the same (still-empty) localStorage, the UI silently reverts: a comment marked resolved un-resolves itself, an invited teammate disappears, a reconnected store flips back to disconnected — with zero error message anywhere, unlike the export path which explicitly detects and reports this exact failure mode.
  - **Evidence:** `writeJson` (69-76) and `writeSet` (87-93) both catch and discard any localStorage exception, returning `false`/`void` with a comment '/* storage full or blocked — the change simply doesn't outlive the tab */'. Only `saveSetDoc` (232-242) checks that return value and throws to surface it.
  - **Fix:** → see S1.4 — every mutating method rejects with a readable message; ungated callers surface it.
  - **Verifier's correction:** Core claim confirmed: writeJson (local.ts:69) and writeSet (local.ts:87) both swallow exceptions and return false/void with no propagation, while saveSetDoc (local.ts:232+) is the sole method that checks and throws.

### S2.1 · Route by id

- [ ] **SCREENSB-1** · critical · bug — Dashboard and Project screens never pass a set/app id, so every click opens the same hardcoded default set
  - **Where:** `src/components/onstage/screens/DashboardScreen.tsx:385` · also reported as DATA-1 (ProjectScreen.tsx:17), EDITOR-13 (onstage.ts:461)
  - **Problem:** A user with multiple apps/sets who clicks any app card or any 'Recent sets' row other than the default always ends up viewing or editing Trailhead's default set while believing they opened Ferry or Lumen. Any edit or export made from there silently applies to the wrong app's screenshots — a core edit→export flow producing output for the wrong project.
  - **Evidence:** DashboardScreen.tsx:257 does `router.push(`/project?app=${encodeURIComponent(a.id)}`)` for the three app cards (trailhead/ferry/lumen), but ProjectScreen.tsx:17 hardcodes `const APP_ID = "trailhead"` and never calls `useSearchParams()` — the `?app=` value is read nowhere, so Ferry's and Lumen's cards land on Trailhead's board.
  - **Fix:** Have ProjectScreen read the app id via `useSearchParams().get("app")` (falling back to a default) instead of a hardcoded constant, and have the Dashboard's set-row and app-card click handlers pass the row's actual id (`?set=${r.id}` / `?app=${a.id}`) through to `/editor` and `/project` so EditorScreen's existing `?set=` handling (EditorScreen.tsx:114) and a set-aware ProjectScreen actually receive it.
  - **Plan note:** Load-sequencing half is S1.3 (D10).

### S2.2 · Create, rename, delete, seed

- [ ] **DATA-3** · high · bug — createApp/createSet/renameSet/deleteSet are fully implemented with real localStorage persistence but are never called by any screen
  - **Where:** `src/lib/data/local.ts:190`
  - **Problem:** The dashboard's list of apps/sets is permanently frozen to the 3 apps / 4 sets in sample.ts — a user can never actually create a second project, rename a set, or delete one through the UI, even though the entire persistence layer for it already exists and works (verified: writeJson round-trips through readJson correctly). Combined with DATA-1, the app is effectively single-project software wearing a multi-project UI.
  - **Evidence:** local.ts implements working, persisted CRUD: `createApp` (190-202), `createSet` (204-218), `renameSet` (220-223) and `deleteSet` (225-228), all writing to KEY.apps/KEY.sets/`${KEY.sets}:names`/`${KEY.sets}:deleted`. A repo-wide search (`grep -rn "\.createSet(\|\.createApp(\|\.deleteSet(\|\.renameSet(" src`) finds zero call sites.
  - **Fix:** Wire OnboardingScreen's flow (and/or a 'New app' action) to actually call `getBackend().createApp()`/`createSet()` and navigate to the new set's id, and add rename/delete controls to the Sets tab / dashboard row that call the existing `renameSet`/`deleteSet` methods and refetch.
- [ ] **GAP-10** · medium · bug — Saving a set never updates its library record, so the dashboard row for the one real set is frozen fixture data
  - **Where:** `src/lib/data/local.ts:232`
  - **Problem:** After editing (for example 8 frames, a Moss background, just now), 'Recent sets' still shows '5 FRAMES · Ready · 2h ago' with an Ember swatch. The library never reflects what the canvas saved.
  - **Evidence:** saveSetDoc writes only `KEY.docs`. listSets (lines 180-188) returns `sample.SETS` plus stored sets, unchanged. The 'trailhead-69' record is fixed at `frameCount: 5, status: "Ready", updatedAt: "2h ago", sub: "Ember template · EN, DE, JA, ES"` (sample.ts:93-101). DashboardScreen renders r.frameCount and r.updatedAt (lines 419-438) under 'EDITED IN THE LAST 30 DAYS'.
  - **Fix:** Have saveSetDoc upsert the set's metadata (frameCount, updatedAt, swatch from frames[0].bg, locales), or derive those fields from loadSetDoc in listSets.
- [ ] **GAP-11** · medium · fake-ui — Privacy policy promises set deletion the app can't perform, and deleteSet would leave the screenshots behind anyway
  - **Where:** `src/app/privacy/page.tsx:33`
  - **Problem:** The published privacy claim is false. Even after a delete is wired up, the user's screenshots stay in localStorage and keep counting against the ~5 MB quota that EDITOR-4 already shows is too small.
  - **Evidence:** 'Deleting a set removes it from this browser.' No screen calls deleteSet (DATA-3), and there is no 'clear my data' control anywhere. deleteSet itself (local.ts:225-228) only appends the id to `onstage:sets:v1:deleted` and leaves the full doc, including base64 screenshots, in `onstage:set-docs:v1`.
  - **Fix:** Make deleteSet remove the doc from KEY.docs, add a delete-set control and a 'clear all Onstage data' action, or rewrite the policy text to match.

### S2.3 · Derived numbers on the dashboard and project board

- [ ] **SCREENSB-2** · high · fake-ui — ProjectScreen's per-row "Open/Generate" and "Push live/Duplicate" buttons all open the identical default editor set and never perform the action they're labeled with
  - **Where:** `src/components/onstage/screens/ProjectScreen.tsx:223`
  - **Problem:** Clicking 'Push live' on the ready-to-launch variant B looks like it should make that variant the live one, but it silently just opens the canvas with no promotion happening — a user could believe they pushed a variant live when nothing changed, and would only discover the mismatch by checking elsewhere (if at all).
  - **Evidence:** ProjectScreen.tsx:132-144: every one of the five "Required sizes" rows (Apple 6.9″, 6.5″, Play phone/tablet/feature-graphic) has `onClick={() => router.push("/editor")}` with no size/id passed, so 'Generate' on the missing 'Tablet 7″' row opens the same document as 'Open' on the ready '6.9″' row.
  - **Fix:** → see S2.1 and S2.3 — real set rows with Open / Rename / Duplicate / Delete; "Push live" only under `storeUpload`.
- [ ] **SCREENSB-7** · medium · fake-ui — ProjectScreen's "Required sizes" readiness count is a fixed string that overstates the fixture data it sits above
  - **Where:** `src/components/onstage/screens/ProjectScreen.tsx:68`
  - **Problem:** The one number on the page meant to tell a developer how close they are to a store-ready set is wrong even against the app's own bundled example data, and won't track real progress as sizes are actually completed.
  - **Evidence:** ProjectScreen.tsx:67-69: `<span>APPLE 2 OF 2 · GOOGLE 2 OF 3</span>` is a literal string, not computed from the `sizeRows` query rendered directly below it. The actual fixture (`sample.SIZE_ROWS`) has only one 'Ready' Google row ('Phone') out of three Google rows ('Tablet 7″' is 'Missing', 'Feature graphic' is 'Draft'), so the header claims 2-of-3 Google readiness when even the sample data it's paired with shows …
  - **Fix:** Derive the counts from `sizeRows.data` (e.g. count `status === "Ready"` per `store`) instead of a hardcoded string.
- [ ] **DATA-2** · medium · fake-ui — Dashboard's 'Three apps · 6 sets · last export 2 days ago' summary is a hardcoded string that doesn't match the data it sits above
  - **Where:** `src/components/onstage/screens/DashboardScreen.tsx:195` · also reported as SCREENSB-6 (DashboardScreen.tsx:195)
  - **Problem:** The subtitle directly under 'Your apps' asserts a set count that is wrong even against the app's own bundled fixture data (4, not 6) and a last-export time that is entirely fabricated (recordExport/getSession track no timestamp). Any real data — including anything a future createApp/createSet call might add — will never be reflected here since the string never reads the query results at all.
  - **Evidence:** `<p>...>Three apps · 6 sets · last export 2 days ago</p>` is static JSX text, not derived from `apps`/`sets` (the two `useQuery` results rendered immediately below it in the same component). sample.ts defines exactly 3 apps (lines 41-89) but only 4 sets (lines 92-131, not 6), and there is no export-timestamp anywhere in the data layer to back '2 days ago'.
  - **Fix:** Derive the line from `apps.data?.length` and `sets.data?.length` (falling back to a skeleton while loading) and drop the fabricated 'last export' clause, or wire it to a real last-export timestamp if one is added to Session/ScreenshotSet.
- [ ] **GAP-8** · medium · fake-ui — Dashboard shows a permanent, hardcoded 'Google will reject' alert that contradicts the export dialog
  - **Where:** `src/components/onstage/screens/DashboardScreen.tsx:222`
  - **Problem:** Every visitor sees a warning about an app that isn't theirs. It asserts a rejection the product contradicts two screens later, and it never clears whatever the user does.
  - **Evidence:** A static JSX banner: "Trailhead's Play Store set is missing the 7″ tablet size. Apple accepted, Google will reject." with a 'Fix it' link to /project. No query drives it. ExportOverlay.tsx:503-504 says the opposite: 'Tablet 7″ uses 5 phone frames stretched to fit. Google accepts it'. The default export already includes TABLET_7 (exportPicks index 4).
  - **Fix:** Derive alerts from real set state (for example no tablet slot picked while store === 'play'), and make the copy match the export dialog. Otherwise remove the banner.
- [ ] **GAP-9** · medium · bug — Locales tab mixes fixture 'translated' counts with the live frame count
  - **Where:** `src/components/onstage/screens/project/LocalesTab.tsx:69`
  - **Problem:** After deleting two frames, the tab reads 'German — 5 OF 3 FRAMES · REFLOWED' with a progress bar at 167% (clipped to full). After adding frames it reads '5 OF 8 FRAMES' next to a 'DONE' badge, so the numbers contradict each other.
  - **Evidence:** `const pct = Math.round((l.translated / Math.max(1, frameCount)) * 100);` and line 98 `{l.translated} OF {frameCount} FRAMES`. `frameCount` comes from the live store (line 23), while `translated` is the fixture value 5 (sample.ts:165-168).
  - **Fix:** Compute per-locale completeness from the doc (count the frames whose caption has a translation for that locale), or clamp and stop mixing fixture counts with live state.
  - **Plan note:** Interim in S2.3 (show only the source locale); completed in S9.1.

### S3.1 · Gate fixture-only surfaces

- [ ] **EDITOR-14** · high · fake-ui — Store-upload destinations can never succeed, yet App Store Connect shows CONNECTED
  - **Where:** `src/components/onstage/editor/ExportOverlay.tsx:327` · also reported as EXPORT-6 (ExportOverlay.tsx:28)
  - **Problem:** In a tool that ships as no-account and browser-only, the dialog advertises "App Store Connect · CONNECTED · Token expires in 41 days" and "Render & upload N files". Every such run renders everything and then fails.
  - **Evidence:** The destinations list offers App Store Connect and Play Console with a CONNECTED / ACTION NEEDED badge taken from `listConnections()` (L327-377). In local.ts, `sample.CONNECTIONS` has apple `connected: true`. `uploadToStore` returns `ok:false` for a connected store ("Uploads need the store backend...", local.ts:302-308).
  - **Fix:** Hide the store destinations behind a feature flag (as with accounts/billing) until a real upload backend exists, or mark them "Coming soon" and disable them. Make uploadToStore honour the same connection overrides as listConnections.
- [ ] **SCREENSB-3** · high · fake-ui — AbTestScreen's "Promote variant B" button has no click handler at all
  - **Where:** `src/components/onstage/screens/AbTestScreen.tsx:41`
  - **Problem:** The single primary action on the A/B test screen — the one that lets a user act on the 'variant B is winning' result the page just showed them — is completely inert. Clicking it does nothing, with no error, no navigation, no feedback.
  - **Evidence:** AbTestScreen.tsx:41-49: `<button type="button" className="hov-accent" style={s(...)}>Promote variant B</button>` — there is no `onClick` prop, and no call to `getBackend()` anywhere in this file that could promote a variant.
  - **Fix:** → see S3.1 — the A/B surface is gated behind `abTest`.
- [ ] **SCREENSB-4** · high · fake-ui — JobRow's per-job action button (Retry/Download) is a dead control, shared by both the Queue screen and the project Uploads tab
  - **Where:** `src/components/onstage/JobRow.tsx:59`
  - **Problem:** Nowhere in the shipped product can a user actually retry a failed render batch or download a finished one from these lists — the exact recovery flow the UI copy advertises ('Partial results are always kept') has no working control behind it.
  - **Evidence:** JobRow.tsx:59-70: `<button type="button" style={s(...)}>{job.action}</button>` has no `onClick` handler. This is the only per-row control, and `JobRow` is used verbatim by both `QueueScreen` (screens/QueueScreen.tsx:50) and `UploadsTab` (screens/project/UploadsTab.tsx:49) — the two places the product explicitly promises partial-failure recovery (UploadsTab.tsx:22: "a failed upload never loses the files it rendered";
  - **Fix:** → see S3.1 — the jobs surfaces are gated behind `jobQueue`.
- [ ] **GAP-4** · medium · fake-ui — Store-URL import returns 'Trailhead' for any valid link; onboarding says 'Found Trailhead.' and guided advances with nothing imported
  - **Where:** `src/lib/data/local.ts:244`
  - **Problem:** Pasting a real listing (for example a finance app) shows 'Found Trailhead.' In guided mode the user moves on to 'Pick the phone' believing their screenshots were pulled in, but the frames still hold the sample screen.
  - **Evidence:** importFromStoreUrl returns `{ appName: "Trailhead", subtitle: "Run & Trail Log", tint: "#1b6f6a", screenshots: [] }` for any apps.apple.com or play.google.com URL. OnboardingScreen.tsx:209-221 does setFound(listing.appName) and renders 'Found {found}.'. GuidedScreen.tsx:340-343: `<StoreUrlField cta="Import" onImported={() => st.setState({ gStep: 1 })} />` ignores the result.
  - **Fix:** With no scraping backend, say plainly that import is unavailable in the local build and route to the upload DropZone. Never echo a fixture app name as the result of the user's URL.
- [ ] **GAP-16** · low · ux — Export overlay state leaks across navigation: 'Reconnect' strands the user in Settings and later reopens a stale error dialog
  - **Where:** `src/components/onstage/editor/ExportOverlay.tsx:425`
  - **Problem:** After reconnecting there is no direct route back to the canvas. When the user does get back to /editor, the export dialog reopens in the old 'didn't accept it' error state, and the upload fails again (EXPORT-6).
  - **Evidence:** The error card's `<Link href="/settings?tab=Store+connections">Reconnect</Link>` navigates away without clearing `overlay`, `exportState` or `exportError`; only close() (lines 103-113) resets them. Settings' BackButton goes to /dashboard (SettingsScreen.tsx:107), not back to the editor. Landing, Project and Guided also pre-set `overlay: "export"` before router.push.
  - **Fix:** Clear overlay/export state on EditorScreen unmount, or pass a returnTo param to Settings and reset exportState when the overlay mounts.
- [ ] **GAP-17** · low · seo — Design-review artboards (/mobile, /states) ship as public, crawlable routes with dead buttons
  - **Where:** `src/app/sitemap.ts:37`
  - **Problem:** Search engines index design artboards as product pages. Visitors land on mock UI whose buttons do nothing.
  - **Evidence:** `page("/states", 0.3), page("/mobile", 0.3)` are in the sitemap. /mobile is titled 'Marketing at 390px' and renders mock phones whose 'Start a set' button (MobileScreen.tsx:275-281) has no onClick. /states ('Error & edge states') renders fixture error cards with handler-less buttons (StatesScreen.tsx:139-154).
  - **Fix:** Remove /states and /mobile from the sitemap and disallow them in robots.ts, or gate them behind a dev-only flag the way accounts, teams and billing are gated.
- [ ] **EDITOR-7** · high · fake-ui — "Rewrite all N headlines in this tone" ignores the tone and overwrites user captions with fixed Trailhead copy
  - **Where:** `src/store/onstage.ts:211` · also reported as GAP-3 (local.ts:416)
  - **Problem:** Clicking the button replaces the user's own headlines with a running app's marketing copy, whatever tone or app is selected, and closes the drawer. For any app other than the sample this destroys work; it can only be recovered with ⌘Z, and nothing in the UI mentions that. The suggestions are identical for every frame.
  - **Evidence:** rewriteAllCaptions maps each frame to a hardcoded array: `["Every run, on one map", "Pace you can trust", ...][i] || f.caption` (L211-225). It never reads `aiTone`, and frames 6 and later are left alone. The button reads `Rewrite all {st.frames.length} headlines in this tone` (AiOverlay.tsx:222-230). Suggestions come from `TONE_SUGGESTIONS[tone]` (local.ts:416), a fixed list that ignores the caption passed in.
  - **Fix:** Hide the bulk rewrite, or gate it behind a real caption backend. If kept locally, derive variants from each frame's own caption and tone, cover all frames, and show a preview/confirm step. Have "Rewrite with AI" set `aiTab: "Captions"`.
- [ ] **SCREENSB-8** · medium · fake-ui — StorePageScreen's "Listing checks" panel is a static fixture presented as live analysis of the current set, and never reacts to real edits
  - **Where:** `src/components/onstage/screens/StorePageScreen.tsx:9`
  - **Problem:** A user editing frame 1's tilt or rewriting a caption in the canvas will see this panel keep reporting the exact same two flags forever, regardless of whether the underlying issue was fixed or a new one introduced — it looks like a live QA pass on their listing but is inert copy.
  - **Evidence:** StorePageScreen.tsx:9-31 defines a fixed `CHECKS` array (e.g. "Frame 01 tilt is flat... Every other frame leans right", "Feature graphic has no text") rendered verbatim at lines 220-246 alongside a static "3 PASS · 2 FLAGS" pill (line 222-224).
  - **Fix:** Either replace the hardcoded checks with ones computed from the live `st.frames` (tilt values, caption length/contrast against `bgCss`), or relabel the panel so it's clearly example/illustrative content rather than a check of "this" listing.
- [ ] **SCREENSB-10** · low · fake-ui — NotificationsPanel toggles are local-state-only; there is no backend method to persist them, so they always revert on reload
  - **Where:** `src/components/onstage/screens/settings/NotificationsPanel.tsx:25`
  - **Problem:** Currently unreachable in the shipped build (the tab is mounted only behind `FEATURES.accounts`, which is off), but the component itself has no persistence path whatsoever — the instant that flag is turned on, every switch a user flips here silently reverts on the next page load with no save/error indication, unlike every other settings surface in this file (Store connections, Plan & billing) which round-trips through `getBackend()`.
  - **Evidence:** NotificationsPanel.tsx never imports or calls `getBackend()`; `notifyOff` (line 25) is a plain `useState<string[]>(["news"])` toggled at line 27-28. `src/lib/data/backend.ts`'s `Backend` interface has no notification-preference read/write method at all (confirmed by grep — zero matches for 'notif').
  - **Fix:** Add a `Backend` method (e.g. `updateNotificationPrefs`) and call it from `toggleNotify`, following the same `await getBackend().X(); refetch()`-or-optimistic pattern used by `toggleConnection` in `SettingsScreen.tsx:85-98`.

### S3.2 · Remove fabricated numbers and static copy

- [ ] **SCREENSA-1** · high · fake-ui — Fabricated "240 sets/templates" claim, self-contradicted on the Templates screen itself
  - **Where:** `src/lib/onstage/data.ts:81`
  - **Problem:** A first-time visitor is told the product ships 240 template sets when there are 12; the discrepancy is verifiable on a single screen (TemplatesScreen), which undermines trust in every other stated number in the product.
  - **Evidence:** TEMPLATES array (data.ts:81-92) has exactly 12 entries, but LandingScreen.tsx:393 says "240 sets built by app designers", OnboardingScreen.tsx:36 sets meta:"240 SETS" and OnboardingScreen.tsx:430 has a button reading "See all 240", TemplatesScreen.tsx:42 headers the gallery "240 SETS", and MobileScreen.tsx:31 repeats meta:"240" in the nav drawer.
  - **Fix:** Replace the hardcoded "240"/"240 SETS" strings with `TEMPLATES.length` (or an accurate literal) everywhere they appear (LandingScreen.tsx:393, OnboardingScreen.tsx:36/430, TemplatesScreen.tsx:42, MobileScreen.tsx:31).
- [ ] **SCREENSA-2** · medium · fake-ui — Template detail page fabricates a "USED BY: 1,840 sets" statistic for every template
  - **Where:** `src/components/onstage/screens/TemplateDetailScreen.tsx:18`
  - **Problem:** Users are shown a fake social-proof number as if it were real usage data, identical for every one of the 12 templates — a fabricated claim presented as fact.
  - **Evidence:** `facts()` unconditionally returns `{ label: "USED BY", value: "1,840 sets" }` for whichever template is opened (TemplateDetailScreen.tsx:18), presented as a fact alongside real, computed values like FRAMES and BACKGROUND. Onstage has no backend/analytics (features.ts, CLAUDE.md: "Backend is not wired yet") so no usage count can exist.
  - **Fix:** Remove the "USED BY" fact entirely (there is no data source for it), or replace it with a real per-template attribute that the app actually tracks.
  - **Verifier's correction:** Core claim true: facts() at TemplateDetailScreen.tsx:18 unconditionally returns { label: 'USED BY', value: '1,840 sets' } for every template, and there is no backend/analytics to source such a number. However, unlike SCREENSA-1 this is a single static stat with no self-contradiction elsewhere on…
- [ ] **GAP-15** · low · bug — Template detail page disagrees with itself and with what is applied: palette, panorama preview and 'five screens' copy
  - **Where:** `src/components/onstage/screens/TemplateDetailScreen.tsx:249`
  - **Problem:** The swatches shown are not the colours the user gets. With 'My screens' and a 3- or 7-frame set, the panorama preview slices differently from the canvas. The copy names the wrong app and frame count.
  - **Evidence:** PALETTE uses `paletteOf(tpl.preview)`, but the strip and applyTemplate use `tpl.bg`. For Blueprint the preview is #12232e→#0a1218 while bg 'dusk' is #1f2b4d→#0e1424 (data.ts:90). The panoramic strip hardcodes `background-size:500% 100%` and position `i * 25%` (lines 151-152), which is correct only for 5 frames, while the canvas uses N×100% and i/(N−1).
  - **Fix:** Derive the palette from bgCss(tpl.bg), use frames.length for the panorama maths (same formula as CanvasStage), and interpolate the frame count and set name.
  - **Plan note:** Derived detail facts in S3.2; detail visuals completed in S5.5.
- [ ] **SCREENSA-8** · medium · fake-ui — Guided flow's "Export 40 files / 16.8 MB" summary and CTA label are hardcoded constants, not derived from the actual document
  - **Where:** `src/components/onstage/screens/GuidedScreen.tsx:63`
  - **Problem:** The number of files and total size shown to the user before exporting, and the label on the export button itself, do not change no matter what the user actually configured (frame count, locales, devices) and can disagree with what the real export overlay later computes and produces.
  - **Evidence:** `EXPORT_ROWS` (lines 63-68) and the literal "40" / "16.8 MB" markup (around lines 566-576), plus `NEXT_LABELS[3] = "Export 40 files"` (line 46), are fixed constants — none reference `st.frames`, `st.exportLangs`, or any device selection made elsewhere in the app.
  - **Fix:** Compute the row counts, total file count, and size estimate from live state (`st.frames.length`, selected devices, `st.exportLangs`) instead of the static `EXPORT_ROWS`/`NEXT_LABELS` constants.
- [ ] **EDITOR-16** · medium · fake-ui — Export dialog shows hardcoded file tree, warnings and badges that don't match the selection
  - **Where:** `src/components/onstage/editor/ExportOverlay.tsx:42` · also reported as EXPORT-19 (ExportOverlay.tsx:42)
  - **Problem:** The "You'll get" preview contradicts the actual zip for any non-default selection, such as 7 frames, JA only or the iPad slot. The dialog also warns about a softness problem that doesn't exist and flags missing frames that aren't missing.
  - **Evidence:** `TREE` is a fixed list: "en-US/ · de-DE/", "APP_IPHONE_69/ 01…05.png", "PHONE/", "TABLET_7/" (L42-49). It is rendered whatever the picks, locales and frame count are (L483-494). The warning "Tablet 7″ uses 5 phone frames stretched to fit" always shows (L496-506), but renderSet renders tablet slots with ANDROID_TABLET geometry at 1200×1920 (geometry.ts:54-63, 93-95), so nothing is stretched.
  - **Fix:** Build the tree from `exportPicks × exportLangs × frames.length` using EXPORT_SLOTS/LOCALE_FOLDER. Remove or compute the tablet warning and badge. Render the rows from EXPORT_SLOTS instead of a parallel SIZES array.
- [ ] **EDITOR-23** · low · fake-ui — Hardcoded sample text in the editor chrome looks like real data
  - **Where:** `src/components/onstage/editor/Inspector.tsx:92`
  - **Problem:** These look like live readouts but never change. A 120-character headline still says it fits, and a user's own app exports as "trailhead-store-assets.zip".
  - **Evidence:** The caption meta always reads `fits 6.9″ · 6.5″` with no measurement (L92). The Inspector footer shows a fixed "Brand kit · Trailhead" with three swatches (L235-243). The top bar title is the fixed string "Trailhead — 6.9″ set" (EditorScreen.tsx:168), with no rename and no link to the set record. The export zip is always `trailhead-store-assets.zip` (onstage.ts:297, 325).
  - **Fix:** Compute fit from measured line count at the smallest slot, read the set and app name from the backend record, derive the zip name from the app name, and show the actual applied kit (or remove the row).
- [ ] **GAP-2** · high · fake-ui — Landing hero says 'Drop a screen onto the phone below', but the phone has no drop target and the chosen tilt/background are thrown away
  - **Where:** `src/components/onstage/screens/LandingScreen.tsx:343`
  - **Problem:** A visitor who does what the headline says drops a PNG on the phone, and the browser navigates the tab to the image file, leaving the site. A visitor who tilts the phone and picks a background sees 'nice — now export it', but 'Export this set' exports the stored set with different backgrounds and angles.
  - **Evidence:** Copy: 'Drop a screen onto the phone below, tilt it, pick a background.' The hero phone shows 'Drop a screenshot · PNG · any size' (lines 151-154). Only DropZone.tsx and Filmstrip.tsx have onDrop/onDragOver handlers anywhere in src. The hero's bg and tilt live in local useState (lines 60-61). openExport (lines 81-84) only runs `setState({ overlay: "export" }); router.push("/editor")`.
  - **Fix:** Wrap the hero device in DropZone (from=0), and add a page-level dragover/drop preventDefault. Write the hero's bg and tilt into the store (patchFrame on frame 0, or applyBgToAll plus the tilt) before opening the editor. Otherwise change the copy.
- [ ] **GAP-14** · low · fake-ui — No on-canvas tilt handle exists, although the Inspector and landing page describe one; the landing demo's drag direction is also inverted
  - **Where:** `src/components/onstage/editor/Inspector.tsx:159`
  - **Problem:** Users try to drag the phone and nothing happens (a click just selects the frame). Users who learned the gesture on the landing page get the opposite yaw in the editor.
  - **Evidence:** Inspector: 'Tilt lives on the phone itself. Select it on canvas and drag the handle.' Landing FEATURE_CARDS (LandingScreen.tsx:39): 'Grab it, drag it, watch the shadow follow.' CanvasStage.tsx:69-86 renders CanvasDevice with no pointer handlers; the only tilt pad is inside PerspectivePopover.
  - **Fix:** Add a drag-to-tilt handle on the selected device in CanvasStage that reuses the popover's mapping, or change the copy. Make the landing hero use the same sign as the editor.
- [ ] **GAP-6** · medium · fake-ui — Settings 'How you want to work' is read by nothing, and the Preferences rows are static labels
  - **Where:** `src/components/onstage/screens/SettingsScreen.tsx:168`
  - **Problem:** Choosing 'Guided steps' in Settings has no effect: every later entry still opens the full canvas. The 'Default store target' and 'Units' rows look like pickers but cannot be changed.
  - **Evidence:** `onClick={() => setState({ workMode: m.id })}`. Grepping for workMode finds writes in Settings, Onboarding, ModeSwitch and Guided, and one read: SettingsScreen:79, for the radio state. Dashboard and Project always push '/editor' or '/project'. workMode is also saved per set (readDoc in store/onstage.ts:433), so it is not a global preference.
  - **Fix:** Route set-opening links through workMode (for example `/guided` when workMode === 'guided'), and store it outside the set doc. Remove the PREFS rows or make them real controls.

### S3.3 · Flows do what they say

- [ ] **SCREENSA-4** · high · fake-ui — Onboarding's "Pick a look" step discards the chosen style entirely
  - **Where:** `src/components/onstage/screens/OnboardingScreen.tsx:350`
  - **Problem:** Whichever of the three style cards (Moss / Cold Open / Field Notes) the user clicks, the editor opens with the same unchanged default document — the entire "pick a look" decision has no effect, despite the screen's own copy promising "These three suit your screens... Matched to the teal in your app."
  - **Evidence:** In step 2, each style tile's only handler is `onClick={() => router.push("/editor")}` (OnboardingScreen.tsx:347-352); the destructured `bg`/`ty` for that tile are never passed to `applyTemplate` or `setState`.
  - **Fix:** Call `applyTemplate(matchingSlug)` (or set `bg`/`tiltY` directly) in the tile's onClick before navigating to /editor.
- [ ] **SCREENSA-5** · medium · fake-ui — Onboarding's screenshot picker is decorative — toggled selections are discarded and the "5 screenshots pulled from the App Store" claim is false
  - **Where:** `src/components/onstage/screens/OnboardingScreen.tsx:258`
  - **Problem:** Users are told 5 real screenshots were imported and that they can deselect which ones to keep, but nothing was imported and deselecting has no effect on the resulting document.
  - **Evidence:** Step 1's copy (OnboardingScreen.tsx:258-260) reads "5 screenshots and your icon pulled from the App Store. Pick the ones to bring in.", and `togglePick` (line 68-71) tracks which of `SHOT_BGS` (a hardcoded gradient array, line 41-47) are checked. The "Continue with {picked.length} screens" button (line 306) just calls `setStep(2)` — `picked` is never read again, so unchecking tiles removes nothing.
  - **Fix:** Either wire the picker to the actual `listing.screenshots` result and filter frames by `picked` before creating the document, or drop the picker step and copy until the import path can return real screenshots.
- [ ] **SCREENSA-6** · medium · fake-ui — "Import a zip instead" link leads to the unrelated App-Store screenshot picker, not a zip import
  - **Where:** `src/components/onstage/screens/OnboardingScreen.tsx:230`
  - **Problem:** A user who has "a set somewhere else" and clicks to import a zip is shown App-Store screenshot picker copy that has nothing to do with a zip file, and there is no actual zip upload control on the page.
  - **Evidence:** The link's only handler is `onClick={() => setStep(1)}` (OnboardingScreen.tsx:229-235), which renders the same step-1 UI used by the "paste store URL" path (lines 239-319) — a screenshot grid and copy that says "5 screenshots and your icon pulled from the App Store" — with no zip-file input anywhere on the step.
  - **Fix:** Either build a real zip-import control (parallel to `DropZone`), or remove the "Import a zip instead" link until one exists.
- [ ] **SCREENSA-7** · high · fake-ui — Guided flow's canvas never shows the user's own screenshot, contradicting its own "This is exactly what gets rendered" hint
  - **Where:** `src/components/onstage/screens/GuidedScreen.tsx:256`
  - **Problem:** A user who drops their own screenshot in step 0 (via the real `DropZone`, which does call `setScreenshots`) sees the exact same empty gray device silhouette through all four guided steps, including the Export step whose caption explicitly claims the canvas shows exactly what will be rendered — which is false, since the real export embeds the uploaded screenshot.
  - **Evidence:** Every frame tile in GuidedScreen's canvas region draws only `background:linear-gradient(150deg,#3a3833,#141312)...` (GuidedScreen.tsx:249-259) — the file never references `fr.screenshot`/`f.screenshot` anywhere (confirmed via grep), unlike the real editor's `CanvasStage.tsx:71`, which passes `screenshot={fr.screenshot}` into the device frame.
  - **Fix:** Render `fr.screenshot` inside the guided canvas's device silhouette (mirroring `CanvasStage.tsx`), or change `CANVAS_HINTS[3]`'s copy so it stops promising exact-render fidelity.
- [ ] **SCREENSA-9** · low · fake-ui — Guided flow's upload file list is a static mock that never reflects what the user actually dropped
  - **Where:** `src/components/onstage/screens/GuidedScreen.tsx:48`
  - **Problem:** After a real upload via the DropZone above it, the file list still shows the same 5 fixed placeholder filenames, giving the user no feedback that their drop succeeded or what was actually picked up.
  - **Evidence:** `UPLOADS` (lines 48-54, five fixed filenames) and its "IN SEARCH"/"READY" tags (lines 350-376) render unconditionally beneath the real `DropZone` (line 315), independent of whatever files the user actually drops via that DropZone's `onChange`/`onDrop` handlers.
  - **Fix:** Derive the list from the frames that actually received a screenshot (`st.frames.filter(f => f.screenshot)`) instead of the static `UPLOADS` array.
- [ ] **SCREENSA-10** · medium · bug — Guided caption step's "Next frame" control can never reach frames beyond the third
  - **Where:** `src/components/onstage/screens/GuidedScreen.tsx:542`
  - **Problem:** In the "Write the headlines" step, a user relying on the "Next frame →" button to caption every frame can only ever edit frames 1-3; frames 4 and 5+ are permanently unreachable from within the guided flow's own navigation.
  - **Evidence:** `onClick={() => st.setState({ active: (st.active + 1) % Math.min(3, st.frames.length) })}` (line 539-543) cycles `active` only through indices 0, 1, 2 regardless of the real frame count (the default document has 5 frames, from `CAPTIONS` in data.ts, and templates like Nocturne have 7).
  - **Fix:** Use `(st.active + 1) % st.frames.length` so the cycle covers every frame in the document, not just the first three shown in the canvas strip.
- [ ] **GAP-1** · high · bug — A bulk screenshot drop only fills existing frames, and the guided flow exports frames 4–5 that it never shows
  - **Where:** `src/store/onstage.ts:198`
  - **Problem:** Screenshots 6–10 of a 10-file drop are silently discarded. A 3-file drop leaves frames 4–5 with the Trailhead captions ('Share the route', 'Built for the long haul') and the fake running-app screen. The guided user never sees those frames, but they go into the zip. A second drop starts again at frame 0 and overwrites the first batch instead of appending.
  - **Evidence:** setScreenshots: `urls.forEach((url, n) => { const i = from + n; if (frames[i]) frames[i] = { ...frames[i], screenshot: url }; })`. It never adds frames. GuidedScreen.tsx:328 asks the user to 'Drop 3–10 screenshots' into `<DropZone from={0} multiple>` (line 315). The guided canvas renders only `st.frames.slice(0, 3)` (line 213). next() at step 3 does `setState({ overlay: "export" });
  - **Fix:** Make setScreenshots grow the set to fit the drop (clone the style of the last frame, and cap at the store maximum). Have the guided canvas show every frame, or trim the set to the number dropped. Before export, list frames that still have the sample screen and require confirmation, or exclude them.
- [ ] **GAP-5** · medium · fake-ui — The editor's App Store / Play Store toggle changes nothing in the editor or the export
  - **Where:** `src/components/onstage/editor/EditorScreen.tsx:179`
  - **Problem:** A user who switches to 'Play Store' still designs on an iPhone-shaped 0.46 artboard, although Play phone output is 1080×1920 (0.56). Nothing on the canvas, in the size picks or in the preview changes, so the prominent control appears broken.
  - **Evidence:** The top-bar tabs call `st.setState({ store: "apple" | "play" })`. A grep for `.store` shows the only reader is StorePageScreen.tsx:43 (the /store-preview route). CanvasStage always draws 268×580 iPhone-ratio artboards. ExportOverlay never reads st.store to pre-select slots, and StoreOverlay ignores it (EDITOR-17).
  - **Fix:** Drive the canvas aspect and the default exportPicks from `store` (Play → PHONE/TABLET_7/feature graphic), or remove the toggle from the editor.
- [ ] **GAP-7** · medium · ux — Export defaults pre-select German and Tablet 7″, so every first export ships a mislabelled de-DE folder and the soft tablet frames the dialog warns about
  - **Where:** `src/store/onstage.ts:130`
  - **Problem:** A user who never localised clicks Export and gets twice the files and render time, plus a de-DE/ folder full of English captions. The zip also contains the tablet size the product itself flags as low quality. EXPORT-3 describes the German fallback; these defaults make every user hit it.
  - **Evidence:** Initial state: `exportPicks: [0, 1, 3, 4]` (index 4 = 'Google — Tablet 7″') and `exportLangs: ["EN", "DE"]` (line 131). Neither is derived from the set. localise() only translates the 5 sample headlines (slots.ts:63). ExportOverlay.tsx:503 warns that Tablet 7″ 'will look soft'.
  - **Fix:** Default exportLangs to the set's own locale(s) (['EN']). Default exportPicks to the required sizes for `store`. Only pre-select Tablet 7″ when the set actually has tablet frames.
- [ ] **GAP-12** · high · ux — Hover-only reveal controls are invisible but clickable, so on touch one tap restyles the whole set or deletes a frame, with no undo
  - **Where:** `src/components/onstage/screens/TemplatesScreen.tsx:123`
  - **Problem:** On a tablet (the editor allows ≥900px, so an iPad qualifies), tapping a template card to look at it overwrites every frame's background, tilt, depth and panorama, then jumps to the canvas. Tapping near a filmstrip thumbnail's corner deletes a frame. Without a keyboard there is no way to undo either. Keyboard focus never reveals these buttons.
  - **Evidence:** 'Use this set' is `position:absolute;inset:0;…;opacity:0` over the whole card preview, and its onClick runs `applyTemplate(t.slug); router.push("/editor")`. The only reveal rule is `.hov-reveal:hover .reveal { opacity: 1 }` (globals.css:212), with no :focus-within and no (hover:none) rule. Filmstrip.tsx:71-85 uses the same pattern for 'Delete frame'.
  - **Fix:** Show the reveal controls under `@media (hover:none)` and `:focus-within`. Make the card tap open the detail page. Add visible Undo/Redo buttons, or a confirm/undo toast after applyTemplate and removeFrame.
  - **Plan note:** Card behaviour fixed in S3.3; card visuals rebuilt in S5.5.
- [ ] **SCREENSB-9** · low · fake-ui — DropZone/readImageFiles perform no size or dimension validation, contradicting the rejection flow the product documents for itself
  - **Where:** `src/components/onstage/DropZone.tsx:31`
  - **Problem:** Any image of any resolution (a thumbnail-sized icon, a corrupt file with an image MIME type) is silently accepted into a frame with no warning, directly contradicting the dedicated rejection UX the product's own design catalog shows as an existing, real behavior.
  - **Evidence:** DropZone.tsx:31-35's `take()` calls `readImageFiles` (lib/onstage/readImageFile.ts:14-16), which only filters `f.type.startsWith("image/")` before reading every file as a data URL — there is no `Image()`/`naturalWidth`/`naturalHeight` check and no byte-size cap anywhere in this path. `StatesScreen.tsx:8-16` documents the opposite as a real guarantee: "That PNG is 720 × 1280 — too small for 6.9″ ...
  - **Fix:** Add a dimension check in `readImageFile`/`readImageFiles` (load into an `Image()`/`createImageBitmap` and compare against the target device's required px) and surface the rejection card `StatesScreen` already designs for when a dropped file is undersized.
  - **Verifier's correction:** The core technical claim is true: DropZone.tsx's `take()` (lines 31-35) calls `readImageFiles` (readImageFile.ts:14-16), which only filters `f.type.startsWith("image/")` — no Image()/naturalWidth/naturalHeight check, no byte-size cap anywhere in the path.

### S3.4 · Stop leaking the sample brand into user output

- [ ] **EXPORT-20** · medium · fake-ui — Sample app name is hard-coded into every user's zip, dialog title and upload
  - **Where:** `src/store/onstage.ts:297` · also reported as HYGIENE-004 (onstage.ts:297), HYGIENE-003 (onstage.ts:307)
  - **Problem:** Every user downloads 'trailhead-store-assets.zip' containing a 'trailhead-store-assets/' folder, named after the demo app rather than theirs. Repeat exports of different apps collide as 'trailhead-store-assets (1).zip'.
  - **Evidence:** `downloadBlob(zipBlob, "trailhead-store-assets.zip")` (also line 325), `zip.file(`trailhead-store-assets/${f.path}`, …)` (renderSet.ts:274), `uploadToStore({ appId: "trailhead", … })` (line 307), 'Export Trailhead' (ExportOverlay.tsx:164). SetDoc has no app name.
  - **Fix:** Add an app or project name to the set (or read it from the project record through getBackend()) and slugify it for the zip, root folder, dialog title and appId, falling back to 'onstage-export'.
- [ ] **EXPORT-7** · high · fake-ui — Play feature graphic always says 'Trailhead' on a hard-coded teal gradient, and ignores Play's safe zone
  - **Where:** `src/lib/onstage/export/renderSet.ts:213` · also reported as HYGIENE-005 (renderSet.ts:231)
  - **Problem:** Every user who ticks 'Google — Feature graphic' gets an asset branded with the sample app's name. Play requires a feature graphic for every listing. Long first captions overflow past 1024px, and the left edge of the name can be cropped by Play.
  - **Evidence:** `const APP = { name: "Trailhead", … }` (line 47). The feature slot paints `"linear-gradient(150deg,#1b6f6a,#134f63)"` (line 214), then `text: APP.name` at x:72, y:186 (lines 228-237), then `frames[0].caption` at 32px with no `width`, so there is no wrapping (lines 239-247).
  - **Fix:** Take the app name, tint and background from the set or project (and the user's chosen bg), constrain the tagline with `width` and `wrap`, keep content inside the centre safe area, and preload every weight the graphic uses.
- [ ] **EXPORT-5** · high · bug — An undecodable screenshot silently exports the Trailhead sample app instead
  - **Where:** `src/lib/onstage/export/images.ts:11` · also reported as EDITOR-22 (renderSet.ts:172)
  - **Problem:** The user's store screenshots ship with another app's UI in them, and the export reports success. The canvas and the export disagree, and nothing warns the user.
  - **Evidence:** `loadExportImage` does `img.onerror = () => resolve(null)`. renderSet.ts:172 then uses `source: req.screenshots?.[i] ?? sampleScreen`. DropZone/readImageFile accept any `image/*` (for example image/heic or image/tiff, which Chrome and Firefox cannot decode). The canvas shows an empty dark rectangle for the broken `<img>` (device.tsx:120-126), while the export substitutes the painted Trailhead UI (sampleScreen.ts).
  - **Fix:** When a frame has `screenshot` set but loading fails, throw a descriptive error ('Frame 3's screenshot couldn't be decoded') instead of falling back to the sample. Also validate decodability at drop time in readImageFiles (decode with createImageBitmap and reject if it fails).

### S3.5 · Platform & SEO quick fixes

- [ ] **PLATFORM-1** · high · seo — metadataBase falls back to localhost:3000, so production OG/Twitter image URLs are dead — confirmed live
  - **Where:** `src/app/layout.tsx:6`
  - **Problem:** Every social/chat unfurl of any Onstage URL (Slack, X/Twitter, iMessage, Discord, LinkedIn) shows no image or a broken-link icon because the crawler tries to fetch an unreachable localhost URL. This is sitewide (metadataBase is set once in the root layout and governs every route's image/canonical resolution), and it is not a stale-deploy artifact — the exact same fallback pattern is still in the current source and will reproduce on the next deploy since deploy.yml still never sets NEXT_PUBLIC_SITE_URL.
  - **Evidence:** metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") — and .github/workflows/deploy.yml never sets NEXT_PUBLIC_SITE_URL (only NEXT_PUBLIC_STATIC_EXPORT and NEXT_PUBLIC_BASE_PATH are set).
  - **Fix:** Add `NEXT_PUBLIC_SITE_URL: "https://ishankgupta95.github.io/OnStage"` to the `env:` block in .github/workflows/deploy.yml, and change layout.tsx:6's fallback from "http://localhost:3000" to the same GitHub Pages URL sitemap.ts/robots.ts already use, so a missing env var degrades to the right host instead of localhost.
- [ ] **PLATFORM-3** · medium · seo — Every route's meta description falls through to the homepage's generic copy; no canonical URL is emitted anywhere
  - **Where:** `src/app/layout.tsx:8`
  - **Problem:** Search engines see 20 distinct URLs (editor, templates, dashboard, etc.) all sharing one meta description meant for the marketing homepage, weakening each page's snippet relevance in search results, and with no canonical tags, duplicate/near-duplicate content signals (e.g. query-param variants of /editor, /settings) have no declared preferred URL.
  - **Evidence:** Only privacy/page.tsx and terms/page.tsx set a page-specific `description`; the other 20 route `page.tsx` files (dashboard, editor, templates, templates/[slug], project, queue, review, ab-test, store-preview, brand, guided, onboarding, mobile, states, signin, auth/callback, pricing, settings) set only `title` and inherit layout.tsx:8-9's description verbatim.
  - **Fix:** Give each route's `metadata` export its own `description` (as privacy/terms already do), and set `alternates: { canonical: <path> }` per route (or at minimum a self-referencing one in the root layout) using the same base URL fixed in PLATFORM-1.
- [ ] **PLATFORM-4** · medium · perf — Google Fonts loaded via a render-blocking <link> instead of next/font, despite the README claiming next/font is used
  - **Where:** `src/app/layout.tsx:26`
  - **Problem:** Adds render-blocking third-party requests to every page load (privacy cost — the visitor's IP hits Google's servers — plus latency before text paints in the right font, since `display=swap` only prevents invisible text, not layout/visual shift when the fallback and real font have different metrics) that next/font/google would eliminate entirely by self-hosting the same fonts at build time with zero runtime requests.
  - **Evidence:** layout.tsx:20-28 loads four font families (17 weight/style combinations total) through a raw `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...">`, requiring two sequential round trips (CSS, then each woff2) to fonts.googleapis.com/fonts.gstatic.com before text renders in its intended face — README.md's unedited create-next-app boilerplate claims "This project uses next/font...
  - **Fix:** → see D6 — keep the Google Fonts `<link>` (Canvas2D needs the real family names); correct the README.
- [ ] **PLATFORM-5** · low · maintainability — next.config.ts comments reference a routing helper and data file that no longer exist in the repo
  - **Where:** `next.config.ts:26`
  - **Problem:** Not a functional bug — no code path is actually broken since Link/router already handle basePath — but the comments actively mislead a maintainer into hunting for a `withBase()` helper that was deleted, or worrying that raw internal navigation isn't basePath-safe when it already is.
  - **Evidence:** next.config.ts:12 says "the app runs entirely client-side; see src/lib/localData.ts" and :26 says "raw window.* nav uses withBase() from src/lib/routes.ts" — neither src/lib/localData.ts nor src/lib/routes.ts exist anywhere in the repo (`find`/`grep` for both return nothing), and no `withBase` symbol exists.
  - **Fix:** Update the next.config.ts comments to reference src/lib/data/local.ts and drop the withBase()/routes.ts mention, or add a short note that Link/router.push cover all current internal navigation.
- [ ] **PLATFORM-6** · low · maintainability — Seven tracked public/ assets are unreferenced anywhere in the app and ship into the static export regardless
  - **Where:** `public/sample-screen.svg:1`
  - **Problem:** Dead weight in the repo and in every static export build (out/) — five are unedited create-next-app boilerplate (next.svg, vercel.svg, globe.svg, file.svg, window.svg) that were never removed, and the two sample-screen SVGs are leftovers from before the canvas-painted sample screen replaced them.
  - **Evidence:** `grep -rn "sample-screen\|next.svg\|vercel.svg\|globe.svg\|window.svg\|file.svg" src/` returns zero matches for any of: file.svg, globe.svg, next.svg, vercel.svg, window.svg, sample-screen.svg, sample-screen-2.svg — all seven are tracked in git (`git ls-files public/`) but nothing in src/ imports or links to them.
  - **Fix:** Delete the seven unreferenced files from public/ (or confirm intended future use and wire them in).
- [ ] **RUN-1** · low · seo — Sitemap URLs omit the trailing slash that the static export serves (trailingSlash: true)
  - **Where:** `src/app/sitemap.ts:11`
  - **Problem:** Every sitemap entry (e.g. /OnStage/templates) answers with a 301 to /OnStage/templates/ on GitHub Pages, so crawlers index redirects instead of canonical pages.
  - **Fix:** Append "/" to every non-root path in sitemap.ts when NEXT_PUBLIC_STATIC_EXPORT is on, and use the same URL form for canonical links.
  - **Verifier's correction:** Checked in a local Pages build (out/sitemap.xml).
- [ ] **EDITOR-27** · low · maintainability — The s() CSS parser splits on every ';', so any value containing a semicolon is silently corrupted
  - **Where:** `src/lib/onstage/css.ts:13`
  - **Problem:** No current input breaks it, but the first `background-image:url(data:image/png;base64,...)` (the obvious way to show a brand logo or background image) or `content:";"` produces a broken style with no error. The parser also re-runs on every render of every element, which adds to the whole-store re-renders in EDITOR-5.
  - **Evidence:** `for (const decl of css.split(";"))` (L13) has no awareness of quotes or parentheses. Vendor prefixes map `-ms-x` to `MsX`, while React expects `msX` (L19). Many style strings interpolate state (e.g. the caption font in CanvasStage.tsx:55, frame colours in device.tsx:115).
  - **Fix:** Split only on semicolons outside parentheses and quotes (a small state machine), handle the `-ms-` prefix, and memoise static style strings (e.g. a Map cache keyed by the string).

### S4.1 · One source for layout numbers + shared line breaking

- [ ] **HYGIENE-001** · low · maintainability — Duplicated BARS/ROWS sample screen data across canvas and export
  - **Where:** `src/components/onstage/device.tsx:6` · also reported as HYGIENE-002 (CanvasStage.tsx:35), HYGIENE-006 (CanvasStage.tsx:56), HYGIENE-007 (CanvasStage.tsx:76)
  - **Problem:** Both canvas render and export must show identical artwork. The sampleScreen.ts file explicitly documents this: 'This is the same artwork PhoneScreenUI renders in the editor — kept in lockstep.' Duplicating these constants risks sync drift where the exported PNG doesn't match the canvas preview.
  - **Evidence:** const BARS = [38, 52, 44, 70, 58, 82, 64, 48, 76, 100, 66, 54, 72, 46]; const ROWS = [{ name: "Ridge Loop", val: "5.2 km", tint: "#2f8f86" }, ...] defined identically in both device.tsx and src/lib/onstage/export/sampleScreen.ts (lines 8-12)
  - **Fix:** Extract BARS and ROWS to a shared constants file (e.g., src/lib/onstage/sampleData.ts), import in both device.tsx and sampleScreen.ts
  - **Verifier's correction:** Duplication is real and verified verbatim: device.tsx:6-11 and export/sampleScreen.ts:8-12 both define identical BARS/ROWS arrays (confirmed paintSampleScreen() is called unconditionally in renderSet.ts:65 as the fallback artwork).
- [ ] **EDITOR-9** · medium · parity — Line breaks typed in the headline are collapsed on the canvas but kept in the export
  - **Where:** `src/components/onstage/editor/CanvasStage.tsx:53` · also reported as EXPORT-8 (CanvasStage.tsx:51)
  - **Problem:** A user forces a two-line headline and the canvas shows one line, but the exported PNGs have the break. The preview and the output no longer match.
  - **Evidence:** The Inspector caption is a `<textarea>`, which accepts Enter (Inspector.tsx:79-85). The canvas caption div style has no `white-space` rule (`...;text-wrap:pretty`, L53-59), so a "\n" collapses to a space. Konva.Text in renderSet honours "\n" (`text: localise(fr.caption, locale)`, renderSet.ts:139). StoreOverlay has the same collapse (StoreOverlay.tsx:76-84).
  - **Fix:** → see S4.1 — shared `breakLines`; the canvas renders the resolved lines with `white-space: pre`.
- [ ] **EXPORT-24** · low · parity — Caption line breaks can differ between canvas and export (rounding, text-wrap: pretty, letter-spaced drawing without kerning)
  - **Where:** `src/lib/onstage/export/renderSet.ts:134`
  - **Problem:** Borderline captions can wrap on a different word in the PNG than on the canvas, and bold display type in the export has visibly unkerned pairs ('Tr', 'Yo') and slightly off-centre lines.
  - **Evidence:** The canvas uses `Math.round(captionSize*scale*0.62)` and rounded padding and width (CanvasStage.tsx:35,53-56): at the default zoom 72 that gives 20px in a 159px box (0.1258), while export uses an unrounded 27.28/220 (0.1240). The canvas also applies `text-wrap:pretty`, whereas Konva wraps greedily.
  - **Fix:** Compute the canvas caption in unrounded px (or apply a CSS transform: scale() to a fixed-size artboard) and drop `text-wrap:pretty`, or implement the same balancing in export. Use the canvas-native `ctx.letterSpacing` path (supported by Konva when letterSpacing is set via the context) rather than per-char drawing, or render caption text with plain canvas fillText and ctx.letterSpacing.

### S4.2 · Canvas lays out at design size

- [ ] **EDITOR-10** · medium · parity — The canvas preview matches the export only at 100% zoom: perspective, depth, bevel and shadow ignore zoom, and the bevel shadow ignores the shadow toggle
  - **Where:** `src/components/onstage/editor/CanvasStage.tsx:66`
  - **Problem:** At the default 72% zoom, and at every zoom other than 100%, the canvas shows weaker perspective and a relatively stronger depth pop than the PNG. At 44% the phone becomes a pill with clipped sample UI. Turning off "Contact shadow" still shows a heavy shadow on the canvas, while the export has none.
  - **Evidence:** The wrapper is fixed at `perspective:1400px` (L66) and the device uses `translateZ(${fr.depth * 0.35}px)` (L76), neither scaled by `zoom/100`, while the device width is `176*scale`. The exporter uses device-relative units: `z: (fr.depth*0.35)/(176*fr.scale)`, `perspectiveDistance: 1400/(176*fr.scale)` (renderSet.ts:166,169).
  - **Fix:** → see S4.2 — one `transform: scale(zoom/100)` on a design-size artboard; don't multiply individual properties by zoom.
- [ ] **EXPORT-12** · medium · parity — Canvas translateZ is applied in the rotated frame, export applies it along world Z, so tilted frames shift sideways
  - **Where:** `src/lib/onstage/export/renderDevice.ts:303`
  - **Problem:** Every tilted frame with depth (the default frames 2-4, and every template applied with depth 40) lands about 3% of the artboard width away from where the canvas showed it.
  - **Evidence:** The canvas uses `transform: rotateX(tx) rotateY(ty) translateZ(d) scale(s)` (CanvasStage.tsx:74-77). CSS applies these right to left, so translateZ runs along the device's rotated normal. The export sets `group.rotation.y/x` and then `group.position.z = perspective.z` (Object3D matrix = T·R·S, so the translation is not rotated).
  - **Fix:** → see S4.2 — CSS applies the lift after rotation; the Three side stays as is.
- [ ] **EXPORT-13** · medium · parity — Shadow parity: canvas always draws a heavy bezel shadow, and export shadow ignores scale and tilt
  - **Where:** `src/components/onstage/device.tsx:115`
  - **Problem:** With the shadow toggled off, the editor still shows a dark shadow under the phone but the PNG has none. With it on, shadow size and offset differ at scale ≠ 1.
  - **Evidence:** The bezel always has `box-shadow:0 26px 60px -18px rgba(0,0,0,.75)`, regardless of the Shadow toggle (ContextBar.tsx:79). The toggle only adds `filter: drop-shadow(0 26px 26px rgba(0,0,0,.42))` on the transformed element (CanvasStage.tsx:78-80), so that shadow scales with `scale()` and tilts with the device.
  - **Fix:** Move the bezel box-shadow behind the `shadow` flag (or reproduce it in export), and multiply the export shadow blur and offset by `fr.scale`.
- [ ] **RUN-2** · low · ux — The first artboard's "SELECTED" tag sits under the floating tool rail at the default zoom
  - **Where:** `src/components/onstage/editor/CanvasStage.tsx:110`
  - **Problem:** On first open the tag reads "ELECTED": the rail at the canvas's left edge covers the tag's first letters, and the artboard row only has 40px of side padding.
  - **Fix:** Start the artboard row clear of the tool rail (left padding ≥ rail width + 12px), or place the tag inside the artboard bounds.
  - **Verifier's correction:** Seen in the running editor at the default 72% zoom.

### S4.3 · Device choice and aspect-aware layout

- [ ] **EDITOR-3** · high · fake-ui — Device picker is mostly fake: the canvas always draws the same phone and export ignores every choice except "No frame"
  - **Where:** `src/components/onstage/editor/CanvasStage.tsx:72` · also reported as EXPORT-2 (ContextBar.tsx:232)
  - **Problem:** Picking "iPad Pro 13″" or "Pixel 9 Pro" changes only the label. Picking "No frame" still shows a bezel and notch on the canvas, but the export is frameless. The iPad and Google slots (aspect 0.75, 0.5625, 0.625) are laid out very differently from the only preview the canvas can show (0.46), so users cannot see what the iPad or Play files will look like.
  - **Evidence:** The CanvasStage device is always `width:${176*scale}px;height:${374*scale}px` with an iPhone notch (L72-85), whatever `st.device` is. CanvasDevice (device.tsx:99-133) takes no device prop. In export, `geometryFor(deviceId, slotClass)` returns `deviceId === "none" ? FRAMELESS : BY_CLASS[slotClass]` (geometry.ts:93-95), so iPhone 16 Pro Max, iPhone 15, iPad Pro 13″ and Pixel 9 Pro (data.ts:39-45, offered in …
  - **Fix:** Pass `device` into CanvasDevice and derive the aspect, corner radius, cutout and frameless flag from the same DeviceGeometry table the exporter uses. Add a canvas preview-size switch (per export slot) that changes the artboard aspect. Collapse the picker to what actually matters (frame vs no frame, plus finish), or make the model selection drive geometry.
- [ ] **EXPORT-1** · high · parity — iPad and Android-tablet exports put a cover-cropped phone screenshot inside a tablet frame; the canvas never shows this
  - **Where:** `src/lib/onstage/export/geometry.ts:93`
  - **Problem:** The 'Apple — iPad Pro 13″' and default-selected 'Google — Tablet 7″' PNGs show the user's phone UI with about 19% cut off the top and bottom (status bar, tab bar), inside a device they never saw. The dialog warning says the opposite ('phone frames stretched to fit', ExportOverlay.tsx:503), and so does GuidedScreen.tsx:611. Apple requires iPad screenshots to show the app running on iPad, so this output risks review rejection.
  - **Evidence:** `geometryFor(deviceId, slotClass)` returns `BY_CLASS[slotClass]`, so the iPad slot gets `IPAD` (aspect 0.75) and Tablet 7″ gets `ANDROID_TABLET` (aspect 0.625). renderDevice.ts:133-160 `composeScreen` cover-fits the single per-frame screenshot (`req.screenshots?.[i]`, renderSet.ts:172) into that screen: `if (ia > aspect) … else { bw = tw; bh = tw / ia; }`.
  - **Fix:** Allow a screenshot per device class (phone and tablet) on each frame. Until a tablet screenshot is supplied, either skip or disable the tablet slots with an honest message, or letterbox (contain-fit) rather than crop. Add a per-slot preview in the export dialog, rendered from the same renderSet path at thumbnail scale.
- [ ] **EXPORT-4** · high · parity — Export lays out every slot by width only, so on Play Phone (and tablets) the device can paint over the headline and run off the bottom
  - **Where:** `src/lib/onstage/export/renderSet.ts:104`
  - **Problem:** The 'Required' Google Phone output can have the device covering part of the headline and cut off at the bottom edge. On the canvas the same frame looks fine.
  - **Evidence:** `const k = slot.w / DESIGN_W` (268). The canvas artboard is 268×580 (ratio 0.462), but Play Phone is 1080×1920 (0.5625). The device is `dw = 176*k*scale`, `dh = dw/geom.aspect` (PIXEL 0.47 gives dh≈1509 at scale 1), centred at `(capBottom + slot.h)/2` (line 186), and is drawn after the text with no clip.
  - **Fix:** Fit the device into the remaining box `(slot.h - capBottom)` with the same clip the canvas applies: scale by `min(slot.w/268, (slot.h - capBottom)/(580 - capBottomDesign))`, or clip the image to the device region with a Konva Group `clip`. Compute the Inspector 'fits' hint per selected slot from the same measurement.

### S4.4 · Export pipeline robustness

- [ ] **EXPORT-10** · medium · perf — Module-level render cache keeps hundreds of MB of canvases, plus multi-MB data-URL keys, after an export
  - **Where:** `src/lib/onstage/export/renderDevice.ts:348`
  - **Problem:** After one export the tab keeps roughly 200-500MB of canvas memory for its whole life. On low-memory laptops or iPad Safari this can crash the tab or fail the next export's toBlob.
  - **Evidence:** `const _cache = new Map<string, HTMLCanvasElement>(); const CACHE_MAX = 32;` is never cleared. Its key includes `o.screenKey`, which renderSet.ts:176 sets to `req.screenshots?.[i]?.src`: the full base64 data URL from readImageFile. Canvas sizes are `round(dw*1.55)×round(dh*1.2)`, for example about 1344×2186 (11.7MB) per iPhone 6.9″ frame and 2100×2168 (18MB) per iPad frame.
  - **Fix:** Scope the cache to a single renderSet call (create the Map in renderSet and pass it in, or clear `_cache` in renderSet's finally block). Key screenshots by a short hash or frame index plus a version, not by the data URL.
- [ ] **EXPORT-11** · medium · bug — WebGL context loss yields exports with no device, and there is no fallback when WebGL is unavailable
  - **Where:** `src/lib/onstage/export/renderDevice.ts:34`
  - **Problem:** After a GPU reset or tab backgrounding on laptops, exports 'succeed' as caption-on-gradient PNGs with no phone at all. On browsers without WebGL, export always fails.
  - **Evidence:** `_renderer` and `_envTex` are process-wide singletons with no `webglcontextlost`/`restored` handling (a grep for contextlost finds nothing in src). After a loss, Three's `render()` returns early and `octx.drawImage(renderer.domElement…)` copies a blank buffer. The PMREM env target is not rebuilt. The only gate is `blobDimensions` (renderSet.ts:89), which checks size, not content.
  - **Fix:** Listen for context loss on `renderer.domElement`, and dispose and null `_renderer` and `_envTex` so they are rebuilt. After each render, check `renderer.getContext().isContextLost()` and throw or retry. Consider a 2D fallback frame when WebGL is unavailable.
- [ ] **EXPORT-14** · medium · perf — Konva stage renders every frame twice, once at devicePixelRatio, which doubles the cost and allocates up to about 90MB per iPad frame
  - **Where:** `src/lib/onstage/export/renderSet.ts:85`
  - **Problem:** Export is much slower, and peak memory much higher, on Retina machines. It can hit Safari's canvas memory limits on large slots.
  - **Evidence:** `emit` calls `stage.draw()` and then `stage.toCanvas({ pixelRatio: 1 })`. Stage._toKonvaCanvas (konva/lib/Stage.js:209-232) re-draws every layer into fresh 1× canvases, so the `draw()` is redundant. The Layer's own SceneCanvas uses `Konva.pixelRatio || devicePixelRatio` (Canvas.js:30), so on a 2× display the iPad stage allocates a 4128×5504 layer canvas (about 91MB) plus a DPR buffer canvas, and runs the 26k-px …
  - **Fix:** Remove `stage.draw()`, and set `Konva.pixelRatio = 1` (or pass `pixelRatio:1` to the layer canvas) during export. Alternatively build the Layer without mounting a Stage.
- [ ] **EXPORT-15** · medium · bug — Screen texture fixed at 1024px (sample at 664px), so the user's screenshot is upscaled and soft on iPad and large-scale exports
  - **Where:** `src/lib/onstage/export/renderDevice.ts:139`
  - **Problem:** The user's own UI, the main content of a store screenshot, comes out visibly blurry on the 2064×2752 iPad output and at high device scale.
  - **Evidence:** `composeScreen` always uses `const tw = 1024`. On the iPad slot the screen is about 0.955×1355 ≈ 1294px wide in the final PNG, and iPhone 6.9″ at scale 1.3 is about 1084px, so the texture is magnified. The sample screen is painted at `paintSampleScreen(width = 664)` (sampleScreen.ts:32) and magnified in every slot.
  - **Fix:** Size the texture from the on-screen screen width × supersample (clamped to maxTextureSize), e.g. `tw = min(maxTex, ceil(screenPx*ss))`, and paint the sample at that width.
- [ ] **EXPORT-16** · medium · bug — Failed lazy load of the 3D renderer is cached forever, so 'Try again' can never recover
  - **Where:** `src/lib/onstage/export/loader.ts:18`
  - **Problem:** One transient chunk-load failure makes export permanently broken until a full page reload, while the dialog keeps offering 'Try again'.
  - **Evidence:** `if (!_promise) { _promise = import("./renderDevice").then(...) }` followed by `await _promise`. A rejected import (offline, or a chunk hash removed by a new GitHub Pages deploy) leaves `_promise` as a rejected promise, and every later call rethrows it.
  - **Fix:** Reset `_promise = null` in a `.catch` before rethrowing, so the next attempt re-imports.
- [ ] **EXPORT-17** · medium · ux — Export cannot be cancelled: the `signal` option is never wired and the dialog locks while busy
  - **Where:** `src/store/onstage.ts:266`
  - **Problem:** All 6 sizes × 4 locales × 5 frames is 104 full-resolution 3D renders, and the user is trapped behind the modal until it finishes, with no way to stop a mistaken run.
  - **Evidence:** renderSet accepts `signal?: { cancelled: boolean }` and checks it (renderSet.ts:38,107,208), but runExport never passes one. ExportOverlay `close` returns early when busy (`if (busy) return;`, line 104) and the close button is `disabled={busy}`.
  - **Fix:** Keep a module-level `{cancelled:false}` token, pass it to renderSet, and add a Cancel button that sets it and resets the state. Also destroy the in-flight stage on cancel (see EXPORT-21).
- [ ] **EXPORT-18** · medium · bug — Exports are 32-bit RGBA PNGs, but Play requires a 24-bit PNG with no alpha for the feature graphic
  - **Where:** `src/lib/onstage/export/renderSet.ts:86`
  - **Problem:** The 1024×500 feature graphic, and possibly the Play screenshots, can be rejected at upload for having an alpha channel.
  - **Evidence:** `canvasToBlob(stage.toCanvas({ pixelRatio: 1 }), "image/png")`: Konva SceneCanvas elements are default alpha-enabled 2D canvases, which browsers encode as RGBA PNG even when every pixel is opaque. No option flattens to RGB or JPEG. Play Console's spec for the feature graphic (and screenshots) is 'JPEG or 24-bit PNG (no alpha)'.
  - **Fix:** For store slots, encode without alpha: draw onto a canvas from `getContext('2d', { alpha: false })` before toBlob, or offer a JPEG option (quality about 0.92) for Play assets.
- [ ] **EXPORT-22** · low · perf — Konva stage leaks when a frame render throws
  - **Where:** `src/lib/onstage/export/renderSet.ts:202`
  - **Problem:** Each failed export leaks one full-size stage (tens of MB), and retries accumulate the leak.
  - **Evidence:** `stage.destroy()` runs only after a successful `await emit(...)`. The `finally` (lines 253-255) removes only `host`. Konva keeps every stage in a global `stages` array until destroy (konva/lib/Stage.js:95,103,179). A throw from emit (size mismatch, toBlob null), render3D or the cancel check leaves the stage and its DPR-sized canvases referenced.
  - **Fix:** Wrap each frame in try/finally and call `stage.destroy()` there (for both the per-frame and feature loops).
- [ ] **EXPORT-23** · low · perf — Materials are disposed after every render, so the physical shader recompiles for every frame
  - **Where:** `src/lib/onstage/export/renderDevice.ts:116`
  - **Problem:** Shader compilation is added to each of the potentially 100+ renders, which is noticeably slow on ANGLE/D3D.
  - **Evidence:** `disposeScene` disposes every material, including the MeshPhysicalMaterial with clearcoat, anisotropy and RectAreaLights created per call (lines 228-236). In Three r184 disposing drops the program's usedTimes to 0 and destroys the WebGLProgram, so the next frame compiles it again.
  - **Fix:** Create the titanium, bezel and cutout materials once at module scope (update `color`/`roughness` per finish), and dispose only geometries and the per-frame screen texture.
- [ ] **EXPORT-28** · low · ux — 'Done — download ready' button silently re-runs the whole export
  - **Where:** `src/components/onstage/editor/ExportOverlay.tsx:510`
  - **Problem:** Clicking what reads like a download link re-renders every PNG (possibly minutes) and triggers a second download.
  - **Evidence:** The button's onClick is always `st.runExport()`, and it isn't disabled when `exportState === "done"`. Its label then reads 'Done — download ready' (line 127).
  - **Fix:** When the state is done, make the button re-download `lastRender.zipBlob` (or relabel it 'Export again').
- [ ] **EDITOR-15** · medium · bug — "Download instead" after a failed render downloads a stale zip from an earlier export, or does nothing
  - **Where:** `src/store/onstage.ts:322` · also reported as EXPORT-9 (onstage.ts:322)
  - **Problem:** If an export throws (for example a WebGL context loss or the size-mismatch gate), clicking "Download instead" either does nothing, or saves the previous export's zip (older captions/frames) and reports "Done — download ready".
  - **Evidence:** `lastRender` is module state that is only assigned on success (L96, L287) and never cleared when a new run starts or fails (L313-319). The error card shows "Download instead" whenever `!st.exportBlockedByQuota` (ExportOverlay.tsx:433-443), including when the render itself failed with the zip destination.
  - **Fix:** Set `lastRender = null` at the start of runExport, and show "Download instead" only when a zip from the current run exists (e.g. expose `canDownloadRendered` in state).
- [ ] **PLATFORM-2** · high · bug — Caption typeface "Fraunces" is never loaded at the font-weight (700) every caption headline is hardcoded to render at
  - **Where:** `src/lib/onstage/export/renderSet.ts:141` · also reported as EDITOR-26 (layout.tsx:26), EXPORT-25 (renderSet.ts:140)
  - **Problem:** Whenever a user picks Fraunces as the caption typeface, both the live canvas and — more importantly — every exported store-ready PNG (the product's actual deliverable) render the headline in a browser-synthesized fake-bold instead of true Fraunces Bold, because no 700 face was ever downloaded. renderSet.ts:58-63 explicitly calls `document.fonts.load('700 120px "Fraunces"')` specifically to avoid exactly this kind of face mismatch before export, but the font was never requested at that weight from Google Fonts in the first place, so the safeguard has nothing to load.
  - **Evidence:** renderSet.ts:140-141 draws every exported headline with `fontFamily: req.captionFont, fontStyle: "700"` unconditionally; CanvasStage.tsx:55-57 renders the identical live-preview headline with the hardcoded literal `font:700 ...px/1.14 '${captionFont}'`.
  - **Fix:** Add weight 700 to the Fraunces request in layout.tsx:26 (e.g. `family=Fraunces:ital,wght@0,400;0,600;0,700;1,300`), or stop hardcoding fontStyle/font weight to "700" in CanvasStage.tsx and renderSet.ts and instead pick a weight that's actually loaded per caption font.

### S4.5 · Store rules and slots

- [ ] **EDITOR-19** · medium · ux — No upper limit on frames, although App Store Connect accepts at most 10 screenshots and Play at most 8
  - **Where:** `src/store/onstage.ts:153` · also reported as EXPORT-26 (onstage.ts:153)
  - **Problem:** A user can build and export 12 frames per size and only learn at upload time that the store rejects the extras. The tool claims to produce store-ready output.
  - **Evidence:** addFrame always appends (L153-168), and the Filmstrip "+" is always shown (Filmstrip.tsx:131-140). The export renders every frame for every slot (renderSet.ts:106).
  - **Fix:** Cap at 10 (Apple), warn above 8 when Play slots are selected, and show the count against the limit in the Filmstrip and Export dialog.
- [ ] **EXPORT-27** · low · maintainability — Export dialog keeps its own copy of slot labels and sizes, separate from EXPORT_SLOTS
  - **Where:** `src/components/onstage/editor/ExportOverlay.tsx:12`
  - **Problem:** Reordering or resizing a slot in one list silently desyncs the dialog's labels, counts and the files actually rendered.
  - **Evidence:** `SIZES` re-declares labels and dimensions that live in `EXPORT_SLOTS` (slots.ts:17-24) and is indexed in parallel (`toggleExportSize(i)`). The per-row file count uses `SIZES[i][0].includes("Feature")` (line 264), while the total uses `EXPORT_SLOTS[i]?.kind` (line 82).
  - **Fix:** Render rows from `EXPORT_SLOTS` directly (add `badge` and `required` fields to ExportSlot) and use `slot.kind` everywhere.
- [ ] **EXPORT-21** · medium · fake-ui — Landing page promises a Play 10″ tablet export that no slot produces
  - **Where:** `src/components/onstage/screens/LandingScreen.tsx:496`
  - **Problem:** The marketing surface claims an output size the product cannot produce.
  - **Evidence:** The copy reads 'sized to spec — 6.9″ and 6.5″ for Apple, phone and 7″/10″ tablet for Play, plus your feature graphic', and SIZE_CHIPS includes 'Tablet 10″' (line 19). EXPORT_SLOTS (slots.ts:17-24) has only TABLET_7, with no 10″ entry.
  - **Fix:** Add a Play 10″ tablet slot (e.g. 1600×2560 into a TABLET_10 folder), or remove '10″' from the landing copy and chips.

### S5.3 · Applying templates

- [ ] **SCREENSA-3** · high · fake-ui — Template taglines describe visual effects ("grid lines", "split colour blocks", "serif captions") that applying the template never produces
  - **Where:** `src/store/onstage.ts:361` · also reported as EDITOR-18 (onstage.ts:361)
  - **Problem:** Clicking "Use this set" on Field Notes never switches to a serif caption font, on Blueprint never draws grid lines, and on Signal never produces split colour blocks — the promised visual identity of the template is simply absent, and Blueprint/Cold Open become indistinguishable once applied.
  - **Evidence:** `applyTemplate` (store/onstage.ts:361-377) only sets `bg`, `tiltY`, `tiltX`, `depth`, `panorama` from the template. It never touches `captionFont` (store/onstage.ts:32/121, the only caption-font state), and there is no grid-line rendering anywhere in the codebase (`grep -rn "grid-line|repeating-linear-gradient"` finds nothing) and no split-gradient background option.
  - **Fix:** Either implement the described per-template effects (a `captionFont` override for Field Notes, an actual grid-line background layer for Blueprint, a real split-gradient for Signal) inside `applyTemplate`, or rewrite the taglines/preview art to match what applying the template actually changes.

### S5.4 · New default set + sample screens

- [ ] **GAP-13** · medium · design-drift — The default set breaks the product's own consistency rules and trips its own listing check
  - **Where:** `src/store/onstage.ts:98`
  - **Problem:** Every new user starts from a set that looks inconsistent (the look the user called out). The product's own guidance and preview checks would flag it. The captions and screen are a running app's, so nothing in the default reads as a starting point for the user's own app.
  - **Evidence:** initialFrames: bg ember/dusk/moss/ember/ink (4 unrelated gradients), tiltY 0/−16/+15/−22/0 (leaning both ways), tiltX 0/6/0/6/0, depth 0/42/38/66/0. Only 2 of the 5 match a TILT_PRESET, so the Inspector labels frames 2–4 'Custom tilt'. GuidedScreen.tsx:31 says 'One device and one angle for the whole set.
  - **Fix:** Replace initialFrames with one coherent template: one background family (or panorama), one preset angle across all frames, neutral placeholder captions and an explicit 'Drop your screen' placeholder instead of the Trailhead UI. Ideally build it from a TEMPLATES entry so the default is itself a template.

### S5.5 · Gallery, detail, landing, store preview

- [ ] **EDITOR-17** · medium · fake-ui — Store preview ignores the App Store / Play Store toggle, panorama and the user's screenshots, and its "flags unreadable" claim isn't implemented
  - **Where:** `src/components/onstage/editor/StoreOverlay.tsx:67`
  - **Problem:** The one feature meant to check a set in context shows the wrong store, the wrong backgrounds for panoramic sets and no real screenshots. The App Store / Play Store toggle in the top bar looks like it does something and doesn't.
  - **Evidence:** The header is always "As the App Store shows it · IPHONE · SEARCH RESULT" (L27-30), although `st.store` can be "play" (EditorScreen.tsx:177-190; nothing in the editor reads `st.store`). Thumbnails use `bgCss(fr.bg)` instead of the panorama slice (L71-73), draw a fixed graphite rectangle instead of `fr.screenshot` (L85-91), and ignore captionFont/align.
  - **Fix:** Render the thumbnails with the same CanvasStage/CanvasDevice components at thumbnail scale, including screenshots and the panorama slice. Branch the layout on `st.store` (Play shows a horizontal carousel plus a feature graphic). Implement a simple legibility check (caption px height at thumbnail scale), or drop the claim.

### S6.1 · Dialogs and keyboard

- [ ] **A11Y-1** · high · a11y — Export/AI/Store overlays have no dialog semantics, focus trap, or Escape-to-close
  - **Where:** `src/components/onstage/editor/ExportOverlay.tsx:137` · also reported as EDITOR-20 (EditorScreen.tsx:38)
  - **Problem:** A screen-reader user tabbing into these full-screen 'modals' gets no announcement that a dialog opened, can Tab straight through into the canvas/editor behind the backdrop (nothing traps focus), and has no keyboard way to dismiss the export/AI/store dialog except hunting for the visible close button — Escape does nothing anywhere in the app.
  - **Evidence:** The overlay root is `<div style={s("position:absolute;inset:0;z-index:200;display:grid;place-items:center;...background:var(--backdrop);backdrop-filter:blur(6px)")}>` with no `role="dialog"`, no `aria-modal`, and no focus management. The same pattern repeats verbatim in AiOverlay.tsx:47 and StoreOverlay.tsx:13.
  - **Fix:** Give each overlay root `role="dialog" aria-modal="true" aria-labelledby="<heading id>"`, move initial focus into the dialog on mount, trap Tab/Shift+Tab within it, and add a keydown handler that closes on Escape (respecting ExportOverlay's existing `busy` guard).
- [ ] **A11Y-4** · medium · a11y — Filmstrip frame reordering is drag-and-drop only, with no keyboard alternative
  - **Where:** `src/components/onstage/editor/Filmstrip.tsx:36`
  - **Problem:** A keyboard-only user can select and delete frames (the delete button at line 71 is a real `<button>`), but can never reorder them — an editing action central to building a screenshot set is completely unavailable without a mouse/touch pointer.
  - **Evidence:** The frame tile is `<div key={i} draggable onDragStart=... onDragOver=... onDrop={(e) => { ...; if (dragFrom !== null) st.moveFrame(dragFrom, i); ... }} onClick={() => st.select(i, ...)} ...>` (lines 36-68). `st.moveFrame` is only ever invoked from this `onDrop` handler in the file — there is no button, keyboard shortcut, or any other path to reorder frames.
  - **Fix:** Add keyboard-operable move controls (e.g. Alt+ArrowLeft/Right while a frame tile is focused, or small 'move left/right' buttons) that call the existing `st.moveFrame`, and give the tile itself `tabIndex`/`role` so it can receive that focus.
- [ ] **A11Y-5** · high · a11y — Perspective-tilt pad and depth slider are pointer-only, with no keyboard path for a core editing control
  - **Where:** `src/components/onstage/editor/ContextBar.tsx:309`
  - **Problem:** Perspective/depth adjustment — one of Onstage's headline editing features — is entirely unusable by a keyboard-only user: there is no way to fine-tune tilt or set an arbitrary depth value without a mouse or touchscreen.
  - **Evidence:** `<div onPointerDown={padDown} style={s("...cursor:grab;...touch-action:none")}>` (the tilt pad, using `padDown` defined at line 257) and `<div onPointerDown={depthDown} ...>` (the depth slider at line 354, using `depthDown` defined at line 273) both drive `st.patchFrame({tiltX, tiltY})` / `st.patchFrame({depth})` purely from `pointermove`/`pointerup` window listeners.
  - **Fix:** Give the pad and the depth track `role="slider"` (or two sliders) with `tabIndex=0`, `aria-valuenow/min/max`, and an `onKeyDown` handler that nudges `tiltX`/`tiltY`/`depth` via `st.patchFrame` on arrow-key presses.
- [ ] **EDITOR-8** · medium · fake-ui — Clicking the headline, phone or background on the canvas does not select that element
  - **Where:** `src/components/onstage/editor/CanvasStage.tsx:33`
  - **Problem:** After closing the Inspector, clicking a headline selects the phone. With the phone selected, clicking the headline keeps the phone tools. The hint promises direct manipulation that doesn't exist, so users have to find the left rail's Text and Background icons.
  - **Evidence:** The only click handler is on the whole artboard: `onClick={() => select(i, sel ?? "device")}` (L33). The caption div (L51-63) and the CanvasDevice (L69-86) have no handlers. The ContextBar empty state says "Click the phone, the headline, or the background to edit it" (ContextBar.tsx:208).
  - **Fix:** Add onClick handlers with stopPropagation on the caption div (`select(i, "caption")`), on the device (`"device"`) and on the frame background (`"bg"`). Consider in-place contentEditable caption editing.

### S6.2 · Semantics, focus, contrast

- [ ] **A11Y-2** · high · a11y — Inline `outline:none` on text inputs removes keyboard focus visibility with no replacement
  - **Where:** `src/components/onstage/screens/DashboardScreen.tsx:130`
  - **Problem:** Because these are React inline styles, they win over globals.css's `:focus-visible { outline: 2px solid var(--accent) }` rule (inline style beats any non-`!important` stylesheet selector). Tabbing to the store-URL field, search boxes, work-email field, brand-kit name field, invite-teammate field, or the review-comment textarea produces no visible focus indicator at all — a keyboard user can't tell which field is active.
  - **Evidence:** `style={s("flex:1;min-width:0;border:none;background:transparent;color:var(--text);font:400 12.5px 'Inter',sans-serif;outline:none")}` on the dashboard search input. The same `outline:none` inline style (with no substitute focus indicator) is set on inputs in StoreUrlField.tsx:51, ReviewScreen.tsx:353, AuthScreen.tsx:171, BrandScreen.tsx:124, TemplatesScreen.tsx:55 and settings/TeamPanel.tsx:95.
  - **Fix:** Drop the inline `outline:none` (or replace it with a border-color/box-shadow change driven by `:focus-visible` in a real stylesheet rule, since the `s()` parser can't express pseudo-classes) so the global focus ring — or an equivalent themed one — actually shows.
- [ ] **A11Y-3** · high · a11y — Interactive `<div>`/`<span>` cards throughout onboarding, guided, dashboard and canvas flows have no role, tabIndex, or key handler
  - **Where:** `src/components/onstage/screens/OnboardingScreen.tsx:267`
  - **Problem:** A keyboard-only or screen-reader user cannot pick a starting route, cannot select which screenshots to import, cannot choose a brand style, cannot switch the work-mode in Settings, cannot select a frame in the Guided screen or on the canvas itself, and cannot open an app/set from the dashboard grid — several of these are the only entry point into their flow, so keyboard/AT users are blocked outright.
  - **Evidence:** `<div key={i} onClick={() => togglePick(i)} style={...}>` — the screenshot-picker tiles in step 1 of onboarding. The identical pattern (clickable div/span, `cursor:pointer`, no `role`, no `tabIndex`, no `onKeyDown`) recurs at OnboardingScreen.tsx:156 (start-route cards), :230 (the 'Import a zip instead' pseudo-link span), :350 (style picker tiles), EmptyScreen.tsx:79 (dashboard-empty start-route cards), …
  - **Fix:** Convert these to real `<button type="button">` elements (or add `role="button" tabIndex={0}` plus an `onKeyDown` handler for Enter/Space) consistently, matching the pattern already used correctly in DropZone.tsx and Inspector.tsx.
- [ ] **A11Y-6** · medium · a11y — No live region announces export progress or autosave state changes
  - **Where:** `src/components/onstage/editor/SaveBadge.tsx:20`
  - **Problem:** A screen-reader user gets no feedback while a render/upload is in progress ("Rendering 3 of 8…" only ever appears visually) and, more seriously, is never told when autosave fails ("NOT SAVED") — a silent data-loss risk for anyone not watching the badge.
  - **Evidence:** `SaveBadge` renders a `<span>` whose text silently switches between "SAVING…", "SAVED" and "NOT SAVED" with no `aria-live`, `role="status"`, or `aria-atomic`. The same gap exists for ExportOverlay's dynamic button `label` (declared at line 118, rendered at ~line 524) and its progress bar (~lines 525-533, no `role="progressbar"`/`aria-valuenow`).
  - **Fix:** Wrap the SaveBadge label in a `role="status" aria-live="polite"` region, and give the export progress/label area the same treatment (or `role="progressbar"` with `aria-valuenow`/`aria-valuemax`) so state changes are announced.
- [ ] **A11Y-7** · high · a11y — `--muted-3`/`--muted-4` tokens fail WCAG AA contrast against `--bg`, worst in light theme
  - **Where:** `src/app/globals.css:104`
  - **Problem:** Metadata/labels such as '240 SETS', 'STEP 2 — WE FOUND YOUR APP', search-box placeholders, and export file-size text render at contrast as low as 2.66:1 in light mode — effectively unreadable for users with low vision, and a clear WCAG 2 AA failure across a large, systemic slice of the UI rather than an isolated spot.
  - **Evidence:** Computed contrast (WCAG relative-luminance formula): light `--muted-4` (`--color-neutral-500` #9397ab) on light `--bg` (#f3f5fe) = **2.66:1**; light `--muted-3`/`--muted-2` (`--color-neutral-600` #75798c) on the same bg = 3.96:1; dark `--muted-3`/`--muted-4` (`--color-neutral-600` #75798c) on dark `--bg` (#161826) = 4.08:1.
  - **Fix:** Darken (light theme) / lighten (dark theme) the `--muted-3` and `--muted-4` aliases to hit at least 4.5:1 against `--bg`, or restrict `--muted-4` to genuinely decorative/large text and swap real body/label copy to `--muted-2` or `--muted`, which do pass.
- [ ] **A11Y-8** · high · design-drift — Hardcoded `#f5b544` warning color ignores the `--warn` token and collapses to ~1.7:1 contrast in light theme
  - **Where:** `src/components/onstage/screens/DashboardScreen.tsx:62`
  - **Problem:** In light theme, the 'Missing size'/'Missing frames'/'REFLOWED' warning badges on the Dashboard, in the Export dialog, in the AI overlay, and in the Locales tab render with amber text that is nearly invisible against its own pill background — a real warning users are meant to notice becomes the hardest-to-read text on the screen, and it visibly mismatches every other warning indicator in the same screens that correctly uses `var(--warn)`.
  - **Evidence:** `statusTint`/`tagTint` pair a theme-aware background `rgba(var(--warn-rgb),.12)` with a hardcoded foreground `#f5b544` (lines 62 and 71). The identical hardcode recurs in AiOverlay.tsx:283 (`color:${l.badge === "REFLOWED" ? "#f5b544" : "var(--ok)"}`), ExportOverlay.tsx:252 ('Missing frames' badge), and project/LocalesTab.tsx:15 (`reflowed` status).
  - **Fix:** Replace every literal `#f5b544` with `var(--warn)` so it participates in the light/dark alias swap like the rest of the warning color language.

### S6.3 · Responsive and drop targets

- [ ] **A11Y-9** · high · ux — No responsive breakpoints outside the editor's 900px gate — fixed-width layouts overflow on real phones
  - **Where:** `src/components/onstage/screens/LandingScreen.tsx:473`
  - **Problem:** Anyone opening the actual marketing homepage or the dashboard on a phone — the primary way a free, no-account, browser-only tool acquires users — hits a horizontally-overflowing, broken-looking layout; there is no fallback or adaptation, unlike the editor which at least shows NarrowBlock below 900px.
  - **Evidence:** `style={s("max-width:1240px;margin:0 auto;padding:76px 34px;display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:60px;align-items:center")}` — the second grid track is a hard 420px, which alone (plus 68px of padding and the 60px gap) exceeds the width of any phone (390-430px), forcing horizontal overflow on Onstage's public, unauthenticated landing page.
  - **Fix:** Add `@media` breakpoints (or fluid units) for the marketing/dashboard/templates/settings screens' fixed-pixel grid tracks and header widths, at minimum collapsing the `minmax(0,1fr) 420px` split and wrapping the dashboard header below ~700-800px.
- [ ] **EDITOR-21** · medium · ux — Dropping screenshots only works on the small Inspector box, one file at a time; dropping on the canvas navigates away
  - **Where:** `src/components/onstage/DropZone.tsx:34`
  - **Problem:** Dragging five screenshots onto the editor, the obvious first action, either replaces the tab with the image file (leaving the editor and losing any edit still inside the 400 ms debounce), silently does nothing on the filmstrip, or keeps only the first file.
  - **Evidence:** The Inspector DropZone has no `multiple` flag, so `setScreenshots(from, multiple ? urls : urls.slice(0, 1))` (L34) throws away every file after the first, even though they have already been read. The canvas (CanvasStage.tsx:16-20) has no onDragOver/onDrop, and nothing installs a global dragover guard, so the browser's default handling applies.
  - **Fix:** Make each canvas artboard and filmstrip thumbnail a drop target that assigns to that frame and spreads multiple files forward. Enable `multiple` in the Inspector. Add a window-level dragover/drop preventDefault while the editor is mounted.
- [ ] **EDITOR-25** · low · bug — Overlays are positioned against the viewport, not the editor, and break on windows shorter than 760px
  - **Where:** `src/components/onstage/editor/EditorScreen.tsx:142`
  - **Problem:** On a window shorter than 760px (common on 1366×768 laptops), the page scrolls. The backdrop covers only the first viewport-height and the Export dialog doesn't follow the scroll, leaving a strip of the live canvas clickable below it.
  - **Evidence:** The editor root is `height:var(--screen-h,100vh);min-height:760px;...;overflow:hidden` with no `position:relative` (L141-143), and its wrapper is `.wide-only{display:contents}`. The overlays are `position:absolute;inset:0` siblings at root level (L317-319; ExportOverlay.tsx:138), so they are positioned against the initial containing block.
  - **Fix:** Add `position:relative` to the editor root, or render the overlays as `position:fixed`. Reconsider the 760px min-height.

### S6.4 · Editor correctness and performance

- [ ] **EDITOR-11** · medium · bug — In panoramic mode, background picks on any frame except the first do nothing, and "This frame only" just turns panorama off
  - **Where:** `src/components/onstage/editor/Inspector.tsx:195`
  - **Problem:** With panorama on and frame 3 selected, clicking a swatch moves the highlight but changes nothing on screen. Frame 3 then silently picks up that background when panorama is turned off. "This frame only" reads as a scope option but is a hidden panorama toggle.
  - **Evidence:** The canvas uses `const bgId = panorama ? frames[0].bg : fr.bg` (CanvasStage.tsx:28), as does export (renderSet.ts:109). The swatches still call `st.patchFrame({ bg: b.id })` on the active frame (Inspector.tsx:195, ContextBar.tsx:174) and highlight `f.bg === b.id`. The "This frame only" button is `onClick={() => st.setState({ panorama: false })}` (Inspector.tsx:217-225).
  - **Fix:** In panorama mode, route swatch clicks to `frames[0].bg` (or set all frames) and highlight based on `frames[0].bg`. Replace the "Apply to" pair with a real scope control, or label the second button "Turn off panoramic".
- [ ] **GAP-19** · low · perf — Whole-store useOnstage() subscriptions re-render the entire editor on every progress tick and pointermove
  - **Where:** `src/components/onstage/editor/CanvasStage.tsx:10`
  - **Problem:** During an export of 40+ files, each progress tick re-renders all artboards (3D transforms, drop-shadow filters, multi-MB data-URL images) on the same main thread doing the Konva and Three.js work. Tilt dragging re-renders the whole editor on every move.
  - **Evidence:** `useOnstage()` without a selector (a whole-state subscription) appears in CanvasStage:10, EditorScreen:112, Inspector:13, Filmstrip:18, ContextBar:21/254, ExportOverlay:74, AiOverlay:32 and GuidedScreen:81. runExport calls `set({ exportDone, exportTotal })` once per file (store/onstage.ts:284). The tilt/depth pads call patchFrame on every pointermove.
  - **Fix:** Use narrow selectors (useShallow or per-field) in each component, and move export progress into a small separate store or component-local state.

### S9.1 · Per-locale captions

- [ ] **EDITOR-6** · high · fake-ui — Localisation is fake: the language chips change nothing, the Localize tab is static, and edited captions export in English to de-DE/ja-JP/es-ES
  - **Where:** `src/components/onstage/editor/AiOverlay.tsx:11` · also reported as EXPORT-3 (slots.ts:63)
  - **Problem:** The default export locales are EN+DE (onstage.ts:131). After a user edits any headline, adds a frame ("New headline"), uses an AI suggestion or clicks "Rewrite all", the de-DE, ja-JP and es-ES folders contain English captions while the drawer claims they are translated. Clicking JA on the canvas changes nothing, and the "+ Add a language" button opens a list where nothing can be added.
  - **Evidence:** The `LOCALES` array hardcodes "5 of 5 frames translated" and `on: true` (L11-28). Its rows are divs with `cursor:pointer` and no onClick (L246-256). "German runs 22% longer / Frames 2 and 5 reflowed" is static (L308-316), and "Apply to set" only calls `close` (L322). The Filmstrip LANGUAGE chips set `lang` (Filmstrip.tsx:155-163), which nothing renders; grep finds only Filmstrip reading `st.lang`.
  - **Fix:** Store per-locale captions on each frame (e.g. `captions: Record<locale,string>`). Make the lang chip switch which caption the canvas and Inspector show and edit. Have export read those captions, and warn or refuse when a selected locale has untranslated frames. Until then, hide the Localize tab and lang chips, and export only locales that have real text.
  - **Plan note:** Interim guard in S3.3 (export offers only locales that have captions).

### S10.4 · Brand kits that work

- [ ] **SCREENSB-5** · high · fake-ui — BrandScreen's "Apply to set" ignores which brand kit is selected, and font/icon uploads never persist or reach the editor
  - **Where:** `src/components/onstage/screens/BrandScreen.tsx:60`
  - **Problem:** A user who builds a custom brand kit (palette pulled from their icon, uploaded font, replaced icon) and clicks 'Apply to [kit] set' gets the same fixed generic layout every kit produces — their actual brand work never reaches the canvas, and the font/icon they just uploaded vanish the moment they navigate away or reload.
  - **Evidence:** BrandScreen.tsx:58-70's button reads `kit?.name` only for its label text; the handler calls `applyBrandDefaults()` (store/onstage.ts:379-385), which hardcodes `frameColor: "graphite"`, `align: "center"`, and `tiltY: -17, depth: 40` on every frame with zero reference to `kit`, `kitId`, or any of the kit's own `colors`/`defaults` shown on screen.
  - **Fix:** Make `applyBrandDefaults` take the selected kit (or its id) and derive the applied frame color / alignment / tilt from that kit's own `defaults` data instead of a fixed literal, and add backend calls (e.g. `updateBrandKit`) so the font/icon uploads are saved on the kit and available wherever that kit is applied.


---

## Appendix B — Feature status on 2026-09-26

| Area | Feature | Status | What actually happens |
|---|---|---|---|
| A/B test | A/B test results and variants | **fake** | getAbTest returns fixtures (local.ts:419-420). 'RUNNING · DAY 14 OF 14' is literal, and 'Promote variant B' has no onClick (AbTestScreen.tsx:39-49). The project board variant actions just push /editor (ProjectScreen.tsx:221-223). |
| AI | AI caption suggestions and 'Rewrite all in this tone' | **fake** | suggestCaptions ignores the caption and returns 3 hardcoded running-app lines per tone (local.ts:27-43, 414-416). The '22 CHARS · FITS ONE LINE' meta strings are literals. |
| Brand | Brand kits (palette, type, defaults, icon) | **fake** | Creating a kit persists (local.ts:379-402), but the palette is fixture data labelled 'PULLED FROM YOUR APP ICON' (BrandScreen.tsx:162), can't be edited, and is used nowhere in the editor. |
| Editor | Device model picker (iPhone 16 Pro Max / iPhone 15 / iPad / Pixel / No frame) | **fake** | The picker writes `device` (ContextBar.tsx:236), but CanvasStage never passes it to CanvasDevice (CanvasStage.tsx:69-86; device.tsx:99-110 takes no device prop), so the canvas always draws the same iPhone bezel. |
| Editor | Highlight / emphasised words in captions | **missing** | SetFrame.caption is a plain string (types.ts:12). Neither CanvasStage nor renderSet has any rich text or highlight concept, and a grep for 'highlight' finds nothing in the UI. |
| Editor | Custom background colour, gradient or image | **missing** | bg is a preset id resolved by bgCss, which falls back to Ember for unknown ids (data.ts:37). There is no colour input, gradient editor or image-fill option anywhere (no type=color in src). |
| Editor | Screenshot upload (drop or pick onto frames) | **partial** | Real: DropZone reads files as data URLs (readImageFile.ts:5-17), and setScreenshots writes them into frames (onstage.ts:198-206). |
| Editor | Autosave and local persistence | **partial** | Real: a 400ms debounced save goes through saveSetDoc to localStorage (onstage.ts:476-485, local.ts:232-242), and SaveBadge shows the state. |
| Editor | Undo / redo | **partial** | ⌘Z and ⌘⇧Z use zundo with an 80-entry limit (EditorScreen.tsx:38-54, onstage.ts:387-413). There are no undo buttons and no Ctrl+Y. |
| Editor | Caption text editing and fit check | **partial** | The Inspector textarea patches the caption (Inspector.tsx:79-85). It renders on the canvas (CanvasStage.tsx:62) and in the export (renderSet.ts:135-149). The 'fits 6.9″ · 6.5″' line under the box is a literal (Inspector.tsx:92). |
| Editor | Caption styling (font, size, align, colour, position, weight) | **partial** | captionFont, captionSize and align are single set-wide fields (types.ts:25-28, onstage.ts:31-34). There are 4 fonts, loaded from Google Fonts (ContextBar.tsx:409, layout.tsx:26). |
| Editor | App Store / Play Store target toggle | **partial** | The editor top-bar toggle writes `store` (EditorScreen.tsx:177-190). Only StorePageScreen reads it (StorePageScreen.tsx:43). It doesn't change canvas proportions, export picks or the in-editor store overlay. |
| Editor | Keyboard shortcuts | **partial** | Only ⌘/Ctrl+Z, ⌘⇧Z (EditorScreen.tsx:38-54) and ⌘K on the dashboard (DashboardScreen.tsx:84-93) exist. Esc doesn't close overlays or popovers (no key handler in ExportOverlay, AiOverlay, StoreOverlay or ContextBar). |
| Editor | Frames: add, remove, reorder | **real** | addFrame/removeFrame/moveFrame (onstage.ts:153-194) are wired to the filmstrip + button, the hover delete and drag-to-reorder (Filmstrip.tsx:36-140). |
| Editor | Background presets (per frame / apply to all) | **real** | 9 gradient presets (data.ts:14-24) are set per frame via patchFrame (Inspector.tsx:189-201, ContextBar.tsx:168-181), plus applyBgToAll (onstage.ts:208-209). |
| Editor | Panoramic background | **real** | The canvas slices one gradient across frames (CanvasStage.tsx:44-48), and the export matches it (renderSet.ts:118-122). Both preview surfaces ignore it and use fr.bg (StoreOverlay.tsx:71-73, StorePageScreen.tsx:157). |
| Editor | Device frame colour | **real** | 4 finishes (data.ts:47-52) are rendered as CSS on the canvas (device.tsx:18-21, 115) and as PBR metal in the export (geometry.ts:98-103, renderDevice.ts:184, 228-234). |
| Editor | Tilt / 3D perspective, depth, scale, shadow | **real** | The drag pad, depth slider, 4 presets and reset are per frame (ContextBar.tsx:253-403, onstage.ts:334-343). The export renders a Three.js device with the canvas's matched projection (renderSet.ts:151-179, … |
| Editor | Light/dark theme | **real** | next-themes stamps .light (providers.tsx:24-29), and ThemeButton toggles it (chrome.tsx:42-58). The toggle appears only in the editor and guided top bars (EditorScreen.tsx:199, GuidedScreen.tsx:132), not on landing, dashboard or … |
| Editor | Canvas zoom | **real** | zoomIn/zoomOut step 8% within 44–110% (onstage.ts:331-332), wired to the top-bar −/+ (EditorScreen.tsx:212-231). There is no fit-to-screen or pinch/Ctrl+scroll zoom. |
| Error handling | Edge-state behaviours promised on /states | **fake** | The public /states board describes behaviours that aren't implemented: rejecting a 720×1280 PNG (StatesScreen.tsx:12), 'Partial results are always kept' (StatesScreen.tsx:38; |
| Export | Play feature graphic | **fake** | The feature-graphic slot paints a hardcoded teal gradient and the title 'Trailhead' (APP const renderSet.ts:47, 213-238), with frame 1's caption as the tagline (renderSet.ts:243). It uses no set background, app name or brand icon. |
| Export | PNG render and zip download | **partial** | Real core: renderSet renders every size × locale × frame with Konva and Three.js, decodes each PNG and asserts exact dimensions (renderSet.ts:84-96), then zips and downloads it (onstage.ts:294-299). |
| Export | Export sizes | **partial** | There are 6 slots: iPhone 6.9″/6.5″, iPad 13″, Play phone, 7″ tablet and feature graphic (slots.ts:17-24). The landing promises 'phone and 7″/10″ tablet for Play' and a 'Tablet 10″' chip (LandingScreen.tsx:19, 496), but no 10″ … |
| Export | Export formats | **partial** | PNG only (canvasToBlob 'image/png', renderSet.ts:86). Delivery is a single zip only (onstage.ts:294-299). There is no JPEG option, no single-file download and no per-locale zip. |
| Guided mode | Guided 4-step flow | **partial** | Real: step navigation, a multi-file DropZone, a device picker, tilt-for-all and caption edit. Limits: it previews and edits only frames.slice(0,3) (GuidedScreen.tsx:213), and 'Next frame →' cycles modulo 3 (GuidedScreen.tsx:542), … |
| Import | Onboarding: upload / zip / URL routes | **fake** | 'Upload your screens' and 'Import a zip instead' both call setStep(1) (OnboardingScreen.tsx:161, 230-233). That step says 'Trailhead — Run & Trail Log. |
| Import | Import from App Store / Play URL | **fake** | importFromStoreUrl validates the host, then always returns the Trailhead fixture with screenshots: [] (local.ts:244-256). Onboarding shows 'Found Trailhead.' for any URL (OnboardingScreen.tsx:209-221). |
| Localization | AI localisation drawer | **fake** | The Localize tab is a static LOCALES const reporting '5 of 5 frames translated' (AiOverlay.tsx:11-28). The rows have no onClick, so languages can't be toggled (AiOverlay.tsx:246-290). |
| Localization | Localised export output | **fake** | The export's localise() looks captions up in a table holding exactly the 5 sample English captions (slots.ts:39-64) and returns the input unchanged for anything else. exportLangs defaults to ['EN','DE'] (onstage.ts:131). |
| Localization | Per-locale editing, preview and locale list | **missing** | The filmstrip language chips only set `lang` (Filmstrip.tsx:155-160). Nothing reads it: the canvas always renders fr.caption (CanvasStage.tsx:62). |
| Mobile | Mobile / narrow-screen support | **partial** | Below 900px the editor and guided mode are replaced by NarrowBlock (NarrowBlock.tsx, globals.css:249-260), which is honest. |
| Privacy | Deleting your data (privacy-policy promise) | **fake** | The privacy page says 'Deleting a set removes it from this browser' (privacy/page.tsx:33). There is no delete UI, and deleteSet only appends the id to a tombstone list (local.ts:225-228), leaving the doc and base64 screenshots in … |
| Project mgmt | Open a specific app or set from the dashboard | **fake** | App cards push /project?app=<id> (DashboardScreen.tsx:256-257), but ProjectScreen hardcodes APP_ID='trailhead' and never reads the param (ProjectScreen.tsx:17, header 'Trailhead' at :269). |
| Project mgmt | Renders & uploads queue | **fake** | listJobs returns fixture JOBS and ignores appId (local.ts:289). runExport never records a job (onstage.ts:231-320). JobRow's Cancel/Retry/Re-download/View buttons have no onClick (JobRow.tsx:59-70). |
| Project mgmt | Project board (required sizes, variants, activity, locales) | **fake** | SIZE_ROWS, VARIANTS, ACTIVITY and LOCALES are fixtures (local.ts:259-262). 'APPLE 2 OF 2 · GOOGLE 2 OF 3' (ProjectScreen.tsx:68) and '3 SETS · 4 LOCALES' (ProjectScreen.tsx:271) are literals. |
| Project mgmt | Create a new app or screenshot set | **missing** | Backend createApp/createSet/renameSet/deleteSet exist (src/lib/data/local.ts:190-228), but nothing calls them (grep finds only the interface and the implementation). |
| Project mgmt | Rename or delete sets and apps; clean workspace | **missing** | No rename or delete UI anywhere (renameSet/deleteSet have no callers). listApps/listSets always prepend the sample APPS/SETS (local.ts:179-188), so Trailhead/Ferry/Lumen can never be removed. |
| Review | Review and comments | **gated** | /review renders NotFoundScreen while FEATURES.teams is off (review/page.tsx:13, features.ts:18), and ProjectScreen mounts ReviewRow only under the flag (ProjectScreen.tsx:432). |
| Settings | Preferences and work-mode choice | **fake** | The PREFS rows (Interface language, Default store target, Units) are static chips with no handlers (SettingsScreen.tsx:42-58, 210-231). The 'How you want to work' picker writes workMode into the set doc (SettingsScreen.tsx:168). |
| Settings | Accounts / sign-in | **gated** | FEATURES.accounts is off (features.ts:17). /signin and /auth/callback render NotFoundScreen (signin/page.tsx:14, auth/callback/page.tsx:11), and getSession returns the unmetered sample session (local.ts:132-149). |
| Settings | Billing, pricing and export quota | **gated** | FEATURES.billing and FEATURES.exportQuota are off (features.ts:19-20). /pricing renders a 404 (pricing/page.tsx:13), the quota branch is skipped (onstage.ts:240-254), and recordExport is a no-op (local.ts:404-412). |
| Store preview | Store listing preview (in-editor overlay and /store-preview) | **partial** | Uses live captions, backgrounds and tilt. Hardcodes the Trailhead name, 'T' icon, '4.8 ★ · 1.2K ratings' and description (StorePageScreen.tsx:97-135, 207; StoreOverlay.tsx:44-55). |
| Store upload | Upload to App Store Connect / Play Console | **fake** | uploadToStore always returns ok:false after rendering (local.ts:290-309). It checks the fixture sample.CONNECTIONS, not the user's overrides (local.ts:291). |
| Store upload | Store connections (OAuth) | **fake** | connectStore and disconnectStore only flip a localStorage boolean and report 'Connected just now' (local.ts:265-288). The Settings panel shows scopes and a token-expiry line from fixtures (sample.ts:180-202; |
| Templates | Template gallery and apply | **partial** | There are 12 templates (data.ts:80-93), while the UI claims 240 (TemplatesScreen.tsx:42, OnboardingScreen.tsx:36/430, LandingScreen.tsx:393). |
| Templates | Default starter set and sample screen | **partial** | initialFrames hardcode 5 Trailhead running captions with fixed backgrounds and tilts (onstage.ts:98-106, data.ts:54-60). |

---

## Appendix C — Market table stakes (2026)

| Feature | How common | Onstage on 2026-09-26 | Covered by |
|---|---|---|---|
| Current device frames | 19 of 19 dedicated tools | 4 devices; canvas always draws one phone | S4.3, S10.3 |
| Caption font/size/colour/alignment | 19 of 19 | Set-wide only, 4 fonts, no colour | T1–T2, S10.4 |
| Templates / layouts | 18 of 19 | 12 recoloured gradients | Phases 5, 7, 8 |
| Solid / gradient / image backgrounds | 18 of 19 | 9 preset gradients | S10.2 |
| Exact sizes from one design | 17 of 19 | 6 slots, width-only scaling | S4.3, S4.5 |
| Free entry, no account | 18 of 19 free tier; ~2 truly free | Fully free — the opening | — |
| Localisation | 13 of 19 (mostly paid) | Fake | Phase 9 |
| iPad + Android tablet | ~15 of 19 | Uses the phone screenshot | S4.3 |
| Panoramic sets | ≥7 of 19 | Background only | T3 (S8.3) |
| AI captions / directions | 8 of 19 | Canned, now gated | S10.8 |
| 3D device angles | 7 of 19 | Real (Three.js) | — |
| Direct store upload | 6 of 19 | Needs a server; gated | — |
| Clay / flat / frameless styles | ~5 of 19 | Missing | S10.3 |
| Motion export | 4 of 19 | Missing | S10.9 |

Differentiators no competitor ships: store-readiness QA (thumbnail squint test, Play policy lint), free local localisation with strings import, project files as the account substitute, privacy (screenshots never leave the device). Full sources are in the audit report.
