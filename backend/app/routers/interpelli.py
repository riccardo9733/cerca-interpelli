import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..schemas import InterpelloResponse, UpdateStatusRequest, StatsResponse
from ..services.geocoder import geocoder

router = APIRouter(prefix="/api", tags=["interpelli"])


def row_to_interpello_response(row: dict) -> dict:
    item = dict(row)
    # Parse json fields
    item["classi_concorso"] = json.loads(item["classi_concorso"]) if item.get("classi_concorso") else []
    item["attachments"] = json.loads(item["attachments"]) if item.get("attachments") else []
    
    # Calcolo scadenza e tempo residuo
    now = datetime.now()
    today_date = now.strftime("%Y-%m-%d")
    is_expired = False
    time_remaining_seconds = None
    has_date_anomaly = False
    date_anomaly_desc = None

    wp_dt = None
    try:
        wp_dt = datetime.fromisoformat(item["wp_date"])
    except Exception:
        pass

    wp_date_only = wp_dt.strftime("%Y-%m-%d") if wp_dt else None
    
    # Rilevamento Anomalie nel testo originale della scuola
    raw_content = f"{item.get('title', '')} {item.get('content_raw', '')}"
    is_recent_post = wp_dt and (now - wp_dt).total_seconds() <= 14 * 86400

    # Condizione richiesta: se la data di pubblicazione è più recente della data di conclusione servizio
    pub_is_more_recent_than_fine = False
    if wp_date_only and item.get("periodo_fine") and wp_date_only > item["periodo_fine"]:
        pub_is_more_recent_than_fine = True
        has_date_anomaly = True
        date_anomaly_desc = f"Data di pubblicazione ({wp_date_only}) più recente della conclusione servizio indicata ({item['periodo_fine']}): probabile refuso della scuola per l'anno successivo. Bando considerato attivo."

    if is_recent_post:
        # Caso A: La scuola ha scritto '30/06/2026' o simile per un bando pubblicato a settembre 2026
        if "30/06/2026" in raw_content and wp_dt.month >= 8:
            has_date_anomaly = True
            if not date_anomaly_desc:
                date_anomaly_desc = "La scuola ha indicato nel testo '30/06/2026' come termine supplenza (data precedente alla pubblicazione). È un probabile refuso per l'a.s. 2026/2027: bando attivo."
        # Caso B: Scadenza con l'anno precedente
        elif item.get("scadenza_raw") and "2025" in item["scadenza_raw"]:
            has_date_anomaly = True
            if not date_anomaly_desc:
                date_anomaly_desc = f"Nel testo la scadenza è indicata con anno precedente ('{item['scadenza_raw']}'): normalizzato all'anno corrente per bando recente."
        # Caso C: Periodo fine originario precedente a data pubblicazione
        elif item.get("periodo_fine") and wp_date_only and item["periodo_fine"] < wp_date_only:
            has_date_anomaly = True
            if not date_anomaly_desc:
                date_anomaly_desc = "Data di termine indicata precedente alla pubblicazione dell'avviso. Probabile refuso della scuola: bando considerato attivo."

    if item.get("scadenza"):
        try:
            exp = datetime.fromisoformat(item["scadenza"])
            diff = (exp - now).total_seconds()
            time_remaining_seconds = int(diff)
            
            # Se la scadenza è precedente alla data di pubblicazione, è un refuso evidente
            if wp_dt and exp < wp_dt:
                has_date_anomaly = True
                is_expired = False
                if not date_anomaly_desc:
                    date_anomaly_desc = "Data di scadenza indicata nel bando precedente alla pubblicazione (refuso della scuola): bando considerato attivo."
            elif pub_is_more_recent_than_fine or (has_date_anomaly and is_recent_post and diff <= 0):
                # Se c'è un'incongruenza di date (es. data di fine servizio nel passato rispetto alla pubblicazione)
                # il bando va COMUNQUE considerato attivo!
                is_expired = False
            else:
                is_expired = diff <= 0
        except Exception:
            pass
    else:
        # Se non c'è una data/ora di scadenza esplicita:
        if item.get("periodo_fine") and item["periodo_fine"] < today_date:
            # Se la pubblicazione è più recente della fine servizio o è recente, refuso scuola -> MANTIENI ATTIVO con ?
            if pub_is_more_recent_than_fine or is_recent_post:
                has_date_anomaly = True
                is_expired = False
                if not date_anomaly_desc:
                    date_anomaly_desc = "Data di conclusione servizio antecedente alla pubblicazione (refuso della scuola): bando considerato attivo."
            else:
                is_expired = True
        else:
            # Se l'avviso è stato pubblicato oltre 7 giorni fa senza scadenza futura -> SCADUTO
            if wp_dt and (now - wp_dt).total_seconds() > 7 * 86400:
                is_expired = True

    # REGOLA GENERALE ASSOLUTA: se la pubblicazione è più recente della fine del servizio, il bando È ATTIVO con "?"
    if pub_is_more_recent_than_fine:
        is_expired = False
        has_date_anomaly = True

    item["is_expired"] = is_expired
    item["time_remaining_seconds"] = time_remaining_seconds
    item["has_date_anomaly"] = has_date_anomaly
    item["date_anomaly_desc"] = date_anomaly_desc
    return item

