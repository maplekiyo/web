"use client";

import Link from "next/link";
import { useState } from "react";

export default function ExportPage() {
  const [year, setYear] = useState(2026);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn btn-ghost btn-sm -ml-2 px-2">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight">Excel出力</h1>
      </div>

      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <label className="form-control">
            <span className="mb-1 block text-sm font-medium text-base-content/60">会計年度</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="select select-bordered w-full"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
          </label>

          <a href={`/api/export?year=${year}`} className="btn btn-primary btn-block">
            📊 {year}年度の帳簿をダウンロード
          </a>

          <p className="text-xs text-base-content/50">
            選択した年度のセッション・記帳・出欠をテンプレートに書き出します（数式・書式は保持）。
          </p>
        </div>
      </div>
    </main>
  );
}
