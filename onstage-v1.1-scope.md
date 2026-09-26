# Onstage v1.1 — fast-follow scope

> **Source of truth:** `onstage-plan.md` §3.5 (v1.1 fast-follow), §11 (open decisions), §3.0 (competitive floor).
> **Goal:** ship within 3–4 weeks of v1 launch so Onstage clears the 2026 baseline that 8+ rivals already meet.
> **Status:** scoping only. Pre-build. Drafted 2026-05-28.

---

## Why this exists

`onstage-plan.md:99-114` flags AI translation as the **single biggest gap** to a credible 2026 launch — 8 competitors ship it, and English-only reads as unfinished to ASO-minded indie devs. AI caption assist and brand kits round out the same "feels native to the 2026 buyer" floor. None of these are differentiators; they're table stakes the v1 launch will be missing on day one. The goal is to close that gap fast, not to build something flashy.

Per `onstage-plan.md:193-194`, the runtime data model is already locale-ready (`schema.ts:71-73, 127-128`), so the schema work is done — what's left is the product surface (UI + LLM calls + per-locale screenshot copies).

## What's already in place (don't re-do)

- **`localizedContent` hook** on `TextLayerSchema` (`src/lib/schema.ts:71-73`) — per-locale translations keyed by ISO code, optional, empty in v1.
- **`locale` field** on `ScreenshotConfigSchema` (`src/lib/schema.ts:127-128`) — every screenshot knows which locale it renders.
- **Brand colors + fonts already curated** (`src/lib/palettes.ts`, `src/lib/gradients.ts`, `FONT_FAMILY` in `editorDoc.ts:8-15`) — brand kits is a *saving* surface on top of these, not a redesign.
- **Multi-doc store + apply-to-all** — editor v2 board already mutates the whole `docs` map atomically (`docs/decision-log` 2026-05-24). Bulk-creating per-locale screenshots can reuse the same primitive.

## Feature 1 — AI translation / auto-localization

### Decision still open (§11)
- **Claude vs DeepL** for the translation engine. Per `onstage-plan.md:899`: decide week 13.
  - **Claude (recommended):** higher quality on marketing copy and short captions, can be steered with system prompt (tone, app category), pairs naturally with Feature 2 (caption assist) on one call. Cost ~$3/M input + $15/M output (Sonnet 4.6) — a 10-screenshot set into 20 languages is ~2k output tokens × 20 = 40k tokens = ~$0.60. Comfortably below revenue per export.
  - **DeepL:** purpose-built for translation, slightly better idiom handling in some long-tail locales (Polish, Czech), no system-prompt tuning. Pricing is per-character, not per-token. Free tier 500k chars/mo; Pro starts at $7.49/mo + per-char.
  - **Hybrid:** DeepL first pass, Claude rewrite for tone — unnecessarily complex for v1.1. Defer.

### MVP slice
- **Per-locale screenshot copies, not in-place toggles.** Each locale becomes N additional `screenshots` rows for the project, with `config.locale = "es"` and text-layer `content` already translated (we copy translation into `content` at generation time and also into `localizedContent.es` for traceability — see schema note below).
  - Rationale: this is what every competitor does (one set of screenshots per locale, exported as separate zips); fits the multi-doc board naturally; export pipeline doesn't change.
- **UI surface:** a "Translate" action on the project page (not the editor) that opens a dialog:
  1. Pick target languages (multi-select, default top 10 by App Store install share).
  2. Optional: app description + category (steers tone).
  3. Confirm → spawn N×L new screenshots; redirect to the board.
- **Server action `translateProject(projectId, locales, appContext?)`** — owner+editor only, no viewer.
- **One LLM call per locale per project** (batch all captions into one structured prompt to amortize token cost — output is a JSON map of textLayerId→translation).
- **Re-translate** by deleting the locale's screenshots and re-running. Don't try to diff/merge in v1.1.

### Data-model touchpoints
- `screenshots.config.locale` — already there. Set on creation.
- `screenshots.config.layers[].localizedContent` — present in `schema.ts` but **NOT in the runtime `editorDoc.ts:28` TextLayer type**. Two options:
  - **(A) Add `localizedContent?: Record<string, string>` to the runtime TextLayer.** Then per-locale copies carry both English and translated copies, and the editor could in theory switch locale in-place. Cost: every export path that reads `content` would need a "resolve content for current locale" helper.
  - **(B) Keep runtime TextLayer flat.** Per-locale copies hold the translated `content` directly, no schema change. `localizedContent` becomes dead metadata on the schema.
  - **Recommendation: (B) for v1.1.** Cheapest, fits multi-doc board, future "in-place toggle" can come later without breaking anything. Document the choice; revisit if users actually ask for in-place locale switching.
- **New table `translation_jobs`** (optional, P2): track in-flight LLM calls so the UI can show progress; can defer to a synchronous spinner in v1.1.

### Cost guardrails
- **Per-team monthly cap** on translation tokens, enforced server-side. Free plan: 0 (upsell to paid). Solo: 10 projects/mo translated. Team: unlimited.
- **Soft budget alert** at 80% of cap with an upgrade prompt.
- **Don't re-translate** layers whose `content` matches a prior translation — hash-cache on `(content + targetLocale)` in a small `translation_cache` table.

### Effort estimate
- ~10–14 hrs:
  - Translation server action + Claude call: 3 hrs
  - Translate dialog UI + project-page action: 3 hrs
  - Schema/types + bulk insert: 2 hrs
  - Cache table + cap enforcement: 2–3 hrs
  - QA across 5 locales (incl. RTL — Arabic, Hebrew): 2 hrs

