"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Line {
  part_name: string;
  unit_price: number;
  quantity: number;
  amount: number;
  note: string;
  line_order: number;
}

interface MemoDetail {
  id: string;
  declared_total: number;
  created_at: string;
  has_image: boolean;
  member_name: string | null;
  session_date: string | null;
  activity_name: string | null;
  lines: Line[];
}

const NOTE_LABEL: Record<string, string> = {
  none: "なし",
  ア: "ア",
  ひ: "ひ",
  other: "他",
};

export default function MemoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [memo, setMemo] = useState<MemoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/memos/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.error) setError(d.error);
        else setMemo(d);
      })
      .catch(() => active && setError("読み込みに失敗しました"));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/memos" className="text-sm text-neutral-500">
          ← 履歴
        </Link>
        <h1 className="font-semibold">記帳詳細</h1>
        <span className="w-10" />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {memo && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-neutral-200 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">氏名</span>
              <span className="font-medium">{memo.member_name ?? "（不明）"}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-neutral-500">回</span>
              <span>
                {memo.session_date} {memo.activity_name ?? ""}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-neutral-500">合計</span>
              <span className="font-semibold tabular-nums">
                ¥{memo.declared_total.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                <tr>
                  <th className="p-2">パーツ</th>
                  <th className="p-2 text-right">単価</th>
                  <th className="p-2 text-right">数量</th>
                  <th className="p-2 text-right">金額</th>
                  <th className="p-2">備考</th>
                </tr>
              </thead>
              <tbody>
                {memo.lines.map((l, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    <td className="p-2">{l.part_name}</td>
                    <td className="p-2 text-right tabular-nums">{l.unit_price}</td>
                    <td className="p-2 text-right tabular-nums">{l.quantity}</td>
                    <td className="p-2 text-right tabular-nums">{l.amount}</td>
                    <td className="p-2">{NOTE_LABEL[l.note] ?? l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {memo.has_image && (
            <div>
              <span className="mb-1 block text-sm text-neutral-500">元のメモ画像</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/memos/${memo.id}/image`}
                alt="memo"
                className="w-full rounded-xl border border-neutral-200"
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
