'use client';

import React from 'react';
import { Search, Filter, Sparkles, X, ArrowUpDown, Bookmark, CheckCircle2 } from 'lucide-react';
import { FilterParams } from '@/lib/api';

interface FiltersBarProps {
  filters: FilterParams;
  onFilterChange: (newFilters: Partial<FilterParams>) => void;
  availableClassi: string[];
  totalResults: number;
}

export function FiltersBar({
  filters,
  onFilterChange,
  availableClassi,
  totalResults,
}: FiltersBarProps) {
  const ordini = [
    { id: 'tutti', label: 'Tutti i gradi' },
    { id: 'Primaria', label: 'Primaria' },
    { id: 'Secondaria I grado', label: 'Medie (I Grado)' },
    { id: 'Secondaria II grado', label: 'Superiori (II Grado)' },
    { id: 'Infanzia', label: 'Infanzia' },
  ];

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs mb-6 transition-all space-y-4">
      
      {/* Riga 1: Ricerca testuale e Dropdown Classe Concorso */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        
        {/* Barra di Ricerca */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Cerca scuola, comune (es. Conselve, Volta, Legnaro), materia..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Classe Concorso */}
        <div className="w-full sm:w-60">
          <select
            value={filters.classe || 'tutte'}
            onChange={(e) => onFilterChange({ classe: e.target.value })}
            className="w-full py-2.5 px-3 rounded-xl text-sm font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="tutte">Tutte le Classi di Concorso</option>
            {availableClassi.map((cls) => (
              <option key={cls} value={cls}>
                Classe {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown Ordinamento */}
        <div className="w-full sm:w-52">
          <div className="relative">
            <select
              value={filters.sort || 'date_desc'}
              onChange={(e) => onFilterChange({ sort: e.target.value })}
              className="w-full py-2.5 px-3 rounded-xl text-sm font-medium bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
            >
              <option value="date_desc">Più recenti (data)</option>
              <option value="scadenza_asc">Scadenza più vicina</option>
              <option value="school_asc">Nome scuola (A-Z)</option>
            </select>
          </div>
        </div>

      </div>

      {/* Riga 2: Grado scolastico + Switch Solo Attivi + Filtri Stato */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
        
        {/* Pills Grado Scolastico */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ordini.map((ord) => {
            const isSelected = (filters.ordine || 'tutti') === ord.id;
            return (
              <button
                key={ord.id}
                onClick={() => onFilterChange({ ordine: ord.id })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {ord.label}
              </button>
            );
          })}
        </div>

        {/* Filtri stato rapido & Switch Solo Attivi */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Toggle Solo Attivi */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!filters.only_active}
              onChange={(e) => onFilterChange({ only_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded-md border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Solo bandi attivi</span>
          </label>

          {/* Quick filter: Candidati */}
          <button
            onClick={() => onFilterChange({ status: filters.status === 'candidato' ? 'tutti' : 'candidato' })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              filters.status === 'candidato'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>I miei inviati</span>
          </button>

          {/* Quick filter: Preferiti */}
          <button
            onClick={() => onFilterChange({ status: filters.status === 'preferito' ? 'tutti' : 'preferito' })}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              filters.status === 'preferito'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Salvati</span>
          </button>

          <span className="text-xs text-slate-400 ml-1">
            {totalResults} {totalResults === 1 ? 'risultato' : 'risultati'}
          </span>

        </div>

      </div>

    </div>
  );
}
