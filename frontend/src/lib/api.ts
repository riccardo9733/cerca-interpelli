import { Interpello, Stats, SyncResult } from '@/types/interpello';
import { formatInterpelloItem } from '@/lib/formatInterpello';
import { getValidUrl, getValidAnonKey } from '@/lib/supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface FilterParams {
  search?: string;
  classe?: string;
  ordine?: string;
  ore?: string;
  status?: string;
  only_active?: boolean;
  sort?: string;
}

export async function fetchInterpelli(params: FilterParams = {}): Promise<Interpello[]> {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.classe && params.classe !== 'tutte') query.append('classe', params.classe);
  if (params.ordine && params.ordine !== 'tutti') query.append('ordine', params.ordine);
  if (params.ore && params.ore !== 'tutte') query.append('ore', params.ore);
  if (params.status && params.status !== 'tutti') query.append('status', params.status);
  if (params.only_active !== undefined) query.append('only_active', params.only_active ? 'true' : 'false');
  if (params.sort) query.append('sort', params.sort);

  const res = await fetch(`${API_BASE_URL}/api/interpelli?${query.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Errore caricamento interpelli: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE_URL}/api/stats`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Errore statistiche: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchClassi(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/api/classi`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function fetchOre(): Promise<number[]> {
  const res = await fetch(`${API_BASE_URL}/api/ore`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function updateInterpelloStatus(
  id: number,
  status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato',
  notes?: string
): Promise<Interpello> {
  const res = await fetch(`${API_BASE_URL}/api/interpelli/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status_candidatura: status, notes }),
  });
  if (!res.ok) {
    throw new Error(`Errore aggiornamento stato: ${res.statusText}`);
  }
  return res.json();
}

export type AdminInterpelloUpdate = Partial<
  Pick<
    Interpello,
    | 'title'
    | 'school_name'
    | 'school_code'
    | 'school_address'
    | 'school_city'
    | 'latitude'
    | 'longitude'
    | 'classi_concorso'
    | 'ordine_scuola'
    | 'tipo_posto'
    | 'posti_disponibili'
    | 'ore_settimanali'
    | 'periodo_desc'
    | 'periodo_inizio'
    | 'periodo_fine'
    | 'scadenza'
    | 'scadenza_raw'
    | 'email_candidatura'
    | 'oggetto_email'
    | 'link_candidatura'
  >
>;

/** Modifica manuale admin — richiede sessione sbloccata (gate client-side). */
export async function updateInterpelloAdmin(
  id: number,
  payload: AdminInterpelloUpdate
): Promise<Interpello> {
  const res = await fetch(`${API_BASE_URL}/api/interpelli/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Errore salvataggio: ${res.statusText}`);
  }
  return data as Interpello;
}

/** Eliminazione definitiva admin. */
export async function deleteInterpelloAdmin(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/interpelli/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Errore eliminazione: ${res.statusText}`);
  }
}

export async function triggerManualSync(): Promise<SyncResult> {
  const supabaseUrl = getValidUrl();
  const supabaseAnonKey = getValidAnonKey();

  // 1. Tenta la chiamata diretta dal browser all'Edge Function (3s con CORS attivo)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sync?per_page=100&pages=2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Invocazione diretta Edge Function non riuscita dal browser, provo via /api/sync:', err);
  }

  // 2. Fallback su API Route Next.js /api/sync
  const res = await fetch(`${API_BASE_URL}/api/sync`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `Errore sincronizzazione: ${res.statusText}`);
  }
  return res.json();
}

export interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const url = `${API_BASE_URL}/api/geocode?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export interface ScanAIResult {
  success: boolean;
  wp_id: number;
  ai_extracted?: boolean;
  items_count: number;
  updated_items: Interpello[];
  message?: string;
  error?: string;
}

export async function scanInterpelloWithAI(wpId: number): Promise<ScanAIResult> {
  const supabaseUrl = getValidUrl();
  const supabaseAnonKey = getValidAnonKey();

  // 1. Tenta prima la chiamata diretta dal browser alla Supabase Edge Function 'sync-ai'
  // Questo evita il limite di timeout di Vercel (10-15s sui piani Free) e problemi di variabili d'ambiente nel deploy
  try {
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/sync-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ wp_id: wpId }),
    });

    if (edgeRes.ok) {
      const data = await edgeRes.json();
      if (data && data.success !== false) {
        const formattedItems = (data.updated_items || []).map(formatInterpelloItem);
        return {
          success: true,
          wp_id: wpId,
          ai_extracted: data.ai_extracted,
          items_count: formattedItems.length,
          updated_items: formattedItems,
          message: data.message || 'Scansione IA completata con successo',
        };
      }
    } else {
      console.warn(`[scanInterpelloWithAI] Chiamata diretta Edge Function fallita con status ${edgeRes.status}, provo via /api/scan-ai...`);
    }
  } catch (err) {
    console.warn('[scanInterpelloWithAI] Eccezione chiamata diretta Edge Function, provo via /api/scan-ai:', err);
  }

  // 2. Fallback su API Route Next.js /api/scan-ai
  const res = await fetch(`${API_BASE_URL}/api/scan-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wp_id: wpId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Errore durante la scansione IA: ${res.statusText}`);
  }
  return data;
}


