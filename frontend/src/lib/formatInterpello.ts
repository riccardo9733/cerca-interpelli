export interface SuggestedDates {
  scadenza: string | null;
  periodo_inizio: string | null;
  periodo_fine: string | null;
  periodo_desc: string | null;
}

/**
 * Normalizza una data passata rispetto alla pubblicazione:
 * porta l'anno all'anno di pubblicazione (o +1 se resta precedente).
 * Usata sia per il conto alla rovescia che per il suggerimento "date più probabili".
 */
function normalizePastDateToWp(date: Date, wpDt: Date): Date {
  const normalized = new Date(date);
  normalized.setFullYear(wpDt.getFullYear());
  if (normalized.getTime() < wpDt.getTime()) {
    normalized.setFullYear(wpDt.getFullYear() + 1);
  }
  return normalized;
}

function toDateOnlyString(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Riscrive l'anno in una descrizione periodo tipo "Dal 10/09/2025 al 30/06/2026". */
function rewritePeriodoDescYear(desc: string | null, newFineYear: number, newInizioYear?: number): string | null {
  if (!desc) return desc;
  let out = desc;
  // Sostituisce l'anno finale (dopo "al / fino al")
  out = out.replace(/((?:al|fino al)\s+\d{1,2}[/-]\d{1,2}[/-])\d{2,4}/gi, `$1${newFineYear}`);
  if (newInizioYear !== undefined) {
    out = out.replace(/((?:dal)\s+\d{1,2}[/-]\d{1,2}[/-])\d{2,4}/gi, `$1${newInizioYear}`);
  }
  return out;
}

function formatShortIT(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateOnlyIT(dateOnly: string | null): string | null {
  if (!dateOnly) return null;
  const d = new Date(dateOnly + (dateOnly.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(d.getTime())) return dateOnly;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Etichetta compatta per il tooltip/bottone: "scadenza 10/09/2026 08:00 · fino al 30/06/2027". */
export function buildSuggestedLabel(s: SuggestedDates): string | null {
  const parts: string[] = [];
  const scad = formatShortIT(s.scadenza);
  if (scad) parts.push(`scadenza ${scad}`);
  else if (s.periodo_fine) {
    const f = formatDateOnlyIT(s.periodo_fine);
    if (f) parts.push(`termine ${f}`);
  }
  if (s.periodo_desc && !parts.some((p) => p.startsWith('termine'))) {
    // Se la scadenza è già mostrata, aggiungi comunque il periodo per contesto
    if (s.scadenza) parts.push(s.periodo_desc);
  }
  if (parts.length === 0 && s.periodo_desc) parts.push(s.periodo_desc);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Calcola le "date più probabili" suggerite dal messaggio di anomalia.
 * Ritorna null se non c'è nulla da suggerire.
 */
export function computeSuggestedDates(row: any, wpDt: Date | null): SuggestedDates | null {
  if (!wpDt) return null;
  const wpDateOnly = wpDt.toISOString().split('T')[0];
  const rawContent = `${row.title || ''} ${row.content_raw || ''}`;
  const now = new Date();
  const isRecentPost = (now.getTime() - wpDt.getTime()) <= 14 * 86400 * 1000;

  let scadenza: string | null = null;
  let periodoInizio: string | null = null;
  let periodoFine: string | null = null;
  let periodoDesc: string | null = row.periodo_desc ?? null;

  // 1. Scadenza precedente alla pubblicazione -> anno normalizzato
  if (row.scadenza) {
    try {
      const exp = new Date(row.scadenza);
      if (!isNaN(exp.getTime()) && exp.getTime() < wpDt.getTime()) {
        scadenza = normalizePastDateToWp(exp, wpDt).toISOString();
      }
    } catch (_) {}
  }

  // 2. Scadenza raw con anno precedente (es. '...10/09/2025') su bando recente
  if (!scadenza && isRecentPost && row.scadenza_raw && row.scadenza_raw.includes('2025') && row.scadenza) {
    try {
      const exp = new Date(row.scadenza);
      if (!isNaN(exp.getTime())) {
        // Se l'estrattore ha già normalizzato, la scadenza corrente è già il suggerimento
        const normalized = normalizePastDateToWp(
          new Date(exp.getFullYear() === wpDt.getFullYear() ? exp : new Date(exp).setFullYear((exp as any).getFullYear?.() ?? 2025) as any),
          wpDt
        );
        scadenza = normalized instanceof Date && !isNaN(normalized.getTime())
          ? normalized.toISOString()
          : exp.toISOString();
        // Caso più comune: scadenza già anno corrente ma raw vecchio -> suggerisci la scadenza esistente
        if (exp.getFullYear() === wpDt.getFullYear() || exp.getFullYear() === wpDt.getFullYear() + 1) {
          scadenza = exp.toISOString();
        }
      }
    } catch (_) {}
  }

  // 3. Periodo fine precedente alla pubblicazione -> anno normalizzato
  const periodoFineRaw: string | null = row.periodo_fine ?? null;
  const periodoInizioRaw: string | null = row.periodo_inizio ?? null;
  if (periodoFineRaw && wpDateOnly && periodoFineRaw < wpDateOnly) {
    try {
      const dEnd = new Date(periodoFineRaw + (periodoFineRaw.length === 10 ? 'T12:00:00' : ''));
      if (!isNaN(dEnd.getTime())) {
        const fixedEnd = normalizePastDateToWp(dEnd, wpDt);
        periodoFine = toDateOnlyString(fixedEnd);
        let fixedStartYear: number | undefined;
        if (periodoInizioRaw) {
          const dStart = new Date(periodoInizioRaw + (periodoInizioRaw.length === 10 ? 'T12:00:00' : ''));
          if (!isNaN(dStart.getTime()) && dStart.getTime() > fixedEnd.getTime()) {
            // Se l'inizio resterebbe dopo la fine, allinealo all'anno della fine
            const fixedStart = new Date(dStart);
            fixedStart.setFullYear(fixedEnd.getFullYear());
            periodoInizio = toDateOnlyString(fixedStart);
            fixedStartYear = fixedStart.getFullYear();
          } else if (!isNaN(dStart.getTime()) && dStart.toISOString().split('T')[0] < wpDateOnly) {
            const fixedStart = normalizePastDateToWp(dStart, wpDt);
            if (fixedStart.getTime() <= fixedEnd.getTime()) {
              periodoInizio = toDateOnlyString(fixedStart);
              fixedStartYear = fixedStart.getFullYear();
            }
          }
        }
        periodoDesc = rewritePeriodoDescYear(periodoDesc, fixedEnd.getFullYear(), fixedStartYear);
      }
    } catch (_) {}
  }

  // 4. Caso hard-coded '30/06/2026' con pubblicazione da settembre in poi -> 30/06 anno successivo
  if (!periodoFine && isRecentPost && rawContent.includes('30/06/2026') && wpDt.getMonth() >= 7) {
    try {
      if (periodoFineRaw) {
        const dEnd = new Date(periodoFineRaw + (periodoFineRaw.length === 10 ? 'T12:00:00' : ''));
        if (!isNaN(dEnd.getTime())) {
          const fixed = new Date(dEnd);
          fixed.setFullYear(wpDt.getFullYear() + 1);
          periodoFine = toDateOnlyString(fixed);
          periodoDesc = (periodoDesc ?? '').replace(/30\/06\/2026/g, `30/06/${wpDt.getFullYear() + 1}`) || `Fino al 30/06/${wpDt.getFullYear() + 1}`;
        }
      } else {
        const nextYear = wpDt.getFullYear() + 1;
        periodoFine = `${nextYear}-06-30`;
        periodoDesc = periodoDesc
          ? periodoDesc.replace(/30\/06\/2026/g, `30/06/${nextYear}`)
          : `Fino al 30/06/${nextYear}`;
      }
    } catch (_) {}
  }

  // 5. Solo periodo_fine passato senza scadenza (bandi senza scadenza esplicita)
  if (!scadenza && !periodoFine && !row.scadenza && periodoFineRaw) {
    const todayDate = now.toISOString().split('T')[0];
    if (periodoFineRaw < todayDate && isRecentPost) {
      try {
        const dEnd = new Date(periodoFineRaw + (periodoFineRaw.length === 10 ? 'T12:00:00' : ''));
        if (!isNaN(dEnd.getTime())) {
          const fixedEnd = normalizePastDateToWp(dEnd, wpDt);
          periodoFine = toDateOnlyString(fixedEnd);
          periodoDesc = rewritePeriodoDescYear(periodoDesc, fixedEnd.getFullYear());
        }
      } catch (_) {}
    }
  }

  if (!scadenza && !periodoFine && !periodoInizio) return null;
  // Evita suggerimenti identici agli originali
  const sameScad = scadenza && row.scadenza && new Date(scadenza).getTime() === new Date(row.scadenza).getTime();
  const sameFine = periodoFine && periodoFine === periodoFineRaw;
  if ((scadenza && sameScad && !periodoFine) || (periodoFine && sameFine && !scadenza)) {
    // Se la scadenza è già normalizzata nel DB ma il raw è vecchio, suggerisci comunque
    // la conferma (serve a rimuovere il flag): mantieni il suggerimento.
    const rawHasOldYear = (row.scadenza_raw && /2025/.test(row.scadenza_raw)) || (periodoDesc && /2025/.test(periodoDesc));
    if (!rawHasOldYear) return null;
  }

  return {
    scadenza,
    periodo_inizio: periodoInizio,
    periodo_fine: periodoFine,
    periodo_desc: periodoDesc !== row.periodo_desc ? periodoDesc : periodoFine ? periodoDesc : null,
  };
}

export function formatInterpelloItem(row: any) {
  const item = { ...row };

  // Se l'utente ha già applicato le date corrette localmente, non ricalcolare anomalie:
  // mostra il bando come attivo con countdown reale.
  const dateFixedByUser = !!(item as any).date_fixed_by_user;

  // Json fields parsing if string
  if (typeof item.classi_concorso === 'string') {
    try { item.classi_concorso = JSON.parse(item.classi_concorso); } catch (_) { item.classi_concorso = []; }
  }
  if (!Array.isArray(item.classi_concorso)) item.classi_concorso = [];

  if (typeof item.attachments === 'string') {
    try { item.attachments = JSON.parse(item.attachments); } catch (_) { item.attachments = []; }
  }
  if (!Array.isArray(item.attachments)) item.attachments = [];

  if (typeof item.posti_dettaglio === 'string') {
    try { item.posti_dettaglio = JSON.parse(item.posti_dettaglio); } catch (_) { item.posti_dettaglio = []; }
  }
  if (!Array.isArray(item.posti_dettaglio)) item.posti_dettaglio = [];

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

  // Incoerenza strutturale: scadenza candidature successiva all'inizio del servizio.
  // Non tocca countdown/scaduto (la scadenza estratta resta valida come informazione),
  // serve solo a segnalare il problema e a offrire la revisione con scansione IA.
  let hasDateInconsistency = false;
  let dateInconsistencyDesc: string | null = null;
  if (item.scadenza && item.periodo_inizio) {
    try {
      const exp = new Date(item.scadenza);
      const inizioStr = String(item.periodo_inizio).slice(0, 10);
      if (!isNaN(exp.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(inizioStr)) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const expDay = `${exp.getFullYear()}-${pad(exp.getMonth() + 1)}-${pad(exp.getDate())}`;
        if (expDay > inizioStr) {
          hasDateInconsistency = true;
          const s = formatShortIT(item.scadenza) ?? String(item.scadenza);
          const i = formatDateOnlyIT(inizioStr) ?? inizioStr;
          dateInconsistencyDesc = `La scadenza candidature (${s}) è successiva all'inizio del servizio indicato (${i}): date incoerenti, probabile refuso della scuola o estrazione errata. Verifica il bando o lancia la scansione IA per revisionarle.`;
        }
      }
    } catch (_) {}
  }

  if (dateFixedByUser) {
    // Countdown reale sulle date corrette dall'utente, mai "scaduto per refuso"
    if (item.scadenza) {
      try {
        const exp = new Date(item.scadenza);
        if (!isNaN(exp.getTime())) {
          const diffSec = Math.floor((exp.getTime() - now.getTime()) / 1000);
          timeRemainingSeconds = diffSec;
          isExpired = diffSec <= 0;
        }
      } catch (_) {}
    } else if (item.periodo_fine) {
      isExpired = item.periodo_fine < todayDate;
      if (wpDt && (now.getTime() - wpDt.getTime()) <= 14 * 86400 * 1000) {
        isExpired = false;
      }
    } else {
      if (wpDt && (now.getTime() - wpDt.getTime()) > 7 * 86400 * 1000) {
        isExpired = true;
      }
    }
    item.is_expired = isExpired;
    item.time_remaining_seconds = timeRemainingSeconds;
    item.has_date_anomaly = false;
    item.date_anomaly_desc = null;
    item.has_suggested_dates = false;
    item.suggested_scadenza = null;
    item.suggested_periodo_fine = null;
    item.suggested_periodo_inizio = null;
    item.suggested_periodo_desc = null;
    item.suggested_dates_label = null;
    item.has_date_inconsistency = hasDateInconsistency;
    item.date_inconsistency_desc = dateInconsistencyDesc;
    return item;
  }

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
        let diffSec = Math.floor((exp.getTime() - now.getTime()) / 1000);

        if (wpDt && exp.getTime() < wpDt.getTime()) {
          hasDateAnomaly = true;
          const normalizedExp = new Date(exp);
          normalizedExp.setFullYear(wpDt.getFullYear());
          if (normalizedExp < wpDt) {
            normalizedExp.setFullYear(wpDt.getFullYear() + 1);
          }
          diffSec = Math.floor((normalizedExp.getTime() - now.getTime()) / 1000);
          timeRemainingSeconds = diffSec;

          if (diffSec <= 0) {
            isExpired = true;
          } else {
            isExpired = false;
            if (!dateAnomalyDesc) {
              dateAnomalyDesc = "Data di scadenza indicata nel bando precedente alla pubblicazione (refuso della scuola): anno normalizzato, bando attivo.";
            }
          }
        } else if (pubIsMoreRecentThanFine || (hasDateAnomaly && isRecentPost && diffSec <= 0)) {
          isExpired = false;
          timeRemainingSeconds = diffSec;
        } else {
          timeRemainingSeconds = diffSec;
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
  item.has_date_inconsistency = hasDateInconsistency;
  item.date_inconsistency_desc = dateInconsistencyDesc;

  // Date più probabili suggerite (per il bottone "usa date corrette")
  try {
    if (hasDateAnomaly && wpDt) {
      const suggested = computeSuggestedDates(item, wpDt);
      if (suggested && (suggested.scadenza || suggested.periodo_fine)) {
        item.suggested_scadenza = suggested.scadenza;
        item.suggested_periodo_inizio = suggested.periodo_inizio;
        item.suggested_periodo_fine = suggested.periodo_fine;
        item.suggested_periodo_desc = suggested.periodo_desc;
        item.has_suggested_dates = true;
        item.suggested_dates_label = buildSuggestedLabel(suggested);
      } else {
        item.has_suggested_dates = false;
        item.suggested_scadenza = null;
        item.suggested_periodo_fine = null;
        item.suggested_periodo_inizio = null;
        item.suggested_periodo_desc = null;
        item.suggested_dates_label = null;
      }
    } else {
      item.has_suggested_dates = false;
      item.suggested_scadenza = null;
      item.suggested_periodo_fine = null;
      item.suggested_periodo_inizio = null;
      item.suggested_periodo_desc = null;
      item.suggested_dates_label = null;
    }
  } catch (_) {
    item.has_suggested_dates = false;
  }

  return item;
}

/** Applica le date suggerite a un item e ricalcola countdown senza anomalia. */
export function applySuggestedDatesToItem(item: any) {
  const next = { ...item };
  if (next.suggested_scadenza) next.scadenza = next.suggested_scadenza;
  if (next.suggested_periodo_fine) next.periodo_fine = next.suggested_periodo_fine;
  if (next.suggested_periodo_inizio) next.periodo_inizio = next.suggested_periodo_inizio;
  if (next.suggested_periodo_desc) next.periodo_desc = next.suggested_periodo_desc;
  next.date_fixed_by_user = true;
  return formatInterpelloItem(next);
}

/** Applica un override salvato in Dexie (stessa logica del bottone). */
export function applyDateOverrideToItem(item: any, override: { scadenza?: string | null; periodo_inizio?: string | null; periodo_fine?: string | null; periodo_desc?: string | null } | null | undefined) {
  if (!override) return item;
  const next = { ...item };
  if (override.scadenza) next.scadenza = override.scadenza;
  if (override.periodo_fine) next.periodo_fine = override.periodo_fine;
  if (override.periodo_inizio) next.periodo_inizio = override.periodo_inizio;
  if (override.periodo_desc) next.periodo_desc = override.periodo_desc;
  next.date_fixed_by_user = true;
  return formatInterpelloItem(next);
}
