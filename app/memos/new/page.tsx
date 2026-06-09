"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { matchMember, matchSession, type MemberLite, type SessionLite } from "@/lib/domain/match";
import type { Memo, MemoBBox, MemoLine, MemoNote } from "@/lib/domain/types";
import { validateMemo } from "@/lib/domain/validation";

const NOTES: MemoNote[] = ["none", "ア", "ひ", "other"];
const NOTE_LABEL: Record<MemoNote, string> = {
  none: "なし",
  ア: "ア（収入のみ）",
  ひ: "ひ（収入＋支出）",
  other: "その他（収入＋支出）",
};

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

type Step = "capture" | "review";

interface Entry {
  memo: Memo;
  memberId: string;
  sessionId: string;
  posted: boolean; // 登録済みかどうか
  posting: boolean; // 登録処理中
  postError: string | null;
}

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const data = result.split(",")[1] ?? "";
      resolve({ data, mediaType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewMemoPage() {
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<{ data: string; mediaType: string } | null>(null);
  // Path returned after the first registration uploads the photo; reused so we
  // don't re-upload the same sheet for every form.
  const [imagePath, setImagePath] = useState<string | null>(null);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [sessions, setSessions] = useState<SessionLite[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/sessions").then((r) => r.json()),
    ])
      .then(([m, s]) => {
        if (Array.isArray(m)) setMembers(m);
        if (Array.isArray(s)) setSessions(s);
      })
      .catch(() => {});
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { data, mediaType } = await fileToBase64(file);
      setPreview(`data:${mediaType};base64,${data}`);
      setImage({ data, mediaType });
      setImagePath(null);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: data, mediaType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "読み取りに失敗しました");
      const results: { memo: Memo }[] = json.memos ?? [];
      if (results.length === 0) throw new Error("記入のあるメモが見つかりませんでした");
      setEntries(
        results.map(({ memo }) => {
          const mm = matchMember(memo.personName, members);
          const ms = matchSession(memo.date, sessions);
          return {
            memo,
            memberId: mm?.id ?? "",
            sessionId: ms?.id ?? "",
            posted: false,
            posting: false,
            postError: null,
          };
        }),
      );
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  function patchEntry(i: number, patch: Partial<Entry>) {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function patchMemo(i: number, patch: Partial<Memo>) {
    setEntries((es) =>
      es.map((e, idx) => (idx === i ? { ...e, memo: { ...e.memo, ...patch } } : e)),
    );
  }
  function patchLine(i: number, li: number, patch: Partial<MemoLine>) {
    setEntries((es) =>
      es.map((e, idx) =>
        idx === i
          ? {
              ...e,
              memo: {
                ...e.memo,
                parts: e.memo.parts.map((p, pj) => (pj === li ? { ...p, ...patch } : p)),
              },
            }
          : e,
      ),
    );
  }

  const validations = entries.map((e) => validateMemo(e.memo));
  const postedCount = entries.filter((e) => e.posted).length;
  const allPosted = entries.length > 0 && postedCount === entries.length;

  // 1件のフォームだけを登録する。登録済みのものは再登録できない。
  async function postEntry(i: number) {
    const entry = entries[i];
    if (entry.posted || entry.posting) return;
    const validation = validations[i];
    if (!entry.memberId || !entry.sessionId || !validation.ok) return;

    patchEntry(i, { posting: true, postError: null });
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 初回のみ画像をアップロード、以降は返ってきたパスを再利用
          image: imagePath ? undefined : image ? { base64: image.data, mediaType: image.mediaType } : undefined,
          imagePath: imagePath ?? undefined,
          memos: [
            {
              sessionId: entry.sessionId,
              memberId: entry.memberId,
              declaredTotal: entry.memo.total,
              managementFee: entry.memo.managementFee ?? 0,
              ocrRaw: entry.memo,
              lines: entry.memo.parts,
            },
          ],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "記帳に失敗しました");
      if (json.imagePath && !imagePath) setImagePath(json.imagePath);
      patchEntry(i, { posted: true, posting: false, postError: null });
    } catch (err) {
      patchEntry(i, {
        posting: false,
        postError: err instanceof Error ? err.message : "エラー",
      });
    }
  }

  function reset() {
    setEntries([]);
    setPreview(null);
    setImage(null);
    setImagePath(null);
    setError(null);
    setStep("capture");
  }

  const progressPct = entries.length ? Math.round((postedCount / entries.length) * 100) : 0;

  return (
    <main
      className={`mx-auto w-full flex-1 px-4 py-6 ${step === "review" ? "max-w-2xl" : "max-w-md"}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn btn-ghost btn-sm -ml-2 gap-1 px-2">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight">メモを記帳</h1>
      </div>

      {error && (
        <div role="alert" className="alert alert-error mb-4 py-3 text-sm">
          <span>{error}</span>
        </div>
      )}

      {step === "capture" && (
        <label className="card flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-primary/40 bg-base-100 text-base-content/60 transition hover:border-primary hover:bg-primary/5">
          {busy ? (
            <>
              <span className="loading loading-spinner loading-lg text-primary" />
              <span className="font-medium text-base-content">読み取り中…</span>
              <span className="text-xs text-base-content/50">少し時間がかかります</span>
            </>
          ) : (
            <>
              <span className="text-5xl">📷</span>
              <span className="font-medium text-base-content">写真を撮る / 選ぶ</span>
              <span className="text-xs text-base-content/50">複数人のシートも一度に読み取ります</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={onPick}
          />
        </label>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-5">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="memo"
              className="max-h-40 w-full rounded-box border border-base-300 bg-base-100 object-contain"
            />
          )}

          {/* 全フォームの登録進捗（登録済み件数 / 総数）— 進捗が分かるのでバー表示 */}
          <div className="card border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm">
              <p className="text-base-content/70">
                {entries.length}件のメモを検出。1件ずつ確認して登録してください。
              </p>
              <span className="badge badge-ghost shrink-0 font-semibold">
                {postedCount} / {entries.length}
              </span>
            </div>
            <progress
              className="progress progress-success h-2.5 w-full"
              value={postedCount}
              max={entries.length}
            />
          </div>

          {entries.map((entry, i) => (
            <EntryCard
              key={i}
              index={i}
              entry={entry}
              validation={validations[i]}
              members={members}
              sessions={sessions}
              imageSrc={preview}
              onPatchEntry={(p) => patchEntry(i, p)}
              onPatchMemo={(p) => patchMemo(i, p)}
              onPatchLine={(li, p) => patchLine(i, li, p)}
              onPost={() => postEntry(i)}
            />
          ))}

          {allPosted ? (
            <div className="card items-center gap-3 border border-success/30 bg-success/10 py-8 text-center">
              <span className="text-5xl">🎉</span>
              <p className="text-lg font-bold text-success">
                すべてのメモ（{entries.length}件・{progressPct}%）を登録しました
              </p>
              <div className="flex gap-3">
                <Link href="/memos" className="btn btn-outline btn-sm">
                  履歴を見る
                </Link>
                <button onClick={reset} className="btn btn-primary btn-sm">
                  続けて記帳
                </button>
              </div>
            </div>
          ) : (
            <button onClick={reset} className="btn btn-ghost btn-block">
              最初からやり直す
            </button>
          )}
        </div>
      )}
    </main>
  );
}

/** その1件分のフォームを、シート画像から切り抜いて表示する。 */
function FormCrop({ src, bbox }: { src: string | null; bbox?: MemoBBox }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // bbox 未検出なら画像全体を表示（フォールバック）。少し余白(padding)を足して
      // 切り抜きが見切れないようにする。
      const pad = 0.01;
      const b = bbox ?? { x: 0, y: 0, width: 1, height: 1 };
      const x = Math.max(0, b.x - pad);
      const y = Math.max(0, b.y - pad);
      const w = Math.min(1 - x, b.width + pad * 2);
      const h = Math.min(1 - y, b.height + pad * 2);
      const sx = x * img.width;
      const sy = y * img.height;
      const sw = Math.max(1, w * img.width);
      const sh = Math.max(1, h * img.height);
      canvas.width = sw;
      canvas.height = sh;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    };
    img.src = src;
  }, [src, bbox]);

  if (!src) return null;
  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-box border border-base-300 bg-white object-contain"
    />
  );
}

function EntryCard({
  index,
  entry,
  validation,
  members,
  sessions,
  imageSrc,
  onPatchEntry,
  onPatchMemo,
  onPatchLine,
  onPost,
}: {
  index: number;
  entry: Entry;
  validation: ReturnType<typeof validateMemo>;
  members: MemberLite[];
  sessions: SessionLite[];
  imageSrc: string | null;
  onPatchEntry: (p: Partial<Entry>) => void;
  onPatchMemo: (p: Partial<Memo>) => void;
  onPatchLine: (li: number, p: Partial<MemoLine>) => void;
  onPost: () => void;
}) {
  const { memo, posted } = entry;
  const locked = posted; // 登録済みは編集・再登録不可
  const lineMismatches = validation.lines.filter((l) => !l.ok);
  const canPost = !!entry.memberId && !!entry.sessionId && validation.ok;

  return (
    <div
      className={`card border bg-base-100 shadow-sm transition ${
        posted ? "border-success/40 bg-success/5" : "border-base-300"
      }`}
    >
      <div className="card-body gap-4 p-4">
        <div className="flex items-center justify-between">
          <span className="font-bold">メモ {index + 1}</span>
          {posted ? (
            <span className="badge badge-success gap-1 font-semibold text-success-content">
              ✓ 登録済み
            </span>
          ) : validation.ok ? (
            <span className="badge badge-success badge-outline gap-1">検証OK</span>
          ) : (
            <span className="badge badge-error gap-1 font-semibold text-error-content">
              金額不一致
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row-reverse">
          {/* この1件分のフォーム画像（シートから切り抜き）— 右側に固定幅で表示。
              複数フォームでも右端で縦に揃う。 */}
          <div className="sm:w-44 sm:shrink-0">
            <FormCrop src={imageSrc} bbox={memo.bbox} />
            <p className="mt-1 text-center text-[11px] text-base-content/40">この枠の画像</p>
          </div>

          {/* 入力フォーム本体 */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="form-control">
                <span className="mb-1 block text-xs font-medium text-base-content/60">氏名</span>
                <select
                  value={entry.memberId}
                  disabled={locked}
                  onChange={(e) => onPatchEntry({ memberId: e.target.value })}
                  className="select select-sm select-bordered w-full"
                >
                  <option value="">選択…（{memo.personName}）</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="mb-1 block text-xs font-medium text-base-content/60">日付</span>
                <select
                  value={entry.sessionId}
                  disabled={locked}
                  onChange={(e) => onPatchEntry({ sessionId: e.target.value })}
                  className="select select-sm select-bordered w-full"
                >
                  <option value="">選択…（{memo.date}）</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.session_date} {s.activity_name ?? ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto rounded-box border border-base-300">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>パーツ</th>
                    <th>単価</th>
                    <th>数量</th>
                    <th>金額</th>
                    <th>備考</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {memo.parts.map((p, li) => {
                    const lv = validation.lines[li];
                    return (
                      <tr key={li} className={lv.ok ? "" : "bg-error/10"}>
                        <td>
                          <input
                            value={p.partName}
                            disabled={locked}
                            onChange={(e) => onPatchLine(li, { partName: e.target.value })}
                            className="input input-xs input-bordered w-24"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={p.unitPrice}
                            disabled={locked}
                            onChange={(e) => onPatchLine(li, { unitPrice: Number(e.target.value) })}
                            className="input input-xs input-bordered w-16"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={p.quantity}
                            disabled={locked}
                            onChange={(e) => onPatchLine(li, { quantity: Number(e.target.value) })}
                            className="input input-xs input-bordered w-14"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={p.amount}
                            disabled={locked}
                            onChange={(e) => onPatchLine(li, { amount: Number(e.target.value) })}
                            className="input input-xs input-bordered w-16"
                          />
                        </td>
                        <td>
                          <select
                            value={p.note}
                            disabled={locked}
                            onChange={(e) => onPatchLine(li, { note: e.target.value as MemoNote })}
                            className="select select-xs select-bordered"
                          >
                            {NOTES.map((n) => (
                              <option key={n} value={n}>
                                {NOTE_LABEL[n]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-center">{lv.ok ? "✅" : "❌"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-base-content/60">
                  管理費
                  <input
                    type="number"
                    value={memo.managementFee ?? 0}
                    disabled={locked}
                    onChange={(e) => onPatchMemo({ managementFee: Number(e.target.value) })}
                    className="input input-xs input-bordered w-24"
                  />
                </label>
                <span className="text-base-content/60">小計 {yen(validation.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-base-content/60">
                  合計
                  <input
                    type="number"
                    value={memo.total}
                    disabled={locked}
                    onChange={(e) => onPatchMemo({ total: Number(e.target.value) })}
                    className="input input-xs input-bordered w-24"
                  />
                </label>
                <span className={validation.totalOk ? "text-success" : "text-error"}>
                  小計＋管理費 {yen(validation.computedTotal)} {validation.totalOk ? "✅" : "❌"}
                </span>
              </div>
            </div>

            {/* 金額不一致の詳細：どの行が・いくら違うのかを具体的に表示 */}
            {!validation.ok && !posted && (
              <div role="alert" className="alert alert-error items-start text-sm">
                <div>
                  <p className="mb-1 font-semibold">金額の不一致が見つかりました：</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {lineMismatches.map((l) => (
                      <li key={l.index}>
                        {l.index + 1}行目「{l.partName || "（名称未入力）"}」：単価 {yen(l.unitPrice)} ×
                        数量 {l.quantity} = {yen(l.expectedAmount)} のはずが、金額は {yen(l.actualAmount)}（差
                        {yen(l.actualAmount - l.expectedAmount)}）
                      </li>
                    ))}
                    {!validation.totalOk && (
                      <li>
                        合計：小計 {yen(validation.subtotal)} ＋ 管理費{" "}
                        {yen(validation.managementFee)} = {yen(validation.computedTotal)} に対し、
                        記載合計は {yen(validation.declaredTotal)}（差{" "}
                        {yen(validation.declaredTotal - validation.computedTotal)}）
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {entry.postError && (
              <div role="alert" className="alert alert-error py-2 text-sm">
                <span>{entry.postError}</span>
              </div>
            )}

            {/* 登録ボタン：未登録のときだけ表示。登録済みは「登録済み」表示に切り替わる */}
            {posted ? (
              <div className="flex items-center justify-center gap-2 rounded-box bg-success/15 py-3 font-semibold text-success">
                ✓ このメモは登録済みです
              </div>
            ) : (
              <button
                onClick={onPost}
                disabled={!canPost || entry.posting}
                className="btn btn-primary btn-block"
              >
                {entry.posting && <span className="loading loading-spinner loading-sm" />}
                {entry.posting ? "登録中…" : "このメモを登録する"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
