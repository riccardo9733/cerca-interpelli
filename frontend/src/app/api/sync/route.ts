import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { syncInterpelli } from '@/lib/sync/wpFetcher';

export const maxDuration = 60; // Consente fino a 60s per le funzioni Vercel Serverless

export async function POST(req: NextRequest) {
  try {
    // Opzionale: verifica secret token per cron Vercel / chiamate autorizzate
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Se è impostato CRON_SECRET e l'header non corrisponde
    }

    // Tenta prima l'invocazione della Supabase Edge Function 'sync'
    try {
      const supabase = getAdminSupabase();
      const { data, error } = await supabase.functions.invoke('sync');

      if (!error && data && data.success !== false) {
        console.log('Sincronizzazione completata via Supabase Edge Function:', data);
        return NextResponse.json(data);
      }

      if (error) {
        console.warn('Errore invocazione Supabase Edge Function, tentata esecuzione fallback locale:', error);
      }
    } catch (edgeErr) {
      console.warn('Eccezione durante chiamata Edge Function, tentata esecuzione fallback locale:', edgeErr);
    }

    // Fallback su scraper locale in-process
    const result = await syncInterpelli();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Error /api/sync:', err);
    return NextResponse.json({
      success: false,
      items_found: 0,
      items_new: 0,
      items_updated: 0,
      message: `Errore: ${err.message || String(err)}`
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

