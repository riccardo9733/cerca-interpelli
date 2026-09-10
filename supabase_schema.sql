-- ===================================================
-- SCHEMA DATABASE SUPABASE PER INTERPELLI SCOLASTICI
-- ===================================================

-- 1. Tabella principale Interpelli
CREATE TABLE IF NOT EXISTS interpelli (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wp_id BIGINT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    slug TEXT,
    wp_date TIMESTAMPTZ NOT NULL,
    wp_modified TIMESTAMPTZ,
    wp_url TEXT NOT NULL,
    
    -- Dati Scuola & Geolocalizzazione
    school_name TEXT,
    school_code TEXT,
    school_address TEXT,
    school_city TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- Metadati estratti
    classi_concorso JSONB DEFAULT '[]'::jsonb, -- Array di stringhe es: ["ADEE", "ADMM"]
    ordine_scuola TEXT,                         -- Infanzia, Primaria, Secondaria I, Secondaria II
    tipo_posto TEXT,                            -- Sostegno, Comune, ecc.
    posti_disponibili INT,                      -- Numero posti
    ore_settimanali TEXT,                       -- es: 24 ore, 18h, spezzone
    periodo_desc TEXT,                          -- Descrizione periodo (es: dal 14/09/2026 al 30/06/2027)
    periodo_inizio DATE,                        -- Data inizio
    periodo_fine DATE,                          -- Data fine
    scadenza TIMESTAMPTZ,                       -- Scadenza perentoria
    scadenza_raw TEXT,                          -- Testo grezzo della scadenza
    email_candidatura TEXT,                     -- Email / PEC
    oggetto_email TEXT,                         -- Oggetto obbligatorio
    link_candidatura TEXT,                      -- Form telematico
    
    -- Allegati & Contenuti
    attachments JSONB DEFAULT '[]'::jsonb,     -- JSON array di {name, url, is_bando, is_domanda}
    content_raw TEXT,                           -- Testo estratto dal PDF (max ~3000 car)
    
    -- Stato utente
    status_candidatura TEXT DEFAULT 'nessuno',  -- 'nessuno', 'candidato', 'preferito', 'ignorato'
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indici per velocizzare ricerche e filtri
CREATE INDEX IF NOT EXISTS idx_interpelli_wp_date ON interpelli(wp_date DESC);
CREATE INDEX IF NOT EXISTS idx_interpelli_scadenza ON interpelli(scadenza);
CREATE INDEX IF NOT EXISTS idx_interpelli_status ON interpelli(status_candidatura);
CREATE INDEX IF NOT EXISTS idx_interpelli_school_code ON interpelli(school_code);

-- 2. Tabella Cache Geocoder (Nominatim)
CREATE TABLE IF NOT EXISTS geocache (
    query TEXT PRIMARY KEY,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabella Log Sincronizzazioni
CREATE TABLE IF NOT EXISTS sync_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    items_found INT DEFAULT 0,
    items_new INT DEFAULT 0,
    items_updated INT DEFAULT 0,
    error_message TEXT
);

-- Abilitazione RLS (Row Level Security) per sicurezza (accesso pubblico in sola lettura / service role per scrittura)
ALTER TABLE interpelli ENABLE ROW LEVEL SECURITY;
ALTER TABLE geocache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Politiche di lettura/scrittura pubblica (modificabili in seguito con Auth)
CREATE POLICY "Accesso completo pubblico interpelli" ON interpelli FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso completo pubblico geocache" ON geocache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso completo pubblico sync_logs" ON sync_logs FOR ALL USING (true) WITH CHECK (true);
