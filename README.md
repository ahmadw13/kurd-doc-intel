# KurdDocIntel — Kurdish Multimodal Document & Archival Intelligence

> High-precision Kurdish OCR, document parsing, and semantic archival search engineered for historical manuscripts, administrative records, and cultural texts across Sorani & Kurmanji dialects.

---

## Context & Problem Statement
Historical and modern Kurdish texts present unique challenges for traditional OCR and document parsing pipelines:
- Complex ligatures, non-standard diacritics, and distinctive Kurdish characters (ڵ, ڕ, ڤ, ۆ, ێ, ژ, پ, چ, گ).
- Century-old degraded scans from historical Kurdish newspapers, poetry collections, and manuscripts.
- A lack of localized semantic search and RAG systems tailored to Kurdish heritage and administrative documents.

**KurdDocIntel** addresses this by pairing Vision-Language Models (VLMs) with specialized document prompting and a multilingual vector retrieval engine.

---

## Architecture Overview

`
[ PDF / Image / Manuscript ]
            │
            ▼
┌───────────────────────┐
│ Ingestion & Tiling    │
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Multimodal VLM Parser │ ──► [ Structured Markdown & Entity Metadata ]
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Multilingual RAG &    │ ──► [ Semantic Search & Context-Aware Q&A ]
│ Chroma Vector Index   │
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ Next.js + Tailwind UI │ (Bilingual Kurdish / English with RTL Support)
└───────────────────────┘
`

---

## Key Capabilities
- **High-Fidelity Kurdish Transcription:** Preserves Kurdish typography, poetry meter, and table structures.
- **Metadata & Entity Extraction:** Automatically detects document date, place of publication, author/signatory, and key themes.
- **Archival Semantic Q&A:** Ask natural questions in Kurdish (Sorani/Kurmanji) or English and get grounded answers with document citations.
- **Ready-to-Test Sample Archive:** Preloaded with sample Kurdish historical documents.

---

## Tech Stack
- **Backend:** FastAPI (Python 3.13), Pydantic
- **AI / Multimodal:** Vision-Language Models (Gemini / OpenAI VLM), Text Embeddings
- **Retrieval:** ChromaDB vector store
- **Frontend:** Next.js, Tailwind CSS, Lucide Icons, RTL Kurdish Typography
- **Containerization:** Docker & Docker Compose
