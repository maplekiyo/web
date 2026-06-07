// GET  /api/members        — active members with nicknames (for matching/dropdowns)
// GET  /api/members?all=1   — all members incl. inactive, full fields (management)
// POST /api/members         — create a member
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const FIELDS =
  "id, full_name, kana, household_no, role, address, phone, email, school, birthday, active";

export async function GET(req: Request) {
  try {
    const all = new URL(req.url).searchParams.get("all");
    const db = supabaseAdmin();

    let query = db.from("members").select(FIELDS);
    if (!all) query = query.eq("active", true);
    const { data: members, error } = await query
      .order("household_no", { ascending: true, nullsFirst: false })
      .order("full_name", { ascending: true });
    if (error) throw error;

    const { data: nicks, error: nErr } = await db
      .from("member_nicknames")
      .select("member_id, nickname");
    if (nErr) throw nErr;

    const byId = new Map<string, string[]>();
    for (const n of nicks ?? []) {
      const arr = byId.get(n.member_id) ?? [];
      arr.push(n.nickname);
      byId.set(n.member_id, arr);
    }

    return NextResponse.json(
      (members ?? []).map((m) => ({ ...m, nicknames: byId.get(m.id) ?? [] })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body?.full_name || !String(body.full_name).trim()) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("members")
      .insert({
        full_name: String(body.full_name).trim(),
        kana: body.kana ?? null,
        household_no: body.household_no ?? null,
        role: body.role ?? null,
        address: body.address ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        school: body.school ?? null,
        birthday: body.birthday ?? null,
        active: body.active ?? true,
      })
      .select(FIELDS)
      .single();
    if (error) throw error;
    return NextResponse.json({ ...data, nicknames: [] }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
