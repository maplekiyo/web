# AtelierM 会計 — API Specification

Server-side technical design for the AtelierM digital bookkeeping app: domain logic, data model,
OCR pipeline, API endpoints, and operations. The official records live in a Postgres (Supabase)
database.

For product vision, domain rules, and user stories, see
[`AtelierM_Bookkeeping_PRD.md`](./AtelierM_Bookkeeping_PRD.md). The business rules referenced
below (備考 routing, aggregation, halt-on-mismatch validation) are defined there; this document
covers their server-side implementation. For the UI that consumes these endpoints, see
[`AtelierM_Bookkeeping_UI_Spec.md`](./AtelierM_Bookkeeping_UI_Spec.md).

---

## 2. Domain Logic Implementation

The product's business rules (see PRD §4) are implemented as pure functions:

- **備考 routing & attribution** (`lib/domain/ledger.ts`): every line is income; a line is also
  expense unless its `note` is `"ア"` or `"none"`. The `note` preserves the **literal circled
  character** as written — `"ア"`, `"ひ"`, `"き"`, … — with `"none"` as the sentinel for nothing
  circled. For expense lines the character also identifies
  the **member who fronted** the purchase (立替), enabling per-member expense attribution:
  `"ひ"` → 高桑博子, `"き"` → 保科希代美 (きよよん); `"ア"` denotes AtelierM's own stock, so it has
  no fronter. `MemoNote` is therefore the literal-character string (with the `"none"` sentinel), not
  a closed enum.
- **Aggregation**: within a session/section, lines sharing a part name are summed into one ledger entry, preserving first-seen order.
- **Per-member expense**: expense lines are also grouped by their **fronting member** — resolved from the line's `note` character — to produce a per-member 支出 breakdown for a session. `ア`/`none` lines carry no fronter and are excluded from this breakdown.
- **Attendance**: the members **present** in a session are derived as those with a `posted` memo that session. (Children attend without authoring memos, so this captures memo authors only — see §6.)
- **Validation**: `validateMemo` / `validateMemoAmounts` apply the line check (`単価 × 数量 = 金額`), material-total check, and total check (`Σ金額 + 管理費 = 記載合計`). A memo is `ok` only if every line check and the total check pass. Amounts are taken as written and never recomputed.

---

## 3. Data Model (Postgres / Supabase)

Defined in `db/schema.sql`. All ids are `uuid` defaulting to `gen_random_uuid()`.

| Table | Key columns | Notes |
|---|---|---|
| `members` | `household_no`, `role`, `full_name`, `kana`, contact fields, `active` | One row per person; households are implicit via `household_no`. |
| `member_nicknames` | `member_id` → members, `nickname` (globally unique) | Maps handwritten nicknames to formal names. |
| `sessions` | `fiscal_year`, `session_date`, `activity_name`, `room_fee` (部屋代, default 600), `sort_order` | Unique on `(fiscal_year, session_date)`. |
| `memos` | `session_id`, `member_id`, `image_path`, `ocr_raw` (jsonb), `declared_total`, `status` (`draft`/`posted`) | One memo = one image block = one person × one session. |
| `memo_lines` | `memo_id`, `part_name`, `unit_price`, `quantity`, `amount`, `note` (literal circled char, e.g. `ア`/`ひ`/`き`; `none` = nothing circled), `line_order` | The material rows of a memo. The `note` is stored verbatim so expense lines can be attributed to the fronting member. |
| `fiscal_settings` | `fiscal_year` (PK), `prior_year_balance` (前年度残高), `difference` (差額), `default_room_fee` | Per-year ledger constants. |

Indexes exist on `memos(session_id)`, `memo_lines(memo_id)`.

---

## 4. OCR Pipeline (Claude vision)

Implemented in `lib/anthropic.ts` + `lib/ocr/schema.ts`.

1. The client sends the sheet image (base64) to `POST /api/ocr`.
2. The server calls Claude (`messages.create`) with:
   - **Model:** `ANTHROPIC_OCR_MODEL` env, default `claude-sonnet-4-6` (switch to an Opus id if
     handwriting accuracy is low).
   - **System prompt:** Japanese domain rules (`OCR_SYSTEM_PROMPT`), sent with
     `cache_control: ephemeral` so the rules are cached across calls.
   - **Forced tool-use:** `tool_choice` pins the `record_memos` tool so output is structured.
3. **`record_memos` tool schema** returns an array of memo blocks. One printed sheet holds several
   blocks (one per person); blank blocks are skipped. Each block contains:
   - `date`, `person_name`
   - `parts[]`: `name`, `unit_price`, `quantity`, `amount` (as written, **not** recomputed),
     `note` — the literal circled character as written (`ア`/`ひ`/`き`/…), or `none` if nothing is
     circled. The model returns the character verbatim and does **not** collapse it to a generic
     bucket.
   - `management_fee` (0 if absent)
   - `total` (as written)
   - `bbox`: `{x, y, width, height}` as 0–1 fractions of the image, so the UI can crop and show just
     that person's block.
4. `rawToMemo` maps the tool output to the `Memo` domain type defensively (coercing types,
   normalizing `note` to the literal character or the `none` sentinel, dropping malformed bboxes).
5. `/api/ocr` returns `{ memos: [{ memo, validation }], raw }` — each block paired with its
   `validateMemo` result. Nothing is persisted at this stage.

---

## 5. API Endpoints

All routes run on the Node.js runtime (`runtime = "nodejs"`); OCR and export set `maxDuration = 60`.
Responses are JSON unless noted. Errors return `{ error }` with an appropriate status.

