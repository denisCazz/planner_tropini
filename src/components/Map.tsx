"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Client, Settings, RouteResult, ZoneBounds } from "@/types/client";
import { MAP_ICON_PRESETS } from "@/lib/mapIcons";

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

const STATO_COLORS: Record<string, string> = {
  ATTIVO: "#16a34a",
  INATTIVO: "#64748b",
  PROSPECT: "#d97706",
};

/** Costruisce un DivIcon "pin" vetroso. Ogni marker riceve una nuova istanza:
 *  Leaflet riusa il DOM e istanze condivise farebbero apparire selezionati
 *  più pin con lo stesso stato. */
function makePin(inner: string, extraClass: string, color: string): L.DivIcon {
  const html = `<div class="cm-pin ${extraClass}" style="--pin-color:${color}">
    <div class="cm-pin__body"><span class="cm-pin__glyph">${inner}</span></div>
  </div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -40],
  });
}

function markerIcon(
  client: Client,
  isSelected: boolean,
  orderNum: number | null
): L.DivIcon {
  if (orderNum != null) {
    return makePin(String(orderNum), "cm-pin--selected", "#4f46e5");
  }
  if (isSelected) {
    return makePin("✓", "cm-pin--selected", "#4f46e5");
  }
  if (client.icona) {
    return makePin(client.icona, "cm-pin--emoji", "#6366f1");
  }
  const color = client.urgente ? "#dc2626" : (STATO_COLORS[client.stato] ?? "#64748b");
  return makePin(client.urgente ? "!" : "", "", color);
}

const HOME_ICON = L.divIcon({
  html: `<div class="cm-pin" style="--pin-color:#4f46e5">
    <div class="cm-pin__body"><span class="cm-pin__glyph" style="font-size:15px">🏠</span></div>
  </div>`,
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 44],
  popupAnchor: [0, -40],
});

function iconPickerHtml(client: Client): string {
  const current = client.icona ?? "";
  const btn = (emoji: string, label: string) => {
    const active = current === emoji;
    return `<button type="button" title="${escapeHtml(label)}" onclick="window.__setClientIcon(${client.id}, '${emoji}')" style="width:30px;height:30px;border-radius:9px;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1.5px solid ${active ? "#4f46e5" : "rgba(148,163,184,0.4)"};background:${active ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.7)"}">${emoji}</button>`;
  };
  const reset = `<button type="button" title="Predefinita" onclick="window.__setClientIcon(${client.id}, '')" style="width:30px;height:30px;border-radius:9px;font-size:13px;color:#64748b;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1.5px solid ${current === "" ? "#4f46e5" : "rgba(148,163,184,0.4)"};background:${current === "" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.7)"}">✕</button>`;
  const buttons = MAP_ICON_PRESETS.map((p) => btn(p.emoji, p.label)).join("");
  return `<div style="margin-top:10px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;font-weight:700;margin-bottom:5px">Icona</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px">${reset}${buttons}</div>
  </div>`;
}

