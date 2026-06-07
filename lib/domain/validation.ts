// Amount validation — the "halt on mismatch" discipline from the spec.
// Step 1: 単価 × 数量 = 金額 for each line, and Σ金額 = 記載合計.

import type { Memo } from "./types";

export interface LineValidation {
  index: number;
  partName: string;
  unitPrice: number;
  quantity: number;
  expectedAmount: number; // 単価 × 数量
  actualAmount: number; // 金額 as written
  ok: boolean;
}

export interface MemoValidation {
  lines: LineValidation[];
  declaredTotal: number; // 合計 as written
  computedTotal: number; // Σ of line amounts
  totalOk: boolean;
  ok: boolean; // every line ok AND total ok
}

export function validateMemo(memo: Memo): MemoValidation {
  const lines: LineValidation[] = memo.parts.map((p, index) => {
    const expectedAmount = p.unitPrice * p.quantity;
    return {
      index,
      partName: p.partName,
      unitPrice: p.unitPrice,
      quantity: p.quantity,
      expectedAmount,
      actualAmount: p.amount,
      ok: expectedAmount === p.amount,
    };
  });

  const computedTotal = memo.parts.reduce((sum, p) => sum + p.amount, 0);
  const totalOk = computedTotal === memo.total;
  const ok = totalOk && lines.every((l) => l.ok);

  return {
    lines,
    declaredTotal: memo.total,
    computedTotal,
    totalOk,
    ok,
  };
}
