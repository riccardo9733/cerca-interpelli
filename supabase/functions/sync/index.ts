import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import padovaSchoolsData from "./padova_schools.json" with { type: "json" };

const WP_API_URL = "https://padova.istruzioneveneto.gov.it/wp-json/wp/v2/posts?categories=212&per_page=50";

interface Attachment {
  name: string;
  url: string;
  is_bando: boolean;
  is_domanda: boolean;
}

function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function normalizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`\.]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveSchoolFromCatalog(title: string): any | null {
  const normTitle = normalizeText(title);

  // 1. Ricerca per codice o plesso
  for (const school of padovaSchoolsData as any[]) {
    if (school.code && normTitle.includes(normalizeText(school.code))) {
      return school;
    }
    if (school.plessi) {
      for (const p of school.plessi) {
        if (normTitle.includes(normalizeText(p))) {
          return school;
        }
      }
    }
  }

  // 2. Ricerca per nome scuola esatto/normalizzato
  for (const school of padovaSchoolsData as any[]) {
    const normCatalogName = normalizeText(school.name);
    if (normCatalogName.length >= 4 && (normTitle.includes(normCatalogName) || normCatalogName.includes(normTitle))) {
      return school;
    }
  }

  // 3. Ricerca per alias (ordinati per lunghezza decrescente)
  const aliasList: { len: number; normAlias: string; school: any }[] = [];
  for (const school of padovaSchoolsData as any[]) {
    if (school.aliases) {
      for (const alias of school.aliases) {
        const normAlias = normalizeText(alias);
        if (normAlias.length >= 4) {
          aliasList.push({ len: normAlias.length, normAlias, school });
        }
      }
    }
  }
  aliasList.sort((a, b) => b.len - a.len);

  for (const item of aliasList) {
    if (normTitle.includes(item.normAlias)) {
      return item.school;
    }
  }

  return null;
}

function extractCleanSchoolName(title: string): string {
  const matched = resolveSchoolFromCatalog(title);
  if (matched) return matched.name;

  const cleanTitle = decodeHtmlEntities(title);
  const parts = cleanTitle.split(/\s*(?:[–\-\:]|&#8211;|&ndash;)\s*/);
  if (parts.length > 0 && parts[0].trim().length > 0) {
    return parts[0].trim();
  }

  return "Scuola Padova";
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

  const matches = text.match(/\b([A-Z]{1,2}[\s\-]?[0-9]{2,3})\b/gi);
  if (matches) {
    for (const m of matches) {
      let cleanCode = m.replace(/[\s\-]/g, '').toUpperCase();
      if (cleanCode.length === 3 && /^[0-9]+$/.test(cleanCode.slice(1))) {
        cleanCode = `${cleanCode[0]}0${cleanCode.slice(1)}`;
      }
      if (/^(?:A[0-9]{3}|A[A-Z][0-9]{2}|B[0-9]{3}|ADAA|ADEE|ADMM|ADSS|ADEI|AAAA|EEEE|PPPP)$/.test(cleanCode)) {
        found.add(cleanCode);
      }
    }
  }

  const ltCombined = `${title || ''} ${text}`.toLowerCase();

  if (ltCombined.includes("tedesco") || ltCombined.includes("lingua tedesca")) {
    if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
      found.add("AD24");
    } else {
      found.add("AD25");
    }
  }
  if (ltCombined.includes("inglese") || ltCombined.includes("lingua inglese")) {
    if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
      found.add("AA24");
    } else {
      found.add("AA25");
    }
  }
  if (ltCombined.includes("francese") || ltCombined.includes("lingua francese")) {
    if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
      found.add("AB24");
    } else {
      found.add("AB25");
    }
  }
  if (ltCombined.includes("spagnolo") || ltCombined.includes("lingua spagnola")) {
    if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
      found.add("AC24");
    } else {
      found.add("AC25");
    }
  }

  if (found.size > 0) return Array.from(found).sort();

  const candidates = [title?.toLowerCase() || '', text.toLowerCase()];
  for (const t of candidates) {
    if (t.includes("sostegno")) {
      if (t.includes("infanzia") || t.includes("matern")) { found.add("ADAA"); break; }
      else if (t.includes("primaria") || t.includes("elementare")) { found.add("ADEE"); break; }
      else if (t.includes("secondaria di primo grado") || t.includes("medie") || t.includes("i grado") || t.includes("sc. secondaria")) { found.add("ADMM"); break; }
      else if (t.includes("secondaria di secondo grado") || t.includes("superiori") || t.includes("ii grado")) { found.add("ADSS"); break; }
    } else if (t.includes("posto comune") || t.includes("comune")) {
      if (t.includes("infanzia") || t.includes("matern")) { found.add("AAAA"); break; }
      else if (t.includes("primaria") || t.includes("elementare")) { found.add("EEEE"); break; }
    }
  }
  return Array.from(found).sort();
}

function extractOrdineETipoPosto(title: string, fullText: string, classi: string[]): { ordine: string; tipoPosto: string } {
  let ordine = "Altro";
  const ltTitle = title.toLowerCase();
  const lt = fullText.toLowerCase();

  const isIC = ltTitle.includes(" ic ") || ltTitle.includes("ic ") || ltTitle.includes("i.c.") || ltTitle.includes("comprensivo") || lt.includes("istituto comprensivo");

  if (classi.some(c => ["ADAA", "AAAA"].includes(c)) || ltTitle.includes("infanzia") || ltTitle.includes("matern")) {
    ordine = "Infanzia";
  } else if (classi.some(c => ["ADEE", "EEEE"].includes(c)) || ltTitle.includes("primaria") || ltTitle.includes("elementar")) {
    ordine = "Primaria";
  } else if (
    classi.includes("ADMM") ||
    classi.some(c => ["AD25", "AA25", "AB25", "AC25", "A022", "A028", "A030", "A049", "A060"].includes(c)) ||
    ltTitle.includes("secondaria di primo grado") ||
    ltTitle.includes("medie") ||
    ltTitle.includes("i grado") ||
    ltTitle.includes("1° grado") ||
    ltTitle.includes("sec. 1") ||
    ltTitle.includes("sec 1") ||
    (isIC && (ltTitle.includes("sc. secondaria") || ltTitle.includes("secondaria") || ltTitle.includes("sec. secondaria")))
  ) {
    ordine = "Secondaria I grado";
  } else if (
    classi.includes("ADSS") ||
    classi.some(c => ["AD24", "AA24", "AB24", "AC24"].includes(c)) ||
    ltTitle.includes("secondaria di secondo grado") ||
    ltTitle.includes("superiori") ||
    ltTitle.includes("ii grado") ||
    ltTitle.includes("2° grado") ||
    ltTitle.includes("sec. 2") ||
    ltTitle.includes("sec 2")
  ) {
    ordine = "Secondaria II grado";
  } else if (ltTitle.includes("sc. secondaria") || ltTitle.includes("secondaria")) {
    ordine = isIC ? "Secondaria I grado" : "Secondaria II grado";
  } else if (lt.includes("secondaria di primo grado") || lt.includes("medie") || (isIC && lt.includes("secondaria"))) {
    ordine = "Secondaria I grado";
  } else if (lt.includes("secondaria di secondo grado") || lt.includes("superiori")) {
    ordine = "Secondaria II grado";
  } else if (lt.includes("infanzia") || lt.includes("matern")) {
    ordine = "Infanzia";
  } else if (lt.includes("primaria") || lt.includes("elementar")) {
    ordine = "Primaria";
  }

  const sostegnoCodes = ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI"];
  const hasSubjectClass = classi.some(c => !sostegnoCodes.includes(c));
  const isSostegno = classi.some(c => sostegnoCodes.includes(c)) ||
    (ltTitle.includes("sostegno") && !hasSubjectClass) ||
    (lt.includes("sostegno") && !hasSubjectClass && !ltTitle.includes("tedesco") && !ltTitle.includes("inglese") && !ltTitle.includes("francese") && !ltTitle.includes("spagnolo"));

  const tipoPosto = isSostegno ? "Sostegno" : "Posto Comune";

  return { ordine, tipoPosto };
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
      const rawTitle = p.title?.rendered || '';
      const title = decodeHtmlEntities(rawTitle);
      const slug = p.slug || '';
      const wpDate = p.date;
      const wpModified = p.modified || wpDate;
      const wpUrl = p.link || '';
      const contentHtml = p.content?.rendered || '';

      const { data: existing } = await supabase
        .from('interpelli')
        .select('wp_id, wp_modified, school_name, title')
        .eq('wp_id', wpId)
        .maybeSingle();

      const matchedSchool = resolveSchoolFromCatalog(title);
      const schoolName = matchedSchool ? matchedSchool.name : extractCleanSchoolName(title);

      if (existing && existing.wp_modified === wpModified && existing.school_name === schoolName && existing.title === title) {
        continue;
      }

      const attachments = parseAttachmentsFromHtml(contentHtml);
      const classi = extractClassiConcorso(title + ' ' + contentHtml, title);
      const { ordine, tipoPosto } = extractOrdineETipoPosto(title, title + ' ' + contentHtml, classi);
      let [scadenzaIso, scadenzaRaw] = extractScadenza(title, contentHtml);
      if (scadenzaIso && wpDate) {
        try {
          const scadDt = new Date(scadenzaIso);
          const wpDt = new Date(wpDate);
          if (scadDt.getFullYear() < wpDt.getFullYear()) {
            scadDt.setFullYear(wpDt.getFullYear());
            if (scadDt < wpDt) {
              scadDt.setFullYear(wpDt.getFullYear() + 1);
            }
            scadenzaIso = scadDt.toISOString();
          }
        } catch (_) {}
      }

      const record: Record<string, any> = {
        wp_id: wpId,
        title,
        slug,
        wp_date: wpDate,
        wp_modified: wpModified,
        wp_url: wpUrl,
        school_name: schoolName,
        school_code: matchedSchool ? matchedSchool.code : null,
        school_address: matchedSchool ? matchedSchool.address : null,
        school_city: matchedSchool ? matchedSchool.city : 'Padova',
        latitude: matchedSchool ? matchedSchool.lat : 45.4064,
        longitude: matchedSchool ? matchedSchool.lon : 11.8768,
        classi_concorso: classi,
        ordine_scuola: ordine,
        tipo_posto: tipoPosto,
        attachments: attachments,
        updated_at: new Date().toISOString()
      };

      if (scadenzaIso) {
        record.scadenza = scadenzaIso;
        record.scadenza_raw = scadenzaRaw;
      } else if (!existing) {
        record.scadenza = null;
        record.scadenza_raw = null;
      }

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

    // Cleanup expired (>48h)
    try {
      const now = new Date();
      const FORTY_EIGHT_HOURS_MS = 48 * 3600 * 1000;
      const { data: rows } = await supabase.from('interpelli').select('id, wp_date, scadenza');

      if (rows && rows.length > 0) {
        const idsToDelete: number[] = [];
        rows.forEach(row => {
          let isExpired = false;
          let expiredForMs = 0;
          if (row.scadenza) {
            const expDt = new Date(row.scadenza);
            if (!isNaN(expDt.getTime())) {
              expiredForMs = now.getTime() - expDt.getTime();
              isExpired = expiredForMs > 0;
            }
          } else if (row.wp_date) {
            const wpDt = new Date(row.wp_date);
            if (!isNaN(wpDt.getTime())) {
              expiredForMs = now.getTime() - (wpDt.getTime() + 7 * 86400 * 1000);
              isExpired = expiredForMs > 0;
            }
          }
          if (isExpired && expiredForMs >= FORTY_EIGHT_HOURS_MS) {
            idsToDelete.push(row.id);
          }
        });
        if (idsToDelete.length > 0) {
          await supabase.from('interpelli').delete().in('id', idsToDelete);
        }
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        items_found: itemsFound,
        items_new: itemsNew,
        items_updated: itemsUpdated,
        message: `Sincronizzazione completata su Supabase Edge Function!`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
