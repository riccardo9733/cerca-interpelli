'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { FiltersBar } from '@/components/FiltersBar';
import { InterpelloCard } from '@/components/InterpelloCard';
import { InterpelloModal } from '@/components/InterpelloModal';
import { MapView } from '@/components/MapView';
import { 
  fetchInterpelli, 
  fetchStats, 
  fetchClassi, 
  updateInterpelloStatus, 
  triggerManualSync,
  FilterParams 
} from '@/lib/api';
import { Interpello, Stats } from '@/types/interpello';
import { School, AlertCircle, RefreshCw, Sparkles, Inbox } from 'lucide-react';

export default function HomePage() {
  const [interpelli, setInterpelli] = useState<Interpello[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [availableClassi, setAvailableClassi] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'list' | 'map'>('list');
  const [selectedInterpello, setSelectedInterpello] = useState<Interpello | null>(null);
  
  const [filters, setFilters] = useState<FilterParams>({
    search: '',
    classe: 'tutte',
    ordine: 'tutti',
    status: 'tutti',
    only_active: false,
    sort: 'date_desc',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Caricamento dati
  const loadData = useCallback(async (currentFilters: FilterParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const [items, statsData, classiData] = await Promise.all([
        fetchInterpelli(currentFilters),
        fetchStats(),
        fetchClassi(),
      ]);
      setInterpelli(items);
      setStats(statsData);
      setAvailableClassi(classiData);
    } catch (err: any) {
      console.error('Errore durante caricamento:', err);
      setError(err.message || 'Impossibile connettersi al backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters);
  }, [filters, loadData]);

  // Gestione filtri
  const handleFilterChange = (newFilters: Partial<FilterParams>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Sincronizzazione manuale
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerManualSync();
      await loadData(filters);
    } catch (err: any) {
      alert('Errore sincronizzazione: ' + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Aggiornamento stato candidatura
  const handleToggleStatus = async (
    id: number,
    currentStatus: string,
    targetStatus: 'candidato' | 'preferito'
  ) => {
    const nextStatus = currentStatus === targetStatus ? 'nessuno' : targetStatus;
    
    // Aggiornamento ottimistico
    setInterpelli((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status_candidatura: nextStatus } : item
      )
    );

    try {
      const updated = await updateInterpelloStatus(id, nextStatus);
      if (selectedInterpello?.id === id) {
        setSelectedInterpello(updated);
      }
      // Ricarica statistiche
      const newStats = await fetchStats();
      setStats(newStats);
    } catch (err) {
      console.error('Errore update status:', err);
      loadData(filters); // rollback
    }
  };

  const handleUpdateStatusAndNotes = async (
    id: number,
    status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato',
    notes?: string
  ) => {
    try {
      const updated = await updateInterpelloStatus(id, status, notes);
      setInterpelli((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
      setSelectedInterpello(updated);
      const newStats = await fetchStats();
      setStats(newStats);
    } catch (err) {
      console.error('Errore update status/notes:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      
      {/* Navbar con statistiche e controlli */}
      <Navbar
        stats={stats}
        activeView={activeView}
        onViewChange={setActiveView}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Contenuto Principale */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Filtri e Ricerca */}
        <FiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          availableClassi={availableClassi}
          totalResults={interpelli.length}
        />

        {/* Gestione Errori */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData(filters)}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Vista Principale: Elenco vs Mappa */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Caricamento interpelli...</p>
          </div>
        ) : activeView === 'map' ? (
          <MapView
            interpelli={interpelli}
            onSelectInterpello={(item) => setSelectedInterpello(item)}
          />
        ) : interpelli.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Nessun interpello trovato
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Nessun bando corrisponde ai filtri selezionati. Prova a rimuovere alcuni filtri o a effettuare una ricerca più ampia.
            </p>
            <button
              onClick={() =>
                setFilters({
                  search: '',
                  classe: 'tutte',
                  ordine: 'tutti',
                  status: 'tutti',
                  only_active: false,
                  sort: 'date_desc',
                })
              }
              className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition"
            >
              Azzera tutti i filtri
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {interpelli.map((item) => (
              <InterpelloCard
                key={item.id}
                interpello={item}
                onOpenDetails={(item) => setSelectedInterpello(item)}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}

      </main>

      {/* Modale Dettagli */}
      <InterpelloModal
        interpello={selectedInterpello}
        onClose={() => setSelectedInterpello(null)}
        onUpdateStatus={handleUpdateStatusAndNotes}
      />

    </div>
  );
}
