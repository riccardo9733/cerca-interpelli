'use client';

import React from 'react';
import {
  MapPin,
  Calendar,
  FileText,
  Download,
  CheckCircle2,
  Bookmark,
  Briefcase,
  AlertCircle,
  Sparkles,
  Loader2,
  Navigation,
  CalendarClock,
  PencilLine
} from 'lucide-react';
import { getClassInfo } from '@/lib/classiConcorso';
import { Interpello, UserLocation } from '@/types/interpello';
import { calculateDistanceKm, formatDistance } from '@/lib/distance';
import { CountdownBadge } from './CountdownBadge';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface InterpelloCardProps {
  interpello: Interpello;
  onOpenDetails: (interpello: Interpello) => void;
  onTogglePreferito: (id: number) => void;
  onToggleCandidato: (id: number) => void;
  onScanAI?: (wpId: number) => void;
  isScanningAI?: boolean;
  onApplySuggestedDates?: (interpello: Interpello) => void;
  onResetSuggestedDates?: (id: number) => void;
  isFixingDates?: boolean;
  userLocation?: UserLocation | null;
  isAdmin?: boolean;
  onEdit?: (interpello: Interpello) => void;
}

export function InterpelloCard({
  interpello,
  onOpenDetails,
  onTogglePreferito,
  onToggleCandidato,
  onScanAI,
  isScanningAI,
  onApplySuggestedDates,
  onResetSuggestedDates,
  isFixingDates,
  userLocation,
  isAdmin = false,
  onEdit,
}: InterpelloCardProps) {
  const isCandidato = interpello.is_candidato !== undefined 
    ? interpello.is_candidato 
    : interpello.status_candidatura === 'candidato';
  const isPreferito = interpello.is_preferito !== undefined 
    ? interpello.is_preferito 
    : interpello.status_candidatura === 'preferito';

  const hasMissingInfo =
    !interpello.scadenza ||
    !interpello.ore_settimanali || 
    !interpello.ordine_scuola || 
    interpello.ordine_scuola === 'Altro' || 
    !interpello.periodo_desc ||
    interpello.classi_concorso.length === 0 ||
    // Date incoerenti (es. scadenza dopo l'inizio del servizio): offri revisione IA
    !!interpello.has_date_inconsistency;

  const distance =
    userLocation && interpello.latitude && interpello.longitude
      ? calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          interpello.latitude,
          interpello.longitude
        )
      : null;


  // Format publishing date
  const pubDate = new Date(interpello.wp_date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
  });

  const bandoAttachment = interpello.attachments.find((a) => a.is_bando) || interpello.attachments[0];
  const domandaAttachment = interpello.attachments.find((a) => a.is_domanda);

  return (
    <Card 
      onClick={() => onOpenDetails(interpello)}
      className={`relative flex flex-col justify-between transition-all duration-150 cursor-pointer group hover:shadow-md ${
      isCandidato && isPreferito
        ? 'ring-1 ring-emerald-500/40 bg-emerald-500/[0.02]'
        : isCandidato 
        ? 'ring-1 ring-emerald-500/30 bg-emerald-500/[0.02]' 
        : isPreferito
        ? 'ring-1 ring-amber-500/30 bg-amber-500/[0.02]'
        : 'hover:border-zinc-300 dark:hover:border-zinc-700'
    }`}>
      
      {/* Intestazione & Contenuto Principale */}
      <CardHeader className="p-4 sm:p-5 pb-3 space-y-3">
        
        {/* Barra Superiore: Data e Countdown */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-muted-foreground/70" />
            <span>{pubDate}</span>
          </span>
          <CountdownBadge
            scadenza={interpello.scadenza}
            scadenzaRaw={interpello.scadenza_raw}
            timeRemainingSeconds={interpello.time_remaining_seconds}
            isExpired={interpello.is_expired}
            hasDateAnomaly={interpello.has_date_anomaly}
            dateAnomalyDesc={interpello.date_anomaly_desc}
          />
        </div>

        {/* Titolo e Scuola */}
        <div className="space-y-1">
          <h3 
            onClick={() => onOpenDetails(interpello)}
            className="text-sm sm:text-base font-semibold text-foreground leading-snug line-clamp-2 hover:underline underline-offset-2 cursor-pointer transition-colors"
          >
            {interpello.school_name || interpello.title}
          </h3>
          {(interpello.school_city || interpello.school_address) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1 truncate min-w-0">
                <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                <span className="truncate">{interpello.school_city || 'Padova'}</span>
                {interpello.school_address && (
                  <span className="truncate text-muted-foreground/70">· {interpello.school_address}</span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Badges: Codici Classe Concorso e Specifiche */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">

          {/* Codice Concorso Monospace */}
          {interpello.classi_concorso.length > 0 ? (
            interpello.classi_concorso.map((cls) => {
              const info = getClassInfo(cls);
              return (
                <Badge 
                  key={cls} 
                  variant="code"
                  title={info ? `${info.code} - ${info.name}` : `Classe ${cls}`}
                >
                  {cls}
                </Badge>
              );
            })
          ) : (
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
              Da bando
            </Badge>
          )}

          {/* Grado */}
          {interpello.ordine_scuola && interpello.ordine_scuola !== 'Altro' ? (
            <Badge variant="secondary" className="text-[11px] font-normal">
              {interpello.ordine_scuola}
            </Badge>
          ) : (
            <Badge 
              variant="outline" 
              className="text-[11px] font-normal text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
              title="Grado scolastico non classificato con certezza: visibile in tutti i gradi per non perdere nessun bando"
            >
              Grado da verificare
            </Badge>
          )}

          {/* Tipo Posto */}
          {interpello.tipo_posto && (
            <Badge variant="outline" className="text-[11px] font-normal">
              {interpello.tipo_posto}
            </Badge>
          )}

          {/* Ore / Posti */}
          {interpello.ore_settimanali ? (
            <Badge variant="secondary" className="text-[11px] font-normal font-mono">
              {interpello.ore_settimanali}
            </Badge>
          ) : (
            <Badge 
              variant="outline" 
              className="text-[11px] font-normal text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 font-mono"
              title="Ore settimanali non specificate o non rilevate: visibile per tutti gli orari"
            >
              Ore da bando
            </Badge>
          )}
          {interpello.posti_disponibili && (
            <Badge variant="secondary" className="text-[11px] font-normal font-mono">
              {interpello.posti_disponibili} {interpello.posti_disponibili === 1 ? 'posto' : 'posti'}
            </Badge>
          )}

          {/* Alert Refuso Anomalia Scuola */}
          {interpello.has_date_anomaly && (
            <Badge 
              variant="outline"
              className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 border-amber-400/80 bg-amber-100/70 dark:bg-amber-950/40 gap-1.5 cursor-help shadow-2xs"
              title={interpello.date_anomaly_desc || 'Data indicata nel bando antecedente alla pubblicazione (probabile refuso della scuola)'}
            >
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-500 text-white font-bold text-[9px] leading-none shrink-0 shadow-2xs">
                ?
              </span>
              <span>Data da verificare</span>
            </Badge>
          )}

          {/* Conferma date corrette applicate dall'utente */}
          {interpello.date_fixed_by_user && (
            <Badge
              variant="outline"
              className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 gap-1.5 cursor-help shadow-2xs"
              title="Hai applicato le date più probabili (anno normalizzato). Clicca l'icona ↺ in basso per ripristinare le originali."
            >
              <CalendarClock className="w-3 h-3 shrink-0" />
              <span>Date corrette</span>
            </Badge>
          )}

          {/* Incoerenza date: scadenza dopo l'inizio del servizio */}
          {interpello.has_date_inconsistency && (
            <Badge
              variant="outline"
              className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 border-amber-400/80 bg-amber-100/70 dark:bg-amber-950/40 gap-1.5 cursor-help shadow-2xs"
              title={interpello.date_inconsistency_desc || 'La scadenza candidature è successiva all\u2019inizio del servizio indicato: date incoerenti da verificare nel bando'}
            >
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-500 text-white font-bold text-[9px] leading-none shrink-0 shadow-2xs">
                ?
              </span>
              <span>Date incoerenti</span>
            </Badge>
          )}

          {/* Distanza da casa (ultima tile) */}
          {distance !== null && (
            <Badge
              variant="outline"
              className="text-[11px] font-semibold font-mono text-blue-700 dark:text-blue-300 border-blue-300/70 dark:border-blue-800/70 bg-blue-50 dark:bg-blue-950/40 gap-1"
              title="Distanza da casa tua"
            >
              <Navigation className="w-3 h-3 shrink-0" />
              <span>{formatDistance(distance)}</span>
            </Badge>
          )}

        </div>

      </CardHeader>

      {/* Sezione Periodo Supplenza */}
      {interpello.periodo_desc && (
        <CardContent className="px-4 sm:px-5 py-2 pt-0">
          <div className="p-2 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground/80">{interpello.periodo_desc}</span>
          </div>
        </CardContent>
      )}

      {/* Footer della Card: Azioni & Allegati */}
      <CardFooter className="px-4 sm:px-5 py-3 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-2">
        
        {/* Allegati Rapidi */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {bandoAttachment && (
            <a
              href={bandoAttachment.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition"
              title="Apri Bando PDF"
            >
              <FileText className="w-3 h-3 text-muted-foreground" />
              <span>Bando</span>
            </a>
          )}
          {domandaAttachment && (
            <a
              href={domandaAttachment.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition"
              title="Modello di candidatura"
            >
              <Download className="w-3 h-3 text-muted-foreground" />
              <span>Modello</span>
            </a>
          )}
        </div>

        {/* Azioni Utente */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>

          {/* Modifica admin */}
          {isAdmin && onEdit && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(interpello);
              }}
              className="h-8 w-8 rounded-md text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-2xs shrink-0"
              title="Modifica interpello (admin)"
            >
              <PencilLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </Button>
          )}
          
          {/* Scansione Approfondita IA — solo admin (invisibile agli altri) */}
          {isAdmin && hasMissingInfo && onScanAI && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onScanAI(interpello.wp_id);
              }}
              disabled={isScanningAI}
              className="h-8 w-8 rounded-md text-purple-700 dark:text-purple-300 border-purple-300/80 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-2xs shrink-0"
              title={interpello.has_date_inconsistency ? `Date incoerenti (scadenza dopo l\u2019inizio del servizio): revisiona con scansione IA dal bando${interpello.date_inconsistency_desc ? ` — ${interpello.date_inconsistency_desc}` : ''}` : "Scansione approfondita con IA (completa scadenza, ore, ordine scuola, periodo dal bando)"}
            >
              {isScanningAI ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400" />
              ) : (
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
            </Button>
          )}

          {/* Usa date più probabili — solo admin (invisibile agli altri) */}
          {isAdmin && interpello.has_date_anomaly && interpello.has_suggested_dates && !interpello.date_fixed_by_user && onApplySuggestedDates && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onApplySuggestedDates(interpello);
              }}
              disabled={isFixingDates}
              className="h-8 w-8 rounded-md text-amber-700 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors shadow-2xs shrink-0"
              title={`Usa le date più probabili${interpello.suggested_dates_label ? `: ${interpello.suggested_dates_label}` : ''}${interpello.date_anomaly_desc ? ` — ${interpello.date_anomaly_desc}` : ''}`}
            >
              {isFixingDates ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
              ) : (
                <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
            </Button>
          )}

          {/* Toggle Candidato */}
          <Button
            variant={isCandidato ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCandidato(interpello.id);
            }}
            className={`h-8 w-8 rounded-md transition-colors ${
              isCandidato 
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isCandidato ? 'Candidatura inviata (clicca per rimuovere)' : 'Segna come candidatura inviata'}
          >
            <CheckCircle2 className={`w-4 h-4 ${isCandidato ? 'stroke-[2.5]' : ''}`} />
          </Button>

          {/* Toggle Preferito */}
          <Button
            variant={isPreferito ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePreferito(interpello.id);
            }}
            className={`h-8 w-8 rounded-md transition-colors ${
              isPreferito 
                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isPreferito ? 'Salvato tra i preferiti (clicca per rimuovere)' : 'Salva nei preferiti'}
          >
            <Bookmark className={`w-4 h-4 ${isPreferito ? 'fill-current' : ''}`} />
          </Button>

        </div>

      </CardFooter>

    </Card>
  );
}
