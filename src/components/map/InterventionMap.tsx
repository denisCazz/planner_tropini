"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { STATO_META } from "@/lib/status";
import type { Intervento } from "@/types/client";

type Props = {
  items: Intervento[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  routeIds?: number[];
  start?: { lat: number; lng: number; label?: string };
};

function pin(stato: string, selected: boolean, order?: number) {
  const meta = STATO_META[stato as keyof typeof STATO_META];
  const color = meta?.color ?? "#64748b";
  const glyph = order != null ? String(order) : meta?.glyph ?? "•";
  const extra = selected ? "cm-pin--selected" : "";
  return L.divIcon({
    html: `<div class="cm-pin ${extra}" style="--pin-color:${color}"><div class="cm-pin__body"><span class="cm-pin__glyph">${glyph}</span></div></div>`,
    className: "",
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -40],
  });
}

export default function InterventionMap({ items, selectedId, onSelect, routeIds = [], start }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const geoItems = useMemo(
    () => items.filter((i) => i.client?.lat != null && i.client?.lng != null),
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
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    const order = new Map(routeIds.map((id, i) => [id, i + 1]));
    for (const i of geoItems) {
      const lat = i.client!.lat!;
      const lng = i.client!.lng!;
      const m = L.marker([lat, lng], {
        icon: pin(i.stato, i.id === selectedId, order.get(i.id)),
      });
      m.on("click", () => onSelectRef.current(i.id));
      cluster.addLayer(m);
    }
  }, [geoItems, selectedId, routeIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    const pts: [number, number][] = [];
    if (start) pts.push([start.lat, start.lng]);
    for (const id of routeIds) {
      const i = geoItems.find((x) => x.id === id);
      if (i?.client?.lat != null && i.client.lng != null) pts.push([i.client.lat, i.client.lng]);
    }
    if (pts.length >= 2) {
      lineRef.current = L.polyline(pts, { color: "#0f766e", weight: 3, opacity: 0.85 }).addTo(map);
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
    }
  }, [routeIds, geoItems, start]);

  useEffect(() => {
    const selected = geoItems.find((i) => i.id === selectedId);
    if (selected?.client?.lat != null && selected.client.lng != null && mapRef.current) {
      mapRef.current.panTo([selected.client.lat, selected.client.lng]);
    }
  }, [selectedId, geoItems]);

  return <div ref={wrap} className="w-full h-full" />;
}
