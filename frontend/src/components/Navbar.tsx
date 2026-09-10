'use client';

import React from 'react';
import { School, RefreshCw, Map, LayoutGrid, CheckCircle2, Clock, Flame, BookOpen } from 'lucide-react';
import { Stats } from '@/types/interpello';

interface NavbarProps {
  stats: Stats | null;
  activeView: 'list' | 'map';
  onViewChange: (view: 'list' | 'map') => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function Navbar({
  stats,
  activeView,
  onViewChange,
  onRefresh,
  isRefreshing,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-slate-950/85 border-b border-slate-200/80 dark:border-slate-800 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Titolo */}
          <div className="flex items-center gap-3 min-w-max">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Cerca Interpelli
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                  Padova
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Monitoraggio automatico bandi e supplenze UAT Padova
              </p>
            </div>
          </div>

          {/* Statistiche Live */}
          {stats && (
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Totali: <strong>{stats.total_interpelli}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs font-medium text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Attivi: <strong>{stats.active_interpelli}</strong></span>
              </div>
              {stats.expiring_soon > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-xs font-medium text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-rose-600" />
                  <span>Scadono oggi: <strong>{stats.expiring_soon}</strong></span>
                </div>
              )}
              {stats.candidati > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-xs font-medium text-indigo-800 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Candidati: <strong>{stats.candidati}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Controlli Destra: Toggle Vista + Bottone Refresh */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Toggle Lista / Mappa */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onViewChange('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeView === 'list'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Elenco</span>
              </button>
              <button
                type="button"
                onClick={() => onViewChange('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeView === 'map'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>Mappa</span>
              </button>
            </div>

            {/* Pulsante Sincronizza ora */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title={stats?.last_sync ? `Ultimo sync: ${stats.last_sync}` : 'Sincronizza subito con USP'}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-xs transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Aggiorna</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
}
