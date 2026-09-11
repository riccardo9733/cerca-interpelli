import padovaSchoolsData from '../data/padova_schools.json';
import { getAdminSupabase } from '../supabase';

export interface SchoolEntry {
  name: string;
  code: string;
  city: string;
  address: string;
  lat: number;
  lon: number;
  email?: string;
  pec?: string;
  website?: string;
  plessi?: string[];
  aliases?: string[];
}

export interface GeocodeLocationResult {
  school_name: string;
  school_code: string | null;
  school_address: string;
  school_city: string;
  latitude: number;
  longitude: number;
}

const PADOVA_CENTER_LAT = 45.4064;
const PADOVA_CENTER_LON = 11.8768;

const schools = padovaSchoolsData as SchoolEntry[];

export function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`\.]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function resolveLocation(
  schoolName: string,
  schoolCity?: string | null,
  addressHint?: string | null,
  schoolCode?: string | null
): Promise<GeocodeLocationResult> {
  const normName = normalizeText(schoolName);
  const normCity = normalizeText(schoolCity);

  // 1. Ricerca nel catalogo per codice meccanografico esplicito
  if (schoolCode) {
    const codeClean = schoolCode.trim().toUpperCase();
    for (const school of schools) {
      if (
        (school.code && school.code.toUpperCase() === codeClean) ||
        (school.plessi && school.plessi.some(p => p.toUpperCase() === codeClean))
      ) {
        return {
          school_name: school.name,
          school_code: school.code,
          school_address: school.address,
          school_city: school.city,
          latitude: school.lat,
          longitude: school.lon,
        };
      }
    }
  }

  // 2. Ricerca per codice o plesso presente nel nome
  for (const school of schools) {
    if (school.code && normName.includes(normalizeText(school.code))) {
      return {
        school_name: school.name,
        school_code: school.code,
        school_address: school.address,
        school_city: school.city,
        latitude: school.lat,
        longitude: school.lon,
      };
    }
    if (school.plessi) {
      for (const p of school.plessi) {
        if (normName.includes(normalizeText(p))) {
          return {
            school_name: school.name,
            school_code: school.code,
            school_address: school.address,
            school_city: school.city,
            latitude: school.lat,
            longitude: school.lon,
          };
        }
      }
    }
  }

  // 3. Ricerca per nome scuola normalizzato (senza accenti/apostrofi)
  if (normName.length >= 4) {
    for (const school of schools) {
      const normCatalogName = normalizeText(school.name);
      if (normCatalogName.length >= 4 && (normName.includes(normCatalogName) || normCatalogName.includes(normName))) {
        return {
          school_name: school.name,
          school_code: school.code || null,
          school_address: school.address,
          school_city: school.city,
          latitude: school.lat,
          longitude: school.lon,
        };
      }
    }
  }

  // 4. Ricerca per Alias (ordinati per lunghezza decrescente, senza problemi di regex \b su lettere accentate)
  const allCandidates: { len: number; normAlias: string; school: SchoolEntry }[] = [];
  for (const school of schools) {
    if (school.aliases) {
      for (const alias of school.aliases) {
        const normAlias = normalizeText(alias);
        if (normAlias.length >= 4) {
          allCandidates.push({ len: normAlias.length, normAlias, school });
        }
      }
    }
  }
  allCandidates.sort((a, b) => b.len - a.len);

  for (const item of allCandidates) {
    if (normName.includes(item.normAlias) || (normCity && item.normAlias.length > 3 && normCity.includes(item.normAlias))) {
      return {
        school_name: item.school.name,
        school_code: item.school.code || null,
        school_address: item.school.address,
        school_city: item.school.city,
        latitude: item.school.lat,
        longitude: item.school.lon,
      };
    }
  }

  // Pulisci addressHint se è un falso positivo del parser (es. testo del bando invece di un indirizzo reale)
  let validAddressHint = addressHint;
  if (validAddressHint && (validAddressHint.length > 80 || /prestato|servizio|interpello|candidatura|graduatoria|oggetto/i.test(validAddressHint))) {
    validAddressHint = null;
  }

  // 5. Controllo Cache Supabase
  const queryKey = `${validAddressHint || schoolName} ${schoolCity || ''}`.trim();
  const supabase = getAdminSupabase();

  if (queryKey) {
    try {
      const { data: cached } = await supabase
        .from('geocache')
        .select('address, latitude, longitude')
        .eq('query', queryKey.toLowerCase())
        .maybeSingle();

      if (cached) {
        return {
          school_name: schoolName,
          school_code: null,
          school_address: cached.address,
          school_city: schoolCity || 'Padova',
          latitude: cached.latitude,
          longitude: cached.longitude,
        };
      }
    } catch (_) {}
  }

  // 6. Geocoding su Nominatim se abbiamo un indirizzo
  if (validAddressHint || schoolCity) {
    const geoQuery = validAddressHint || `${schoolName}, ${schoolCity || 'Padova'}, Italia`;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&limit=1&countrycodes=it`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CercaInterpelliPadova/1.0 (serverless-nextjs-app)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          const displayName = data[0].display_name || validAddressHint || schoolName;

          // Salva in cache
          await supabase.from('geocache').upsert({
            query: queryKey.toLowerCase(),
            address: displayName,
            latitude: lat,
            longitude: lon,
          });

          return {
            school_name: schoolName,
            school_code: null,
            school_address: displayName,
            school_city: schoolCity || 'Padova',
            latitude: lat,
            longitude: lon,
          };
        }
      }
    } catch (_) {}
  }

  // Fallback
  return {
    school_name: schoolName || 'Scuola Provincia di Padova',
    school_code: null,
    school_address: validAddressHint || 'Padova (PD)',
    school_city: schoolCity || 'Padova',
    latitude: PADOVA_CENTER_LAT,
    longitude: PADOVA_CENTER_LON,
  };
}

export async function geocodeUserQuery(queryStr: string) {
  const cleanQ = (queryStr || '').trim().toLowerCase();
  if (!cleanQ) return null;

  const supabase = getAdminSupabase();

  // Cache check
  try {
    const { data: cached } = await supabase
      .from('geocache')
      .select('address, latitude, longitude')
      .eq('query', cleanQ)
      .maybeSingle();

    if (cached) {
      return {
        address: cached.address,
        latitude: cached.latitude,
        longitude: cached.longitude,
      };
    }
  } catch (_) {}

  // Nominatim
  const geoQ = cleanQ.includes('italia') || cleanQ.includes('italy') ? cleanQ : `${cleanQ}, Italia`;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQ)}&format=json&limit=1&countrycodes=it`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CercaInterpelliPadova/1.0 (serverless-nextjs-app)' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const displayName = data[0].display_name || cleanQ;

        await supabase.from('geocache').upsert({
          query: cleanQ,
          address: displayName,
          latitude: lat,
          longitude: lon,
        });

        return {
          address: displayName,
          latitude: lat,
          longitude: lon,
        };
      }
    }
  } catch (_) {}

  return null;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
