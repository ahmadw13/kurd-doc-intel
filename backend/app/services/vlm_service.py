import json
import time
import base64
import re
from typing import Tuple, Dict, Any, List
from app.core.config import settings
from app.core.schemas import DocumentMetadata

def clean_kurdish_ocr_markdown(text: str) -> str:
    if not text:
        return ""
    # Remove HTML paragraph/div/center page numbers: e.g. <p align="center">13</p>, <div style="...">12</div>
    text = re.sub(r"<(?:p|div|center)[^>]*>\s*([0-9\u0660-\u0669]+)\s*<\/(?:p|div|center)>", "", text, flags=re.IGNORECASE)
    # Remove any stray HTML wrapper tags
    text = re.sub(r"<(?:p|div|center)[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<\/(?:p|div|center)>", "", text, flags=re.IGNORECASE)
    # Remove isolated page number lines
    text = re.sub(r"^\s*([0-9\u0660-\u0669]{1,4})\s*$", "", text, flags=re.MULTILINE)
    # Remove standalone separator lines
    text = re.sub(r"^\s*---\s*$", "", text, flags=re.MULTILINE)
    # Normalize multiple newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def is_openai_configured() -> bool:
    key = (settings.OPENAI_API_KEY or "").strip()
    return bool(key and (key.startswith("sk-") or len(key) >= 20))

KURDISH_PARSER_SYSTEM_PROMPT = """You are an expert Kurdish linguist and document digitization AI specializing in Kurdish scripts (Sorani, Kurmanji), printed books, academic papers, administrative documents, reports, and publications.

CRITICAL ORTHOGRAPHY & ACCURACY RULES:
1. Dot and diacritic precision: Pay extreme care to distinguishing letters with similar bodies:
   - Single dot vs two dots (e.g. ن vs ت, ب vs پ, ژ vs ز, چ vs ج).
   - Kurdish distinct letters (ڵ, ڕ, ڤ, ۆ, ێ, پ, چ, گ, ژ).
   - Ensure grammatical coherence in Sorani Kurdish verbal stems, affixes, and vocabulary (e.g., دانان, نیشاندان, مانەوە, کاردانەوە).
2. Transcribe the full text into clean, standard Kurdish Unicode markdown. Preserve original paragraph flow, headers, lists, and tables if present.
3. Standalone Page Numbers & Running Footers: Do NOT transcribe standalone printed page numbers, running footers, or running headers (e.g. do not output '<p align="center">13</p>', '<div style="text-align: center;">12</div>', or isolated numbers like '12' or '13' at page bottoms). Omit these and transcribe only actual body text and headings.

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
    "gemini-" + chr(51) + ".5-flash",
    "gemini-" + chr(50) + ".5-flash",
    "gemini-" + chr(51) + ".6-flash",
]

_rate_limited_models: Dict[str, float] = {}

class VLMService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER.lower()

    def _get_active_models(self) -> List[str]:
        now = time.time()
        available = [m for m in GEMINI_MODEL_CHAIN if now >= _rate_limited_models.get(m, 0)]
        return available if available else GEMINI_MODEL_CHAIN

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
        models_to_try = self._get_active_models()

        for model in models_to_try:
            try:
                print(f"Trying Gemini model={model}")
                result = self._call_gemini_with_model(model, image_bytes, mime_type)
                print(f"Success with Gemini model={model}")
                if model in GEMINI_MODEL_CHAIN and GEMINI_MODEL_CHAIN.index(model) > 0:
                    GEMINI_MODEL_CHAIN.remove(model)
                    GEMINI_MODEL_CHAIN.insert(0, model)
                return result
            except Exception as e:
                last_error = e
                err_str = str(e)
                print(f"Gemini {model} failed ({err_str[:80]})...")
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                    _rate_limited_models[model] = time.time() + 600
                    print(f"Model {model} rate limited (429). Placed on 10-min cooldown.")

        if is_openai_configured():
            print("Gemini rate limits exhausted. Seamlessly falling back to OpenAI (gpt-4o-mini)...")
            return self._call_openai(image_bytes, mime_type)

        raise RuntimeError(f"All Gemini models exhausted and no OpenAI API key provided as fallback. Last error: {last_error}")

    def _call_openai(self, image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
        if not is_openai_configured():
            raise RuntimeError("OpenAI API key is not configured.")

        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY.strip())

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
        if self.provider == "gemini":
            if not settings.GEMINI_API_KEY:
                if is_openai_configured():
                    result = self._call_openai(image_bytes, mime_type)
                else:
                    raise RuntimeError("Gemini API key is not configured and no OpenAI fallback key was provided.")
            else:
                result = self._call_gemini(image_bytes, mime_type)
        elif self.provider == "openai":
            if not is_openai_configured():
                raise RuntimeError("OpenAI provider selected but OPENAI_API_KEY is not configured.")
            result = self._call_openai(image_bytes, mime_type)
        else:
            raise RuntimeError(f"Unsupported AI provider '{self.provider}'.")

        metadata = DocumentMetadata(**result.get("metadata", {}))
        raw_markdown = result.get("transcription_markdown", "")
        markdown = clean_kurdish_ocr_markdown(raw_markdown)
        return markdown, metadata

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
            for model in self._get_active_models():
                try:
                    chat = client.chats.create(model=model)
                    res = chat.send_message(prompt)
                    if res and res.text:
                        return res.text.strip()
                except Exception as e:
                    err_str = str(e)
                    print(f"Failed query with {model}: {err_str[:80]}")
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        _rate_limited_models[model] = time.time() + 600
                    continue

        if is_openai_configured():
            print("Querying OpenAI fallback (gpt-4o-mini)...")
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY.strip())
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            return res.choices[0].message.content.strip()

        return "ببورە، نەتوانرا پەیوەندی بە مۆدێلی ژیریی دەستکردەوە بکرێت بۆ وەڵامدانەوە (سەرجەم هەوڵەکانی Gemini ڕەتکرانەوە و کلیلی OpenAI دیاری نەکراوە)."

vlm_service = VLMService()