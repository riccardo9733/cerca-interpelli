'use client';

import React, { useRef } from 'react';
import { Map, LayoutGrid, CheckCircle2, Bookmark, Settings, ShieldCheck, LogOut } from 'lucide-react';
import { Stats } from '@/types/interpello';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ADMIN_CLICKS_REQUIRED, ADMIN_CLICK_WINDOW_MS } from '@/lib/admin';

interface NavbarProps {
  stats: Stats | null;
  activeView: 'list' | 'map';
  onViewChange: (view: 'list' | 'map') => void;
  onOpenSettings: () => void;
  isAdmin?: boolean;
  onSecretTrigger?: () => void;
  onLockAdmin?: () => void;
}

export function Navbar({
  stats,
  activeView,
  onViewChange,
  onOpenSettings,
  isAdmin = false,
  onSecretTrigger,
  onLockAdmin,
}: NavbarProps) {
  // Contatore click stealth sul brand: 8 click ravvicinati -> entra/esce admin
  const clickTimesRef = useRef<number[]>([]);

  const handleBrandClick = () => {
    const now = Date.now();
    const times = clickTimesRef.current.filter(
      (t) => now - t < ADMIN_CLICK_WINDOW_MS
    );
    times.push(now);
    clickTimesRef.current = times;
    if (times.length >= ADMIN_CLICKS_REQUIRED) {
      clickTimesRef.current = [];
      // Stesso gesto in entrata e in uscita: se già admin -> lock, altrimenti gate
      if (isAdmin) {
        onLockAdmin?.();
      } else {
        onSecretTrigger?.();
      }
    }
  };
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
          
          {/* Brand & Titolo Enterprise — 8 click ravvicinati = entra/esce admin (stealth) */}
          <button
            type="button"
            onClick={handleBrandClick}
            className="flex items-center gap-3 min-w-max text-left rounded-md cursor-default select-none focus-visible:outline-none"
            aria-label="Interpelli Padova"
            title=""
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-sm tracking-tighter shadow-xs">
              IP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-semibold tracking-tight text-foreground">
                  Interpelli Padova
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium tracking-wide rounded bg-muted text-muted-foreground border border-border">
                  UAT Veneto
                </span>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground hidden md:block">
                Osservatorio supplenze e bandi scolastici
              </p>
            </div>
          </button>

          {/* Statistiche Live (Ticker Desktop & Tablet) */}
          {stats && (
            <div className="hidden lg:flex items-center h-8 gap-4 text-xs text-muted-foreground bg-muted/50 border border-border/80 px-3.5 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold font-mono">{stats.total_interpelli}</span>
                <span>totali</span>
              </div>
              <Separator orientation="vertical" className="h-3.5" />
              <div className="flex items-center gap-2 text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold font-mono">{stats.active_interpelli}</span>
                <span className="text-muted-foreground">attivi</span>
              </div>
              {stats.expiring_soon > 0 && (
                <>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                    <span className="font-mono font-semibold">{stats.expiring_soon}</span>
                    <span>in scadenza</span>
                  </div>
                </>
              )}
              {stats.candidati > 0 && (
                <>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1.5 text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold font-mono">{stats.candidati}</span>
                    <span className="text-muted-foreground">inviati</span>
                  </div>
                </>
              )}
              {stats.preferiti > 0 && (
                <>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Bookmark className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 fill-current" />
                    <span className="font-semibold font-mono">{stats.preferiti}</span>
                    <span className="text-muted-foreground">salvati</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Controlli Destra: Toggle Vista + Impostazioni */}
          <div className="flex items-center gap-2">
            
            {/* Toggle Lista / Mappa (Tabs Shadcn) */}
            <Tabs
              value={activeView}
              onValueChange={(val) => onViewChange(val as 'list' | 'map')}
              className="w-auto"
            >
              <TabsList className="h-8 sm:h-9 p-0.5 bg-muted border border-border/80">
                <TabsTrigger value="list" className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Elenco</span>
                </TabsTrigger>
                <TabsTrigger value="map" className="h-7 sm:h-8 px-2.5 sm:px-3 text-xs gap-1.5">
                  <Map className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Mappa</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Icona Impostazioni: apre il drawer Tema / Dati / Installazione App */}
            <Button
              variant="outline"
              size="icon"
              onClick={onOpenSettings}
              className="h-8 w-8 sm:h-9 sm:w-9"
              title="Impostazioni"
              aria-label="Apri impostazioni"
            >
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>

            {/* Logout admin — visibile solo in sessione sbloccata */}
            {isAdmin && onLockAdmin && (
              <Button
                variant="outline"
                size="icon"
                onClick={onLockAdmin}
                className="h-8 w-8 sm:h-9 sm:w-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                title="Blocca funzioni admin (logout)"
                aria-label="Blocca funzioni admin"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            )}

          </div>

        </div>
      </div>

      {/* Statistiche compatte (solo sotto i 1024px: il ticker completo è nascosto) */}
      {stats && (
        <div className="lg:hidden border-t border-border/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-0.5 py-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="text-foreground font-semibold font-mono">{stats.total_interpelli}</span>
                <span>totali</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-foreground font-semibold font-mono">{stats.active_interpelli}</span>
                <span>attivi</span>
              </span>
              {stats.expiring_soon > 0 && (
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                  <span className="font-mono font-semibold">{stats.expiring_soon}</span>
                  <span>in scadenza</span>
                </span>
              )}
              {stats.candidati > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-foreground font-semibold font-mono">{stats.candidati}</span>
                  <span>inviati</span>
                </span>
              )}
              {stats.preferiti > 0 && (
                <span className="flex items-center gap-1">
                  <Bookmark className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-current" />
                  <span className="text-foreground font-semibold font-mono">{stats.preferiti}</span>
                  <span>salvati</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
