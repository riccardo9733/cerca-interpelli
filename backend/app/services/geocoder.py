import os
import json
import logging
import re
import urllib.parse
import httpx
from typing import Optional, Tuple, Dict, Any
from ..database import get_db

logger = logging.getLogger(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), "../data/padova_schools.json")

# Fallback default: Centro di Padova
PADOVA_CENTER_LAT = 45.4064
PADOVA_CENTER_LON = 11.8768

class SchoolGeocoder:
    def __init__(self):
        self.schools = []
        self._load_schools()

    def _load_schools(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    self.schools = json.load(f)
                logger.info(f"Caricate {len(self.schools)} scuole da padova_schools.json")
            except Exception as e:
                logger.error(f"Errore nel caricamento del database scuole: {e}")

    def resolve_location(self, school_name: str, school_city: Optional[str] = None, address_hint: Optional[str] = None, school_code: Optional[str] = None) -> Dict[str, Any]:
        """
        Risolve nome scuola, indirizzo e coordinate (lat, lon).
        1. Ricerca nel catalogo locale padova_schools.json per codice meccanografico o alias
        2. Controllo cache SQLite
        3. Se presente address_hint o city, geocoding su Nominatim con rate-limiting
        4. Fallback sicuro sulle coordinate della città o centro di Padova
        """
        clean_name = (school_name or "").lower().strip()
        clean_city = (school_city or "").lower().strip()

        # 1. Ricerca nel catalogo per codice meccanografico esplicito (se fornito)
        if school_code:
            code_clean = school_code.strip().upper()
            for school in self.schools:
                if school.get("code") and school["code"].upper() == code_clean:
                    return {
                        "school_name": school["name"],
                        "school_code": school["code"],
                        "school_address": school["address"],
                        "school_city": school["city"],
                        "latitude": school["lat"],
                        "longitude": school["lon"],
                    }

        # 2. Ricerca nel catalogo locale per codice o alias con confini di parola esatti
        for school in self.schools:
            # Controllo codice meccanografico nel nome
            if school.get("code") and school["code"].lower() in clean_name:
                return {
                    "school_name": school["name"],
                    "school_code": school["code"],
                    "school_address": school["address"],
                    "school_city": school["city"],
                    "latitude": school["lat"],
                    "longitude": school["lon"],
                }
            # Controllo alias con confini di parola (\b) per evitare che "i ic" matchi dentro "ii ic"
            for alias in school.get("aliases", []):
                pattern = rf'\b{re.escape(alias)}\b'
                if re.search(pattern, clean_name, re.IGNORECASE) or (clean_city and len(alias) > 3 and re.search(pattern, clean_city, re.IGNORECASE)):
                    return {
                        "school_name": school["name"],
                        "school_code": school.get("code"),
                        "school_address": school["address"],
                        "school_city": school["city"],
                        "latitude": school["lat"],
                        "longitude": school["lon"],
                    }

        # 2. Controllo query in geocache locale SQLite
        query = f"{address_hint or clean_name} {clean_city}".strip()
        if query:
            with get_db() as conn:
                cached = conn.execute(
                    "SELECT address, latitude, longitude FROM geocache WHERE query = ?", (query,)
                ).fetchone()
                if cached:
                    return {
                        "school_name": school_name,
                        "school_code": None,
                        "school_address": cached["address"],
                        "school_city": school_city or "Padova",
                        "latitude": cached["latitude"],
                        "longitude": cached["longitude"],
                    }

        # 3. Tentativo con Nominatim se abbiamo un indirizzo o comune chiaro
        if address_hint or clean_city:
            geo_query = address_hint or f"{clean_name}, {clean_city}, Padova, Italia"
            try:
                # Nominatim query
                params = {"q": geo_query, "format": "json", "limit": 1, "countrycodes": "it"}
                headers = {"User-Agent": "CercaInterpelliPadova/1.0 (local-selfhosted-app)"}
                with httpx.Client(timeout=5.0) as client:
                    resp = client.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data and len(data) > 0:
                            lat = float(data[0]["lat"])
                            lon = float(data[0]["lon"])
                            display_name = data[0].get("display_name", address_hint or school_name)
                            with get_db() as conn:
                                conn.execute(
                                    "INSERT OR REPLACE INTO geocache (query, address, latitude, longitude) VALUES (?, ?, ?, ?)",
                                    (query, display_name, lat, lon),
                                )
                            return {
                                "school_name": school_name,
                                "school_code": None,
                                "school_address": display_name,
                                "school_city": school_city or "Padova",
                                "latitude": lat,
                                "longitude": lon,
                            }
            except Exception as ex:
                logger.warning(f"Geocoding online fallito per '{geo_query}': {ex}")

        # 4. Fallback sicuro su coordinate Padova
        return {
            "school_name": school_name or "Scuola Provincia di Padova",
            "school_code": None,
            "school_address": address_hint or f"Padova (PD)",
            "school_city": school_city or "Padova",
            "latitude": PADOVA_CENTER_LAT,
            "longitude": PADOVA_CENTER_LON,
        }

    def geocode_user_query(self, query_str: str) -> Optional[Dict[str, Any]]:
        clean_q = (query_str or "").strip()
        if not clean_q:
            return None

        # 1. Controllo cache SQLite
        with get_db() as conn:
            cached = conn.execute(
                "SELECT address, latitude, longitude FROM geocache WHERE query = ?", (clean_q.lower(),)
            ).fetchone()
            if cached:
                return {
                    "address": cached["address"],
                    "latitude": cached["latitude"],
                    "longitude": cached["longitude"],
                }

        # 2. Query su Nominatim
        geo_q = clean_q
        if "italia" not in geo_q.lower() and "italy" not in geo_q.lower():
            geo_q = f"{clean_q}, Italia"

        try:
            params = {"q": geo_q, "format": "json", "limit": 1, "countrycodes": "it"}
            headers = {"User-Agent": "CercaInterpelliPadova/1.0 (local-selfhosted-app)"}
            with httpx.Client(timeout=6.0) as client:
                resp = client.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if data and len(data) > 0:
                        lat = float(data[0]["lat"])
                        lon = float(data[0]["lon"])
                        display_name = data[0].get("display_name", clean_q)
                        with get_db() as conn:
                            conn.execute(
                                "INSERT OR REPLACE INTO geocache (query, address, latitude, longitude) VALUES (?, ?, ?, ?)",
                                (clean_q.lower(), display_name, lat, lon),
                            )
                        return {
                            "address": display_name,
                            "latitude": lat,
                            "longitude": lon,
                        }
        except Exception as ex:
            logger.warning(f"Geocoding online fallito per query utente '{clean_q}': {ex}")

        return None

geocoder = SchoolGeocoder()

