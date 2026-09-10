import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import init_db
from .scheduler import start_scheduler, stop_scheduler
from .routers import interpelli, sync
from .services.wp_fetcher import sync_interpelli

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inizializzazione DB
    logger.info("Inizializzazione database SQLite...")
    init_db()
    
    # Avvio sync iniziale se configurato
    if settings.AUTO_SYNC_ON_STARTUP:
        try:
            logger.info("Esecuzione sincronizzazione iniziale...")
            sync_interpelli()
        except Exception as e:
            logger.error(f"Errore durante sync iniziale: {e}")

    # Avvio APScheduler
    start_scheduler()
    
    yield
    
    # Shutdown
    stop_scheduler()

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend per monitoraggio, estrazione dati da PDF e visualizzazione su mappa degli interpelli scolastici di Padova",
    lifespan=lifespan
)

# Configurazione CORS per Next.js e frontend locale
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusione router
app.include_router(interpelli.router)
app.include_router(sync.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": settings.APP_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
