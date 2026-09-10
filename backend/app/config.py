import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Cerca Interpelli Padova"
    DATA_DIR: str = os.getenv("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../../data")))
    DATABASE_PATH: str = ""
    PDF_CACHE_DIR: str = ""
    WP_API_URL: str = "https://padova.istruzioneveneto.gov.it/wp-json/wp/v2/posts?categories=212&per_page=50"
    SYNC_INTERVAL_MINUTES: int = int(os.getenv("SYNC_INTERVAL_MINUTES", "15"))
    AUTO_SYNC_ON_STARTUP: bool = True

    def model_post_init(self, __context):
        os.makedirs(self.DATA_DIR, exist_ok=True)
        if not self.DATABASE_PATH:
            self.DATABASE_PATH = os.path.join(self.DATA_DIR, "interpelli.db")
        if not self.PDF_CACHE_DIR:
            self.PDF_CACHE_DIR = os.path.join(self.DATA_DIR, "pdf_cache")
        os.makedirs(self.PDF_CACHE_DIR, exist_ok=True)

settings = Settings()
