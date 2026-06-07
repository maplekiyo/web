// Excel export: write a fiscal year's data into a single generic template.
// The template (web/templates/AtelierM_template.xlsx) provides the layout,
// labels, formatting, and SUM/balance formulas; this code clears the data
// regions and writes the selected year's sessions + data POSITIONALLY
// (1st session → first column, etc.), so one template works for any year.

import { join } from "node:path";
import ExcelJS from "exceljs";
import { deriveLedger } from "@/lib/domain/ledger";
import type { MemoLine, MemoNote } from "@/lib/domain/types";
import { supabaseAdmin } from "@/lib/supabase";

const TEMPLATE = join(process.cwd(), "templates", "AtelierM_template.xlsx");
const ROSTER_SHEET = "名簿 (出欠確認用)";
const LEDGER_SHEET = "会計 ";

// 会計 sheet layout
const LEDGER_FIRST_COL = 3; // C
const LEDGER_LAST_COL = 26; // Z — formulas (計/合計/合計総額/現金) exist through here
const ACTIVITY_ROW = 4;
const DATE_ROW = 5;
const FEE_ROW = 6; // 会費
const INCOME_FIRST_ROW = 7;
const INCOME_LAST_ROW = 36;
const ROOM_FEE_ROW = 40; // 部屋代
const EXPENSE_FIRST_ROW = 42;
const EXPENSE_LAST_ROW = 71;
const PRIOR_BALANCE_CELL = { row: 78, col: 3 }; // C78
const DIFFERENCE_CELL = { row: 76, col: 3 }; // C76

// 名簿 sheet layout: date columns start at K (11), interleaved with 会費 columns.
const ROSTER_DATE_FIRST_COL = 11; // K
const ROSTER_DATE_LAST_COL = 53; // BA
const ROSTER_DATE_ROW = 3;
const ROSTER_MEMBER_FIRST_ROW = 4;
const ROSTER_MEMBER_LAST_ROW = 77;

const MAX_SESSIONS = Math.min(
  LEDGER_LAST_COL - LEDGER_FIRST_COL + 1, // 24
  Math.floor((ROSTER_DATE_LAST_COL - ROSTER_DATE_FIRST_COL) / 2) + 1, // 22
); // 22

function clearCells(
  ws: ExcelJS.Worksheet,
  r1: number,
  r2: number,
  c1: number,
  c2: number,
) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) ws.getCell(r, c).value = null;
  }
}

function writePairs(
  ws: ExcelJS.Worksheet,
  col: number,
  firstRow: number,
  lastRow: number,
  entries: { partName: string; amount: number }[],
) {
  let row = firstRow;
  for (const e of entries) {
    if (row + 1 > lastRow) break;
    ws.getCell(row, col).value = e.partName;
    ws.getCell(row + 1, col).value = e.amount;
    row += 2;
  }
}

