import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { formatInterpelloItem } from '@/lib/formatInterpello';

// PATCH /api/interpelli/[id] — modifica manuale admin di un interpello.
// DELETE /api/interpelli/[id] — eliminazione definitiva admin.
// NOTA: gate solo client-side (isAdmin). Per sicurezza reale aggiungere
// auth server-side (cookie HttpOnly + secret non NEXT_PUBLIC_).
const ALLOWED_FIELDS = new Set([
  'title',
  'school_name',
  'school_code',
  'school_address',
  'school_city',
  'latitude',
  'longitude',
  'classi_concorso',
  'ordine_scuola',
  'tipo_posto',
  'posti_disponibili',
  'ore_settimanali',
  'periodo_desc',
  'periodo_inizio',
  'periodo_fine',
  'scadenza',
  'scadenza_raw',
  'email_candidatura',
  'oggetto_email',
  'link_candidatura',
]);

function toNullIfEmpty(v: unknown): unknown {
  if (v === '' || v === undefined) return null;
  return v;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const interpelloId = parseInt(id, 10);
    if (isNaN(interpelloId)) {
      return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(key)) continue;
      if (key === 'classi_concorso') {
        // Accetta array o stringa "A001, A002"
        if (Array.isArray(value)) {
          updates.classi_concorso = (value as unknown[])
            .map((v) => String(v).trim().toUpperCase())
            .filter(Boolean);
        } else if (typeof value === 'string') {
          updates.classi_concorso = value
            .split(',')
            .map((v) => v.trim().toUpperCase())
            .filter(Boolean);
        }
        continue;
      }
      if (key === 'posti_disponibili') {
        if (value === null || value === '' || value === undefined) {
          updates.posti_disponibili = null;
        } else {
          const n = Number(value);
          updates.posti_disponibili = Number.isFinite(n) ? Math.trunc(n) : null;
        }
        continue;
      }
      if (key === 'latitude' || key === 'longitude') {
        if (value === null || value === '' || value === undefined) {
          updates[key] = null;
        } else {
          const n = Number(value);
          updates[key] = Number.isFinite(n) ? n : null;
        }
        continue;
      }
      updates[key] = toNullIfEmpty(value);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo valido da aggiornare' },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();
    // Evita che il prossimo sync automatico sovrascriva la correzione manuale
    updates.ai_enhanced = true;

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('interpelli')
      .update(updates)
      .eq('id', interpelloId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Errore aggiornamento admin interpello:', error);
      return NextResponse.json(
        { error: error?.message || 'Interpello non trovato' },
        { status: 404 }
      );
    }

    return NextResponse.json(formatInterpelloItem(data));
  } catch (err: unknown) {
    console.error('API Error PATCH /api/interpelli/[id]:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const interpelloId = parseInt(id, 10);
    if (isNaN(interpelloId)) {
      return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
    }

    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from('interpelli')
      .delete()
      .eq('id', interpelloId);

    if (error) {
      console.error('Errore eliminazione admin interpello:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: interpelloId });
  } catch (err: unknown) {
    console.error('API Error DELETE /api/interpelli/[id]:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