@router.get("/interpelli", response_model=List[InterpelloResponse])
def get_interpelli(
    search: Optional[str] = Query(None, description="Testo di ricerca"),
    classe: Optional[str] = Query(None, description="Classe di concorso"),
    ordine: Optional[str] = Query(None, description="Ordine di scuola"),
    ore: Optional[str] = Query(None, description="Filtro ore settimanali (es. 'intera', 'spezzone', o numero '24')"),
    status: Optional[str] = Query(None, description="Filtro stato candidatura"),
    only_active: bool = Query(False, description="Escludi bandi già scaduti"),
    sort: str = Query("date_desc", description="Ordinamento: date_desc, scadenza_asc, school_asc")
):
    with get_db() as conn:
        conditions = []
        params = []

        if search:
            s = f"%{search}%"
            conditions.append("(title LIKE ? OR school_name LIKE ? OR school_city LIKE ? OR content_raw LIKE ?)")
            params.extend([s, s, s, s])

        if classe:
            c = f'%"{classe}"%'
            conditions.append("classi_concorso LIKE ?")
            params.append(c)

        if ordine and ordine != "tutti":
            if ordine == "Altro":
                conditions.append("(ordine_scuola = 'Altro' OR ordine_scuola IS NULL)")
            else:
                # Include sia l'ordine selezionato sia eventuali bandi non riconosciuti ('Altro' o NULL)
                # per garantire che nessun interpello con refusi o errori di estrazione venga nascosto
                conditions.append("(ordine_scuola = ? OR ordine_scuola = 'Altro' OR ordine_scuola IS NULL)")
                params.append(ordine)

        if ore and ore != "tutte":
            if ore == "non_specificate":
                conditions.append("(ore_settimanali IS NULL OR ore_settimanali = '' OR ore_settimanali LIKE '%da definire%')")
            elif ore == "intera":
                conditions.append("(CAST(ore_settimanali AS INTEGER) >= 18 OR ore_settimanali LIKE '%cattedra intera%' OR ore_settimanali LIKE '%posto intero%')")
            elif ore == "spezzone":
                conditions.append("((CAST(ore_settimanali AS INTEGER) > 0 AND CAST(ore_settimanali AS INTEGER) < 18) OR ore_settimanali LIKE '%spezzone%')")
            elif ore.isdigit():
                conditions.append("CAST(ore_settimanali AS INTEGER) = ?")
                params.append(int(ore))

        if status and status != "tutti":
            conditions.append("status_candidatura = ?")
            params.append(status)

        if only_active:
            now_iso = datetime.now().isoformat()
            recent_post_iso = datetime.fromtimestamp(datetime.now().timestamp() - 14 * 86400).isoformat()
            # Include bandi con scadenza futura, oppure pubblicati di recente (ultimi 14 giorni),
            # oppure dove la data di pubblicazione è più recente del termine servizio (evidente refuso della scuola).
            conditions.append("""(
                (scadenza IS NOT NULL AND scadenza >= ?)
                OR
                (periodo_fine IS NOT NULL AND wp_date > periodo_fine)
                OR
                wp_date >= ?
            )""")
            params.extend([now_iso, recent_post_iso])

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        # Ordinamento
        order_clause = "ORDER BY wp_date DESC"
        if sort == "scadenza_asc":
            order_clause = "ORDER BY CASE WHEN scadenza IS NULL THEN 1 ELSE 0 END, scadenza ASC, wp_date DESC"
        elif sort == "school_asc":
            order_clause = "ORDER BY school_name ASC"

        query = f"SELECT * FROM interpelli {where_clause} {order_clause}"
        rows = conn.execute(query, params).fetchall()

        results = [row_to_interpello_response(r) for r in rows]
        if only_active:
            results = [r for r in results if not r["is_expired"]]
        return results

