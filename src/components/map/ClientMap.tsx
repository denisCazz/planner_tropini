"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Client } from "@/types/client";

type Props = {
  items: Client[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  start?: { lat: number; lng: number; label?: string };
};

const STATO_COLORS: Record<string, string> = {
  ATTIVO: "#16a34a",
  INATTIVO: "#64748b",
  PROSPECT: "#d97706",
};

function pin(client: Client) {
  const color = client.urgente ? "#dc2626" : (STATO_COLORS[client.stato] ?? "#64748b");
  const glyph = client.urgente ? "!" : client.icona ? client.icona : "";
  return L.divIcon({
    html: `<div class="cm-pin" style="--pin-color:${color}"><div class="cm-pin__body"><span class="cm-pin__glyph">${glyph}</span></div></div>`,
    className: "",
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -40],
  });
}

export default function ClientMap({ items, selectedId, onSelect, start }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const startRef = useRef<L.CircleMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fittedKey = useRef("");

  const geoItems = useMemo(
    () => items.filter((c): c is Client & { lat: number; lng: number } => c.lat != null && c.lng != null),
    [items]
  );

  useEffect(() => {
    if (!wrap.current || mapRef.current) return;
    const map = L.map(wrap.current, { zoomControl: true, attributionControl: true }).setView(
      [44.7, 7.68],
      9
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48 });
    cluster.addTo(map);
    mapRef.current = map;
    clusterRef.current = cluster;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    for (const c of geoItems) {
      const m = L.marker([c.lat, c.lng], { icon: pin(c) });
      m.on("click", () => onSelectRef.current(c.id));
      cluster.addLayer(m);
    }

    const key = `${geoItems.length}:${geoItems[0]?.id ?? 0}:${geoItems[geoItems.length - 1]?.id ?? 0}`;
    if (geoItems.length > 0 && fittedKey.current !== key) {
      fittedKey.current = key;
      const bounds = L.latLngBounds(geoItems.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [geoItems]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (startRef.current) {
      map.removeLayer(startRef.current);
      startRef.current = null;
    }
    if (!start) return;
    startRef.current = L.circleMarker([start.lat, start.lng], {
      radius: 8,
      color: "#0f766e",
      fillColor: "#14b8a6",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(map);
  }, [start]);

  useEffect(() => {
    const selected = geoItems.find((c) => c.id === selectedId);
    if (selected && mapRef.current) {
      mapRef.current.panTo([selected.lat, selected.lng]);
    }
  }, [selectedId, geoItems]);

  return <div ref={wrap} className="w-full h-full" />;
}
