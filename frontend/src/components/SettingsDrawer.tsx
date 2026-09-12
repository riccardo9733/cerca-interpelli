'use client';

import React, { useRef, useState } from 'react';
import { Settings, Sun, Moon, Laptop, Check, Database, Palette, Smartphone, Download, Upload, Trash2, ShieldCheck, CheckCircle2, AlertTriangle, Home } from 'lucide-react';
import { useTheme, Theme } from '@/components/ThemeProvider';
import { useIsMobile } from '@/hooks/use-mobile';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { HomeAddressAutocomplete } from '@/components/HomeAddressAutocomplete';
import type { UserLocation } from '@/types/interpello';
import {
  exportUserDataAsJSON,
  importUserDataFromJSON,
  clearAllUserData,
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataChanged: () => void;
  userLocation: UserLocation | null;
  onUserLocationChange: (location: UserLocation | null) => void;
  maxRadiusKm: number | null;
  onMaxRadiusKmChange: (radius: number | null) => void;
}

const themeOptions: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
  { value: 'system', label: 'Auto', icon: Laptop },
];

export function SettingsDrawer({ open, onOpenChange, onDataChanged, userLocation, onUserLocationChange, maxRadiusKm, onMaxRadiusKmChange }: SettingsDrawerProps) {
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleExport = async () => {
    try {
      const json = await exportUserDataAsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `interpelli-padova-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'Copia salvata! La trovi tra i file scaricati.' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Non è stato possibile salvare la copia. Riprova.' });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const success = await importUserDataFromJSON(content);
        if (success) {
          setStatusMessage({ type: 'success', text: 'Dati ripristinati correttamente!' });
          onDataChanged();
        } else {
          setStatusMessage({ type: 'error', text: 'Questo file non sembra una copia valida.' });
        }
      } catch {
        setStatusMessage({ type: 'error', text: 'Non è stato possibile leggere il file. Riprova.' });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClear = async () => {
    try {
      await clearAllUserData();
      localStorage.removeItem('cerca_interpelli_user_location');
      localStorage.removeItem('cerca_interpelli_max_radius');
      localStorage.removeItem('cerca_interpelli_filter_list_by_dist');

      setIsConfirmingClear(false);
      setStatusMessage({ type: 'success', text: 'Tutti i tuoi dati sono stati eliminati da questo browser.' });
      onDataChanged();
    } catch {
      setStatusMessage({ type: 'error', text: 'Non è stato possibile eliminare i dati. Riprova.' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          isMobile
            ? 'max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-8 pt-2'
            : 'overflow-y-auto p-6'
        )}
      >
        {/* Maniglia bottom-sheet su mobile */}
        {isMobile && (
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        )}

        <SheetHeader className="text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <SheetTitle>Impostazioni</SheetTitle>
              <SheetDescription>Aspetto, casa, i tuoi dati e l&apos;app</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Sezione Aspetto / Tema */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aspetto
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'border-foreground/30 bg-muted font-medium text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                    aria-pressed={isSelected}
                  >
                    <span className="relative">
                      <Icon className="w-4 h-4 shrink-0" />
                      {isSelected && (
                        <span className="absolute -right-2.5 -top-2.5 w-3.5 h-3.5 rounded-full bg-foreground text-background flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              &quot;Auto&quot; segue il tema chiaro o scuro del tuo telefono o computer.
            </p>
          </section>

          <Separator />

          {/* Sezione La tua casa */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Home className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                La tua casa
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Imposta dove abiti per vedere la distanza di ogni scuola e filtrare i bandi vicini a te.
            </p>
            <HomeAddressAutocomplete
              userLocation={userLocation}
              onUserLocationChange={onUserLocationChange}
              maxRadiusKm={maxRadiusKm}
              onMaxRadiusKmChange={onMaxRadiusKmChange}
            />
          </section>

          <Separator />

          {/* Sezione I tuoi dati */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                I tuoi dati
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Preferiti, candidature inviate, note e indirizzo di casa restano solo sul tuo dispositivo, nel tuo browser. Nessun altro può vederli.
            </p>

            <div className="p-3 rounded-lg bg-muted/60 border border-border space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Privacy garantita</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Niente viene salvato sui nostri server: se un collega apre l&apos;app dal suo telefono, vedrà solo i suoi dati.
              </p>
            </div>

            {statusMessage && (
              <div className={`p-2.5 rounded-md text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Salva o sposta i tuoi dati</p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Scarica una copia per tenerla al sicuro o per spostarla su un altro telefono o computer.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="h-9 text-xs gap-1.5 w-full justify-center"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Scarica copia</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 text-xs gap-1.5 w-full justify-center"
                >
                  <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Ripristina copia</span>
                </Button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
            </div>

            <div className="pt-2 border-t border-border">
              {!isConfirmingClear ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfirmingClear(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2 text-xs gap-1.5 w-full justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Elimina tutto da questo dispositivo</span>
                </Button>
              ) : (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2 text-center">
                  <p className="text-xs font-medium text-destructive">
                    Sei sicuro? Perderai preferiti, candidature, note e indirizzo salvati qui.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleClear}
                      className="h-7 text-xs px-3"
                    >
                      Sì, elimina tutto
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConfirmingClear(false)}
                      className="h-7 text-xs px-3"
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Sezione Installazione App */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Applicazione
              </h3>
            </div>
            <PWAInstallPrompt variant="settings" />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