function buildPopupHtml(client: Client, isSelected: boolean): string {
  const inRoute = isSelected
    ? `<button onclick="window.__toggleClient(${client.id})" style="flex:1;padding:7px 10px;border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:#4f46e5;color:#fff">− Togli dal percorso</button>`
    : `<button onclick="window.__toggleClient(${client.id})" style="flex:1;padding:7px 10px;border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:rgba(99,102,241,0.15);color:#4338ca">+ Aggiungi al percorso</button>`;
  return `<div style="min-width:210px">
    <div style="font-weight:700;color:#0f172a;font-size:14px">${escapeHtml(client.cognome)} ${escapeHtml(client.nome)}</div>
    ${client.indirizzo ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(client.indirizzo)}</div>` : ""}
    ${client.telefono ? `<div style="font-size:12px;margin-top:4px"><a href="${telHref(client.telefono)}" style="color:#4f46e5;text-decoration:none">📞 ${escapeHtml(client.telefono)}</a></div>` : ""}
    ${iconPickerHtml(client)}
    <div style="display:flex;gap:6px;margin-top:10px">${inRoute}</div>
    <div style="display:flex;gap:6px;margin-top:6px">
      <a href="/clienti/${client.id}" style="flex:1;text-align:center;padding:6px 10px;border-radius:9px;font-size:11px;color:#334155;text-decoration:none;background:rgba(148,163,184,0.18)">Apri scheda →</a>
      <button onclick="window.__removeFromMap(${client.id})" title="Rimuovi dalla mappa" style="padding:6px 10px;border-radius:9px;font-size:11px;cursor:pointer;border:none;background:rgba(239,68,68,0.12);color:#b91c1c">Rimuovi</button>
    </div>
  </div>`;
}

interface MapProps {
  clients: Client[];
  settings: Settings | null;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  routeResult: RouteResult | null;
  focusedId?: number | null;
  /** Modalità "pianifica": il tap sui marker li aggiunge/toglie dal percorso */
  planMode?: boolean;
  /** Cambia l'icona rapida di un cliente */
  onSetIcon?: (id: number, icona: string | null) => void;
  /** Rimuove un cliente dalla mappa (dai "spuntati") */
  onRemoveFromMap?: (id: number) => void;
  /** Modalità "disegna zona": disabilita il drag e abilita il rettangolo di selezione */
  zoneMode?: boolean;
  /** Rettangolo zona attivo da mostrare in modo persistente */
  zoneBounds?: ZoneBounds | null;
  /** Callback al termine del disegno del rettangolo */
  onZoneDrawn?: (bounds: ZoneBounds) => void;
}

export default function ClientMap({
  clients,
  settings,
  selectedIds,
  onToggleSelect,
  routeResult,
  focusedId,
  planMode = false,
  onSetIcon,
  onRemoveFromMap,
  zoneMode = false,
  zoneBounds = null,
  onZoneDrawn,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<globalThis.Map<number, L.Marker>>(new globalThis.Map());
  const clientsByIdRef = useRef<globalThis.Map<number, Client>>(new globalThis.Map());
  const homeMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const pulseMarkerRef = useRef<L.Marker | null>(null);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeStopsKeyRef = useRef<string>("");
  const zoneRectRef = useRef<L.Rectangle | null>(null);
  const onZoneDrawnRef = useRef(onZoneDrawn);
  const planModeRef = useRef(planMode);
  const onToggleSelectRef = useRef(onToggleSelect);

  useEffect(() => {
    onZoneDrawnRef.current = onZoneDrawn;
  }, [onZoneDrawn]);
  useEffect(() => {
    planModeRef.current = planMode;
  }, [planMode]);
  useEffect(() => {
    onToggleSelectRef.current = onToggleSelect;
  }, [onToggleSelect]);

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
        const size = count < 10 ? 38 : count < 100 ? 44 : 50;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:${count < 100 ? 14 : 11}px;background:rgba(79,70,229,0.9);border:2.5px solid rgba(255,255,255,0.85);box-shadow:0 6px 16px rgba(15,23,42,0.3);backdrop-filter:blur(4px)">${count}</div>`,
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

  // Sincronizza l'insieme dei marker con i clienti visibili (add/remove)
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    const currentIds = new Set(clients.map((c) => c.id));
    clientsByIdRef.current = new globalThis.Map(clients.map((c) => [c.id, c]));

    const toRemove: L.Marker[] = [];
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        toRemove.push(marker);
        markersRef.current.delete(id);
      }
    });
    if (toRemove.length > 0) clusterGroup.removeLayers(toRemove);

    const toAdd: L.Marker[] = [];
    clients.forEach((client) => {
      if (client.lat === null || client.lng === null) return;
      if (markersRef.current.has(client.id)) return;

      const marker = L.marker([client.lat, client.lng], {
        icon: markerIcon(client, false, null),
      });
      marker.bindPopup(buildPopupHtml(client, false));
      // Rimuovi l'apertura automatica del popup: la gestiamo a mano per
      // distinguere il tap "pianifica" dal tap informativo.
      marker.off("click");
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (planModeRef.current) {
          onToggleSelectRef.current(client.id);
        } else {
          const c = clientsByIdRef.current.get(client.id) ?? client;
          marker.setPopupContent(buildPopupHtml(c, false));
          marker.openPopup();
        }
      });
      markersRef.current.set(client.id, marker);
      toAdd.push(marker);
    });
    if (toAdd.length > 0) clusterGroup.addLayers(toAdd);
  }, [clients]);

  // Aggiorna icone e popup quando cambia selezione / percorso / dati cliente
  useEffect(() => {
    const orderById = new globalThis.Map<number, number>();
    if (routeResult) {
      routeResult.steps.forEach((s) => orderById.set(s.client.id, s.order));
    }
    markersRef.current.forEach((marker, id) => {
      const client = clientsByIdRef.current.get(id);
      if (!client) return;
      const isSelected = selectedIds.has(id);
      marker.setIcon(markerIcon(client, isSelected, orderById.get(id) ?? null));
      marker.setPopupContent(buildPopupHtml(client, isSelected));
    });
  }, [selectedIds, routeResult, clients]);

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

    clusterGroup.zoomToShowLayer(marker, () => {
      if (!planModeRef.current) marker.openPopup();
    });

    const pulseIcon = L.divIcon({
      html: `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="16" fill="none" stroke="#4f46e5" stroke-width="3">
          <animate attributeName="r" values="16;30" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.9;0" dur="1.2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="32" cy="32" r="10" fill="none" stroke="#4f46e5" stroke-width="2">
          <animate attributeName="r" values="10;24" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.7;0" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
        </circle>
      </svg>`,
      className: "",
      iconSize: [64, 64],
      iconAnchor: [32, 54],
    });

    const pulse = L.marker(latlng, { icon: pulseIcon, interactive: false, zIndexOffset: 500 });
    pulse.addTo(map);
    pulseMarkerRef.current = pulse;

    pulseTimeoutRef.current = setTimeout(() => {
      pulseMarkerRef.current?.remove();
      pulseMarkerRef.current = null;
    }, 3000);
  }, [focusedId]);

  // Esponi i callback usati dai bottoni HTML nei popup
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__toggleClient = onToggleSelect;
  }, [onToggleSelect]);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__setClientIcon = (
      id: number,
      icona: string
    ) => onSetIcon?.(id, icona === "" ? null : icona);
  }, [onSetIcon]);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__removeFromMap = (id: number) =>
      onRemoveFromMap?.(id);
  }, [onRemoveFromMap]);

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
        `<div><strong>Punto di partenza</strong><br/><span style="font-size:11px;color:#64748b">${escapeHtml(settings.startLabel)}</span></div>`
      );
      marker.addTo(map);
      homeMarkerRef.current = marker;
    }
  }, [settings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!routeResult || routeResult.geometry.length === 0) {
      routeStopsKeyRef.current = "";
      return;
    }

    const polyline = L.polyline(routeResult.geometry, {
      color: "#4f46e5",
      weight: 4,
      opacity: 0.85,
    });
    polyline.addTo(map);
    polylineRef.current = polyline;

    const stopsKey = routeResult.steps
      .map((s) => s.client.id)
      .sort((a, b) => a - b)
      .join(",");
    if (stopsKey !== routeStopsKeyRef.current) {
      routeStopsKeyRef.current = stopsKey;
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [routeResult]);

  // Disegno interattivo del rettangolo "zona" (mouse + touch via pointer events)
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container || !zoneMode) return;

    map.dragging.disable();
    map.boxZoom.disable();
    map.doubleClickZoom.disable();
    container.style.cursor = "crosshair";

    let startLL: L.LatLng | null = null;
    let drawRect: L.Rectangle | null = null;

    const toLatLng = (e: PointerEvent): L.LatLng => {
      const r = container.getBoundingClientRect();
      return map.containerPointToLatLng(L.point(e.clientX - r.left, e.clientY - r.top));
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startLL = toLatLng(e);
      drawRect = L.rectangle(L.latLngBounds(startLL, startLL), {
        color: "#4f46e5",
        weight: 2,
        dashArray: "6 4",
        fillColor: "#6366f1",
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(map);
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!startLL || !drawRect) return;
      drawRect.setBounds(L.latLngBounds(startLL, toLatLng(e)));
    };

    const onUp = (e: PointerEvent) => {
      if (!startLL || !drawRect) return;
      const bounds = L.latLngBounds(startLL, toLatLng(e));
      drawRect.remove();
      drawRect = null;
      startLL = null;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const dxPx = Math.abs(
        map.latLngToContainerPoint(ne).x - map.latLngToContainerPoint(sw).x
      );
      const dyPx = Math.abs(
        map.latLngToContainerPoint(ne).y - map.latLngToContainerPoint(sw).y
      );
      if (dxPx < 12 || dyPx < 12) return;
      onZoneDrawnRef.current?.({
        south: sw.lat,
        west: sw.lng,
        north: ne.lat,
        east: ne.lng,
      });
    };

    container.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      container.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      drawRect?.remove();
      map.dragging.enable();
      map.boxZoom.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = "";
    };
  }, [zoneMode]);

  // Rettangolo zona persistente (mentre il flusso è aperto)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (zoneRectRef.current) {
      zoneRectRef.current.remove();
      zoneRectRef.current = null;
    }

    if (!zoneBounds) return;

    const bounds = L.latLngBounds(
      [zoneBounds.south, zoneBounds.west],
      [zoneBounds.north, zoneBounds.east]
    );
    const rect = L.rectangle(bounds, {
      color: "#4f46e5",
      weight: 2,
      fillColor: "#6366f1",
      fillOpacity: 0.06,
      interactive: false,
    });
    rect.addTo(map);
    zoneRectRef.current = rect;
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [zoneBounds]);

  return <div ref={containerRef} className="w-full h-full" />;
}
