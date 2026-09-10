'use client';

import React from 'react';
import { 
  School, 
  MapPin, 
  Calendar, 
  Clock, 
  FileText, 
  Download, 
  CheckCircle2, 
  Bookmark, 
  ExternalLink,
  ChevronRight,
  Briefcase,
  Users
} from 'lucide-react';
import { Interpello } from '@/types/interpello';
import { CountdownBadge } from './CountdownBadge';

interface InterpelloCardProps {
  interpello: Interpello;
  onOpenDetails: (interpello: Interpello) => void;
  onToggleStatus: (id: number, currentStatus: string, targetStatus: 'candidato' | 'preferito') => void;
}

export function InterpelloCard({
  interpello,
  onOpenDetails,
  onToggleStatus,
}: InterpelloCardProps) {
  const isCandidato = interpello.status_candidatura === 'candidato';
  const isPreferito = interpello.status_candidatura === 'preferito';

  // Format publishing date
  const pubDate = new Date(interpello.wp_date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const bandoAttachment = interpello.attachments.find((a) => a.is_bando) || interpello.attachments[0];
  const domandaAttachment = interpello.attachments.find((a) => a.is_domanda);

  return (
    <div className={`relative flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
      isCandidato 
        ? 'border-indigo-300 dark:border-indigo-800 ring-1 ring-indigo-500/20 bg-indigo-50/10' 
        : isPreferito
        ? 'border-amber-300 dark:border-amber-800 ring-1 ring-amber-500/20'
        : 'border-slate-200/80 dark:border-slate-800 shadow-xs'
    }`}>
      
      {/* Intestazione Card */}
      <div className="p-5 space-y-3.5 flex-1">
        
        {/* Riga superiore: Data e Countdown Scadenza */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Pubblicato il {pubDate}
          </span>
          <CountdownBadge
            scadenza={interpello.scadenza}
            scadenzaRaw={interpello.scadenza_raw}
            timeRemainingSeconds={interpello.time_remaining_seconds}
            isExpired={interpello.is_expired}
          />
        </div>

        {/* Nome Scuola e Titolo */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
                onClick={() => onOpenDetails(interpello)}>
              {interpello.school_name || interpello.title}
            </h3>
          </div>
          {interpello.school_city && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{interpello.school_city}</span>
              {interpello.school_address && (
                <span className="truncate max-w-[200px] text-slate-400">· {interpello.school_address}</span>
              )}
            </div>
          )}
        </div>

        {/* Badges: Classi di concorso e Dettagli */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {/* Badge Classi di concorso */}
          {interpello.classi_concorso.length > 0 ? (
            interpello.classi_concorso.map((cls) => (
              <span
                key={cls}
                className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800 tracking-wide"
              >
                {cls}
              </span>
            ))
          ) : (
            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Classe da verificare
            </span>
          )}

          {/* Badge Ordine Scuola */}
          {interpello.ordine_scuola && (
            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {interpello.ordine_scuola}
            </span>
          )}

          {/* Badge Tipo Posto (Sostegno / Comune) */}
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
            interpello.tipo_posto === 'Sostegno'
              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
          }`}>
            {interpello.tipo_posto || 'Posto Comune'}
          </span>

          {/* Badge Ore o Posti */}
          {interpello.ore_settimanali && (
            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
              {interpello.ore_settimanali}
            </span>
          )}
          {interpello.posti_disponibili && (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {interpello.posti_disponibili} {interpello.posti_disponibili === 1 ? 'posto' : 'posti'}
            </span>
          )}

          {/* Badge Anomalia Data Scuola (?) */}
          {interpello.has_date_anomaly && (
            <span
              className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 flex items-center gap-1 cursor-help shadow-xs"
              title={interpello.date_anomaly_desc || "Data originale con probabile refuso della scuola (es. 2026/2027)"}
            >
              <span className="w-4 h-4 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 flex items-center justify-center font-bold text-[10px]">?</span>
              <span>Data da verificare</span>
            </span>
          )}
        </div>

        {/* Box Periodo Supplenza */}
        {interpello.periodo_desc && (
          <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            interpello.has_date_anomaly
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}>
            <div className="flex items-center gap-2 truncate">
              <Briefcase className={`w-3.5 h-3.5 shrink-0 ${interpello.has_date_anomaly ? 'text-amber-600' : 'text-blue-500'}`} />
              <span className="font-medium truncate">{interpello.periodo_desc}</span>
            </div>
            {interpello.has_date_anomaly && (
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 shrink-0" title={interpello.date_anomaly_desc || ''}>
                (?) Refuso scuola
              </span>
            )}
          </div>
        )}

      </div>

      {/* Footer della Card: Allegati e Azioni */}
      <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 rounded-b-2xl flex items-center justify-between gap-2 flex-wrap">
        
        {/* Allegati veloci */}
        <div className="flex items-center gap-2">
          {bandoAttachment && (
            <a
              href={bandoAttachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
              title="Scarica bando firmato PDF"
            >
              <FileText className="w-3.5 h-3.5 text-rose-500" />
              <span>Bando PDF</span>
            </a>
          )}
          {domandaAttachment && (
            <a
              href={domandaAttachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
              title="Scarica modulo di candidatura (Allegato A)"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Modello A</span>
            </a>
          )}
        </div>

        {/* Azioni Utente: Candidato / Preferito / Dettagli */}
        <div className="flex items-center gap-1.5">
          
          {/* Toggle Candidato */}
          <button
            type="button"
            onClick={() => onToggleStatus(interpello.id, interpello.status_candidatura, 'candidato')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              isCandidato
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
            }`}
            title={isCandidato ? 'Candidatura contrassegnata come inviata' : 'Segna come inviata'}
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>

          {/* Toggle Preferito */}
          <button
            type="button"
            onClick={() => onToggleStatus(interpello.id, interpello.status_candidatura, 'preferito')}
            className={`p-1.5 rounded-lg text-xs font-medium transition ${
              isPreferito
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50'
            }`}
            title={isPreferito ? 'Salvato tra i preferiti' : 'Salva nei preferiti'}
          >
            <Bookmark className="w-4 h-4" />
          </button>

          {/* Apri Dettagli */}
          <button
            type="button"
            onClick={() => onOpenDetails(interpello)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
          >
            <span>Dettagli</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>

    </div>
  );
}
