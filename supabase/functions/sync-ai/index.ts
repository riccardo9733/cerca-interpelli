import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3";
import pdfParse from "npm:pdf-parse@1.1.1/lib/pdf-parse.js";
import padovaSchoolsData from "./padova_schools.json" with { type: "json" };
const OPENROUTER_MODEL = (Deno.env.get("OPENROUTER_MODEL") || "").trim();
// --- Schema Zod tollerante e robusto ---
export const PositionSchema = z.object({
  codice_classe: z.string().nullable().default(null),
  ordine_scuola: z.string().nullable().default(null),
  tipo_posto: z.string().nullable().default(null),
  posti: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseInt(v, 10) || null : v).nullable().default(1),
  ore: z.string().nullable().default(null),
  periodo: z.string().nullable().default(null),
  note: z.string().nullable().default(null)
});

export const InterpelloSchema = z.object({
  classi_concorso: z.array(z.string()).default([]),
  scadenza: z.string().nullable().default(null),
  scadenza_raw: z.string().nullable().default(null),
  periodo_desc: z.string().nullable().default(null),
  periodo_inizio: z.string().nullable().default(null),
  periodo_fine: z.string().nullable().default(null),
  school_name: z.string().nullable().default(null),
  school_code: z.string().nullable().default(null),
  school_city: z.string().nullable().default(null),
  school_address: z.string().nullable().default(null),
  ore_settimanali: z.string().nullable().default(null),
  posti_disponibili: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseInt(v, 10) || null : v).nullable().default(null),
  email_candidatura: z.string().nullable().default(null),
  oggetto_email: z.string().nullable().default(null),
  link_candidatura: z.string().nullable().default(null),
  ordine_scuola: z.string().nullable().default(null),
  tipo_posto: z.string().nullable().default(null),
  posti_dettaglio: z.array(PositionSchema).default([])
});

export type ExtractedInterpello = z.infer<typeof InterpelloSchema>;

function normalizeOrdine(val?: string | null): string {
  if (!val) return "Altro";
  const s = val.toLowerCase();
  if (s.includes("infanzia") || s.includes("matern")) return "Infanzia";
  if (s.includes("primaria") || s.includes("elementar")) return "Primaria";
  if (s.includes("primo") || s.includes("i grado") || s.includes("medie") || s.includes("1")) return "Secondaria I grado";
  if (s.includes("secondo") || s.includes("ii grado") || s.includes("superiori") || s.includes("2")) return "Secondaria II grado";
  return "Altro";
}

function normalizeTipoPosto(val?: string | null): string {
  if (!val) return "Posto Comune";
  const s = val.toLowerCase();
  if (s.includes("sostegno")) return "Sostegno";
  if (s.includes("ata")) return "ATA";
  return "Posto Comune";
}

export function isValidMiurClassCode(code: string): boolean {
  const c = code.toUpperCase().trim();
  if (["ADAA", "ADEE", "ADMM", "ADSS", "ADEI", "EEEE", "AAAA", "PPPP"].includes(c)) return true;
  
  // A001 - A066
  const mA = c.match(/^A0([0-5][0-9]|6[0-6])$/);
  if (mA) return true;

  // B001 - B032
  const mB = c.match(/^B0([0-2][0-9]|3[0-2])$/);
  if (mB) return true;

  // Lingue straniere (es. AA24, AB25, AD24, etc.) e Strumento (es. AJ55, A055)
  if (/^(?:AA|AB|AC|AD|AE|AF|AG|AH|AI|AJ|AK)(?:24|25|55|56)$/.test(c)) return true;

  return false;
}

export function getOrdineByClasse(code: string): string {
  const c = code.toUpperCase().trim();
  if (["ADAA", "AAAA"].includes(c)) return "Infanzia";
  if (["ADEE", "EEEE"].includes(c)) return "Primaria";
  if (["ADMM", "A022", "A028", "A030", "A049", "A060", "A056"].includes(c) || c.endsWith("25") || c.endsWith("56")) {
    return "Secondaria I grado";
  }
  if (
    ["ADSS"].includes(c) || 
    c.endsWith("24") || 
    c.endsWith("55") || 
    /^B0[0-3][0-9]$/.test(c) || 
    (/^A0[0-6][0-9]$/.test(c) && !["A022", "A028", "A030", "A049", "A060", "A056"].includes(c))
  ) {
    return "Secondaria II grado";
  }
  return "Altro";
}

