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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oysatbtuiyfupeuezzai.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c2F0YnR1aXlmdXBldWV6emFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjE5MTAsImV4cCI6MjEwNDYzNzkxMH0.tt0CGIDxWXQwmdcEtEnTi3lZurmCgBB03QN-bXCr0Xs';

  // 1. Invocazione diretta dal browser alla Supabase Edge Function (veloce ~3-4s, evita Vercel serverless hop)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Invocazione diretta Supabase Edge Function fallita dal browser, provo via /api/sync:', err);
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

