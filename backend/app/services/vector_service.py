import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"

from typing import List, Dict, Any, Optional
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from app.core.schemas import SourceCitation
from app.core.config import settings

class GeminiEmbeddingFunction(EmbeddingFunction):
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY

    def name(self) -> str:
        return "gemini_multilingual_embedding"

    def __call__(self, input: Documents) -> Embeddings:
        if not self.api_key:
            return [[0.0] * 3072 for _ in input]
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            embeddings = []
            for text in input:
                clean_text = text[:2000]
                res = client.models.embed_content(
                    model="gemini-embedding-2",
                    contents=clean_text
                )
                embeddings.append(res.embeddings[0].values)
            return embeddings
        except Exception as e:
            print(f"Gemini embedding call failed ({e}), fallback zeroes")
            return [[0.0] * 3072 for _ in input]

class VectorService:
    def __init__(self, persist_directory: str = None):
        self.persist_directory = persist_directory or settings.CHROMA_PERSIST_DIR
        self._client = None
        self._collection = None

    @property
    def collection(self):
        if self._collection is None:
            import chromadb
            from chromadb.config import Settings
            self._client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=Settings(anonymized_telemetry=False)
            )
            # Use Gemini Multilingual Embedding (dimension 3072) for cross-lingual Kurdish <-> English search
            self._collection = self._client.get_or_create_collection(
                name="kurdish_multilingual_v1",
                metadata={"hnsw:space": "cosine"},
                embedding_function=GeminiEmbeddingFunction()
            )
        return self._collection

    def chunk_page_text(self, page_number: int, text: str, chunk_size: int = 700, overlap: int = 120) -> List[str]:
        import re
        clean_text = text.replace(f"<!-- Page {page_number} -->", "").strip()
        clean_text = re.sub(r"<(?:p|div|center)[^>]*>\s*([0-9\u0660-\u0669]+)\s*<\/(?:p|div|center)>", "", clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r"<(?:p|div|center)[^>]*>", "", clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r"<\/(?:p|div|center)>", "", clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r"^\s*([0-9\u0660-\u0669]{1,4})\s*$", "", clean_text, flags=re.MULTILINE)
        clean_text = re.sub(r"^\s*---\s*$", "", clean_text, flags=re.MULTILINE)
        clean_text = re.sub(r"\n{3,}", "\n\n", clean_text).strip()
        paragraphs = clean_text.split("\n\n")
        raw_chunks = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current_chunk) + len(para) <= chunk_size:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    raw_chunks.append(current_chunk.strip())
                if len(para) > chunk_size:
                    for i in range(0, len(para), chunk_size - overlap):
                        part = para[i:i + chunk_size].strip()
                        if part:
                            raw_chunks.append(part)
                    current_chunk = ""
                else:
                    current_chunk = para + "\n\n"

        if current_chunk:
            raw_chunks.append(current_chunk.strip())

        if not raw_chunks and clean_text:
            raw_chunks = [clean_text]

        page_header = f"[Page {page_number} | لاپەڕە {page_number}]"
        return [f"{page_header}\n{chunk}" for chunk in raw_chunks if chunk]

    def chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
        return self.chunk_page_text(1, text, chunk_size, overlap)

    def add_document(self, document_id: str, text: str, metadata: Dict[str, Any]) -> int:
        import re
        page_splits = re.split(r"<!--\s*Page\s*(\d+)\s*-->", text)
        pages = []
        if len(page_splits) > 1:
            for i in range(1, len(page_splits), 2):
                try:
                    p_num = int(page_splits[i])
                except ValueError:
                    p_num = (i // 2) + 1
                p_body = page_splits[i + 1] if i + 1 < len(page_splits) else ""
                pages.append((p_num, p_body))
        else:
            pages = [(1, text)]

        all_chunks = []
        all_ids = []
        all_metadatas = []
        global_idx = 0

        for p_num, p_body in pages:
            page_chunks = self.chunk_page_text(p_num, p_body)
            for c in page_chunks:
                all_chunks.append(c)
                all_ids.append(f"{document_id}_p{p_num}_c{global_idx}")
                all_metadatas.append({
                    "document_id": document_id,
                    "chunk_index": global_idx,
                    "page_number": int(p_num),
                    "title": str(metadata.get("title") or "Untitled"),
                    "dialect": str(metadata.get("dialect") or "Unknown"),
                    "document_type": str(metadata.get("document_type") or "general")
                })
                global_idx += 1

        if all_chunks:
            self.collection.add(documents=all_chunks, metadatas=all_metadatas, ids=all_ids)
        return len(all_chunks)

    def query(self, query_text: str, document_ids: Optional[List[str]] = None, top_k: int = 4) -> List[SourceCitation]:
        import re
        target_page = None
        page_match = re.search(r"(?:page|لاپەڕە|لاپەرە|لاپەڕەی|لاپەرەی)\s*#?\s*([0-9\u0660-\u0669]+)", query_text, re.IGNORECASE)
        if page_match:
            raw_num = page_match.group(1)
            kurdish_digits = "٠١٢٣٤٥٦٧٨٩"
            converted = "".join(str(kurdish_digits.index(ch)) if ch in kurdish_digits else ch for ch in raw_num)
            try:
                target_page = int(converted)
            except ValueError:
                pass

        doc_filter = None
        if document_ids:
            if len(document_ids) == 1:
                doc_filter = {"document_id": document_ids[0]}
            else:
                doc_filter = {"document_id": {"$in": document_ids}}

        citations: List[SourceCitation] = []
        seen_texts = set()

        if target_page is not None:
            page_filter = {"page_number": target_page}
            combined_where = {"$and": [doc_filter, page_filter]} if doc_filter else page_filter
            try:
                page_results = self.collection.query(
                    query_texts=[query_text],
                    n_results=top_k,
                    where=combined_where
                )
                if page_results and page_results.get("documents") and page_results["documents"][0]:
                    docs = page_results["documents"][0]
                    metas = page_results["metadatas"][0] if page_results.get("metadatas") else [{}] * len(docs)
                    distances = page_results["distances"][0] if page_results.get("distances") else [0.0] * len(docs)
                    for doc, meta, dist in zip(docs, metas, distances):
                        clean_snip = doc[:400] + ("..." if len(doc) > 400 else "")
                        seen_texts.add(clean_snip)
                        citations.append(SourceCitation(
                            document_id=meta.get("document_id", "unknown"),
                            chunk_index=meta.get("chunk_index", 0),
                            page_number=int(meta.get("page_number", target_page)),
                            text_snippet=clean_snip,
                            relevance_score=round(max(0.0, 1.0 - dist), 3)
                        ))
            except Exception as e:
                print(f"Page-specific query fallback: {e}")

        remaining_slots = max(1, (top_k * 2) - len(citations))
        general_results = self.collection.query(
            query_texts=[query_text],
            n_results=remaining_slots,
            where=doc_filter
        )

        if general_results and general_results.get("documents") and general_results["documents"][0]:
            docs = general_results["documents"][0]
            metas = general_results["metadatas"][0] if general_results.get("metadatas") else [{}] * len(docs)
            distances = general_results["distances"][0] if general_results.get("distances") else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, distances):
                clean_snip = doc[:400] + ("..." if len(doc) > 400 else "")
                if clean_snip not in seen_texts:
                    seen_texts.add(clean_snip)
                    citations.append(SourceCitation(
                        document_id=meta.get("document_id", "unknown"),
                        chunk_index=meta.get("chunk_index", 0),
                        page_number=int(meta.get("page_number", 1)),
                        text_snippet=clean_snip,
                        relevance_score=round(max(0.0, 1.0 - dist), 3)
                    ))

        return citations[:top_k]

vector_service = VectorService()