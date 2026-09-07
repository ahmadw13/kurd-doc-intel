"use client";

import React, { useState } from "react";
import { 
  FileText, 
  UploadCloud, 
  Search, 
  Sparkles, 
  Layers, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Globe, 
  MapPin, 
  Tag, 
  ExternalLink 
} from "lucide-react";

interface DocumentMetadata {
  title?: string;
  document_type?: string;
  date_mentioned?: string;
  dialect?: string;
  location?: string;
  entities: string[];
  summary?: string;
}

interface ParseResponse {
  document_id: string;
  filename: string;
  page_count: number;
  transcription_markdown: string;
  metadata: DocumentMetadata;
  processing_time_seconds: number;
}

interface SourceCitation {
  document_id: string;
  chunk_index: number;
  text_snippet: string;
  relevance_score: number;
}

interface QueryResponse {
  answer: string;
  citations: SourceCitation[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [maxPages, setMaxPages] = useState<number>(3);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // RAG Query states
  const [question, setQuestion] = useState<string>("");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    setParseResult(null);
    setQueryResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/parse?max_pages=${maxPages}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const data: ParseResponse = await res.json();
      setParseResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "هەڵەیەک لە کاتی شیکردنەوەی بەڵگەنامەکەدا ڕوویدا");
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsQuerying(true);
    setErrorMsg(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question,
          document_ids: parseResult ? [parseResult.document_id] : undefined,
          top_k: 3,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Query failed" }));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const data: QueryResponse = await res.json();
      setQueryResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "هەڵەیەک لە لێکۆڵینەوە و گەڕانی بەڵگەنامەدا ڕوویدا");
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-kurdish text-slate-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                KurdDocIntel
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  AI Olympiad 2026
                </span>
              </h1>
              <p className="text-xs text-slate-400">سیستەمی ژیریی دەستکرد بۆ ساغکردنەوە و گەڕانی بەڵگەنامە کوردییەکان</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 border border-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Gemini Flash VLM + ChromaDB
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Hero Section */}
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/40 p-6 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                بەدیجیتاڵکردنی دەستنووس و ڕۆژنامە مێژووییە کوردییەکان
              </h2>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
                ئەم سیستەمە بە هاوکاریی مۆدێلە پێشکەوتووەکانی بینایی و زمان (VLM)، پەڕە و دەستنووسە کوردییەکان دەخوێنێتەوە، زانیارییەکان پوخت دەکاتەوە و توانای گەڕانی ماناویی پێشکەش دەکات.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 text-emerald-300">سۆرانی & کرمانجی</span>
              <span className="rounded-lg bg-teal-950/60 border border-teal-800/40 px-3 py-1.5 text-teal-300">دەرهێنانی مێژوو & شوێن</span>
              <span className="rounded-lg bg-sky-950/60 border border-sky-800/40 px-3 py-1.5 text-sky-300">Semantic Search (RAG)</span>
            </div>
          </div>
        </section>

        {/* Upload & Configuration Card */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <UploadCloud className="h-5 w-5 text-emerald-400" />
              بارکردنی بەڵگەنامە (PDF یان وێنە)
            </h3>

            <div className="flex flex-col gap-4">
              <label 
                htmlFor="file-upload" 
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all cursor-pointer text-center"
              >
                <UploadCloud className="h-10 w-10 text-slate-500 mb-2" />
                <span className="text-sm font-medium text-slate-200">
                  {file ? file.name : "پەڕگەی PDF یان وێنە دیاری بکە"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  پشتگیری لە فۆرماتی PDF, JPG, PNG دەکات
                </span>
                <input 
                  id="file-upload" 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png,.webp" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>

              {/* Max pages control */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
                  <span>ژمارەی پەڕە بۆ شیکردنەوە:</span>
                  <span className="font-bold text-emerald-400">{maxPages} پەڕە</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  value={maxPages} 
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  دەتوانیت لە ١ تا ١٠ پەڕە هەڵبژێریت بۆ تێستی خێرا و پاراستنی پشکی کوۆتا.
                </p>
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    شیکردنەوەی پەڕەکان لە ڕێگەی ژیریی دەستکردەوە...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    دەستپێکردنی ساغکردنەوەی بەڵگەنامە
                  </>
                )}
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <p>{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Document Summary & Metadata Viewer */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-teal-400" />
                زانیارییە سەرەکییە دەرهێنراوەکان (Metadata)
              </h3>

              {parseResult ? (
                <div className="space-y-4">
                  {/* Status header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      شیکردنەوە سەرکەوتوو بوو
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {parseResult.page_count} پەڕە
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {parseResult.processing_time_seconds} چرکە
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">ID: {parseResult.document_id}</span>
                    </div>
                  </div>

                  {/* Metadata tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <span className="text-[11px] text-slate-500 block mb-1">ناونیشانی بەڵگەنامە</span>
                      <span className="text-sm font-semibold text-white line-clamp-1">
                        {parseResult.metadata.title || "نادیار"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <span className="text-[11px] text-slate-500 block mb-1 flex items-center gap-1">
                        <Globe className="h-3 w-3" /> شێوەزار
                      </span>
                      <span className="text-sm font-semibold text-teal-300">
                        {parseResult.metadata.dialect || "سۆرانی"}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <span className="text-[11px] text-slate-500 block mb-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> شوێن / شار
                      </span>
                      <span className="text-sm font-semibold text-sky-300">
                        {parseResult.metadata.location || "دیاری نەکراوە"}
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  {parseResult.metadata.summary && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300 leading-relaxed">
                      <span className="text-slate-400 font-semibold block mb-1">پوختەی ناوەڕۆک (Summary):</span>
                      {parseResult.metadata.summary}
                    </div>
                  )}

                  {/* Extracted Entities */}
                  {parseResult.metadata.entities && parseResult.metadata.entities.length > 0 && (
                    <div>
                      <span className="text-xs text-slate-400 font-semibold block mb-2 flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" /> ناوی کەسایەتی، ڕێکخراو و دەزگاکان:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {parseResult.metadata.entities.map((entity, idx) => (
                          <span 
                            key={idx} 
                            className="rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-200"
                          >
                            {entity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                  <FileText className="h-8 w-8 mb-2 opacity-40" />
                  بەڵگەنامەیەک باربکە تا پوختە، شێوەزار و ناوەڕۆکەکەی لەم بەشەدا دەربکەوێت
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Dual Pane: Live Transcription Markdown & Kurdish RAG Chatbot */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Transcription Pane */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur flex flex-col h-[520px]">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-emerald-400" />
              دەقی ساغکراوەی کوردی (OCR Markdown)
            </h3>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950 p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {parseResult ? (
                parseResult.transcription_markdown
              ) : (
                <span className="text-slate-600 italic">هیچ دەقێک تا ئێستا بار نەکراوە...</span>
              )}
            </div>
          </div>

          {/* Semantic Archival Search / RAG Chat */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur flex flex-col h-[520px]">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
              <Search className="h-5 w-5 text-sky-400" />
              پرسیارکردن لە بەڵگەنامەکە (Semantic Q&A / RAG)
            </h3>

            {/* Answer Display */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950 p-4 text-sm space-y-4">
              {queryResult ? (
                <div>
                  <div className="text-slate-200 leading-relaxed mb-4 border-b border-slate-800 pb-3">
                    <span className="text-xs text-emerald-400 font-semibold block mb-1">وەڵامی ژیریی دەستکرد:</span>
                    {queryResult.answer}
                  </div>

                  {queryResult.citations && queryResult.citations.length > 0 && (
                    <div>
                      <span className="text-xs text-slate-400 font-semibold block mb-2">بەشە سەرچاوە دۆزراوەکان (Citations):</span>
                      <div className="space-y-2">
                        {queryResult.citations.map((cite, i) => (
                          <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs text-slate-300">
                            <div className="flex items-center justify-between text-slate-500 mb-1 text-[11px]">
                              <span>پارچە ژمارە {cite.chunk_index + 1}</span>
                              <span className="text-emerald-400 font-mono">ڕێژەی نزیکی: {(cite.relevance_score * 100).toFixed(1)}%</span>
                            </div>
                            <p className="line-clamp-2 text-slate-400 italic">"{cite.text_snippet}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 text-xs">
                  <Search className="h-8 w-8 mb-2 opacity-40" />
                  پرسیارێک لەسەر بەڵگەنامەکە بنووسە بۆ دۆزینەوەی دەقی پەیوەندیدار
                </div>
              )}
            </div>

            {/* Question Input Form */}
            <form onSubmit={handleQuery} className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="پرسیارەکەت بنووسە... (بۆ نموونە: ئەم بابەتە باسی چی دەکات؟)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isQuerying}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!question.trim() || isQuerying}
                className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                بگەڕێ
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        KurdDocIntel — بۆ پێشبڕکێی AI Olympiad 2026 | خزمەتگوزاری دیجیتاڵکردن و گەڕانی سەرچاوە و بەڵگەنامە مێژووییە کوردییەکان
      </footer>
    </div>
  );
}