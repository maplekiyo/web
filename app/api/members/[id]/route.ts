// PATCH /api/members/[id] — update member fields (partial), incl. active toggle.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const EDITABLE = [
  "full_name",
  "kana",
  "household_no",
  "role",
  "address",
  "phone",
  "email",
  "school",
  "birthday",
  "active",
] as const;

const FIELDS =
  "id, full_name, kana, household_no, role, address, phone, email, school, birthday, active";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: Record<string, unknown> = {};
    for (const key of EDITABLE) {
      if (key in body) patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "no editable fields" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("members")
      .update(patch)
      .eq("id", id)
      .select(FIELDS)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
