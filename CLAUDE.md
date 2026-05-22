@AGENTS.md

# Onstage

Web-based App Store / Google Play screenshot generator for indie devs and small teams. See `../onstage-plan.md` for the full product/build plan.

> ⚠️ This project is on **Next.js 16** (App Router), which has breaking changes vs. earlier versions. Per AGENTS.md, check `node_modules/next/dist/docs/` before writing Next-specific code.

## Stack
Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · shadcn/ui · Konva + react-konva (editor) · Zustand + zundo (editor state/undo) · TanStack Query (server state) · Zod (validation) · React Hook Form · dnd-kit · Supabase (Postgres/Auth/Storage) · Stripe · Resend · PostHog · Sentry · JSZip (export).

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type check
- `npx supabase start` / `npx supabase db reset` — local DB + apply `supabase/migrations`

## Layout
- `src/app/(editor)/project/[id]/screenshot/[sid]/` — the screenshot editor route
- `src/components/editor/` — `Canvas` (Konva, client-only), `EditorCanvas` (dynamic `ssr:false` loader), `TopBar`, `LeftSidebar`, `RightSidebar`
- `src/components/ui/` — shadcn components
- `src/lib/schema.ts` — Zod `ScreenshotConfig` (single source of truth for the editor doc; **locale-ready** for v1.1 translation)
- `src/lib/{devices,palettes,gradients}.ts` — curated data (starter subset; full sets in Phase 2)
- `src/lib/supabase/{client,server}.ts` — Supabase clients
- `src/store/editor.ts` — Zustand store (undo/redo via `useEditorStore.temporal`)
- `supabase/migrations/` — schema + RLS

## Conventions
- **Konva must never render on the server** — import it only through `EditorCanvas` (`next/dynamic`, `ssr:false`).
- Editor document state flows through the Zod `ScreenshotConfig`; validate at boundaries.
- Env vars: copy `.env.local.example` → `.env.local`. The UI shell boots without secrets; auth/billing need them.
