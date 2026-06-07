// POST   /api/members/[id]/nicknames           — add a nickname { nickname }
// DELETE /api/members/[id]/nicknames?nickname=  — remove a nickname
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const nickname = String(body?.nickname ?? "").trim();
    if (!nickname) {
      return NextResponse.json({ error: "nickname is required" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { error } = await db
      .from("member_nicknames")
      .insert({ member_id: id, nickname });
    if (error) {
      const msg = error.message.includes("duplicate")
        ? "そのニックネームは既に使われています"
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const nickname = new URL(req.url).searchParams.get("nickname");
    if (!nickname) {
      return NextResponse.json({ error: "nickname is required" }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { error } = await db
      .from("member_nicknames")
      .delete()
      .eq("member_id", id)
      .eq("nickname", nickname);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
