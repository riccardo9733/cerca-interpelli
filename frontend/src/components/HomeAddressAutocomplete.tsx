'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X, Navigation, Loader2, Home, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { UserLocation } from '@/types/interpello';

interface Suggestion {
  displayName: string;
  latitude: number;
  longitude: number;
}

interface HomeAddressAutocompleteProps {
  userLocation: UserLocation | null;
  onUserLocationChange: (location: UserLocation | null) => void;
  maxRadiusKm: number | null;
  onMaxRadiusKmChange: (radius: number | null) => void;
}

export function HomeAddressAutocomplete({
  userLocation,
  onUserLocationChange,
  maxRadiusKm,
  onMaxRadiusKmChange,
}: HomeAddressAutocompleteProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ricerca suggerimenti con debounce (minimo 3 caratteri)
  useEffect(() => {
    const q = input.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setHasSearched(false);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=5&countrycodes=it` +
          `&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        setSuggestions(
          (Array.isArray(data) ? data : []).map((d: any) => ({
            displayName: d.display_name as string,
            latitude: parseFloat(d.lat),
            longitude: parseFloat(d.lon),
          }))
        );
        setSearchError(null);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setSuggestions([]);
        setSearchError('Ricerca non riuscita. Controlla la connessione e riprova.');
      } finally {
        setIsSearching(false);
        setHasSearched(true);
        setActiveIndex(-1);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [input]);

  // Chiudi i suggerimenti cliccando fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSuggestions([]);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (s: Suggestion) => {
    onUserLocationChange({
      address: s.displayName,
      latitude: s.latitude,
      longitude: s.longitude,
    });
    if (maxRadiusKm === null) {
      onMaxRadiusKmChange(15);
    }
    setInput('');
    setSuggestions([]);
    setSearchError(null);
    setGpsError(null);
  };

  const handleUseGPS = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Il tuo browser non supporta la rilevazione della posizione. Scrivi l’indirizzo qui sopra.');
      return;
    }
    setIsLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUserLocationChange({
          address: 'Posizione rilevata dal tuo dispositivo',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (maxRadiusKm === null) {
          onMaxRadiusKmChange(15);
        }
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setGpsError('Non riesco a rilevare la posizione. Scrivi l’indirizzo qui sopra.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleClear = () => {
    onUserLocationChange(null);
    onMaxRadiusKmChange(null);
    setInput('');
    setSuggestions([]);
    setSearchError(null);
    setGpsError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && suggestions.length > 0 && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleSelect(suggestions[0]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  const showEmptyHint =
    !userLocation &&
    input.trim().length >= 3 &&
    !isSearching &&
    hasSearched &&
    suggestions.length === 0 &&
    !searchError;

  return (
    <div className="space-y-2.5">
      {userLocation ? (
        <div className="flex items-center gap-2 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/70 rounded-lg px-2.5 py-2 text-xs text-blue-900 dark:text-blue-200">
          <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="font-medium truncate flex-1" title={userLocation.address}>
            {userLocation.address}
          </span>
          <button
            onClick={handleClear}
            className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-100 p-0.5 shrink-0 transition cursor-pointer"
            title="Rimuovi indirizzo di casa"
            aria-label="Rimuovi indirizzo di casa"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <div ref={containerRef} className="relative flex-1 min-w-0">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Via, piazza o comune… (es. Via Roma 10, Padova)"
                className="pl-9 pr-9 text-xs h-9"
                aria-label="Indirizzo di casa"
                autoComplete="off"
              />
              {isSearching ? (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
              ) : (
                input && (
                  <button
                    type="button"
                    onClick={() => {
                      setInput('');
                      setSuggestions([]);
                      setSearchError(null);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                    aria-label="Cancella testo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>

            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1.5 rounded-lg border border-border bg-card shadow-lg z-10 overflow-hidden">
                {suggestions.map((s, idx) => (
                  <li key={`${s.latitude}-${s.longitude}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(s)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-start gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                        activeIndex === idx ? 'bg-muted' : 'hover:bg-muted/60'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="leading-snug text-foreground line-clamp-2">{s.displayName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showEmptyHint && (
              <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                Nessun indirizzo trovato. Prova ad aggiungere il comune (es. «{input.trim()} Padova»).
              </p>
            )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleUseGPS}
              disabled={isLocating}
              title="Usa la mia posizione"
              aria-label="Usa la mia posizione"
              className="h-9 w-9 shrink-0"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
              )}
            </Button>
          </div>

          {(searchError || gpsError) && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{searchError || gpsError}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
