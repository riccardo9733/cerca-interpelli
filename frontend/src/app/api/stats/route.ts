import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { formatInterpelloItem } from '../interpelli/route';

export async function GET() {
  try {
    const { data, error } = await supabase.from('interpelli').select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (data || []).map(formatInterpelloItem);

    const stats = {
      total: items.length,
      active: items.filter(i => !i.is_expired).length,
      candidates: items.filter(i => i.status_candidatura === 'candidato').length,
      favorites: items.filter(i => i.status_candidatura === 'preferito').length,
      ignored: items.filter(i => i.status_candidatura === 'ignorato').length,
    };

    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
