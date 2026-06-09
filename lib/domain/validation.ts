// Amount validation — the "halt on mismatch" discipline from the spec.
// Step 1: 単価 × 数量 = 金額 for each line, and 材料費小計 + 管理費 = 記載合計.

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
  subtotal: number; // 材料費小計 = Σ of line amounts
  managementFee: number; // 管理費
  computedTotal: number; // 小計 + 管理費 (what the 記載合計 should equal)
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

  const subtotal = memo.parts.reduce((sum, p) => sum + p.amount, 0);
  const managementFee = memo.managementFee ?? 0;
  const computedTotal = subtotal + managementFee;
  const totalOk = computedTotal === memo.total;
  const ok = totalOk && lines.every((l) => l.ok);

  return {
    lines,
    declaredTotal: memo.total,
    subtotal,
    managementFee,
    computedTotal,
    totalOk,
    ok,
  };
}

/** Validate the posted amount fields without requiring OCR-only memo metadata. */
export function validateMemoAmounts(
  parts: Memo["parts"],
  declaredTotal: number,
  managementFee = 0,
): MemoValidation {
  return validateMemo({
    date: "",
    personName: "",
    parts,
    managementFee,
    total: declaredTotal,
  });
}
