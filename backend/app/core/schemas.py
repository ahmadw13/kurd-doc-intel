from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class DocumentMetadata(BaseModel):
    title: Optional[str] = Field(None, description="Extracted title or header of the document")
    document_type: Optional[str] = Field(None, description="Manuscript, newspaper, administrative, poem, or general")
    date_mentioned: Optional[str] = Field(None, description="Gregorian, Kurdish, or Hijri date found in text")
    dialect: Optional[str] = Field("Sorani", description="Sorani, Kurmanji, Badini, or Hawrami")
    location: Optional[str] = Field(None, description="City or place mentioned (e.g., Erbil, Sulaymaniyah, Duhok, Kirkuk)")
    entities: List[str] = Field(default_factory=list, description="Key names, organizations, places")
    summary: Optional[str] = Field(None, description="Brief summary of the document in Kurdish or English")

class ParseResponse(BaseModel):
    document_id: str
    filename: str
    transcription_markdown: str
    metadata: DocumentMetadata
    page_count: int
    processing_time_seconds: float

class QueryRequest(BaseModel):
    question: str = Field(..., description="Question in Kurdish or English")
    document_ids: Optional[List[str]] = Field(None, description="Optional filter by document IDs")
    top_k: int = Field(4, description="Number of context chunks to retrieve")

class SourceCitation(BaseModel):
    document_id: str
    chunk_index: int
    text_snippet: str
    relevance_score: float

class QueryResponse(BaseModel):
    answer: str
    citations: List[SourceCitation]
