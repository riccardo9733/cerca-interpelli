import re
import json
import logging
import httpx
from datetime import datetime
from typing import Dict, Any, List, Optional
from ..config import settings
from ..database import get_db
from .pdf_parser import download_and_extract_pdf_text
from .extractor import extract_metadata
from .geocoder import geocoder

logger = logging.getLogger(__name__)

def parse_attachments_from_html(html: str) -> List[Dict[str, Any]]:
    """
    Estrae link e nomi di file PDF e DOCX dal contenuto HTML dell'articolo WP.
    """
    attachments = []
    matches = re.findall(r'<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>(.*?)</a>', html, re.IGNORECASE)
    for url, text in matches:
        clean_text = re.sub(r'<[^>]+>', '', text).strip()
        lower_url = url.lower()
        if any(lower_url.endswith(ext) or ext in lower_url for ext in [".pdf", ".docx", ".doc", ".p7m"]):
            is_domanda = any(k in clean_text.lower() or k in url.lower() for k in ["allegato", "domanda", "candidatura", "modello"])
            is_bando = not is_domanda and any(k in clean_text.lower() or k in url.lower() for k in ["interpello", "avviso", "bando", "timbro", "segnatura", "signed"])
            attachments.append({
                "name": clean_text or url.split("/")[-1],
                "url": url,
                "is_bando": is_bando,
                "is_domanda": is_domanda,
                "local_path": None
            })
    return attachments

