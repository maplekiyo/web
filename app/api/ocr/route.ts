// POST /api/ocr  — body: { imageBase64, mediaType? }
// Returns every detected memo block + its amount validation. Does not persist.

import { NextResponse } from "next/server";
import { readMemosFromImage } from "@/lib/anthropic";
import { validateMemo } from "@/lib/domain/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageBase64: string | undefined = body?.imageBase64;
    const mediaType = body?.mediaType ?? "image/jpeg";
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }

    const { memos, raw } = await readMemosFromImage(imageBase64, mediaType);
    const results = memos.map((memo) => ({ memo, validation: validateMemo(memo) }));

    return NextResponse.json({ memos: results, raw });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