@router.get("/classi", response_model=List[str])
def get_available_classi():
    """Ritorna tutte le classi di concorso presenti nel database"""
    with get_db() as conn:
        rows = conn.execute("SELECT classi_concorso FROM interpelli WHERE classi_concorso IS NOT NULL").fetchall()
        classes = set()
        for r in rows:
            try:
                arr = json.loads(r["classi_concorso"])
                classes.update(arr)
            except Exception:
                pass
        return sorted(list(classes))

@router.get("/ore", response_model=List[int])
def get_available_ore():
    """Ritorna le ore settimanali distinte presenti nel database in ordine decrescente, garantendo la presenza delle ore canoniche scolastiche (25, 24, 18)"""
    standard_hours = {25, 24, 18}
    with get_db() as conn:
        rows = conn.execute("""
            SELECT DISTINCT CAST(ore_settimanali AS INTEGER) as ore_val 
            FROM interpelli 
            WHERE ore_settimanali IS NOT NULL AND CAST(ore_settimanali AS INTEGER) > 0
            ORDER BY ore_val DESC
        """).fetchall()
        db_hours = {r["ore_val"] for r in rows if r["ore_val"]}
        all_hours = standard_hours.union(db_hours)
        return sorted(list(all_hours), reverse=True)

@router.get("/stats", response_model=StatsResponse)
def get_stats():
    now_iso = datetime.now().isoformat()
    now = datetime.now()
    today_date = now.strftime("%Y-%m-%d")
    seven_days_ago_iso = datetime.fromtimestamp(now.timestamp() - 7 * 86400).isoformat()
    soon_24h = datetime.fromtimestamp(now.timestamp() + 86400).isoformat()

    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) as count FROM interpelli").fetchone()["count"]
        
        active = conn.execute("""
            SELECT COUNT(*) as count FROM interpelli 
            WHERE (
                (scadenza IS NOT NULL AND scadenza >= ?)
                OR
                (scadenza IS NULL AND (periodo_fine IS NULL OR periodo_fine >= ?) AND wp_date >= ?)
            )
        """, (now_iso, today_date, seven_days_ago_iso)).fetchone()["count"]

        expiring = conn.execute(
            "SELECT COUNT(*) as count FROM interpelli WHERE scadenza IS NOT NULL AND scadenza >= ? AND scadenza <= ?",
            (now_iso, soon_24h)
        ).fetchone()["count"]

        candidati = conn.execute(
            "SELECT COUNT(*) as count FROM interpelli WHERE status_candidatura = 'candidato'"
        ).fetchone()["count"]

        preferiti = conn.execute(
            "SELECT COUNT(*) as count FROM interpelli WHERE status_candidatura = 'preferito'"
        ).fetchone()["count"]

        last_sync_log = conn.execute(
            "SELECT timestamp, status FROM sync_logs ORDER BY id DESC LIMIT 1"
        ).fetchone()

        return StatsResponse(
            total_interpelli=total,
            active_interpelli=active,
            expiring_soon=expiring,
            candidati=candidati,
            preferiti=preferiti,
            last_sync=last_sync_log["timestamp"] if last_sync_log else None,
            last_sync_status=last_sync_log["status"] if last_sync_log else None
        )

@router.get("/interpelli/{interpello_id}", response_model=InterpelloResponse)
def get_interpello(interpello_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM interpelli WHERE id = ?", (interpello_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Interpello non trovato")
        return row_to_interpello_response(row)

@router.patch("/interpelli/{interpello_id}/status", response_model=InterpelloResponse)
def update_interpello_status(interpello_id: int, req: UpdateStatusRequest):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM interpelli WHERE id = ?", (interpello_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Interpello non trovato")

        conn.execute("""
            UPDATE interpelli 
            SET status_candidatura = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (req.status_candidatura, req.notes, interpello_id))

        updated = conn.execute("SELECT * FROM interpelli WHERE id = ?", (interpello_id,)).fetchone()
        return row_to_interpello_response(updated)

@router.get("/geocode")
def geocode_address(q: str = Query(..., description="Indirizzo, via o comune da geocodificare")):
    res = geocoder.geocode_user_query(q)
    if not res:
        raise HTTPException(status_code=404, detail=f"Indirizzo non trovato: '{q}'")
    return res

