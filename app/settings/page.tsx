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
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn btn-ghost btn-sm -ml-2 px-2">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight">年度設定</h1>
      </div>

      <label className="form-control mb-5">
        <span className="mb-1 block text-sm font-medium text-base-content/60">年度</span>
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

      {error && (
        <div role="alert" className="alert alert-error mb-3 py-3 text-sm">
          <span>{error}</span>
        </div>
      )}

      {form && (
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4">
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

            <button onClick={save} disabled={busy} className="btn btn-primary btn-block mt-1">
              {busy && <span className="loading loading-spinner loading-sm" />}
              {busy ? "保存中…" : "保存"}
            </button>
            {msg && (
              <div role="alert" className="alert alert-success py-2 text-sm">
                <span>{msg}</span>
              </div>
            )}
          </div>
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
    <label className="form-control text-sm">
      <span className="block font-medium">{label}</span>
      <span className="mb-1 block text-xs text-base-content/50">{hint}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input input-bordered w-full text-right tabular-nums"
      />
    </label>
  );
}
