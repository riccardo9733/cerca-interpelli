'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, ArrowUpDown, Check, CheckCircle2, Bookmark } from 'lucide-react';
import { FilterParams } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';

interface FiltersBarProps {
  filters: FilterParams;
  onFilterChange: (newFilters: Partial<FilterParams>) => void;
  availableClassi: string[];
  availableOre?: number[];
  totalResults: number;
  hasUserLocation?: boolean;
}


export function FiltersBar({
  filters,
  onFilterChange,
  availableClassi,
  availableOre = [],
  totalResults,
  hasUserLocation = false,
}: FiltersBarProps) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const ordini = [
    { id: 'tutti', label: 'Tutti i gradi' },
    { id: 'Secondaria II grado', label: 'Superiori (II Grado)' },
    { id: 'Secondaria I grado', label: 'Medie (I Grado)' },
    { id: 'Primaria', label: 'Primaria' },
    { id: 'Infanzia', label: 'Infanzia' },
  ];

  // Calcola filtri attivi (diversi da default) per il badge
  let activeFilterCount = 0;
  if (filters.classe && filters.classe !== 'tutte') activeFilterCount++;
  if (filters.ordine && filters.ordine !== 'tutti') activeFilterCount++;
  if (filters.ore && filters.ore !== 'tutte') activeFilterCount++;
  if (filters.status && filters.status !== 'tutti') activeFilterCount++;
  if (filters.only_active === false) activeFilterCount++;
  if (filters.sort && filters.sort !== 'date_desc') activeFilterCount++;

  const resetFilters = () => {
    onFilterChange({
      search: '',
      classe: 'tutte',
      ordine: 'tutti',
      ore: 'tutte',
      status: 'tutti',
      only_active: true,
      sort: 'date_desc',
    });
  };

  return (
    <div className="w-full mb-6 space-y-3">
      
      {/* Barra di Ricerca & Trigger Mobile Filtri */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Cerca scuola, comune (es. Volta, Selvazzano), materia..."
            className="pl-9 pr-9 h-10 bg-card text-foreground rounded-lg"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown Classe Concorso (Desktop) */}
        <div className="hidden md:block w-48 shrink-0">
          <select
            value={filters.classe || 'tutte'}
            onChange={(e) => onFilterChange({ classe: e.target.value })}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value="tutte">Tutte le Classi</option>
            {availableClassi.map((cls) => (
              <option key={cls} value={cls}>
                Classe {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown Ore Settimanali (Desktop) */}
        <div className="hidden md:block w-48 shrink-0">
          <select
            value={filters.ore || 'tutte'}
            onChange={(e) => onFilterChange({ ore: e.target.value })}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value="tutte">Tutti gli orari</option>
            <option value="intera">Cattedra intera (≥ 18h)</option>
            <option value="spezzone">Spezzoni orari (&lt; 18h)</option>
            {availableOre.length > 0 && (
              <optgroup label="Ore specifiche">
                {availableOre.map((o) => (
                  <option key={o} value={o.toString()}>
                    {o} ore settimanali
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Ordinamento (Desktop) */}
        <div className="hidden md:block w-44 shrink-0">
          <select
            value={filters.sort || 'date_desc'}
            onChange={(e) => onFilterChange({ sort: e.target.value })}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value="date_desc">Data pubblicazione</option>
            <option value="scadenza_asc">Scadenza imminente</option>
            <option value="school_asc">Nome scuola (A-Z)</option>
            {hasUserLocation && (
              <option value="distance_asc">Distanza (più vicini)</option>
            )}
          </select>
        </div>

        {/* Bottone Filtri per Mobile & Tablet */}
        <Button
          variant={activeFilterCount > 0 ? 'default' : 'outline'}
          size="default"
          onClick={() => setIsMobileSheetOpen(true)}
          className="md:hidden h-10 px-3.5 gap-2 text-xs shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filtri</span>
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-background text-foreground text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Riga Filtri Rapidi (Desktop & Orizzontale a scorrimento su Mobile) */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar py-0.5">
        
        {/* Pills Grado Scolastico */}
        <div className="flex items-center gap-1.5 shrink-0">
          {ordini.map((ord) => {
            const isSelected = (filters.ordine || 'tutti') === ord.id;
            return (
              <button
                key={ord.id}
                onClick={() => onFilterChange({ ordine: ord.id })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {ord.label}
              </button>
            );
          })}
        </div>

        {/* Filtri rapidi di stato + Conteggio risultati */}
        <div className="flex items-center gap-2 shrink-0">
          
          <button
            onClick={() => onFilterChange({ only_active: !filters.only_active })}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filters.only_active
                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${filters.only_active ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
            <span>Solo attivi</span>
          </button>

          <button
            onClick={() => onFilterChange({ status: filters.status === 'candidato' ? 'tutti' : 'candidato' })}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filters.status === 'candidato'
                ? 'border-foreground/30 bg-foreground text-background font-semibold'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Inviati</span>
          </button>

          <button
            onClick={() => onFilterChange({ status: filters.status === 'preferito' ? 'tutti' : 'preferito' })}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filters.status === 'preferito'
                ? 'border-foreground/30 bg-foreground text-background font-semibold'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Salvati</span>
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1 cursor-pointer"
            >
              Azzera
            </button>
          )}

          <span className="text-xs text-muted-foreground font-mono hidden sm:inline-block ml-2">
            {totalResults} {totalResults === 1 ? 'bando' : 'bandi'}
          </span>

        </div>

      </div>

      {/* Sheet Filtri Completo per Smartphone (Bottom Sheet Drawer) */}
      <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
        <SheetContent side="bottom" className="p-5 max-h-[85vh] space-y-5">
          <SheetHeader>
            <SheetTitle className="text-base font-semibold">Filtri di Ricerca</SheetTitle>
            <SheetDescription>
              Personalizza i criteri di visualizzazione degli interpelli
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 text-xs">
            
            {/* Selettore Classe di Concorso */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Classe di concorso</label>
              <select
                value={filters.classe || 'tutte'}
                onChange={(e) => onFilterChange({ classe: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground"
              >
                <option value="tutte">Tutte le Classi</option>
                {availableClassi.map((cls) => (
                  <option key={cls} value={cls}>
                    Classe {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Selettore Ore Settimanali */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Ore settimanali / Orario</label>
              <select
                value={filters.ore || 'tutte'}
                onChange={(e) => onFilterChange({ ore: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground"
              >
                <option value="tutte">Tutti gli orari</option>
                <option value="intera">Cattedra intera (≥ 18h)</option>
                <option value="spezzone">Spezzoni orari (&lt; 18h)</option>
                {availableOre.length > 0 && (
                  <optgroup label="Ore specifiche">
                    {availableOre.map((o) => (
                      <option key={o} value={o.toString()}>
                        {o} ore settimanali
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Ordinamento */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Ordina per</label>
              <select
                value={filters.sort || 'date_desc'}
                onChange={(e) => onFilterChange({ sort: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs font-medium text-foreground"
              >
                <option value="date_desc">Data di pubblicazione (più recenti)</option>
                <option value="scadenza_asc">Scadenza più vicina</option>
                <option value="school_asc">Nome scuola (alfabetico)</option>
                {hasUserLocation && (
                  <option value="distance_asc">Distanza (più vicini)</option>
                )}
              </select>
            </div>


            {/* Grado Scolastico */}
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Grado scolastico</label>
              <div className="grid grid-cols-2 gap-2">
                {ordini.map((ord) => {
                  const isSelected = (filters.ordine || 'tutti') === ord.id;
                  return (
                    <button
                      key={ord.id}
                      onClick={() => onFilterChange({ ordine: ord.id })}
                      className={`p-2 rounded-lg text-xs font-medium border text-left flex items-center justify-between ${
                        isSelected
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-card text-foreground'
                      }`}
                    >
                      <span>{ord.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stato & Solo Attivi */}
            <div className="pt-2 border-t border-border space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={!!filters.only_active}
                  onChange={(e) => onFilterChange({ only_active: e.target.checked })}
                  className="w-4 h-4 rounded border-input text-foreground focus:ring-ring"
                />
                <span className="font-medium text-foreground">Mostra solo bandi ancora attivi</span>
              </label>
            </div>

          </div>

          <SheetFooter className="pt-2 flex flex-row gap-2">
            <Button
              variant="outline"
              onClick={resetFilters}
              className="flex-1 text-xs"
            >
              Azzera tutto
            </Button>
            <Button
              variant="default"
              onClick={() => setIsMobileSheetOpen(false)}
              className="flex-1 text-xs"
            >
              Mostra {totalResults} risultati
            </Button>
          </SheetFooter>

        </SheetContent>
      </Sheet>

    </div>
  );
}
