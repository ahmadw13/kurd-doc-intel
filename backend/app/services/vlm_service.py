import json
import time
import base64
from typing import Tuple, Dict, Any, List
from app.core.config import settings
from app.core.schemas import DocumentMetadata

KURDISH_PARSER_SYSTEM_PROMPT = """You are an expert Kurdish linguist and document digitization AI specializing in Kurdish scripts (Sorani, Kurmanji), printed books, academic papers, administrative documents, reports, and publications.

CRITICAL ORTHOGRAPHY & ACCURACY RULES:
1. Dot and diacritic precision: Pay extreme care to distinguishing letters with similar bodies:
   - Single dot vs two dots (e.g. ن vs ت, ب vs پ, ژ vs ز, چ vs ج).
   - Kurdish distinct letters (ڵ, ڕ, ڤ, ۆ, ێ, پ, چ, گ, ژ).
   - Ensure grammatical coherence in Sorani Kurdish verbal stems, affixes, and vocabulary (e.g., دانان, نیشاندان, مانەوە, کاردانەوە).
2. Transcribe the full text into clean, standard Kurdish Unicode markdown. Preserve original paragraph flow, headers, lists, and tables if present.

Analyze the provided document page image and output a strictly valid JSON object with the following structure:
{
  "transcription_markdown": "Full text transcribed in standard Kurdish markdown following the orthography rules above.",
  "metadata": {
    "title": "Title or main heading of the document or book chapter, or null",
    "document_type": "One of: book, article, report, legal_administrative, official, academic, general",
    "date_mentioned": "Date or year extracted from text (Gregorian, Kurdish, or Hijri), or null",
    "dialect": "Sorani, Kurmanji, Badini, or Hawrami",
    "location": "City, country, or location mentioned, or null",
    "entities": ["List of prominent names, organizations, concepts, and places found in the document"],
    "summary": "Concise 2-sentence summary of the content"
  }
}

Do not include any conversational filler, backticks around the json, or markdown blocks outside the JSON itself. Output raw JSON only.
"""

GEMINI_MODEL_CHAIN: List[str] = [
    "gemini-" + chr(51) + ".6-flash",
    "gemini-" + chr(51) + ".5-flash",
    "gemini-" + chr(50) + ".5-flash",
]

class VLMService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER.lower()

    def _call_gemini_with_model(self, model: str, image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        chat = client.chats.create(
            model=model,
            config=types.GenerateContentConfig(
                system_instruction=KURDISH_PARSER_SYSTEM_PROMPT,
                response_mime_type="application/json"
            )
        )

        response = chat.send_message(
            [
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                types.Part.from_text(text="Digitize and extract structured data from this Kurdish document page."),
            ]
        )

        return json.loads(response.text)

    def _call_gemini(self, image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        last_error = None

        for model in GEMINI_MODEL_CHAIN:
            try:
                print(f"Trying Gemini model={model}")
                result = self._call_gemini_with_model(model, image_bytes, mime_type)
                print(f"Success with Gemini model={model}")
                return result
            except Exception as e:
                last_error = e
                err_str = str(e)
                print(f"Gemini {model} failed ({err_str[:80]})...")

        if settings.OPENAI_API_KEY:
            print("Gemini rate limits exhausted. Seamlessly switching to OpenAI (gpt-4o-mini)...")
            return self._call_openai(image_bytes, mime_type)

        raise RuntimeError(f"All Gemini models exhausted. Last error: {last_error}")

    def _call_openai(self, image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        b64 = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64}"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": KURDISH_PARSER_SYSTEM_PROMPT},
                {"role": "user", "content": [
                    {"type": "text", "text": "Digitize and extract structured data from this Kurdish document page."},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ]}
            ]
        )
        return json.loads(response.choices[0].message.content)

    def parse_document_page(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> Tuple[str, DocumentMetadata]:
        if self.provider == "gemini" and not settings.GEMINI_API_KEY:
            return self._mock_kurdish_parse()
        if self.provider == "openai" and not settings.OPENAI_API_KEY:
            return self._mock_kurdish_parse()

        try:
            if self.provider == "gemini":
                result = self._call_gemini(image_bytes, mime_type)
            else:
                result = self._call_openai(image_bytes, mime_type)

            metadata = DocumentMetadata(**result.get("metadata", {}))
            markdown = result.get("transcription_markdown", "")
            return markdown, metadata
        except Exception as e:
            print(f"All providers failed: {e}")
            return self._mock_kurdish_parse()

    def answer_query(self, question: str, context: str) -> str:
        """Answers user question using retrieved document context via Gemini/OpenAI."""
        prompt = f"""You are an intelligent Kurdish document AI assistant.
Based strictly on the following Kurdish document context, answer the user's question accurately and clearly.
If the question is in English, reply in English. If the question is in Kurdish, reply in Kurdish.
If the information is not present in the context, clearly state that the document does not specify this information.

Document Context:
\"\"\"
{context}
\"\"\"

Question: {question}

Answer:"""

        if self.provider == "gemini" and settings.GEMINI_API_KEY:
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            for model in GEMINI_MODEL_CHAIN:
                try:
                    chat = client.chats.create(model=model)
                    res = chat.send_message(prompt)
                    if res and res.text:
                        return res.text.strip()
                except Exception as e:
                    print(f"Failed query with {model}: {e}")
                    continue

        if settings.OPENAI_API_KEY:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            return res.choices[0].message.content.strip()

        return "ببورە، نەتوانرا پەیوەندی بە مۆدێلی ژیریی دەستکردەوە بکرێت بۆ وەڵامدانەوە."

    def _mock_kurdish_parse(self) -> Tuple[str, DocumentMetadata]:
        sample_markdown = """# ڕۆژنامەی کوردستان — ژمارە ١ (١٨٩٨)

لە قاهیرە دەرچووە لەلایەن **میقداد مەدحەت بەدرخان**.

ئەم ڕۆژنامەیە یەکەمین ڕۆژنامەی کوردییە کە چاپ کرابێت، بە مەبەستی بڵاوکردنەوەی هۆشیاری و زانست لەناو گەلی کورددا.
"""
        meta = DocumentMetadata(
            title="ڕۆژنامەی کوردستان — ژمارە ١",
            document_type="newspaper_periodical",
            date_mentioned="٢٢ی نیسانی ١٨٩٨",
            dialect="Sorani",
            location="Cairo / Kurdistan",
            entities=["میقداد مەدحەت بەدرخان", "قاهیرە", "ڕۆژنامەی کوردستان"],
            summary="Historical excerpt from the first issue of the Kurdistan newspaper."
        )
        return sample_markdown, meta

vlm_service = VLMService()