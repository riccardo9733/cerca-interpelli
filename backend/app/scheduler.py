import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from .config import settings
from .services.wp_fetcher import sync_interpelli

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def start_scheduler():
    logger.info(f"Avvio scheduler periodico: intervallo {settings.SYNC_INTERVAL_MINUTES} minuti")
    scheduler.add_job(
        sync_interpelli,
        trigger=IntervalTrigger(minutes=settings.SYNC_INTERVAL_MINUTES),
        id="sync_interpelli_job",
        name="Sincronizzazione periodica interpelli USP Padova",
        replace_existing=True,
        max_instances=1
    )
    scheduler.start()

def stop_scheduler():
    logger.info("Arresto scheduler...")
    if scheduler.running:
        scheduler.shutdown()
