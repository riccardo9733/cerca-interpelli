from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AttachmentItem(BaseModel):
    name: str
    url: str
    is_bando: bool = False
    is_domanda: bool = False
    local_path: Optional[str] = None

class InterpelloBase(BaseModel):
    wp_id: int
    title: str
    slug: Optional[str] = None
    wp_date: str
    wp_modified: Optional[str] = None
    wp_url: str
    
    school_name: Optional[str] = None
    school_code: Optional[str] = None
    school_address: Optional[str] = None
    school_city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    classi_concorso: List[str] = []
    ordine_scuola: Optional[str] = None
    tipo_posto: Optional[str] = None
    posti_disponibili: Optional[int] = None
    ore_settimanali: Optional[str] = None
    periodo_desc: Optional[str] = None
    periodo_inizio: Optional[str] = None
    periodo_fine: Optional[str] = None
    scadenza: Optional[str] = None
    scadenza_raw: Optional[str] = None
    email_candidatura: Optional[str] = None
    oggetto_email: Optional[str] = None
    link_candidatura: Optional[str] = None
    
    attachments: List[AttachmentItem] = []
    content_raw: Optional[str] = None
    status_candidatura: str = "nessuno"
    notes: Optional[str] = None

class InterpelloResponse(InterpelloBase):
    id: int
    created_at: str
    updated_at: str
    is_expired: bool = False
    time_remaining_seconds: Optional[int] = None
    has_date_anomaly: bool = False
    date_anomaly_desc: Optional[str] = None

class UpdateStatusRequest(BaseModel):
    status_candidatura: str = Field(..., pattern="^(nessuno|candidato|preferito|ignorato)$")
    notes: Optional[str] = None

class StatsResponse(BaseModel):
    total_interpelli: int
    active_interpelli: int
    expiring_soon: int # scade nelle prossime 24h
    candidati: int
    preferiti: int
    last_sync: Optional[str] = None
    last_sync_status: Optional[str] = None

class SyncResult(BaseModel):
    success: bool
    items_found: int
    items_new: int
    items_updated: int
    message: str
