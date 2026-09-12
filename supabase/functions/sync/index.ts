import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdfParse from "npm:pdf-parse@1.1.1/lib/pdf-parse.js";
import padovaSchoolsData from "./padova_schools.json" with { type: "json" };

const WP_BASE_URL = "https://padova.istruzioneveneto.gov.it/wp-json/wp/v2/posts";
const WP_CATEGORY = "212";

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

function isSameDate(d1: string | null | undefined, d2: string | null | undefined): boolean {
  if (!d1 || !d2) return false;
  const norm1 = d1.trim().replace(/\.\d+/, '').replace(/(\+[0-9:]+|Z)$/, '');
  const norm2 = d2.trim().replace(/\.\d+/, '').replace(/(\+[0-9:]+|Z)$/, '');
  return norm1 === norm2;
}

function resolveSchoolFromCatalog(title: string): any | null {
  const normTitle = normalizeText(title);

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
    const coreName = normCatalogName
      .replace(/\b(ic|iis|i i s|istituto|comprensivo|istruzione|superiore|di|del|della|dello|degli|da|san|santa|e|este|padova)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (coreName.length >= 5 && normTitle.includes(coreName)) {
      return school;
    }
  }

  const aliasList: { len: number; normAlias: string; school: any }[] = [];
  for (const school of padovaSchoolsData as any[]) {
    if (school.aliases) {
      for (const alias of school.aliases) {
        const normAlias = normalizeText(alias);
        if (normAlias.length >= 4 && !["este", "padova", "montagnana", "cittadella", "monselice"].includes(normAlias)) {
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

export function isValidMiurClassCode(code: string): boolean {
  const c = code.toUpperCase();
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

function extractOrdineETipoPosto(title: string, fullText: string, classi: string[]): { ordine: string; tipoPosto: string } {
  let ordine = "Altro";
  const ltTitle = title.toLowerCase();
  const lt = fullText.toLowerCase();

  const isIC = ltTitle.includes(" ic ") || ltTitle.includes("ic ") || ltTitle.includes("i.c.") || ltTitle.includes("comprensivo") || lt.includes("istituto comprensivo");
  const isSuperiore = ltTitle.includes("i.i.s") || ltTitle.includes("iis") || ltTitle.includes("liceo") || ltTitle.includes("itis") || ltTitle.includes("i.t.i.s") || ltTitle.includes("superiori") || ltTitle.includes("secondaria di secondo grado") || ltTitle.includes("ii grado") || ltTitle.includes("2° grado") || ltTitle.includes("sec. 2");

  const hasInfanziaClass = classi.some(c => ["ADAA", "AAAA"].includes(c));
  const hasPrimariaClass = classi.some(c => ["ADEE", "EEEE"].includes(c));
  const hasMedieClass = classi.some(c => ["ADMM", "A022", "A028", "A030", "A049", "A060"].includes(c) || c.endsWith("25") || c.endsWith("56"));
  const hasSuperioriClass = classi.some(c => ["ADSS"].includes(c) || c.endsWith("24") || c.endsWith("55") || /^B0[0-3][0-9]$/.test(c) || (/^A0[0-6][0-9]$/.test(c) && !["A022", "A028", "A030", "A049", "A060", "A056"].includes(c)));

  if (hasSuperioriClass || isSuperiore) {
    ordine = "Secondaria II grado";
  } else if (hasMedieClass || (isIC && (ltTitle.includes("secondaria") || ltTitle.includes("medie")))) {
    ordine = "Secondaria I grado";
  } else if (hasPrimariaClass || ltTitle.includes("primaria") || ltTitle.includes("elementar") || lt.includes("scuola primaria")) {
    ordine = "Primaria";
  } else if (hasInfanziaClass || ltTitle.includes("infanzia") || ltTitle.includes("matern")) {
    ordine = "Infanzia";
  } else if (ltTitle.includes("secondaria")) {
    ordine = isIC ? "Secondaria I grado" : "Secondaria II grado";
  } else if (lt.includes("secondaria di primo grado") || lt.includes("medie")) {
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

function extractClassiConcorso(text: string, title?: string | null): string[] {
  const found = new Set<string>();
  const knownCodes = ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI", "EEEE", "AAAA", "PPPP"];
  for (const code of knownCodes) {
    // Escludi falsi positivi come gg/mm/aaaa per il codice AAAA
    const regex = new RegExp(`(?<![/-])\\b${code}\\b(?![/-])`, code === 'AAAA' ? '' : 'i');
    if (regex.test(text)) {
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

  const ltCombined = `${title || ''} ${text}`.toLowerCase();
  const isPrimaryOrInfanzia = found.has("ADEE") || found.has("EEEE") || found.has("ADAA") || found.has("AAAA") || ltCombined.includes("primaria") || ltCombined.includes("infanzia");

  if (!isPrimaryOrInfanzia) {
    if (ltCombined.includes("tedesco") || ltCombined.includes("lingua tedesca")) {
      if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
        found.add("AD24");
      } else if (ltCombined.includes("secondaria") || ltCombined.includes("medie") || ltCombined.includes("i grado")) {
        found.add("AD25");
      }
    }
    if (ltCombined.includes("inglese") || ltCombined.includes("lingua inglese")) {
      if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
        found.add("AA24");
      } else if (ltCombined.includes("secondaria") || ltCombined.includes("medie") || ltCombined.includes("i grado")) {
        found.add("AA25");
      }
    }
    if (ltCombined.includes("francese") || ltCombined.includes("lingua francese")) {
      if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
        found.add("AB24");
      } else if (ltCombined.includes("secondaria") || ltCombined.includes("medie") || ltCombined.includes("i grado")) {
        found.add("AB25");
      }
    }
    if (ltCombined.includes("spagnolo") || ltCombined.includes("lingua spagnola")) {
      if (ltCombined.includes("secondaria di secondo") || ltCombined.includes("superiori") || ltCombined.includes("ii grado")) {
        found.add("AC24");
      } else if (ltCombined.includes("secondaria") || ltCombined.includes("medie") || ltCombined.includes("i grado")) {
        found.add("AC25");
      }
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
      if (t.includes("primaria") || t.includes("elementare")) { found.add("EEEE"); break; }
      else if (t.includes("infanzia") || t.includes("matern")) { found.add("AAAA"); break; }
    }
  }
  return Array.from(found).sort();
}

function extractScadenza(title: string, body: string): [string | null, string | null] {
  // Pattern potenziati: coprono 'dell giorno', 'delle ore', 'della', varianti Nuvola/Madisoft, Argo
  const patterns = [
    // "entro le ore 08:00 dell giorno 14/09/2026" | "entro le ore 09:00 di martedì 15/09/2026"
    /(?:entro|scadenza|rispost[ae]\s+entro|comunicare\s+entro|disponibilit[àa]\s+entro)\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+(?:di\s+|del(?:l[aeo']?)?\s+|della\s+)?(?:giorno\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    // "entro il 16/09/2026 alle ore 12:00" | "entro il 16/09/2026"
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+)?(?:giorno\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})(?:\s+(?:alle\s+ore|alle|ore)\s+(\d{1,2}[:.]\d{2}))?/i,
    // "entro le ore 10:00 del giorno 20 settembre 2026"
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+del(?:l[aeo']?)?\s+(?:giorno\s+)?(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    // "scadenza candidature: ore 13.00 del 18/09/2026"
    /scadenza(?:\s+candidature)?:\s*(?:ore\s*(\d{1,2}[:.]\d{2}))?\s*(?:del(?:l[aeo']?)?\s+|il\s+|di\s+)?(?:giorno\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    // "termine presentazione entro" / "presentare entro" / "invio entro" / "candidarsi entro"
    /(?:termine\s+presentazione|presentare\s+entro|invio\s+entro|candidarsi\s+entro)\s+(?:il\s+|ore\s+\d{1,2}[:.]\d{2}\s+del(?:l[aeo']?)?\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    // Generico: "entro il/le data"
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

function extractPeriodo(text: string): { periodo_desc: string | null; periodo_inizio: string | null; periodo_fine: string | null } {
  const res = { periodo_desc: null as string | null, periodo_inizio: null as string | null, periodo_fine: null as string | null };

  const mRange = text.match(/dal\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+al\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (mRange) {
    res.periodo_desc = `Dal ${mRange[1]} al ${mRange[2]}`;
    const dStart = parseItalianDate(mRange[1]);
    const dEnd = parseItalianDate(mRange[2]);
    if (dStart) res.periodo_inizio = dStart.toISOString().split('T')[0];
    if (dEnd) res.periodo_fine = dEnd.toISOString().split('T')[0];
    return res;
  }

  const mFinoA = text.match(/fino\s+al\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);
  if (mFinoA) {
    res.periodo_desc = `Fino al ${mFinoA[1]}`;
    const dEnd = parseItalianDate(mFinoA[1]);
    if (dEnd) res.periodo_fine = dEnd.toISOString().split('T')[0];
    return res;
  }

  if (/fino\s+al\s+termine\s+delle\s+attivit[àa]\s+didattiche/i.test(text)) {
    res.periodo_desc = "Fino al termine delle attività didattiche (30 Giugno)";
    return res;
  }
  if (/fino\s+al\s+termine\s+delle\s+lezioni/i.test(text)) {
    res.periodo_desc = "Fino al termine delle lezioni (Giugno)";
    return res;
  }
  if (/supplenz[ae]\s+brev[ie]/i.test(text)) {
    res.periodo_desc = "Supplenza breve temporanea";
    return res;
  }

  return res;
}

function extractEmailAndSubject(text: string): [string | null, string | null] {
  let email: string | null = null;
  let subj: string | null = null;

  const mEmail = text.match(/([a-zA-Z0-9_.+-]+@(?:istruzione\.it|pec\.istruzione\.it|[a-zA-Z0-9-]+\.edu\.it))/);
  if (mEmail) email = mEmail[1];

  const mSubj = text.match(/oggetto\s+[“"«]([^"”»]+)[”"»]/i);
  if (mSubj) subj = mSubj[1].trim();

  return [email, subj];
}

function extractOreEPosti(text: string, ordine?: string | null): [string | null, number | null] {
  let ore: string | null = null;
  let posti: number | null = null;

  const mTab = text.match(/\b(?:ADAA|ADEE|ADMM|ADSS|AAAA|EEEE|[AB]\d{2,3})\s+(\d+)\s+(\d{1,2})\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i);
  if (mTab) {
    posti = parseInt(mTab[1], 10);
    ore = `${mTab[2]} ore settimanali`;
    return [ore, posti];
  }

  const mFrac = text.match(/\b(\d{1,2}\/(?:18|24|25|\d{1,2}))\s*[hH]\b/i) ||
                text.match(/\b(\d{1,2}\/(?:18|24|25))\s*(?:ore)?\b(?!\s*[\/-]\d{2,4})/i);
  if (mFrac) {
    ore = `${mFrac[1]} ore settimanali`;
  }

  if (!ore) {
    const mOreBefore = text.match(/(?:n[°\.]?\s*)?ore(?:\s+settimanali)?(?:\s*[:=\-]\s*|\s+(?:di\s+)?)(?!settimanali\b)(\d{1,2})\b(?!\s*[:\.]\d{2}|\s+del\b|\s+giorno\b|\s+della\b|\s+di\s+[a-zA-Zàèéìòù]+|\s+[/-]\d{2})/i);
    if (mOreBefore) {
      const num = parseInt(mOreBefore[1], 10);
      if (num > 0 && num <= 36) ore = `${num} ore settimanali`;
    }
  }

  if (!ore) {
    const mSpezzone = text.match(/spezzone(?:\s+orario)?(?:\s+di)?\s+(\d{1,2})\s*(?:ore|h)\b/i);
    if (mSpezzone) {
      ore = `${mSpezzone[1]} ore settimanali`;
    } else {
      const mOreAfter = text.match(/(?<![\/-])\b(\d{1,2})\s*(?:ore\s+settimanali|ore|h)\b(?!\s*[:\.]\d{2})/i);
      if (mOreAfter) {
        const num = parseInt(mOreAfter[1], 10);
        if (num > 0 && num <= 36) ore = `${num} ore settimanali`;
      }
    }
  }

  if (!ore) {
    if (text.toLowerCase().includes("cattedra intera") || text.toLowerCase().includes("posto intero")) {
      if (ordine === "Infanzia") ore = "25 ore settimanali";
      else if (ordine === "Primaria") ore = "24 ore settimanali";
      else if (ordine === "Secondaria I grado" || ordine === "Secondaria II grado") ore = "18 ore settimanali";
      else ore = "Cattedra intera";
    } else if (text.toLowerCase().includes("spezzone")) {
      ore = "Spezzone orario";
    }
  }

  const mPosti = text.match(/(?:n[°\.]?\s*)?(\d+)\s+posti\b/i);
  if (mPosti) {
    posti = parseInt(mPosti[1], 10);
  } else if (/\b1\s+posto\b|un\s+posto\b|posto\s+intero\b/i.test(text)) {
    posti = 1;
  }

  return [ore, posti];
}

function getOrdineByClasse(code: string): string {
  const c = code.toUpperCase();
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

function extractPositionsBlocks(text: string): any[] {
  const positions: any[] = [];

  // 1. FORMATO TABELLARE (es: San Martino di Lupari)
  // EEEE COMUNE 1 20/24H 15/09/2026 30/06/2027
  // ADEE SOSTEGNO + LIS 1 24/24H 15/09/2026 30/06/2027
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

  // 2. FORMATO PER SEZIONI E PUNTI ELENCO (Bullet points sotto intestazioni classe)
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

  // 3. FORMATO TIPOLOGIA DI POSTO (IC Piovene e simili)
  const regex = /Tipologia\s+di\s+posto:\s*([^\n\r]+)[\r\n]+(?:Numero\s+di\s+posti:\s*)?(\d+)\s+posti?\s*(?:per\s+ore\s*([^\n\r]+?))?(?:fino\s+al\s+([^\n\r]+?))?(?:[\r\n]+((?:Suddiviso|Ore)[^\n\r]+))?/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const tipoRaw = m[1].trim();
    const postiNum = parseInt(m[2], 10);
    const oreStr = m[3] ? m[3].trim() : null;
    const finoAlStr = m[4] ? m[4].trim() : null;
    const noteStr = m[5] ? m[5].trim() : null;

    let ordine = "Altro";
    let tipoPosto = "Posto Comune";
    let codiceClasse = null;

    const lowerTipo = tipoRaw.toLowerCase();
    if (lowerTipo.includes("infanzia")) ordine = "Infanzia";
    else if (lowerTipo.includes("primaria")) ordine = "Primaria";
    else if (lowerTipo.includes("primo") || lowerTipo.includes("1°") || lowerTipo.includes("medie")) ordine = "Secondaria I grado";
    else if (lowerTipo.includes("secondo") || lowerTipo.includes("2°") || lowerTipo.includes("superiori")) ordine = "Secondaria II grado";

    if (lowerTipo.includes("sostegno")) {
      tipoPosto = "Sostegno";
      if (ordine === "Infanzia") codiceClasse = "ADAA";
      else if (ordine === "Primaria") codiceClasse = "ADEE";
      else if (ordine === "Secondaria I grado") codiceClasse = "ADMM";
      else if (ordine === "Secondaria II grado") codiceClasse = "ADSS";
    } else if (lowerTipo.includes("comune")) {
      tipoPosto = "Posto Comune";
      if (ordine === "Infanzia") codiceClasse = "AAAA";
      else if (ordine === "Primaria") codiceClasse = "EEEE";
    }

    positions.push({
      codice_classe: codiceClasse,
      ordine_scuola: ordine,
      tipo_posto: tipoPosto,
      posti: postiNum,
      ore: oreStr ? `${oreStr} ore` : null,
      periodo: finoAlStr ? `Fino al ${finoAlStr}` : null,
      note: noteStr
    });
  }
  return mergeIdenticalPositions(positions);
}

async function downloadAndExtractPdfText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();

    const pdfPromise = pdfParse(new Uint8Array(arrayBuffer));
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));

    const pdfData: any = await Promise.race([pdfPromise, timeoutPromise]);
    return pdfData?.text || null;
  } catch (_err) {
    return null;
  }
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
    const reqUrl = new URL(req.url);
    const perPage = parseInt(reqUrl.searchParams.get("per_page") || reqUrl.searchParams.get("limit") || "100", 10);
    const maxPages = parseInt(reqUrl.searchParams.get("pages") || "5", 10);
    const force = reqUrl.searchParams.get("force") === "true";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Legge la data dell'ultimo sync riuscito da sync_state
    let lastSyncAt: string | null = null;
    if (!force) {
      const { data: stateRow } = await supabase
        .from('sync_state')
        .select('last_sync_at')
        .eq('key', 'global')
        .maybeSingle();
      lastSyncAt = stateRow?.last_sync_at ?? null;
    }

    // Calcola timestamp "syncStartedAt" PRIMA di scaricare i post, così non perdiamo post
    // pubblicati mentre gira il sync corrente
    const syncStartedAt = new Date().toISOString();

    const posts: any[] = [];
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      // Se abbiamo una data di riferimento, chiediamo a WP solo i post modificati/pubblicati dopo
      // Ordine: modified (decrescente) così i più recenti vengono prima e possiamo stoppare presto
      let wpApiUrl = `${WP_BASE_URL}?categories=${WP_CATEGORY}&per_page=${perPage}&page=${pageNum}&orderby=modified&order=desc`;
      if (lastSyncAt) {
        // WP REST API: ?modified_after= filtra i post con modified > data
        wpApiUrl += `&modified_after=${encodeURIComponent(lastSyncAt)}`;
      }

      const res = await fetch(wpApiUrl, {
        headers: { "User-Agent": "CercaInterpelliPadova/1.0 (supabase-edge-function)" }
      });

      if (!res.ok) {
        if (pageNum === 1) throw new Error(`HTTP ${res.status} da WordPress API`);
        break;
      }

      const pageData = await res.json();
      if (!Array.isArray(pageData) || pageData.length === 0) break;
      posts.push(...pageData);

      // Se siamo in modalità incrementale e i risultati sono meno del perPage richiesto,
      // non c'è una pagina successiva
      if (pageData.length < perPage) break;
    }
    let itemsFound = posts.length;
    let itemsNew = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    let upsertErrors: any[] = [];

    // Pre-carica in un'unica query tutti gli interpelli già presenti nel DB
    const wpIds = posts.map(p => p.id);
    const { data: existingRows } = await supabase
      .from('interpelli')
      .select('wp_id, wp_modified, school_name, school_code, school_address, school_city, scadenza, scadenza_raw, status_candidatura, notes, ai_enhanced')
      .in('wp_id', wpIds);

    const existingMap = new Map<number, any>();
    for (const r of existingRows || []) {
      if (!existingMap.has(r.wp_id)) {
        existingMap.set(r.wp_id, r);
      }
    }

    for (const p of posts) {
      const wpId = p.id;
      const rawTitle = p.title?.rendered || '';
      const title = decodeHtmlEntities(rawTitle);
      const slug = p.slug || '';
      const wpDate = p.date;
      const wpModified = p.modified || wpDate;
      const wpUrl = p.link || '';
      const contentHtml = p.content?.rendered || '';

      const existing = existingMap.get(wpId);
      const wpModifiedChanged = existing && !isSameDate(existing.wp_modified, wpModified);

      // Se il post non è cambiato su WordPress, skip (a meno di force)
      if (!force && existing && !wpModifiedChanged) {
        itemsSkipped++;
        continue;
      }

      // Se il post è stato arricchito con AI ma su WP non è cambiato, mantieni i dati AI
      // (questo caso è già coperto dal blocco sopra, ma lo documentiamo esplicitamente)
      // Se invece wp_modified è cambiato su un record ai_enhanced, rigeneriamo e resettiamo ai_enhanced
      const isAiEnhanced = existing?.ai_enhanced === true;
      const willResetAi = isAiEnhanced && wpModifiedChanged;

      const matchedSchool = resolveSchoolFromCatalog(title);
      const schoolName = matchedSchool ? matchedSchool.name : extractCleanSchoolName(title);

      const attachments = parseAttachmentsFromHtml(contentHtml);
      const bandoAtt = attachments.find(a => a.is_bando) || attachments.find(a => a.url.toLowerCase().endsWith('.pdf')) || attachments[0];

      let pdfText: string | null = null;
      if (bandoAtt && bandoAtt.url.toLowerCase().includes('.pdf')) {
        pdfText = await downloadAndExtractPdfText(bandoAtt.url);
      }

      const fullText = `${title}\n${contentHtml}\n${pdfText || ''}`;
      const classi = extractClassiConcorso(fullText, title);
      let [scadenzaIso, scadenzaRaw] = extractScadenza(title, pdfText || fullText);

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

      const periodoInfo = extractPeriodo(pdfText || fullText);
      const [ore, posti] = extractOreEPosti(pdfText || fullText);
      const [email, oggettoEmail] = extractEmailAndSubject(pdfText || fullText);

      let linkCandidatura: string | null = null;
      const mForm = fullText.match(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms)[^\s"\'<>]+/);
      if (mForm) linkCandidatura = mForm[0];

      const { ordine, tipoPosto } = extractOrdineETipoPosto(title, fullText, classi);
      const postiBlocks = extractPositionsBlocks(pdfText || fullText);

      let positionsToInsert: any[] = [];
      if (postiBlocks && postiBlocks.length > 0) {
        positionsToInsert = postiBlocks;
      } else if (classi.length > 1) {
        // Se ci sono più classi di concorso distinte nel bando, crea una card per ciascuna classe!
        positionsToInsert = classi.map(c => {
          const isSost = ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI"].includes(c);
          let ord = ordine;
          if (["ADAA", "AAAA"].includes(c)) ord = "Infanzia";
          else if (["ADEE", "EEEE"].includes(c)) ord = "Primaria";
          else if (["ADMM"].includes(c)) ord = "Secondaria I grado";
          else if (["ADSS"].includes(c)) ord = "Secondaria II grado";

          return {
            codice_classe: c,
            ordine_scuola: ord,
            tipo_posto: isSost ? "Sostegno" : "Posto Comune",
            posti: posti,
            ore: ore,
            periodo: periodoInfo.periodo_desc,
            note: null
          };
        });
      } else {
        positionsToInsert = [{
          codice_classe: classi[0] || null,
          ordine_scuola: ordine,
          tipo_posto: tipoPosto,
          posti: posti,
          ore: ore,
          periodo: periodoInfo.periodo_desc,
          note: null
        }];
      }

      for (let idx = 0; idx < positionsToInsert.length; idx++) {
        const pos = positionsToInsert[idx];
        const itemKey = `${wpId}-${idx + 1}`;

        let posClassi = classi;
        if (pos.codice_classe && isValidMiurClassCode(pos.codice_classe)) {
          posClassi = [pos.codice_classe.toUpperCase()];
        }

        const record: Record<string, any> = {
          wp_id: wpId,
          item_key: itemKey,
          position_index: idx + 1,
          title,
          slug,
          wp_date: wpDate,
          wp_modified: wpModified,
          wp_url: wpUrl,
          school_name: schoolName,
          school_code: matchedSchool ? matchedSchool.code : (existing?.school_code || null),
          school_address: matchedSchool ? matchedSchool.address : (existing?.school_address || null),
          school_city: matchedSchool ? matchedSchool.city : (existing?.school_city || 'Padova'),
          latitude: matchedSchool ? matchedSchool.lat : 45.4064,
          longitude: matchedSchool ? matchedSchool.lon : 11.8768,
          classi_concorso: posClassi,
          ordine_scuola: pos.ordine_scuola || ordine,
          tipo_posto: pos.tipo_posto || tipoPosto,
          posti_disponibili: pos.posti || posti,
          ore_settimanali: pos.ore || ore,
          periodo_desc: pos.periodo || periodoInfo.periodo_desc,
          periodo_inizio: periodoInfo.periodo_inizio,
          periodo_fine: periodoInfo.periodo_fine,
          email_candidatura: email,
          oggetto_email: oggettoEmail,
          link_candidatura: linkCandidatura,
          posti_dettaglio: positionsToInsert,
          status_candidatura: existing?.status_candidatura || 'nessuno',
          notes: pos.note || existing?.notes || null,
          attachments: attachments,
          content_raw: pdfText ? pdfText.slice(0, 3000) : null,
          // Resetta ai_enhanced se wp_modified è cambiato (il contenuto WP è diverso)
          ai_enhanced: willResetAi ? false : (isAiEnhanced ? true : false),
          updated_at: new Date().toISOString()
        };

        if (scadenzaIso) {
          record.scadenza = scadenzaIso;
          record.scadenza_raw = scadenzaRaw;
        } else if (existing?.scadenza) {
          record.scadenza = existing.scadenza;
          record.scadenza_raw = existing.scadenza_raw;
        } else {
          record.scadenza = null;
          record.scadenza_raw = null;
        }

        const { error: upsertErr } = await supabase
          .from('interpelli')
          .upsert(record, { onConflict: 'item_key' });

        if (!upsertErr) {
          if (existing) itemsUpdated++;
          else itemsNew++;
        } else {
          upsertErrors.push({ itemKey, error: upsertErr });
        }
      }

      // Delete any leftover position records from previous runs if positions decreased
      await supabase
        .from('interpelli')
        .delete()
        .eq('wp_id', wpId)
        .gt('position_index', positionsToInsert.length);
    }

    const hasErrors = upsertErrors.length > 0;
    const finalStatus = hasErrors
      ? (itemsNew > 0 || itemsUpdated > 0 ? 'partial_error' : 'error')
      : 'success';

    // Aggiorna sync_state con la data di inizio del sync corrente (non "now" per evitare race condition)
    // Solo se il sync è completato senza errori critici
    if (finalStatus === 'success' || finalStatus === 'partial_error') {
      await supabase
        .from('sync_state')
        .upsert({ key: 'global', last_sync_at: syncStartedAt, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }

    await supabase.from('sync_logs').insert({
      status: finalStatus,
      items_found: itemsFound,
      items_new: itemsNew,
      items_updated: itemsUpdated,
      error_message: hasErrors ? JSON.stringify(upsertErrors.map(e => ({ itemKey: e.itemKey, msg: e.error?.message }))).slice(0, 500) : null
    });

    return new Response(
      JSON.stringify({
        success: true,
        items_found: itemsFound,
        items_new: itemsNew,
        items_updated: itemsUpdated,
        items_skipped: itemsSkipped,
        last_sync_at: lastSyncAt,
        errors: upsertErrors,
        message: `Sincronizzazione completata: ${itemsNew} nuovi, ${itemsUpdated} aggiornati, ${itemsSkipped} invariati (di cui ${posts.filter((_, i) => existingMap.get(posts[i]?.id)?.ai_enhanced).length} con AI preservato).`
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
