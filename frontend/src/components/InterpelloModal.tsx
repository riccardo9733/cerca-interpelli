'use client';

import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Calendar, 
  Clock, 
  Mail, 
  FileText, 
  Download, 
  ExternalLink, 
  Copy, 
  Check, 
  Bookmark, 
  CheckCircle2, 
  Send,
  Navigation,
  FileCheck
} from 'lucide-react';
import { Interpello } from '@/types/interpello';
import { CountdownBadge } from './CountdownBadge';

interface InterpelloModalProps {
  interpello: Interpello | null;
  onClose: () => void;
  onUpdateStatus: (id: number, status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato', notes?: string) => void;
}

export function InterpelloModal({
  interpello,
  onClose,
  onUpdateStatus,
}: InterpelloModalProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [notes, setNotes] = useState(interpello?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  if (!interpello) return null;

  const isCandidato = interpello.status_candidatura === 'candidato';
  const isPreferito = interpello.status_candidatura === 'preferito';

  const handleCopy = (text: string, type: 'email' | 'subject') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    await onUpdateStatus(interpello.id, interpello.status_candidatura, notes);
    setIsSavingNotes(false);
  };

  // Google Maps URL
  const googleMapsUrl = interpello.latitude && interpello.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${interpello.latitude},${interpello.longitude}`
    : interpello.school_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${interpello.school_name} ${interpello.school_address}`)}`
    : null;

  // Mailto link
  const mailtoSubject = encodeURIComponent(interpello.oggetto_email || `Candidatura interpello ${interpello.title}`);
  const mailtoUrl = interpello.email_candidatura
    ? `mailto:${interpello.email_candidatura}?subject=${mailtoSubject}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Modale */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CountdownBadge
                scadenza={interpello.scadenza}
                scadenzaRaw={interpello.scadenza_raw}
                timeRemainingSeconds={interpello.time_remaining_seconds}
                isExpired={interpello.is_expired}
              />
              <span className="text-xs text-slate-400">
                Pubblicato il {new Date(interpello.wp_date).toLocaleDateString('it-IT')}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {interpello.school_name || interpello.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {interpello.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Modale Scrollabile */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
          
          {/* Banner Anomalia Refuso Date (?) */}
          {interpello.has_date_anomaly && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
              <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ?
              </div>
              <div className="space-y-1">
                <strong className="font-bold block text-xs uppercase tracking-wider text-amber-950 dark:text-amber-100">
                  Segnalazione: Possibile Refuso Date nel Testo della Scuola
                </strong>
                <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {interpello.date_anomaly_desc || "La scuola ha inserito nel bando una data antecedente alla pubblicazione (es. 2026 invece di 2027, o anno precedente). L'avviso è recente e da considerarsi attivo per l'anno scolastico in corso."}
                </p>
              </div>
            </div>
          )}

          {/* Griglia Metadati Principali */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Scadenza e Periodo */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Termine Candidatura</span>
              </div>
              <p className="text-base font-bold text-blue-950 dark:text-blue-200">
                {interpello.scadenza 
                  ? new Date(interpello.scadenza).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })
                  : interpello.scadenza_raw || 'Verificare nel bando allegato'}
              </p>
              {interpello.periodo_desc && (
                <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
                  <strong>Periodo:</strong> {interpello.periodo_desc}
                </div>
              )}
            </div>

            {/* Sede e Posizione */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>Sede Scolastica</span>
                </div>
                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Mappe</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {interpello.school_address || interpello.school_city || 'Provincia di Padova'}
              </p>
              {interpello.latitude && interpello.longitude && (
                <p className="text-xs text-slate-400">
                  Coordinate: {interpello.latitude.toFixed(4)}, {interpello.longitude.toFixed(4)}
                  {interpello.school_code ? ` · Codice: ${interpello.school_code}` : ''}
                </p>
              )}
            </div>

          </div>

          {/* Dettagli Cattedra e Concorso */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dettagli Incarico
            </h4>
            <div className="flex flex-wrap gap-2 items-center">
              {interpello.classi_concorso.map((cls) => (
                <span key={cls} className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  Classe di concorso: {cls}
                </span>
              ))}
              <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                Grado: {interpello.ordine_scuola || 'Non specificato'}
              </span>
              <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                Tipologia: {interpello.tipo_posto || 'Posto comune'}
              </span>
              {interpello.ore_settimanali && (
                <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {interpello.ore_settimanali}
                </span>
              )}
              {interpello.posti_disponibili && (
                <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  {interpello.posti_disponibili} posti
                </span>
              )}
            </div>
          </div>

          {/* Modalità di Candidatura (Email o Form) */}
          <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>Come Inviare la Candidatura</span>
            </div>

            {interpello.email_candidatura ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50">
                  <div className="truncate">
                    <span className="text-xs text-slate-400 block">Indirizzo Email / PEC Scuola:</span>
                    <strong className="text-sm text-slate-900 dark:text-white">{interpello.email_candidatura}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(interpello.email_candidatura!, 'email')}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition"
                      title="Copia email"
                    >
                      {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    {mailtoUrl && (
                      <a
                        href={mailtoUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Apri Client Mail</span>
                      </a>
                    )}
                  </div>
                </div>

                {interpello.oggetto_email && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50">
                    <div className="truncate">
                      <span className="text-xs text-slate-400 block">Oggetto Obbligatorio della Mail:</span>
                      <code className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{interpello.oggetto_email}</code>
                    </div>
                    <button
                      onClick={() => handleCopy(interpello.oggetto_email!, 'subject')}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition"
                      title="Copia oggetto"
                    >
                      {copiedSubject ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            ) : interpello.link_candidatura ? (
              <a
                href={interpello.link_candidatura}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition"
              >
                <span>Compila Modulo Online (Google Form)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <p className="text-xs text-slate-500">
                Consulta il bando allegato per conoscere l&apos;indirizzo o il portale dedicato a cui trasmettere la disponibilità.
              </p>
            )}
          </div>

          {/* Allegati Scaricabili */}
          {interpello.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Documenti e Modulistica Ufficiale ({interpello.attachments.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {interpello.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 hover:border-blue-500 transition group"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-medium truncate text-slate-800 dark:text-slate-200">
                        {att.name}
                      </span>
                    </div>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-500 shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Sezione Note Personali */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Le tue Note Personali
              </h4>
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                {isSavingNotes ? 'Salvataggio...' : 'Salva note'}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi note (es: candidatura inviata il 10/09 alle 15:00 da PEC personale, chiamata scuola...)"
              className="w-full p-3 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-slate-200"
              rows={2}
            />
          </div>

          {/* Testo estratto dal PDF (se presente) */}
          {interpello.content_raw && (
            <details className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <summary className="font-semibold cursor-pointer select-none text-slate-700 dark:text-slate-300">
                Visualizza testo estratto dal PDF
              </summary>
              <pre className="mt-3 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed max-h-60 overflow-y-auto">
                {interpello.content_raw}
              </pre>
            </details>
          )}

        </div>

        {/* Footer Modale con Azioni Stato */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3 flex-wrap">
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateStatus(interpello.id, isCandidato ? 'nessuno' : 'candidato', notes)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shadow-xs ${
                isCandidato
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isCandidato ? 'Candidatura inviata ✓' : 'Segna come Candidato'}</span>
            </button>

            <button
              onClick={() => onUpdateStatus(interpello.id, isPreferito ? 'nessuno' : 'preferito', notes)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shadow-xs ${
                isPreferito
                  ? 'bg-amber-500 text-white hover:bg-amber-400'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>{isPreferito ? 'Salvato nei Preferiti ★' : 'Salva nei Preferiti'}</span>
            </button>
          </div>

          <a
            href={interpello.wp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <span>Articolo originale USP</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

        </div>

      </div>
    </div>
  );
}
