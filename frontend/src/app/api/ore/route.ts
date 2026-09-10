import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase.from('interpelli').select('ore_settimanali');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const oreSet = new Set<number>();

    (data || []).forEach(row => {
      const val = row.ore_settimanali;
      if (val && typeof val === 'string') {
        const match = val.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > 0 && num <= 36) {
            oreSet.add(num);
          }
        }
      }
    });

    const sortedOre = Array.from(oreSet).sort((a, b) => a - b);
    return NextResponse.json(sortedOre);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