### Open questions
- **RTL languages** (Arabic, Hebrew, Urdu): does the layout engine handle `direction:rtl`? **Quick spike needed before locale list includes RTL.** If not, scope RTL out of v1.1 and add as v1.2.
- **App Store locale codes vs ISO codes:** App Store uses `en-US`, `de-DE`; we use plain ISO. Decide which to store (recommend ISO, map to AS locales at export time).
- **App Store screenshot upload (§3.5 backlog):** Out of scope for v1.1; do this separately in month 3+.

---

## Feature 2 — AI caption assist

### MVP slice
- **"Suggest captions" button** in the editor right sidebar (above the caption text field) for any text layer.
  - On click: send the layer's surrounding context (layout preset, current screen image if available, app context if set) → Claude → 3–5 short suggestions → render as a list the user can click to apply.
- **Project-level "app context"** (name, 1-line description, category, audience) saved on the `projects` table — set once on project creation, used by both caption assist AND translation.
- **No personalization or A/B testing** in v1.1 — one model, one prompt, no per-user tuning.

### Pairing with translation
- **The same Claude call** can generate captions AND translate them. Server action `generateAndTranslateCaption(layerId, locales)` is a v1.2 nicety, not v1.1. Keep them separate for now.

### Data-model touchpoints
- `projects.app_context` (new column, jsonb): `{ name, description, category, audience }`. Already partially present via `projects.app_name` / `projects.app_icon_url`.

### Effort estimate
- ~6–8 hrs:
  - Sidebar UI + apply-on-click: 2 hrs
  - Server action + Claude prompt: 2 hrs
  - App-context modal at project creation/edit: 2 hrs
  - QA: 1–2 hrs

### Open questions
- **Voice/tone control:** add a "tone" dropdown (playful, professional, terse) or let the prompt infer from app context? Recommend: infer in v1.1, expose if users ask.

---

## Feature 3 — Brand kits

### MVP slice
- **Per-team saved kit** — one kit per team in v1.1, not many.
  - Fields: name, brand color (single hex), accent gradient (one of the 12 curated), heading font, body font, optional logo image (Supabase Storage upload).
- **Settings → Brand kit** page (alongside Team).
- **Editor surface:** a "Use brand kit" button in the LeftSidebar that:
  1. Sets the screenshot background to the kit's gradient,
  2. Sets every caption layer's font to the kit's heading font,
  3. Sets caption color from kit brand color (or auto-pick from kit gradient luminance, mirroring the templates flow).
- **Apply-to-all integration:** the existing `applyToAll` machinery already propagates Background and Typography (`docs/decision-log` 2026-05-24). Brand kit re-uses these primitives.

### Data-model touchpoints
- **New table `brand_kits`** (one row per team initially):
  ```sql
  create table public.brand_kits (
    team_id uuid primary key references public.teams(id) on delete cascade,
    name text not null default 'Default',
    brand_color text,             -- hex
    gradient_id text,             -- references the curated gradient by id
    heading_font text,            -- from FONT enum
    body_font text,
    logo_asset_id uuid references public.assets(id),
    updated_at timestamptz default now()
  );
  ```
- RLS: members read; owners write.

### Effort estimate
- ~6–8 hrs:
  - Migration + RLS: 1 hr
  - Settings page (read/edit form, image upload): 3 hrs
  - Editor "Use brand kit" wiring: 2 hrs
  - QA: 1–2 hrs

### Open questions
- **Multi-kit per team:** punt. v1.1 = one kit per team. Add multi-kit when a customer asks.

---

## Cross-cutting decisions

| # | Decision | Recommendation | Resolve by |
|---|---|---|---|
| 1 | LLM provider | **Claude** for both translation and caption assist (one call, one bill, better marketing tone) | Before v1.1 build kicks off |
| 2 | Locale code format | **ISO 639-1** (e.g. "es", "ja"); map to App Store locales at export time | v1.1 build start |
| 3 | RTL support in v1.1 | **Spike first.** If layout engine handles `direction:rtl`, include; else defer to v1.2 | Week 12 (during launch wait) |
| 4 | Cost-cap enforcement | Server-side, per-team, per-month. Free plan = 0 AI usage. | v1.1 build start |
| 5 | Schema runtime/zod parity | Adopt Option (B) above: per-locale screenshots, not in-place `localizedContent` resolution | v1.1 build start |

## Sequence

1. **Spike (1 day, week 12)** — RTL layout check, Claude prompt prototyping on 5 locales, capture per-locale cost.
2. **Translation (~2 weeks)** — server action → dialog → cache → cap.
3. **Caption assist (~1 week)** — uses the same provider integration.
4. **Brand kits (~1 week)** — independent; can ship in parallel with caption assist if any time bandwidth.

Total: ~3–4 weeks at 12–15 hrs/week, matching the §3.5 "weeks 13–16" window.

## Success criteria

- A new project can be translated into 10 locales in under 2 minutes wall-clock.
- Translated screenshots export at exact App Store dimensions per locale.
- AI caption suggestions are accepted by the user at least 30% of the time (PostHog event).
- Translation cost stays under $0.10 per export-set on average.
- No regression in v1 export quality.

## Out of scope for v1.1 (revisit month 3+ per `onstage-plan.md:204-218`)

- Direct App Store Connect / Google Play upload
- Real-time multi-user sync / canvas co-editing
- SSO for team tier
- 3D device frame coverage beyond what v1 ships
- Video / animation export
- Figma plugin
- Programmatic API
- Template marketplace
