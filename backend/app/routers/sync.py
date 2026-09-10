from fastapi import APIRouter, BackgroundTasks
from ..services.wp_fetcher import sync_interpelli
from ..schemas import SyncResult
from ..database import get_db

router = APIRouter(prefix="/api/sync", tags=["sync"])

@router.post("", response_model=SyncResult)
def trigger_sync():
    """Esegue una sincronizzazione immediata con l'UAT di Padova"""
    res = sync_interpelli()
    return SyncResult(**res)

@router.get("/logs")
def get_sync_logs(limit: int = 10):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM sync_logs ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return rows
