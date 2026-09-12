import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { formatInterpelloItem } from '@/lib/formatInterpello';

export async function GET() {
  try {
    const { data, error } = await supabase.from('interpelli').select('*');

    if (error) {
      console.error('Errore Supabase stats:', error);
      return NextResponse.json({ error: error.message, details: error.details, code: error.code }, { status: 500 });
    }

    const items = (data || []).map(formatInterpelloItem);

    const activeItems = items.filter(i => !i.is_expired);

    // Ultima sincronizzazione riuscita (se la tabella sync_logs esiste)
    let lastSync: string | null = null;
    let lastSyncStatus: string | null = null;
    try {
      const { data: lastLog } = await supabase
        .from('sync_logs')
        .select('timestamp,status')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastLog) {
        lastSync = lastLog.timestamp ?? null;
        lastSyncStatus = lastLog.status ?? null;
      }
    } catch (_) {
      // sync_logs mancante o non leggibile: statistiche comunque valide
    }

    // Forma attesa dal frontend (tipo Stats): i conteggi personali
    // candidati/preferiti vengono poi ricalcolati sul dispositivo in page.tsx
    const stats = {
      total_interpelli: items.length,
      active_interpelli: activeItems.length,
      expiring_soon: activeItems.filter(
        i => i.time_remaining_seconds !== null && i.time_remaining_seconds !== undefined &&
          i.time_remaining_seconds > 0 && i.time_remaining_seconds <= 24 * 60 * 60
      ).length,
      candidati: items.filter(i => i.status_candidatura === 'candidato').length,
      preferiti: items.filter(i => i.status_candidatura === 'preferito').length,
      last_sync: lastSync,
      last_sync_status: lastSyncStatus,
    };

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error('API Error /api/stats:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
