import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KurdDocIntel — ژیریی دەستکرد بۆ شیکردنەوە و گەڕانی بەڵگەنامە کوردییەکان",
  description: "High-precision Kurdish OCR, document parsing, entity extraction, and multilingual semantic retrieval for Kurdish documents and books.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}