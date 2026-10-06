"use client";

/**
 * List items that fade and lift in as they enter the viewport, adapted from React Bits
 * "Animated List" (reactbits.dev, MIT + Commons Clause). Only the item reveal is kept: no scroll
 * box, selection state or global keyboard handling, so lists keep their native semantics.
 */
import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

const TAGS = { li: motion.li, div: motion.div, figure: motion.figure } as const;

export function RevealItem({ as = "li", index = 0, className, style, children }: {
  as?: keyof typeof TAGS;
  index?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Tag = TAGS[as];
  if (reduce) return <Tag className={className} style={style}>{children}</Tag>;
  return <Tag className={className} style={style}
    initial={{ opacity: 0, y: 14, scale: 0.98 }}
    whileInView={{ opacity: 1, y: 0, scale: 1 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.35, ease: [0.2, 0, 0, 1], delay: Math.min(index, 6) * 0.06 }}>
    {children}
  </Tag>;
}
