"use client";

import Link from "next/link";
import { useState } from "react";

export default function ExportPage() {
  const [year, setYear] = useState(2026);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500">
          ← 戻る
        </Link>
        <h1 className="font-semibold">Excel出力</h1>
        <span className="w-10" />
      </div>

      <label className="mb-5 block text-sm">
        <span className="mb-1 block text-neutral-500">会計年度</span>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-full rounded-lg border border-neutral-300 p-2"
        >
          {[2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>
              {y}年度
            </option>
          ))}
        </select>
      </label>

      <a
        href={`/api/export?year=${year}`}
        className="block rounded-xl bg-neutral-900 py-3 text-center font-semibold text-white dark:bg-white dark:text-black"
      >
        {year}年度の帳簿をダウンロード
      </a>

      <p className="mt-4 text-xs text-neutral-400">
        選択した年度のセッション・記帳・出欠をテンプレートに書き出します（数式・書式は保持）。
      </p>
    </main>
  );
}
