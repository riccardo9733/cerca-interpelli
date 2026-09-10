'use client';

import React from 'react';
import { RefreshCw, Map, LayoutGrid, CheckCircle2, Bookmark, Flame, Database } from 'lucide-react';
import { Stats } from '@/types/interpello';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

interface NavbarProps {
  stats: Stats | null;
  activeView: 'list' | 'map';
  onViewChange: (view: 'list' | 'map') => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenDataManagement?: () => void;
}

export function Navbar({
  stats,
  activeView,
  onViewChange,
  onRefresh,
  isRefreshing,
  onOpenDataManagement,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
          
          {/* Brand & Titolo Enterprise */}
          <div className="flex items-center gap-3 min-w-max">
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
              </div>
              <p className="text-[11px] text-muted-foreground hidden md:block">
                Osservatorio supplenze e bandi scolastici
              </p>
            </div>
          </div>

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

          {/* Controlli Destra: Toggle Vista + Dati + Sincronizzazione */}
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

            {/* Pulsante Gestione Dati Personali / Backup */}
            {onOpenDataManagement && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenDataManagement}
                className="h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-normal"
                title="I tuoi dati personali e backup (IndexedDB)"
              >
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="hidden md:inline">Dati</span>
              </Button>
            )}

            {/* Pulsante Installazione PWA */}
            <PWAInstallPrompt variant="navbar" />

            {/* Selettore Tema Chiaro / Scuro / Auto */}
            <ThemeToggle />

            {/* Pulsante Sincronizza */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-normal"
              title={stats?.last_sync ? `Ultimo sync: ${stats.last_sync}` : 'Sincronizza ora'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-muted-foreground' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </Button>

          </div>

        </div>
      </div>
    </header>
  );
}
