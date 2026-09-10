import logging
import zoneinfo
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.combining import OrTrigger
from .config import settings
from .services.wp_fetcher import sync_interpelli

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

def is_within_active_hours() -> bool:
    """Verifica se l'orario attuale rientra nella finestra di sincronizzazione consentita (es. 07:00 - 21:00)"""
    try:
        tz = zoneinfo.ZoneInfo(settings.SYNC_TIMEZONE)
        now = datetime.now(tz)
    except Exception:
        now = datetime.now()
    
    current_minutes = now.hour * 60 + now.minute
    start_minutes = settings.SYNC_START_HOUR * 60
    end_minutes = settings.SYNC_END_HOUR * 60
    return start_minutes <= current_minutes <= end_minutes

def get_sync_trigger():
    """
    Costruisce il trigger per sincronizzare ogni N minuti durante le ore attive.
    Esempio per intervallo 30m e ore 7-21:
    - Esegue alle :00 e :30 dalle 07:00 fino alle 20:30
    - Ultima esecuzione della sera alle 21:00 esatte
    - Silenzioso tra le 21:01 e le 06:59
    """
    try:
        tz = zoneinfo.ZoneInfo(settings.SYNC_TIMEZONE)
    except Exception:
        tz = None

    step = max(1, min(60, settings.SYNC_INTERVAL_MINUTES))
    minutes_list = [str(m) for m in range(0, 60, step)]
    minutes_str = ",".join(minutes_list)

    start_h = settings.SYNC_START_HOUR
    end_h = settings.SYNC_END_HOUR

    if end_h > start_h:
        t1 = CronTrigger(hour=f"{start_h}-{end_h - 1}", minute=minutes_str, timezone=tz)
        t2 = CronTrigger(hour=str(end_h), minute="0", timezone=tz)
        return OrTrigger([t1, t2])
    else:
        return CronTrigger(hour=str(start_h), minute=minutes_str, timezone=tz)

def start_scheduler():
    trigger = get_sync_trigger()
    logger.info(
        f"Avvio scheduler periodico: attivo dalle {settings.SYNC_START_HOUR}:00 alle "
        f"{settings.SYNC_END_HOUR}:00 ogni {settings.SYNC_INTERVAL_MINUTES} min (fuso {settings.SYNC_TIMEZONE})"
    )
    scheduler.add_job(
        sync_interpelli,
        trigger=trigger,
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

