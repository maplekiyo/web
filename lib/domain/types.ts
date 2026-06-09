// Core domain types for AtelierM bookkeeping.
// Terms kept in Japanese where they map directly to the spec / workbook.

/**
 * 備考 (note): the circled character on a handwritten memo line.
 * - 'ア'    → record income only (sold from member stock).
 * - 'ひ'    → record in both income and expense (member fronted the cash).
 * - 'other' → any other circled character; treated like 'ひ' (income + expense).
 * - 'none'  → nothing circled; treated like 'ひ' (income + expense).
 */
export type MemoNote = "ア" | "ひ" | "other" | "none";

/** A single material line as read from a memo. */
export interface MemoLine {
  partName: string; // パーツ名
  unitPrice: number; // 単価
  quantity: number; // 数量
  amount: number; // 金額 (as written on the memo)
  note: MemoNote; // 備考
}

/**
 * Bounding box of one memo block within the sheet image, as fractions (0–1)
 * of the image width/height. Lets the UI crop and show just that person's form.
 */
export interface MemoBBox {
  x: number; // left edge (0–1)
  y: number; // top edge (0–1)
  width: number; // width (0–1)
  height: number; // height (0–1)
}

/** A whole handwritten memo (one person, one session date). */
export interface Memo {
  date: string; // as written, e.g. "4/27"
  personName: string; // may be a nickname
  parts: MemoLine[];
  managementFee?: number; // 管理費 (added to the 材料費小計 to reach 合計)
  total: number; // 合計 as written on the memo
  bbox?: MemoBBox; // location of this block on the sheet (if detected)
}

/** Aggregated ledger line (one part name, summed amount) within a session. */
export interface LedgerEntry {
  partName: string;
  amount: number;
}

/** Derived income/expense ledger for a session. */
export interface SessionLedger {
  income: LedgerEntry[]; // 収入 材料費
  expense: LedgerEntry[]; // 支出 材料費
  incomeTotal: number; // 収入 材料費計
  expenseTotal: number; // 支出 材料費計
}
