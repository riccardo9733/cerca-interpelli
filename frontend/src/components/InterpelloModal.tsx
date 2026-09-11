'use client';

import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Briefcase,
  Landmark,
  Sparkles,
  Loader2
} from 'lucide-react';
import { getClassInfo } from '@/lib/classiConcorso';
import { Interpello, UserLocation } from '@/types/interpello';
import { calculateDistanceKm, formatDistance } from '@/lib/distance';
import { CountdownBadge } from './CountdownBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface InterpelloModalProps {
  interpello: Interpello | null;
  onClose: () => void;
  onTogglePreferito: (id: number) => void;
  onToggleCandidato: (id: number) => void;
  onSaveNotes: (id: number, notes: string) => Promise<void> | void;
  onScanAI?: (wpId: number) => void;
  isScanningAI?: boolean;
  userLocation?: UserLocation | null;
}

export function InterpelloModal({
  interpello,
  onClose,
  onTogglePreferito,
  onToggleCandidato,
  onSaveNotes,
  onScanAI,
  isScanningAI,
  userLocation,
}: InterpelloModalProps) {

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (interpello) {
      setNotes(interpello.notes || '');
    }
  }, [interpello]);

  if (!interpello) return null;

  const isCandidato = interpello.is_candidato !== undefined 
    ? interpello.is_candidato 
    : interpello.status_candidatura === 'candidato';
  const isPreferito = interpello.is_preferito !== undefined 
    ? interpello.is_preferito 
    : interpello.status_candidatura === 'preferito';

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
    await onSaveNotes(interpello.id, notes);
    setIsSavingNotes(false);
  };

  // Google Maps URL
  const googleMapsUrl = interpello.latitude && interpello.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${interpello.latitude},${interpello.longitude}`
    : interpello.school_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${interpello.school_name} ${interpello.school_address}`)}`
    : null;

  // Portale del Governo URL (link diretto all'avviso o alla categoria interpelli)
  const govPortalUrl = interpello.wp_url || 'https://padova.istruzioneveneto.gov.it/category/interpelli-personale-docente/';

  // Mailto link
  const mailtoSubject = encodeURIComponent(interpello.oggetto_email || `Candidatura interpello ${interpello.title}`);
  const mailtoUrl = interpello.email_candidatura
    ? `mailto:${interpello.email_candidatura}?subject=${mailtoSubject}`
    : null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in-0"
      onClick={onClose}
    >
      <div 
        className="relative w-full sm:max-w-2xl bg-card text-card-foreground sm:rounded-xl border border-border shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Handle visuale per swipe-down su mobile */}
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />

        {/* Header Modale */}
        <div className="p-4 sm:p-6 pb-4 border-b border-border flex items-start justify-between gap-4">
          <div className="space-y-1.5 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <CountdownBadge
                scadenza={interpello.scadenza}
                scadenzaRaw={interpello.scadenza_raw}
                timeRemainingSeconds={interpello.time_remaining_seconds}
                isExpired={interpello.is_expired}
              />
              <span className="text-[11px] font-mono text-muted-foreground">
                Pubblicato {new Date(interpello.wp_date).toLocaleDateString('it-IT')}
              </span>
              <a
                href={govPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition hover:underline"
                title="Apri sul portale del Governo (istruzioneveneto.gov.it)"
              >
                <Landmark className="w-3 h-3 text-muted-foreground" />
                <span>Portale Governo</span>
                <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
              </a>
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
              {interpello.school_name || interpello.title}
            </h2>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {interpello.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenuto Scrollabile */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-muted-foreground">
          
          {/* Segnalazione Refuso Date (se presente) */}
          {interpello.has_date_anomaly && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-xs shrink-0 mt-0.5 shadow-xs">
                ?
              </span>
              <div className="space-y-0.5">
                <span className="font-semibold block text-xs">Bando Attivo · Verifica Date (Refuso Scuola)</span>
                <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {interpello.date_anomaly_desc || "La data di pubblicazione è più recente della data indicata nel testo dal bando. L'avviso è recente ed è da considerarsi ATTIVO, ma si consiglia di consultare il bando per chiarire le date effettive."}
                </p>
              </div>
            </div>
          )}

          {/* Griglia Informazioni Chiave */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Scadenza Candidatura */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Termine Candidatura</span>
              </div>
              <p className="text-sm font-semibold text-foreground font-mono">
                {interpello.scadenza 
                  ? new Date(interpello.scadenza).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
                  : interpello.scadenza_raw || 'Da verificare nel bando allegato'}
              </p>
              {interpello.periodo_desc && (
                <div className="pt-1.5 border-t border-border/60 text-[11px]">
                  <span className="text-muted-foreground">Periodo: </span>
                  <span className="font-medium text-foreground">{interpello.periodo_desc}</span>
                </div>
              )}
            </div>

            {/* Sede Scolastica */}
            <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Sede Istituto</span>
                </div>
                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-foreground hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Mappe</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">
                {interpello.school_address || interpello.school_city || 'Provincia di Padova'}
              </p>
              {interpello.school_code && (
                <p className="text-[11px] font-mono text-muted-foreground">
                  Codice scuola: {interpello.school_code}
                </p>
              )}
              {userLocation && interpello.latitude && interpello.longitude && (
                <div className="pt-1.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Distanza da te:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                    {formatDistance(calculateDistanceKm(userLocation.latitude, userLocation.longitude, interpello.latitude, interpello.longitude))}
                  </span>
                </div>
              )}
            </div>


          </div>

          {/* Dettagli Cattedra e Concorso */}
          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground uppercase tracking-wider">
                Specifiche Incarico
              </span>
              {interpello.posti_dettaglio && interpello.posti_dettaglio.length > 1 && (
                <Badge variant="outline" className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
                  {interpello.posti_dettaglio.length} Posizioni / Cattedre distinte nel bando
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 items-center">
              {interpello.classi_concorso.map((cls) => {
                const info = getClassInfo(cls);
                return (
                  <Badge key={cls} variant="code" title={info ? info.name : `Classe ${cls}`}>
                    {info ? `${info.code} · ${info.name}` : `Classe ${cls}`}
                  </Badge>
                );
              })}
              {interpello.ordine_scuola && (
                <Badge variant="secondary">
                  {interpello.ordine_scuola}
                </Badge>
              )}
              {interpello.tipo_posto && (
                <Badge variant="outline">
                  {interpello.tipo_posto}
                </Badge>
              )}
              {interpello.ore_settimanali && (
                <Badge variant="secondary" className="font-mono">
                  {interpello.ore_settimanali}
                </Badge>
              )}
              {interpello.posti_disponibili && (
                <Badge variant="secondary" className="font-mono">
                  {interpello.posti_disponibili} {interpello.posti_disponibili === 1 ? 'posto' : 'posti totali'}
                </Badge>
              )}
            </div>

            {/* Schede Analitiche delle singole posizioni se presenti */}
            {interpello.posti_dettaglio && interpello.posti_dettaglio.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                <span className="text-[11px] font-semibold text-foreground block">
                  Prospetto Cattedre Disponibili:
                </span>
                <div className="space-y-2">
                  {interpello.posti_dettaglio.map((pos, idx) => (
                    <div key={idx} className="p-2.5 rounded-md bg-card border border-border/80 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          {pos.codice_classe && (
                            <Badge variant="code" className="text-[11px] px-1.5 py-0.5">
                              {pos.codice_classe}
                            </Badge>
                          )}
                          <span>{pos.tipo_posto || 'Posto'}</span>
                          {pos.ordine_scuola && <span className="text-muted-foreground">· {pos.ordine_scuola}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                          {pos.posti && (
                            <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">
                              {pos.posti} {pos.posti === 1 ? 'posto' : 'posti'}
                            </span>
                          )}
                          {pos.ore && (
                            <span className="text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                              {pos.ore}
                            </span>
                          )}
                        </div>
                      </div>
                      {(pos.periodo || pos.note) && (
                        <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2 pt-0.5">
                          {pos.periodo && <span>📅 {pos.periodo}</span>}
                          {pos.note && <span className="text-amber-600 dark:text-amber-400 italic">📌 {pos.note}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modalità di Candidatura (Email/PEC o Form) */}
          <div className="p-4 rounded-lg border border-border bg-muted/40 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Invio Candidatura</span>
            </div>

            {interpello.email_candidatura ? (
              <div className="space-y-2.5">
                {/* Casella Indirizzo PEC/Email */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-card border border-border">
                  <div className="truncate pr-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Email / PEC</span>
                    <strong className="text-xs font-mono text-foreground select-all">{interpello.email_candidatura}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(interpello.email_candidatura!, 'email')}
                      className="h-7 px-2 text-[11px] gap-1"
                    >
                      {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedEmail ? 'Copiata' : 'Copia'}</span>
                    </Button>
                    {mailtoUrl && (
                      <a
                        href={mailtoUrl}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-foreground text-background hover:bg-foreground/90 transition"
                      >
                        <Send className="w-3 h-3" />
                        <span>Scrivi</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Casella Oggetto Email */}
                {interpello.oggetto_email && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-card border border-border">
                    <div className="truncate pr-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Oggetto Richiesto</span>
                      <code className="text-xs font-mono text-foreground select-all">{interpello.oggetto_email}</code>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(interpello.oggetto_email!, 'subject')}
                      className="h-7 px-2 text-[11px] gap-1 shrink-0"
                    >
                      {copiedSubject ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSubject ? 'Copiato' : 'Copia'}</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : interpello.link_candidatura ? (
              <a
                href={interpello.link_candidatura}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition shadow-xs"
              >
                <span>Compila Modulo Online Candidatura</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                Consultare il bando allegato per conoscere le modalità di invio della candidatura.
              </p>
            )}
          </div>

          {/* Documenti e Fonte Ufficiale */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-foreground uppercase tracking-wider">
              Documenti e Pubblicazione Ufficiale
            </span>

            {/* Box Link Portale del Governo */}
            <a
              href={govPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition group"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="p-2 rounded-md bg-muted text-foreground shrink-0">
                  <Landmark className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="truncate">
                  <span className="text-xs font-semibold text-foreground block group-hover:underline">
                    Avviso sul Portale del Governo (gov.it)
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate block font-mono">
                    padova.istruzioneveneto.gov.it
                  </span>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground shrink-0 ml-2">
                <span>Vedi avviso</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </a>

            {/* Allegati */}
            {interpello.attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {interpello.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-md bg-card border border-border hover:bg-muted/50 transition group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate text-foreground">
                        {att.name}
                      </span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Note Personali */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground uppercase tracking-wider">
                Note Personali
              </span>
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="text-[11px] text-foreground hover:underline font-medium cursor-pointer"
              >
                {isSavingNotes ? 'Salvataggio...' : 'Salva note'}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi note (es. inviata PEC il 10/09, protocollata...)"
              className="w-full p-2.5 rounded-md text-xs bg-muted/30 border border-input focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-none"
              rows={2}
            />
          </div>

          {/* Testo Estratto dal PDF */}
          {interpello.content_raw && (
            <details className="rounded-md border border-border/80 bg-muted/20 text-xs">
              <summary className="p-2.5 font-medium cursor-pointer select-none text-foreground">
                Mostra testo integrale estratto dal PDF
              </summary>
              <pre className="p-3 pt-0 border-t border-border/60 overflow-x-auto whitespace-pre-wrap text-[11px] font-mono leading-relaxed max-h-48 text-muted-foreground">
                {interpello.content_raw}
              </pre>
            </details>
          )}

        </div>

        {/* Footer Modale: Azioni Rapide & Link Fonte */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-card flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant={isCandidato ? "secondary" : "outline"}
              size="sm"
              onClick={() => onToggleCandidato(interpello.id)}
              className={`text-xs h-8 gap-1.5 transition-colors ${
                isCandidato 
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' 
                  : 'hover:bg-muted'
              }`}
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${isCandidato ? 'stroke-[2.5]' : ''}`} />
              <span>{isCandidato ? 'Candidatura inviata' : 'Segna inviata'}</span>
            </Button>

            <Button
              variant={isPreferito ? "secondary" : "outline"}
              size="sm"
              onClick={() => onTogglePreferito(interpello.id)}
              className={`text-xs h-8 gap-1.5 transition-colors ${
                isPreferito 
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' 
                  : 'hover:bg-muted'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isPreferito ? 'fill-current' : ''}`} />
              <span>{isPreferito ? 'Salvato nei preferiti' : 'Salva nei preferiti'}</span>
            </Button>

            {onScanAI && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onScanAI(interpello.wp_id)}
                disabled={isScanningAI}
                className="text-xs h-8 gap-1.5 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/60 bg-purple-50/70 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-2xs"
                title="Esegui o ripeti la scansione approfondita con IA su questo bando"
              >
                {isScanningAI ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400" />
                    <span className="hidden sm:inline">Scansione in corso...</span>
                    <span className="sm:hidden">Analisi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Scansione IA</span>
                  </>
                )}
              </Button>
            )}
          </div>

          <a
            href={govPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 font-medium transition py-1 px-2 rounded-md hover:bg-muted"
            title="Apri l'avviso originale sul portale del Governo (istruzioneveneto.gov.it)"
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Portale del Governo</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </a>
        </div>

      </div>
    </div>
  );
}
