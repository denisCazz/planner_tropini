"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Client, Settings, RouteResult } from "@/types/client";

// Fix Leaflet default marker icon in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function makeIcon(color: string, label?: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
    ${label ? `<text x="14" y="18" text-anchor="middle" font-size="9" font-weight="bold" fill="${color}">${label}</text>` : ""}
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

const STATO_COLORS: Record<string, string> = {
  ATTIVO: "#16a34a",
  INATTIVO: "#dc2626",
  PROSPECT: "#d97706",
};

const HOME_ICON = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="#2563eb" stroke="white" stroke-width="2"/>
    <path d="M16 8 L24 15 L22 15 L22 24 L18 24 L18 19 L14 19 L14 24 L10 24 L10 15 L8 15 Z" fill="white"/>
  </svg>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

interface MapProps {
  clients: Client[];
  settings: Settings | null;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  routeResult: RouteResult | null;
}

export default function ClientMap({
  clients,
  settings,
  selectedIds,
  onToggleSelect,
  routeResult,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<globalThis.Map<number, L.Marker>>(new globalThis.Map());
  const homeMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [44.7089, 7.6617],
      zoom: 10,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update client markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers not in current clients
    const currentIds = new Set(clients.map((c) => c.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    clients.forEach((client) => {
      if (client.lat === null || client.lng === null) return;

      const isSelected = selectedIds.has(client.id);
      const color = STATO_COLORS[client.stato] ?? "#6b7280";
      const icon = makeIcon(
        color,
        isSelected ? "✓" : undefined
      );

      const existing = markersRef.current.get(client.id);
      if (existing) {
        existing.setLatLng([client.lat, client.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([client.lat, client.lng], { icon });
        marker.bindPopup(
          `<div class="min-w-[180px]">
            <div class="font-bold text-gray-900">${client.nome} ${client.cognome}</div>
            ${client.indirizzo ? `<div class="text-xs text-gray-500 mt-1">${client.indirizzo}</div>` : ""}
            ${client.telefono ? `<div class="text-xs text-gray-600 mt-1">📞 ${client.telefono}</div>` : ""}
            ${client.email ? `<div class="text-xs text-gray-600">${client.email}</div>` : ""}
            <a href="/clienti/${client.id}" class="inline-block mt-2 text-xs text-blue-600 hover:underline">Apri scheda →</a>
            <br/>
            <button onclick="window.__toggleClient(${client.id})" class="mt-1 text-xs px-2 py-1 rounded ${isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}">${isSelected ? "Deseleziona" : "Seleziona per percorso"}</button>
          </div>`
        );
        marker.on("click", () => {
          onToggleSelect(client.id);
        });
        marker.addTo(map);
        markersRef.current.set(client.id, marker);
      }
    });
  }, [clients, selectedIds, onToggleSelect]);

  // Expose toggle to popup buttons
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__toggleClient = onToggleSelect;
  }, [onToggleSelect]);

  // Home marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (homeMarkerRef.current) {
      homeMarkerRef.current.remove();
      homeMarkerRef.current = null;
    }

    if (settings) {
      const marker = L.marker([settings.startLat, settings.startLng], {
        icon: HOME_ICON,
        zIndexOffset: 1000,
      });
      marker.bindPopup(
        `<div><strong>Punto di partenza</strong><br/><span class="text-xs text-gray-500">${settings.startLabel}</span></div>`
      );
      marker.addTo(map);
      homeMarkerRef.current = marker;
    }
  }, [settings]);

  // Route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (routeResult && routeResult.geometry.length > 0) {
      const polyline = L.polyline(routeResult.geometry, {
        color: "#2563eb",
        weight: 4,
        opacity: 0.8,
        dashArray: undefined,
      });
      polyline.addTo(map);
      polylineRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [routeResult]);

  return <div ref={containerRef} className="w-full h-full" />;
}
