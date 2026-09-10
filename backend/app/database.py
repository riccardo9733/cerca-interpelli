import sqlite3
import json
from contextlib import contextmanager
from .config import settings

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def get_connection():
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=10000;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.row_factory = dict_factory
    return conn

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS interpelli (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            wp_id INTEGER UNIQUE NOT NULL,
            title TEXT NOT NULL,
            slug TEXT,
            wp_date TEXT NOT NULL,
            wp_modified TEXT,
            wp_url TEXT NOT NULL,
            
            -- Dati Scuola & Geolocalizzazione
            school_name TEXT,
            school_code TEXT,
            school_address TEXT,
            school_city TEXT,
            latitude REAL,
            longitude REAL,
            
            -- Metadati estratti
            classi_concorso TEXT,        -- JSON array es: ["ADEE", "ADMM"]
            ordine_scuola TEXT,          -- Infanzia, Primaria, Secondaria I, Secondaria II
            tipo_posto TEXT,             -- Sostegno, Comune, ecc.
            posti_disponibili INTEGER,   -- Numero posti se menzionato
            ore_settimanali TEXT,        -- es: 24 ore, 18h, spezzone
            periodo_desc TEXT,           -- Descrizione periodo (es: dal 14/09/2026 al 30/06/2027)
            periodo_inizio TEXT,         -- Data inizio ISO (YYYY-MM-DD) se presente
            periodo_fine TEXT,           -- Data fine ISO (YYYY-MM-DD) se presente
            scadenza TEXT,               -- Scadenza perentoria ISO (YYYY-MM-DDTHH:MM:SS)
            scadenza_raw TEXT,           -- Testo grezzo della scadenza
            email_candidatura TEXT,      -- Indirizzo email o PEC a cui inviare
            oggetto_email TEXT,          -- Oggetto obbligatorio per la mail se indicato
            link_candidatura TEXT,       -- Eventuale Google Form / link telematico
            
            -- Allegati & Contenuti
            attachments TEXT,            -- JSON array di {name, url, is_bando, is_domanda, local_path}
            content_raw TEXT,            -- Testo estratto dal PDF
            
            -- Stato utente
            status_candidatura TEXT DEFAULT 'nessuno', -- 'nessuno', 'candidato', 'preferito', 'ignorato'
            notes TEXT,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_interpelli_wp_date ON interpelli(wp_date);
        CREATE INDEX IF NOT EXISTS idx_interpelli_scadenza ON interpelli(scadenza);
        CREATE INDEX IF NOT EXISTS idx_interpelli_status ON interpelli(status_candidatura);

        -- Tabella cache geocoder Nominatim
        CREATE TABLE IF NOT EXISTS geocache (
            query TEXT PRIMARY KEY,
            address TEXT,
            latitude REAL,
            longitude REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Tabella log sincronizzazioni
        CREATE TABLE IF NOT EXISTS sync_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL,
            items_found INTEGER DEFAULT 0,
            items_new INTEGER DEFAULT 0,
            items_updated INTEGER DEFAULT 0,
            error_message TEXT
        );
        """)
