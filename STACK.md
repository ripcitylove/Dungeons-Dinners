# Tech Stack — DnD Legends

Multiplayer D&D 5e experience where **every user is a player and the AI is the Dungeon Master**.
This document is the canonical overview of the technologies the project runs on.

## One-line summary
Next.js 16 (App Router, Turbopack) + React 19 + TypeScript on Vercel, backed by Supabase
(Postgres / Auth / Realtime / Storage), with Claude (Sonnet DM + Haiku helpers), OpenAI image
generation, and ElevenLabs TTS; Stripe + Resend for payments/email; Playwright for e2e.

## Frontend
- **Next.js 16.2.6** — App Router, **Turbopack** bundler.
- **React 19** + **React DOM 19**.
- **TypeScript 5**.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (v4 is CSS/PostCSS-configured — there is no
  `tailwind.config`). Much of the campaign UI uses inline styles.
- Client state is plain React hooks (no Redux/Zustand). Live UI updates arrive over Supabase
  Realtime broadcast.

## Backend
- **Next.js API routes** (`src/app/api/*`) deployed as **Vercel serverless / Fluid Compute
  functions** — there is no separate server process.
- **Supabase** (`@supabase/supabase-js` 2.x) as backend-as-a-service:
  - **Postgres** — core tables include `campaigns` (incl. `objectives` & `npcs` jsonb),
    `campaign_characters`, `campaign_enemies`, `campaign_messages`, `characters`, `scenes`.
  - **Auth** — magic-link / JWT sessions.
  - **Realtime** — broadcast channels (`character_sync`, `npcs_sync`, `level_up_celebration`,
    `dm_response`, turn state, etc.).
  - **Storage** — portrait & scene images (`portraits/`, scene art).

## AI / media services
- **Anthropic Claude** (`@anthropic-ai/sdk`):
  - **Sonnet 4.6** — the Dungeon Master (`/api/chat`), streamed.
  - **Haiku 4.5** — all helper extractors: `chat-state`, `detect-scene`, `enemies/state`,
    `suggest-actions`, `detect-finale`, `reconcile-npcs`, `generate-campaign`,
    `generate-background`, `summarize-history`, `item-details`.
  - **Prompt caching**: the static rules block is cached with a **1-hour** TTL; the conversation
    history uses a **5-minute** breakpoint. Per-route token usage is logged for cost observability.
- **OpenAI `gpt-image-1`** (`openai` SDK) — scene backgrounds, character/NPC/enemy portraits,
  tavern art. Images are cached (scenes by `type+modifiers` in the `scenes` table; portraits by
  slug in Supabase Storage) and generated at `medium` quality.
- **ElevenLabs** — text-to-speech narration (`ELEVENLABS_API_KEY`).

## Platform services
- **Stripe** (`stripe` + `@stripe/stripe-js`) — payments/billing. Currently **dormant**.
- **Resend** (`RESEND_API_KEY`) — transactional email (player invites).

## Hosting / CI / deploy
- **Vercel** — production domain is **mythicmeal.io**. A push to `main` auto-deploys to
  **production**; any other branch is a preview only.
- **GitHub** (`ripcitylove/Dungeons-Dinners`) — `main` = live, `dev` = backup/sync. Nothing is
  pushed unless explicitly requested (see AGENTS.md "Push vs. Deploy Vocabulary").
- **Deploy path**: `node scripts/deploy.mjs deploy --yes` (build-gates first, then promotes to
  `main`). `node scripts/deploy.mjs rollback` restores the previous production build.

## Testing / tooling
- **Playwright** (`@playwright/test`) — e2e browser tests in `tests/e2e/`
  (`npm run test:e2e`; the optimization suite runs via `scripts/run-opt-e2e.mjs`, which mints a
  real session and auto-discovers a live campaign).
- Node test scripts in `scripts/` (`npx tsx scripts/test-*.ts`) — unit coverage for spell slots,
  NPC tags/companions, extractor gate, history window, death saves, encounter cap, etc.
- **ESLint 9** + `eslint-config-next`, **Prettier**, `tsc --noEmit` (`npm run typecheck`).
- **Supabase CLI** (`supabase`) — type generation (`npm run gen:types`) and SQL migrations in
  `supabase/migrations/`.

## Runtime / environment
- **Node.js** (Node 24 LTS on Vercel).
- Secrets live in `.env.local` (dev) / Vercel env (prod): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `ELEVENLABS_API_KEY`, `RESEND_API_KEY`, `STRIPE_*`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INVITE_SECRET`, `NEXT_PUBLIC_BASE_URL`.

---
_Note: this is a heavily-modified Next.js — read the guides in `node_modules/next/dist/docs/`
before assuming framework behavior from older Next versions (see AGENTS.md)._
