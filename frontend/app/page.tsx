"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  FileText, 
  UploadCloud, 
  Search, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Languages, 
  Copy, 
  Check, 
  Globe, 
  MapPin, 
  Tag, 
  SlidersHorizontal, 
  FileCode, 
  ArrowRight, 
  Maximize2,
  BookOpen,
  ExternalLink,
  Download,
  ChevronDown,
  XCircle
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
  page_number?: number;
  text_snippet: string;
  relevance_score: number;
}

interface QueryResponse {
  answer: string;
  citations: SourceCitation[];
}

interface QueryLog {
  id: string;
  question: string;
  answer: string;
  citations: SourceCitation[];
  timestamp: string;
}

interface PageSegment {
  pageNumber: number;
  content: string;
}

interface AppError {
  type: "rate_limit" | "timeout" | "general";
  title: string;
  message: string;
  detail?: string;
}

function cleanPageContent(content: string): string {
  if (!content) return "";
  return content
    .replace(/\\newpage/gi, "")
    .replace(/<(?:p|div|center)[^>]*>\s*[0-9\u0660-\u0669]+\s*<\/(?:p|div|center)>/gi, "")
    .replace(/<(?:p|div|center)[^>]*>/gi, "")
    .replace(/<\/(?:p|div|center)>/gi, "")
    .replace(/^\s*[0-9\u0660-\u0669]{1,4}\s*$/gm, "")
    .replace(/^\s*---\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parsePages(markdown: string): PageSegment[] {
  if (!markdown) return [];

  const pageRegex = /<!--\s*Page\s*(\d+)\s*-->/gi;
  const matches = [...markdown.matchAll(pageRegex)];

  if (matches.length > 0) {
    const pages: PageSegment[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const pageNum = parseInt(match[1], 10);
      const startIdx = match.index! + match[0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : markdown.length;

      const rawContent = markdown.slice(startIdx, endIdx);
      const pageContent = cleanPageContent(rawContent);

      if (pageContent.length > 0) {
        pages.push({
          pageNumber: pageNum,
          content: pageContent,
        });
      }
    }
    if (pages.length > 0) return pages;
  }

  if (/\\newpage/gi.test(markdown)) {
    const parts = markdown.split(/\\newpage/gi);
    return parts
      .map((part, idx) => ({
        pageNumber: idx + 1,
        content: cleanPageContent(part.replace(/<!--\s*Page\s*\d+\s*-->/gi, "")),
      }))
      .filter((p) => p.content.length > 0);
  }

  const cleaned = cleanPageContent(
    markdown
      .replace(/<!--\s*Page\s*\d+\s*-->/gi, "")
  );

  return [{ pageNumber: 1, content: cleaned }];
}

const translations = {
  ckb: {
    dir: "rtl",
    brand: "KurdDocIntel",
    tagline: "ستۆدیۆی پشکنین و خوێندنەوەی دەقی بەڵگەنامە",
    statusReady: "ئامادەیە بۆ کار",
    statusProcessing: "لە قۆناغی پڕۆسێسکردندایە",
    toggleBtn: "English",
    uploadBtn: "دیاریکردنی پەڕگە",
    analyzeBtn: "دەستپێکردنی پشکنین",
    processingBtn: "پڕۆسێس دەکرێت...",
    pages: "پەڕە",
    allPages: "تەواوی پەڕەکان",
    docTitle: "ناونیشان",
    docType: "جۆری بەڵگەنامە",
    dialect: "شێوەزار",
    location: "شوێن",
    entities: "ناسنامە دەرهێنراوەکان",
    summary: "پوختەی ناوەڕۆک",
    transcriptionTab: "دەقی دیجیتاڵی بەڵگەنامە (OCR)",
    searchTab: "گەڕان لە ناوەڕۆک و وەڵامدانەوە",
    searchPlaceholder: "پرسیارێک لەسەر ناوەڕۆکی ئەم بەڵگەنامەیە بنووسە...",
    searchAction: "پشکنین",
    citations: "سەرچاوەی باوەڕپێکراو",
    copyCode: "کۆپیکردنی هەموو دەقەکە",
    copied: "کۆپی کرا",
    copyPage: "کۆپیکردنی پەڕە",
    pageLabel: "پەڕەی",
    semanticSearchBadge: "گەڕانی واتایی",
    studioBadge: "ستۆدیۆ",
    questionPrefix: "پرسیار",
    chunkLabel: "بەش",
    jumpToPassage: "پیشاندانی لە پەڕەکەدا",
    matchedPassage: "بەشی دۆزراوە",
    exportBtn: "داگرتن",
    exportMd: "ماڕکداون (.md)",
    exportMdDesc: "دەقی تەواو لەگەڵ مێتاداتادا",
    exportJson: "داتای JSON (.json)",
    exportJsonDesc: "تەواوی داتای ستراکتوورکراو",
    exportTxt: "دەقی سادە (.txt)",
    exportTxtDesc: "دەقی پەتی بەبێ ڕێکخستن",
    cancelBtn: "هەڵوەشاندنەوە",
    emptyDoc: "تکایە پەڕگەیەکی PDF یان وێنە باربکە بۆ دەستپێکردنی پشکنین.",
    emptySearch: "پرسیارێک لە بەڵگەنامەکە بکە تا بەشە پەیوەندیدارەکانی بۆت دەربهێنێت.",
    matchLabel: "هاوتایی",
    stages: {
      upload: "بارکردنی پەڕگە",
      render: "شیکردنەوەی پەڕەکان (300 DPI)",
      ocr: "خوێندنەوەی دەق و ڕێنووس",
      index: "ئەندێکسکردنی دەق",
    },
    errorRateLimitBadge: "سنووری داواکاری (429)",
    errorRateLimitTitle: "سنووری بەکارهێنانی ژیریی دەستکرد تێپەڕێنراوە",
    errorRateLimitMsg: "مۆدێلی ژیریی دەستکرد گەیشتووەتە سنووری بەکارهێنان (Rate Limit). تکایە ١ بۆ ٢ خولەک چاوەڕوان بە، یان ژمارەی پەڕەکان کەم بکەرەوە.",
    errorTimeoutBadge: "کاتی بەسەرچوو",
    errorTimeoutTitle: "کاتی پڕۆسێسکردن بەسەرچوو",
    errorTimeoutMsg: "پڕۆسێسکردنی پەڕەکان لە کاتی دیاریکراو زیاتری خایاند. هەوڵبدە ژمارەی پەڕەکان کەم بکەیتەوە.",
    errorGeneralBadge: "هەڵە",
    errorGeneralTitle: "کێشەیەک ڕوویدا",
    errorDismiss: "داخستن",
  },
  en: {
    dir: "ltr",
    brand: "KurdDocIntel",
    tagline: "Kurdish Document Intelligence & OCR Studio",
    statusReady: "System Ready",
    statusProcessing: "Processing Document",
    toggleBtn: "کوردی (سۆرانی)",
    uploadBtn: "Select File",
    analyzeBtn: "Analyze Document",
    processingBtn: "Processing...",
    pages: "pages",
    allPages: "All Pages",
    docTitle: "Document Title",
    docType: "Document Type",
    dialect: "Dialect",
    location: "Location",
    entities: "Extracted Entities",
    summary: "Executive Summary",
    transcriptionTab: "Digital Transcription (OCR)",
    searchTab: "Content Search & Query",
    searchPlaceholder: "Search or ask a question about this document...",
    searchAction: "Inspect",
    citations: "Referenced Sources",
    copyCode: "Copy All Markdown",
    copied: "Copied",
    copyPage: "Copy Page",
    pageLabel: "Page",
    semanticSearchBadge: "Semantic Search",
    studioBadge: "Studio",
    questionPrefix: "Question",
    chunkLabel: "Chunk",
    jumpToPassage: "Jump to passage",
    matchedPassage: "Matched Passage",
    exportBtn: "Export",
    exportMd: "Markdown (.md)",
    exportMdDesc: "Full document with metadata header",
    exportJson: "Structured JSON (.json)",
    exportJsonDesc: "Complete structured document data",
    exportTxt: "Plain Text (.txt)",
    exportTxtDesc: "Clean text transcription stream",
    cancelBtn: "Cancel",
    emptyDoc: "Upload a PDF or document image to begin analysis.",
    emptySearch: "Enter a question or topic to inspect grounded document excerpts.",
    matchLabel: "match",
    stages: {
      upload: "Uploading document",
      render: "High-resolution rendering (300 DPI)",
      ocr: "Text extraction & orthography",
      index: "Semantic vector indexing",
    },
    errorRateLimitBadge: "Rate Limit (429)",
    errorRateLimitTitle: "AI Request Limit Reached",
    errorRateLimitMsg: "The AI quota or request limit has been reached. Please wait 1–2 minutes, or reduce the number of pages.",
    errorTimeoutBadge: "Timeout",
    errorTimeoutTitle: "Processing Timeout",
    errorTimeoutMsg: "Document processing took longer than expected. Try reducing the number of pages.",
    errorGeneralBadge: "Error",
    errorGeneralTitle: "An Error Occurred",
    errorDismiss: "Dismiss",
  }
};

const dialectTranslations: Record<string, { ckb: string; en: string }> = {
  sorani: { ckb: "سۆرانی", en: "Sorani" },
  kurmanji: { ckb: "کرمانجی", en: "Kurmanji" },
  badini: { ckb: "بادینی", en: "Badini" },
  hawrami: { ckb: "هەورامی", en: "Hawrami" },
};

const docTypeTranslations: Record<string, { ckb: string; en: string }> = {
  book: { ckb: "کتێب", en: "Book" },
  article: { ckb: "وتار", en: "Article" },
  report: { ckb: "ڕاپۆرت", en: "Report" },
  legal_administrative: { ckb: "یاسایی و کارگێڕی", en: "Legal / Administrative" },
  official: { ckb: "فەرمی", en: "Official" },
  academic: { ckb: "ئەکادیمی", en: "Academic" },
  general: { ckb: "گشتی", en: "General" },
};

function getApiUrl(endpoint: string): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return `http://127.0.0.1:8080${endpoint}`;
    }
  }
  return endpoint;
}

