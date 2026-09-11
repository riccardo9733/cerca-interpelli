import { NextRequest, NextResponse } from 'next/server';
import { formatInterpelloItem } from '@/lib/formatInterpello';
import { getValidUrl, getValidServiceKey } from '@/lib/supabase';

export const maxDuration = 60; // Fino a 60s per elaborazione documenti / AI

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const wp_id = body.wp_id ? Number(body.wp_id) : null;

    if (!wp_id || isNaN(wp_id)) {
      return NextResponse.json(
        { success: false, error: 'Parametro wp_id obbligatorio e numerico' },
        { status: 400 }
      );
    }

    const supabaseUrl = getValidUrl();
    const supabaseKey = getValidServiceKey();

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: 'Credenziali Supabase non configurate' },
        { status: 500 }
      );
    }

    // Invocazione della Edge Function 'sync-ai' per il singolo bando
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/sync-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ wp_id }),
      cache: 'no-store',
    });

    if (!edgeRes.ok) {
      const errData = await edgeRes.json().catch(() => ({}));
      console.error(`[API /api/scan-ai] Errore da Edge Function ${edgeRes.status}:`, errData);
      return NextResponse.json(
        { success: false, error: errData.error || `Errore Edge Function: HTTP ${edgeRes.status}` },
        { status: edgeRes.status }
      );
    }

    const data = await edgeRes.json();
    const formattedItems = (data.updated_items || []).map(formatInterpelloItem);

    return NextResponse.json({
      success: true,
      wp_id,
      ai_extracted: data.ai_extracted,
      ai_error: data.ai_error || null,
      model_used: data.model_used || null,
      items_count: formattedItems.length,
      updated_items: formattedItems,
      message: data.message || 'Scansione IA completata con successo'
    });
  } catch (err: any) {
    console.error('[API /api/scan-ai] Eccezione:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Errore interno del server durante la scansione IA' },
      { status: 500 }
    );
  }
}
