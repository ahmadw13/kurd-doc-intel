import time
import os
import shutil
import asyncio
import json
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Query
from app.core.schemas import ParseResponse, QueryRequest, QueryResponse, DocumentMetadata
from app.services.vlm_service import vlm_service
from app.services.vector_service import vector_service
from app.services.document_processor import extract_pdf_page_images, prepare_image

router = APIRouter()

UPLOAD_DIR = "./data/uploads"
DOCUMENTS_DIR = "./data/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DOCUMENTS_DIR, exist_ok=True)

@router.post("/parse", response_model=ParseResponse)
async def parse_document(
    request: Request,
    file: UploadFile = File(...),
    max_pages: Optional[int] = Query(default=5, description="Maximum number of pages to process")
):
    start_time = time.time()
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    allowed_exts = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {allowed_exts}")

    file_id = f"doc_{int(time.time())}"
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    try:
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if await request.is_disconnected():
            if os.path.exists(saved_path):
                os.remove(saved_path)
            raise HTTPException(status_code=499, detail="Client closed request")

        if ext == ".pdf":
            page_images = await asyncio.wait_for(
                asyncio.to_thread(extract_pdf_page_images, saved_path),
                timeout=120.0
            )
        else:
            page_images = await asyncio.wait_for(
                asyncio.to_thread(prepare_image, saved_path),
                timeout=30.0
            )

        total_pdf_pages = len(page_images)
        if max_pages and max_pages > 0:
            page_images = page_images[:max_pages]

        all_markdown = []
        aggregated_entities = set()
        primary_metadata = None
        extracted_title = None
        extracted_date = None
        extracted_location = None
        extracted_dialect = None
        extracted_doc_type = None
        extracted_summary = None

        for idx, (img_bytes, mime_type) in enumerate(page_images):
            if await request.is_disconnected():
                print(f"Aborting upload for {file.filename} at page {idx + 1}")
                if os.path.exists(saved_path):
                    os.remove(saved_path)
                raise HTTPException(status_code=499, detail="Client cancelled request")

            print(f"Processing page {idx + 1} of {len(page_images)} (total PDF pages: {total_pdf_pages})...")
            markdown, meta = await asyncio.wait_for(
                asyncio.to_thread(vlm_service.parse_document_page, img_bytes, mime_type),
                timeout=45.0
            )

            all_markdown.append(f"<!-- Page {idx + 1} -->\n" + markdown)
            if meta.entities:
                aggregated_entities.update(meta.entities)

            # Accumulate the first non-null metadata values found across any page
            if not extracted_title and meta.title and meta.title.lower() not in ("null", "none", "untitled"):
                extracted_title = meta.title
            if not extracted_date and meta.date_mentioned:
                extracted_date = meta.date_mentioned
            if not extracted_location and meta.location:
                extracted_location = meta.location
            if not extracted_dialect and meta.dialect:
                extracted_dialect = meta.dialect
            if not extracted_doc_type and meta.document_type:
                extracted_doc_type = meta.document_type
            if not extracted_summary and meta.summary:
                extracted_summary = meta.summary

        full_markdown = "\n\n---\n\n".join(all_markdown)
        
        # Smart fallback for title: strip extension and cleanup underscores
        clean_file_title = os.path.splitext(file.filename)[0].replace("_", " ").strip()
        final_title = extracted_title or clean_file_title

        primary_metadata = DocumentMetadata(
            title=final_title,
            document_type=extracted_doc_type or "general",
            date_mentioned=extracted_date,
            dialect=extracted_dialect or "Sorani",
            location=extracted_location,
            entities=list(aggregated_entities),
            summary=extracted_summary or "Parsed Kurdish document."
        )

        await asyncio.to_thread(
            vector_service.add_document,
            file_id,
            full_markdown,
            primary_metadata.model_dump()
        )

        elapsed = round(time.time() - start_time, 2)
        parse_response = ParseResponse(
            document_id=file_id,
            filename=file.filename,
            page_count=len(page_images),
            transcription_markdown=full_markdown,
            metadata=primary_metadata,
            processing_time_seconds=elapsed
        )

        try:
            record = parse_response.model_dump()
            record["created_at"] = int(time.time())
            with open(os.path.join(DOCUMENTS_DIR, f"{file_id}.json"), "w", encoding="utf-8") as f:
                json.dump(record, f, ensure_ascii=False, indent=2)
        except Exception as save_err:
            print(f"Warning: Failed to save document archive: {save_err}")

        return parse_response

    except asyncio.TimeoutError:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(
            status_code=504,
            detail={"code": "TIMEOUT", "message": "Document processing timed out."}
        )
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        err_text = str(e)
        if any(x in err_text for x in ("429", "RESOURCE_EXHAUSTED", "quota", "RateLimit", "exhausted")):
            raise HTTPException(
                status_code=429,
                detail={"code": "AI_RATE_LIMIT", "message": "AI quota or rate limit exceeded. Please wait 1-2 minutes or reduce page count."}
            )
        raise HTTPException(
            status_code=500,
            detail={"code": "PROCESSING_FAILED", "message": f"Failed to process document: {err_text}"}
        )

