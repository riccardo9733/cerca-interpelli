'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Interpello, UserLocation } from '@/types/interpello';
import { geocodeAddress } from '@/lib/api';
import { calculateDistanceKm, formatDistance } from '@/lib/distance';
import { 
  MapPin, 
  Search, 
  Navigation, 
  X, 
  RotateCcw, 
  Sliders, 
  Check, 
  AlertCircle,
  Loader2,
  Home
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/components/ThemeProvider';

interface MapViewProps {
  interpelli: Interpello[];
  onSelectInterpello: (interpello: Interpello) => void;
  userLocation: UserLocation | null;
  onUserLocationChange: (location: UserLocation | null) => void;
  maxRadiusKm: number | null;
  onMaxRadiusKmChange: (radius: number | null) => void;
  filterByDistanceInList: boolean;
  onFilterByDistanceInListChange: (val: boolean) => void;
}

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

export function MapView({
  interpelli,
  onSelectInterpello,
  userLocation,
  onUserLocationChange,
  maxRadiusKm,
  onMaxRadiusKmChange,
  filterByDistanceInList,
  onFilterByDistanceInListChange,
}: MapViewProps) {
  const { resolvedTheme } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userLayerRef = useRef<any>(null);

  const [addressInput, setAddressInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Calcolo delle distanze e filtraggio per raggio
  const interpelliWithDistance = interpelli.map((item) => {
    let distance: number | null = null;
    if (userLocation && item.latitude && item.longitude) {
      distance = calculateDistanceKm(
        userLocation.latitude,
        userLocation.longitude,
        item.latitude,
        item.longitude
      );
    }
    return { ...item, distance };
  });

  const filteredInterpelli = interpelliWithDistance.filter((item) => {
    if (!userLocation || maxRadiusKm === null) return true;
    if (item.distance === null) return false;
    return item.distance <= maxRadiusKm;
  });

  // Ricerca indirizzo con Geocoder
  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addressInput.trim()) return;

    setIsSearching(true);
    setGeoError(null);

    try {
      const res = await geocodeAddress(addressInput.trim());
      if (res) {
        onUserLocationChange({
          address: res.address,
          latitude: res.latitude,
          longitude: res.longitude,
        });
        if (maxRadiusKm === null) {
          onMaxRadiusKmChange(15); // default a 15km al primo inserimento
        }
      } else {
        setGeoError('Indirizzo non trovato. Prova ad aggiungere la città o la provincia (es. "Padova", "Abano Terme").');
      }
    } catch (err: any) {
      setGeoError(err.message || 'Errore durante la ricerca della posizione');
    } finally {
      setIsSearching(false);
    }
  };

  // Posizione GPS dal browser
  const handleUseGPS = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('La geolocalizzazione non è supportata dal tuo browser.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        onUserLocationChange({
          address: 'Posizione GPS rilevata',
          latitude: lat,
          longitude: lon,
        });
        if (maxRadiusKm === null) {
          onMaxRadiusKmChange(15);
        }
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setGeoError(`Impossibile rilevare la posizione GPS (${err.message}). Inserisci manualmente un indirizzo.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleClearLocation = () => {
    onUserLocationChange(null);
    onMaxRadiusKmChange(null);
    setAddressInput('');
    setGeoError(null);
  };

  // Inizializzazione e aggiornamento mappa Leaflet
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        const map = L.map(mapContainerRef.current).setView([45.4064, 11.8768], 10);
        mapInstanceRef.current = map;

        const userLayer = L.layerGroup().addTo(map);
        userLayerRef.current = userLayer;

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
      }

      const map = mapInstanceRef.current;
      if (map) {
        // Aggiorna tile layer in base al tema corrente (Light Voyager / Dark Basemap)
        const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
        const isCarto = Boolean(cartoApiKey && cartoApiKey !== 'YOUR_KEY');
        const isDark = resolvedTheme === 'dark';

        const tileUrl = isCarto
          ? isDark
            ? `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoApiKey!)}`
            : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoApiKey!)}`
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        const attribution = isCarto
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        if (tileLayerRef.current) {
          map.removeLayer(tileLayerRef.current);
        }

        const newTileLayer = L.tileLayer(tileUrl, {
          attribution,
          subdomains: isCarto ? 'abcd' : 'abc',
          maxZoom: isCarto ? 20 : 19,
          className: !isCarto && isDark ? 'osm-dark-tiles' : undefined,
        }).addTo(map);

        tileLayerRef.current = newTileLayer;
        newTileLayer.bringToBack();
      }

      const markersLayer = markersLayerRef.current;
      const userLayer = userLayerRef.current;

      if (markersLayer && userLayer) {
        markersLayer.clearLayers();
        userLayer.clearLayers();

        const bounds = L.latLngBounds([]);
        let hasSchoolPoints = false;

        // 1. Disegna la posizione utente ed eventuale cerchio raggio
        if (userLocation) {
          bounds.extend([userLocation.latitude, userLocation.longitude]);

          const userHtml = `
            <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
              <div class="pulse-ring-anim" style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: #2563eb;"></div>
              <div style="position: relative; width: 26px; height: 26px; border-radius: 50%; background: #1d4ed8; border: 2.5px solid #ffffff; box-shadow: 0 2px 10px rgba(29, 78, 216, 0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px;">
                🏠
              </div>
            </div>
          `;

          const userIcon = L.divIcon({
            html: userHtml,
            className: 'custom-user-pin',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18],
          });

          const userMarker = L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon }).addTo(userLayer);
          userMarker.bindPopup(`
            <div style="font-family: system-ui, sans-serif; min-width: 170px; padding: 2px;">
              <div style="font-weight: 700; font-size: 12px; color: var(--foreground); margin-bottom: 2px;">📍 La tua posizione</div>
              <div style="font-size: 11px; color: var(--muted-foreground); line-height: 1.3;">${userLocation.address}</div>
              ${maxRadiusKm ? `<div style="margin-top: 6px; font-size: 10px; font-weight: 600; color: #2563eb; background: rgba(37, 99, 235, 0.1); padding: 2px 6px; border-radius: 4px; display: inline-block;">Raggio attivo: ${maxRadiusKm} km</div>` : ''}
            </div>
          `);

          if (maxRadiusKm) {
            const circle = L.circle([userLocation.latitude, userLocation.longitude], {
              radius: maxRadiusKm * 1000,
              color: '#2563eb',
              weight: 1.5,
              opacity: 0.7,
              dashArray: '5, 5',
              fillColor: '#3b82f6',
              fillOpacity: 0.08,
            }).addTo(userLayer);

            bounds.extend(circle.getBounds());
          }
        }

        // 2. Raggruppa i bandi per coordinate scuola
        const groupedByLocation: { [key: string]: typeof filteredInterpelli } = {};
        filteredInterpelli.forEach((item) => {
          if (item.latitude && item.longitude) {
            const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
            if (!groupedByLocation[key]) {
              groupedByLocation[key] = [];
            }
            groupedByLocation[key].push(item);
          }
        });

        Object.entries(groupedByLocation).forEach(([, items]) => {
          const first = items[0];
          const lat = first.latitude!;
          const lon = first.longitude!;
          const count = items.length;
          hasSchoolPoints = true;

          bounds.extend([lat, lon]);

          const hasExpiring = items.some(
            (it) => it.scadenza && !it.is_expired && (new Date(it.scadenza).getTime() - Date.now() < 24 * 60 * 60 * 1000)
          );

          const pinColor = count > 3 ? '#b91c1c' : count > 1 ? '#ea580c' : '#18181b';

          const customHtml = `
            <div style="
              position: relative;
              background-color: ${pinColor};
              width: 30px;
              height: 30px;
              border-radius: 8px;
              border: 2px solid #ffffff;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-family: monospace;
              font-weight: 700;
              font-size: 11px;
              cursor: pointer;
            ">
              ${count > 1 ? count : '•'}
              ${hasExpiring ? '<span style="position:absolute;top:-3px;right:-3px;width:7px;height:7px;background:#ef4444;border-radius:50%;border:1.5px solid #fff;"></span>' : ''}
            </div>
          `;

          const customIcon = L.divIcon({
            html: customHtml,
            className: 'custom-map-pin',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -16],
          });

          // Contenuto Popup
          const popupContent = document.createElement('div');
          popupContent.style.minWidth = '230px';
          popupContent.style.maxWidth = '280px';
          popupContent.style.padding = '4px';

          const distanceHtml = first.distance !== null ? `
            <div style="margin-bottom: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.25); color: #3b82f6; font-size: 10px; font-weight: 600; font-family: system-ui, sans-serif;">
              📏 ${formatDistance(first.distance)} da casa tua
            </div>
          ` : '';

          let listHtml = items.map((it) => `
            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border);">
              <div style="display:flex; justify-content:space-between; align-items:center; gap: 4px; margin-bottom: 2px;">
                <span style="font-family: monospace; font-weight: 700; font-size: 11px; color: var(--foreground); background: var(--muted); padding: 2px 5px; border-radius: 4px; border: 1px solid var(--border);">
                  ${it.classi_concorso.join(', ') || 'Classe da bando'}
                </span>
                ${it.has_date_anomaly ? `
                  <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; color: #d97706; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 1px 5px; border-radius: 4px;" title="${it.date_anomaly_desc || 'Data anomala (bando attivo)'}">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:12px; height:12px; border-radius:50%; background:#f59e0b; color:white; font-size:9px; font-weight:bold;">?</span> Data anomala
                  </span>
                ` : it.scadenza ? `<span style="font-size: 10px; color: var(--muted-foreground); font-family: monospace;">Scade ${new Date(it.scadenza).toLocaleDateString('it-IT')}</span>` : ''}
              </div>
              <div style="font-size: 11px; font-weight: 600; color: var(--foreground); line-height: 1.3;">
                ${it.title}
              </div>
              <button 
                id="btn-open-${it.id}"
                style="margin-top: 6px; width: 100%; text-align: center; padding: 4px 8px; font-size: 11px; font-weight: 500; color: var(--primary-foreground); background: var(--primary); border-radius: 6px; border: none; cursor: pointer;"
              >
                Dettagli & Candidatura
              </button>
            </div>
          `).join('');

          popupContent.innerHTML = `
            <div style="font-family: system-ui, sans-serif;">
              <div style="font-size: 12px; font-weight: 700; color: var(--foreground); margin-bottom: 2px;">
                ${first.school_name || 'Scuola'}
              </div>
              <div style="font-size: 11px; color: var(--muted-foreground); margin-bottom: 6px;">
                📍 ${first.school_address || first.school_city || 'Provincia di Padova'}
              </div>
              ${distanceHtml}
              <div>${listHtml}</div>
            </div>
          `;

          const marker = L.marker([lat, lon], { icon: customIcon }).addTo(markersLayer);
          marker.bindPopup(popupContent);

          marker.on('popupopen', () => {
            items.forEach((it) => {
              const btn = document.getElementById(`btn-open-${it.id}`);
              if (btn) {
                btn.onclick = () => {
                  onSelectInterpello(it);
                };
              }
            });
          });
        });

        // 3. Adatta la visuale
        if (mapInstanceRef.current && (hasSchoolPoints || userLocation)) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 14 });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [filteredInterpelli, userLocation, maxRadiusKm, onSelectInterpello, resolvedTheme]);

  return (
    <div className="space-y-3">
      
      {/* Barra Gestione Posizione & Filtro Raggio */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Form Inserimento Indirizzo o GPS */}
          <form onSubmit={handleSearchAddress} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="Inserisci indirizzo o comune (es. Padova centro, Abano Terme, Cittadella)..."
                className="pl-9 text-xs h-9"
              />
              {addressInput && (
                <button
                  type="button"
                  onClick={() => setAddressInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isSearching || !addressInput.trim()}
              className="h-9 text-xs gap-1.5 px-3 shrink-0"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>Cerca</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseGPS}
              disabled={isLocating}
              title="Rileva posizione attuale dal dispositivo"
              className="h-9 text-xs gap-1.5 px-3 shrink-0"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className="hidden sm:inline">Usa GPS</span>
            </Button>
          </form>

          {/* Posizione Attiva / Reset */}
          {userLocation && (
            <div className="flex items-center gap-2 shrink-0 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/70 rounded-lg px-2.5 py-1.5 text-xs text-blue-900 dark:text-blue-200">
              <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="font-medium truncate max-w-[200px] sm:max-w-[280px]" title={userLocation.address}>
                {userLocation.address}
              </span>
              <button
                onClick={handleClearLocation}
                className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-100 p-0.5 ml-1 transition"
                title="Rimuovi indirizzo personale"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* Notifica Errore Geocoding */}
        {geoError && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{geoError}</span>
          </div>
        )}

        {/* Opzioni Raggio e Sincronizzazione Elenco (se posizione attiva) */}
        {userLocation && (
          <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            
            {/* Pulsanti Raggio */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground font-medium mr-1 text-[11px] flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                Raggio:
              </span>
              {RADIUS_OPTIONS.map((km) => (
                <button
                  key={km}
                  onClick={() => onMaxRadiusKmChange(km)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    maxRadiusKm === km
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                  }`}
                >
                  {km} km
                </button>
              ))}
              <button
                onClick={() => onMaxRadiusKmChange(null)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  maxRadiusKm === null
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                }`}
              >
                Tutti
              </button>
            </div>

            {/* Checkbox Filtra anche nell'Elenco */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterByDistanceInList}
                  onChange={(e) => onFilterByDistanceInListChange(e.target.checked)}
                  className="rounded border-border text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span>Applica filtro distanza anche alla lista</span>
              </label>

              <Badge variant="secondary" className="text-[10px] font-mono shrink-0 ml-1">
                {filteredInterpelli.length} su {interpelli.length} bandi
              </Badge>
            </div>

          </div>
        )}

      </div>

      {/* Contenitore Mappa Leaflet */}
      <div className="relative w-full h-[500px] sm:h-[620px] rounded-xl overflow-hidden border border-border shadow-xs">
        <div ref={mapContainerRef} className="w-full h-full z-10" />
        
        {/* Legenda Discreta */}
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 backdrop-blur-md bg-card/90 px-3 py-2 rounded-lg border border-border shadow-xs text-xs space-y-1.5">
          <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Mappa Istituti ({filteredInterpelli.length} bandi)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-zinc-900 dark:bg-zinc-100 inline-block" />
              <span>Attivo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-700 inline-block" />
              <span>Scadenza &lt; 24h</span>
            </div>
            {userLocation && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span>La tua posizione</span>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
