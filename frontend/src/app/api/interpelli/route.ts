import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { formatInterpelloItem } from '@/lib/formatInterpello';

export { formatInterpelloItem };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search');
    const classe = searchParams.get('classe');
    const ordine = searchParams.get('ordine');
    const ore = searchParams.get('ore');
    const status = searchParams.get('status');
    const onlyActive = searchParams.get('only_active') === 'true';
    const sort = searchParams.get('sort') || 'date_desc';

    let query = supabase.from('interpelli').select('*');

    if (search) {
      const s = `%${search}%`;
      query = query.or(`title.ilike.${s},school_name.ilike.${s},school_city.ilike.${s},content_raw.ilike.${s}`);
    }

    if (classe && classe !== 'tutte') {
      query = query.filter('classi_concorso', 'cs', JSON.stringify([classe]));
    }

    if (ordine && ordine !== 'tutti') {
      if (ordine === 'Altro') {
        query = query.or('ordine_scuola.eq.Altro,ordine_scuola.is.null');
      } else {
        query = query.or(`ordine_scuola.eq.${ordine},ordine_scuola.eq.Altro,ordine_scuola.is.null`);
      }
    }

    if (status && status !== 'tutti') {
      query = query.eq('status_candidatura', status);
    }

    // Sort
    if (sort === 'scadenza_asc') {
      query = query.order('scadenza', { ascending: true, nullsFirst: false });
    } else if (sort === 'school_asc') {
      query = query.order('school_name', { ascending: true });
    } else {
      query = query.order('wp_date', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Errore Supabase query interpelli:', error);
      return NextResponse.json({ error: error.message, details: error.details, code: error.code }, { status: 500 });
    }

    let items = (data || []).map(formatInterpelloItem);

    // Filter by ore in JS if specified (since ore can be numeric or string)
    if (ore && ore !== 'tutte') {
      items = items.filter(item => {
        const val = item.ore_settimanali || '';
        if (ore === 'non_specificate') {
          return !val || val === '' || val.includes('da definire');
        }
        if (ore === 'intera') {
          const numMatch = val.match(/\d+/);
          const n = numMatch ? parseInt(numMatch[0], 10) : 0;
          return n >= 18 || val.includes('cattedra intera') || val.includes('posto intero');
        }
        if (ore === 'spezzone') {
          const numMatch = val.match(/\d+/);
          const n = numMatch ? parseInt(numMatch[0], 10) : 0;
          return (n > 0 && n < 18) || val.includes('spezzone');
        }
        if (/^\d+$/.test(ore)) {
          const target = parseInt(ore, 10);
          const numMatch = val.match(/\d+/);
          return numMatch && parseInt(numMatch[0], 10) === target;
        }
        return true;
      });
    }

    // Filter only_active if requested
    if (onlyActive) {
      items = items.filter(item => !item.is_expired);
    }

    return NextResponse.json(items);
  } catch (err: any) {
    console.error('API Error /api/interpelli:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
