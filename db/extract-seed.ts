// Extract seed data from the existing workbook into db/seed-data.json (offline).
// Usage: npx tsx db/extract-seed.ts
//
// Members come from the 名簿 sheet (column D), sessions + fiscal settings from
// the 会計  sheet. This runs without any DB connection.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

const WORKBOOK = join(process.cwd(), "..", "AtelierM_kaikei2026 ____.xlsx");
const ROSTER_SHEET = "名簿 (出欠確認用)";
const LEDGER_SHEET = "会計 "; // note trailing space
const FISCAL_YEAR = 2026;

// nickname → formal name (full-width space as in the sheet). Extend as needed.
const NICKNAMES: Record<string, string> = {
  きよみん: "保科　希代美",
  かたぎり: "片桐",
};

interface SeedMember {
  household_no: number | null;
  role: string | null;
  full_name: string;
  kana: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  school: string | null;
  birthday: string | null;
}

interface SeedSession {
  fiscal_year: number;
  session_date: string; // YYYY-MM-DD
  activity_name: string | null;
  sort_order: number;
}

function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "text" in v) return String(v.text).trim() || null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toISODate(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(WORKBOOK);

  // --- members (名簿, column D, rows 4..) ---
  const roster = wb.getWorksheet(ROSTER_SHEET);
  if (!roster) throw new Error(`sheet not found: ${ROSTER_SHEET}`);
  const members: SeedMember[] = [];
  let currentHousehold: number | null = null;
  for (let r = 4; r <= 200; r++) {
    const hhRaw = roster.getCell(r, 2).value;
    const name = cellText(roster.getCell(r, 4).value);
    // Stop at the legend block that starts with the ☆ marker.
    if (hhRaw === "☆") break;
    if (typeof hhRaw === "number") currentHousehold = hhRaw;
    if (!name) continue;
    members.push({
      household_no: currentHousehold,
      role: cellText(roster.getCell(r, 3).value),
      full_name: name,
      kana: cellText(roster.getCell(r, 5).value),
      address: cellText(roster.getCell(r, 6).value),
      phone: cellText(roster.getCell(r, 7).value),
      email: cellText(roster.getCell(r, 8).value),
      school: cellText(roster.getCell(r, 9).value),
      birthday: cellText(roster.getCell(r, 10).value),
    });
  }

  // --- sessions + fiscal settings (会計 ) ---
  const ledger = wb.getWorksheet(LEDGER_SHEET);
  if (!ledger) throw new Error(`sheet not found: ${LEDGER_SHEET}`);
  const sessions: SeedSession[] = [];
  let order = 0;
  for (let c = 3; c <= 40; c++) {
    const iso = toISODate(ledger.getCell(5, c).value);
    if (!iso) continue;
    sessions.push({
      fiscal_year: FISCAL_YEAR,
      session_date: iso,
      activity_name: cellText(ledger.getCell(4, c).value),
      sort_order: order++,
    });
  }

  const fiscal = {
    fiscal_year: FISCAL_YEAR,
    prior_year_balance: Number(ledger.getCell(78, 3).value) || 0,
    difference: Number(ledger.getCell(76, 3).value) || 0,
    default_room_fee: Number(ledger.getCell(40, 3).value) || 600,
  };

  // Resolve nicknames to member references by full name.
  const nicknames = Object.entries(NICKNAMES).map(([nickname, full_name]) => {
    if (!members.some((m) => m.full_name === full_name)) {
      console.warn(`⚠ nickname target not found in roster: ${full_name}`);
    }
    return { nickname, full_name };
  });

  const seed = { members, nicknames, sessions, fiscal };
  const out = join(process.cwd(), "db", "seed-data.json");
  writeFileSync(out, JSON.stringify(seed, null, 2));
  console.log(
    `✓ ${members.length} members, ${sessions.length} sessions, ${nicknames.length} nicknames → db/seed-data.json`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
