import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export function formatInterpelloItem(row: any) {
  const item = { ...row };

  // Json fields parsing if string
  if (typeof item.classi_concorso === 'string') {
    try { item.classi_concorso = JSON.parse(item.classi_concorso); } catch (_) { item.classi_concorso = []; }
  }
  if (!Array.isArray(item.classi_concorso)) item.classi_concorso = [];

  if (typeof item.attachments === 'string') {
    try { item.attachments = JSON.parse(item.attachments); } catch (_) { item.attachments = []; }
  }
  if (!Array.isArray(item.attachments)) item.attachments = [];

  // Calcolo scadenza e tempo residuo
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  let isExpired = false;
  let timeRemainingSeconds: number | null = null;
  let hasDateAnomaly = false;
  let dateAnomalyDesc: string | null = null;

  let wpDt: Date | null = null;
  if (item.wp_date) {
    const d = new Date(item.wp_date);
    if (!isNaN(d.getTime())) wpDt = d;
  }

  const wpDateOnly = wpDt ? wpDt.toISOString().split('T')[0] : null;
  const rawContent = `${item.title || ''} ${item.content_raw || ''}`;
  const isRecentPost = wpDt ? (now.getTime() - wpDt.getTime()) <= 14 * 86400 * 1000 : false;

  let pubIsMoreRecentThanFine = false;
  if (wpDateOnly && item.periodo_fine && wpDateOnly > item.periodo_fine) {
    pubIsMoreRecentThanFine = true;
    hasDateAnomaly = true;
    dateAnomalyDesc = `Data di pubblicazione (${wpDateOnly}) più recente della conclusione servizio indicata (${item.periodo_fine}): probabile refuso della scuola per l'anno successivo. Bando considerato attivo.`;
  }

  if (isRecentPost && wpDt) {
    if (rawContent.includes('30/06/2026') && wpDt.getMonth() >= 7) {
      hasDateAnomaly = true;
      if (!dateAnomalyDesc) {
        dateAnomalyDesc = "La scuola ha indicato nel testo '30/06/2026' come termine supplenza (data precedente alla pubblicazione). È un probabile refuso per l'a.s. 2026/2027: bando attivo.";
      }
    } else if (item.scadenza_raw && item.scadenza_raw.includes('2025')) {
      hasDateAnomaly = true;
      if (!dateAnomalyDesc) {
        dateAnomalyDesc = `Nel testo la scadenza è indicata con anno precedente ('${item.scadenza_raw}'): normalizzato all'anno corrente per bando recente.`;
      }
    } else if (item.periodo_fine && wpDateOnly && item.periodo_fine < wpDateOnly) {
      hasDateAnomaly = true;
      if (!dateAnomalyDesc) {
        dateAnomalyDesc = "Data di termine indicata precedente alla pubblicazione dell'avviso. Probabile refuso della scuola: bando considerato attivo.";
      }
    }
  }

  if (item.scadenza) {
    try {
      const exp = new Date(item.scadenza);
      if (!isNaN(exp.getTime())) {
        const diffSec = Math.floor((exp.getTime() - now.getTime()) / 1000);
        timeRemainingSeconds = diffSec;

        if (wpDt && exp.getTime() < wpDt.getTime()) {
          hasDateAnomaly = true;
          isExpired = false;
          if (!dateAnomalyDesc) {
            dateAnomalyDesc = "Data di scadenza indicata nel bando precedente alla pubblicazione (refuso della scuola): bando considerato attivo.";
          }
        } else if (pubIsMoreRecentThanFine || (hasDateAnomaly && isRecentPost && diffSec <= 0)) {
          isExpired = false;
        } else {
          isExpired = diffSec <= 0;
        }
      }
    } catch (_) {}
  } else {
    if (item.periodo_fine && item.periodo_fine < todayDate) {
      if (pubIsMoreRecentThanFine || isRecentPost) {
        hasDateAnomaly = true;
        isExpired = false;
        if (!dateAnomalyDesc) {
          dateAnomalyDesc = "Data di conclusione servizio antecedente alla pubblicazione (refuso della scuola): bando considerato attivo.";
        }
      } else {
        isExpired = true;
      }
    } else {
      if (wpDt && (now.getTime() - wpDt.getTime()) > 7 * 86400 * 1000) {
        isExpired = true;
      }
    }
  }

  if (pubIsMoreRecentThanFine) {
    isExpired = false;
    hasDateAnomaly = true;
  }

  item.is_expired = isExpired;
  item.time_remaining_seconds = timeRemainingSeconds;
  item.has_date_anomaly = hasDateAnomaly;
  item.date_anomaly_desc = dateAnomalyDesc;

  return item;
}

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
