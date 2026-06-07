// GET /api/memos/[id]/image — redirect to a short-lived signed URL for the memo's photo.
import { NextResponse } from "next/server";
import { signedMemoImageUrl } from "@/lib/storage";
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
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.image_path) {
      return NextResponse.json({ error: "no image for this memo" }, { status: 404 });
    }
    const url = await signedMemoImageUrl(data.image_path);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
