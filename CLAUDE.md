@AGENTS.md

# Onstage

Web-based App Store / Google Play screenshot generator for indie devs and small
teams. The UI is a faithful implementation of the Claude Design handoff in
`app-screenshot-generator-ui-mockups/` — that bundle is the spec; read it before
changing how anything looks.

> ⚠️ This project is on **Next.js 16** (App Router), which has breaking changes vs. earlier versions. Per AGENTS.md, check `node_modules/next/dist/docs/` before writing Next-specific code.

## Stack
Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 (tokens only — the
UI is inline styles, see Conventions) · Zustand + zundo (editor state + undo) ·
Three.js + Konva + JSZip (export, all lazily loaded) · next-themes.

Backend is **not wired yet**. Everything reads through `src/lib/data/backend.ts`;
Supabase is meant to replace `src/lib/data/local.ts`.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type check

## Layout
- `src/app/` — one route per designed screen (landing, pricing, signin,
  onboarding, dashboard[/empty], project, templates[/slug], brand, editor,
  guided, store-preview, review, settings, ab-test, queue, states, mobile,
  auth/callback, not-found)
- `src/components/onstage/` — every screen and shared piece
  - `editor/` — the canvas: stage, context bar, popovers, filmstrip, inspector,
    and the export / AI / store overlays
  - `screens/` — the non-canvas screens; `screens/project/` holds the project
    board's tabs
- `src/lib/onstage/` — `css.ts` (the CSS-string → React style parser), `data.ts`
  (backgrounds, devices, tilt presets, templates), `export/` (the render
  pipeline)
- `src/lib/data/` — the domain types, the `Backend` interface (20 reads +
  writes), the local implementation, `useQuery` and `useSession`
- `src/store/onstage.ts` — the editor document, undo history and local persistence

## Currently disabled — read before re-implementing anything
Onstage ships as a **free, no-account tool that runs entirely in the browser**.
The account-shaped surfaces are **built and gated, never deleted** — every
screen, component, `Backend` method, type and fixture is still in the repo.

The switches live in **`src/lib/features.ts`**, read from `NEXT_PUBLIC_FEATURE_*`
(inlined at build time; see `.env.local.example` and `deploy.yml`). All ten are
**off**:

| Flag | What it turns off |
|---|---|
| `accounts` | `/signin`, `/auth/callback`, the dashboard avatar + `EmptyScreen` chip, Settings → Account identity card and Notifications |
| `teams` | `/review`, Settings → Team, `listMembers`, collaborator chrome |
| `billing` | `/pricing`, Settings → Plan & billing, the plan tables on the landing + mobile boards |
| `exportQuota` | the 5-export allowance, its enforcement branch, and `recordExport` metering |
| `storeUpload` | store destinations in the export dialog, Settings → Store connections, Reconnect, "Push live" |
| `aiAssist` | the AI caption / localise drawer and every control that opens it |
| `abTest` | `/ab-test` and the project board's variant cards |
| `jobQueue` | `/queue`, the project board's Uploads tab and Activity feed |
| `storeImport` | store-URL import (onboarding, guided) |
| `designBoards` | the design-review boards `/states` and `/mobile` |

The last six are the fixture-only surfaces (plan D3): each shows invented data
or can never succeed without a server. So far they only drop their routes from
`sitemap.ts` and disallow them in `robots.ts`; the call-site gating lands with
plan step S3.1.

> ⚠️ **The handoff bundle still contains the pricing, sign-in and team
> artboards.** They are design history, not a to-do list. Do not re-implement
> them from `app-screenshot-generator-ui-mockups/` — change a flag instead.

Things worth knowing before touching this:
- Gated routes keep their `page.tsx` and render `<NotFoundScreen />`. Static
  export supports no redirects, rewrites, headers or middleware, so there is no
  server-side gate available.
- A gated cluster of hooks is **conditionally mounted, never early-returned** —
  see `screens/settings/{BillingPanel,AccountIdentityCard,NotificationsPanel}`
  and the small components at the top of `DashboardScreen`/`ExportOverlay`.
- Gate at the **call site** or return an empty value; never shrink the `Backend`
  interface, and never gate by throwing (`useQuery` turns a rejection into a red
  error panel).
- `exportBlockedByQuota` stays in the state shape, permanently `false` — the
  export error card is shared with store-upload failures.

## Conventions
- **The design file is the spec.** Screens are built from the mockup's own
  `style="…"` strings, parsed by `s()` in `src/lib/onstage/css.ts`. Keep the
  strings; do not hand-translate them to Tailwind or camelCase objects.
- **Tokens live in `globals.css`** — the Nocturne set (`--bg`, `--surface`,
  `--accent`, `--ink-rgb`, `--ok`, `--warn`, …). Dark is the default; `.light`
  swaps the aliases. Never hardcode a UI colour that a token covers.
- **Artwork is not chrome.** Anything rendered *inside* a device frame (the
  sample screen, the user's screenshot) keeps fixed colours — it must look the
  same in both themes and in the exported PNG.
- **All data goes through `getBackend()`.** No screen imports `sample.ts`
  directly. Adding a Supabase implementation means writing one module and
  calling `setBackend()`; screens already handle loading and error states via
  `useQuery` + `<Async>`. Points that need real infrastructure — OAuth URLs,
  listing scraping, invoice PDFs, the upload itself — are marked
  `SUPABASE SEAM` in `lib/data/local.ts`.
- **The set document is a backend record.** `openSet(setId)` loads it and
  installs the debounced autosave; the canvas never touches storage itself.
- **The heavy renderers are lazy.** `three`, `konva` and `jszip` are only
  reachable through dynamic `import()` inside `src/lib/onstage/export/`. Keep
  them out of the main bundles.
- Export output must be pixel-exact: `renderSet` decodes every PNG and asserts
  its dimensions before zipping.
