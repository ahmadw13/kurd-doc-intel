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
  Languages 
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

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  citations?: SourceCitation[];
}

const translations = {
  ckb: {
    dir: "rtl",
    title: "KurdDocIntel",
    subtitle: "سیستەمی ژیریی دەستکرد بۆ خوێندنەوە و گەڕان لە بەڵگەنامە و کتێبە کوردییەکان",
    badge: "پڕۆژەی کراوە",
    techBadge: "Gemini Flash VLM + ChromaDB",
    heroTitle: "شیکردنەوە و خوێندنەوەی بەڵگەنامە و پەڕتووکە کوردییەکان",
    heroDesc: "سیستەمێکی پێشکەوتووی OCR و پڕۆسێسکردنی بەڵگەنامە بە هاوکاریی مۆدێلەکانی بینین و زمان (VLM) بۆ گۆڕینی پەڕەکان بۆ دەقی دیجیتاڵی، دەرهێنانی زانیاری و گەڕانی ماناوی (RAG).",
    heroTags: ["سۆرانی & کرمانجی", "دەرهێنانی زانیاری & ناسنامەکان", "Semantic Search (RAG)"],
    uploadTitle: "بارکردنی بەڵگەنامە (PDF یان وێنە)",
    chooseFile: "پەڕگەی PDF یان وێنە دیاری بکە",
    supportedFormats: "پشتگیری لە فۆرماتی PDF, JPG, PNG دەکات",
    maxPagesLabel: "ژمارەی پەڕە بۆ شیکردنەوە:",
    pagesUnit: "پەڕە",
    allPages: "هەموو پەڕەکان",
    processAllCheckbox: "شیکردنەوەی تەواوی پەڕەکان (بێ سنوور)",
    maxPagesHint: "دەتوانیت لە ١ تا ٢٠ پەڕە دیاری بکەیت یان هەموو پەڕەکان هەڵبژێریت.",
    startBtn: "دەستپێکردنی شیکردنەوەی بەڵگەنامە",
    processingBtn: "شیکردنەوەی پەڕەکان لە ڕێگەی ژیریی دەستکردەوە...",
    uploadProgressTitle: "پڕۆسێسکردنی بەڵگەنامە لە کاردایە",
    uploadProgressSubtitle: "پەڕەکان بە وردی دەخوێنرێنەوە و دەگۆڕدرێن بۆ دەقی دیجیتاڵی...",
    metadataTitle: "زانیارییە دەرهێنراوەکان (Metadata)",
    successStatus: "شیکردنەوە سەرکەوتوو بوو",
    secondsUnit: "چرکە",
    docTitle: "ناونیشانی بەڵگەنامە",
    unknown: "نادیار",
    dialect: "شێوەزار",
    defaultDialect: "سۆرانی",
    location: "شوێن / شار",
    locationUnspecified: "دیاری نەکراوە",
    summaryHeader: "پوختەی ناوەڕۆک (Summary):",
    entitiesHeader: "ناوی کەسایەتی، ڕێکخراو و دەزگاکان:",
    emptyUploadHint: "بەڵگەنامەیەک باربکە تا پوختە، شێوەزار و ناوەڕۆکەکەی لەم بەشەدا دەربکەوێت",
    ocrTitle: "دەقی دەرهێنراوی کوردی (OCR Markdown)",
    emptyOcr: "هیچ دەقێک تا ئێستا بار نەکراوە...",
    ragTitle: "پرسیارکردن لە بەڵگەنامەکە (Semantic Q&A / RAG)",
    aiAnswer: "وەڵامی ژیریی دەستکرد:",
    citationsHeader: "بەشە سەرچاوە دۆزراوەکان (Citations):",
    chunkPrefix: "پارچە ژمارە",
    relevance: "ڕێژەی نزیکی:",
    emptyRagHint: "پرسیارێک لەسەر بەڵگەنامەکە بنووسە بۆ دۆزینەوەی دەقی پەیوەندیدار",
    questionPlaceholder: "پرسیارەکەت بنووسە... (بۆ نموونە: ئەم بابەتە باسی چی دەکات؟)",
    searchBtn: "بگەڕێ",
    footer: "KurdDocIntel — پڕۆژەی کراوە بۆ دیجیتاڵکردن و گەڕانی بەڵگەنامە و سەرچاوە کوردییەکان",
    toggleBtn: "English",
  },
  en: {
    dir: "ltr",
    title: "KurdDocIntel",
    subtitle: "Kurdish Multimodal Document Intelligence & Semantic Search",
    badge: "Open Source",
    techBadge: "Gemini Flash VLM + ChromaDB",
    heroTitle: "Kurdish Document OCR & Semantic Intelligence",
    heroDesc: "High-precision document parsing and OCR powered by Vision-Language Models (VLMs) and vector retrieval to digitize, structure, and query Kurdish documents, books, and publications.",
    heroTags: ["Sorani & Kurmanji", "Metadata & Entity Extraction", "Semantic Search (RAG)"],
    uploadTitle: "Upload Document (PDF or Image)",
    chooseFile: "Choose PDF or image file",
    supportedFormats: "Supports PDF, JPG, PNG, and WebP formats",
    maxPagesLabel: "Pages to process:",
    pagesUnit: "pages",
    allPages: "All Pages",
    processAllCheckbox: "Process entire document (All pages)",
    maxPagesHint: "Select 1 to 20 pages or check 'All pages' to parse the full document.",
    startBtn: "Start Document Analysis",
    processingBtn: "Analyzing pages with Multimodal VLM...",
    uploadProgressTitle: "Document Intelligence in Progress",
    uploadProgressSubtitle: "Transcribing pages and generating semantic embeddings...",
    metadataTitle: "Extracted Document Metadata",
    successStatus: "Document parsed successfully",
    secondsUnit: "sec",
    docTitle: "Document Title",
    unknown: "Unknown",
    dialect: "Dialect",
    defaultDialect: "Sorani",
    location: "Location / City",
    locationUnspecified: "Unspecified",
    summaryHeader: "Content Summary:",
    entitiesHeader: "Prominent Entities, People & Organizations:",
    emptyUploadHint: "Upload a document to extract metadata, summary, dialect, and entities",
    ocrTitle: "Extracted Transcription (OCR Markdown)",
    emptyOcr: "No document parsed yet...",
    ragTitle: "Ask the Document (Semantic Q&A / RAG)",
    aiAnswer: "AI Answer:",
    citationsHeader: "Source Grounding Citations:",
    chunkPrefix: "Chunk #",
    relevance: "Relevance:",
    emptyRagHint: "Ask a question about the document to retrieve grounded passages",
    questionPlaceholder: "Ask a question... (e.g. What is this document about?)",
    searchBtn: "Search",
    footer: "KurdDocIntel — Open-source platform for Kurdish document digitization, OCR, and semantic retrieval",
    toggleBtn: "کوردی (سۆرانی)",
  }
};

