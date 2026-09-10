'use client';

import React from 'react';
import { 
  MapPin, 
  Calendar, 
  FileText, 
  Download, 
  CheckCircle2, 
  Bookmark, 
  ChevronRight,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { Interpello } from '@/types/interpello';
import { CountdownBadge } from './CountdownBadge';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  });

  const bandoAttachment = interpello.attachments.find((a) => a.is_bando) || interpello.attachments[0];
  const domandaAttachment = interpello.attachments.find((a) => a.is_domanda);

  return (
    <Card className={`relative flex flex-col justify-between transition-all duration-150 hover:shadow-md ${
      isCandidato 
        ? 'ring-1 ring-foreground/20 bg-muted/20' 
        : isPreferito
        ? 'ring-1 ring-amber-500/30'
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
          {interpello.school_city && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
              <span className="truncate">{interpello.school_city}</span>
              {interpello.school_address && (
                <span className="truncate text-muted-foreground/70">· {interpello.school_address}</span>
              )}
            </div>
          )}
        </div>

        {/* Badges: Codici Classe Concorso e Specifiche */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          
          {/* Codice Concorso Monospace */}
          {interpello.classi_concorso.length > 0 ? (
            interpello.classi_concorso.map((cls) => (
              <Badge key={cls} variant="code">
                {cls}
              </Badge>
            ))
          ) : (
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
              Da bando
            </Badge>
          )}

          {/* Grado */}
          {interpello.ordine_scuola && (
            <Badge variant="secondary" className="text-[11px] font-normal">
              {interpello.ordine_scuola}
            </Badge>
          )}

          {/* Tipo Posto */}
          {interpello.tipo_posto && (
            <Badge variant="outline" className="text-[11px] font-normal">
              {interpello.tipo_posto}
            </Badge>
          )}

          {/* Ore / Posti */}
          {interpello.ore_settimanali && (
            <Badge variant="secondary" className="text-[11px] font-normal font-mono">
              {interpello.ore_settimanali}
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
              variant="warning"
              className="text-[11px] font-medium gap-1 cursor-help"
              title={interpello.date_anomaly_desc || 'Data indicata nel bando antecedente alla pubblicazione (probabile refuso della scuola)'}
            >
              <AlertCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>Verifica date</span>
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
        <div className="flex items-center gap-1.5">
          {bandoAttachment && (
            <a
              href={bandoAttachment.url}
              target="_blank"
              rel="noopener noreferrer"
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
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition"
              title="Modello di candidatura"
            >
              <Download className="w-3 h-3 text-muted-foreground" />
              <span>Modello</span>
            </a>
          )}
        </div>

        {/* Azioni Utente */}
        <div className="flex items-center gap-1">
          
          {/* Toggle Candidato */}
          <Button
            variant={isCandidato ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => onToggleStatus(interpello.id, interpello.status_candidatura, 'candidato')}
            className={`h-8 w-8 rounded-md ${isCandidato ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
            title={isCandidato ? 'Candidatura inviata' : 'Segna come inviata'}
          >
            <CheckCircle2 className="w-4 h-4" />
          </Button>

          {/* Toggle Preferito */}
          <Button
            variant={isPreferito ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => onToggleStatus(interpello.id, interpello.status_candidatura, 'preferito')}
            className={`h-8 w-8 rounded-md ${isPreferito ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-muted-foreground hover:text-foreground'}`}
            title={isPreferito ? 'Salvato tra i preferiti' : 'Salva nei preferiti'}
          >
            <Bookmark className={`w-4 h-4 ${isPreferito ? 'fill-current' : ''}`} />
          </Button>

          {/* Dettagli */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenDetails(interpello)}
            className="h-8 px-2.5 text-xs font-medium gap-1 ml-1"
          >
            <span>Dettagli</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>

        </div>

      </CardFooter>

    </Card>
  );
}
