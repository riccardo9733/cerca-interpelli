import { Interpello, Stats, SyncResult } from '@/types/interpello';

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

export async function triggerManualSync(): Promise<SyncResult> {
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

