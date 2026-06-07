// GET /api/ledger?sessionId=...  — derived income/expense ledger for a session.
import { NextResponse } from "next/server";
import { deriveLedger } from "@/lib/domain/ledger";
import type { MemoLine, MemoNote } from "@/lib/domain/types";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const sessionId = new URL(req.url).searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    const db = supabaseAdmin();

    // All posted memo lines for this session.
    const { data: memos, error: mErr } = await db
      .from("memos")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "posted");
    if (mErr) throw mErr;
    const memoIds = (memos ?? []).map((m) => m.id);

    let lines: MemoLine[] = [];
    if (memoIds.length) {
      const { data, error } = await db
        .from("memo_lines")
        .select("part_name, unit_price, quantity, amount, note")
        .in("memo_id", memoIds);
      if (error) throw error;
      lines = (data ?? []).map((r) => ({
        partName: r.part_name,
        unitPrice: r.unit_price,
        quantity: r.quantity,
        amount: r.amount,
        note: r.note as MemoNote,
      }));
    }

    // Membership fees (会費) recorded on attendance.
    const { data: att, error: aErr } = await db
      .from("attendance")
      .select("membership_fee")
      .eq("session_id", sessionId)
      .eq("status", "present");
    if (aErr) throw aErr;
    const membershipTotal = (att ?? []).reduce(
      (s, a) => s + (a.membership_fee ?? 0),
      0,
    );

    const ledger = deriveLedger(lines);
    return NextResponse.json({ ...ledger, membershipTotal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
