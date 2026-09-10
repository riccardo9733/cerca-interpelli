import { NextRequest, NextResponse } from 'next/server';
import { geocodeUserQuery } from '@/lib/sync/geocoder';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');

    if (!q) {
      return NextResponse.json({ error: 'Query string q richiesta' }, { status: 400 });
    }

    const res = await geocodeUserQuery(q);
    if (!res) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
