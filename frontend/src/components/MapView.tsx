'use client';

import React, { useEffect, useRef } from 'react';
import { Interpello } from '@/types/interpello';
import { MapPin } from 'lucide-react';

interface MapViewProps {
  interpelli: Interpello[];
  onSelectInterpello: (interpello: Interpello) => void;
}

export function MapView({ interpelli, onSelectInterpello }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

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

        // Tile layer CartoDB Positron: look enterprise, chiaro, minimale
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
      }

      const markersLayer = markersLayerRef.current;
      if (markersLayer) {
        markersLayer.clearLayers();

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

          // Pin sobrio ed elegante monocromatico enterprise
          const pinColor = hasExpiring ? '#b91c1c' : '#18181b';
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

          let listHtml = items.map((it) => `
            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e4e4e7;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap: 4px; margin-bottom: 2px;">
                <span style="font-family: monospace; font-weight: 700; font-size: 11px; color: #09090b; background: #f4f4f5; padding: 2px 5px; border-radius: 4px; border: 1px solid #e4e4e7;">
                  ${it.classi_concorso.join(', ') || 'Classe da bando'}
                </span>
                ${it.scadenza ? `<span style="font-size: 10px; color: #71717a; font-family: monospace;">Scade ${new Date(it.scadenza).toLocaleDateString('it-IT')}</span>` : ''}
              </div>
              <div style="font-size: 11px; font-weight: 600; color: #09090b; line-height: 1.3;">
                ${it.title}
              </div>
              <button 
                id="btn-open-${it.id}"
                style="margin-top: 6px; width: 100%; text-align: center; padding: 4px 8px; font-size: 11px; font-weight: 500; color: #ffffff; background: #18181b; border-radius: 6px; border: none; cursor: pointer;"
              >
                Dettagli & Candidatura
              </button>
            </div>
          `).join('');

          popupContent.innerHTML = `
            <div style="font-family: system-ui, sans-serif;">
              <div style="font-size: 12px; font-weight: 700; color: #09090b; margin-bottom: 2px;">
                ${first.school_name || 'Scuola'}
              </div>
              <div style="font-size: 11px; color: #71717a; margin-bottom: 8px;">
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
          mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [interpelli, onSelectInterpello]);

  return (
    <div className="relative w-full h-[500px] sm:h-[640px] rounded-xl overflow-hidden border border-border shadow-xs">
      <div ref={mapContainerRef} className="w-full h-full z-10" />
      
      {/* Legenda Discreta */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 backdrop-blur-md bg-card/90 px-3 py-2 rounded-lg border border-border shadow-xs text-xs space-y-1">
        <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Mappa Istituti ({interpelli.length} bandi)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-zinc-900 dark:bg-zinc-100 inline-block" />
            <span>Attivo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-700 inline-block" />
            <span>Scadenza &lt; 24h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
