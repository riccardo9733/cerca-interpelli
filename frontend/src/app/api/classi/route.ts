import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase.from('interpelli').select('classi_concorso');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const classiSet = new Set<string>();

    (data || []).forEach(row => {
      let arr = row.classi_concorso;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch (_) { arr = []; }
      }
      if (Array.isArray(arr)) {
        arr.forEach((c: string) => {
          if (c && typeof c === 'string') classiSet.add(c.toUpperCase());
        });
      }
    });

    const sortedClassi = Array.from(classiSet).sort();
    return NextResponse.json(sortedClassi);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
