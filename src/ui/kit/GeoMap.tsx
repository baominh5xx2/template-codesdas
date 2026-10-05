"use client";

/**
 * Interactive vector map (MapLibre GL + OpenFreeMap tiles, no API key). Markers are numbered blue
 * discs like visitnorway.com's map. If WebGL or the tile style is unavailable, `fallback` renders.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./GeoMap.css";

export type GeoPlace = { id: string; name: string; lat: number; lng: number; label?: string };

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
/** Served by src/app/vendor/maplibre/[file]/route.ts from the installed package. */
const WORKER_URL = "/vendor/maplibre/maplibre-gl-worker.mjs";

type Padding = { top: number; bottom: number; left: number; right: number };

export function GeoMap({ places, selectedId, onSelect, fallback, padding = { top: 80, bottom: 80, left: 80, right: 80 }, maxZoom = 13 }: {
  places: GeoPlace[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  fallback?: ReactNode;
  /** Fit padding; a function is evaluated when the map is created (e.g. to clear an overlay panel). */
  padding?: Padding | (() => Padding);
  maxZoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, { marker: Marker; el: HTMLButtonElement }>>(new Map());
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);

  const placesRef = useRef(places);
  const paddingRef = useRef(padding);
  useEffect(() => { onSelectRef.current = onSelect; placesRef.current = places; paddingRef.current = padding; }, [onSelect, places, padding]);
  const resolvePadding = () => (typeof paddingRef.current === "function" ? paddingRef.current() : paddingRef.current);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !places.length) return;
    let cancelled = false;
    const markers = markersRef.current;
    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (cancelled) return;
        maplibre.setWorkerUrl(WORKER_URL);
        const bounds = new maplibre.LngLatBounds();
        places.forEach(place => bounds.extend([place.lng, place.lat]));
        const map = new maplibre.Map({
          container,
          style: STYLE_URL,
          bounds,
          // The overlay list panel only covers the map on wide screens.
          fitBoundsOptions: { padding: resolvePadding(), maxZoom },
          attributionControl: { compact: true },
          cooperativeGestures: true,
          dragRotate: false,
          pitchWithRotate: false,
        });
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
        map.on("style.load", () => localiseStyle(map));
        map.on("error", event => { if (!map.loaded() && /style|fetch|Failed/i.test(String(event.error?.message ?? ""))) setFailed(true); });
        places.forEach((place, index) => {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "vn-geo-pin";
          el.textContent = place.label ?? String(index + 1);
          el.setAttribute("aria-label", place.name);
          el.title = place.name;
          el.addEventListener("click", event => { event.stopPropagation(); onSelectRef.current?.(place.id); });
          const marker = new maplibre.Marker({ element: el }).setLngLat([place.lng, place.lat]).addTo(map);
          markers.set(place.id, { marker, el });
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Places are fixture data; re-create the map only when the set of places changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.map(place => `${place.id}:${place.lat}:${place.lng}:${place.label ?? ""}`).join("|")]);

  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => el.classList.toggle("is-active", id === selectedId));
    const place = placesRef.current.find(p => p.id === selectedId);
    if (place && mapRef.current) mapRef.current.flyTo({ center: [place.lng, place.lat], zoom: Math.max(mapRef.current.getZoom(), Math.min(maxZoom, 11)), speed: 1.2, padding: resolvePadding() });
  }, [selectedId, maxZoom]);

  if (failed && fallback) return <>{fallback}</>;
  return <div ref={containerRef} className="vn-geo" role="region" aria-label={`Bản đồ ${places.length} địa điểm`} />;
}

/** Vietnamese labels where OSM has them (e.g. "Biển Đông"), latin names otherwise; brand-tinted water. */
function localiseStyle(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === "symbol" && map.getLayoutProperty(layer.id, "text-field") !== undefined) {
      map.setLayoutProperty(layer.id, "text-field", ["coalesce", ["get", "name:vi"], ["get", "name:latin"], ["get", "name"]]);
    }
    if (layer.type === "fill" && /water|ocean|lake/i.test(layer.id)) map.setPaintProperty(layer.id, "fill-color", "#c9dcf4");
    if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", "#f6f8fb");
  }
}
