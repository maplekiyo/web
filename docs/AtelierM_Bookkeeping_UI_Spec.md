# AtelierM 会計 — UI Specification

Client-side technical design for the AtelierM digital bookkeeping app: UI pages, the capture/review
flow, client-side matching, and the configuration the browser depends on. The UI is a thin layer
over the API; the official records live in a Postgres (Supabase) database.

For product vision, domain rules, and user stories, see
[`AtelierM_Bookkeeping_PRD.md`](./AtelierM_Bookkeeping_PRD.md). For the server-side implementation
of the domain logic, data model, OCR pipeline, and the API endpoints this UI consumes, see
[`AtelierM_Bookkeeping_Spec_Backend.md`](./AtelierM_Bookkeeping_Spec_Backend.md).

---

## 2. UI Pages

Mobile-first, single-column (`max-w-2xl`), daisyUI theme `atelierm`, all Japanese. Routes:

| Route | Screen | Summary |
|---|---|---|
| `/` | Home | Tiles linking to the flows; primary CTA "メモを記帳する". |
| `/memos/new` | **Capture & review** | Take/upload photo → OCR → per-person review with ✅/❌ validation, auto-matched member & session, then register each block. The core flow. |
| `/memos` | History | Filter posted memos by session/member. |
| `/memos/[id]` | Memo detail | Lines, totals, note labels, and the photo. |
| `/ledger` | Ledger | Per-session 収入 / 支出 material costs + 会費 total; "this week" helper. Also shows, alongside the ledger, the **per-member 支出** breakdown and the session's **attendance** (members present). |
| `/members` | Member management | CRUD members, toggle active, manage nicknames. |
| `/settings` | Fiscal settings | Edit 前年度残高 / 差額 / 部屋代 per year. |

### `/memos/new` review flow (the critical UX)

1. User captures/uploads a sheet photo; it's converted to base64 (`fileToBase64`).
2. `POST /api/ocr` returns every detected block.
3. Each block becomes an `Entry` with a client-side **member auto-match** (`matchMember`: exact →
   nickname → unique substring) and **session auto-match** (`matchSession`: parses `M/D` and matches
   a unique session date). Ambiguous matches are left for the user to pick.
4. The review table shows each line with live `validateMemo` results (✅/❌) and the computed vs.
   written total. The bbox lets the UI crop to the relevant block.
5. User confirms member + session, then registers — `POST /api/memos`, one block at a time, tracking
   `posted` / `posting` / `postError` per entry. The server's 422/409 guards are surfaced inline.

---

## 3. API Consumption

The UI is a client of the endpoints defined in the
[backend spec §5](./AtelierM_Bookkeeping_Spec_Backend.md#5-api-endpoints). Notable client-side
contracts:

- **OCR** (`/memos/new`): `POST /api/ocr` with `{ imageBase64, mediaType? }`; renders the returned
  blocks and their per-memo validation. Nothing is persisted until the user registers.
- **Registration**: `POST /api/memos`, one block at a time. The handler may reject with **HTTP 422**
  (`amount_validation_failed`) or **HTTP 409** (`duplicate`); both are surfaced inline per entry.
- **Matching data**: `GET /api/members` (active, with nicknames) feeds `matchMember`; the member
  management screen uses `?all=1` and the `POST`/`PATCH`/nickname endpoints.
- **Session pickers**: `GET /api/sessions?year=` feeds `matchSession` and the session dropdowns.
- **Ledger page**: `GET /api/ledger?sessionId=` (income/expense entries, totals, `managementFee`,
  `expenseByMember`) plus `GET /api/attendance?sessionId=` for the attendance list.
- **Settings page**: `GET`/`PUT /api/fiscal-settings?year=`.

---

## 4. Configuration

The browser bundle reads only the public Supabase config; all secrets stay server-side (see the
backend spec). Client-relevant environment variables:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (client). |

`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MEMO_BUCKET`, and `APP_PASSWORD` are
**server only** — the browser never sees them. Memo images are loaded through short-lived signed
URLs from a private bucket, not direct storage paths.

---

## 5. UX Invariants, Edge Cases & Known Limitations

**Invariants**
- Validation is shown live (`validateMemo` ✅/❌) and re-enforced server-side; the UI never lets a
  user register a memo the server would reject silently — 422/409 responses are surfaced per entry.
- OCR amounts are displayed **as written**; the UI shows computed vs. written totals but never
  rewrites the source figures.

**Edge cases handled**
- Ambiguous or missing member/session matches are surfaced to the user instead of guessed
  (`matchMember`/`matchSession` return `null`, leaving the picker for the user).
- Inactive members are excluded from matching dropdowns but visible under the member-management
  `?all=1` view.

**Known limitations / future work**
- Fiscal year is effectively hard-defaulted to 2026; the UI year pickers are limited to 2025–2027
  even though the schema and export support more.
- The attendance list and per-member 支出 breakdown inherit the backend's derivation limits (memo
  authors only; unattributed `note` characters) — see the
  [backend spec §7](./AtelierM_Bookkeeping_Spec_Backend.md#7-invariants-edge-cases--known-limitations).
