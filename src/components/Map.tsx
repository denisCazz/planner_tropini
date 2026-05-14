"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Client, Settings, RouteResult } from "@/types/client";

// Fix Leaflet default marker icon in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function telHref(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "#";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("39")) return `tel:+${d}`;
  if (d.length >= 9 && d.length <= 11) return `tel:+39${d}`;
  return `tel:+${d}`;
}

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
  INATTIVO: "#6b7280",
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
  focusedId?: number | null;
}

export default function ClientMap({
  clients,
  settings,
  selectedIds,
  onToggleSelect,
  routeResult,
  focusedId,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<globalThis.Map<number, L.Marker>>(new globalThis.Map());
  const homeMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const pulseMarkerRef = useRef<L.Marker | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init map + cluster group
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

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 36 : count < 100 ? 42 : 48;
        const r = size / 2 - 2;
        return L.divIcon({
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#2563eb" stroke="white" stroke-width="2.5" opacity="0.92"/>
            <text x="${size / 2}" y="${size / 2 + 4}" text-anchor="middle" font-size="${count < 100 ? 13 : 10}" font-weight="bold" fill="white" font-family="sans-serif">${count}</text>
          </svg>`,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    clusterGroup.addTo(map);
    clusterGroupRef.current = clusterGroup;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      clusterGroupRef.current = null;
    };
  }, []);

  // Update client markers
  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    // Remove markers no longer in the filtered list
    const currentIds = new Set(clients.map((c) => c.id));
    const toRemove: L.Marker[] = [];
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        toRemove.push(marker);
        markersRef.current.delete(id);
      }
    });
    if (toRemove.length > 0) clusterGroup.removeLayers(toRemove);

    // Add new markers / update existing icons
    const toAdd: L.Marker[] = [];
    clients.forEach((client) => {
      if (client.lat === null || client.lng === null) return;

      const isSelected = selectedIds.has(client.id);
      const color = client.urgente ? "#dc2626" : (STATO_COLORS[client.stato] ?? "#6b7280");
      const icon = makeIcon(color, isSelected ? "✓" : (client.urgente ? "!" : undefined));

      const existing = markersRef.current.get(client.id);
      if (existing) {
        existing.setLatLng([client.lat, client.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([client.lat, client.lng], { icon });
        marker.bindPopup(
          `<div class="min-w-[180px]">
            <div class="font-bold text-gray-900">${escapeHtml(client.cognome)} ${escapeHtml(client.nome)}</div>
            ${client.indirizzo ? `<div class="text-xs text-gray-500 mt-1">${escapeHtml(client.indirizzo)}</div>` : ""}
            ${client.telefono ? `<div class="text-xs text-gray-600 mt-1"><a href="${telHref(client.telefono)}">\uD83D\uDCDE ${escapeHtml(client.telefono)}</a></div>` : ""}
            <a href="/clienti/${client.id}" class="inline-block mt-2 text-xs text-blue-600 hover:underline">Apri scheda →</a>
            <br/>
            <button onclick="window.__toggleClient(${client.id})" class="mt-1 text-xs px-2 py-1 rounded ${isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}">${isSelected ? "Deseleziona" : "Seleziona per percorso"}</button>
          </div>`
        );
        marker.on("click", () => onToggleSelect(client.id));
        markersRef.current.set(client.id, marker);
        toAdd.push(marker);
      }
    });
    if (toAdd.length > 0) clusterGroup.addLayers(toAdd);
  }, [clients, selectedIds, onToggleSelect]);

  // Focus / highlight marker with pulse ring
  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;

    if (pulseMarkerRef.current) {
      pulseMarkerRef.current.remove();
      pulseMarkerRef.current = null;
    }
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = null;
    }

    if (!focusedId || !map || !clusterGroup) return;

    const marker = markersRef.current.get(focusedId);
    if (!marker) return;

    const latlng = marker.getLatLng();

    // Zoom into cluster and open popup
    clusterGroup.zoomToShowLayer(marker, () => {
      marker.openPopup();
    });

    // Animated SVG pulse ring (centered on pin body)
    const pulseIcon = L.divIcon({
      html: `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="16" fill="none" stroke="#2563eb" stroke-width="3">
          <animate attributeName="r" values="16;30" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.9;0" dur="1.2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="32" cy="32" r="10" fill="none" stroke="#2563eb" stroke-width="2">
          <animate attributeName="r" values="10;24" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.7;0" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
        </circle>
      </svg>`,
      className: "",
      iconSize: [64, 64],
      iconAnchor: [32, 54], // align ring center with pin body center
    });

    const pulse = L.marker(latlng, { icon: pulseIcon, interactive: false, zIndexOffset: 500 });
    pulse.addTo(map);
    pulseMarkerRef.current = pulse;

    pulseTimeoutRef.current = setTimeout(() => {
      pulseMarkerRef.current?.remove();
      pulseMarkerRef.current = null;
    }, 3000);
  }, [focusedId]);

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
      });
      polyline.addTo(map);
      polylineRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [routeResult]);

  return <div ref={containerRef} className="w-full h-full" />;
}
