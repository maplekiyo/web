import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AtelierM 会計",
  description: "手書きメモから記帳するAtelierMの会計アプリ",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      data-theme="atelierm"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-base-200 text-base-content">
        <header className="sticky top-0 z-30 border-b border-base-300/70 bg-base-100/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-content shadow-sm">
                M
              </span>
              <span>AtelierM 会計</span>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
