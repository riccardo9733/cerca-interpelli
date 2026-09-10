import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { formatInterpelloItem } from '../interpelli/route';

export const maxDuration = 60; // Fino a 60s per le Serverless Functions Vercel

export async function POST(req: NextRequest) {
  try {
    const supabase = getAdminSupabase();

    // 1. Recupera tutti gli interpelli da Supabase
    const { data: rows, error } = await supabase.from('interpelli').select('*');

    if (error) {
      console.error('Errore query pulizia interpelli:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;
    const idsToDelete: number[] = [];

    (rows || []).forEach(row => {
      const item = formatInterpelloItem(row);

      // Se l'interpello è scaduto
      if (item.is_expired) {
        let expiredForMs = 0;

        if (item.scadenza) {
          const expDt = new Date(item.scadenza);
          if (!isNaN(expDt.getTime())) {
            expiredForMs = now.getTime() - expDt.getTime();
          }
        } else if (item.wp_date) {
          // Se non ha scadenza esplicita ed è scaduto (oltre 7 giorni da wp_date)
          const wpDt = new Date(item.wp_date);
          if (!isNaN(wpDt.getTime())) {
            // È scaduto dopo 7 giorni, quindi calcoliamo il tempo trascorso oltre i 7 giorni
            expiredForMs = now.getTime() - (wpDt.getTime() + 7 * 86400 * 1000);
          }
        }

        // Se è scaduto da almeno 48 ore (48 * 3600 * 1000 ms)
        if (expiredForMs >= FORTY_EIGHT_HOURS_MS) {
          idsToDelete.push(item.id);
        }
      }
    });

    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const { error: delErr } = await supabase
        .from('interpelli')
        .delete()
        .in('id', idsToDelete);

      if (delErr) {
        console.error('Errore eliminazione interpelli scaduti:', delErr);
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }

      deletedCount = idsToDelete.length;
    }

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount,
      deleted_ids: idsToDelete,
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
