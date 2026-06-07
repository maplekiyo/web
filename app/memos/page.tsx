"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MemberLite, SessionLite } from "@/lib/domain/match";

interface MemoSummary {
  id: string;
  declared_total: number;
  status: string;
  created_at: string;
  has_image: boolean;
  member_name: string | null;
  session_date: string | null;
  activity_name: string | null;
  line_count: number;
}

export default function MemoHistoryPage() {
  const [memos, setMemos] = useState<MemoSummary[]>([]);
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sessions").then((r) => r.json()),
      fetch("/api/members").then((r) => r.json()),
    ])
      .then(([s, m]) => {
        if (Array.isArray(s)) setSessions(s);
        if (Array.isArray(m)) setMembers(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams();
    if (sessionId) qs.set("sessionId", sessionId);
    if (memberId) qs.set("memberId", memberId);
    fetch(`/api/memos?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => active && Array.isArray(d) && setMemos(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [sessionId, memberId]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-neutral-500">
          ← 戻る
        </Link>
        <h1 className="font-semibold">記帳履歴</h1>
        <span className="w-10" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2 text-sm"
        >
          <option value="">すべての回</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.session_date} {s.activity_name ?? ""}
            </option>
          ))}
        </select>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="rounded-lg border border-neutral-300 p-2 text-sm"
        >
          <option value="">すべての会員</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">読み込み中…</p>
      ) : memos.length === 0 ? (
        <p className="text-sm text-neutral-400">記帳データがありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {memos.map((m) => (
            <li key={m.id}>
              <Link
                href={`/memos/${m.id}`}
                className="flex items-center justify-between rounded-xl border border-neutral-200 p-3"
              >
                <span>
                  <span className="font-medium">{m.member_name ?? "（不明）"}</span>
                  <span className="block text-xs text-neutral-500">
                    {m.session_date} {m.activity_name ?? ""} ・ {m.line_count}点
                    {m.has_image && " ・ 📷"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="font-semibold tabular-nums">
                    ¥{m.declared_total.toLocaleString()}
                  </span>
                  <span className="block text-xs text-neutral-400">›</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
