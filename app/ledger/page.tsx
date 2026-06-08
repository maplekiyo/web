"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SessionLite } from "@/lib/domain/match";
import type { LedgerEntry } from "@/lib/domain/types";

interface LedgerResponse {
  income: LedgerEntry[];
  expense: LedgerEntry[];
  incomeTotal: number;
  expenseTotal: number;
  membershipTotal: number;
}

// Monday-start week containing `today`. Returns true if `dateStr` falls in it.
function isThisWeek(dateStr: string, today = new Date()): boolean {
  const d = new Date(dateStr + "T00:00:00");
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = (base.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(base);
  start.setDate(base.getDate() - dow);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

export default function LedgerPage() {
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function loadLedger(id: string) {
    setSessionId(id);
    setLedger(null);
    if (!id) return;
    setBusy(true);
    fetch(`/api/ledger?sessionId=${id}`)
      .then((r) => r.json())
      .then((l) => setLedger(l.error ? null : l))
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((s) => {
        if (!Array.isArray(s)) return;
        setSessions(s);
        // Default: this week's session if registered, otherwise none.
        const thisWeek = s.find((x: SessionLite) => isThisWeek(x.session_date));
        if (thisWeek) loadLedger(thisWeek.id);
      })
      .catch(() => {});
  }, []);

  async function createSession() {
    if (!newDate) {
      setCreateError("日付を入力してください");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_date: newDate,
          activity_name: newActivity,
          fiscal_year: 2026,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "作成に失敗しました");
      const list: SessionLite[] = await fetch("/api/sessions").then((r) => r.json());
      setSessions(Array.isArray(list) ? list : []);
      setShowNew(false);
      setNewDate("");
      setNewActivity("");
      loadLedger(json.id); // select the newly created session
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "エラー");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn btn-ghost btn-sm -ml-2 px-2">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight">会計台帳</h1>
      </div>

      <div className="mb-3 flex gap-2">
        <select
          value={sessionId}
          onChange={(e) => loadLedger(e.target.value)}
          className="select select-bordered select-sm flex-1"
        >
          <option value="">回を選択…</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.session_date} {s.activity_name ?? ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setCreateError(null);
            setShowNew((v) => !v);
          }}
          className="btn btn-outline btn-sm shrink-0"
        >
          {showNew ? "取消" : "＋新規"}
        </button>
      </div>

      {showNew && (
        <div className="card mb-5 border border-base-300 bg-base-200/60 shadow-sm">
          <div className="card-body gap-3 p-4">
            <span className="font-semibold">セッションを新規作成</span>
            <label className="form-control text-sm">
              <span className="mb-1 block text-base-content/60">日付</span>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="input input-bordered w-full"
              />
            </label>
            <label className="form-control text-sm">
              <span className="mb-1 block text-base-content/60">活動内容（任意）</span>
              <input
                value={newActivity}
                onChange={(e) => setNewActivity(e.target.value)}
                placeholder="自由製作 など"
                className="input input-bordered w-full"
              />
            </label>
            {createError && (
              <div role="alert" className="alert alert-error py-2 text-sm">
                <span>{createError}</span>
              </div>
            )}
            <button onClick={createSession} disabled={creating} className="btn btn-primary btn-sm">
              {creating && <span className="loading loading-spinner loading-xs" />}
              {creating ? "作成中…" : "作成"}
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 text-sm text-base-content/50">
          <span className="loading loading-spinner loading-sm" />
          読み込み中…
        </div>
      )}

      {ledger && (
        <div className="flex flex-col gap-6">
          <Section
            title="収入（材料費）"
            badge="収入"
            badgeClass="badge-success"
            entries={ledger.income}
            total={ledger.incomeTotal}
            extraLabel="会費"
            extra={ledger.membershipTotal}
          />
          <Section
            title="支出（材料費）"
            badge="支出"
            badgeClass="badge-error"
            entries={ledger.expense}
            total={ledger.expenseTotal}
          />
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  badge,
  badgeClass,
  entries,
  total,
  extraLabel,
  extra,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  entries: LedgerEntry[];
  total: number;
  extraLabel?: string;
  extra?: number;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-semibold">
        <span className={`badge ${badgeClass} badge-sm`}>{badge}</span>
        {title}
      </h2>
      <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
        <table className="table table-sm">
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td className="text-base-content/40" colSpan={2}>
                  データなし
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.partName}>
                <td>{e.partName}</td>
                <td className="text-right tabular-nums">{e.amount.toLocaleString()}</td>
              </tr>
            ))}
            {extra !== undefined && (
              <tr className="text-base-content/60">
                <td>{extraLabel}</td>
                <td className="text-right tabular-nums">{extra.toLocaleString()}</td>
              </tr>
            )}
            <tr className="bg-base-200 font-semibold">
              <td>計</td>
              <td className="text-right tabular-nums">{total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
