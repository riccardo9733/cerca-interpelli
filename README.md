# Cerca Interpelli Padova (Self-Hosted)

Applicazione web self-hosted per il monitoraggio continuo, l'estrazione intelligente dei metadati da PDF e la visualizzazione su mappa interattiva degli interpelli scolastici dell'Ufficio Scolastico Territoriale di Padova (`padova.istruzioneveneto.gov.it`).

---

## Caratteristiche Principali

- **Sincronizzazione Automatica & Intelligente**: Interroga periodicamente le REST API di WordPress dell'USP Padova (`/wp-json/wp/v2/posts?categories=212`) deduplicando i post.
- **Estrazione Metadati da PDF**: Scarica e analizza i bandi PDF ufficiali estraendo:
  - **Data e ora esatta di scadenza** (es. *entro le ore 11:30 del giorno 11/09/2026*) con countdown dinamico colorato.
  - **Periodo di supplenza** (es. *dal 14/09/2026 al 30/06/2027* o *supplenza breve*).
  - **Classe di concorso** (ADEE, ADMM, ADSS, EEEE, A028, A012, ecc.).
  - **Ore settimanali e numero posti**.
  - **Email/PEC della scuola e Oggetto obbligatorio** per la candidatura.
- **Geolocalizzazione Garantita & Mappa Interattiva**:
  - Anagrafe completa georeferenziata delle scuole e degli istituti comprensivi della Provincia di Padova con coordinate GPS ufficiali, indirizzo civico e codice meccanografico.
  - Mappa OpenStreetMap con Leaflet, pin interattivi e popup con accesso rapido alla candidatura.
- **Gestione Personale Candidature**:
  - Segna un interpello come *"Candidatura inviata"* o *"Salva nei preferiti"*.
  - Aggiungi note personali private salvate nel database SQLite.
- **Zero Manutenzione**:
  - Database locale SQLite (WAL mode) con persistenza automatica su volume Docker.

---

## Come Avviare con Docker Compose (Raccomandato per il PC Always-On)

Basta clonare la repo ed eseguire il comando nella root del progetto:

```bash
docker compose up -d --build
```

I servizi avviati saranno:
- **Backend FastAPI**: `http://localhost:8000` (API REST, documentazione OpenAPI su `/docs`)
- **Frontend Next.js**: `http://localhost:3000` (Dashboard reattiva)
- **Cartella Dati Persistenti**: `./data` conterrà il database `interpelli.db` e la cache locale dei PDF.

Per fermare i container:
```bash
docker compose down
```

---

## Come Eseguire in Locale Senza Docker (Sviluppo)

### 1. Backend (Python 3.12+)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Apri il browser su `http://localhost:3000`.

---

## Configurazione Parametri (.env o docker-compose.yml)

Nel file `docker-compose.yml` è possibile personalizzare:
- `SYNC_INTERVAL_MINUTES`: Intervallo di aggiornamento automatico in minuti (predefinito: `30`).
- `SYNC_START_HOUR`: Ora di inizio monitoraggio (predefinito: `7` - ore 07:00).
- `SYNC_END_HOUR`: Ora di fine monitoraggio (predefinito: `21` - ore 21:00; fermo tra le 21:01 e le 06:59).
- `AUTO_SYNC_ON_STARTUP`: Se eseguire una sincronizzazione all'avvio del container (predefinito: `true`, salta la chiamata notturna se il DB ha già dati).
- `NEXT_PUBLIC_API_URL`: Indirizzo del backend accessibile dal client (predefinito: `http://localhost:8000`). Se accedi da altri dispositivi nella tua rete locale (es. smartphone), imposta l'IP del tuo PC (es: `http://192.168.1.100:8000`).
