// GET  /api/sessions — sessions for the current fiscal year (default 2026).
// POST /api/sessions — create a session { session_date, activity_name?, fiscal_year?, room_fee? }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const SELECT = "id, session_date, activity_name, room_fee, sort_order";

export async function GET(req: Request) {
  try {
    const year = Number(new URL(req.url).searchParams.get("year") ?? 2026);
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("sessions")
      .select(SELECT)
      .eq("fiscal_year", year)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session_date = String(body?.session_date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date)) {
      return NextResponse.json(
        { error: "session_date (YYYY-MM-DD) is required" },
        { status: 400 },
      );
    }
    const fiscal_year = Number(body?.fiscal_year ?? 2026);
    const db = supabaseAdmin();

    // next sort_order within the fiscal year
    const { data: last } = await db
      .from("sessions")
      .select("sort_order")
      .eq("fiscal_year", fiscal_year)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = (last?.sort_order ?? -1) + 1;

    const { data, error } = await db
      .from("sessions")
      .insert({
        fiscal_year,
        session_date,
        activity_name: body?.activity_name?.trim() || null,
        room_fee: body?.room_fee ?? 600,
        sort_order,
      })
      .select(SELECT)
      .single();
    if (error) {
      const msg = error.message.includes("duplicate")
        ? "その日付のセッションは既に登録されています"
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
