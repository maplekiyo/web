// GET /api/memos/[id] — a single posted memo with its lines (detail view).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("memos")
      .select(
        "id, declared_total, status, created_at, image_path, member:members(full_name), session:sessions(session_date, activity_name), lines:memo_lines(part_name, unit_price, quantity, amount, note, line_order)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "memo not found" }, { status: 404 });
    }

    const member = data.member as unknown as { full_name: string } | null;
    const session = data.session as unknown as
      | { session_date: string; activity_name: string | null }
      | null;
    const lines = (
      (data.lines as unknown as
        | {
            part_name: string;
            unit_price: number;
            quantity: number;
            amount: number;
            note: string;
            line_order: number;
          }[]
        | null) ?? []
    ).sort((a, b) => a.line_order - b.line_order);

    return NextResponse.json({
      id: data.id,
      declared_total: data.declared_total,
      status: data.status,
      created_at: data.created_at,
      has_image: !!data.image_path,
      member_name: member?.full_name ?? null,
      session_date: session?.session_date ?? null,
      activity_name: session?.activity_name ?? null,
      lines,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
