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
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/memos" className="btn btn-ghost btn-sm -ml-2 px-2">
          ← 履歴
        </Link>
        <h1 className="text-lg font-bold tracking-tight">記帳詳細</h1>
      </div>

      {error && (
        <div role="alert" className="alert alert-error py-3 text-sm">
          <span>{error}</span>
        </div>
      )}

      {memo && (
        <div className="flex flex-col gap-4">
          <div className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-2 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-base-content/50">氏名</span>
                <span className="font-medium">{memo.member_name ?? "（不明）"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/50">回</span>
                <span>
                  {memo.session_date} {memo.activity_name ?? ""}
                </span>
              </div>
              <div className="flex justify-between border-t border-base-200 pt-2">
                <span className="text-base-content/50">合計</span>
                <span className="font-semibold tabular-nums">
                  ¥{memo.declared_total.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>パーツ</th>
                  <th className="text-right">単価</th>
                  <th className="text-right">数量</th>
                  <th className="text-right">金額</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                {memo.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.part_name}</td>
                    <td className="text-right tabular-nums">{l.unit_price}</td>
                    <td className="text-right tabular-nums">{l.quantity}</td>
                    <td className="text-right tabular-nums">{l.amount}</td>
                    <td>{NOTE_LABEL[l.note] ?? l.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {memo.has_image && (
            <div>
              <span className="mb-1 block text-sm text-base-content/50">元のメモ画像</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/memos/${memo.id}/image`}
                alt="memo"
                className="w-full rounded-box border border-base-300"
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