function mergeIdenticalPositions(positions: any[]): any[] {
  if (!positions || positions.length === 0) return [];
  const merged: any[] = [];
  for (const pos of positions) {
    const key = `${pos.codice_classe || ''}_${pos.ore || ''}_${pos.periodo || ''}_${pos.ordine_scuola || ''}_${pos.tipo_posto || ''}`;
    const existing = merged.find(m => 
      `${m.codice_classe || ''}_${m.ore || ''}_${m.periodo || ''}_${m.ordine_scuola || ''}_${m.tipo_posto || ''}` === key
    );
    if (existing) {
      existing.posti = (existing.posti || 1) + (pos.posti || 1);
      if (pos.note && !existing.note?.includes(pos.note)) {
        existing.note = existing.note ? `${existing.note}; ${pos.note}` : pos.note;
      }
    } else {
      merged.push({ ...pos });
    }
  }
  return merged;
}

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

function resolveSchoolFromCatalog(title: string, schoolNameExtracted?: string | null): any | null {
  const normTitle = normalizeText(title + ' ' + (schoolNameExtracted || ''));

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

  for (const school of padovaSchoolsData as any[]) {
    const normCatalogName = normalizeText(school.name);
    if (normCatalogName.length >= 4 && (normTitle.includes(normCatalogName) || normCatalogName.includes(normTitle))) {
      return school;
    }
  }

  const GENERIC_CITY_ALIASES = new Set(["este", "padova", "cittadella", "monselice", "camposampiero", "abano", "terme", "selvazzano", "vigodarzere", "cadoneghe", "albignasego"]);

  const aliasList: { len: number; normAlias: string; school: any }[] = [];
  for (const school of padovaSchoolsData as any[]) {
    if (school.aliases) {
      for (const alias of school.aliases) {
        const normAlias = normalizeText(alias);
        if (normAlias.length >= 4 && !GENERIC_CITY_ALIASES.has(normAlias)) {
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

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

function extractJpegsFromPdf(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer);
  const jpegs: string[] = [];
  let i = 0;
  while (i < bytes.length - 3) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
      const start = i;
      let end = -1;
      for (let j = start + 2; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
          end = j + 2;
          break;
        }
      }
      if (end !== -1) {
        const jpegSlice = bytes.subarray(start, end);
        if (jpegSlice.length > 5000) {
          jpegs.push(uint8ArrayToBase64(jpegSlice));
        }
        i = end;
        continue;
      }
    }
    i++;
  }
  return jpegs;
}

// Download PDF buffer, testo digitale ed eventuali immagini scansionate
async function downloadPdf(url: string): Promise<{ buffer: ArrayBuffer | null; text: string | null; jpegs: string[] }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "CercaInterpelliPadova/1.0 (supabase-edge-function-sync-ai)" }
    });
    if (!res.ok) return { buffer: null, text: null, jpegs: [] };
    const arrayBuffer = await res.arrayBuffer();
    let text: string | null = null;
    try {
      const pdfData = await pdfParse(new Uint8Array(arrayBuffer));
      text = pdfData.text || null;
    } catch (e) {
      console.warn(`[PDF-PARSER] Impossibile estrarre testo puro con pdf-parse:`, e);
    }
    const jpegs = extractJpegsFromPdf(arrayBuffer);
    if (jpegs.length > 0) {
      console.log(`[PDF-PARSER] Estratte ${jpegs.length} immagini scansionate dal PDF per analisi visiva.`);
    }
    return { buffer: arrayBuffer, text, jpegs };
  } catch (err) {
    console.warn(`[PDF-PARSER] Errore download PDF da ${url}:`, err);
    return { buffer: null, text: null, jpegs: [] };
  }
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

    const isCEST = month >= 2 && month <= 9;
    const offsetHours = isCEST ? 2 : 1;
    const utcDate = new Date(Date.UTC(year, month, day, hour - offsetHours, minute));
    if (!isNaN(utcDate.getTime())) return utcDate;
  }
  return null;
}