def sync_interpelli() -> Dict[str, Any]:
    """
    Sincronizza gli interpelli interrogando le REST API di WordPress dell'USP Padova.
    Per ogni nuovo post scarica il bando, ne estrae i metadati, geolocalizza l'istituto
    e salva tutto in SQLite.
    """
    logger.info("Avvio sincronizzazione interpelli da WordPress...")
    items_found = 0
    items_new = 0
    items_updated = 0
    error_msg = None

    try:
        headers = {"User-Agent": "CercaInterpelliPadova/1.0"}
        with httpx.Client(timeout=25.0) as client:
            resp = client.get(settings.WP_API_URL, headers=headers)
            if resp.status_code != 200:
                raise Exception(f"HTTP {resp.status_code} da {settings.WP_API_URL}")
            posts = resp.json()

        items_found = len(posts)
        logger.info(f"Trovati {items_found} articoli nella categoria interpelli")

        for p in posts:
            wp_id = p["id"]
            title = p["title"]["rendered"]
            slug = p.get("slug", "")
            wp_date = p["date"]
            wp_modified = p.get("modified", wp_date)
            wp_url = p.get("link", "")
            content_html = p.get("content", {}).get("rendered", "")

            # Controlla se già presente
            with get_db() as conn:
                existing = conn.execute("SELECT wp_id, wp_modified FROM interpelli WHERE wp_id = ?", (wp_id,)).fetchone()
            
            if existing and existing["wp_modified"] == wp_modified:
                continue

            # 1. Estrai allegati
            attachments = parse_attachments_from_html(content_html)
            
            # 2. Scarica e leggi il PDF principale (il bando)
            pdf_text = None
            bando_att = next((a for a in attachments if a["is_bando"]), (attachments[0] if attachments else None))
            if bando_att and bando_att["url"].lower().endswith(".pdf"):
                extracted_text, local_path = download_and_extract_pdf_text(bando_att["url"])
                pdf_text = extracted_text
                bando_att["local_path"] = local_path

            # 3. Estrazione metadati intelligenti
            meta = extract_metadata(title, content_html, pdf_text, wp_date)

            # 4. Risoluzione geolocalizzazione (Coordinate, Indirizzo e Scuola)
            school_target = meta["school_name"] or title
            school_code = meta.get("school_code")
            if meta.get("email_candidatura") and not meta["email_candidatura"].lower().startswith("usp.pd"):
                m_email_code = re.search(r'\b(PD[A-Z0-9]{8})\b', meta["email_candidatura"], re.IGNORECASE)
                if m_email_code:
                    school_code = m_email_code.group(1).upper()

            geo_info = geocoder.resolve_location(
                school_name=school_target,
                school_city=meta["school_city"],
                address_hint=meta["school_address"],
                school_code=school_code
            )

            # 5. Salvataggio su database con transazione breve
            with get_db() as conn:
                conn.execute("""
                    INSERT INTO interpelli (
                        wp_id, title, slug, wp_date, wp_modified, wp_url,
                        school_name, school_code, school_address, school_city, latitude, longitude,
                        classi_concorso, ordine_scuola, tipo_posto, posti_disponibili, ore_settimanali,
                        periodo_desc, periodo_inizio, periodo_fine,
                        scadenza, scadenza_raw, email_candidatura, oggetto_email, link_candidatura,
                        attachments, content_raw, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT(wp_id) DO UPDATE SET
                        title = excluded.title,
                        wp_modified = excluded.wp_modified,
                        school_name = excluded.school_name,
                        school_code = excluded.school_code,
                        school_address = excluded.school_address,
                        school_city = excluded.school_city,
                        latitude = excluded.latitude,
                        longitude = excluded.longitude,
                        classi_concorso = excluded.classi_concorso,
                        ordine_scuola = excluded.ordine_scuola,
                        tipo_posto = excluded.tipo_posto,
                        posti_disponibili = excluded.posti_disponibili,
                        ore_settimanali = excluded.ore_settimanali,
                        periodo_desc = excluded.periodo_desc,
                        periodo_inizio = excluded.periodo_inizio,
                        periodo_fine = excluded.periodo_fine,
                        scadenza = excluded.scadenza,
                        scadenza_raw = excluded.scadenza_raw,
                        email_candidatura = excluded.email_candidatura,
                        oggetto_email = excluded.oggetto_email,
                        link_candidatura = excluded.link_candidatura,
                        attachments = excluded.attachments,
                        content_raw = excluded.content_raw,
                        updated_at = CURRENT_TIMESTAMP
                """, (
                    wp_id, title, slug, wp_date, wp_modified, wp_url,
                    geo_info["school_name"], geo_info["school_code"] or meta["school_code"],
                    geo_info["school_address"], geo_info["school_city"],
                    geo_info["latitude"], geo_info["longitude"],
                    json.dumps(meta["classi_concorso"]), meta["ordine_scuola"], meta["tipo_posto"],
                    meta["posti_disponibili"], meta["ore_settimanali"],
                    meta["periodo_desc"], meta["periodo_inizio"], meta["periodo_fine"],
                    meta["scadenza"], meta["scadenza_raw"],
                    meta["email_candidatura"], meta["oggetto_email"], meta["link_candidatura"],
                    json.dumps(attachments), (pdf_text[:3000] if pdf_text else None)
                ))

            if existing:
                items_updated += 1
            else:
                items_new += 1

        # Log dell'operazione
        with get_db() as conn:
            conn.execute("""
                INSERT INTO sync_logs (status, items_found, items_new, items_updated)
                VALUES ('success', ?, ?, ?)
            """, (items_found, items_new, items_updated))

    except Exception as e:
        logger.error(f"Errore durante sincronizzazione: {e}", exc_info=True)
        error_msg = str(e)
        try:
            with get_db() as conn:
                conn.execute("""
                    INSERT INTO sync_logs (status, items_found, items_new, items_updated, error_message)
                    VALUES ('error', ?, ?, ?, ?)
                """, (items_found, items_new, items_updated, error_msg))
        except Exception:
            pass

    return {
        "success": error_msg is None,
        "items_found": items_found,
        "items_new": items_new,
        "items_updated": items_updated,
        "message": f"Sincronizzazione completata: {items_new} nuovi, {items_updated} aggiornati su {items_found} trovati" if error_msg is None else f"Errore: {error_msg}"
    }