| Method & path | Purpose | Notable behavior |
|---|---|---|
| `POST /api/ocr` | Run OCR on an image | Body `{ imageBase64, mediaType? }`. Returns detected memos + per-memo validation. No persistence. |
| `GET /api/memos?sessionId=&memberId=` | List posted memos | Newest first; includes member/session names and line counts. |
| `POST /api/memos` | Persist confirmed memo(s) from one sheet | See below. |
| `GET /api/memos/[id]` | One memo with its lines | Sorted by `line_order`. |
| `GET /api/members` / `?all=1` | Active members (w/ nicknames) / all incl. inactive | For matching and management. |
| `POST /api/members` | Create a member | Requires `full_name`. |
| `PATCH /api/members/[id]` | Update member fields | Whitelisted editable fields incl. `active`. |
| `POST /api/members/[id]/nicknames` | Add a nickname | Rejects duplicates (globally unique). |
| `DELETE /api/members/[id]/nicknames?nickname=` | Remove a nickname | |
| `GET /api/sessions?year=` | Sessions for a fiscal year | Default 2026, ordered by `sort_order`. |
| `POST /api/sessions` | Create a session | Requires `YYYY-MM-DD`; auto-assigns next `sort_order`; rejects duplicate dates. |
| `GET /api/ledger?sessionId=` | Derived ledger for a session | Returns income/expense entries, totals, `managementFee` (管理費), and an `expenseByMember` breakdown (per-member 支出, keyed by fronting member). |
| `GET /api/attendance?sessionId=` | Members present in a session | Derived from `posted` memos that session; returns the attending members (memo authors). |
| `GET /api/fiscal-settings?year=` | Fiscal constants | Returns defaults if none stored. |
| `PUT /api/fiscal-settings` | Upsert fiscal constants | Keyed on `fiscal_year`. |

### `POST /api/memos` in detail

Body: `{ image?: { base64, mediaType? }, imagePath?, memos: MemoInput[] }` where each `MemoInput`
has `sessionId`, `memberId`, `declaredTotal`, optional `managementFee`/`ocrRaw`,
and `lines: MemoLine[]`. The handler:

1. **Re-validates amounts** for every memo with `validateMemoAmounts`. On failure → **HTTP 422**
   `{ code: "amount_validation_failed", memoIndex, validation }` and **nothing is written**
   (halt-on-mismatch enforced on the server, not just the client).
2. **Duplicate guard:** rejects a memo whose `(session_id, member_id)` already has a `posted` memo
   → **HTTP 409** `{ code: "duplicate" }` (one person has one memo per session date).
3. **Uploads the sheet image once** (or reuses `imagePath`) and links it to every memo in the
   request, so registering people one-by-one from the same photo doesn't re-upload it.
4. For each memo: inserts the `memos` row (status `posted`), its `memo_lines`.

---

## 6. Configuration & Operations

### Environment variables (`.env.local`, see `.env.example`)

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude vision access. |
| `ANTHROPIC_OCR_MODEL` | OCR model id (default `claude-sonnet-4-6`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (client). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (**server only**). |
| `SUPABASE_MEMO_BUCKET` | Storage bucket for images (default `memos`). |
| `APP_PASSWORD` | Shared password gate for the single user. |

### Setup & run (from `README.md`)

```bash
npm install
cp .env.example .env.local            # fill in values
# In Supabase: run db/schema.sql, create a private Storage bucket "memos"
npx tsx db/extract-seed.ts            # workbook → db/seed-data.json (offline)
npx tsx db/seed.ts                    # seed-data.json → Supabase
npm run dev                           # http://localhost:3000
npm run build                         # production build
npx tsx --test lib/domain/domain.test.ts   # domain unit tests
```

### Seeding

`extract-seed.ts` reads the legacy workbook offline (members from 名簿 col D; sessions + fiscal
settings from 会計 ; nickname map きよみん/かたぎり baked in) and writes `db/seed-data.json`.
`seed.ts` upserts that JSON into Supabase on natural keys (idempotent-ish).

### Security posture

- DB writes use the service-role key from server code only; never expose it to the browser.
- The app is single-user and must be fronted by `APP_PASSWORD` / Supabase Auth before public
  deployment. Memo images are served via short-lived signed URLs from a **private** bucket.

---

## 7. Invariants, Edge Cases & Known Limitations

**Invariants**
- One `posted` memo per `(session, member)` — enforced by the POST duplicate guard.
- A posted memo's amounts always satisfy line and total checks — enforced server-side.
- OCR amounts are recorded **as written**; arithmetic is the validator's job, not the model's.
- Export never mutates source workbooks; it rewrites only data regions of a copy of the template.

**Edge cases handled**
- Ambiguous or missing member/session matches are surfaced to the user instead of guessed
  (the client `matchMember`/`matchSession` helpers return `null`; see the frontend spec).
- Best-effort image upload: a failed upload logs and proceeds without blocking the booking.
- Inactive members are excluded from matching dropdowns but visible under `?all=1`.

**Known limitations / future work**
- `management_fee` participates in validation and the total check but is **not persisted** as a
  column (only `declared_total` is stored). If the 管理費 must be reproduced exactly in exports or
  reports, add a `management_fee` column to `memos`.
- The `収支報告書` / `計算シート` sheets present in the legacy workbook are not part of the export
  path described here.
- Fiscal year is effectively hard-defaulted to 2026 across endpoints; multi-year support exists in
  the schema and export but the UI year pickers are limited (2025–2027).
- Auth is a shared-password gate, not per-user — appropriate only for single-user operation.
- **Attendance is derived from `posted` memos**, so it only reflects memo authors (parent members).
  Children — and parents who attended without submitting a memo — are not captured. A dedicated
  attendance source would be needed to record them.
- **Per-member expense attribution depends on the `note` character resolving to a member** via the
  nickname mapping. An unrecognized or ambiguous character leaves the line's expense unattributed
  (it still counts in the overall 支出 total, just not under a member).
