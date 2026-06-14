# AtelierM 会計 — Product Requirements (PRD)

Digital bookkeeping for **AtelierM**, a Japanese craft/handicraft circle (手芸サークル). The
product turns a **photo of a handwritten material-cost memo** (材料費メモ) into structured
bookkeeping records: Claude vision reads the memo, a human confirms/corrects it, and the app
records the **income/expense ledger** (収入/支出 会計台帳).

This document covers the *what* and *why* — product vision, users, domain rules, and user
stories. For the *how* (architecture, data model, APIs, OCR pipeline, UI implementation), see the
technical specs: [`AtelierM_Bookkeeping_Spec_Backend.md`](./AtelierM_Bookkeeping_Spec_Backend.md)
(domain logic, data model, OCR, API, ops) and
[`AtelierM_Bookkeeping_Spec_Frontend.md`](./AtelierM_Bookkeeping_Spec_Frontend.md) (UI pages and
the capture/review flow).

---

## 1. Product Overview

AtelierM keeps its books on paper: at each activity session, members fill out a handwritten
material-cost memo listing the parts they bought or sold, with unit prices, quantities, amounts,
and a circled note that decides whether the line is income or expense. The accountant then copies
all of this into a spreadsheet by hand — slow, error-prone, and hard to audit.

This product replaces the manual transcription with a **snap → confirm → booked** flow:

1. The accountant photographs a memo sheet on a phone.
2. Claude vision reads each person's block off the sheet.
3. The app validates the arithmetic and shows a per-person review with ✅/❌ per line.
4. The accountant confirms (or corrects) the member, session date, and amounts, then books it.
5. The data lands in a Postgres (Supabase) ledger as the official record.

The core promise is *snap a photo → confirm → it's booked*, with **amount validation at every
step** and a **halt-on-mismatch** discipline carried over from the original manual process.

---

## 2. Goals & Context

- **Primary user:** the circle's accountant (会計担当) — a single, non-technical user operating
  on a phone.
- **Working language:** Japanese throughout — UI, labels, validation messages, and data.
- **Fiscal context:** the books are organized by fiscal year (会計年度).
- **Core promise:** snap a photo → confirm → it's booked, with amount validation at every step.
- **Correctability:** when a mismatch surfaces, the user can correct a bookkeeping record
  (create / edit / delete).

### Non-goals

- Reproducing every legacy spreadsheet artifact (e.g. `収支報告書` / `計算シート` sheets).

---

## 3. Domain Concepts

| Concept | Japanese | Meaning |
|---|---|---|
| Member | 会員 / 氏名 / 子供 | A person in the circle, grouped into households. Memo are created by **parent members only** |
| Nickname | ニックネーム | Alternate name written on memos (e.g. きよよん → 保科　希代美). |
| Session | 回 / 活動日 | One activity date in a fiscal year. |
| Memo | 材料費メモ | One handwritten form: one person, one session date. |
| Memo line | パーツ | One material row: パーツ名 / 単価 / 数量 / 金額 / 備考. |
| Management fee | 管理費 | Per-memo management fee added to the material subtotal to reach the 合計. |
| Ledger | 会計台帳 | Derived per-session income (収入) and expense (支出) material costs. |

---

## 4. Business Rules

These rules are the heart of the product. They are stated here in business terms; their
implementation (files, validation codes) lives in the Spec.

### 4.1 The 備考 (note) routing rule

Each memo line carries a 備考: the circled character on the handwritten form. It decides whether
the line is income, or income **and** expense:

| 備考 | Routing | Rationale |
|---|---|---|
| ア (circled) | **Income only** | Sold from AtelierM's own stock; no cash outlay. `ア` stands for `AtelierM` |
| ひ (circled) | Income **and** expense | Member fronted the purchase (立替). `ひ` stands for 高桑　博子（たかくわ　ひろこ） who is the chair man of this handicraft circle |
| Other char circled | Income **and** expense | Treated like ひ. |
| Nothing circled | **Income only** | Treated like ア. |

Stated precisely:
> **Every** line is recorded as income. A line is **also** recorded as expense **unless** its
> note is `ア` or nothing (none) because those members fronted the purchase of those parts.

### 4.2 Aggregation rule

- Within a session and section (income or expense), lines that share a **part name** are
  **summed** into a single ledger entry, preserving first-seen order. This implements the
  workbook's "add to the existing amount rather than creating a new pair" convention.
- Similar part names should be aggregated into a single ledger entry; the AI judges whether a
  part name is similar to an existing entry.

### 4.3 Validation rules (halt-on-mismatch)

Amounts are read **as written** — never recomputed — so validation compares the human's
handwriting against arithmetic. Three checks:

1. **Line check:** `単価 × 数量 = 金額` for every line.
2. **Material total check:** Σ(line 金額) = material subtotal.
3. **Total check:** `Σ(line 金額) + 管理費 = 記載合計` (material subtotal plus management fee
   equals the written total).

A memo is acceptable only if **every** line check passes **and** the total check passes. If not,
booking is rejected and the user must correct the data before proceeding. This halt-on-mismatch
discipline is enforced both at review time and again before persisting.

---

## 5. User Stories

As the **accountant** (会計担当), I want to…

- **Capture & book:** photograph a handwritten memo sheet and have each person's block
  transcribed automatically, so I don't have to type amounts by hand.
- **Trust the numbers:** see each line and the total validated (✅/❌) against what's written, so I
  only book memos whose arithmetic is correct.
- **Correct before booking:** edit OCR mistakes (amounts, part names, notes) in the review screen
  before committing.
- **Auto-match people & dates:** have the app guess the member (by name or nickname) and the
  session date from the memo, while still letting me confirm or override an ambiguous match.
- **Avoid duplicates:** be stopped from booking the same person twice for the same session date.
- **Correct after booking:** create, edit, or delete a booked record when a mismatch is found
  later.
- **Review the ledger:** view per-session 収入 / 支出 material costs and the 会費 total, with a
  "this week" helper.
- **Review the per-member expenses:** view per-member 支出 material costs in a session. The user can review it along with the ledger.
- **Review the attendances:** view members attended in a session. The user can review it along with the ledger.
- **Browse history:** filter and review previously booked memos by session or member, including
  the original photo.
- **Manage members:** add members, toggle active/inactive, parent/child and maintain the nickname map used for matching.
- **Configure the year:** edit fiscal settings (前年度残高 / 差額 / 部屋代) per fiscal year.

---

## 6. Glossary

| Term | Reading | Meaning |
|---|---|---|
| 材料費メモ | ざいりょうひメモ | Handwritten material-cost memo (the input image). |
| 単価 / 数量 / 金額 | たんか / すうりょう / きんがく | Unit price / quantity / amount. |
| 備考 | びこう | The circled-character note that routes income vs. expense. |
| 合計 | ごうけい | Written total on the memo (= material subtotal + 管理費). |
| 管理費 | かんりひ | Per-memo management fee added to reach the 合計. |
| 部屋代 | へやだい | Room rental fee per session (default 600). |
| 収入 / 支出 | しゅうにゅう / ししゅつ | Income / expense ledger sections. |
| 前年度残高 / 差額 | ぜんねんどざんだか / さがく | Prior-year balance / difference (fiscal settings). |
| 名簿 (出欠確認用) | めいぼ | Roster / attendance sheet. |
| 会計 | かいけい | The ledger sheet (note trailing space in its name). |