export async function buildWorkbook(fiscalYear = 2026): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ledgerWs = wb.getWorksheet(LEDGER_SHEET);
  const rosterWs = wb.getWorksheet(ROSTER_SHEET);
  if (!ledgerWs || !rosterWs) throw new Error("template sheets missing");

  const db = supabaseAdmin();
  const { data: sessions } = await db
    .from("sessions")
    .select("id, session_date, activity_name, room_fee")
    .eq("fiscal_year", fiscalYear)
    .order("sort_order", { ascending: true });
  const sessionList = sessions ?? [];
  if (sessionList.length > MAX_SESSIONS) {
    throw new Error(
      `セッション数(${sessionList.length})がテンプレートの上限(${MAX_SESSIONS})を超えています。`,
    );
  }

  const { data: members } = await db.from("members").select("id, full_name");
  const memberNameById = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  const memberRowByName = new Map<string, number>();
  for (let r = ROSTER_MEMBER_FIRST_ROW; r <= ROSTER_MEMBER_LAST_ROW; r++) {
    const name = rosterWs.getCell(r, 4).value;
    if (typeof name === "string" && name.trim()) memberRowByName.set(name.trim(), r);
  }

  const { data: fiscal } = await db
    .from("fiscal_settings")
    .select("prior_year_balance, difference")
    .eq("fiscal_year", fiscalYear)
    .maybeSingle();

  // --- clear data regions (keep labels, formulas, formatting) ---
  clearCells(ledgerWs, ACTIVITY_ROW, FEE_ROW, LEDGER_FIRST_COL, LEDGER_LAST_COL); // headers + 会費
  clearCells(ledgerWs, INCOME_FIRST_ROW, INCOME_LAST_ROW, LEDGER_FIRST_COL, LEDGER_LAST_COL);
  clearCells(ledgerWs, ROOM_FEE_ROW, ROOM_FEE_ROW, LEDGER_FIRST_COL, LEDGER_LAST_COL);
  clearCells(ledgerWs, EXPENSE_FIRST_ROW, EXPENSE_LAST_ROW, LEDGER_FIRST_COL, LEDGER_LAST_COL);
  clearCells(rosterWs, ROSTER_DATE_ROW, ROSTER_DATE_ROW, ROSTER_DATE_FIRST_COL, ROSTER_DATE_LAST_COL);
  clearCells(rosterWs, ROSTER_MEMBER_FIRST_ROW, ROSTER_MEMBER_LAST_ROW, ROSTER_DATE_FIRST_COL, ROSTER_DATE_LAST_COL);

  // --- fiscal settings ---
  ledgerWs.getCell(PRIOR_BALANCE_CELL.row, PRIOR_BALANCE_CELL.col).value =
    fiscal?.prior_year_balance ?? 0;
  ledgerWs.getCell(DIFFERENCE_CELL.row, DIFFERENCE_CELL.col).value =
    fiscal?.difference ?? 0;

  // --- per session, positionally ---
  for (let idx = 0; idx < sessionList.length; idx++) {
    const s = sessionList[idx];
    const ledgerCol = LEDGER_FIRST_COL + idx;
    const rosterDateCol = ROSTER_DATE_FIRST_COL + idx * 2;
    const rosterFeeCol = rosterDateCol + 1;
    const date = new Date(s.session_date + "T00:00:00Z");

    // headers
    ledgerWs.getCell(DATE_ROW, ledgerCol).value = date;
    ledgerWs.getCell(ACTIVITY_ROW, ledgerCol).value = s.activity_name ?? null;
    ledgerWs.getCell(ROOM_FEE_ROW, ledgerCol).value = s.room_fee ?? 0;
    rosterWs.getCell(ROSTER_DATE_ROW, rosterDateCol).value = date;

    // posted memo lines → derived ledger
    const { data: memos } = await db
      .from("memos")
      .select("id")
      .eq("session_id", s.id)
      .eq("status", "posted");
    const memoIds = (memos ?? []).map((m) => m.id);
    let lines: MemoLine[] = [];
    if (memoIds.length) {
      const { data } = await db
        .from("memo_lines")
        .select("part_name, unit_price, quantity, amount, note")
        .in("memo_id", memoIds);
      lines = (data ?? []).map((r) => ({
        partName: r.part_name,
        unitPrice: r.unit_price,
        quantity: r.quantity,
        amount: r.amount,
        note: r.note as MemoNote,
      }));
    }
    const ledger = deriveLedger(lines);
    writePairs(ledgerWs, ledgerCol, INCOME_FIRST_ROW, INCOME_LAST_ROW, ledger.income);
    writePairs(ledgerWs, ledgerCol, EXPENSE_FIRST_ROW, EXPENSE_LAST_ROW, ledger.expense);

    // attendance: ◎ + 会費
    const { data: att } = await db
      .from("attendance")
      .select("member_id, status, membership_fee")
      .eq("session_id", s.id);
    let feeTotal = 0;
    for (const a of att ?? []) {
      if (a.status !== "present") continue;
      feeTotal += a.membership_fee ?? 0;
      const name = memberNameById.get(a.member_id);
      const row = name ? memberRowByName.get(name) : undefined;
      if (row) rosterWs.getCell(row, rosterDateCol).value = "◎";
      if (row && a.membership_fee) rosterWs.getCell(row, rosterFeeCol).value = a.membership_fee;
    }
    if (feeTotal) ledgerWs.getCell(FEE_ROW, ledgerCol).value = feeTotal;
  }

  return wb.xlsx.writeBuffer();
}
