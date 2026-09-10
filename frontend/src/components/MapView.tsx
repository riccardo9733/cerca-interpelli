'use client';

import React, { useEffect, useRef } from 'react';
import { Interpello } from '@/types/interpello';
import { School, MapPin, ExternalLink, Clock } from 'lucide-react';

interface MapViewProps {
  interpelli: Interpello[];
  onSelectInterpello: (interpello: Interpello) => void;
}

export function MapView({ interpelli, onSelectInterpello }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    // Caricamento dinamico di Leaflet solo lato client
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Inizializza mappa se non già creata
      if (!mapInstanceRef.current) {
        // Fix icone default di leaflet
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const map = L.map(mapContainerRef.current).setView([45.4064, 11.8768], 10);
        mapInstanceRef.current = map;

        // Tile layer CartoDB Positron per un look moderno e pulito
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
      }

      // Aggiornamento markers
      const markersLayer = markersLayerRef.current;
      if (markersLayer) {
        markersLayer.clearLayers();

        // Raggruppa interpelli per posizione (scuola)
        const groupedByLocation: { [key: string]: Interpello[] } = {};
        interpelli.forEach((item) => {
          if (item.latitude && item.longitude) {
            const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
            if (!groupedByLocation[key]) {
              groupedByLocation[key] = [];
            }
            groupedByLocation[key].push(item);
          }
        });

        const bounds = L.latLngBounds([]);
        let hasPoints = false;

        Object.entries(groupedByLocation).forEach(([key, items]) => {
          const first = items[0];
          const lat = first.latitude!;
          const lon = first.longitude!;
          bounds.extend([lat, lon]);
          hasPoints = true;

          const count = items.length;
          const hasExpiring = items.some((i) => !i.is_expired && i.time_remaining_seconds && i.time_remaining_seconds < 86400);

          // Icona personalizzata con badge conteggio
          const customHtml = `
            <div style="
              position: relative;
              background-color: ${hasExpiring ? '#e11d48' : '#2563eb'};
              width: 34px;
              height: 34px;
              border-radius: 50%;
              border: 3px solid #ffffff;
              box-shadow: 0 4px 10px rgba(0,0,0,0.25);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 700;
              font-size: 12px;
              cursor: pointer;
            ">
              ${count > 1 ? count : '★'}
              ${hasExpiring ? '<span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:#ef4444;border-radius:50%;border:2px solid #fff;"></span>' : ''}
            </div>
          `;

          const customIcon = L.divIcon({
            html: customHtml,
            className: 'custom-map-pin',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18],
          });

          // Contenuto Popup
          const popupContent = document.createElement('div');
          popupContent.style.minWidth = '240px';
          popupContent.style.maxWidth = '300px';
          popupContent.style.padding = '4px';

          let listHtml = items.map((it) => `
            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap: 4px; margin-bottom: 2px;">
                <span style="font-weight: 700; font-size: 11px; color: #1e40af; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">
                  ${it.classi_concorso.join(', ') || 'Classe da verificare'}
                </span>
                ${it.scadenza ? `<span style="font-size: 10px; color: #b91c1c; font-weight: 600;">Scade ${new Date(it.scadenza).toLocaleDateString('it-IT')}</span>` : ''}
              </div>
              <div style="font-size: 11px; font-weight: 600; color: #0f172a; line-height: 1.3;">
                ${it.title}
              </div>
              <button 
                id="btn-open-${it.id}"
                style="margin-top: 6px; width: 100%; text-align: center; padding: 4px 8px; font-size: 11px; font-weight: 600; color: #ffffff; background: #2563eb; border-radius: 6px; border: none; cursor: pointer;"
              >
                Vedi Dettagli & Candidatura
              </button>
            </div>
          `).join('');

          popupContent.innerHTML = `
            <div style="font-family: inherit;">
              <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
                ${first.school_name || 'Scuola'}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                📍 ${first.school_address || first.school_city || 'Provincia di Padova'}
              </div>
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

        if (hasPoints && mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [interpelli, onSelectInterpello]);

  return (
    <div className="relative w-full h-[650px] rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-md">
      <div ref={mapContainerRef} className="w-full h-full z-10" />
      
      {/* Legenda Mappa in overlay */}
      <div className="absolute bottom-4 left-4 z-20 backdrop-blur-md bg-white/90 dark:bg-slate-900/90 px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-lg text-xs space-y-1.5">
        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Mappa Scuole Padova ({interpelli.length} bandi)</span>
        </div>
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
            <span>Interpello attivo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
            <span>Scadenza &lt; 24h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
