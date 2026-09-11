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

  return item;
}
