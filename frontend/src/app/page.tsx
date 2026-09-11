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
  scanInterpelloWithAI,
  FilterParams 
} from '@/lib/api';
import { 
  migrateLegacyLocalStorage, 
  setUserSetting, 
  getUserSetting,
  removeUserSetting, 
  getAllUserStatuses, 
  toggleUserFavorite,
  toggleUserCandidato,
  saveUserNotes,
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
  const [scanningWpIds, setScanningWpIds] = useState<Set<number>>(new Set());
  
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

  // Inizializzazione impostazioni salvate su IndexedDB (Dexie) al mount
  useEffect(() => {
    async function initSettings() {
      // Migrazione iniziale trasparente da localStorage se presente
      await migrateLegacyLocalStorage();

      const [savedLoc, savedRadius, savedFilterList] = await Promise.all([
        getUserSetting<UserLocation | null>('user_location', null),
        getUserSetting<number | null>('max_radius_km', null),
        getUserSetting<boolean>('filter_by_distance_in_list', false),
      ]);

      if (savedLoc) setUserLocation(savedLoc);
      if (savedRadius !== null) setMaxRadiusKm(savedRadius);
      if (savedFilterList !== null) setFilterByDistanceInList(savedFilterList);
    }

    initSettings();
  }, []);

  // Handler per aggiornare e salvare le impostazioni in Dexie
  const handleUserLocationChange = async (loc: UserLocation | null) => {
    setUserLocation(loc);
    if (loc) {
      await setUserSetting('user_location', loc);
    } else {
      await removeUserSetting('user_location');
    }
  };

  const handleMaxRadiusKmChange = async (radius: number | null) => {
    setMaxRadiusKm(radius);
    if (radius !== null) {
      await setUserSetting('max_radius_km', radius);
    } else {
      await removeUserSetting('max_radius_km');
    }
  };

  const handleFilterByDistanceInListChange = async (enabled: boolean) => {
    setFilterByDistanceInList(enabled);
    await setUserSetting('filter_by_distance_in_list', enabled);
  };

  // Caricamento dati combinati (backend + Dexie IndexedDB locale)
  const loadData = useCallback(async (currentFilters: FilterParams) => {
    setIsLoading(true);
    setError(null);
    try {
      // Per il backend non filtriamo per status se è candidato/preferito/ignorato perché quei dati risiedono in Dexie
      const params: FilterParams = {
        ...currentFilters,
        status: currentFilters.status === 'candidato' || currentFilters.status === 'preferito' || currentFilters.status === 'ignorato' 
          ? 'tutti' 
          : currentFilters.status,
      };

      const [items, statsData, classiData, oreData, userStatuses, localCounts] = await Promise.all([
        fetchInterpelli(params),
        fetchStats(),
        fetchClassi(),
        fetchOre(),
        getAllUserStatuses(),
        getUserStatsCounts(),
      ]);

      // Merge locale: abbina a ciascun interpello i preferiti, la candidatura inviata e le note salvati in Dexie
      const mergedItems = items.map((item) => {
        const userStat = userStatuses[item.id];
        const isCandidato = !!userStat?.is_candidato;
        const isPreferito = !!userStat?.is_favorite;
        return {
          ...item,
          is_candidato: isCandidato,
          is_preferito: isPreferito,
          status_candidatura: (isCandidato ? 'candidato' : isPreferito ? 'preferito' : 'nessuno') as 'nessuno' | 'candidato' | 'preferito' | 'ignorato',
          notes: userStat?.notes !== undefined ? userStat.notes : item.notes,
          candidatura_date: userStat?.candidatura_date,
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

  // Toggle Preferito (non mutuamente esclusivo con candidatura inviata)
  const handleTogglePreferito = async (id: number) => {
    setInterpelli((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_preferito: !item.is_preferito } : item
      )
    );

    if (selectedInterpello?.id === id) {
      setSelectedInterpello((prev) => prev ? { ...prev, is_preferito: !prev.is_preferito } : null);
    }

    try {
      await toggleUserFavorite(id);
      const localCounts = await getUserStatsCounts();
      setStats((prev) => prev ? { ...prev, ...localCounts } : null);
    } catch (err) {
      console.error('Errore salvataggio preferito in Dexie:', err);
      loadData(filters);
    }
  };

  // Toggle Candidatura Inviata (non mutuamente esclusivo con preferito)
  const handleToggleCandidato = async (id: number) => {
    setInterpelli((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_candidato: !item.is_candidato } : item
      )
    );

    if (selectedInterpello?.id === id) {
      setSelectedInterpello((prev) => prev ? { ...prev, is_candidato: !prev.is_candidato } : null);
    }

    try {
      await toggleUserCandidato(id);
      const localCounts = await getUserStatsCounts();
      setStats((prev) => prev ? { ...prev, ...localCounts } : null);
    } catch (err) {
      console.error('Errore salvataggio candidatura in Dexie:', err);
      loadData(filters);
    }
  };

  // Salvataggio note personali in Dexie
  const handleSaveNotes = async (id: number, notes: string) => {
    try {
      await saveUserNotes(id, notes);
      setInterpelli((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, notes } : item
        )
      );
      if (selectedInterpello?.id === id) {
        setSelectedInterpello((prev) =>
          prev ? { ...prev, notes } : null
        );
      }
    } catch (err) {
      console.error('Errore salvataggio note in Dexie:', err);
    }
  };

  // Scansione approfondita con IA per singolo bando
  const handleScanAI = async (wpId: number) => {
    setScanningWpIds((prev) => new Set(prev).add(wpId));
    try {
      const result = await scanInterpelloWithAI(wpId);
      if (result.success && result.updated_items && result.updated_items.length > 0) {
        const userStatuses = await getAllUserStatuses();

        const mergedNewItems = result.updated_items.map((item) => {
          const userStat = userStatuses[item.id];
          const isCandidato = !!userStat?.is_candidato;
          const isPreferito = !!userStat?.is_favorite;
          return {
            ...item,
            is_candidato: isCandidato,
            is_preferito: isPreferito,
            status_candidatura: (isCandidato ? 'candidato' : isPreferito ? 'preferito' : 'nessuno') as 'nessuno' | 'candidato' | 'preferito' | 'ignorato',
            notes: userStat?.notes !== undefined ? userStat.notes : item.notes,
            candidatura_date: userStat?.candidatura_date,
          };
        });

        // Sostituisce le vecchie card di questo wpId mantenendo l'esatta posizione nell'elenco
        setInterpelli((prev) => {
          let inserted = false;
          const result: Interpello[] = [];
          for (const it of prev) {
            if (it.wp_id === wpId) {
              if (!inserted) {
                result.push(...mergedNewItems);
                inserted = true;
              }
            } else {
              result.push(it);
            }
          }
          return inserted ? result : [...mergedNewItems, ...prev];
        });

        // Se il modale è aperto sullo stesso bando, aggiorna i dati visualizzati
        if (selectedInterpello && selectedInterpello.wp_id === wpId) {
          const matchingUpdated = mergedNewItems.find(m => m.id === selectedInterpello.id) || mergedNewItems[0];
          setSelectedInterpello(matchingUpdated);
        }
      }
    } catch (err: any) {
      console.error('Errore scansione IA:', err);
      alert(`Errore scansione IA: ${err.message || String(err)}`);
    } finally {
      setScanningWpIds((prev) => {
        const next = new Set(prev);
        next.delete(wpId);
        return next;
      });
    }
  };

  // Calcolo interpelli visualizzati con supporto a filtri locali (status Dexie, distanza e ordinamento)
  const displayedInterpelli = useMemo(() => {
    let list = [...interpelli];

    // Filtro per status candidatura locale (se impostato su 'candidato' o 'preferito')
    if (filters.status && filters.status !== 'tutti') {
      if (filters.status === 'candidato') {
        list = list.filter((item) => item.is_candidato);
      } else if (filters.status === 'preferito') {
        list = list.filter((item) => item.is_preferito);
      }
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
        return d !== null && d <= maxRadiusKm;
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
  }, [interpelli, filters.status, filterByDistanceInList, userLocation, maxRadiusKm, filters.sort]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      
      {/* Header di Navigazione */}
      <Navbar
        stats={stats}
        activeView={activeView}
        onViewChange={setActiveView}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenDataManagement={() => setIsDataModalOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        
        {/* Barra Filtri e Ricerca */}
        <FiltersBar
          filters={filters}
          onFilterChange={handleFilterChange}
          availableClassi={availableClassi}
          availableOre={availableOre}
          totalResults={displayedInterpelli.length}
          hasUserLocation={!!userLocation}
        />

        {/* Feedback di Errore se presente */}
        {error && (
          <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadData(filters)}
              className="text-xs h-7 border-destructive/30 hover:bg-destructive/10"
            >
              Riprova
            </Button>
          </div>
        )}

        {/* Visualizzazione: Lista o Mappa */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Caricamento bandi in corso...</p>
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
                onTogglePreferito={handleTogglePreferito}
                onToggleCandidato={handleToggleCandidato}
                onScanAI={handleScanAI}
                isScanningAI={scanningWpIds.has(item.wp_id)}
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
        onTogglePreferito={handleTogglePreferito}
        onToggleCandidato={handleToggleCandidato}
        onSaveNotes={handleSaveNotes}
        onScanAI={handleScanAI}
        isScanningAI={selectedInterpello ? scanningWpIds.has(selectedInterpello.wp_id) : false}
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
