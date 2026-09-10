import os
import re
import hashlib
import logging
import httpx
import pypdf
from typing import Optional, Tuple
from ..config import settings

logger = logging.getLogger(__name__)

def get_file_cache_path(url: str, ext: str = ".pdf") -> str:
    url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()
    filename = f"{url_hash}{ext}"
    return os.path.join(settings.PDF_CACHE_DIR, filename)

def download_and_extract_pdf_text(url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Scarica il file PDF (se non già presente in cache locale)
    ed estrae il testo integrale tramite pypdf.
    Ritorna (testo_estratto, percorso_locale).
    """
    local_path = get_file_cache_path(url, ".pdf")
    
    # Download se non presente in cache
    if not os.path.exists(local_path):
        try:
            logger.info(f"Download PDF da: {url}")
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                response = client.get(url)
                if response.status_code == 200:
                    with open(local_path, "wb") as f:
                        f.write(response.content)
                else:
                    logger.warning(f"Download fallito, status {response.status_code} per {url}")
                    return None, None
        except Exception as e:
            logger.error(f"Errore download PDF {url}: {e}")
            return None, None

    # Estrazione testo con pypdf
    try:
        reader = pypdf.PdfReader(local_path)
        extracted_pages = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text:
                extracted_pages.append(page_text)
        
        full_text = "\n".join(extracted_pages)
        
        # Pulizia testo
        # Unione parole separate da spazi tipo "I S T I T U T O" -> "ISTITUTO"
        cleaned_text = re.sub(r'(\b[A-Za-z0-9])\s+(?=[A-Za-z0-9]\b)', r'\1', full_text)
        return cleaned_text, local_path
    except Exception as e:
        logger.error(f"Errore estrazione testo da {local_path}: {e}")
        return None, local_path
