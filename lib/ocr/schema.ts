// Claude vision OCR: tool-use schema + cached system prompt.
// The schema constrains Claude's output to our Memo shape; the system prompt
// carries the domain rules from AtelierM-kaikei-prompt.md.

import type Anthropic from "@anthropic-ai/sdk";

// One memo block (one person). A printed sheet holds several of these.
const MEMO_BLOCK_SCHEMA = {
  type: "object" as const,
  properties: {
    date: {
      type: "string",
      description: "日付 exactly as written, e.g. '4/27'.",
    },
    person_name: {
      type: "string",
      description: "氏名 of the purchaser as written (may be a nickname).",
    },
    parts: {
      type: "array",
      description: "One entry per material line in this block.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "パーツ名 (material name)." },
          unit_price: { type: "number", description: "単価 (price each)." },
          quantity: { type: "number", description: "数量 (count)." },
          amount: {
            type: "number",
            description: "金額 exactly as written (do NOT recompute).",
          },
          note: {
            type: "string",
            enum: ["ア", "ひ", "other", "none"],
            description:
              "備考: the circled character. 'ア' or 'ひ' if that character is circled, 'other' if a different character is circled, 'none' if nothing is circled.",
          },
        },
        required: ["name", "unit_price", "quantity", "amount", "note"],
      },
    },
    management_fee: {
      type: "number",
      description:
        "管理費 exactly as written in this block (材料費小計に加算される). 記載が無ければ 0.",
    },
    total: {
      type: "number",
      description: "合計 exactly as written in this block (do NOT recompute).",
    },
    bbox: {
      type: "object",
      description:
        "この枠が画像内のどこにあるかを示す矩形。画像全体の幅・高さに対する割合(0〜1)で返す。枠の見出しから合計欄までを含めること。",
      properties: {
        x: { type: "number", description: "左端の位置（画像幅に対する割合 0〜1）" },
        y: { type: "number", description: "上端の位置（画像高さに対する割合 0〜1）" },
        width: { type: "number", description: "枠の幅（画像幅に対する割合 0〜1）" },
        height: { type: "number", description: "枠の高さ（画像高さに対する割合 0〜1）" },
      },
      required: ["x", "y", "width", "height"],
    },
  },
  required: ["date", "person_name", "parts", "management_fee", "total", "bbox"],
};

/** Tool the model must call to return every filled-in memo block on the sheet. */
export const RECORD_MEMOS_TOOL: Anthropic.Tool = {
  name: "record_memos",
  description:
    "Return the structured contents of EVERY filled-in handwritten material-cost memo block (材料費メモ) on the sheet. A printed sheet may contain several blocks (one per person).",
  input_schema: {
    type: "object",
    properties: {
      memos: {
        type: "array",
        description:
          "One entry per memo block that has any handwriting (氏名 or parts). Skip blank blocks entirely.",
        items: MEMO_BLOCK_SCHEMA,
      },
    },
    required: ["memos"],
  },
};

export const OCR_SYSTEM_PROMPT = `あなたはAtelierM（手芸サークル）の会計担当です。添付された手書きの材料費メモ（画像）を読み取り、record_memos ツールで構造化して返します。

重要: 1枚のシートには複数のメモ枠（人数分）が印刷されています。**記入のある枠をすべて**読み取り、memos 配列に1枠＝1要素として返してください。空欄の枠は含めないでください。各枠は「月日・名前・製作したもの・パーツ表・合計」で構成されます。

各枠で読み取る項目:
- 日付（例: 4/27）
- 氏名（購入者。ニックネームの場合あり）
- 各パーツ: パーツ名 / 単価 / 数量 / 金額
- 備考: 丸で囲まれた文字。「ア」「ひ」が丸囲みなら note にそれを、他の文字が丸囲みなら 'other'、丸囲みが無ければ 'none'。
- 管理費（材料費小計に加算される費用。記載が無ければ 0）
- 合計（メモに記載された各人の合計金額。通常は 材料費小計 ＋ 管理費）
- bbox: その枠が画像内のどこにあるか。画像全体の幅・高さに対する割合(0〜1)で x（左端）・y（上端）・width（幅）・height（高さ）を返す。枠の見出しから合計欄まで全体を囲むこと。

重要なルール:
- 金額・合計はメモに「書かれている通り」に読み取ること。自分で計算し直して値を変えてはいけない（検証は後段で行う）。
- 読み取れない、または曖昧な文字は推測で埋めず、可能な範囲で最も確からしい値を入れ、不確実さは値を変えないことで保つ。
- 数値はカンマや「円」を除いた整数で返す。`;
