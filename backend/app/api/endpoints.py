import time
import os
import shutil
import asyncio
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, Query
from app.core.schemas import ParseResponse, QueryRequest, QueryResponse, DocumentMetadata
from app.services.vlm_service import vlm_service
from app.services.vector_service import vector_service
from app.services.document_processor import extract_pdf_page_images, prepare_image

router = APIRouter()

UPLOAD_DIR = "./data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
            if idx == 0:
                primary_metadata = meta

        full_markdown = "\n\n---\n\n".join(all_markdown)
        
        if primary_metadata:
            primary_metadata.entities = list(aggregated_entities)
        else:
            primary_metadata = DocumentMetadata(summary="Parsed document")

        await asyncio.to_thread(
            vector_service.add_document,
            file_id,
            full_markdown,
            primary_metadata.model_dump()
        )

        elapsed = round(time.time() - start_time, 2)
        return ParseResponse(
            document_id=file_id,
            filename=file.filename,
            page_count=len(page_images),
            transcription_markdown=full_markdown,
            metadata=primary_metadata,
            processing_time_seconds=elapsed
        )

    except asyncio.TimeoutError:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(status_code=540, detail="Document processing timed out.")
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

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
            context = "\n".join([f"[{c.document_id}]: {c.text_snippet}" for c in citations])
            answer = f"بێگومان، بەپێی بەڵگەنامە ئاماژەپێکراوەکان:\n\n{context}"
        else:
            answer = "داوا لەبوردن دەکەم، هیچ زانیارییەکی پەیوەندیدار لە بەڵگەنامەکاندا نەدۆزرایەوە."

        return QueryResponse(
            answer=answer,
            citations=citations
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@router.get("/documents")
async def list_documents():
    return {"status": "ok", "message": "Document list endpoint"}