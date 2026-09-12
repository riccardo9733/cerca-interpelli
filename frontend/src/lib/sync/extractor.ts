import { PositionItem } from '@/types/interpello';

export interface ExtractedMetadata {
  classi_concorso: string[];
  scadenza: string | null;
  scadenza_raw: string | null;
  periodo_desc: string | null;
  periodo_inizio: string | null;
  periodo_fine: string | null;
  school_name: string | null;
  school_code: string | null;
  school_city: string | null;
  school_address: string | null;
  ore_settimanali: string | null;
  posti_disponibili: number | null;
  email_candidatura: string | null;
  oggetto_email: string | null;
  link_candidatura: string | null;
  ordine_scuola: string;
  tipo_posto: string;
  posti_dettaglio?: PositionItem[];
}

export function decodeHtmlEntities(text: string | null | undefined): string {
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

const MESI_ITALIANI: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4,
  maggio: 5, giugno: 6, luglio: 7, agosto: 8,
  settembre: 9, ottobre: 10, novembre: 11, dicembre: 12
};

export function parseItalianDate(dateStr: string | null | undefined): Date | null {
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
    const month = parseInt(m[2], 10) - 1; // JS 0-indexed month
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

export function extractClassiConcorso(text: string, title?: string | null): string[] {
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

  if (found.size > 0) {
    return Array.from(found).sort();
  }

  const candidates: string[] = [];
  if (title) candidates.push(title.toLowerCase());
  candidates.push(text.toLowerCase());

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

export function extractScadenza(title: string, body: string): [string | null, string | null] {
  // Pattern potenziati: coprono 'dell giorno', 'delle ore', 'della', varianti Nuvola/Madisoft, Argo
  const patterns = [
    // "entro le ore 08:00 dell giorno 14/09/2026" | "entro le ore 09:00 di martedì 15/09/2026"
    /(?:entro|scadenza|rispost[ae]\s+entro|comunicare\s+entro|disponibilit[àa]\s+entro)\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]?\d{2})\s+(?:di\s+|del(?:l[aeo']?)?\s+|della\s+)?(?:giorno\s+)?(?:[a-zA-ZàèéìòùÀÈÉÌÒÙ]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    // "entro il 16/09/2026 alle ore 12:00" | "entro il 16/09/2026"
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+)?(?:giorno\s+)?(?:[a-zA-ZàèéìòùÀÈÉÌÒÙ]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})(?:\s+(?:alle\s+ore|alle|ore)\s+(\d{1,2}[:.]?\d{2}))?/i,
    // "entro le ore 10:00 del giorno 20 settembre 2026"
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]?\d{2})\s+del(?:l[aeo']?)?\s+(?:giorno\s+)?(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    // "scadenza candidature: ore 13.00 del 18/09/2026"
    /scadenza(?:\s+candidature)?:\s*(?:ore\s*(\d{1,2}[:.]?\d{2}))?\s*(?:del(?:l[aeo']?)?\s+|il\s+|di\s+)?(?:giorno\s+)?(?:[a-zA-ZàèéìòùÀÈÉÌÒÙ]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    // "termine presentazione entro" / "presentare entro" / "invio entro" / "candidarsi entro"
    /(?:termine\s+presentazione|presentare\s+entro|invio\s+entro|candidarsi\s+entro)\s+(?:il\s+|ore\s+\d{1,2}[:.]?\d{2}\s+del(?:l[aeo']?)?\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    // Generico: "entro il/le data"
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+|le\s+)?(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
  ];

  for (const pat of patterns) {
    const m = title.match(pat);
    if (m) {
      const raw = m[0];
      const parsed = parseItalianDate(raw);
      if (parsed) return [parsed.toISOString(), raw];
    }
  }

  if (body) {
    for (const pat of patterns) {
      const m = body.match(pat);
      if (m) {
        const raw = m[0];
        const parsed = parseItalianDate(raw);
        if (parsed) return [parsed.toISOString(), raw];
      }
    }
  }

  return [null, null];
}

export function extractPeriodo(text: string): { periodo_desc: string | null; periodo_inizio: string | null; periodo_fine: string | null } {
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

export function extractSchoolInfo(title: string, text: string) {
  const res = { school_name: null as string | null, school_code: null as string | null, school_city: null as string | null, school_address: null as string | null };
  const cleanTitle = decodeHtmlEntities(title);

  const mCode = text.match(/\b(PD[A-Z0-9]{8})\b/i);
  if (mCode) res.school_code = mCode[1].toUpperCase();

  // Rimuovi falsi positivi come "corso oggetto...", "corso di...", "corso concorsuale"
  const textForAddress = text.replace(/corso\s+(?:oggetto|di|delle|del|sul|abilitante|concorsuale|specializzazione|formazione|perfezionamento)/gi, '');

  const mAddr = textForAddress.match(/\b(Via|Viale|Corso|Piazza|Piazzetta|Riviera|Largo|Vicolo|Contrada)\s+([A-ZÀ-Úa-zà-ú0-9'\.\s]{2,35}?)(?:,\s*|\s+)(?:n\.?|n°|civico)?\s*(\d+[a-zA-Z]?)\b(?:\s*,?\s*(\d{5})?\s*([A-ZÀ-Úa-zà-ú\s'\-]+)?(?:\([A-Z]{2}\))?)?/i);
  if (mAddr) {
    const candidateAddr = mAddr[0].trim();
    if (candidateAddr.length <= 80 && !/prestato|servizio|interpello|candidatura|graduatoria|posto/i.test(candidateAddr)) {
      res.school_address = candidateAddr;
    }
  }

  const parts = cleanTitle.split(/\s*(?:[–\-\:]|&#8211;|&ndash;)\s*/);
  if (parts.length > 0 && parts[0].trim().length > 0) {
    const candidate = parts[0].trim();
    res.school_name = candidate;
  }

  const mCity = text.match(/\b35\d{3}\s+([A-Z\s\']+)\s*\([Pp][Dd]\)/);
  if (mCity) {
    res.school_city = mCity[1].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  return res;
}

export function extractEmailAndSubject(text: string): [string | null, string | null] {
  let email: string | null = null;
  let subj: string | null = null;

  const mEmail = text.match(/([a-zA-Z0-9_.+-]+@(?:istruzione\.it|pec\.istruzione\.it|[a-zA-Z0-9-]+\.edu\.it))/);
  if (mEmail) email = mEmail[1];

  const mSubj = text.match(/oggetto\s+[“"«]([^"”»]+)[”"»]/i);
  if (mSubj) subj = mSubj[1].trim();

  return [email, subj];
}

export function extractOreEPosti(text: string, ordine?: string | null): [string | null, number | null] {
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

export function getOrdineByClasse(code: string): string {
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

export function mergeIdenticalPositions(positions: PositionItem[]): PositionItem[] {
  if (!positions || positions.length === 0) return [];
  const merged: PositionItem[] = [];
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

export function extractPositionsBlocks(text: string): PositionItem[] {
  const positions: PositionItem[] = [];
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

export function extractMetadata(title: string, htmlContent: string, pdfText?: string | null, wpDateStr?: string | null): ExtractedMetadata {
  const fullText = `${title}\n${htmlContent}\n${pdfText || ''}`;

  const classi = extractClassiConcorso(fullText, title);
  let [scadenzaIso, scadenzaRaw] = extractScadenza(title, pdfText || fullText);

  if (scadenzaIso && wpDateStr) {
    try {
      const scadDt = new Date(scadenzaIso);
      const wpDt = new Date(wpDateStr);
      if (scadDt.getFullYear() < wpDt.getFullYear()) {
        scadDt.setFullYear(wpDt.getFullYear());
        scadenzaIso = scadDt.toISOString();
      }
    } catch (_) {}
  }

  const periodoInfo = extractPeriodo(pdfText || fullText);

  const mTitleFine = title.match(/fino\s+al\s+(\d{1,2}[/-]\d{1,2}[/-](\d{4}))/i);
  if (mTitleFine) {
    const dTitleEnd = parseItalianDate(mTitleFine[1]);
    if (dTitleEnd) {
      periodoInfo.periodo_desc = `Fino al ${mTitleFine[1]}`;
      periodoInfo.periodo_fine = dTitleEnd.toISOString().split('T')[0];
    }
  }

  if (periodoInfo.periodo_fine && wpDateStr) {
    try {
      const wpDt = new Date(wpDateStr);
      let dEnd = new Date(periodoInfo.periodo_fine);

      let needsYearIncrement = false;
      if (periodoInfo.periodo_inizio) {
        const dStart = new Date(periodoInfo.periodo_inizio);
        if (dEnd <= dStart && dEnd.getMonth() < dStart.getMonth()) {
          needsYearIncrement = true;
        }
      } else if (wpDt.getMonth() >= 7 && dEnd.getMonth() <= 6 && dEnd.getFullYear() === wpDt.getFullYear()) {
        needsYearIncrement = true;
      }

      if (needsYearIncrement) {
        const fixedYear = wpDt.getFullYear() + 1;
        dEnd.setFullYear(fixedYear);
        periodoInfo.periodo_fine = dEnd.toISOString().split('T')[0];
        if (periodoInfo.periodo_desc) {
          periodoInfo.periodo_desc = periodoInfo.periodo_desc.replace(/(\bal\s+\d{1,2}[/-]\d{1,2}[/-])\d{4}/gi, `$1${fixedYear}`);
        }
      }
    } catch (_) {}
  }

  const schoolInfo = extractSchoolInfo(title, pdfText || fullText);

  let ordine = "Altro";
  const ltTitle = title.toLowerCase();
  const lt = fullText.toLowerCase();

  const isIC = ltTitle.includes(" ic ") || ltTitle.includes("ic ") || ltTitle.includes("i.c.") || ltTitle.includes("comprensivo") || lt.includes("istituto comprensivo");

  const isSuperiore = ltTitle.includes("i.i.s") || ltTitle.includes("iis") || ltTitle.includes("liceo") || ltTitle.includes("itis") || ltTitle.includes("i.t.i.s") || ltTitle.includes("superiori") || ltTitle.includes("secondaria di secondo grado") || ltTitle.includes("ii grado") || ltTitle.includes("2° grado") || ltTitle.includes("sec. 2");

  const hasInfanziaClass = classi.some(c => getOrdineByClasse(c) === "Infanzia");
  const hasPrimariaClass = classi.some(c => getOrdineByClasse(c) === "Primaria");
  const hasMedieClass = classi.some(c => getOrdineByClasse(c) === "Secondaria I grado");
  const hasSuperioriClass = classi.some(c => getOrdineByClasse(c) === "Secondaria II grado");

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

  const [ore, posti] = extractOreEPosti(pdfText || fullText, ordine);
  const [email, oggettoEmail] = extractEmailAndSubject(pdfText || fullText);

  const sostegnoCodes = ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI"];
  const hasSubjectClass = classi.some(c => !sostegnoCodes.includes(c));
  const isSostegno = classi.some(c => sostegnoCodes.includes(c)) ||
    (ltTitle.includes("sostegno") && !hasSubjectClass) ||
    (lt.includes("sostegno") && !hasSubjectClass && !ltTitle.includes("tedesco") && !ltTitle.includes("inglese") && !ltTitle.includes("francese") && !ltTitle.includes("spagnolo"));

  const tipoPosto = isSostegno ? "Sostegno" : "Posto Comune";

  let linkCandidatura: string | null = null;
  const mForm = fullText.match(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms)[^\s"\'<>]+/);
  if (mForm) linkCandidatura = mForm[0];

  const postiBlocks = extractPositionsBlocks(pdfText || fullText);
  let finalClassi = classi;
  let finalPosti = posti;

  if (postiBlocks.length > 0) {
    const blockClassi = postiBlocks.map(p => p.codice_classe).filter((c): c is string => Boolean(c));
    if (blockClassi.length > 0) {
      finalClassi = Array.from(new Set([...classi, ...blockClassi])).sort();
    }
    const sumPosti = postiBlocks.reduce((acc, p) => acc + (p.posti || 0), 0);
    if (sumPosti > 0) finalPosti = sumPosti;
  }

  return {
    classi_concorso: finalClassi,
    scadenza: scadenzaIso,
    scadenza_raw: scadenzaRaw,
    periodo_desc: periodoInfo.periodo_desc,
    periodo_inizio: periodoInfo.periodo_inizio,
    periodo_fine: periodoInfo.periodo_fine,
    school_name: schoolInfo.school_name,
    school_code: schoolInfo.school_code,
    school_city: schoolInfo.school_city,
    school_address: schoolInfo.school_address,
    ore_settimanali: ore,
    posti_disponibili: finalPosti,
    email_candidatura: email,
    oggetto_email: oggettoEmail,
    link_candidatura: linkCandidatura,
    ordine_scuola: ordine,
    tipo_posto: tipoPosto,
    posti_dettaglio: postiBlocks
  };
}
