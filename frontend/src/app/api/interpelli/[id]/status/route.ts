import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { formatInterpelloItem } from '@/lib/formatInterpello';

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

    const body = await req.json();
    const { status_candidatura, notes } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (status_candidatura !== undefined) {
      updates.status_candidatura = status_candidatura;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }

    const { data, error } = await supabase
      .from('interpelli')
      .update(updates)
      .eq('id', interpelloId)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Errore aggiornamento stato interpello:', error);
      return NextResponse.json({ error: error?.message || 'Interpello non trovato' }, { status: 404 });
    }

    const formatted = formatInterpelloItem(data);
    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error('API Error /api/interpelli/[id]/status:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
