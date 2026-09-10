// Supabase Edge Function: Sync Interpelli
// Deployed to https://<project-ref>.supabase.co/functions/v1/sync

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WP_API_URL = "https://padova.istruzioneveneto.gov.it/wp-json/wp/v2/posts?categories=212&per_page=50";

interface Attachment {
  name: string;
  url: string;
  is_bando: boolean;
  is_domanda: boolean;
}

const MESI_ITALIANI: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4,
  maggio: 5, giugno: 6, luglio: 7, agosto: 8,
  settembre: 9, ottobre: 10, novembre: 11, dicembre: 12
};

function parseItalianDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  let str = dateStr.toLowerCase().trim();

  for (const [nomeMese, numMese] of Object.entries(MESI_ITALIANI)) {
    if (str.includes(nomeMese)) {
      const padMese = numMese.toString().padStart(2, '0');
      str = str.replace(new RegExp(`\\b${nomeMese}\\b`, 'gi'), padMese);
      break;
    }
  }

  const m = str.match(/(\d{1,2})[\/\-\.\s]+(\d{1,2})[\/\-\.\s]+(\d{2,4})/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;

    let hour = 23;
    let minute = 59;
    const timeM = str.match(/(?:ore\s*|alle\s*)?(\d{1,2})[:.](\d{2})\b/i);
    if (timeM) {
      const h = parseInt(timeM[1], 10);
      const min = parseInt(timeM[2], 10);
      if (h <= 24 && min < 60) {
        hour = h;
        minute = min;
      }
    }

    const date = new Date(year, month, day, hour, minute);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function extractClassiConcorso(text: string, title?: string | null): string[] {
  const found = new Set<string>();
  const knownCodes = ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI", "EEEE", "AAAA", "PPPP"];
  for (const code of knownCodes) {
    if (new RegExp(`\\b${code}\\b`, 'i').test(text)) {
      found.add(code.toUpperCase());
    }
  }

  const matches = text.match(/\b([AB][\s\-]?[0-9]{2,3})\b/gi);
  if (matches) {
    for (const m of matches) {
      let cleanCode = m.replace(/[\s\-]/g, '').toUpperCase();
      if (cleanCode.length === 3 && /^[0-9]+$/.test(cleanCode.slice(1))) {
        cleanCode = `${cleanCode[0]}0${cleanCode.slice(1)}`;
      }
      found.add(cleanCode);
    }
  }

  if (found.size > 0) return Array.from(found).sort();

  const candidates = [title?.toLowerCase() || '', text.toLowerCase()];
  for (const t of candidates) {
    if (t.includes("sostegno")) {
      if (t.includes("infanzia") || t.includes("matern")) { found.add("ADAA"); break; }
      else if (t.includes("primaria") || t.includes("elementare")) { found.add("ADEE"); break; }
      else if (t.includes("secondaria di primo grado") || t.includes("medie") || t.includes("i grado")) { found.add("ADMM"); break; }
      else if (t.includes("secondaria di secondo grado") || t.includes("superiori") || t.includes("ii grado")) { found.add("ADSS"); break; }
    } else if (t.includes("posto comune") || t.includes("comune")) {
      if (t.includes("infanzia") || t.includes("matern")) { found.add("AAAA"); break; }
      else if (t.includes("primaria") || t.includes("elementare")) { found.add("EEEE"); break; }
    }
  }
  return Array.from(found).sort();
}

function extractScadenza(title: string, body: string): [string | null, string | null] {
  const patterns = [
    /(?:entro|scadenza|rispost[ae]\s+entro)\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+(?:di\s+|del(?: giorno)?\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4})/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+)?(?:giorno\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4})\s+(?:alle\s+|ore\s+)?(\d{1,2}[:.]\d{2})?/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+del(?: giorno)?\s+(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /scadenza(?:\s+candidature)?:\s*(?:ore\s*(\d{1,2}[:.]\d{2}))?\s*(?:del\s+|il\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+|le\s+)?(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];

  for (const pat of patterns) {
    const m = title.match(pat) || (body && body.match(pat));
    if (m) {
      const raw = m[0];
      const parsed = parseItalianDate(raw);
      if (parsed) return [parsed.toISOString(), raw];
    }
  }
  return [null, null];
}

function parseAttachmentsFromHtml(html: string): Attachment[] {
  const attachments: Attachment[] = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const lowerUrl = url.toLowerCase();

    if (['.pdf', '.docx', '.doc', '.p7m'].some(ext => lowerUrl.includes(ext))) {
      const cleanTextLower = text.toLowerCase();
      const isDomanda = ['allegato', 'domanda', 'candidatura', 'modello'].some(k => cleanTextLower.includes(k) || lowerUrl.includes(k));
      const isBando = !isDomanda && ['interpello', 'avviso', 'bando', 'timbro', 'segnatura', 'signed'].some(k => cleanTextLower.includes(k) || lowerUrl.includes(k));

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

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const res = await fetch(WP_API_URL, {
      headers: { "User-Agent": "CercaInterpelliPadova/1.0 (supabase-edge-function)" }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} da WordPress API`);
    }

    const posts = await res.json();
    let itemsFound = posts.length;
    let itemsNew = 0;
    let itemsUpdated = 0;

    for (const p of posts) {
      const wpId = p.id;
      const title = p.title?.rendered || '';
      const slug = p.slug || '';
      const wpDate = p.date;
      const wpModified = p.modified || wpDate;
      const wpUrl = p.link || '';
      const contentHtml = p.content?.rendered || '';

      const { data: existing } = await supabase
        .from('interpelli')
        .select('wp_id, wp_modified')
        .eq('wp_id', wpId)
        .maybeSingle();

      if (existing && existing.wp_modified === wpModified) {
        continue;
      }

      const attachments = parseAttachmentsFromHtml(contentHtml);
      const classi = extractClassiConcorso(title + ' ' + contentHtml, title);
      const [scadenzaIso, scadenzaRaw] = extractScadenza(title, contentHtml);

      const record = {
        wp_id: wpId,
        title,
        slug,
        wp_date: wpDate,
        wp_modified: wpModified,
        wp_url: wpUrl,
        school_name: title.split(/\s*[–\-\:]\s*/)[0] || "Scuola Padova",
        classi_concorso: classi,
        scadenza: scadenzaIso,
        scadenza_raw: scadenzaRaw,
        attachments: attachments,
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('interpelli')
        .upsert(record, { onConflict: 'wp_id' });

      if (!upsertErr) {
        if (existing) itemsUpdated++;
        else itemsNew++;
      }
    }

    await supabase.from('sync_logs').insert({
      status: 'success',
      items_found: itemsFound,
      items_new: itemsNew,
      items_updated: itemsUpdated
    });

    return new Response(
      JSON.stringify({
        success: true,
        items_found: itemsFound,
        items_new: itemsNew,
        items_updated: itemsUpdated,
        message: `Sincronizzazione completata su Supabase Edge Function!`
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
