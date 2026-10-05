"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, cx } from "../primitives";
import { GeoMap, type GeoPlace } from "./GeoMap";
import { SectionHeading } from "./index";

export type MapGroup = { title: string; items: Array<GeoPlace & { meta?: ReactNode; detail?: ReactNode }> };

/**
 * "Map of …" section from visitnorway.com: heading in the page column, then an edge-to-edge map with
 * a collapsible list panel on the left. Selecting a list item flies the map to its marker.
 */
export function MapSection({ id, title, subtitle, groups, fallback }: { id?: string; title: ReactNode; subtitle?: ReactNode; groups: MapGroup[]; fallback?: ReactNode }) {
  const [open, setOpen] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep markers clear of the overlay panel: it covers the map only on wide screens.
  const fitPadding = useCallback(() => {
    const panel = panelRef.current;
    const overlay = panel && getComputedStyle(panel).position === "absolute" ? panel.offsetWidth : 0;
    return { top: 60, bottom: 60, left: overlay + 60, right: 80 };
  }, []);
  const places = useMemo(() => {
    let n = 0;
    return groups.flatMap(group => group.items.map(item => ({ ...item, label: item.label ?? String(++n) })));
  }, [groups]);
  const select = (placeId: string) => {
    setSelected(placeId);
    const groupIndex = groups.findIndex(group => group.items.some(item => item.id === placeId));
    if (groupIndex >= 0) setOpen(groupIndex);
  };

  return <section id={id} style={{ scrollMarginTop: "var(--header-h)" }}>
    <div className="vn-section" style={{ paddingBottom: 40 }}><div><SectionHeading title={title} subtitle={subtitle} /></div></div>
    <div className="vn-mapsec">
      <div className="vn-mapsec__map">
        <GeoMap places={places} selectedId={selected} onSelect={select} fallback={fallback} padding={fitPadding} />
      </div>
      <div ref={panelRef} className="vn-mapsec__panel">
        {groups.map((group, index) => <div key={group.title} className="vn-mapsec__group">
          <button type="button" className="vn-mapsec__group-head" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}>
            <Icon name={open === index ? "minus" : "plus"} size={18} style={{ border: "1.5px solid currentColor", borderRadius: "50%", padding: 2, width: 26, height: 26 }} />
            {group.title}
          </button>
          {open === index ? <ul className="vn-mapsec__list">{group.items.map(item => {
            const label = places.find(p => p.id === item.id)?.label;
            return <li key={item.id}>
              <button type="button" className={cx("vn-mapsec__item", selected === item.id && "is-active")} onClick={() => select(item.id)}>
                <span>{label ? `${label}. ` : ""}{item.name}</span>
                {item.meta ? <small>{item.meta}</small> : <Icon name="map-pin" size={16} />}
              </button>
              {selected === item.id && item.detail ? <div className="vn-mapsec__detail">{item.detail}</div> : null}
            </li>;
          })}</ul> : null}
        </div>)}
      </div>
    </div>
  </section>;
}
