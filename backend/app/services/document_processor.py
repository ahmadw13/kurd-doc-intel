import io
import pypdfium2 as pdfium
from PIL import Image
from typing import List, Tuple

def extract_pdf_page_images(pdf_path: str, scale: float = 2.0) -> List[Tuple[bytes, str]]:
    """Renders each page of a PDF into high-res JPEG image bytes suitable for VLM parsing."""
    pdf = pdfium.PdfDocument(pdf_path)
    page_images = []
    
    for page_index in range(len(pdf)):
        page = pdf[page_index]
        # Render page at 2x resolution for crisp text recognition
        pil_image = page.render(scale=scale).to_pil()
        
        if pil_image.mode not in ("RGB", "L"):
            pil_image = pil_image.convert("RGB")
            
        buf = io.BytesIO()
        pil_image.save(buf, format="JPEG", quality=90)
        page_images.append((buf.getvalue(), "image/jpeg"))
        
    return page_images

def prepare_image(image_path: str, max_dim: int = 2000) -> List[Tuple[bytes, str]]:
    """Cleans, converts and standardizes standalone image files. Returns a list for uniform iteration."""
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    img = Image.open(io.BytesIO(image_bytes))
    
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
        
    w, h = img.size
    if max(w, h) > max_dim:
        scale = max_dim / float(max(w, h))
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return [(buf.getvalue(), "image/jpeg")]