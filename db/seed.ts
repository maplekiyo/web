// Push db/seed-data.json into Supabase. Idempotent-ish: upserts on natural keys.
// Usage: npx tsx db/seed.ts   (requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//
// Run db/schema.sql first to create the tables.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { supabaseAdmin } from "@/lib/supabase";

interface SeedFile {
  members: Array<Record<string, unknown> & { full_name: string }>;
  nicknames: Array<{ nickname: string; full_name: string }>;
  sessions: Array<Record<string, unknown> & { session_date: string }>;
  fiscal: Record<string, unknown>;
}

async function main() {
  const seed: SeedFile = JSON.parse(
    readFileSync(join(process.cwd(), "db", "seed-data.json"), "utf8"),
  );
  const db = supabaseAdmin();

  // fiscal settings
  {
    const { error } = await db.from("fiscal_settings").upsert(seed.fiscal, {
      onConflict: "fiscal_year",
    });
    if (error) throw error;
  }

  // sessions (unique on fiscal_year+session_date)
  {
    const { error } = await db
      .from("sessions")
      .upsert(seed.sessions, { onConflict: "fiscal_year,session_date" });
    if (error) throw error;
  }

  // members — insert and capture ids by full_name for nickname linking
  {
    const { error } = await db.from("members").insert(seed.members);
    if (error && !`${error.message}`.includes("duplicate")) throw error;
  }
  const { data: members, error: mErr } = await db
    .from("members")
    .select("id, full_name");
  if (mErr) throw mErr;
  const byName = new Map(members!.map((m) => [m.full_name, m.id]));

  // nicknames
  const nickRows = seed.nicknames
    .map((n) => ({ member_id: byName.get(n.full_name), nickname: n.nickname }))
    .filter((n) => n.member_id);
  if (nickRows.length) {
    const { error } = await db
      .from("member_nicknames")
      .upsert(nickRows, { onConflict: "nickname" });
    if (error) throw error;
  }

  console.log(
    `✓ seeded: ${seed.members.length} members, ${seed.sessions.length} sessions, ${nickRows.length} nicknames`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
