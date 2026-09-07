import time
import uuid
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.schemas import ParseResponse, QueryRequest, QueryResponse
from app.services.vlm_service import vlm_service
from app.services.vector_service import vector_service
from app.services.document_processor import prepare_image
from app.core.config import settings

router = APIRouter()

DOCUMENTS_STORE = {}

@router.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)):
    start_time = time.time()
    contents = await file.read()
    
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        
    doc_id = str(uuid.uuid4())[:8]
    filename = file.filename or "unknown_document"
    
    try:
        img_bytes, mime_type = prepare_image(contents)
        
        markdown, metadata = vlm_service.parse_document_page(img_bytes, mime_type)
        
        vector_service.index_document(
            document_id=doc_id,
            text=markdown,
            metadata=metadata.model_dump()
        )
        
        duration = round(time.time() - start_time, 2)
        response_data = ParseResponse(
            document_id=doc_id,
            filename=filename,
            transcription_markdown=markdown,
            metadata=metadata,
            page_count=1,
            processing_time_seconds=duration
        )
        
        DOCUMENTS_STORE[doc_id] = response_data
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@router.get("/documents/{document_id}", response_model=ParseResponse)
async def get_document(document_id: str):
    if document_id not in DOCUMENTS_STORE:
        raise HTTPException(status_code=404, detail="Document not found")
    return DOCUMENTS_STORE[document_id]

@router.post("/query", response_model=QueryResponse)
async def query_documents(req: QueryRequest):
    citations = vector_service.search(
        query=req.question,
        top_k=req.top_k,
        document_ids=req.document_ids
    )
    
    if not citations:
        return QueryResponse(
            answer="هیچ زانیارییەکی پەیوەندیدار لە بەڵگەنامەکاندا نەدۆزرایەوە / No relevant information found in the documents.",
            citations=[]
        )
        
    # Generate concise contextual answer
    context = "\n\n".join([c.text_snippet for c in citations])
    answer = f"بەپێی ئەو بەڵگەنامانەی پشکنران، زانیارییە پەیوەندیدارەکان ئەمانەن:\n\n{context[:350]}..."
    
    return QueryResponse(
        answer=answer,
        citations=citations
    )
