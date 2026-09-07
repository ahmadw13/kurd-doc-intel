import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KurdDocIntel — ژیریی دەستکرد بۆ بەڵگەنامە و دەستنووسە کوردییەکان",
  description: "High-precision Kurdish OCR, document parsing, paleography analysis, and semantic archival retrieval for historical and modern documents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ckb" dir="rtl" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}