"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Accordion({ items, defaultOpen = -1 }: { items: Array<{ title: ReactNode; content: ReactNode }>; defaultOpen?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  const baseId = useId();
  return <div className="vn-accordion">
    {items.map((item, index) => {
      const expanded = open === index;
      const panelId = `${baseId}-panel-${index}`;
      return <div key={index} className="vn-accordion__item">
        <button type="button" className="vn-accordion__trigger" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? -1 : index)}>
          <span>{item.title}</span>
          <span className="vn-accordion__toggle"><Icon name={expanded ? "minus" : "plus"} size={18} /></span>
        </button>
        {expanded ? <div id={panelId} className="vn-accordion__panel">{item.content}</div> : null}
      </div>;
    })}
  </div>;
}
