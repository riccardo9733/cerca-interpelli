'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { FiltersBar } from '@/components/FiltersBar';
import { InterpelloCard } from '@/components/InterpelloCard';
import { InterpelloModal } from '@/components/InterpelloModal';
import { MapView } from '@/components/MapView';
import { 
  fetchInterpelli, 
  fetchStats, 
  fetchClassi, 
  fetchOre,
  updateInterpelloStatus, 
  triggerManualSync,
  FilterParams 
} from '@/lib/api';
import { Interpello, Stats, UserLocation } from '@/types/interpello';
import { calculateDistanceKm } from '@/lib/distance';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [interpelli, setInterpelli] = useState<Interpello[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [availableClassi, setAvailableClassi] = useState<string[]>([]);
  const [availableOre, setAvailableOre] = useState<number[]>([]);
  const [activeView, setActiveView] = useState<'list' | 'map'>('list');
  const [selectedInterpello, setSelectedInterpello] = useState<Interpello | null>(null);
  
  // Posizione utente e filtro per distanza
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [maxRadiusKm, setMaxRadiusKm] = useState<number | null>(null);
  const [filterByDistanceInList, setFilterByDistanceInList] = useState<boolean>(false);

  const [filters, setFilters] = useState<FilterParams>({
    search: '',
    classe: 'tutte',
    ordine: 'tutti',
    ore: 'tutte',
    status: 'tutti',
    only_active: true,
    sort: 'date_desc',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Caricamento preferenze salvate in localStorage
  useEffect(() => {
    try {
      const savedLoc = localStorage.getItem('cerca_interpelli_user_location');
      if (savedLoc) setUserLocation(JSON.parse(savedLoc));
      const savedRadius = localStorage.getItem('cerca_interpelli_max_radius');
      if (savedRadius !== null && savedRadius !== 'null') {
        setMaxRadiusKm(Number(savedRadius));
      }
      const savedFilterList = localStorage.getItem('cerca_interpelli_filter_list_by_dist');
      if (savedFilterList !== null) {
        setFilterByDistanceInList(savedFilterList === 'true');
      }
    } catch (e) {
      console.error('Errore nel recupero della posizione salvata:', e);
    }
  }, []);

  const handleUserLocationChange = (loc: UserLocation | null) => {
    setUserLocation(loc);
    try {
      if (loc) {
        localStorage.setItem('cerca_interpelli_user_location', JSON.stringify(loc));
      } else {
        localStorage.removeItem('cerca_interpelli_user_location');
      }
    } catch (e) {}
  };

  const handleMaxRadiusKmChange = (radius: number | null) => {
    setMaxRadiusKm(radius);
    try {
      localStorage.setItem('cerca_interpelli_max_radius', radius === null ? 'null' : String(radius));
    } catch (e) {}
  };

  const handleFilterByDistanceInListChange = (val: boolean) => {
    setFilterByDistanceInList(val);
    try {
      localStorage.setItem('cerca_interpelli_filter_list_by_dist', String(val));
    } catch (e) {}
  };


  // Caricamento dati
  const loadData = useCallback(async (currentFilters: FilterParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const [items, statsData, classiData, oreData] = await Promise.all([
        fetchInterpelli(currentFilters),
        fetchStats(),
        fetchClassi(),
        fetchOre(),
      ]);
      setInterpelli(items);
      setStats(statsData);
      setAvailableClassi(classiData);
      setAvailableOre(oreData);
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

  // Calcolo interpelli visualizzati con supporto a filtro distanza e ordinamento
  const displayedInterpelli = useMemo(() => {
    let list = [...interpelli];

    // Se il filtro per distanza è attivo anche per l'elenco
    if (filterByDistanceInList && userLocation && maxRadiusKm !== null) {
      list = list.filter((item) => {
        if (!item.latitude || !item.longitude) return false;
        const d = calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          item.latitude,
          item.longitude
        );
        return d <= maxRadiusKm;
      });
    }

    // Ordinamento per distanza se selezionato
    if (filters.sort === 'distance_asc' && userLocation) {
      list.sort((a, b) => {
        const distA =
          a.latitude && a.longitude
            ? calculateDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude)
            : 999999;
        const distB =
          b.latitude && b.longitude
            ? calculateDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
            : 999999;
        return distA - distB;
      });
    }

    return list;
  }, [interpelli, filterByDistanceInList, userLocation, maxRadiusKm, filters.sort]);

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
          availableOre={availableOre}
          totalResults={displayedInterpelli.length}
          hasUserLocation={!!userLocation}
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
            userLocation={userLocation}
            onUserLocationChange={handleUserLocationChange}
            maxRadiusKm={maxRadiusKm}
            onMaxRadiusKmChange={handleMaxRadiusKmChange}
            filterByDistanceInList={filterByDistanceInList}
            onFilterByDistanceInListChange={handleFilterByDistanceInListChange}
          />
        ) : displayedInterpelli.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-center rounded-xl border border-border bg-card p-8 shadow-xs">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              <Inbox className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Nessun bando trovato
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Nessun interpello corrisponde ai parametri impostati. Prova a rimuovere alcuni filtri o aumentare il raggio.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({
                  search: '',
                  classe: 'tutte',
                  ordine: 'tutti',
                  ore: 'tutte',
                  status: 'tutti',
                  only_active: true,
                  sort: 'date_desc',
                });
                handleMaxRadiusKmChange(null);
                handleFilterByDistanceInListChange(false);
              }}
              className="mt-2 text-xs"
            >
              Azzera filtri
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {displayedInterpelli.map((item) => (
              <InterpelloCard
                key={item.id}
                interpello={item}
                onOpenDetails={(item) => setSelectedInterpello(item)}
                onToggleStatus={handleToggleStatus}
                userLocation={userLocation}
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
        userLocation={userLocation}
      />

    </div>
  );
}

