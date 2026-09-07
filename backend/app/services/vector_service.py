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
            return [[0.0] * 768 for _ in input]
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
            return [[0.0] * 768 for _ in input]

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

    def chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current_chunk) + len(para) <= chunk_size:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                if len(para) > chunk_size:
                    for i in range(0, len(para), chunk_size - overlap):
                        chunks.append(para[i:i + chunk_size])
                    current_chunk = ""
                else:
                    current_chunk = para + "\n\n"

        if current_chunk:
            chunks.append(current_chunk.strip())
        return chunks if chunks else [text]

    def add_document(self, document_id: str, text: str, metadata: Dict[str, Any]) -> int:
        chunks = self.chunk_text(text)
        ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "document_id": document_id,
                "chunk_index": i,
                "title": str(metadata.get("title") or "Untitled"),
                "dialect": str(metadata.get("dialect") or "Unknown"),
                "document_type": str(metadata.get("document_type") or "general")
            }
            for i in range(len(chunks))
        ]
        self.collection.add(documents=chunks, metadatas=metadatas, ids=ids)
        return len(chunks)

    def query(self, query_text: str, document_ids: Optional[List[str]] = None, top_k: int = 4) -> List[SourceCitation]:
        where_clause = None
        if document_ids:
            if len(document_ids) == 1:
                where_clause = {"document_id": document_ids[0]}
            else:
                where_clause = {"document_id": {"$in": document_ids}}

        results = self.collection.query(
            query_texts=[query_text],
            n_results=top_k,
            where=where_clause
        )

        citations = []
        if results and results.get("documents") and results["documents"][0]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, distances):
                citations.append(SourceCitation(
                    document_id=meta.get("document_id", "unknown"),
                    chunk_index=meta.get("chunk_index", 0),
                    text_snippet=doc[:400] + ("..." if len(doc) > 400 else ""),
                    relevance_score=round(max(0.0, 1.0 - dist), 3)
                ))
        return citations

vector_service = VectorService()