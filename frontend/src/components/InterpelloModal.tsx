'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
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
  Landmark,
  Info,
  Paperclip,
  NotebookPen,
} from 'lucide-react';
import { getClassInfo } from '@/lib/classiConcorso';
import { Interpello, UserLocation } from '@/types/interpello';
import { calculateDistanceKm, formatDistance } from '@/lib/distance';
import { CountdownBadge } from './CountdownBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetClose,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

interface InterpelloModalProps {
  interpello: Interpello | null;
  onClose: () => void;
  onTogglePreferito: (id: number) => void;
  onToggleCandidato: (id: number) => void;
  onSaveNotes: (id: number, notes: string) => Promise<void> | void;
  userLocation?: UserLocation | null;
}

type TabId = 'info' | 'candidatura' | 'allegati' | 'note';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'info',        label: 'Info',        icon: <Info className="w-3.5 h-3.5" /> },
  { id: 'candidatura', label: 'Candidatura', icon: <Mail className="w-3.5 h-3.5" /> },
  { id: 'allegati',    label: 'Allegati',    icon: <Paperclip className="w-3.5 h-3.5" /> },
  { id: 'note',        label: 'Note',        icon: <NotebookPen className="w-3.5 h-3.5" /> },
];

export function InterpelloModal({
  interpello,
  onClose,
  onTogglePreferito,
  onToggleCandidato,
  onSaveNotes,
  userLocation,
}: InterpelloModalProps) {

  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    if (interpello) {
      setNotes(interpello.notes || '');
      setActiveTab('info');
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

  // Portale del Governo URL
  const govPortalUrl = interpello.wp_url || 'https://padova.istruzioneveneto.gov.it/category/interpelli-personale-docente/';

  // Mailto link
  const mailtoSubject = encodeURIComponent(interpello.oggetto_email || `Candidatura interpello ${interpello.title}`);
  const mailtoUrl = interpello.email_candidatura
    ? `mailto:${interpello.email_candidatura}?subject=${mailtoSubject}`
    : null;

  const hasAttachments = interpello.attachments.length > 0;
  const hasCandidatura = !!(interpello.email_candidatura || interpello.link_candidatura);

  return (
    <Sheet open={!!interpello} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="p-0 overflow-hidden"
        onInteractOutside={onClose}
      >
        {/* Swipe handle — solo mobile */}
        {isMobile && (
          <div className="mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-muted-foreground/30 shrink-0" />
        )}

        {/* Header */}
        <div className={`px-4 ${isMobile ? 'pt-2' : 'pt-4'} pb-0 border-b border-border`}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="space-y-1 pr-2 min-w-0">
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
              </div>
              <h2 className="text-base font-semibold text-foreground leading-snug">
                {interpello.school_name || interpello.title}
              </h2>
              <p className="text-xs text-muted-foreground line-clamp-1">{interpello.title}</p>
            </div>
            <SheetClose asChild>
              <button
                type="button"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </SheetClose>
          </div>
          <TabBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            hasCandidatura={hasCandidatura}
            hasAttachments={hasAttachments}
            hasNotes={notes.trim().length > 0}
          />
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 overflow-y-auto">
          <TabContent
            activeTab={activeTab}
            interpello={interpello}
            notes={notes}
            setNotes={setNotes}
            isSavingNotes={isSavingNotes}
            handleSaveNotes={handleSaveNotes}
            copiedEmail={copiedEmail}
            copiedSubject={copiedSubject}
            handleCopy={handleCopy}
            mailtoUrl={mailtoUrl}
            googleMapsUrl={googleMapsUrl}
            govPortalUrl={govPortalUrl}
            hasAttachments={hasAttachments}
            userLocation={userLocation}
          />
        </div>

        {/* Footer */}
        <DrawerFooterButtons
          isCandidato={isCandidato}
          isPreferito={isPreferito}
          onToggleCandidato={() => onToggleCandidato(interpello.id)}
          onTogglePreferito={() => onTogglePreferito(interpello.id)}
        />
      </SheetContent>
    </Sheet>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TabBarProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  hasCandidatura: boolean;
  hasAttachments: boolean;
  hasNotes: boolean;
}

function TabBar({ activeTab, setActiveTab, hasCandidatura, hasAttachments, hasNotes }: TabBarProps) {
  return (
    <div className="flex items-center gap-0.5 -mb-px">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const hasDot =
          (tab.id === 'candidatura' && hasCandidatura) ||
          (tab.id === 'allegati' && hasAttachments) ||
          (tab.id === 'note' && hasNotes);
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-t-md transition-colors cursor-pointer
              ${isActive
                ? 'text-foreground bg-card border border-b-card border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {hasDot && !isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabContentProps {
  activeTab: TabId;
  interpello: Interpello;
  notes: string;
  setNotes: (v: string) => void;
  isSavingNotes: boolean;
  handleSaveNotes: () => void;
  copiedEmail: boolean;
  copiedSubject: boolean;
  handleCopy: (text: string, type: 'email' | 'subject') => void;
  mailtoUrl: string | null;
  googleMapsUrl: string | null;
  govPortalUrl: string;
  hasAttachments: boolean;
  userLocation?: UserLocation | null;
}

function TabContent({
  activeTab,
  interpello,
  notes,
  setNotes,
  isSavingNotes,
  handleSaveNotes,
  copiedEmail,
  copiedSubject,
  handleCopy,
  mailtoUrl,
  googleMapsUrl,
  govPortalUrl,
  hasAttachments,
  userLocation,
}: TabContentProps) {
  return (
    <>
      {/* ── TAB INFO ── */}
      {activeTab === 'info' && (
        <div className="p-4 space-y-4 text-xs text-muted-foreground">
          {interpello.has_date_anomaly && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-xs shrink-0 mt-0.5 shadow-xs">?</span>
              <div className="space-y-0.5">
                <span className="font-semibold block text-xs">Bando Attivo · Verifica Date (Refuso Scuola)</span>
                <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  {interpello.date_anomaly_desc || "La data di pubblicazione è più recente della data indicata nel testo dal bando. L'avviso è recente ed è da considerarsi ATTIVO, ma si consiglia di consultare il bando per chiarire le date effettive."}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Termine Candidatura</span>
              </div>
              <p className="text-sm font-semibold text-foreground font-mono">
                {interpello.scadenza
                  ? new Date(interpello.scadenza).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })
                  : interpello.scadenza_raw || 'Da verificare nel bando'}
              </p>
              {interpello.periodo_desc && (
                <div className="pt-1.5 border-t border-border/60 text-[11px]">
                  <span className="text-muted-foreground">Periodo: </span>
                  <span className="font-medium text-foreground">{interpello.periodo_desc}</span>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-muted/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Sede Istituto</span>
                </div>
                {googleMapsUrl && (
                  <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-foreground hover:underline flex items-center gap-1 font-medium">
                    <span>Mappe</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">
                {interpello.school_address || interpello.school_city || 'Provincia di Padova'}
              </p>
              {interpello.school_code && (
                <p className="text-[11px] font-mono text-muted-foreground">Codice: {interpello.school_code}</p>
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

          <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground uppercase tracking-wider">Specifiche Incarico</span>
              {interpello.posti_dettaglio && interpello.posti_dettaglio.length > 1 && (
                <Badge variant="outline" className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
                  {interpello.posti_dettaglio.length} Cattedre distinte
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
              {interpello.ordine_scuola && <Badge variant="secondary">{interpello.ordine_scuola}</Badge>}
              {interpello.tipo_posto && <Badge variant="outline">{interpello.tipo_posto}</Badge>}
              {interpello.ore_settimanali && <Badge variant="secondary" className="font-mono">{interpello.ore_settimanali}</Badge>}
              {interpello.posti_disponibili && (
                <Badge variant="secondary" className="font-mono">
                  {interpello.posti_disponibili} {interpello.posti_disponibili === 1 ? 'posto' : 'posti totali'}
                </Badge>
              )}
            </div>
            {interpello.posti_dettaglio && interpello.posti_dettaglio.length > 0 && (
              <div className="mt-2 pt-3 border-t border-border/60 space-y-2">
                <span className="text-[11px] font-semibold text-foreground block">Prospetto Cattedre Disponibili:</span>
                <div className="space-y-2">
                  {interpello.posti_dettaglio.map((pos, idx) => (
                    <div key={idx} className="p-2.5 rounded-md bg-card border border-border/80 flex flex-col gap-1 text-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          {pos.codice_classe && <Badge variant="code" className="text-[11px] px-1.5 py-0.5">{pos.codice_classe}</Badge>}
                          <span>{pos.tipo_posto || 'Posto'}</span>
                          {pos.ordine_scuola && <span className="text-muted-foreground">· {pos.ordine_scuola}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                          {pos.posti && (
                            <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50">
                              {pos.posti} {pos.posti === 1 ? 'posto' : 'posti'}
                            </span>
                          )}
                          {pos.ore && <span className="text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{pos.ore}</span>}
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
        </div>
      )}

      {/* ── TAB CANDIDATURA ── */}
      {activeTab === 'candidatura' && (
        <div className="p-4 space-y-4 text-xs text-muted-foreground">
          <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Invio Candidatura</span>
            </div>
            {interpello.email_candidatura ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-card border border-border">
                  <div className="truncate pr-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Email / PEC</span>
                    <strong className="text-xs font-mono text-foreground select-all">{interpello.email_candidatura}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleCopy(interpello.email_candidatura!, 'email')} className="h-7 px-2 text-[11px] gap-1">
                      {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedEmail ? 'Copiata' : 'Copia'}</span>
                    </Button>
                    {mailtoUrl && (
                      <a href={mailtoUrl} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[11px] font-medium bg-foreground text-background hover:bg-foreground/90 transition">
                        <Send className="w-3 h-3" />
                        <span>Scrivi</span>
                      </a>
                    )}
                  </div>
                </div>
                {interpello.oggetto_email && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-card border border-border">
                    <div className="truncate pr-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Oggetto Richiesto</span>
                      <code className="text-xs font-mono text-foreground select-all">{interpello.oggetto_email}</code>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(interpello.oggetto_email!, 'subject')} className="h-7 px-2 text-[11px] gap-1 shrink-0">
                      {copiedSubject ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSubject ? 'Copiato' : 'Copia'}</span>
                    </Button>
                  </div>
                )}
              </div>
            ) : interpello.link_candidatura ? (
              <a href={interpello.link_candidatura} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition shadow-xs">
                <span>Compila Modulo Online Candidatura</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">Consultare il bando allegato per le modalità di invio.</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB ALLEGATI ── */}
      {activeTab === 'allegati' && (
        <div className="p-4 space-y-3 text-xs text-muted-foreground">
          <a href={govPortalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition group">
            <div className="flex items-center gap-2.5 truncate">
              <div className="p-2 rounded-md bg-muted shrink-0">
                <Landmark className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="truncate">
                <span className="text-xs font-semibold text-foreground block group-hover:underline">Avviso sul Portale del Governo</span>
                <span className="text-[11px] text-muted-foreground truncate block font-mono">padova.istruzioneveneto.gov.it</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground shrink-0 ml-2">
              <span>Apri</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
          {hasAttachments ? (
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-foreground uppercase tracking-wider block">Documenti allegati</span>
              <div className="space-y-2">
                {interpello.attachments.map((att, idx) => (
                  <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2.5 rounded-md bg-card border border-border hover:bg-muted/50 transition group">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate text-foreground">{att.name}</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">Nessun allegato disponibile per questo bando.</p>
          )}
        </div>
      )}

      {/* ── TAB NOTE ── */}
      {activeTab === 'note' && (
        <div className="p-4 space-y-4 text-xs text-muted-foreground">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground uppercase tracking-wider">Note Personali</span>
              <button onClick={handleSaveNotes} disabled={isSavingNotes} className="text-[11px] text-foreground hover:underline font-medium cursor-pointer">
                {isSavingNotes ? 'Salvataggio...' : 'Salva note'}
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi note (es. inviata PEC il 10/09, protocollata...)"
              className="w-full p-2.5 rounded-md text-xs bg-muted/30 border border-input focus:outline-none focus:ring-1 focus:ring-ring text-foreground resize-none"
              rows={4}
            />
          </div>
          {interpello.content_raw && (
            <details className="rounded-md border border-border/80 bg-muted/20 text-xs">
              <summary className="p-2.5 font-medium cursor-pointer select-none text-foreground">
                Testo integrale estratto dal PDF
              </summary>
              <pre className="p-3 pt-0 border-t border-border/60 overflow-x-auto whitespace-pre-wrap text-[11px] font-mono leading-relaxed max-h-64 text-muted-foreground">
                {interpello.content_raw}
              </pre>
            </details>
          )}
        </div>
      )}
    </>
  );
}

interface DrawerFooterButtonsProps {
  isCandidato: boolean;
  isPreferito: boolean;
  onToggleCandidato: () => void;
  onTogglePreferito: () => void;
}

function DrawerFooterButtons({ isCandidato, isPreferito, onToggleCandidato, onTogglePreferito }: DrawerFooterButtonsProps) {
  return (
    <div className="p-3.5 border-t border-border bg-card flex items-center gap-2 shrink-0">
      <Button
        variant={isCandidato ? "secondary" : "outline"}
        size="sm"
        onClick={onToggleCandidato}
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
        onClick={onTogglePreferito}
        className={`text-xs h-8 gap-1.5 transition-colors ${
          isPreferito
            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20'
            : 'hover:bg-muted'
        }`}
      >
        <Bookmark className={`w-3.5 h-3.5 ${isPreferito ? 'fill-current' : ''}`} />
        <span>{isPreferito ? 'Salvato' : 'Salva'}</span>
      </Button>
    </div>
  );
}

