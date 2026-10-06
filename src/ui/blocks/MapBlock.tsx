"use client";

import { useState } from "react";
import type { UIBlock } from "@/contracts/ui/blocks";
import { Badge, EmptyState, Icon, Notice } from "../primitives";
import { GeoMap } from "../kit/GeoMap";
import { useResult } from "./context";

type MapProps = Extract<UIBlock, { type: "map" }>["props"];
type PlaceProps = Extract<UIBlock, { type: "place" }>["props"];

/** Map block: interactive vector map, falling back to a schematic plot when tiles/WebGL are unavailable. */
export function MapBlock({ props, selectedId, onSelect }: { props: MapProps; selectedId?: string | null; onSelect?: (id: string) => void }) {
  if (!props.available) return <Notice tone="warning" icon="map-pin" title="Bản đồ chưa khả dụng">{props.reason ?? "Tính năng bản đồ chưa được cấu hình."}</Notice>;
  if (!props.places.length) return <EmptyState icon="map-pin" title="Chưa có địa điểm">Kết quả không chứa địa điểm nào để hiển thị.</EmptyState>;
  return <div className="vn-map">
    <GeoMap places={props.places} selectedId={selectedId} onSelect={onSelect} padding={{ top: 60, bottom: 60, left: 60, right: 60 }} fallback={<SchematicMap props={props} selectedId={selectedId} onSelect={onSelect} />} />
  </div>;
}

/**
 * Schematic map: places are projected (equirectangular) into the bounding box of the given points.
 * Used when no tile provider is reachable; it shows relative positions only.
 */
export function SchematicMap({ props, selectedId, onSelect }: { props: MapProps; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const lats = props.places.map(p => p.lat), lngs = props.places.map(p => p.lng);
  const pad = 0.15;
  const latSpan = Math.max(0.02, Math.max(...lats) - Math.min(...lats)), lngSpan = Math.max(0.02, Math.max(...lngs) - Math.min(...lngs));
  const minLat = Math.min(...lats) - latSpan * pad, maxLat = Math.max(...lats) + latSpan * pad;
  const minLng = Math.min(...lngs) - lngSpan * pad, maxLng = Math.max(...lngs) + lngSpan * pad;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * 1000;
  const y = (lat: number) => (1 - (lat - minLat) / (maxLat - minLat)) * 625;
  const route = props.places.map((p, i) => `${i ? "L" : "M"}${x(p.lng)},${y(p.lat)}`).join(" ");
  return <div className="vn-map" style={{ position: "absolute", inset: 0, borderRadius: 0 }}>
    <svg viewBox="0 0 1000 625" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Sơ đồ ${props.places.length} địa điểm (bản đồ nền chưa tải được)`}>
      <defs><pattern id="vn-map-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="rgba(6,19,42,.06)" /></pattern></defs>
      <rect width="1000" height="625" fill="url(#vn-map-grid)" />
      <path d={route} fill="none" stroke="var(--vn-blue)" strokeWidth={3} strokeDasharray="8 8" opacity={0.5} />
      {props.places.map((place, index) => {
        const active = selectedId === place.id || hover === place.id;
        return <g key={place.id} className="vn-map__pin" transform={`translate(${x(place.lng)},${y(place.lat)})`} onMouseEnter={() => setHover(place.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(place.id)} role="button" tabIndex={0} aria-label={place.name} onKeyDown={event => { if (event.key === "Enter") onSelect?.(place.id); }}>
          <circle r={active ? 20 : 16} fill={active ? "var(--vn-navy)" : "var(--vn-blue)"} stroke="#fff" strokeWidth={3} />
          <text y={5} textAnchor="middle" style={{ font: "800 14px var(--font-sans)", fill: "#fff" }}>{index + 1}</text>
          <text className="vn-map__label" y={-28} textAnchor="middle">{place.name}</text>
        </g>;
      })}
    </svg>
  </div>;
}

export function PlaceBlock({ props }: { props: PlaceProps }) {
  const { source, inspect } = useResult();
  return <div className="vn-stack vn-stack--s">
    <div className="vn-row" style={{ gap: 8 }}><Icon name="map-pin" size={18} style={{ color: "var(--vn-blue)" }} /><strong className="vn-strong">{props.name}</strong></div>
    {props.description ? <p className="vn-small">{props.description}</p> : null}
    <div className="vn-row" style={{ gap: 6 }}>
      <Badge>{props.lat.toFixed(4)}, {props.lng.toFixed(4)}</Badge>
      {props.sourceIds.map(id => <button key={id} type="button" className="vn-chip vn-chip--s" onClick={() => inspect({ kind: "source", id })}>{source(id)?.title ?? id}</button>)}
    </div>
  </div>;
}
