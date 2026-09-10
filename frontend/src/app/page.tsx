'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { FiltersBar } from '@/components/FiltersBar';
import { InterpelloCard } from '@/components/InterpelloCard';
import { InterpelloModal } from '@/components/InterpelloModal';
import { DataManagementModal } from '@/components/DataManagementModal';
import { MapView } from '@/components/MapView';
import { 
  fetchInterpelli, 
  fetchStats, 
  fetchClassi, 
  fetchOre,
  triggerManualSync,
  FilterParams 
} from '@/lib/api';
import { 
  migrateLegacyLocalStorage, 
  setUserSetting, 
  removeUserSetting, 
  getAllUserStatuses, 
  saveUserStatus, 
  getUserStatsCounts 
} from '@/lib/db';
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
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  
  // Posizione utente e filtro per distanza (Dexie / IndexedDB)
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

  // Caricamento preferenze iniziali da Dexie (con migrazione automatica da localStorage se presente)
  useEffect(() => {
    async function initSettings() {
      try {
        const { migratedLocation, migratedRadius, migratedFilterList } = await migrateLegacyLocalStorage();
        if (migratedLocation) setUserLocation(migratedLocation);
        if (migratedRadius !== null) setMaxRadiusKm(migratedRadius);
        setFilterByDistanceInList(migratedFilterList);
      } catch (e) {
        console.error('Errore nel recupero impostazioni da Dexie:', e);
      }
    }
    initSettings();
  }, []);

  const handleUserLocationChange = async (loc: UserLocation | null) => {
    setUserLocation(loc);
    try {
      if (loc) {
        await setUserSetting('user_location', loc);
      } else {
        await removeUserSetting('user_location');
      }
    } catch (e) {
      console.error('Errore salvataggio posizione utente:', e);
    }
  };

  const handleMaxRadiusKmChange = async (radius: number | null) => {
    setMaxRadiusKm(radius);
    try {
      await setUserSetting('max_radius_km', radius);
    } catch (e) {
      console.error('Errore salvataggio raggio max:', e);
    }
  };

  const handleFilterByDistanceInListChange = async (val: boolean) => {
    setFilterByDistanceInList(val);
    try {
      await setUserSetting('filter_list_by_dist', val);
    } catch (e) {
      console.error('Errore salvataggio filtro lista per distanza:', e);
    }
  };

  // Caricamento dati (Backend interpelli + IndexedDB status locale)
  const loadData = useCallback(async (currentFilters: FilterParams) => {
    setIsLoading(true);
    setError(null);
    try {
      // Per il backend non filtriamo per status se è candidato/preferito/ignorato perché quei dati risiedono in Dexie
      const backendFilters: FilterParams = {
        ...currentFilters,
        status: currentFilters.status === 'candidato' || currentFilters.status === 'preferito' || currentFilters.status === 'ignorato' 
          ? 'tutti' 
          : currentFilters.status,
      };

      const [items, statsData, classiData, oreData, userStatuses, localCounts] = await Promise.all([
        fetchInterpelli(backendFilters),
        fetchStats(),
        fetchClassi(),
        fetchOre(),
        getAllUserStatuses(),
        getUserStatsCounts(),
      ]);

      // Merge locale: abbina a ciascun interpello lo status e le note dell'utente salvati in Dexie
      const mergedItems = items.map((item) => {
        const userStat = userStatuses[item.id];
        return {
          ...item,
          status_candidatura: (userStat?.status || 'nessuno') as 'nessuno' | 'candidato' | 'preferito' | 'ignorato',
          notes: userStat?.notes !== undefined ? userStat.notes : item.notes,
        };
      });

      setInterpelli(mergedItems);
      setAvailableClassi(classiData);
      setAvailableOre(oreData);

      // Unisci le statistiche pubbliche con i conteggi personali calcolati da Dexie
      setStats({
        ...statsData,
        candidati: localCounts.candidati,
        preferiti: localCounts.preferiti,
      });
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

  // Aggiornamento rapido stato candidatura (candidato / preferito) in Dexie (IndexedDB)
  const handleToggleStatus = async (
    id: number,
    currentStatus: string,
    targetStatus: 'candidato' | 'preferito'
  ) => {
    const nextStatus = currentStatus === targetStatus ? 'nessuno' : targetStatus;
    
    // Aggiornamento ottimistico dello stato React
    setInterpelli((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status_candidatura: nextStatus } : item
      )
    );

    if (selectedInterpello?.id === id) {
      setSelectedInterpello((prev) => prev ? { ...prev, status_candidatura: nextStatus } : null);
    }

    try {
      // Salvataggio nel database locale Dexie
      await saveUserStatus(id, nextStatus);
      const localCounts = await getUserStatsCounts();
      setStats((prev) => prev ? { ...prev, ...localCounts } : null);
    } catch (err) {
      console.error('Errore salvataggio status in Dexie:', err);
      loadData(filters); // rollback
    }
  };

  const handleUpdateStatusAndNotes = async (
    id: number,
    status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato',
    notes?: string
  ) => {
    try {
      // Salvataggio nel database locale Dexie
      await saveUserStatus(id, status, notes);
      setInterpelli((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status_candidatura: status, notes: notes ?? item.notes } : item
        )
      );
      if (selectedInterpello?.id === id) {
        setSelectedInterpello((prev) =>
          prev ? { ...prev, status_candidatura: status, notes: notes ?? prev.notes } : null
        );
      }
      const localCounts = await getUserStatsCounts();
      setStats((prev) => prev ? { ...prev, ...localCounts } : null);
    } catch (err) {
      console.error('Errore salvataggio note/status in Dexie:', err);
    }
  };

  // Calcolo interpelli visualizzati con supporto a filtri locali (status Dexie, distanza e ordinamento)
  const displayedInterpelli = useMemo(() => {
    let list = [...interpelli];

    // Filtro per status candidatura locale (se impostato su 'candidato' o 'preferito')
    if (filters.status && filters.status !== 'tutti') {
      list = list.filter((item) => item.status_candidatura === filters.status);
    }

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
  }, [interpelli, filterByDistanceInList, userLocation, maxRadiusKm, filters.sort, filters.status]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-muted selection:text-foreground">
      
      {/* Navbar Enterprise */}
      <Navbar
        stats={stats}
        activeView={activeView}
        onViewChange={setActiveView}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenDataManagement={() => setIsDataModalOpen(true)}
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

      {/* Modale Gestione Dati Personali IndexedDB (Dexie) */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        onDataChanged={() => loadData(filters)}
        homeAddress={userLocation?.address}
      />

    </div>
  );
}

