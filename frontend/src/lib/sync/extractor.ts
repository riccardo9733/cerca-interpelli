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

export function extractClassiConcorso(text: string, title?: string | null): string[] {
  const found = new Set<string>();

  const knownCodes = ["ADAA", "ADEE", "ADMM", "ADSS", "ADEI", "EEEE", "AAAA", "PPPP"];
  for (const code of knownCodes) {
    const regex = new RegExp(`\\b${code}\\b`, 'i');
    if (regex.test(text)) {
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
      else if (t.includes("secondaria di primo grado") || t.includes("medie") || t.includes("i grado")) { found.add("ADMM"); break; }
      else if (t.includes("secondaria di secondo grado") || t.includes("superiori") || t.includes("ii grado")) { found.add("ADSS"); break; }
    } else if (t.includes("posto comune") || t.includes("comune")) {
      if (t.includes("infanzia") || t.includes("matern")) { found.add("AAAA"); break; }
      else if (t.includes("primaria") || t.includes("elementare")) { found.add("EEEE"); break; }
    }
  }

  return Array.from(found).sort();
}

export function extractScadenza(title: string, body: string): [string | null, string | null] {
  const patterns = [
    /(?:entro|scadenza|rispost[ae]\s+entro)\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+(?:di\s+|del(?: giorno)?\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4})/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+)?(?:giorno\s+)?(?:[a-zA-Zàèéìòù]+\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4})\s+(?:alle\s+|ore\s+)?(\d{1,2}[:.]\d{2})?/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:le\s+)?ore\s+(\d{1,2}[:.]\d{2})\s+del(?: giorno)?\s+(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /scadenza(?:\s+candidature)?:\s*(?:ore\s*(\d{1,2}[:.]\d{2}))?\s*(?:del\s+|il\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
    /entro\s+(?:e\s+non\s+oltre\s+)?(?:il\s+|le\s+)?(\d{1,2}\s+[a-zA-Z]+\s+\d{4}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:termine\s+presentazione|presentare\s+entro|invio\s+entro)\s+(?:il\s+|ore\s+\d{1,2}[:.]\d{2}\s+del\s+)?(\d{1,2}[\/\-\.\s]\d{1,2}[\/\-\.\s]\d{2,4}|\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i,
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

  const mOre = text.match(/\b(\d{1,2})\s*(?:ore|h)\b/i);
  if (mOre) {
    ore = `${mOre[1]} ore settimanali`;
  } else if (text.toLowerCase().includes("cattedra intera") || text.toLowerCase().includes("posto intero")) {
    if (ordine === "Infanzia") ore = "25 ore settimanali";
    else if (ordine === "Primaria") ore = "24 ore settimanali";
    else if (ordine === "Secondaria I grado" || ordine === "Secondaria II grado") ore = "18 ore settimanali";
    else ore = "Cattedra intera";
  } else if (text.toLowerCase().includes("spezzone")) {
    ore = "Spezzone orario";
  }

  const mPosti = text.match(/(?:n[°\.]?\s*)?(\d+)\s+posti\b/i);
  if (mPosti) {
    posti = parseInt(mPosti[1], 10);
  } else if (/\b1\s+posto\b|un\s+posto\b|posto\s+intero\b/i.test(text)) {
    posti = 1;
  }

  return [ore, posti];
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

  if (classi.some(c => ["ADAA", "AAAA"].includes(c)) || ltTitle.includes("infanzia") || ltTitle.includes("matern")) {
    ordine = "Infanzia";
  } else if (classi.some(c => ["ADEE", "EEEE"].includes(c)) || ltTitle.includes("primaria") || ltTitle.includes("elementar")) {
    ordine = "Primaria";
  } else if (classi.includes("ADMM") || ltTitle.includes("secondaria di primo grado") || ltTitle.includes("medie")) {
    ordine = "Secondaria I grado";
  } else if (classi.includes("ADSS") || ltTitle.includes("secondaria di secondo grado") || ltTitle.includes("superiori")) {
    ordine = "Secondaria II grado";
  } else if (lt.includes("infanzia") || lt.includes("matern")) {
    ordine = "Infanzia";
  } else if (lt.includes("primaria") || lt.includes("elementar")) {
    ordine = "Primaria";
  } else if (lt.includes("secondaria di primo grado") || lt.includes("medie")) {
    ordine = "Secondaria I grado";
  } else if (lt.includes("secondaria di secondo grado") || lt.includes("superiori")) {
    ordine = "Secondaria II grado";
  }

  const [ore, posti] = extractOreEPosti(pdfText || fullText, ordine);
  const [email, oggettoEmail] = extractEmailAndSubject(pdfText || fullText);
  const tipoPosto = (lt.includes("sostegno") || classi.some(c => c.startsWith("AD"))) ? "Sostegno" : "Posto Comune";

  let linkCandidatura: string | null = null;
  const mForm = fullText.match(/https?:\/\/(?:forms\.gle|docs\.google\.com\/forms)[^\s"\'<>]+/);
  if (mForm) linkCandidatura = mForm[0];

  return {
    classi_concorso: classi,
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
    posti_disponibili: posti,
    email_candidatura: email,
    oggetto_email: oggettoEmail,
    link_candidatura: linkCandidatura,
    ordine_scuola: ordine,
    tipo_posto: tipoPosto,
  };
}
