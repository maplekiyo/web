"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface Member {
  id: string;
  full_name: string;
  kana: string | null;
  household_no: number | null;
  role: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  school: string | null;
  birthday: string | null;
  active: boolean;
  nicknames: string[];
}

type Draft = Partial<Member>;

const EMPTY: Draft = { full_name: "", active: true };

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/members?all=1");
    const data = await res.json();
    if (Array.isArray(data)) setMembers(data);
    setLoading(false);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/members?all=1")
      .then((r) => r.json())
      .then((data) => {
        if (active && Array.isArray(data)) setMembers(data);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.kana ?? "").toLowerCase().includes(q) ||
        m.nicknames.some((n) => n.toLowerCase().includes(q)),
    );
  }, [members, query]);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="btn btn-ghost btn-sm -ml-2 px-2">
          ← 戻る
        </Link>
        <h1 className="text-lg font-bold tracking-tight">会員管理</h1>
        <button
          onClick={() => {
            setError(null);
            setEditing({ ...EMPTY });
          }}
          className="btn btn-primary btn-sm ml-auto"
        >
          ＋追加
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="氏名・なまえ・ニックネームで検索"
        className="input input-bordered mb-4 w-full"
      />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-base-content/50">
          <span className="loading loading-spinner loading-sm" />
          読み込み中…
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {filtered.map((m) => (
          <li
            key={m.id}
            className={`card border bg-base-100 shadow-sm ${
              m.active ? "border-base-300" : "border-base-300 bg-base-200/60 opacity-60"
            }`}
          >
            <button
              onClick={() => {
                setError(null);
                setEditing(m);
              }}
              className="flex w-full items-center justify-between p-3 text-left"
            >
              <span>
                <span className="font-medium">{m.full_name}</span>
                {m.role && <span className="badge badge-ghost badge-sm ml-2">{m.role}</span>}
                {m.kana && <span className="block text-xs text-base-content/40">{m.kana}</span>}
                {m.nicknames.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {m.nicknames.map((n) => (
                      <span key={n} className="badge badge-info badge-sm badge-outline">
                        {n}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="text-xs text-base-content/40">{m.household_no ?? "—"}</span>
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <MemberEditor
          draft={editing}
          error={error}
          onError={setError}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </main>
  );
}

function MemberEditor({
  draft,
  error,
  onError,
  onClose,
  onSaved,
}: {
  draft: Draft;
  error: string | null;
  onError: (e: string | null) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Draft>(draft);
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = !draft.id;

  function set<K extends keyof Member>(key: K, value: Member[K] | null) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.full_name?.trim()) {
      onError("氏名は必須です");
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(isNew ? "/api/members" : `/api/members/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  async function addNick() {
    const value = nick.trim();
    if (!value || !draft.id) return;
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/members/${draft.id}/nicknames`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "追加に失敗しました");
      setForm((f) => ({ ...f, nicknames: [...(f.nicknames ?? []), value] }));
      setNick("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  async function removeNick(value: string) {
    if (!draft.id) return;
    setBusy(true);
    try {
      await fetch(
        `/api/members/${draft.id}/nicknames?nickname=${encodeURIComponent(value)}`,
        { method: "DELETE" },
      );
      setForm((f) => ({
        ...f,
        nicknames: (f.nicknames ?? []).filter((n) => n !== value),
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-base-300 bg-base-100 p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isNew ? "会員を追加" : "会員を編集"}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="alert alert-error mb-3 py-2 text-sm">
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <MemberField label="氏名 *" value={form.full_name ?? ""} onChange={(v) => set("full_name", v)} />
          <MemberField label="なまえ" value={form.kana ?? ""} onChange={(v) => set("kana", v)} />
          <MemberField
            label="世帯番号"
            type="number"
            value={form.household_no ?? ""}
            onChange={(v) => set("household_no", v === "" ? null : Number(v))}
          />
          <MemberField label="役職" value={form.role ?? ""} onChange={(v) => set("role", v)} />
          <MemberField label="電話" value={form.phone ?? ""} onChange={(v) => set("phone", v)} />
          <MemberField label="誕生日" value={form.birthday ?? ""} onChange={(v) => set("birthday", v)} />
          <MemberField label="メール" value={form.email ?? ""} onChange={(v) => set("email", v)} />
          <MemberField label="学校・勤務先" value={form.school ?? ""} onChange={(v) => set("school", v)} />
        </div>
        <div className="mt-3">
          <MemberField label="住所" value={form.address ?? ""} onChange={(v) => set("address", v)} />
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active ?? true}
            onChange={(e) => set("active", e.target.checked)}
            className="checkbox checkbox-sm checkbox-primary"
          />
          在籍中（オフで非表示・記帳対象外）
        </label>

        {/* Nicknames — only for saved members */}
        <div className="mt-4">
          <span className="mb-1 block text-sm text-base-content/60">
            ニックネーム（メモの氏名照合に使用）
          </span>
          {isNew ? (
            <p className="text-xs text-base-content/40">
              先に保存すると、ニックネームを追加できます。
            </p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                {(form.nicknames ?? []).map((n) => (
                  <span key={n} className="badge badge-info badge-outline gap-1 py-3">
                    {n}
                    <button onClick={() => removeNick(n)} className="text-info/70 hover:text-info">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="join w-full">
                <input
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  placeholder="きよみん など"
                  className="input input-bordered join-item flex-1"
                />
                <button
                  onClick={addNick}
                  disabled={busy || !nick.trim()}
                  className="btn btn-outline join-item"
                >
                  追加
                </button>
              </div>
            </>
          )}
        </div>

        <button onClick={save} disabled={busy} className="btn btn-primary btn-block mt-5">
          {busy && <span className="loading loading-spinner loading-sm" />}
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}

function MemberField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="form-control text-sm">
      <span className="mb-1 block text-base-content/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input input-bordered w-full"
      />
    </label>
  );
}
