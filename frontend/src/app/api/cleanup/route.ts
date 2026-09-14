import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';

export const maxDuration = 60; // Fino a 60s per le Serverless Functions Vercel

export async function POST(req: NextRequest) {
  try {
    const supabase = getAdminSupabase();

    const now = new Date();
    const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;
    const NINE_DAYS_MS = 9 * 86400 * 1000; // 7 giorni validità default + 48 ore

    const cutoffScadenza = new Date(now.getTime() - FORTY_EIGHT_HOURS_MS).toISOString();
    const cutoffWpDate = new Date(now.getTime() - NINE_DAYS_MS).toISOString();

    // 1. Elimina interpelli con scadenza esplicita passata da oltre 48h
    const { data: del1, error: err1 } = await supabase
      .from('interpelli')
      .delete()
      .not('scadenza', 'is', null)
      .lt('scadenza', cutoffScadenza)
      .select('id');

    if (err1) {
      console.error('Errore eliminazione scadenza esplicita:', err1);
      return NextResponse.json({ error: err1.message }, { status: 500 });
    }

    // 2. Elimina interpelli senza scadenza pubblicati da oltre 9 giorni (7gg validità + 48h)
    const { data: del2, error: err2 } = await supabase
      .from('interpelli')
      .delete()
      .is('scadenza', null)
      .lt('wp_date', cutoffWpDate)
      .select('id');

    if (err2) {
      console.error('Errore eliminazione fallback wp_date:', err2);
      return NextResponse.json({ error: err2.message }, { status: 500 });
    }

    const deletedIds = [
      ...(del1 || []).map(r => r.id),
      ...(del2 || []).map(r => r.id)
    ];
    const deletedCount = deletedIds.length;

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      deleted_ids: deletedIds,
      message: `Pulizia completata: eliminati ${deletedCount} interpelli scaduti da più di 48 ore.`
    });
  } catch (err: any) {
    console.error('API Error /api/cleanup:', err);
    return NextResponse.json({
      success: false,
      deleted_count: 0,
      message: `Errore durante la pulizia: ${err.message || String(err)}`
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
