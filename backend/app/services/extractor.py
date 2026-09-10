import re
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)

MESI_ITALIANI = {
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
    "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
    "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12
}

def parse_italian_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    date_str = date_str.lower().strip()
    
    # Sostituzione mesi testuali
    for nome_mese, num_mese in MESI_ITALIANI.items():
        if nome_mese in date_str:
            date_str = re.sub(rf'\b{nome_mese}\b', f"{num_mese:02d}", date_str)
            break
            
    try:
        # Standard GG/MM/AAAA o GG-MM-AAAA
        m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', date_str)
        if m:
            day = int(m.group(1))
            month = int(m.group(2))
            year = int(m.group(3))
            if year < 100:
                year += 2000
            
            # Controllo eventuale ora
            time_m = re.search(r'(\d{1,2})[:.](\d{2})', date_str)
            hour = int(time_m.group(1)) if time_m else 23
            minute = int(time_m.group(2)) if time_m else 59
            
            return datetime(year, month, day, hour, minute)
    except Exception as e:
        logger.debug(f"Errore parsing data '{date_str}': {e}")
    return None

def extract_classi_concorso(text: str, title: Optional[str] = None) -> List[str]:
    found = set()
    
    # 1. Classi canoniche maiuscole (ADAA = Sostegno Infanzia, ADEE = Primaria, ADMM = Medie, ADSS = Superiori)
    known_codes = [
        "ADAA", "ADEE", "ADMM", "ADSS", "ADEI", "EEEE", "AAAA", "PPPP"
    ]
    for code in known_codes:
        if re.search(rf'\b{code}\b', text, re.IGNORECASE):
            found.add(code.upper())
            
    # Classi tipo A028, A-28, A012, B015, ecc.
    matches = re.findall(r'\b([AB][\s\-]?[0-9]{2,3})\b', text, re.IGNORECASE)
    for m in matches:
        clean_code = re.sub(r'[\s\-]', '', m).upper()
        # normalizza a A0xx
        if len(clean_code) == 3 and clean_code[1:].isdigit():
            clean_code = f"{clean_code[0]}0{clean_code[1:]}"
        found.add(clean_code)

    if found:
        return sorted(list(found))
        
    # 2. Inferenza da linguaggio naturale: prima nel titolo (privo di intestazioni boilerplate), poi nel testo
    candidates = []
    if title:
        candidates.append(title.lower())
    candidates.append(text.lower())

    for t in candidates:
        if "sostegno" in t:
            if "infanzia" in t or "matern" in t:
                found.add("ADAA")
                break
            elif "primaria" in t or "elementare" in t:
                found.add("ADEE")
                break
            elif "secondaria di primo grado" in t or "medie" in t or "i grado" in t:
                found.add("ADMM")
                break
            elif "secondaria di secondo grado" in t or "superiori" in t or "ii grado" in t:
                found.add("ADSS")
                break
        elif "posto comune" in t or "comune" in t:
            if "infanzia" in t or "matern" in t:
                found.add("AAAA")
                break
            elif "primaria" in t or "elementare" in t:
                found.add("EEEE")
                break
                
    return sorted(list(found))

