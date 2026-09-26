# Task: run Onstage as a free, frontend-only tool — no login, no teams, no payments

## What you're changing

Onstage currently presents itself as a SaaS: sign-in, plans at $12/$29, an export
quota, team seats and invites. The owner wants it to be a **free tool that runs
entirely in the browser with no account**.

**Nothing may be deleted.** All of it gets re-enabled later. Every screen,
component, backend method, type and sample fixture stays in the repo — you are
turning surfaces *off behind flags*, not removing them. If a change would delete
a file, a component, a `Backend` method or a type, you are doing it wrong.

Read `CLAUDE.md` and `AGENTS.md` first. This is Next.js 16 (App Router) — check
`node_modules/next/dist/docs/` before writing Next-specific code.

---

## Constraints that will bite you

These come from an audit of the actual codebase. Treat each as a hard fact.

### 1. There is no server-side gate available

The GitHub Pages build runs `output: "export"` (`next.config.ts`, gated on
`NEXT_PUBLIC_STATIC_EXPORT`). Per
`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, **redirects,
rewrites, headers, proxy and middleware are all unsupported**. There is also no
`src/middleware.ts` and no route guard anywhere.

So you cannot redirect `/pricing` → `/`. Every `page.tsx` left in `src/app/`
keeps emitting static HTML that GitHub Pages serves with a 200.

**Do:** keep the route files, and have the gated ones render the app's own
`<NotFoundScreen />` when the flag is off. Then drop those paths from
`src/app/sitemap.ts` **and** add a `disallow` for them in `src/app/robots.ts`
(which currently allows everything with the comment "Public demo").

**Do not:** `export default FLAGS.auth ? SignInPage : null` — `next build` fails
with "The default export of a page must be a React Component".

### 2. Gating JSX does not gate the hooks above it

`SettingsScreen.tsx:100-105` calls `useSession()`, `useQuery("usage")` and
`useQuery("invoices")` unconditionally at the top of the component, above every
`tab === "…"` branch. Same shape at `TeamPanel.tsx:14` and
`ExportOverlay.tsx:56`.

Adding `if (!FLAGS.billing) return …` above those hooks is a
`react-hooks/rules-of-hooks` **error** in this config.

**Do:** extract each gated cluster into its own child component that is
*conditionally mounted*. `TeamPanel` is already extracted — follow that pattern
and pull out `BillingPanel` (the whole `tab === "Plan & billing"` body, plus its
`usage`/`invoices` reads) and `AccountIdentityCard` (the avatar + name + email +
Sign out block). The parent then renders `{FLAGS.billing && <BillingPanel />}`
and the hooks never run.

### 3. The toolchain will not catch your mistakes

- Next 16 removed linting from `next build`.
- `.github/workflows/deploy.yml` runs only `npm ci` + `npm run build`.
- `@typescript-eslint/no-unused-vars` is a **warning**; `tsconfig.json` sets no
  `noUnusedLocals`. Orphaned imports pass silently.
- `typedRoutes` is **off**, so dead `href`s are invisible to both `tsc` and eslint.
- There is no unused-*export* rule at all.

**Do:** add `npm run lint -- --max-warnings 0` to `.github/workflows/deploy.yml`
as part of this change, and hand-audit every `href` in the list below. The repo's
lint baseline is currently clean — keep it that way.

### 4. The `Backend` interface must not shrink

`src/lib/data/local.ts` assigns one annotated object literal to
`const localBackend: Backend`. Removing a method from the interface makes that
literal fail excess-property checking (TS2353), and the type imports at
`backend.ts:1-24` start warning.

**Do:** keep all 25 methods. Gate at the **call site**, or return an empty/no-op
value from the implementation. Never comment a method out of the interface.

**Do not** gate by throwing: `useQuery` turns any rejection into `error`, and
`<Async>` renders a red "Couldn't load this" panel with a Try-again button. A
disabled feature would surface as a prominent error box.

### 5. `getSession() → null` is not a kill switch

It type-checks perfectly (already `Promise<Session | null>`, every consumer uses
`?.`) which is exactly the trap — the compiler will not point at a single one of
these:

| File | What renders with a null session |
|---|---|
| `DashboardScreen.tsx:128-137` | avatar chip reading `"··"`, `aria-label="Account settings"`, still links to `/settings`. **No `session.data &&` guard** — unlike the plan pill at 110-118, which does hide itself. |
| `SettingsScreen.tsx:410,415,421` | `"··"` avatar, name `"—"`, and a dangling `" · joined Nov 2025"` |
| `ExportOverlay.tsx:539-540` | footer reads **"Unlimited on your plan"** — plan language in a plan-free build |

Each needs its own explicit render guard.

Also: `localBackend.getSession` returns null when
`localStorage["onstage:session:v1"] === "out"`. The only thing that clears that
sentinel is signing in — which you're about to gate. Anyone who ever clicked
Sign out is permanently stuck. **The flagged `getSession` must ignore or clear
that key.**

### 6. Identity leaks outside the session

`sample.ts` `CONNECTIONS[0].sub` is the literal string
`"mk@trailhead.app · token expires in 41 days"`. It renders in two places that
**survive** every flag: `SettingsScreen.tsx:621` (Store connections tab) and
`ProjectScreen.tsx:319` (project board sidebar). A no-login build would show a
stranger's email on the main project screen. Reword the fixture.

`EmptyScreen.tsx:31` hardcodes the initials `"MK"` and never calls `useSession`,
so no session flag reaches it.

### 7. Two hardcoded row indexes break the moment you filter an array

- `SettingsScreen.tsx:697` — `i < 4` over `NOTIFY` (5 entries)
- `MobileScreen.tsx:259` — `i < 4` over `NAV` (5 entries)

Change both to `i < arr.length - 1` **before** filtering either array, or the
last visible row gets a stray border and the correct one loses it.

### 8. `listMembers` crashes if you empty the fixture

`local.ts:294` is
`invited.length ? [...base.slice(0, -1), ...invited, base[base.length - 1]] : base`
— it assumes `sample.MEMBERS` is non-empty and its last row is the "seat
available" placeholder. Emptying `MEMBERS` while a locally-invited member exists
pushes `undefined` into the array and `TeamPanel` dies on `m.name.split(" ")`.

**Short-circuit inside `listMembers` (return `[]`). Never empty the fixture.**

### 9. Settings' default tab is itself a gated surface

`SettingsScreen.tsx:91-94`:
```ts
const initial = NAV.indexOf(params.get("tab") ?? "") >= 0 ? params.get("tab")! : "Plan & billing";
```
Panels are five sibling `{tab === "…" && …}` conditionals with **no default
branch**. Filter `NAV` without fixing this and bare `/settings` renders a nav
rail beside an empty column — reachable from the dashboard avatar
(`DashboardScreen.tsx:129`) and the 404 page (`NotFoundScreen.tsx:55`).

Make the fallback *the first visible tab*, computed from the flags.

Four places deep-link by exact display string, `+`-encoded — these must keep
working: `JobRow.tsx:95`, `ProjectScreen.tsx:322`, `ExportOverlay.tsx:408`, and
`local.ts:237` (a UI deep link returned as data from `connectStore`).

### 10. Settings > Account is NOT purely an identity tab

Below the identity card it hosts the **guided/canvas work-mode picker** (writes
`workMode` into the editor store, read by the editor top bar's `ModeSwitch`) and
the **Preferences** panel. Both belong in a login-free build.

**Gate only the identity card (`~lines 401-437`). Never drop the tab.** Rename it
"Preferences" when accounts are off.

### 11. `EmptyScreen` imports from `OnboardingScreen`

`EmptyScreen.tsx:7` imports `ROUTE_CARD`, `ROUTE_ICON`, `START_ROUTES` from
`OnboardingScreen.tsx`. Onboarding is not a gateable leaf module — any gate must
be inside the component, not around the module. (Onboarding itself contains zero
auth and needs no gating; only its signup-flavoured labels need rewording.)

---

## The flag module

Create `src/lib/features.ts`. It must be **isomorphic and build-time constant** —
`sitemap.ts`, `robots.ts` and `opengraph-image.tsx` are `dynamic = "force-static"`
server modules that need to import it, so **no `"use client"`, no `window`, no
`localStorage` at import time.**

```ts
/**
 * Onstage runs as a free, local, no-account tool. The account-shaped features
 * are built and gated here rather than deleted — flipping one of these back on
 * (plus its env var in CI) restores the full surface.
 */
