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
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      setError(err.message || 'Impossibile connettersi al server locale');
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

  // Aggiornamento rapido stato candidatura (candidato / preferito)
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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-muted selection:text-foreground">
      
      {/* Navbar Enterprise */}
      <Navbar
        stats={stats}
        activeView={activeView}
        onViewChange={setActiveView}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Contenuto Principale */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* Filtri e Ricerca */}
        <FiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          availableClassi={availableClassi}
          totalResults={interpelli.length}
        />

        {/* Gestione Errori */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(filters)}
              className="text-xs h-7 border-destructive/30 hover:bg-destructive/10 text-destructive"
            >
              Riprova
            </Button>
          </div>
        )}

        {/* Vista Principale: Elenco vs Mappa */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin text-foreground" />
            <p className="text-xs font-medium">Aggiornamento elenco interpelli...</p>
          </div>
        ) : activeView === 'map' ? (
          <MapView
            interpelli={interpelli}
            onSelectInterpello={(item) => setSelectedInterpello(item)}
          />
        ) : interpelli.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center rounded-xl border border-border bg-card p-8 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Inbox className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Nessun bando trovato
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Nessun interpello corrisponde ai parametri impostati. Prova a rimuovere alcuni filtri.
            </p>
            <Button
              variant="outline"
              size="sm"
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
              className="mt-2 text-xs"
            >
              Azzera filtri
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
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

      {/* Modale / Drawer Dettagli */}
      <InterpelloModal
        interpello={selectedInterpello}
        onClose={() => setSelectedInterpello(null)}
        onUpdateStatus={handleUpdateStatusAndNotes}
      />

    </div>
  );
}
