// Run with: npx tsx --test lib/domain/domain.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveLedger } from "./ledger";
import type { Memo, MemoLine } from "./types";
import { validateMemo, validateMemoAmounts } from "./validation";

const line = (over: Partial<MemoLine>): MemoLine => ({
  partName: "x",
  unitPrice: 100,
  quantity: 1,
  amount: 100,
  note: "none",
  ...over,
});

test("validateMemo passes when math is consistent", () => {
  const memo: Memo = {
    date: "4/27",
    personName: "きよみん",
    parts: [
      line({ partName: "パラコード", unitPrice: 220, quantity: 1, amount: 220 }),
      line({ partName: "丸カラビナ", unitPrice: 23, quantity: 2, amount: 46 }),
    ],
    total: 266,
  };
  const v = validateMemo(memo);
  assert.equal(v.ok, true);
  assert.equal(v.computedTotal, 266);
});

test("validateMemo flags a bad line and bad total", () => {
  const memo: Memo = {
    date: "4/27",
    personName: "x",
    parts: [line({ unitPrice: 50, quantity: 3, amount: 100 })], // 150 != 100
    total: 999,
  };
  const v = validateMemo(memo);
  assert.equal(v.lines[0].ok, false);
  assert.equal(v.lines[0].expectedAmount, 150);
  assert.equal(v.totalOk, false);
  assert.equal(v.ok, false);
});

test("validateMemo accepts 小計＋管理費 = 記載合計", () => {
  const memo: Memo = {
    date: "4/27",
    personName: "x",
    parts: [line({ partName: "ビーズ", unitPrice: 102, quantity: 1, amount: 102 })],
    managementFee: 200,
    total: 302, // 102 (小計) + 200 (管理費)
  };
  const v = validateMemo(memo);
  assert.equal(v.subtotal, 102);
  assert.equal(v.managementFee, 200);
  assert.equal(v.computedTotal, 302);
  assert.equal(v.totalOk, true);
  assert.equal(v.ok, true);
});

test("validateMemo flags total when 管理費 does not close the gap", () => {
  const memo: Memo = {
    date: "4/27",
    personName: "x",
    parts: [line({ partName: "ビーズ", unitPrice: 102, quantity: 1, amount: 102 })],
    managementFee: 100, // 102 + 100 = 202, not 302
    total: 302,
  };
  const v = validateMemo(memo);
  assert.equal(v.computedTotal, 202);
  assert.equal(v.totalOk, false);
  assert.equal(v.ok, false);
});

test("validateMemoAmounts includes 管理費 in the total check", () => {
  const v = validateMemoAmounts(
    [line({ partName: "ビーズ", unitPrice: 102, quantity: 1, amount: 102 })],
    302,
    200,
  );
  assert.equal(v.totalOk, true);
  assert.equal(v.ok, true);
});

test("validateMemoAmounts validates posted API payload amounts", () => {
  const v = validateMemoAmounts(
    [line({ partName: "金具", unitPrice: 40, quantity: 2, amount: 70 })],
    70,
  );
  assert.equal(v.ok, false);
  assert.equal(v.lines[0].expectedAmount, 80);
  assert.equal(v.totalOk, true);
});

test("deriveLedger routes ア to income only, others to both", () => {
  const lines: MemoLine[] = [
    line({ partName: "ビーズ", amount: 319, note: "ア" }), // income only
    line({ partName: "ネコカボション", amount: 65, note: "ひ" }), // both
    line({ partName: "糸代", amount: 61, note: "none" }), // both
  ];
  const l = deriveLedger(lines);
  assert.deepEqual(l.income.map((e) => e.partName).sort(), [
    "ネコカボション",
    "ビーズ",
    "糸代",
  ]);
  assert.equal(l.incomeTotal, 319 + 65 + 61);
  // ア excluded from expense
  assert.deepEqual(l.expense.map((e) => e.partName).sort(), ["ネコカボション", "糸代"]);
  assert.equal(l.expenseTotal, 65 + 61);
});

test("deriveLedger routes no circled note to expense", () => {
  const l = deriveLedger([line({ partName: "糸代", amount: 61, note: "none" })]);
  assert.deepEqual(l.expense, [{ partName: "糸代", amount: 61 }]);
});

test("deriveLedger sums duplicate part names (existing-amount rule)", () => {
  const lines: MemoLine[] = [
    line({ partName: "糸代", amount: 61, note: "none" }),
    line({ partName: "糸代", amount: 39, note: "none" }),
  ];
  const l = deriveLedger(lines);
  assert.equal(l.income.length, 1);
  assert.equal(l.income[0].amount, 100);
});
