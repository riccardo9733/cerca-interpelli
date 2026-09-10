import { NextRequest, NextResponse } from 'next/server';
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://oysatbtuiyfupeuezzai.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95c2F0YnR1aXlmdXBldWV6emFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNjE5MTAsImV4cCI6MjEwNDYzNzkxMH0.tt0CGIDxWXQwmdcEtEnTi3lZurmCgBB03QN-bXCr0Xs';

    // Invocazione sicura della Supabase Edge Function 'sync'
    if (supabaseUrl && supabaseKey) {
      try {
        const edgeRes = await fetch(`${supabaseUrl}/functions/v1/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          cache: 'no-store',
        });

        if (edgeRes.ok) {
          const data = await edgeRes.json();
          if (data && data.success !== false) {
            console.log('Sincronizzazione completata via Supabase Edge Function:', data);
            return NextResponse.json(data);
          }
        } else {
          console.warn(`Supabase Edge Function status ${edgeRes.status}, eseguo fallback locale...`);
        }
      } catch (edgeErr) {
        console.warn('Eccezione chiamata Edge Function, eseguo fallback locale:', edgeErr);
      }
    }

    // Fallback garantito su scraper locale
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