export const FEATURES = {
  accounts: process.env.NEXT_PUBLIC_FEATURE_ACCOUNTS === "true",
  teams: process.env.NEXT_PUBLIC_FEATURE_TEAMS === "true",
  billing: process.env.NEXT_PUBLIC_FEATURE_BILLING === "true",
  exportQuota: process.env.NEXT_PUBLIC_FEATURE_EXPORT_QUOTA === "true",
} as const;
```

Do **not** read the flag from `localStorage` during render — it collides with
`react-hooks/purity` (error severity) and hydration-mismatches against the HTML
that `output: export` bakes at build time.

`NEXT_PUBLIC_*` is inlined at build time and `deploy.yml` currently sets only
`NEXT_PUBLIC_STATIC_EXPORT` and `NEXT_PUBLIC_BASE_PATH`. Document the new vars in
`.env.local.example` (which today claims "The app is fully client-side (no
backend)" — update that too).

---

## The work

### A. Routes to gate — render `<NotFoundScreen />` when the flag is off

| Route | Flag |
|---|---|
| `/signin` (`src/app/signin/page.tsx`) | `accounts` |
| `/auth/callback` (`src/app/auth/callback/page.tsx`) | `accounts` |
| `/pricing` (`src/app/pricing/page.tsx`) | `billing` |
| `/review` (`src/app/review/page.tsx`) | `teams` — see decision D3 |

Then: drop `/pricing` and `/signin` from `src/app/sitemap.ts`, and add a
`disallow` for the gated paths in `src/app/robots.ts`.

### B. Every inbound link to a gated route — 11 sites, all inline strings

There is no shared route-constant module (`src/lib/routes.ts` was removed), so
each must be gated at its own call site:

**→ `/signin`:** `LandingScreen.tsx:287` (nav "Sign in"),
`SettingsScreen.tsx:428` (after signOut), `AuthCallback.tsx:75` ("Back to sign
in"), `sitemap.ts:36`

**→ `/pricing`:** `LandingScreen.tsx:280` (nav), `:509` ("Pricing" beside "See an
export"), `:566` (footer), `DashboardScreen.tsx:121` ("Upgrade"),
`SettingsScreen.tsx:215` ("Change plan"), `ExportOverlay.tsx:398` ("See plans")

**→ `/review`:** `ProjectScreen.tsx:412` ("THIS SET" card),
`NarrowBlock.tsx:93` ("Review this set")

Nothing links to `/auth/callback` today (`local.ts` `signInWithProvider` returns
`redirectTo: "/dashboard"`), so it costs nothing.

While you're in `LandingScreen`: `Changelog` at line 283 is a bare `<span>`
styled as a link with no `href` — already dead. `MobileScreen`'s NAV lists
`Changelog` and `Docs`, neither of which has a route. Fold these into the pass.

### C. Account / identity chrome

- `DashboardScreen.tsx:110-118` plan pill — gate on `billing`
- `DashboardScreen.tsx:121` "Upgrade" — gate on `billing`
- `DashboardScreen.tsx:128-137` avatar — gate on `accounts`; when off, either
  drop it or replace with a settings-cog link (it is the only path to `/settings`
  from the dashboard, so **do not** simply delete it)
- `SettingsScreen.tsx:401-437` identity card + Sign out — gate on `accounts`
- `EmptyScreen.tsx:31` hardcoded `"MK"` chip — gate on `accounts`
- `sample.ts CONNECTIONS[0].sub` — reword to drop the email

### D. Teams

- `SettingsScreen.tsx` NAV `"Team"` entry + line 680 `<TeamPanel />` — gate on `teams`
- `local.ts` `listMembers` — return `[]` when `teams` is off (see constraint 8)
- `ReviewScreen.tsx:15,89,238` collaborator avatars + `:93-101` "Invite reviewer"
  (which has **no `onClick` today** — already inert chrome)
- `ProjectScreen.tsx:412` hardcodes the badge `"3 OPEN"` — not read from
  `listComments`, so it is wrong either way; fix or gate it

### E. Billing

- `SettingsScreen.tsx` NAV `"Plan & billing"` + the panel at line 180 → extract
  to `BillingPanel`, mount on `billing`
- `SettingsScreen.tsx:196` — the plan name is the **string literal `"Indie"`**,
  not `session.plan`, and already contradicts `sample.SESSION.plan === "free"`.
  Do not treat `Session.plan` as the billing switch.
- `MobileScreen.tsx:173-236` — a **duplicate, independent** plan table. Gating
  `/pricing` alone leaves `/mobile` advertising `$0/$12/$29` and "5 seats".

### F. Export quota — three gates, not one

1. `store/onstage.ts:236-247` — the enforcement branch. Gate on `exportQuota`.
2. `store/onstage.ts:283` — `void getBackend().recordExport(files.length)`.
   **This must stop writing.** `local.ts:99-103` adds the stored counter on top
   of `sample.SESSION` (3 used of 5), so if metering keeps running during the
   free era, the day billing is re-enabled every returning user is instantly over
   quota.
3. `ExportOverlay.tsx:56-60,539-545` — the footer meter. Gate the `session` read
   and replace the copy (see G).

Also set `sample.SESSION.exportsAllowed: null` (`types.ts` documents
`null = unlimited`).

**Leave `exportBlockedByQuota` in the state shape, permanently `false`.** The
export error card at `ExportOverlay.tsx:378-425` is shared with store-upload
failures, and the `!st.exportBlockedByQuota` guards at lines 406/416 control the
"Reconnect" / "Download instead" buttons. Removing the flag changes their
behaviour.

### G. Copy — the largest surface, 61 strings

The plan matrix and the hero promise are **duplicated verbatim** between
`LandingScreen` and `MobileScreen`. Change both or the mobile mock keeps selling
a subscription.

| File | Current | Suggested |
|---|---|---|
| `LandingScreen.tsx:~251` | "5 free exports · then $12/mo" | "Free · runs in your browser" |
| `LandingScreen.tsx:~324` | "NO ACCOUNT NEEDED TO TRY IT" | "NO ACCOUNT, NOTHING UPLOADED" |
| `LandingScreen.tsx:~339` | "…Sign up only when you want the files." | "…Your screenshots never leave your browser." |
| `LandingScreen.tsx:~295` | nav "Start free" → `/onboarding` | "Start a set" |
| `MobileScreen.tsx:~167` | "5 free exports · then $12/mo" | match landing |
| `MobileScreen.tsx:~98` | "NO ACCOUNT NEEDED" / "Sign up only for the files." | match landing |
| `ExportOverlay.tsx:539` | "Unlimited on your plan" | "Renders in your browser" |
| `NotFoundScreen.tsx:~36` | "…the link belongs to another account. Deleted sets are recoverable for 30 days from Settings." | drop the account clause |
| `terms/page.tsx` | the whole "Billing" section | replace with a no-payment statement |
| `privacy/page.tsx` | "Your account email, the sets you build…" / "recoverable for 30 days from Settings" | drop the account clauses |

Two feature cards on the landing page promise server capability the build does
not have — `"Straight into the stores"` (OAuth upload) and `"Captions in 30
languages"` (AI). Decide whether to soften them.

