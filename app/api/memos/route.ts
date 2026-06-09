// POST /api/memos — persist one or more confirmed memos from a single sheet photo.
// The image (if any) is uploaded once and linked to every memo.
// Body: { image?: { base64, mediaType }, memos: MemoInput[] }
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { MemoLine } from "@/lib/domain/types";
import { validateMemoAmounts } from "@/lib/domain/validation";
import { uploadImage } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

interface MemoInput {
  sessionId: string;
  memberId: string;
  declaredTotal: number;
  managementFee?: number;
  membershipFee?: number;
  ocrRaw?: unknown;
  lines: MemoLine[];
}

interface Body {
  image?: { base64: string; mediaType?: string };
  // Reuse an already-uploaded sheet image (returned by a prior POST) so that
  // registering memos one at a time doesn't re-upload the same photo.
  imagePath?: string;
  memos: MemoInput[];
}

// GET /api/memos?sessionId=&memberId=  — posted memos, newest first (history list).
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");
    const memberId = url.searchParams.get("memberId");
    const db = supabaseAdmin();
    let query = db
      .from("memos")
      .select(
        "id, declared_total, status, created_at, image_path, member:members(full_name), session:sessions(session_date, activity_name), lines:memo_lines(count)",
      )
      .order("created_at", { ascending: false });
    if (sessionId) query = query.eq("session_id", sessionId);
    if (memberId) query = query.eq("member_id", memberId);
    const { data, error } = await query;
    if (error) throw error;

    const list = (data ?? []).map((m) => {
      const member = m.member as unknown as { full_name: string } | null;
      const session = m.session as unknown as
        | { session_date: string; activity_name: string | null }
        | null;
      const lines = m.lines as unknown as { count: number }[] | null;
      return {
        id: m.id,
        declared_total: m.declared_total,
        status: m.status,
        created_at: m.created_at,
        has_image: !!m.image_path,
        member_name: member?.full_name ?? null,
        session_date: session?.session_date ?? null,
        activity_name: session?.activity_name ?? null,
        line_count: lines?.[0]?.count ?? 0,
      };
    });
    return NextResponse.json(list);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const memos = Array.isArray(body.memos) ? body.memos : [];
    if (memos.length === 0) {
      return NextResponse.json({ error: "memos is required" }, { status: 400 });
    }
    if (memos.some((m) => !m.sessionId || !m.memberId || !Array.isArray(m.lines))) {
      return NextResponse.json(
        { error: "each memo needs sessionId, memberId and lines" },
        { status: 400 },
      );
    }

    for (const [memoIndex, memo] of memos.entries()) {
      const validation = validateMemoAmounts(
        memo.lines,
        memo.declaredTotal,
        memo.managementFee ?? 0,
      );
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: "金額不一致のため記帳を中断しました。明細と合計を修正してください。",
            code: "amount_validation_failed",
            memoIndex,
            validation,
          },
          { status: 422 },
        );
      }
    }

    const db = supabaseAdmin();

    // Guard against re-registering a form already posted for the same
    // 日付(session) × 氏名(member). One person has one memo per session date,
    // so a duplicate means the same form is being registered twice.
    const pairs = memos.map((m) => ({ sessionId: m.sessionId, memberId: m.memberId }));
    for (const { sessionId, memberId } of pairs) {
      const { data: existing, error: dupErr } = await db
        .from("memos")
        .select("id")
        .eq("session_id", sessionId)
        .eq("member_id", memberId)
        .eq("status", "posted")
        .limit(1);
      if (dupErr) throw dupErr;
      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: "このメモは既に登録済みです（同じ日付・氏名の記帳があります）", code: "duplicate" },
          { status: 409 },
        );
      }
    }

    // Reuse a previously-uploaded sheet image if given; otherwise upload once
    // (best-effort). The same path is linked to every memo in this request.
    let imagePath: string | null = body.imagePath ?? null;
    if (!imagePath && body.image?.base64) {
      try {
        imagePath = await uploadImage(
          `sheets/${randomUUID()}`,
          body.image.base64,
          body.image.mediaType ?? "image/jpeg",
        );
      } catch (e) {
        console.error("sheet image upload failed:", e);
      }
    }

    const ids: string[] = [];
    for (const m of memos) {
      // 1. memo
      const { data: memo, error: memoErr } = await db
        .from("memos")
        .insert({
          session_id: m.sessionId,
          member_id: m.memberId,
          declared_total: m.declaredTotal,
          ocr_raw: m.ocrRaw ?? null,
          image_path: imagePath,
          status: "posted",
        })
        .select("id")
        .single();
      if (memoErr) throw memoErr;
      ids.push(memo.id);

      // 2. lines
      if (m.lines.length) {
        const rows = m.lines.map((l, i) => ({
          memo_id: memo.id,
          part_name: l.partName,
          unit_price: l.unitPrice,
          quantity: l.quantity,
          amount: l.amount,
          note: l.note,
          line_order: i,
        }));
        const { error: linesErr } = await db.from("memo_lines").insert(rows);
        if (linesErr) throw linesErr;
      }

      // 3. attendance (present + fee)
      const { error: attErr } = await db.from("attendance").upsert(
        {
          session_id: m.sessionId,
          member_id: m.memberId,
          status: "present",
          membership_fee: m.membershipFee ?? 0,
        },
        { onConflict: "session_id,member_id" },
      );
      if (attErr) throw attErr;
    }

    return NextResponse.json({ ids, status: "posted", imagePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
