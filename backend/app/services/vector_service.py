import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.core.schemas import SourceCitation

class VectorService:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name="kurdish_documents",
            metadata={"description": "Kurdish manuscripts, periodicals, and archives"}
        )

    def _chunk_text(self, text: str, chunk_size: int = 400, overlap: int = 50) -> List[str]:
        words = text.split()
        chunks = []
        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
        return chunks if chunks else [text]

    def index_document(self, document_id: str, text: str, metadata: Dict[str, Any]):
        chunks = self._chunk_text(text)
        ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        metas = [
            {
                "document_id": document_id,
                "chunk_index": i,
                "title": metadata.get("title") or "Untitled",
                "dialect": metadata.get("dialect") or "Sorani",
                "location": metadata.get("location") or "Unknown"
            }
            for i in range(len(chunks))
        ]
        
        self.collection.add(
            ids=ids,
            documents=chunks,
            metadatas=metas
        )

    def search(self, query: str, top_k: int = 4, document_ids: Optional[List[str]] = None) -> List[SourceCitation]:
        where_clause = None
        if document_ids:
            if len(document_ids) == 1:
                where_clause = {"document_id": document_ids[0]}
            else:
                where_clause = {"document_id": {"$in": document_ids}}

        results = self.collection.query(
            query_texts=[query],
            n_results=top_k,
            where=where_clause
        )

        citations = []
        if results and results.get("documents") and len(results["documents"]) > 0:
            docs = results["documents"][0]
            metadatas = results["metadatas"][0] if results.get("metadatas") else []
            distances = results["distances"][0] if results.get("distances") else []
            
            for i, doc in enumerate(docs):
                meta = metadatas[i] if i < len(metadatas) else {}
                score = round(1.0 - (distances[i] if i < len(distances) else 0.5), 3)
                citations.append(
                    SourceCitation(
                        document_id=meta.get("document_id", "unknown"),
                        chunk_index=meta.get("chunk_index", 0),
                        text_snippet=doc[:300] + "...",
                        relevance_score=max(0.0, score)
                    )
                )
        return citations

vector_service = VectorService()