`/states` cards "Store token expired", "Someone else edited this" and "Offline"
all assume a server or collaborators. That screen is a design reference board
with inert buttons and no inbound links — lowest priority, but note it.

**Termly caveat:** if `NEXT_PUBLIC_TERMLY_*` UUIDs are set, `/privacy` and
`/terms` render a remote embed and the hardcoded `sections` **never render**
(`LegalPage.tsx:23,45-53`). Editing that copy has zero effect on the live site;
the real text must be changed at Termly.

### H. One-time localStorage cleanup

Stale keys will misbehave across the flip:
`onstage:session:v1` (stuck `"out"` → permanent null session),
`onstage:exports-used:v1` (poisoned counter),
`onstage:members:v1` + `:roles` (invited teammates reappear if `teams` flips on),
`onstage:cancelled:v1` (a cancellation that no longer means anything).

### I. Documentation

`CLAUDE.md` says *"The design file is the spec … read it before changing how
anything looks"*, and the handoff bundle
(`app-screenshot-generator-ui-mockups/project/*.dc.html`) still contains the
pricing, sign-in and team artboards. **Without a note there, the next agent will
faithfully re-implement everything this change just turned off.** Add a
"Currently disabled" section to `CLAUDE.md` naming the flags and pointing at
`src/lib/features.ts`.

