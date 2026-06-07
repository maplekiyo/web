"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Fiscal {
  fiscal_year: number;
  prior_year_balance: number;
  difference: number;
  default_room_fee: number;
}

export default function SettingsPage() {
  const [year, setYear] = useState(2026);
  const [form, setForm] = useState<Fiscal | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/fiscal-settings?year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setMsg(null);
        setError(d.error ? "読み込みに失敗しました" : null);
        setForm(d.error ? null : d);
      })
      .catch(() => active && setError("読み込みに失敗しました"));
    return () => {
      active = false;
    };
  }, [year]);

  function set<K extends keyof Fiscal>(k: K, v: Fiscal[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/fiscal-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      setForm(json);
      setMsg("保存しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500">
          ← 戻る
        </Link>
        <h1 className="font-semibold">年度設定</h1>
        <span className="w-10" />
      </div>

      <label className="mb-5 block text-sm">
        <span className="mb-1 block text-neutral-500">年度</span>
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

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>
      )}

      {form && (
        <div className="flex flex-col gap-4">
          <Num
            label="前年度残高"
            hint="前年度から繰り越す残高（会計シート C78）"
            value={form.prior_year_balance}
            onChange={(v) => set("prior_year_balance", v)}
          />
          <Num
            label="差額（備蓄金）"
            hint="アトリエムの備蓄金（会計シート 差額）"
            value={form.difference}
            onChange={(v) => set("difference", v)}
          />
          <Num
            label="部屋代（既定）"
            hint="各回の部屋代の既定値"
            value={form.default_room_fee}
            onChange={(v) => set("default_room_fee", v)}
          />

          <button
            onClick={save}
            disabled={busy}
            className="mt-2 rounded-xl bg-neutral-900 py-3 font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            {busy ? "保存中…" : "保存"}
          </button>
          {msg && <p className="text-center text-sm text-green-600">{msg}</p>}
        </div>
      )}
    </main>
  );
}

function Num({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-sm">
      <span className="block font-medium">{label}</span>
      <span className="mb-1 block text-xs text-neutral-400">{hint}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-neutral-300 p-2 text-right tabular-nums"
      />
    </label>
  );
}