function extractScadenza(title: string, body: string): [string | null, string | null] {
  const patterns = [
    /(?:entro|scadenza|rispost[ae]\s+entro)\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+(?:di\s+|del(?: giorno)?\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4})/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+)?(?:giorno\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4})\s+(?:alle\s+|ore\s+)?(\d{1,2}[:.]\d{2})?/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+del(?: giorno)?\s+(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /scadenza(?:\s+candidature)?:\s*(?:ore\s*(\d{1,2}[:.]\d{2}))?\s*(?:del\s+|il\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+|le\s+)?(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:termine\s+presentazione|presentare\s+entro|invio\s+entro)\s+(?:il\s+|ore\s+\d{1,2}[:.]\d{2}\s+del\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
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

// Estrazione con OpenRouter (Testuale o Multimodale per PDF scansionati)
// Estrazione con OpenRouter usando il modello OPENROUTER_MODEL configurato nei secret
async function extractWithOpenRouter(
  title: string,
  contentHtml: string,
  pdfText: string | null,
  pdfUrl: string | null,
  apiKey: string,
  jpegImages: string[] = []
): Promise<{ metadata: ExtractedInterpello | null; error?: string; modelUsed: string }> {
  const systemPrompt = "Sei un parser esperto di interpelli scolastici italiani (MIUR e Ufficio Scolastico di Padova). Rispondi ESCLUSIVAMENTE in formato JSON valido che rispetta lo schema fornito, senza testo introduttivo o markdown.";
  
  const extractionInstructions = `Analizza questo interpello scolastico ed estrai con la massima precisione i dettagli.
Compila lo schema JSON con questi campi:
- "posti_dettaglio": Array di cattedre/posizioni richieste.
  Ciascun elemento:
  - "codice_classe": Codice classe concorso MIUR (es. "A040", "A042", "ADEE", "EEEE", "ADSS", "A028", etc.).
  - "ordine_scuola": uno tra "Infanzia", "Primaria", "Secondaria I grado", "Secondaria II grado".
  - "tipo_posto": "Sostegno" o "Posto Comune" o "ATA".
  - "posti": numero intero di posti (es. 1, 2, 5).
  - "ore": orario settimanale specifico (es. "14 ore settimanali", "24/24H ore", "12 ore"). Fai molta attenzione ad estrarre le ore!
  - "periodo": durata supplenza (es. "Dal 16/09/2026 al 30/06/2027" o "Fino al 30/06/2027").
  - "note": eventuali note specifiche o requisiti (es. "LIS", plesso specifico).
- "classi_concorso": Array di codici classe rilevati (es. ["A042"]).
- "scadenza_raw": Testo esatto della scadenza (es. "entro le ore 09:00 di MARTEDI 15/09/2026"). IMPORTANTE: Cerca frasi come "entro le ore...", "entro il giorno...", "termine presentazione...", "scadenza...".
- "scadenza": Data/ora di scadenza in formato ISO 8601 (es. "2026-09-15T07:00:00.000Z") o null se incerto.
- "periodo_desc": Sintesi durata supplenza (es. "Dal 16/09/2026 al 30/06/2027").
- "periodo_inizio": Data inizio YYYY-MM-DD o null.
- "periodo_fine": Data fine YYYY-MM-DD o null.
- "school_name": Nome istituto (es. "I.I.S. Euganeo").
- "school_code": Codice meccanografico scuola o null.
- "school_city": Comune scuola.
- "school_address": Indirizzo o null.
- "ore_settimanali": Orario complessivo (es. "12 ore settimanali" o "24/24H ore").
- "posti_disponibili": Totale posti complessivi (numero intero).
- "email_candidatura": Email/PEC per la candidatura o null.
- "oggetto_email": Oggetto email richiesto (es. "Disponibilità per supplenza A042").
- "link_candidatura": Link form Google o portale Argo / Nuvola se indicato (es. "https://madinterpello.portaleargo.it/").
- "ordine_scuola": "Infanzia", "Primaria", "Secondaria I grado", "Secondaria II grado".
- "tipo_posto": "Sostegno" o "Posto Comune".`;

  const modelToUse = (Deno.env.get("OPENROUTER_MODEL") || OPENROUTER_MODEL).trim();
  if (!modelToUse) {
    console.error("[SYNC-AI] ERRORE: Il secret OPENROUTER_MODEL non è configurato nei Secrets di Supabase!");
    return { metadata: null, error: "Secret OPENROUTER_MODEL non configurato nei Secrets di Supabase", modelUsed: "non specificato" };
  }

  try {
    const fullText = `TITOLO: ${title}\n\nTESTO POST WP:\n${contentHtml.replace(/<[^>]+>/g, ' ')}\n\nTESTO BANDO PDF:\n${pdfText || '(Nessun testo digitale nel PDF: consulta il documento/immagine allegata o il titolo per estrarre le informazioni)'}`;
    const userMessagesContent = `${extractionInstructions}\n\nTESTO DEL BANDO:\n${fullText.slice(0, 7000)}`;

    const hasImages = Array.isArray(jpegImages) && jpegImages.length > 0;
    console.log(`[SYNC-AI] Chiamata OpenRouter con modello: ${modelToUse} (hasImages=${hasImages}, count=${jpegImages?.length || 0}, pdfUrl=${pdfUrl ? 'presente' : 'assente'})`);

    let userContent: any;
    if (hasImages) {
      userContent = [
        { type: "text", text: userMessagesContent },
        ...jpegImages.slice(0, 3).map(imgBase64 => ({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imgBase64}`
          }
        }))
      ];
    } else if (pdfUrl) {
      userContent = [
        { type: "text", text: userMessagesContent },
        { type: "file", file: { url: pdfUrl } }
      ];
    } else {
      userContent = userMessagesContent;
    }

    let response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://cerca-interpelli.local",
        "X-Title": "Cerca Interpelli Padova AI Scanner"
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        plugins: hasImages ? undefined : [
          { id: "file-parser", pdf: { engine: "cloudflare-ai" } }
        ],
        response_format: { type: "json_object" }
      })
    });

    // Se fallisce (es. il modello non supporta immagini o errore plugin), esegui fallback trasparente su solo testo
    if (!response.ok && (hasImages || pdfUrl)) {
      console.warn(`[SYNC-AI] Chiamata multimodale fallita (${response.status}), fallback su solo testo...`);
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://cerca-interpelli.local",
          "X-Title": "Cerca Interpelli Padova AI Scanner"
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessagesContent }
          ],
          response_format: { type: "json_object" }
        })
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[OPENROUTER-AI] Errore HTTP ${response.status}:`, errText);
      return { metadata: null, error: `HTTP ${response.status}: ${errText}`, modelUsed: modelToUse };
    }

    const jsonRes = await response.json();
    const rawContent = jsonRes?.choices?.[0]?.message?.content;
    if (!rawContent) {
      console.warn("[OPENROUTER-AI] Risposta vuota da OpenRouter.");
      return { metadata: null, error: "Nessun contenuto in choices[0].message.content", modelUsed: modelToUse };
    }

    const cleanJsonStr = rawContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const parsedData = JSON.parse(cleanJsonStr);

    const validated = InterpelloSchema.safeParse(parsedData);
    if (!validated.success) {
      console.warn("[ZOD-VALIDATION] Errore di validazione dello schema:", validated.error.format());
      return { metadata: null, error: `Zod validation error: ${JSON.stringify(validated.error.format())}`, modelUsed: modelToUse };
    }

    validated.data.classi_concorso = validated.data.classi_concorso.filter(isValidMiurClassCode);
    return { metadata: validated.data, modelUsed: modelToUse };
  } catch (err: any) {
    console.error("[OPENROUTER-AI] Eccezione estrazione AI:", err);
    return { metadata: null, error: err.message || String(err), modelUsed: modelToUse };
  }
}

function extractPositionsBlocks(text: string): any[] {
  const positions: any[] = [];

  // 1. FORMATO TABELLARE (es: San Martino di Lupari)
  const tableRegex = /\b(ADAA|ADEE|ADMM|ADSS|AAAA|EEEE|PPPP|[AB]\d{2,3})\s+([A-Z\s\+]+?)\s+(\d+)\s+(\d{1,2}(?:\/\d{1,2})?\s*[hH]|\d{1,2}\s*ore)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRegex.exec(text)) !== null) {
    const codiceClasse = tm[1].toUpperCase();
    const tipoRaw = tm[2].replace(/\s+/g, ' ').trim();
    const postiNum = parseInt(tm[3], 10);
    const oreStr = tm[4].trim();
    const inizioStr = tm[5].trim();
    const fineStr = tm[6].trim();

    const ordine = getOrdineByClasse(codiceClasse);

    let tipoPosto = "Posto Comune";
    if (tipoRaw.toLowerCase().includes("sostegno") || ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI"].includes(codiceClasse)) {
      tipoPosto = "Sostegno";
    }

    positions.push({
      codice_classe: codiceClasse,
      ordine_scuola: ordine,
      tipo_posto: tipoPosto,
      posti: postiNum,
      ore: oreStr.toLowerCase().endsWith('h') ? `${oreStr} ore` : oreStr,
      periodo: `Dal ${inizioStr} al ${fineStr}`,
      note: tipoRaw.includes("LIS") ? "Conoscenza LIS richiesta" : null
    });
  }

  if (positions.length > 0) {
    return mergeIdenticalPositions(positions);
  }

  // 2. FORMATO PER SEZIONI E PUNTI ELENCO
  const sections = text.split(/(?=\b(?:ADAA|ADEE|ADMM|ADSS|AAAA|EEEE|PPPP|[AB]\d{2,3})\s*[-–—])/gi);
  for (const sec of sections) {
    const headerM = sec.match(/^\s*(ADAA|ADEE|ADMM|ADSS|AAAA|EEEE|PPPP|[AB]\d{2,3})\s*[-–—]\s*([^\n\r]+)/i);
    if (headerM) {
      const codiceClasse = headerM[1].toUpperCase();
      const ordine = getOrdineByClasse(codiceClasse);
      const tipoPosto = ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI"].includes(codiceClasse) || headerM[2].toLowerCase().includes("sostegno") ? "Sostegno" : "Posto Comune";

      const bulletRegex = /[o\-\*•]\s*(\d+)\s+post[oi]\s+([0-9/]+\s*[hH]|[0-9]+\s*ore)\s+(?:dal\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+)?(?:al|fino\s+al)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})(?:[^\n\r]*)/gi;
      let bMatch: RegExpExecArray | null;
      while ((bMatch = bulletRegex.exec(sec)) !== null) {
        const postiNum = parseInt(bMatch[1], 10);
        const oreStr = bMatch[2].trim();
        const inizioStr = bMatch[3] ? bMatch[3].trim() : null;
        const fineStr = bMatch[4].trim();

        positions.push({
          codice_classe: codiceClasse,
          ordine_scuola: ordine,
          tipo_posto: tipoPosto,
          posti: postiNum,
          ore: oreStr.toLowerCase().endsWith('h') ? `${oreStr} ore` : oreStr,
          periodo: inizioStr ? `Dal ${inizioStr} al ${fineStr}` : `Fino al ${fineStr}`,
          note: sec.includes("LIS") ? "Conoscenza LIS richiesta" : null
        });
      }
    }
  }

  if (positions.length > 0) {
    return mergeIdenticalPositions(positions);
  }

  return [];
}

