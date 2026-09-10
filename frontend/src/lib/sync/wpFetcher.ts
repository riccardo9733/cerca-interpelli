import { getAdminSupabase } from '../supabase';
import { extractMetadata } from './extractor';
import { resolveLocation } from './geocoder';
import { downloadAndExtractPdfText } from './pdfParser';

const WP_API_URL = process.env.WP_API_URL || 'https://padova.istruzioneveneto.gov.it/wp-json/wp/v2/posts?categories=212&per_page=50';

export interface Attachment {
  name: string;
  url: string;
  is_bando: boolean;
  is_domanda: boolean;
}

export function parseAttachmentsFromHtml(html: string): Attachment[] {
  const attachments: Attachment[] = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const lowerUrl = url.toLowerCase();

    if (['.pdf', '.docx', '.doc', '.p7m'].some(ext => lowerUrl.includes(ext))) {
      const cleanTextLower = text.toLowerCase();
      const urlLower = url.toLowerCase();

      const isDomanda = ['allegato', 'domanda', 'candidatura', 'modello'].some(k => cleanTextLower.includes(k) || urlLower.includes(k));
      const isBando = !isDomanda && ['interpello', 'avviso', 'bando', 'timbro', 'segnatura', 'signed'].some(k => cleanTextLower.includes(k) || urlLower.includes(k));

      attachments.push({
        name: text || url.split('/').pop() || 'Allegato',
        url,
        is_bando: isBando,
        is_domanda: isDomanda
      });
    }
  }

  return attachments;
}

export async function syncInterpelli() {
  console.log('Avvio sincronizzazione interpelli con Supabase...');
  let itemsFound = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;
  let errorMessage: string | null = null;

  const supabase = getAdminSupabase();

  try {
    const res = await fetch(WP_API_URL, {
      headers: { 'User-Agent': 'CercaInterpelliPadova/1.0 (serverless-nextjs-app)' }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} da WordPress USP Padova API`);
    }

    const posts = await res.json();
    itemsFound = posts.length;

    for (const p of posts) {
      const wpId = p.id;
      const title = p.title?.rendered || '';
      const slug = p.slug || '';
      const wpDate = p.date;
      const wpModified = p.modified || wpDate;
      const wpUrl = p.link || '';
      const contentHtml = p.content?.rendered || '';

      // Verifica se già presente e non modificato
      const { data: existing } = await supabase
        .from('interpelli')
        .select('wp_id, wp_modified')
        .eq('wp_id', wpId)
        .maybeSingle();

      if (existing && existing.wp_modified === wpModified) {
        continue;
      }

      // 1. Estrai allegati
      const attachments = parseAttachmentsFromHtml(contentHtml);

      // 2. Scarica e leggi il PDF del bando
      let pdfText: string | null = null;
      const bandoAtt = attachments.find(a => a.is_bando) || attachments[0];
      if (bandoAtt && bandoAtt.url.toLowerCase().includes('.pdf')) {
        pdfText = await downloadAndExtractPdfText(bandoAtt.url);
      }

      // 3. Estrai metadati
      const meta = extractMetadata(title, contentHtml, pdfText, wpDate);

      // 4. Geolocalizzazione
      const schoolTarget = meta.school_name || title;
      let schoolCode = meta.school_code;
      if (meta.email_candidatura && !meta.email_candidatura.toLowerCase().startsWith('usp.pd')) {
        const mEmailCode = meta.email_candidatura.match(/\b(PD[A-Z0-9]{8})\b/i);
        if (mEmailCode) schoolCode = mEmailCode[1].toUpperCase();
      }

      const geoInfo = await resolveLocation(
        schoolTarget,
        meta.school_city,
        meta.school_address,
        schoolCode
      );

      // 5. Upsert su Supabase
      const record = {
        wp_id: wpId,
        title,
        slug,
        wp_date: wpDate,
        wp_modified: wpModified,
        wp_url: wpUrl,
        school_name: geoInfo.school_name,
        school_code: geoInfo.school_code || meta.school_code,
        school_address: geoInfo.school_address,
        school_city: geoInfo.school_city,
        latitude: geoInfo.latitude,
        longitude: geoInfo.longitude,
        classi_concorso: meta.classi_concorso,
        ordine_scuola: meta.ordine_scuola,
        tipo_posto: meta.tipo_posto,
        posti_disponibili: meta.posti_disponibili,
        ore_settimanali: meta.ore_settimanali,
        periodo_desc: meta.periodo_desc,
        periodo_inizio: meta.periodo_inizio,
        periodo_fine: meta.periodo_fine,
        scadenza: meta.scadenza,
        scadenza_raw: meta.scadenza_raw,
        email_candidatura: meta.email_candidatura,
        oggetto_email: meta.oggetto_email,
        link_candidatura: meta.link_candidatura,
        attachments: attachments,
        content_raw: pdfText ? pdfText.slice(0, 3000) : null,
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('interpelli')
        .upsert(record, { onConflict: 'wp_id' });

      if (upsertErr) {
        console.error(`Errore salvataggio interpello ${wpId}:`, upsertErr);
      } else {
        if (existing) itemsUpdated++;
        else itemsNew++;
      }
    }

    // Registra log di successo
    await supabase.from('sync_logs').insert({
      status: 'success',
      items_found: itemsFound,
      items_new: itemsNew,
      items_updated: itemsUpdated
    });

  } catch (err: any) {
    console.error('Errore durante la sincronizzazione:', err);
    errorMessage = err.message || String(err);

    try {
      await supabase.from('sync_logs').insert({
        status: 'error',
        items_found: itemsFound,
        items_new: itemsNew,
        items_updated: itemsUpdated,
        error_message: errorMessage
      });
    } catch (_) {}
  }

  return {
    success: errorMessage === null,
    items_found: itemsFound,
    items_new: itemsNew,
    items_updated: itemsUpdated,
    message: errorMessage === null
      ? `Sincronizzazione completata: ${itemsNew} nuovi, ${itemsUpdated} aggiornati su ${itemsFound} trovati`
      : `Errore: ${errorMessage}`
  };
}
