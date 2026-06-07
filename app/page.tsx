import Link from "next/link";

const tiles = [
  { href: "/memos/new", title: "メモを記帳", desc: "手書きメモを撮影して記帳", emoji: "📷", accent: "primary" },
  { href: "/memos", title: "記帳履歴", desc: "会員・回ごとのメモを確認", emoji: "🧾", accent: "secondary" },
  { href: "/ledger", title: "会計台帳", desc: "回ごとの収入・支出を確認", emoji: "📒", accent: "accent" },
  { href: "/members", title: "会員管理", desc: "会員・ニックネームの編集", emoji: "👥", accent: "secondary" },
  { href: "/settings", title: "年度設定", desc: "前年度残高・差額・部屋代", emoji: "⚙️", accent: "neutral" },
  { href: "/export", title: "Excel出力", desc: "年度を選んでダウンロード", emoji: "📊", accent: "accent" },
] as const;

const ACCENT_BG: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  accent: "bg-accent/15 text-accent-content",
  neutral: "bg-neutral/10 text-neutral",
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <section className="mb-7">
        <p className="text-sm font-medium text-primary">2026年度</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">こんにちは 👋</h1>
        <p className="mt-1 text-sm text-base-content/60">
          手書きメモから、撮るだけで記帳。やることを選んでください。
        </p>
      </section>

      {/* 主アクション */}
      <Link
        href="/memos/new"
        className="card mb-5 bg-primary text-primary-content shadow-md transition active:scale-[0.99]"
      >
        <div className="card-body flex-row items-center gap-4 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-content/15 text-2xl">
            📷
          </span>
          <div className="min-w-0">
            <h2 className="card-title text-lg">メモを記帳する</h2>
            <p className="text-sm text-primary-content/80">写真を撮って、1件ずつ確認して登録</p>
          </div>
          <span className="ml-auto text-xl opacity-70">→</span>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.slice(1).map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="card border border-base-300 bg-base-100 shadow-sm transition hover:shadow-md active:scale-[0.99]"
          >
            <div className="card-body flex-row items-center gap-4 p-4">
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${ACCENT_BG[t.accent]}`}
              >
                {t.emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{t.title}</span>
                <span className="block truncate text-sm text-base-content/60">{t.desc}</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