// Fallback regex
function extractClassiConcorsoRegex(text: string): string[] {
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
      if (isValidMiurClassCode(cleanCode)) {
        found.add(cleanCode);
      }
    }
  }

  const tLower = text.toLowerCase();
  if (tLower.includes("sostegno")) {
    if (tLower.includes("primaria") || tLower.includes("elementar")) found.add("ADEE");
    else if (tLower.includes("infanzia") || tLower.includes("matern")) found.add("ADAA");
    else if (tLower.includes("secondaria di primo grado") || tLower.includes("medie")) found.add("ADMM");
    else if (tLower.includes("secondaria di secondo grado") || tLower.includes("superiori")) found.add("ADSS");
  }
  if (tLower.includes("posto comune") || tLower.includes("comune")) {
    if (tLower.includes("primaria") || tLower.includes("elementar")) found.add("EEEE");
    else if (tLower.includes("infanzia") || tLower.includes("matern")) found.add("AAAA");
  }

  return Array.from(found).sort();
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
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Estrai wp_id da payload POST o query param
    let targetWpId: number | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.wp_id) targetWpId = Number(body.wp_id);
      } catch (_) {
        // Nessun body json
      }
    }

    if (!targetWpId) {
      const url = new URL(req.url);
      const qWpId = url.searchParams.get("wp_id");
      if (qWpId) targetWpId = Number(qWpId);
    }

    if (!targetWpId || isNaN(targetWpId)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "wp_id mancante o non valido. Specificare un bando da scansionare, es: { wp_id: 32894 } o ?wp_id=32894" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SYNC-AI] Richiesta scansione IA mirata per wp_id=${targetWpId}`);

    // 2. Recupera i dettagli del post da WordPress API
    let postData: any = null;
    try {
      const wpRes = await fetch(`https://padova.istruzioneveneto.gov.it/wp-json/wp/v2/posts/${targetWpId}`, {
        headers: { "User-Agent": "CercaInterpelliPadova/1.0 (supabase-edge-function-sync-ai)" }
      });
      if (wpRes.ok) {
        postData = await wpRes.json();
      }
    } catch (e) {
      console.warn(`[SYNC-AI] Impossibile recuperare post ${targetWpId} da WP API:`, e);
    }

    // Se non trovato su WP, prova a recuperare i dati esistenti da Supabase
    let title = "";
    let contentHtml = "";
    let slug = "";
    let wpDate = new Date().toISOString();
    let wpModified = wpDate;
    let wpUrl = "";
    let existingAttachments: Attachment[] = [];

    if (postData) {
      title = decodeHtmlEntities(postData.title?.rendered || '');
      contentHtml = postData.content?.rendered || '';
      slug = postData.slug || '';
      wpDate = postData.date || wpDate;
      wpModified = postData.modified || wpDate;
      wpUrl = postData.link || '';
    } else {
      const { data: dbItem } = await supabase
        .from('interpelli')
        .select('*')
        .eq('wp_id', targetWpId)
        .limit(1)
        .maybeSingle();

      if (!dbItem) {
        return new Response(
          JSON.stringify({ success: false, error: `Interpello wp_id=${targetWpId} non trovato né su WordPress né nel database.` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      title = dbItem.title || '';
      contentHtml = dbItem.content_raw || '';
      slug = dbItem.slug || '';
      wpDate = dbItem.wp_date || wpDate;
      wpModified = dbItem.wp_modified || wpDate;
      wpUrl = dbItem.wp_url || '';
      if (dbItem.attachments) {
        existingAttachments = typeof dbItem.attachments === 'string' ? JSON.parse(dbItem.attachments) : dbItem.attachments;
      }
    }

    // 3. Estrai o recupera gli allegati
    const attachments = postData ? parseAttachmentsFromHtml(contentHtml) : (existingAttachments.length > 0 ? existingAttachments : parseAttachmentsFromHtml(contentHtml));
    const bandoAtt = attachments.find(a => a.is_bando) || attachments.find(a => a.url.toLowerCase().endsWith('.pdf')) || attachments[0];

    // 4. Download PDF
    let pdfText: string | null = null;
    let pdfBuffer: ArrayBuffer | null = null;
    let pdfJpegs: string[] = [];
    if (bandoAtt && bandoAtt.url.toLowerCase().includes('.pdf')) {
      console.log(`[SYNC-AI] Download PDF bando per wp_id=${targetWpId}: ${bandoAtt.url}`);
      const downloadRes = await downloadPdf(bandoAtt.url);
      pdfBuffer = downloadRes.buffer;
      pdfText = downloadRes.text;
      pdfJpegs = downloadRes.jpegs || [];
    }

    // 5. Estrazione con IA (OpenRouter con modello da secret OPENROUTER_MODEL)
    let aiMetadata: ExtractedInterpello | null = null;
    let aiError: string | null = null;
    let modelUsed: string | null = null;
    if (openrouterKey) {
      console.log(`[SYNC-AI] Avvio analisi con OpenRouter per wp_id=${targetWpId}...`);
      const aiRes = await extractWithOpenRouter(title, contentHtml, pdfText, bandoAtt?.url || null, openrouterKey, pdfJpegs);
      aiMetadata = aiRes.metadata;
      aiError = aiRes.error || null;
      modelUsed = aiRes.modelUsed;
    } else {
      console.warn("[SYNC-AI] OPENROUTER_API_KEY non configurata nei secrets Supabase!");
      aiError = "OPENROUTER_API_KEY non configurata nei secrets Supabase";
    }

    // 6. Preparazione posizioni e dati unificati
    const fullSearchText = title + ' ' + contentHtml + ' ' + (pdfText || '');
    const fallbackClassi = extractClassiConcorsoRegex(fullSearchText);
    const finalClassi = (aiMetadata?.classi_concorso && aiMetadata.classi_concorso.length > 0)
      ? aiMetadata.classi_concorso
      : fallbackClassi;

    const finalSchoolName = aiMetadata?.school_name || extractCleanSchoolName(title);
    const catalogMatch = resolveSchoolFromCatalog(title, finalSchoolName);

    const fallbackBlocks = extractPositionsBlocks(pdfText || fullSearchText);

    let rawPositions = (aiMetadata?.posti_dettaglio && aiMetadata.posti_dettaglio.length > 0)
      ? aiMetadata.posti_dettaglio
      : (fallbackBlocks.length > 0 ? fallbackBlocks : [{
          codice_classe: finalClassi[0] || null,
          ordine_scuola: aiMetadata?.ordine_scuola,
          tipo_posto: aiMetadata?.tipo_posto,
          posti: aiMetadata?.posti_disponibili || 1,
          ore: aiMetadata?.ore_settimanali,
          periodo: aiMetadata?.periodo_desc,
          note: null
        }]);

    // Normalizza e assegna gradi e tipi posto: la classe MIUR ha sempre priorità se riconosciuta
    const preparedPositions = rawPositions.map(pos => {
      const codiceClasse = pos.codice_classe ? pos.codice_classe.toUpperCase() : (finalClassi[0] || null);
      const miurOrdine = codiceClasse ? getOrdineByClasse(codiceClasse) : "Altro";
      const calculatedOrdine = miurOrdine !== "Altro" 
        ? miurOrdine 
        : (pos.ordine_scuola ? normalizeOrdine(pos.ordine_scuola) : "Altro");

      return {
        ...pos,
        codice_classe: codiceClasse,
        ordine_scuola: calculatedOrdine,
        tipo_posto: normalizeTipoPosto(pos.tipo_posto)
      };
    });

    // Applica accorpamento posizioni identiche
    const mergedPositions = mergeIdenticalPositions(preparedPositions);

    // Risoluzione Scadenza (Ibrida: IA + Regex deterministico)
    let finalScadenza: string | null = null;
    let finalScadenzaRaw: string | null = null;

    if (aiMetadata?.scadenza_raw) {
      finalScadenzaRaw = aiMetadata.scadenza_raw;
      const parsedAiDate = parseItalianDate(aiMetadata.scadenza_raw);
      if (parsedAiDate) {
        finalScadenza = parsedAiDate.toISOString();
      }
    }

    if (!finalScadenza && aiMetadata?.scadenza) {
      const d = new Date(aiMetadata.scadenza);
      if (!isNaN(d.getTime())) {
        finalScadenza = d.toISOString();
        if (!finalScadenzaRaw) finalScadenzaRaw = aiMetadata.scadenza;
      }
    }

    if (!finalScadenza) {
      const [regexIso, regexRaw] = extractScadenza(title, pdfText || contentHtml);
      if (regexIso) {
        finalScadenza = regexIso;
        if (!finalScadenzaRaw) finalScadenzaRaw = regexRaw;
      }
    }

    // Risoluzione Email, Oggetto, Link candidatura (Ibrida: IA + Regex)
    let finalEmail = aiMetadata?.email_candidatura || null;
    let finalOggetto = aiMetadata?.oggetto_email || null;
    let finalLink = aiMetadata?.link_candidatura || null;

    if (!finalEmail && fullSearchText) {
      const mEmail = fullSearchText.match(/([a-zA-Z0-9_.+-]+@(?:istruzione\.it|pec\.istruzione\.it|[a-zA-Z0-9-]+\.edu\.it))/i);
      if (mEmail) finalEmail = mEmail[1];
    }
    if (!finalLink && fullSearchText) {
      const mLink = fullSearchText.match(/https?:\/\/[^\s<>"']*(?:portaleargo\.it|google\.com\/forms|forms\.gle|nuvola\.madisoft\.it)[^\s<>"']*/i);
      if (mLink) finalLink = mLink[0];
    }
    if (!finalOggetto && fullSearchText) {
      const mSubj = fullSearchText.match(/oggetto\s+[“"«]([^"”»]+)[”"»]/i);
      if (mSubj) finalOggetto = mSubj[1].trim();
    }

    // 7. Upsert nel database Supabase
    const upsertedRecords: any[] = [];
    for (let idx = 0; idx < mergedPositions.length; idx++) {
      const pos = mergedPositions[idx];
      const itemKey = `${targetWpId}-${idx + 1}`;

      let posClassi = finalClassi;
      if (pos.codice_classe && isValidMiurClassCode(pos.codice_classe)) {
        posClassi = [pos.codice_classe.toUpperCase()];
      }

      const record: Record<string, any> = {
        wp_id: targetWpId,
        item_key: itemKey,
        position_index: idx + 1,
        title,
        slug,
        wp_date: wpDate,
        wp_modified: wpModified,
        wp_url: wpUrl,
        school_name: catalogMatch ? catalogMatch.name : finalSchoolName,
        school_code: catalogMatch ? catalogMatch.code : (aiMetadata?.school_code || null),
        school_address: catalogMatch ? catalogMatch.address : (aiMetadata?.school_address || null),
        school_city: catalogMatch ? catalogMatch.city : (aiMetadata?.school_city || 'Padova'),
        latitude: catalogMatch ? catalogMatch.lat : 45.4064,
        longitude: catalogMatch ? catalogMatch.lon : 11.8768,
        classi_concorso: posClassi,
        ordine_scuola: pos.ordine_scuola || normalizeOrdine(aiMetadata?.ordine_scuola),
        tipo_posto: pos.tipo_posto || normalizeTipoPosto(aiMetadata?.tipo_posto),
        posti_disponibili: pos.posti || aiMetadata?.posti_disponibili || null,
        ore_settimanali: pos.ore || aiMetadata?.ore_settimanali || null,
        periodo_desc: pos.periodo || aiMetadata?.periodo_desc || null,
        periodo_inizio: aiMetadata?.periodo_inizio || null,
        periodo_fine: aiMetadata?.periodo_fine || null,
        email_candidatura: finalEmail,
        oggetto_email: finalOggetto,
        link_candidatura: finalLink,
        notes: pos.note || null,
        posti_dettaglio: mergedPositions,
        scadenza: finalScadenza,
        scadenza_raw: finalScadenzaRaw,
        attachments: attachments,
        content_raw: pdfText ? pdfText.slice(0, 3000) : contentHtml.slice(0, 3000),
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('interpelli')
        .upsert(record, { onConflict: 'item_key' });

      if (upsertErr) {
        console.error(`[SYNC-AI] Errore salvataggio record ${itemKey}:`, upsertErr);
        throw upsertErr;
      }
      upsertedRecords.push(record);
    }

    // Se prima c'erano più posizioni per questo wp_id, elimina quelle in eccesso
    const { error: deleteErr } = await supabase
      .from('interpelli')
      .delete()
      .eq('wp_id', targetWpId)
      .gt('position_index', mergedPositions.length);

    if (deleteErr) {
      console.warn(`[SYNC-AI] Avviso pulizia vecchie posizioni per wp_id=${targetWpId}:`, deleteErr);
    }

    // 8. Recupera e restituisci i record aggiornati formattati da Supabase
    const { data: finalRows, error: fetchErr } = await supabase
      .from('interpelli')
      .select('*')
      .eq('wp_id', targetWpId)
      .order('position_index', { ascending: true });

    if (fetchErr) throw fetchErr;

    console.log(`[SYNC-AI] Scansione IA completata con successo per wp_id=${targetWpId}: ${finalRows?.length || 0} card aggiornate`);

    return new Response(
      JSON.stringify({
        success: true,
        wp_id: targetWpId,
        ai_extracted: !!aiMetadata,
        ai_error: aiError,
        model_used: modelUsed,
        items_count: finalRows?.length || 0,
        updated_items: finalRows || [],
        message: `Scansione IA completata con successo per il bando wp_id=${targetWpId}!`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[SYNC-AI] Errore generale:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
