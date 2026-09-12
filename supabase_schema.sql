-- ===================================================
-- SCHEMA DATABASE SUPABASE PER INTERPELLI SCOLASTICI
-- ===================================================

-- 1. Tabella principale Interpelli
CREATE TABLE IF NOT EXISTS interpelli (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wp_id BIGINT NOT NULL,
    item_key TEXT UNIQUE NOT NULL,             -- Chiave univoca posizione (es: "12345-1", "12345-2")
    position_index INT DEFAULT 1,              -- Indice sequenziale posizione nel bando
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
    
    -- Metadati estratti per la specifica posizione
    classi_concorso JSONB DEFAULT '[]'::jsonb, -- Array di stringhe es: ["ADEE"]
    ordine_scuola TEXT,                         -- Infanzia, Primaria, Secondaria I, Secondaria II
    tipo_posto TEXT,                            -- Sostegno, Comune, ecc.
    posti_disponibili INT,                      -- Numero posti per questa posizione
    ore_settimanali TEXT,                       -- es: 24 ore, 18h, spezzone
    periodo_desc TEXT,                          -- Descrizione periodo
    periodo_inizio DATE,                        -- Data inizio
    periodo_fine DATE,                          -- Data fine
    scadenza TIMESTAMPTZ,                       -- Scadenza perentoria
    scadenza_raw TEXT,                          -- Testo grezzo della scadenza
    email_candidatura TEXT,                     -- Email / PEC
    oggetto_email TEXT,                         -- Oggetto obbligatorio
    link_candidatura TEXT,                      -- Form telematico
    posti_dettaglio JSONB DEFAULT '[]'::jsonb,  -- Dettagli aggiuntivi opzionali
    
    -- Allegati & Contenuti
    attachments JSONB DEFAULT '[]'::jsonb,     -- JSON array di {name, url, is_bando, is_domanda}
    content_raw TEXT,                           -- Testo estratto dal PDF (max ~3000 car)
    
    -- Stato utente
    status_candidatura TEXT DEFAULT 'nessuno',  -- 'nessuno', 'candidato', 'preferito', 'ignorato'
    notes TEXT,

    -- Flag miglioramento AI: se true, sync non sovrascrive i campi estratti
    -- (viene impostato da sync-ai dopo analisi AI riuscita; resettato se wp_modified cambia)
    ai_enhanced BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indici per velocizzare ricerche e filtri
CREATE INDEX IF NOT EXISTS idx_interpelli_wp_date ON interpelli(wp_date DESC);
CREATE INDEX IF NOT EXISTS idx_interpelli_wp_id ON interpelli(wp_id);
CREATE INDEX IF NOT EXISTS idx_interpelli_item_key ON interpelli(item_key);
CREATE INDEX IF NOT EXISTS idx_interpelli_scadenza ON interpelli(scadenza);
CREATE INDEX IF NOT EXISTS idx_interpelli_status ON interpelli(status_candidatura);
CREATE INDEX IF NOT EXISTS idx_interpelli_school_code ON interpelli(school_code);
CREATE INDEX IF NOT EXISTS idx_interpelli_ai_enhanced ON interpelli(ai_enhanced);

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

-- 4. Tabella Stato Sync (singola riga "global")
--    Memorizza la data dell'ultimo sync riuscito per scaricare da WP solo i post nuovi/modificati
CREATE TABLE IF NOT EXISTS sync_state (
    key TEXT PRIMARY KEY DEFAULT 'global',
    last_sync_at TIMESTAMPTZ,                  -- Data ultimo sync riuscito (usata come ?after= in WP API)
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Riga iniziale (se non esiste)
INSERT INTO sync_state (key, last_sync_at)
VALUES ('global', NULL)
ON CONFLICT (key) DO NOTHING;

-- Abilitazione RLS (Row Level Security)
ALTER TABLE interpelli ENABLE ROW LEVEL SECURITY;
ALTER TABLE geocache ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Politiche di accesso pubblico
CREATE POLICY "Accesso completo pubblico interpelli" ON interpelli FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso completo pubblico geocache" ON geocache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso completo pubblico sync_logs" ON sync_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso completo pubblico sync_state" ON sync_state FOR ALL USING (true) WITH CHECK (true);

-- ===================================================
-- MIGRATION (eseguire nel SQL Editor di Supabase se
-- la tabella interpelli esiste già dal setup iniziale)
-- ===================================================
-- ALTER TABLE interpelli ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT false;
-- CREATE INDEX IF NOT EXISTS idx_interpelli_ai_enhanced ON interpelli(ai_enhanced);
--
-- CREATE TABLE IF NOT EXISTS sync_state (
--     key TEXT PRIMARY KEY DEFAULT 'global',
--     last_sync_at TIMESTAMPTZ,
--     updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
-- );
-- INSERT INTO sync_state (key, last_sync_at) VALUES ('global', NULL) ON CONFLICT (key) DO NOTHING;
-- ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Accesso completo pubblico sync_state" ON sync_state FOR ALL USING (true) WITH CHECK (true);

-- 5. Pianificazione Sincronizzazione Automatica su Supabase (pg_cron + pg_net)
-- Esegue la chiamata POST all'Edge Function `sync` ogni 10 min tra le 07:00 e le 21:00 italiane (05:00-19:00 UTC)
-- NOTA: sync-ai NON deve essere schedulata automaticamente — è invocata manualmente per singoli interpelli
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
    'sync-interpelli-10m',
    '*/10 5-19 * * *',
    $$
    SELECT net.http_post(
        url := 'https://oysatbtuiyfupeuezzai.supabase.co/functions/v1/sync',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c2F0YnR1aXlmdXBldWV6emFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjE5MTAsImV4cCI6MjEwNDYzNzkxMH0.tt0CGIDxWXQwmdcEtEnTi3lZurmCgBB03QN-bXCr0Xs", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c2F0YnR1aXlmdXBldWV6emFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjE5MTAsImV4cCI6MjEwNDYzNzkxMH0.tt0CGIDxWXQwmdcEtEnTi3lZurmCgBB03QN-bXCr0Xs"}'::jsonb
    );
    $$
);