export default function Home() {
  const [lang, setLang] = useState<"ckb" | "en">("ckb");
  const t = translations[lang];

  const [file, setFile] = useState<File | null>(null);
  const [maxPages, setMaxPages] = useState<number>(3);
  const [processAllPages, setProcessAllPages] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // RAG Query & Chat states
  const [question, setQuestion] = useState<string>("");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  React.useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === "ckb" ? "en" : "ckb"));
  };

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
    setMessages([]);

    const formData = new FormData();
    formData.append("file", file);

    const pagesParam = processAllPages ? 0 : maxPages;

    try {
      const res = await fetch(`/api/v1/parse?max_pages=${pagesParam}`, {
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
      setErrorMsg(err.message || (lang === "ckb" ? "هەڵەیەک لە کاتی شیکردنەوەی بەڵگەنامەکەدا ڕوویدا" : "Failed to process the document"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentQ = question.trim();
    if (!currentQ) return;

    const userMsg: ChatMessage = {
      id: "usr_" + Date.now(),
      sender: "user",
      text: currentQ,
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsQuerying(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQ,
          document_ids: parseResult ? [parseResult.document_id] : undefined,
          top_k: 3,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Query failed" }));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const data: QueryResponse = await res.json();
      const botMsg: ChatMessage = {
        id: "bot_" + Date.now(),
        sender: "assistant",
        text: data.answer,
        citations: data.citations,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setErrorMsg(err.message || (lang === "ckb" ? "هەڵەیەک لە لێکۆڵینەوە و گەڕانی بەڵگەنامەدا ڕوویدا" : "Failed to query the document"));
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div dir={t.dir} className={`flex min-h-screen flex-col bg-slate-950 text-slate-100 ${lang === "ckb" ? "font-kurdish" : ""}`}>
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                {t.title}
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  {t.badge}
                </span>
              </h1>
              <p className="text-xs text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2.5 py-1 text-xs text-slate-400 border border-slate-800">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {t.techBadge}
            </span>

            {/* Language Switcher Button */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-all shadow-sm active:scale-95"
              title="Toggle English / Kurdish"
            >
              <Languages className="h-3.5 w-3.5 text-emerald-400" />
              <span>{t.toggleBtn}</span>
            </button>
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
                {t.heroTitle}
              </h2>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
                {t.heroDesc}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg bg-emerald-950/60 border border-emerald-800/40 px-3 py-1.5 text-emerald-300">{t.heroTags[0]}</span>
              <span className="rounded-lg bg-teal-950/60 border border-teal-800/40 px-3 py-1.5 text-teal-300">{t.heroTags[1]}</span>
              <span className="rounded-lg bg-sky-950/60 border border-sky-800/40 px-3 py-1.5 text-sky-300">{t.heroTags[2]}</span>
            </div>
          </div>
        </section>

        {/* Upload & Configuration Card */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <UploadCloud className="h-5 w-5 text-emerald-400" />
              {t.uploadTitle}
            </h3>

            <div className="flex flex-col gap-4">
              <label 
                htmlFor="file-upload" 
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 p-6 hover:border-emerald-500/50 hover:bg-slate-900 transition-all cursor-pointer text-center"
              >
                <UploadCloud className="h-10 w-10 text-slate-500 mb-2" />
                <span className="text-sm font-medium text-slate-200">
                  {file ? file.name : t.chooseFile}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {t.supportedFormats}
                </span>
                <input 
                  id="file-upload" 
                  type="file" 
                  accept=".pdf,.jpg,.jpeg,.png,.webp" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>

              {/* Max pages & Process All control */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4 space-y-3">
                {/* Checkbox for Process All Pages */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={processAllPages}
                    onChange={(e) => setProcessAllPages(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    {t.processAllCheckbox}
                  </span>
                </label>

                {/* Slider (disabled when all pages is checked) */}
                <div className={`transition-opacity ${processAllPages ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-300 mb-2">
                    <span>{t.maxPagesLabel}</span>
                    <span className="font-bold text-emerald-400">
                      {processAllPages ? t.allPages : `${maxPages} ${t.pagesUnit}`}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={maxPages} 
                    disabled={processAllPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <p className="text-[11px] text-slate-500">
                  {t.maxPagesHint}
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
                    {t.processingBtn}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t.startBtn}
                  </>
                )}
              </button>
              {isUploading && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                      {t.uploadProgressTitle}
                    </span>
                    <span className="text-[11px] text-emerald-400/80 font-mono">VLM OCR</span>
                  </div>
                  
                  {/* Animated Progress Bar */}
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 w-full animate-[progress_2s_ease-in-out_infinite]"></div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    {t.uploadProgressSubtitle}
                  </p>
                </div>
              )}
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
                {t.metadataTitle}
              </h3>

              {parseResult ? (
                <div className="space-y-4">
                  {/* Status header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.successStatus}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {parseResult.page_count} {t.pagesUnit}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {parseResult.processing_time_seconds} {t.secondsUnit}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">ID: {parseResult.document_id}</span>
                    </div>
                  </div>

                  {/* Metadata tags */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <span className="text-[11px] text-slate-500 block mb-1">{t.docTitle}</span>
                      <span className="text-sm font-semibold text-white line-clamp-1">
                        {parseResult.metadata.title || t.unknown}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <span className="text-[11px] text-slate-500 block mb-1 flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {t.dialect}
                      </span>
                      <span className="text-sm font-semibold text-teal-300">
                        {parseResult.metadata.dialect || t.defaultDialect}
                      </span>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <span className="text-[11px] text-slate-500 block mb-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {t.location}
                      </span>
                      <span className="text-sm font-semibold text-sky-300">
                        {parseResult.metadata.location || t.locationUnspecified}
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  {parseResult.metadata.summary && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300 leading-relaxed">
                      <span className="text-slate-400 font-semibold block mb-1">{t.summaryHeader}</span>
                      {parseResult.metadata.summary}
                    </div>
                  )}

                  {/* Extracted Entities */}
                  {parseResult.metadata.entities && parseResult.metadata.entities.length > 0 && (
                    <div>
                      <span className="text-xs text-slate-400 font-semibold block mb-2 flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" /> {t.entitiesHeader}
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
                  {t.emptyUploadHint}
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
              {t.ocrTitle}
            </h3>

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950 p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {parseResult ? (
                parseResult.transcription_markdown
              ) : (
                <span className="text-slate-600 italic">{t.emptyOcr}</span>
              )}
            </div>
          </div>

          {/* Semantic Archival Search / RAG Chat */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur flex flex-col h-[520px]">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-3">
              <Search className="h-5 w-5 text-sky-400" />
              {t.ragTitle}
            </h3>

            {/* Conversation Messages Display */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950 p-4 text-sm space-y-4">
              {messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col ${msg.sender === "user" ? "items-start" : "items-end"}`}
                    >
                      <div 
                        className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed text-sm ${
                          msg.sender === "user" 
                            ? "bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tr-none" 
                            : "bg-gradient-to-br from-emerald-950/60 to-slate-900 text-slate-100 border border-emerald-800/40 rounded-tl-none shadow-md"
                        }`}
                      >
                        <span className="text-[11px] font-bold block mb-1 opacity-60">
                          {msg.sender === "user" ? (lang === "ckb" ? "پرسیاری تۆ:" : "You:") : t.aiAnswer}
                        </span>
                        <div className="whitespace-pre-wrap">{msg.text}</div>

                        {/* Citations for assistant answers */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-emerald-900/40 space-y-1.5">
                            <span className="text-[10px] font-semibold text-emerald-400/90 block">
                              {t.citationsHeader}
                            </span>
                            {msg.citations.map((cite, i) => (
                              <div key={i} className="rounded-lg bg-slate-950/80 p-2 text-[11px] text-slate-300 border border-slate-800/80">
                                <div className="flex items-center justify-between text-slate-500 mb-0.5 text-[10px]">
                                  <span>{t.chunkPrefix} {cite.chunk_index + 1}</span>
                                  <span className="text-emerald-400 font-mono">
                                    {(cite.relevance_score * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <p className="line-clamp-2 italic text-slate-400 font-mono text-[10px]">"{cite.text_snippet}"</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isQuerying && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic p-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span>{lang === "ckb" ? "ژیریی دەستکرد لە بەڵگەنامەکەدا دەگەڕێت و وەڵام دەنووسێت..." : "Searching document & writing response..."}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500 text-xs">
                  <Search className="h-8 w-8 mb-2 opacity-40" />
                  {t.emptyRagHint}
                </div>
              )}
            </div>

            {/* Question Input Form */}
            <form onSubmit={handleQuery} className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder={t.questionPlaceholder}
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
                {t.searchBtn}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        {t.footer}
      </footer>
    </div>
  );
}