# AtelierM 会計 (digital bookkeeping)

Mobile-first web app that turns a **photo of a handwritten material-cost memo** into bookkeeping
records: Claude vision reads the memo, you confirm/correct it, and it records attendance + the
income/expense ledger. The official records live in a Postgres (Supabase) database; the existing
Excel workbook is produced on demand as an **export**.

See `../AtelierM-kaikei-prompt.md` for the domain rules this implements, and
`../.claude/plans/witty-gliding-moon.md` for the design.

## Architecture

- **Next.js 16** (App Router, TypeScript, Tailwind) — UI + API routes.
- **Supabase** — Postgres, (optional) Auth, Storage for memo images.
- **Anthropic SDK** — Claude vision OCR via tool-use (`lib/anthropic.ts`, `lib/ocr/schema.ts`).
- **exceljs** — Excel export written into a copy of the original workbook (formulas preserved).

Core logic is pure and unit-tested in `lib/domain/`:
- `validation.ts` — 単価×数量=金額 and Σ=合計 checks.
- `ledger.ts` — 備考 routing (ア → income only; ひ/other/none → income + expense) and aggregation.
- `match.ts` — resolve memo person/date to member/session.

## Setup

1. **Install**
   ```bash
   npm install
   cp .env.example .env.local   # then fill in values
   ```

2. **Supabase**: create a project, then run `db/schema.sql` in the SQL editor. Create a Storage
   bucket named `memos`. Put the project URL + anon + service-role keys in `.env.local`.

3. **Seed** members/sessions from the existing workbook:
   ```bash
   npx tsx db/extract-seed.ts   # workbook → db/seed-data.json (offline)
   npx tsx db/seed.ts           # seed-data.json → Supabase
   ```

4. **Anthropic**: put `ANTHROPIC_API_KEY` in `.env.local`. Model defaults to `claude-sonnet-4-6`
   (`ANTHROPIC_OCR_MODEL`); switch to an Opus id if handwriting accuracy is low.

5. **Run**
   ```bash
   npm run dev      # http://localhost:3000
   npm run build    # production build
   npx tsx --test lib/domain/domain.test.ts   # domain unit tests
   ```

## Flow

`/memos/new` → take/upload photo → `POST /api/ocr` (Claude) → review table with ✅/❌ validation →
pick member + session (auto-suggested) → `POST /api/memos` (persists + marks attendance).
`/ledger` shows derived income/expense per session. `/api/export` downloads the `.xlsx`.

## Notes

- The original workbook (`../AtelierM_kaikei2026 ____.xlsx`) is used **read-only** as the export
  template; it is never modified.
- DB access uses the service-role key from server code only (single-user app). Front the app with a
  password / Supabase Auth before exposing it publicly.
