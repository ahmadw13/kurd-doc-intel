# Developer Guide & API Documentation — KurdDocIntel

This document provides developer setup instructions, configuration reference, REST API documentation, and architecture guidelines for contributing to KurdDocIntel.

---

## 1. Prerequisites

Before running the application locally, ensure you have the following installed:

- **Python:** 3.11 or higher (3.13 tested and supported).
- **Node.js:** 18.0 or higher (with npm or pnpm).
- **AI API Keys:**
  - Google Gemini API key (primary multimodal provider and embeddings).
  - OpenAI API key (optional fallback for OCR and Q&A).

---

## 2. Environment Configuration

### Backend Configuration (`backend/.env`)

Create a `.env` file in the `backend/` root:

```env
# Multimodal AI Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Provider Configuration
DEFAULT_VLM_PROVIDER=gemini
GEMINI_VLM_MODEL=gemini-2.5-flash
OPENAI_VLM_MODEL=gpt-4o

# Storage & Vector Database
CHROMA_PERSIST_DIR=./chroma_db
DOCUMENTS_DIR=./data/documents
UPLOAD_DIR=./data/uploads

# Server Settings
HOST=127.0.0.1
PORT=8080
LOG_LEVEL=info
```

### Frontend Configuration (`frontend/.env.local`)

Optional. By default, the frontend points to `http://127.0.0.1:8080`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8080
```

---

## 3. Local Development Setup

### Backend (FastAPI)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server with live reload
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

The interactive OpenAPI documentation is available at `http://127.0.0.1:8080/docs`.

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 4. REST API Specification

### 4.1 Health Check
- **Endpoint:** `GET /health`
- **Description:** System health check and active AI provider confirmation.
- **Response:**
  ```json
  {
    "status": "healthy",
    "service": "KurdDocIntel Backend",
    "version": "0.1.0",
    "ai_provider": "gemini"
  }
  ```

### 4.2 Parse Document
- **Endpoint:** `POST /api/v1/parse`
- **Query Parameter:** `max_pages` (integer, default: 5, `0` for all pages)
- **Form Data:** `file` (multipart/form-data, PDF or image)
- **Description:** Ingests a document, performs 300 DPI rendering, extracts structured Kurdish Unicode markdown, parses document metadata, indexes chunks into ChromaDB, and persists a JSON record in `data/documents/`.
- **Response Model (`ParseResponse`):**
  ```json
  {
    "document_id": "doc_1788817976",
    "filename": "document.pdf",
    "page_count": 4,
    "transcription_markdown": "<!-- Page 1 -->\n## بەشی یەکەم\n...",
    "metadata": {
      "title": "سەد مەیموون",
      "document_type": "book",
      "dialect": "Sorani",
      "location": "سلێمانی",
      "date_mentioned": "2018",
      "entities": ["مەیموونەکان", "کۆشیمە", "کۆشمەکان"],
      "summary": "پوختەی ناوەڕۆکی ئەم بەڵگەنامەیە..."
    },
    "processing_time_seconds": 3.8
  }
  ```

### 4.3 Query Document (Semantic Q&A)
- **Endpoint:** `POST /api/v1/query`
- **Request Body (`QueryRequest`):**
  ```json
  {
    "question": "ئەنجامی تاقیکردنەوەکە چی بوو؟",
    "document_ids": ["doc_1788817976"],
    "top_k": 4
  }
  ```
- **Response Model (`QueryResponse`):**
  ```json
  {
    "answer": "بەپێی دەقی بەڵگەنامەکە...",
    "citations": [
      {
        "document_id": "doc_1788817976",
        "chunk_index": 2,
        "page_number": 1,
        "text_snippet": "دانان. پاشان چاوەڕوان مانەوە بزانن...",
        "relevance_score": 0.892
      }
    ]
  }
  ```

### 4.4 List Archived Documents
- **Endpoint:** `GET /api/v1/documents`
- **Description:** Returns sorted list of all analyzed documents from disk and ChromaDB vector collection.
- **Response:**
  ```json
  [
    {
      "document_id": "doc_1788817976",
      "filename": "سەد مەیموون.pdf",
      "title": "سەد مەیموون",
      "page_count": 4,
      "dialect": "Sorani",
      "document_type": "book",
      "created_at": 1788820835
    }
  ]
  ```

### 4.5 Get Archived Document Details
- **Endpoint:** `GET /api/v1/documents/{document_id}`
- **Description:** Retrieves the full `ParseResponse` for a specific document without re-parsing.

### 4.6 Clear Document Archive
- **Endpoint:** `DELETE /api/v1/documents`
- **Description:** Clears all cached JSON documents and resets the ChromaDB vector collection.

### 4.7 Delete Single Document
- **Endpoint:** `DELETE /api/v1/documents/{document_id}`
- **Description:** Deletes a specific document from disk and removes its chunks from ChromaDB.

---

## 5. Development Guidelines & Standards

### 5.1 Kurdish Orthography & Normalization
- Always output clean, standardized Kurdish Unicode text.
- Normalize legacy ASCII characters into standard Kurdish Unicode characters:
  - Use `ڵ` (U+06B5) rather than raw Arabic `ل`.
  - Use `ڕ` (U+0695) rather than raw Arabic `ر`.
  - Use `ێ` (U+06CE) and `ۆ` (U+06C6).
  - Use Kurdish digits (`۰-۹`) or standard European digits consistently based on input text structure.

### 5.2 Right-to-Left (RTL) Parity
- All new UI components must support bidirectional layouts (`rtl` for Kurdish, `ltr` for English).
- Use logical Tailwind classes where possible (`rtl:mr-auto`, `rtl:text-right`, `rtl:border-r`).

### 5.3 Zero Emoji Policy
- Do not use emojis in user-facing UI elements, code comments, commit messages, or documentation. Use clean Lucide icons or text labels instead.

### 5.4 AI Quota & Error Resilience
- When writing backend endpoints that call external AI providers, wrap calls with `try...except` catching rate limit errors (HTTP 429, `RESOURCE_EXHAUSTED`).
- Return structured error details (`{ "code": "AI_RATE_LIMIT", "message": "..." }`) so the frontend can display contextual diagnostic notices.

### 5.5 Pull Request Standards
- Every pull request must adhere to the standard template defined in [.github/pull_request_template.md](.github/pull_request_template.md).
- Ensure all backend unit tests pass (`python -m unittest discover -s tests`).
- Ensure the frontend builds cleanly without TypeScript or lint errors (`npm run build`).
- For user-facing interface changes, include screenshots verifying both RTL (Kurdish) and LTR (English) layouts.
- Label any AI-generated or AI-assisted pull requests with the `AI-Made` label.

---

## 6. Production Build & Verification

### Frontend Production Build
```bash
cd frontend
npm run build
npm run start -p 3000
```

### Backend Production Server
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 4
```

### Docker Compose Deployment
```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```