---

## Decisions to confirm before starting

- **D1 — Store connections.** `/settings?tab=Store connections` is an
  OAuth-to-vendor surface, not login/teams/payments. Recommendation: **keep it**
  (it already tells the truth about needing a backend), but fix the email leak in
  constraint 6. If you'd rather hide it, four deep links break.
- **D2 — Notifications tab.** It is an email-delivery preference list. With no
  account and no server there is nothing to email. Recommendation: gate on
  `accounts`.
- **D3 — `/review`.** Comments work fine single-player as per-frame self-notes,
  but the seeded threads are from "Jamie Doyle" and "Ana Ruiz". Recommendation:
  gate the whole route on `teams` for now. The alternative — keep comments,
  gate only the collaborator chrome — needs the sample data rewritten as
  self-notes.

---

## Definition of done

- `npm run lint` — clean, zero warnings (baseline is currently clean)
- `npx tsc --noEmit` — clean
- `npm run build` — succeeds; note the route count changes
- Every route still loads with no console errors; walk `/`, `/dashboard`,
  `/project` (all three tabs), `/templates`, `/editor` (export dialog open),
  `/guided`, `/settings` (every visible tab **and** bare `/settings` with no
  `?tab=`), `/brand`, `/queue`, `/store-preview`
- `/signin`, `/pricing`, `/auth/callback` render the 404 body
- No `$12`, `$29`, "Sign in", "Upgrade", "seats" or "plan" string is reachable
  from any live screen
- Export runs unlimited; `onstage:exports-used:v1` is **not** written
- Flipping every flag to `true` restores the current behaviour exactly — verify
  by building once with all four env vars set

## Do not

- Delete any file, component, `Backend` method, type or sample fixture
- Shrink the `Backend` interface (TS2353 — see constraint 4)
- Remove the `SUPABASE SEAM` comments in `local.ts` and `AuthCallback.tsx` —
  they are the re-enablement map
- Add an early return above an existing hook (rules-of-hooks error)
- Reach for `redirects()` in `next.config.ts` (unsupported under `output: export`)
