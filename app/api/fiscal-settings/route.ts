// GET /api/fiscal-settings?year=2026 — fetch settings (defaults if none yet)
// PUT /api/fiscal-settings           — upsert { fiscal_year, prior_year_balance, difference, default_room_fee }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const year = Number(new URL(req.url).searchParams.get("year") ?? 2026);
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("fiscal_settings")
      .select("fiscal_year, prior_year_balance, difference, default_room_fee")
      .eq("fiscal_year", year)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(
      data ?? {
        fiscal_year: year,
        prior_year_balance: 0,
        difference: 0,
        default_room_fee: 600,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const fiscal_year = Number(body?.fiscal_year);
    if (!fiscal_year) {
      return NextResponse.json({ error: "fiscal_year is required" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const row = {
      fiscal_year,
      prior_year_balance: Number(body.prior_year_balance ?? 0),
      difference: Number(body.difference ?? 0),
      default_room_fee: Number(body.default_room_fee ?? 600),
    };
    const { data, error } = await db
      .from("fiscal_settings")
      .upsert(row, { onConflict: "fiscal_year" })
      .select("fiscal_year, prior_year_balance, difference, default_room_fee")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
