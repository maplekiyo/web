// Resolve a memo's free-text person name and date to DB records.

export interface MemberLite {
  id: string;
  full_name: string;
  nicknames?: string[];
}

export interface SessionLite {
  id: string;
  session_date: string; // YYYY-MM-DD
  activity_name: string | null;
}

/** Normalize for comparison: drop spaces (incl. full-width) and lowercase. */
function norm(s: string): string {
  return s.replace(/[\s　]+/g, "").toLowerCase();
}

/** Best member match by exact name, nickname, or substring. Null if ambiguous/none. */
export function matchMember(
  personName: string,
  members: MemberLite[],
): MemberLite | null {
  const q = norm(personName);
  if (!q) return null;

  const exact = members.filter(
    (m) =>
      norm(m.full_name) === q ||
      (m.nicknames ?? []).some((n) => norm(n) === q),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null; // ambiguous → let the user choose

  const partial = members.filter(
    (m) =>
      norm(m.full_name).includes(q) ||
      q.includes(norm(m.full_name)) ||
      (m.nicknames ?? []).some((n) => norm(n).includes(q) || q.includes(norm(n))),
  );
  return partial.length === 1 ? partial[0] : null;
}

/** Match "4/27" (or "M/D") to a session within the given list. */
export function matchSession(
  dateText: string,
  sessions: SessionLite[],
): SessionLite | null {
  const m = dateText.match(/(\d{1,2})\s*[\/月]\s*(\d{1,2})/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const hits = sessions.filter((s) => {
    const d = new Date(s.session_date + "T00:00:00Z");
    return d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });
  return hits.length === 1 ? hits[0] : null;
}
