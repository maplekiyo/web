// Claude vision OCR: send a memo sheet image, get back every filled memo block.

import Anthropic from "@anthropic-ai/sdk";
import type { Memo, MemoBBox, MemoNote } from "@/lib/domain/types";
import { OCR_SYSTEM_PROMPT, RECORD_MEMOS_TOOL } from "@/lib/ocr/schema";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in env.");
  _client = new Anthropic({ apiKey });
  return _client;
}

type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function rawToMemo(raw: unknown): Memo {
  const r = (raw ?? {}) as Record<string, unknown>;
  const notes: MemoNote[] = ["ア", "ひ", "other", "none"];
  const partsRaw = Array.isArray(r.parts) ? (r.parts as unknown[]) : [];
  let bbox: MemoBBox | undefined;
  const b = r.bbox as Record<string, unknown> | undefined;
  if (b && [b.x, b.y, b.width, b.height].every((v) => typeof v === "number")) {
    bbox = {
      x: Number(b.x),
      y: Number(b.y),
      width: Number(b.width),
      height: Number(b.height),
    };
  }
  return {
    date: String(r.date ?? ""),
    personName: String(r.person_name ?? ""),
    managementFee: Number(r.management_fee ?? 0),
    total: Number(r.total ?? 0),
    bbox,
    parts: partsRaw.map((pp) => {
      const p = (pp ?? {}) as Record<string, unknown>;
      return {
        partName: String(p.name ?? ""),
        unitPrice: Number(p.unit_price ?? 0),
        quantity: Number(p.quantity ?? 0),
        amount: Number(p.amount ?? 0),
        note: notes.includes(p.note as MemoNote) ? (p.note as MemoNote) : "none",
      };
    }),
  };
}

/** Read every filled memo block from a sheet image. Returns the raw tool input too. */
export async function readMemosFromImage(
  imageBase64: string,
  mediaType: MediaType = "image/jpeg",
): Promise<{ memos: Memo[]; raw: unknown }> {
  const model = process.env.ANTHROPIC_OCR_MODEL ?? "claude-sonnet-4-6";

  const message = await client().messages.create({
    model,
    max_tokens: 4096,
    // Cache the rules system prompt across calls.
    system: [
      { type: "text", text: OCR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    tools: [RECORD_MEMOS_TOOL],
    tool_choice: { type: "tool", name: RECORD_MEMOS_TOOL.name },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "このシートの記入済みメモ枠をすべて読み取って record_memos を呼び出してください。",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Model did not return a record_memos tool call.");
  }
  const input = toolUse.input as { memos?: unknown[] };
  const memos = Array.isArray(input.memos) ? input.memos.map(rawToMemo) : [];
  return { memos, raw: toolUse.input };
}