export default function Home() {
  const [lang, setLang] = useState<"ckb" | "en">("ckb");
  const t = translations[lang];

  const [file, setFile] = useState<File | null>(null);
  const [maxPages, setMaxPages] = useState<number>(5);
  const [processAll, setProcessAll] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<AppError | null>(null);

  const parseAppError = (status: number, detailData: any, fallbackMessage: string): AppError => {
    let code = "";
    let rawMsg = fallbackMessage;

    if (typeof detailData === "object" && detailData !== null) {
      code = detailData.code || "";
      rawMsg = detailData.message || fallbackMessage;
    } else if (typeof detailData === "string") {
      rawMsg = detailData;
    }

    const lower = (rawMsg + " " + code).toLowerCase();

    if (status === 429 || code === "AI_RATE_LIMIT" || /429|quota|resource_exhausted|exhausted|rate\s*limit/i.test(lower)) {
      return {
        type: "rate_limit",
        title: t.errorRateLimitTitle,
        message: t.errorRateLimitMsg,
        detail: rawMsg !== t.errorRateLimitMsg ? rawMsg : undefined,
      };
    }

    if (status === 504 || status === 540 || code === "TIMEOUT" || /timeout/i.test(lower)) {
      return {
        type: "timeout",
        title: t.errorTimeoutTitle,
        message: t.errorTimeoutMsg,
        detail: rawMsg !== t.errorTimeoutMsg ? rawMsg : undefined,
      };
    }

    return {
      type: "general",
      title: t.errorGeneralTitle,
      message: rawMsg || (lang === "ckb" ? "هەڵەیەک ڕوویدا لە پەیوەندی بە سەرڤەرەوە." : "A communication error occurred with the server."),
    };
  };

  // Search & Notes state
  const [query, setQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [queryHistory, setQueryHistory] = useState<QueryLog[]>([]);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedPageNum, setCopiedPageNum] = useState<number | null>(null);
  const [activeCitationSnippet, setActiveCitationSnippet] = useState<string | null>(null);
  const [highlightedPageNum, setHighlightedPageNum] = useState<number | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRefs = useRef<NodeJS.Timeout[]>([]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === "ckb" ? "en" : "ckb"));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorInfo(null);
    }
  };

  const handleCancelAnalyze = () => {
    timerRefs.current.forEach((t) => clearTimeout(t));
    timerRefs.current = [];
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setCurrentStep(0);
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setIsProcessing(true);
    setCurrentStep(1);
    setErrorInfo(null);
    setParseResult(null);
    setQueryHistory([]);

    const t1 = setTimeout(() => setCurrentStep(2), 1200);
    const t2 = setTimeout(() => setCurrentStep(3), 3500);
    const t3 = setTimeout(() => setCurrentStep(4), 8500);
    timerRefs.current = [t1, t2, t3];

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append("file", file);
    const pagesParam = processAll ? 0 : maxPages;

    try {
      const res = await fetch(getApiUrl(`/api/v1/parse?max_pages=${pagesParam}`), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      timerRefs.current.forEach((t) => clearTimeout(t));
      timerRefs.current = [];

      if (!res.ok) {
        let errData: any = null;
        try {
          errData = await res.json();
        } catch {
          errData = await res.text().catch(() => "");
        }
        const parsed = parseAppError(res.status, errData?.detail || errData, `Server error: ${res.status}`);
        setErrorInfo(parsed);
        setIsProcessing(false);
        return;
      }

      const data: ParseResponse = await res.json();
      setParseResult(data);
      setCurrentStep(5);
    } catch (err: any) {
      timerRefs.current.forEach((t) => clearTimeout(t));
      timerRefs.current = [];
      if (err.name === "AbortError") {
        setIsProcessing(false);
        setCurrentStep(0);
        return;
      }
      setErrorInfo(parseAppError(0, null, err.message || "Failed to process document"));
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setIsSearching(true);
    setQuery("");

    try {
      const res = await fetch(getApiUrl(`/api/v1/query`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          document_ids: parseResult ? [parseResult.document_id] : undefined,
          top_k: 4,
        }),
      });

      if (!res.ok) {
        let errData: any = null;
        try {
          errData = await res.json();
        } catch {
          errData = await res.text().catch(() => "");
        }
        const parsed = parseAppError(res.status, errData?.detail || errData, `Search failed: ${res.status}`);
        setErrorInfo(parsed);
        return;
      }

      const data: QueryResponse = await res.json();
      const newEntry: QueryLog = {
        id: "log_" + Date.now(),
        question: q,
        answer: data.answer,
        citations: data.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setQueryHistory((prev) => [newEntry, ...prev]);
    } catch (err: any) {
      setErrorInfo(parseAppError(0, null, err.message || "Search failed"));
    } finally {
      setIsSearching(false);
    }
  };

  const copyAllTranscription = () => {
    if (!parseResult) return;
    navigator.clipboard.writeText(parseResult.transcription_markdown);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const copySinglePage = (content: string, pageNum: number) => {
    navigator.clipboard.writeText(content);
    setCopiedPageNum(pageNum);
    setTimeout(() => setCopiedPageNum(null), 2000);
  };

  const parsedPages = useMemo(() => {
    return parsePages(parseResult?.transcription_markdown || "");
  }, [parseResult?.transcription_markdown]);

  const formatDialect = (val?: string) => {
    if (!val) return lang === "ckb" ? "سۆرانی" : "Sorani";
    const key = val.toLowerCase().trim();
    return dialectTranslations[key]?.[lang] || val;
  };

  const formatDocType = (val?: string) => {
    if (!val) return "";
    const key = val.toLowerCase().trim();
    return docTypeTranslations[key]?.[lang] || val;
  };

function extractCleanQueryText(snippet: string): string {
  if (!snippet) return "";
  return snippet
    .replace(/^\[Page\s*\d+\s*\|\s*لاپەڕە\s*\d+\]\s*/i, "")
    .replace(/<!--\s*Page\s*\d+\s*-->/gi, "")
    .replace(/\[Source Citation[^\]]*\]/gi, "")
    .replace(/<(?:p|div|center)[^>]*>\s*[0-9\u0660-\u0669]+\s*<\/(?:p|div|center)>/gi, "")
    .replace(/<(?:p|div|center)[^>]*>/gi, "")
    .replace(/<\/(?:p|div|center)>/gi, "")
    .replace(/^\s*[0-9\u0660-\u0669]{1,4}\s*$/gm, "")
    .replace(/^\s*---\s*$/gm, "")
    .replace(/\.{3,}$/, "")
    .replace(/…$/, "")
    .trim();
}

function findBestMatchingSubstr(content: string, snippet: string): string | null {
  const clean = extractCleanQueryText(snippet);
  if (!clean || clean.length < 4) return null;

  if (content.includes(clean)) return clean;

  const words = clean.split(/\s+/).filter((w) => w.trim().length > 0);
  if (words.length === 0) return null;

  // Windowed match using exact string phrases
  for (let windowSize = Math.min(words.length, 25); windowSize >= 3; windowSize--) {
    for (let start = 0; start <= Math.min(4, words.length - windowSize); start++) {
      const phrase = words.slice(start, start + windowSize).join(" ");
      if (phrase.length >= 12 && content.includes(phrase)) {
        return phrase;
      }
    }
  }

  // Regex flexible whitespace match across line breaks and tabs
  for (let windowSize = Math.min(words.length, 10); windowSize >= 3; windowSize--) {
    for (let start = 0; start <= Math.min(2, words.length - windowSize); start++) {
      const escapedWords = words.slice(start, start + windowSize).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      try {
        const flexiblePattern = new RegExp(escapedWords.join("\\s+"), "i");
        const m = content.match(flexiblePattern);
        if (m && m[0]) {
          return m[0];
        }
      } catch {
        // ignore regex errors
      }
    }
  }

  return null;
}

  const handleCitationClick = (snippet: string, pageNum?: number) => {
    setActiveCitationSnippet(snippet);

    let targetPage = pageNum ? parsedPages.find((p) => p.pageNumber === pageNum) : null;

    if (!targetPage) {
      targetPage = parsedPages.find((p) => {
        return findBestMatchingSubstr(p.content, snippet) !== null;
      });
    }

    const finalPageNum = targetPage ? targetPage.pageNumber : (pageNum || 1);
    setHighlightedPageNum(finalPageNum);

    setTimeout(() => {
      const markEl = document.getElementById("active-matched-passage");
      if (markEl) {
        markEl.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        const pageEl = document.getElementById(`page-sheet-${finalPageNum}`);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 100);
  };

  const renderHighlightedContent = (content: string, pageNum: number) => {
    if (!activeCitationSnippet || highlightedPageNum !== pageNum) {
      return content;
    }

    const target = findBestMatchingSubstr(content, activeCitationSnippet);
    if (!target) {
      return content;
    }

    const parts = content.split(target);
    if (parts.length === 1) return content;

    return (
      <>
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            {part}
            {idx < parts.length - 1 && (
              <mark
                id="active-matched-passage"
                className="bg-teal-500/35 text-teal-100 border border-teal-400/90 rounded px-1.5 py-0.5 shadow-md shadow-teal-950/80 ring-2 ring-teal-400/40 font-semibold inline transition-all"
              >
                {target}
              </mark>
            )}
          </React.Fragment>
        ))}
      </>
    );
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const getBaseDocName = () => {
    if (!parseResult) return "kurdish_document";
    const raw = parseResult.metadata.title || parseResult.filename || "kurdish_document";
    return raw.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, "_").slice(0, 40);
  };

  const exportAsMarkdown = () => {
    if (!parseResult) return;
    const baseName = getBaseDocName();
    const entitiesList = (parseResult.metadata.entities || []).map((e) => `"${e}"`).join(", ");
    const lines = [
      "---",
      `title: "${parseResult.metadata.title || parseResult.filename}"`,
      `document_type: "${parseResult.metadata.document_type || 'general'}"`,
      `dialect: "${parseResult.metadata.dialect || 'Sorani'}"`,
      parseResult.metadata.location ? `location: "${parseResult.metadata.location}"` : null,
      parseResult.metadata.date_mentioned ? `date: "${parseResult.metadata.date_mentioned}"` : null,
      `page_count: ${parseResult.page_count}`,
      `entities: [${entitiesList}]`,
      "---",
      "",
      `# ${parseResult.metadata.title || parseResult.filename}`,
      "",
      parseResult.metadata.summary ? `> ${parseResult.metadata.summary}\n\n---\n` : "",
      parsedPages.map((p) => `### ${t.pageLabel} ${p.pageNumber}\n\n${p.content}`).join("\n\n---\n\n")
    ];

    triggerDownload(lines.filter((l) => l !== null).join("\n"), `${baseName}.md`, "text/markdown;charset=utf-8");
  };

  const exportAsJson = () => {
    if (!parseResult) return;
    const baseName = getBaseDocName();
    const exportData = {
      ...parseResult,
      pages: parsedPages,
      exported_at: new Date().toISOString()
    };
    triggerDownload(JSON.stringify(exportData, null, 2), `${baseName}.json`, "application/json;charset=utf-8");
  };

  const exportAsPlainText = () => {
    if (!parseResult) return;
    const baseName = getBaseDocName();
    const plain = parsedPages.map((p) => `[${t.pageLabel} ${p.pageNumber}]\n\n${p.content}`).join("\n\n\n");
    triggerDownload(plain, `${baseName}.txt`, "text/plain;charset=utf-8");
  };

  return (
    <div dir={t.dir} className={`min-h-screen bg-[#090d14] text-zinc-100 flex flex-col antialiased ${lang === "ckb" ? "font-kurdish" : ""}`}>
      {/* Studio Header Bar */}
      <header className="border-b border-zinc-800/80 bg-[#0f1420]/95 backdrop-blur-md px-6 py-2.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-teal-950/70 border border-teal-800/60 flex items-center justify-center text-teal-300">
            <FileCode className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">{t.brand}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-950/70 text-teal-300 border border-teal-800/60">
                {t.studioBadge}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">{t.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/90 border border-zinc-800 text-zinc-400">
            <span className={`h-2 w-2 rounded-full ${isProcessing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`}></span>
            <span className={isProcessing ? "text-amber-300" : "text-zinc-300"}>
              {isProcessing ? t.statusProcessing : t.statusReady}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-700 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer text-xs"
          >
            <Languages className="h-3.5 w-3.5 text-teal-400" />
            <span>{t.toggleBtn}</span>
          </button>
        </div>
      </header>

      {/* Control Utility Toolbar */}
      <div className="border-b border-zinc-800/90 bg-[#0c111a] px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* File Picker */}
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-750 text-zinc-200 cursor-pointer transition-colors shadow-sm">
            <UploadCloud className="h-3.5 w-3.5 text-teal-400" />
            <span className="max-w-[200px] truncate">{file ? file.name : t.uploadBtn}</span>
            <input 
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg,.webp" 
              onChange={handleFileSelect} 
              className="hidden" 
            />
          </label>

          {/* Page Limit Selector */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-zinc-300">
              <input
                type="checkbox"
                checked={processAll}
                onChange={(e) => setProcessAll(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 accent-teal-600 cursor-pointer"
              />
              <span className="text-[11px]">{t.allPages}</span>
            </label>

            {!processAll && (
              <div className="flex items-center gap-1.5 border-r border-zinc-800 pr-2 pl-1 mr-1">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxPages}
                  onChange={(e) => setMaxPages(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-12 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-center text-xs text-zinc-100 focus:outline-none focus:border-teal-500"
                />
                <span className="text-zinc-400 text-[11px]">{t.pages}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!file || isProcessing}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-medium shadow-sm shadow-teal-950/40 transition-colors cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                <span>{t.processingBtn}</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5 text-teal-100" />
                <span>{t.analyzeBtn}</span>
              </>
            )}
          </button>

          {isProcessing && (
            <button
              type="button"
              onClick={handleCancelAnalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-200 text-xs font-medium shadow-sm transition-colors cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5 text-rose-400" />
              <span>{t.cancelBtn}</span>
            </button>
          )}
        </div>

        {/* Pipeline Stage Bar when processing */}
        {isProcessing && (
          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${currentStep >= 1 ? "bg-teal-400 ring-2 ring-teal-400/20" : "bg-zinc-700"}`}></span>
              <span className={currentStep === 1 ? "text-teal-300 font-medium" : ""}>{t.stages.upload}</span>
            </div>
            <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${currentStep >= 2 ? "bg-teal-400 ring-2 ring-teal-400/20" : "bg-zinc-700"}`}></span>
              <span className={currentStep === 2 ? "text-teal-300 font-medium" : ""}>{t.stages.render}</span>
            </div>
            <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${currentStep >= 3 ? "bg-teal-400 ring-2 ring-teal-400/20" : "bg-zinc-700"}`}></span>
              <span className={currentStep === 3 ? "text-teal-300 font-medium" : ""}>{t.stages.ocr}</span>
            </div>
            <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${currentStep >= 4 ? "bg-teal-400 ring-2 ring-teal-400/20" : "bg-zinc-700"}`}></span>
              <span className={currentStep === 4 ? "text-teal-300 font-medium" : ""}>{t.stages.index}</span>
            </div>
          </div>
        )}
      </div>

      {errorInfo && (
        <div className="mx-6 my-2.5 rounded-xl border border-rose-900/60 bg-[#160d15] p-3 text-xs text-rose-200 shadow-lg flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-rose-950/90 border border-rose-800/80 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-rose-100 text-xs">
                  {errorInfo.title}
                </span>
                <span className="rounded bg-rose-950 px-2 py-0.5 text-[10px] font-mono border border-rose-800/80 text-rose-300">
                  {errorInfo.type === "rate_limit" 
                    ? t.errorRateLimitBadge 
                    : errorInfo.type === "timeout" 
                    ? t.errorTimeoutBadge 
                    : t.errorGeneralBadge}
                </span>
              </div>
              <p className="text-zinc-300 text-[11.5px] leading-relaxed">
                {errorInfo.message}
              </p>
              {errorInfo.detail && errorInfo.detail !== errorInfo.message && (
                <p className="text-[10px] text-zinc-500 font-mono line-clamp-1 pt-0.5" title={errorInfo.detail}>
                  {errorInfo.detail}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorInfo(null)}
            className="rounded p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title={t.errorDismiss}
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Studio Workspace: 2-Column Split */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Document Reader & OCR Markdown Sheets (7 cols) */}
        <section className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-zinc-800/90 flex flex-col bg-[#0a0e16]">
          {/* Reader Top Sub-Header */}
          <div className="px-5 py-2.5 border-b border-zinc-800/90 flex items-center justify-between bg-[#0f1420] text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-teal-400" />
              {t.transcriptionTab}
            </span>

            {parseResult && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-teal-400 font-mono bg-teal-950/60 border border-teal-800/50 px-2 py-0.5 rounded">
                  {parseResult.page_count} {t.pages} • {parseResult.processing_time_seconds}s
                </span>
                <button
                  type="button"
                  onClick={copyAllTranscription}
                  className="flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-700/80 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors text-[11px] cursor-pointer shadow-sm"
                >
                  {copiedAll ? <Check className="h-3 w-3 text-teal-300" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedAll ? t.copied : t.copyCode}</span>
                </button>

                {/* Export Dropdown */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-teal-800/70 bg-teal-950/80 hover:bg-teal-900/90 text-teal-300 transition-colors text-[11px] font-medium cursor-pointer shadow-sm"
                  >
                    <Download className="h-3 w-3 text-teal-300" />
                    <span>{t.exportBtn}</span>
                    <ChevronDown className={`h-2.5 w-2.5 transition-transform duration-200 ${showExportMenu ? "rotate-180" : ""}`} />
                  </button>

                  {showExportMenu && (
                    <div 
                      className={`absolute top-full mt-1.5 w-56 rounded-xl border border-zinc-800/90 bg-[#121724] shadow-xl shadow-black/60 py-1.5 z-40 text-xs ${
                        lang === "ckb" ? "left-0" : "right-0"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={exportAsMarkdown}
                        className="w-full px-3 py-2 text-start flex items-start gap-2.5 hover:bg-zinc-800/80 transition-colors text-zinc-200 cursor-pointer"
                      >
                        <FileCode className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-zinc-100 text-xs">{t.exportMd}</span>
                          <span className="text-[10px] text-zinc-400 block">{t.exportMdDesc}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={exportAsJson}
                        className="w-full px-3 py-2 text-start flex items-start gap-2.5 hover:bg-zinc-800/80 transition-colors text-zinc-200 cursor-pointer border-t border-zinc-800/60"
                      >
                        <FileText className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-zinc-100 text-xs">{t.exportJson}</span>
                          <span className="text-[10px] text-zinc-400 block">{t.exportJsonDesc}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={exportAsPlainText}
                        className="w-full px-3 py-2 text-start flex items-start gap-2.5 hover:bg-zinc-800/80 transition-colors text-zinc-200 cursor-pointer border-t border-zinc-800/60"
                      >
                        <Download className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold block text-zinc-100 text-xs">{t.exportTxt}</span>
                          <span className="text-[10px] text-zinc-400 block">{t.exportTxtDesc}</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reader Viewport: Page Sheet Cards */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {parseResult ? (
              <div className="max-w-3xl mx-auto space-y-5">
                {parsedPages.map((page) => {
                  const isHighlighted = highlightedPageNum === page.pageNumber;
                  return (
                    <article
                      key={page.pageNumber}
                      id={`page-sheet-${page.pageNumber}`}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isHighlighted 
                          ? "border-teal-500/90 ring-2 ring-teal-500/30 shadow-lg shadow-teal-950/60 bg-[#121828]" 
                          : "border-zinc-800/90 bg-[#111724] shadow-md hover:border-zinc-700/90"
                      }`}
                    >
                      {/* Sheet Header */}
                      <div className="px-4 py-2 border-b border-zinc-800/80 bg-[#151c2c] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-teal-950/80 border border-teal-800/60 px-2.5 py-0.5 text-[11px] font-mono font-medium text-teal-300 shadow-sm">
                            {t.pageLabel} {page.pageNumber}
                          </span>
                          {isHighlighted && (
                            <span className="rounded bg-teal-500/20 text-teal-300 text-[10px] px-2 py-0.5 border border-teal-500/40 animate-pulse font-medium">
                              {t.matchedPassage}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => copySinglePage(page.content, page.pageNumber)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700/70 bg-zinc-800/70 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-[11px] cursor-pointer"
                        >
                          {copiedPageNum === page.pageNumber ? (
                            <Check className="h-3 w-3 text-teal-300" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          <span>{copiedPageNum === page.pageNumber ? t.copied : t.copyPage}</span>
                        </button>
                      </div>

                      {/* Sheet Kurdish Text Content */}
                      <div className="p-6 font-sans text-zinc-100 text-[14.5px] leading-[2.15] whitespace-pre-wrap selection:bg-teal-900/60">
                        {renderHighlightedContent(page.content, page.pageNumber)}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-zinc-500 text-xs">
                <FileText className="h-10 w-10 mb-3 stroke-[1.2] opacity-30 text-teal-400" />
                <p>{t.emptyDoc}</p>
              </div>
            )}
          </div>

          {/* Metadata Footer Strip */}
          {parseResult && (
            <div className="border-t border-zinc-800/90 bg-[#0d121c] px-5 py-3 text-xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-zinc-400">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">{t.docTitle}</span>
                    <span className="font-semibold text-zinc-100">{parseResult.metadata.title || "—"}</span>
                  </div>
                  {parseResult.metadata.dialect && (
                    <div>
                      <span className="text-zinc-500 text-[10px] block">{t.dialect}</span>
                      <span className="inline-block mt-0.5 rounded bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 text-[11px] font-medium text-purple-300">
                        {formatDialect(parseResult.metadata.dialect)}
                      </span>
                    </div>
                  )}
                  {parseResult.metadata.document_type && (
                    <div>
                      <span className="text-zinc-500 text-[10px] block">{t.docType}</span>
                      <span className="inline-block mt-0.5 rounded bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                        {formatDocType(parseResult.metadata.document_type)}
                      </span>
                    </div>
                  )}
                  {parseResult.metadata.location && (
                    <div>
                      <span className="text-zinc-500 text-[10px] block">{t.location}</span>
                      <span className="inline-block mt-0.5 rounded bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        {parseResult.metadata.location}
                      </span>
                    </div>
                  )}
                </div>

                {parseResult.metadata.entities && parseResult.metadata.entities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-zinc-500 text-[10px] mr-1">{t.entities}:</span>
                    {parseResult.metadata.entities.slice(0, 5).map((ent, idx) => (
                      <span
                        key={idx}
                        className="rounded bg-sky-950/50 px-2 py-0.5 text-[10px] text-sky-300 border border-sky-800/50 font-medium"
                      >
                        {ent}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {parseResult.metadata.summary && (
                <div className="pt-2 border-t border-zinc-800/60 flex items-start gap-2 text-zinc-300 text-[11.5px] leading-relaxed">
                  <span className="text-teal-400 font-semibold shrink-0 text-[11px]">{t.summary}:</span>
                  <p className="text-zinc-300/95">{parseResult.metadata.summary}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Search & Grounded Reference Inspector (5 cols) */}
        <section className="lg:col-span-5 flex flex-col bg-[#0b0f17]">
          {/* Inspector Header */}
          <div className="px-5 py-2.5 border-b border-zinc-800/90 flex items-center justify-between bg-[#0f1420] text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-teal-400" />
              {t.searchTab}
            </span>
            <span className="text-[10px] text-teal-400/90 font-mono bg-teal-950/40 border border-teal-800/40 px-1.5 py-0.5 rounded">
              {t.semanticSearchBadge}
            </span>
          </div>

          {/* Query Bar */}
          <form onSubmit={handleSearch} className="p-3 border-b border-zinc-800/90 bg-[#111724] flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isSearching}
                className="w-full rounded-md border border-zinc-700/80 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || isSearching}
              className="px-3 py-1.5 rounded-md bg-teal-600 hover:bg-teal-500 text-xs font-medium text-white shadow-sm disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSearching ? <Loader2 className="h-3 w-3 animate-spin text-white" /> : <Search className="h-3 w-3" />}
              <span>{t.searchAction}</span>
            </button>
          </form>

          {/* Search Excerpts & Inspect Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            {queryHistory.length > 0 ? (
              queryHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-800/90 bg-[#111724] p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between text-zinc-400 text-[11px] pb-1.5 border-b border-zinc-800/70">
                    <span className="font-semibold text-teal-300">{t.questionPrefix}: {item.question}</span>
                    <span className="font-mono text-[10px] text-zinc-500">{item.timestamp}</span>
                  </div>

                  <p className="text-zinc-100 leading-relaxed whitespace-pre-wrap text-xs bg-[#0b0f17] p-3 rounded-lg border border-zinc-850">
                    {item.answer}
                  </p>

                  {item.citations && item.citations.length > 0 && (
                    <div className="pt-1.5 space-y-2">
                      <span className="text-[10px] text-teal-400 uppercase tracking-wider block font-semibold">
                        {t.citations}
                      </span>
                      {item.citations.map((c, i) => {
                        const isSelected = activeCitationSnippet === c.text_snippet;
                        return (
                          <div 
                            key={i} 
                            onClick={() => handleCitationClick(c.text_snippet, c.page_number)}
                            title={t.jumpToPassage}
                            className={`rounded-lg p-2.5 text-[11.5px] transition-all cursor-pointer border space-y-1 group ${
                              isSelected 
                                ? "bg-[#141b2b] border-teal-500 border-l-[4px] shadow-sm shadow-teal-950/60 ring-1 ring-teal-500/30" 
                                : "bg-[#0c101a] border-zinc-800/80 border-l-[3px] border-l-teal-500/70 hover:border-zinc-700 hover:bg-[#101522]"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span className="font-mono flex items-center gap-1.5">
                                <span className="text-teal-400 font-semibold">{t.pageLabel} {c.page_number || 1}</span>
                                <span className="text-zinc-600">•</span>
                                <span>{t.chunkLabel} #{c.chunk_index + 1}</span>
                                <ExternalLink className="h-2.5 w-2.5 opacity-40 group-hover:opacity-100 group-hover:text-teal-400 transition-opacity" />
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-teal-400/80 group-hover:text-teal-300 font-sans hidden sm:inline transition-colors">
                                  {t.jumpToPassage}
                                </span>
                                <span className="rounded bg-emerald-950/80 border border-emerald-800/70 text-emerald-300 font-mono px-1.5 py-0.2">
                                  {(c.relevance_score * 100).toFixed(0)}% {t.matchLabel}
                                </span>
                              </div>
                            </div>
                            <p className="line-clamp-3 font-sans italic text-zinc-300/90 leading-relaxed group-hover:text-zinc-100 transition-colors">
                              "{extractCleanQueryText(c.text_snippet)}"
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-500 text-xs">
                <Search className="h-8 w-8 mb-2 stroke-[1.2] opacity-30 text-teal-400" />
                <p>{t.emptySearch}</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}