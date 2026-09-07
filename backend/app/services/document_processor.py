import io
from pypdf import PdfReader
from PIL import Image
from typing import List, Tuple

def extract_pdf_page_images(pdf_bytes: bytes) -> List[Tuple[bytes, str]]:
    images = []
    reader = PdfReader(io.BytesIO(pdf_bytes))
    for page in reader.pages:
        for img in page.images:
            images.append((img.data, f"image/{img.name.split('.')[-1].lower()}"))
    return images

def prepare_image(image_bytes: bytes, max_dim: int = 1800) -> Tuple[bytes, str]:
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
    return buf.getvalue(), "image/jpeg"
