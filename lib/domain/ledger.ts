// Ledger derivation: turn confirmed memo lines into income/expense entries.
//
// Routing rule (備考):
//   - every line is recorded as INCOME (収入).
//   - a line is ALSO recorded as EXPENSE (支出) unless its note is 'ア'.
// Lines sharing a part name within a section are aggregated (summed),
// matching the workbook rule "add to the existing amount".

import type { LedgerEntry, MemoLine, SessionLedger } from "./types";

/** Lines whose note routes them into the expense section. */
export function isExpenseLine(line: MemoLine): boolean {
  return line.note !== "ア";
}

/** Aggregate lines by part name, preserving first-seen order. */
function aggregate(lines: MemoLine[]): LedgerEntry[] {
  const order: string[] = [];
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!totals.has(line.partName)) order.push(line.partName);
    totals.set(line.partName, (totals.get(line.partName) ?? 0) + line.amount);
  }
  return order.map((partName) => ({ partName, amount: totals.get(partName)! }));
}

/**
 * Derive a session ledger from all confirmed memo lines in that session.
 */
export function deriveLedger(lines: MemoLine[]): SessionLedger {
  const income = aggregate(lines);
  const expense = aggregate(lines.filter(isExpenseLine));
  return {
    income,
    expense,
    incomeTotal: income.reduce((s, e) => s + e.amount, 0),
    expenseTotal: expense.reduce((s, e) => s + e.amount, 0),
  };
}