def extract_scadenza(title: str, body: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Rileva data e ora di scadenza da titolo o testo PDF.
    Ritorna (iso_timestamp, raw_text).
    """
    candidates = []
    
    # Pattern comuni nei bandi scolastici italiani
    patterns = [
        # entro e non oltre le ore 8:00 di Martedì 09/06/2026 / risposte entro ore 11:30 del 11/09/2026
        r'(?:entro|scadenza|rispost[ae]\s+entro)\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+(?:di\s+|del(?: giorno)?\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        # entro il giorno 11/09/2026 ore 11.00 / entro e non oltre il 11/09/2026 ore 12:00
        r'entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+)?(?:giorno\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(?:alle\s+|ore\s+)?(\d{1,2}[:.]\d{2})?',
        # entro le ore 12:00 del 15 settembre 2026
        r'entro\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+del(?: giorno)?\s+(\d{1,2}\s+[a-zA-Z]+\s+\d{4})',
        # scadenza: 11/09/2026 ore 12:00
        r'scadenza(?:\s+candidature)?:\s*(?:ore\s*(\d{1,2}[:.]\d{2}))?\s*(?:del\s+|il\s+)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
    ]
    
    # Prima controlliamo il titolo (spesso molto compatto e attendibile)
    for pat in patterns:
        m = re.search(pat, title, re.IGNORECASE)
        if m:
            raw = m.group(0)
            # Normalizza orario e data
            parsed = parse_italian_date(raw)
            if parsed:
                return parsed.isoformat(), raw

    # Poi cerchiamo nel corpo del PDF
    if body:
        for pat in patterns:
            for m in re.finditer(pat, body, re.IGNORECASE):
                raw = m.group(0)
                parsed = parse_italian_date(raw)
                if parsed:
                    return parsed.isoformat(), raw

    return None, None

def extract_periodo(text: str) -> Dict[str, Any]:
    """
    Estrae le date di supplenza o la descrizione del periodo.
    """
    res = {
        "periodo_desc": None,
        "periodo_inizio": None,
        "periodo_fine": None
    }
    
    # dal GG/MM/AAAA al GG/MM/AAAA
    m_range = re.search(r'dal\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+al\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text, re.IGNORECASE)
    if m_range:
        res["periodo_desc"] = f"Dal {m_range.group(1)} al {m_range.group(2)}"
        d_start = parse_italian_date(m_range.group(1))
        d_end = parse_italian_date(m_range.group(2))
        if d_start:
            res["periodo_inizio"] = d_start.strftime("%Y-%m-%d")
        if d_end:
            res["periodo_fine"] = d_end.strftime("%Y-%m-%d")
        return res

    # fino al 30/06/2027 o fino al 31/08/2027
    m_fino_a = re.search(r'fino\s+al\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text, re.IGNORECASE)
    if m_fino_a:
        res["periodo_desc"] = f"Fino al {m_fino_a.group(1)}"
        d_end = parse_italian_date(m_fino_a.group(1))
        if d_end:
            res["periodo_fine"] = d_end.strftime("%Y-%m-%d")
        return res

    # formule canoniche
    if re.search(r'fino\s+al\s+termine\s+delle\s+attivit[àa]\s+didattiche', text, re.IGNORECASE):
        res["periodo_desc"] = "Fino al termine delle attività didattiche (30 Giugno)"
        return res
    if re.search(r'fino\s+al\s+termine\s+delle\s+lezioni', text, re.IGNORECASE):
        res["periodo_desc"] = "Fino al termine delle lezioni (Giugno)"
        return res
    if re.search(r'supplenz[ae]\s+brev[ie]', text, re.IGNORECASE):
        res["periodo_desc"] = "Supplenza breve temporanea"
        return res

    return res

def extract_school_info(title: str, text: str) -> Dict[str, Any]:
    """
    Estrae nome istituto, comune, codice meccanografico e indirizzo se presente.
    """
    res = {
        "school_name": None,
        "school_code": None,
        "school_city": None,
        "school_address": None
    }
    
    # Codice meccanografico (es. PDIC825002 o PDPS01000T)
    m_code = re.search(r'\b(PD[A-Z0-9]{8})\b', text, re.IGNORECASE)
    if m_code:
        res["school_code"] = m_code.group(1).upper()
        
    # Indirizzo da intestazione (Via Roma, 30 - 35020 Legnaro)
    m_addr = re.search(r'(Via|Viale|Corso|Piazza|Riviera)\s+[^\n\r,\-]+,\s*\d+[^\n\r]*', text, re.IGNORECASE)
    if m_addr:
        res["school_address"] = m_addr.group(0).strip()
        
    # Nome scuola dal titolo (es: "IC di Legnaro e Casalserugo – ...", "VIII IC VOLTA PD – ...")
    parts = re.split(r'\s*[–\-\:]\s*', title)
    if parts:
        candidate = parts[0].strip()
        if any(w in candidate.lower() for w in ["ic", "istituto", "liceo", "iis", "itis", "scuola"]):
            res["school_name"] = candidate
            
    # Comune
    m_city = re.search(r'\b35\d{3}\s+([A-Z\s\']+)\s*\([Pp][Dd]\)', text)
    if m_city:
        res["school_city"] = m_city.group(1).title().strip()

    return res

def extract_email_and_subject(text: str) -> Tuple[Optional[str], Optional[str]]:
    email = None
    subj = None
    
    # Email candidature o PEO scuola
    m_email = re.search(r'([a-zA-Z0-9_.+-]+@(?:istruzione\.it|pec\.istruzione\.it|[a-zA-Z0-9-]+\.edu\.it))', text)
    if m_email:
        email = m_email.group(1)
        
    # Oggetto obbligatorio: es. inserendo come oggetto "interpello prot. 13426 del 10/09/2026"
    m_subj = re.search(r'oggetto\s+[“"«]([^"”»]+)[”"»]', text, re.IGNORECASE)
    if m_subj:
        subj = m_subj.group(1).strip()
        
    return email, subj

def extract_ore_e_posti(text: str, ordine: Optional[str] = None) -> Tuple[Optional[str], Optional[int]]:
    ore = None
    posti = None
    
    # 1. Riconoscimento riga tabellare tipo "ADAA 1 25 16/10/2026"
    m_tab = re.search(r'\b(?:ADAA|ADEE|ADMM|ADSS|AAAA|EEEE|[AB]\d{2,3})\s+(\d+)\s+(\d{1,2})\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', text, re.IGNORECASE)
    if m_tab:
        posti = int(m_tab.group(1))
        ore = f"{m_tab.group(2)} ore settimanali"
        return ore, posti

    # 2. Ore esplicite: 24 ORE, 18 ore settimanali, 25h
    m_ore = re.search(r'\b(\d{1,2})\s*(?:ore|h)\b', text, re.IGNORECASE)
    if m_ore:
        ore = f"{m_ore.group(1)} ore settimanali"
    elif "cattedra intera" in text.lower() or "posto intero" in text.lower():
        if ordine == "Infanzia":
            ore = "25 ore settimanali"
        elif ordine == "Primaria":
            ore = "24 ore settimanali"
        elif ordine in ["Secondaria I grado", "Secondaria II grado"]:
            ore = "18 ore settimanali"
        else:
            ore = "Cattedra intera"
    elif "spezzone" in text.lower():
        ore = "Spezzone orario"
        
    # 3. Posti: 15 POSTI, 8 posti sostegno, 1 posto
    m_posti = re.search(r'(?:n[°\.]?\s*)?(\d+)\s+posti\b', text, re.IGNORECASE)
    if m_posti:
        posti = int(m_posti.group(1))
    elif re.search(r'\b1\s+posto\b|un\s+posto\b|posto\s+intero\b', text, re.IGNORECASE):
        posti = 1
        
    return ore, posti

def extract_metadata(title: str, html_content: str, pdf_text: Optional[str], wp_date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    Combina titolo, contenuto HTML dell'articolo e testo PDF per estrarre
    tutti i metadati strutturati dell'interpello.
    Include sanitizzazione automatica dei refusi tipici delle segreterie scolastiche
    (es. 30/06/2026 invece di 2027 per l'anno scolastico 2026/27, o scadenze con l'anno precedente).
    """
    full_text = f"{title}\n{html_content}\n{pdf_text or ''}"
    
    # 1. Classi di concorso
    classi = extract_classi_concorso(full_text, title=title)
    
    # 2. Scadenza
    scadenza_iso, scadenza_raw = extract_scadenza(title, pdf_text or full_text)
    
    # Auto-correzione refuso anno scadenza (es. segreteria copia-incolla '2025' invece di '2026')
    if scadenza_iso and wp_date_str:
        try:
            scad_dt = datetime.fromisoformat(scadenza_iso)
            wp_dt = datetime.fromisoformat(wp_date_str)
            if scad_dt.year < wp_dt.year:
                fixed_scad_dt = scad_dt.replace(year=wp_dt.year)
                scadenza_iso = fixed_scad_dt.isoformat()
                logger.info(f"Corretto anno scadenza da {scad_dt.year} a {wp_dt.year} per refuso bando")
        except Exception as e:
            logger.debug(f"Errore auto-correzione anno scadenza: {e}")

    # 3. Periodo
    periodo_info = extract_periodo(pdf_text or full_text)

    # Auto-correzione refuso anno fine supplenza
    # Spesso nel titolo è scritto corretto (es: 'fino al 30/06/2027') mentre nel testo PDF hanno scritto '2026'
    m_title_fine = re.search(r'fino\s+al\s+(\d{1,2}[/-]\d{1,2}[/-](\d{4}))', title, re.IGNORECASE)
    if m_title_fine:
        d_title_end = parse_italian_date(m_title_fine.group(1))
        if d_title_end:
            periodo_info["periodo_desc"] = f"Fino al {m_title_fine.group(1)}"
            periodo_info["periodo_fine"] = d_title_end.strftime("%Y-%m-%d")

    # Se la supplenza inizia a settembre e termina a giugno con lo stesso anno solare (es: dal 14/09/2026 al 30/06/2026)
    # oppure se l'interpello è pubblicato a settembre 2026 e dice 'fino al 30/06/2026', è un refuso per 2027!
    if periodo_info["periodo_fine"] and wp_date_str:
        try:
            wp_dt = datetime.fromisoformat(wp_date_str)
            d_end = datetime.strptime(periodo_info["periodo_fine"], "%Y-%m-%d").date()
            
            needs_year_increment = False
            if periodo_info["periodo_inizio"]:
                d_start = datetime.strptime(periodo_info["periodo_inizio"], "%Y-%m-%d").date()
                if d_end <= d_start and d_end.month < d_start.month:
                    needs_year_increment = True
            elif wp_dt.month >= 8 and d_end.month <= 7 and d_end.year == wp_dt.year:
                needs_year_increment = True

            if needs_year_increment:
                fixed_year = wp_dt.year + 1
                d_end = d_end.replace(year=fixed_year)
                periodo_info["periodo_fine"] = d_end.strftime("%Y-%m-%d")
                if periodo_info["periodo_desc"]:
                    periodo_info["periodo_desc"] = re.sub(
                        r'(\bal\s+\d{1,2}[/-]\d{1,2}[/-])\d{4}',
                        rf'\g<1>{fixed_year}',
                        periodo_info["periodo_desc"],
                        flags=re.IGNORECASE
                    )
                logger.info(f"Corretto anno fine supplenza al {fixed_year} (a.s. {wp_dt.year}/{fixed_year})")
        except Exception as e:
            logger.debug(f"Errore auto-correzione fine periodo: {e}")
    
    # 4. Scuola & Sede
    school_info = extract_school_info(title, pdf_text or full_text)
    
    # 5. Ordine scuola
    ordine = "Altro"
    lt_title = title.lower()
    lt = full_text.lower()
    if any(c in classi for c in ["ADAA", "AAAA"]) or "infanzia" in lt_title or "matern" in lt_title:
        ordine = "Infanzia"
    elif any(c in classi for c in ["ADEE", "EEEE"]) or "primaria" in lt_title or "elementar" in lt_title:
        ordine = "Primaria"
    elif any(c in classi for c in ["ADMM"]) or "secondaria di primo grado" in lt_title or "medie" in lt_title:
        ordine = "Secondaria I grado"
    elif any(c in classi for c in ["ADSS"]) or "secondaria di secondo grado" in lt_title or "superiori" in lt_title:
        ordine = "Secondaria II grado"
    elif "infanzia" in lt or "matern" in lt:
        ordine = "Infanzia"
    elif "primaria" in lt or "elementar" in lt:
        ordine = "Primaria"
    elif "secondaria di primo grado" in lt or "medie" in lt:
        ordine = "Secondaria I grado"
    elif "secondaria di secondo grado" in lt or "superiori" in lt:
        ordine = "Secondaria II grado"

    # 6. Ore e posti
    ore, posti = extract_ore_e_posti(pdf_text or full_text, ordine=ordine)
    
    # 7. Email e Oggetto
    email, oggetto_email = extract_email_and_subject(pdf_text or full_text)

    # 8. Tipo posto
    tipo_posto = "Sostegno" if ("sostegno" in lt or any("AD" in c for c in classi)) else "Posto Comune"

    # 9. Link form candidatura (Google Forms, modulistica online)
    link_candidatura = None
    m_form = re.search(r'https?://(?:forms\.gle|docs\.google\.com/forms)[^\s"\'<>]+', full_text)
    if m_form:
        link_candidatura = m_form.group(0)

    return {
        "classi_concorso": classi,
        "scadenza": scadenza_iso,
        "scadenza_raw": scadenza_raw,
        "periodo_desc": periodo_info["periodo_desc"],
        "periodo_inizio": periodo_info["periodo_inizio"],
        "periodo_fine": periodo_info["periodo_fine"],
        "school_name": school_info["school_name"],
        "school_code": school_info["school_code"],
        "school_city": school_info["school_city"],
        "school_address": school_info["school_address"],
        "ore_settimanali": ore,
        "posti_disponibili": posti,
        "email_candidatura": email,
        "oggetto_email": oggetto_email,
        "link_candidatura": link_candidatura,
        "ordine_scuola": ordine,
        "tipo_posto": tipo_posto
    }
