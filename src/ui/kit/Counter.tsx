"use client";

/**
 * Rolling-digit counter adapted from React Bits "Counter" (reactbits.dev, MIT + Commons Clause).
 * Takes the already formatted text ("1.234,5", "92%", "19") so each digit rolls up like an
 * odometer the first time the number scrolls into view; separators and units stay static.
 * Screen readers get the final text; reduced motion renders it directly.
 */
import { motion, useInView, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import "./Counter.css";

function Face({ mv, digit }: { mv: MotionValue<number>; digit: number }) {
  const y = useTransform(mv, latest => {
    const place = latest % 10;
    let offset = (10 + digit - place) % 10;
    if (offset > 5) offset -= 10;
    return `${offset * 100}%`;
  });
  return <motion.span className="vn-counter__face" style={{ y }}>{digit}</motion.span>;
}

/** One digit column; `target` is the number formed by this digit and every digit before it. */
function Digit({ target, active }: { target: number; active: boolean }) {
  const mv = useSpring(0, { stiffness: 70, damping: 18, mass: 1 });
  useEffect(() => {
    if (active) mv.set(target);
  }, [active, mv, target]);
  return <span className="vn-counter__digit">
    {Array.from({ length: 10 }, (_, digit) => <Face key={digit} mv={mv} digit={digit} />)}
  </span>;
}

export function Counter({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  if (reduce || !/\d/.test(value)) return <span className={className}>{value}</span>;

  let prefix = 0;
  const parts = [...value].map((char, index) => {
    if (!/\d/.test(char)) return <span key={index} className="vn-counter__static">{char}</span>;
    prefix = prefix * 10 + Number(char);
    return <Digit key={index} target={prefix} active={inView} />;
  });
  return <span ref={ref} className={`vn-counter${className ? ` ${className}` : ""}`}>
    <span className="vn-sr-only">{value}</span>
    <span className="vn-counter__track" aria-hidden="true">{parts}</span>
  </span>;
}