@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    try:
        citations = await asyncio.to_thread(
            vector_service.query,
            request.question,
            request.document_ids,
            request.top_k
        )

        if citations:
            context = "\n\n".join([
                f"[Source Citation #{i+1} | Document: {c.document_id} | Page {c.page_number or 1} | Chunk #{c.chunk_index + 1}]:\n{c.text_snippet}"
                for i, c in enumerate(citations)
            ])
            answer = await asyncio.to_thread(
                vlm_service.answer_query,
                request.question,
                context
            )
        else:
            answer = "داوا لەبوردن دەکەم، هیچ زانیارییەکی پەیوەندیدار لە بەڵگەنامەکاندا نەدۆزرایەوە."

        return QueryResponse(
            answer=answer,
            citations=citations
        )
    except HTTPException:
        raise
    except Exception as e:
        err_text = str(e)
        if any(x in err_text for x in ("429", "RESOURCE_EXHAUSTED", "quota", "RateLimit", "exhausted")):
            raise HTTPException(
                status_code=429,
                detail={"code": "AI_RATE_LIMIT", "message": "AI rate limit reached during search. Please wait a moment."}
            )
        raise HTTPException(
            status_code=500,
            detail={"code": "QUERY_FAILED", "message": f"Query failed: {err_text}"}
        )

@router.get("/documents")
async def list_documents():
    docs = []
    seen_ids = set()

    if os.path.exists(DOCUMENTS_DIR):
        for fname in os.listdir(DOCUMENTS_DIR):
            if fname.endswith(".json"):
                fpath = os.path.join(DOCUMENTS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        meta = data.get("metadata", {})
                        doc_id = data.get("document_id", fname.replace(".json", ""))
                        seen_ids.add(doc_id)
                        docs.append({
                            "document_id": doc_id,
                            "filename": data.get("filename", "document.pdf"),
                            "title": meta.get("title") or data.get("filename", "Untitled"),
                            "page_count": data.get("page_count", 1),
                            "dialect": meta.get("dialect", "Sorani"),
                            "document_type": meta.get("document_type", "general"),
                            "created_at": data.get("created_at", int(os.path.getmtime(fpath)))
                        })
                except Exception as e:
                    print(f"Error reading {fpath}: {e}")

    # Fallback to ChromaDB for older indexed documents
    try:
        res = vector_service.collection.get(include=["metadatas"])
        for meta in res.get("metadatas", []):
            doc_id = meta.get("document_id")
            if doc_id and doc_id not in seen_ids:
                seen_ids.add(doc_id)
                docs.append({
                    "document_id": doc_id,
                    "filename": f"{meta.get('title', 'document')}.pdf",
                    "title": meta.get("title", "Untitled"),
                    "page_count": 1,
                    "dialect": meta.get("dialect", "Sorani"),
                    "document_type": meta.get("document_type", "general"),
                    "created_at": int(time.time())
                })
    except Exception as e:
        print(f"Chroma fallback error: {e}")

    docs.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    return docs

@router.get("/documents/{document_id}", response_model=ParseResponse)
async def get_document(document_id: str):
    fpath = os.path.join(DOCUMENTS_DIR, f"{document_id}.json")
    if os.path.exists(fpath):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
                return ParseResponse(**data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read archived document: {str(e)}")

    # Fallback: reconstruct from ChromaDB
    try:
        res = vector_service.collection.get(where={"document_id": document_id}, include=["documents", "metadatas"])
        if res and res.get("documents") and len(res["documents"]) > 0:
            full_md = "\n\n".join(res["documents"])
            first_meta = res["metadatas"][0] if res.get("metadatas") else {}
            metadata = DocumentMetadata(
                title=first_meta.get("title", "Document"),
                document_type=first_meta.get("document_type", "general"),
                dialect=first_meta.get("dialect", "Sorani"),
                entities=[]
            )
            return ParseResponse(
                document_id=document_id,
                filename=f"{first_meta.get('title', 'Document')}.pdf",
                page_count=max([m.get("page_number", 1) for m in res.get("metadatas", [{}])]),
                transcription_markdown=full_md,
                metadata=metadata,
                processing_time_seconds=0.0
            )
    except Exception as e:
        print(f"Failed to retrieve from ChromaDB: {e}")

    raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found in archive.")

@router.delete("/documents")
async def clear_documents():
    deleted_files = 0
    if os.path.exists(DOCUMENTS_DIR):
        for fname in os.listdir(DOCUMENTS_DIR):
            if fname.endswith(".json"):
                try:
                    os.remove(os.path.join(DOCUMENTS_DIR, fname))
                    deleted_files += 1
                except Exception as e:
                    print(f"Error removing {fname}: {e}")

    try:
        vector_service.clear_all()
    except Exception as e:
        print(f"Error clearing vector store: {e}")

    return {"status": "ok", "deleted_files": deleted_files, "message": "Document archive cleared successfully."}

@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    fpath = os.path.join(DOCUMENTS_DIR, f"{document_id}.json")
    removed = False
    if os.path.exists(fpath):
        try:
            os.remove(fpath)
            removed = True
        except Exception as e:
            print(f"Error removing {fpath}: {e}")

    try:
        vector_service.delete_document(document_id)
        removed = True
    except Exception as e:
        print(f"Error deleting from vector service: {e}")

    if not removed:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")

    return {"status": "ok", "document_id": document_id, "message": "Document deleted successfully."}