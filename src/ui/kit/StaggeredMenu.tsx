"use client";

/**
 * StaggeredMenu from React Bits (TypeScript + CSS variant), adapted for this app:
 * - the toggle renders inline (inside SiteHeader) instead of in its own header with an image logo;
 * - internal links use next/link and close the menu; Escape closes it;
 * - the closed panel is `inert`, and labels/colours follow the design tokens.
 */
import Link from "next/link";
import { gsap } from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import "./StaggeredMenu.css";
import { Icon } from "../primitives/Icon";

export interface StaggeredMenuItem { label: string; ariaLabel: string; link: string }
export interface StaggeredMenuSocialItem { label: string; link: string }

export interface StaggeredMenuProps {
  position?: "left" | "right";
  colors?: string[];
  items?: StaggeredMenuItem[];
  socialItems?: StaggeredMenuSocialItem[];
  socialsTitle?: string;
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  className?: string;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  accentColor?: string;
  changeMenuColorOnOpen?: boolean;
  closeOnClickAway?: boolean;
  menuLabel?: string;
  closeLabel?: string;
  toggleIcon?: "plus" | "menu";
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

export function StaggeredMenu({
  position = "right",
  colors = ["#B497CF", "#5227FF"],
  items = [],
  socialItems = [],
  socialsTitle = "Socials",
  displaySocials = true,
  displayItemNumbering = true,
  className,
  menuButtonColor = "#fff",
  openMenuButtonColor = "#fff",
  changeMenuColorOnOpen = true,
  accentColor = "#5227FF",
  closeOnClickAway = true,
  menuLabel = "Menu",
  closeLabel = "Close",
  toggleIcon = "plus",
  onMenuOpen,
  onMenuClose,
}: StaggeredMenuProps) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const preLayersRef = useRef<HTMLDivElement | null>(null);
  const preLayerElsRef = useRef<HTMLElement[]>([]);
  const plusHRef = useRef<HTMLSpanElement | null>(null);
  const plusVRef = useRef<HTMLSpanElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const textInnerRef = useRef<HTMLSpanElement | null>(null);
  const [textLines, setTextLines] = useState<string[]>([menuLabel, closeLabel]);

  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const closeTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
  const colorTweenRef = useRef<gsap.core.Tween | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const busyRef = useRef(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current;
      const preContainer = preLayersRef.current;
      const plusH = plusHRef.current;
      const plusV = plusVRef.current;
      const icon = iconRef.current;
      const textInner = textInnerRef.current;
      if (!panel || !plusH || !plusV || !icon || !textInner) return;
      const preLayers = preContainer ? (Array.from(preContainer.querySelectorAll(".sm-prelayer")) as HTMLElement[]) : [];
      preLayerElsRef.current = preLayers;
      const offscreen = position === "left" ? -100 : 100;
      gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
      if (preContainer) gsap.set(preContainer, { xPercent: 0, opacity: 1 });
      gsap.set(plusH, { transformOrigin: "50% 50%", rotate: 0 });
      gsap.set(plusV, { transformOrigin: "50% 50%", rotate: 90 });
      gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });
      gsap.set(textInner, { yPercent: 0 });
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: menuButtonColor });
    });
    return () => ctx.revert();
  }, [menuButtonColor, position]);

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current;
    const layers = preLayerElsRef.current;
    if (!panel) return null;
    openTlRef.current?.kill();
    closeTweenRef.current?.kill();
    closeTweenRef.current = null;

    const itemEls = Array.from(panel.querySelectorAll(".sm-panel-itemLabel")) as HTMLElement[];
    const numberEls = Array.from(panel.querySelectorAll(".sm-panel-list[data-numbering] .sm-panel-item")) as HTMLElement[];
    const socialTitle = panel.querySelector(".sm-socials-title") as HTMLElement | null;
    const socialLinks = Array.from(panel.querySelectorAll(".sm-socials-link")) as HTMLElement[];
    const offscreen = position === "left" ? -100 : 100;

    if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
    if (numberEls.length) gsap.set(numberEls, { "--sm-num-opacity": 0 });
    if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
    if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    layers.forEach((el, i) => { tl.fromTo(el, { xPercent: offscreen }, { xPercent: 0, duration: 0.5, ease: "power4.out" }, i * 0.07); });
    const lastTime = layers.length ? (layers.length - 1) * 0.07 : 0;
    const panelInsertTime = lastTime + (layers.length ? 0.08 : 0);
    const panelDuration = 0.65;
    tl.fromTo(panel, { xPercent: offscreen }, { xPercent: 0, duration: panelDuration, ease: "power4.out" }, panelInsertTime);

    if (itemEls.length) {
      const itemsStart = panelInsertTime + panelDuration * 0.15;
      tl.to(itemEls, { yPercent: 0, rotate: 0, duration: 1, ease: "power4.out", stagger: { each: 0.1, from: "start" } }, itemsStart);
      if (numberEls.length) tl.to(numberEls, { duration: 0.6, ease: "power2.out", "--sm-num-opacity": 1, stagger: { each: 0.08, from: "start" } }, itemsStart + 0.1);
    }
    if (socialTitle || socialLinks.length) {
      const socialsStart = panelInsertTime + panelDuration * 0.4;
      if (socialTitle) tl.to(socialTitle, { opacity: 1, duration: 0.5, ease: "power2.out" }, socialsStart);
      if (socialLinks.length) {
        tl.to(socialLinks, { y: 0, opacity: 1, duration: 0.55, ease: "power3.out", stagger: { each: 0.08, from: "start" }, onComplete: () => { gsap.set(socialLinks, { clearProps: "opacity" }); } }, socialsStart + 0.04);
      }
    }
    openTlRef.current = tl;
    return tl;
  }, [position]);

  const playOpen = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const tl = buildOpenTimeline();
    if (tl) {
      tl.eventCallback("onComplete", () => { busyRef.current = false; });
      tl.play(0);
    } else {
      busyRef.current = false;
    }
  }, [buildOpenTimeline]);

  const playClose = useCallback(() => {
    openTlRef.current?.kill();
    openTlRef.current = null;
    const panel = panelRef.current;
    if (!panel) return;
    closeTweenRef.current?.kill();
    const offscreen = position === "left" ? -100 : 100;
    closeTweenRef.current = gsap.to([...preLayerElsRef.current, panel], {
      xPercent: offscreen, duration: 0.32, ease: "power3.in", overwrite: "auto",
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll(".sm-panel-itemLabel")) as HTMLElement[];
        if (itemEls.length) gsap.set(itemEls, { yPercent: 140, rotate: 10 });
        const numberEls = Array.from(panel.querySelectorAll(".sm-panel-list[data-numbering] .sm-panel-item")) as HTMLElement[];
        if (numberEls.length) gsap.set(numberEls, { "--sm-num-opacity": 0 });
        const socialTitle = panel.querySelector(".sm-socials-title") as HTMLElement | null;
        const socialLinks = Array.from(panel.querySelectorAll(".sm-socials-link")) as HTMLElement[];
        if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
        if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
        busyRef.current = false;
      },
    });
  }, [position]);

  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current;
    if (!icon) return;
    spinTweenRef.current?.kill();
    spinTweenRef.current = opening
      ? gsap.to(icon, { rotate: 225, duration: 0.8, ease: "power4.out", overwrite: "auto" })
      : gsap.to(icon, { rotate: 0, duration: 0.35, ease: "power3.inOut", overwrite: "auto" });
  }, []);

  const animateColor = useCallback((opening: boolean) => {
    const btn = toggleBtnRef.current;
    if (!btn) return;
    colorTweenRef.current?.kill();
    if (changeMenuColorOnOpen) colorTweenRef.current = gsap.to(btn, { color: opening ? openMenuButtonColor : menuButtonColor, delay: 0.18, duration: 0.3, ease: "power2.out" });
    else gsap.set(btn, { color: menuButtonColor });
  }, [openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen]);

  useEffect(() => {
    if (!toggleBtnRef.current) return;
    gsap.set(toggleBtnRef.current, { color: changeMenuColorOnOpen && openRef.current ? openMenuButtonColor : menuButtonColor });
  }, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor]);

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current;
    if (!inner) return;
    textCycleAnimRef.current?.kill();
    const currentLabel = opening ? menuLabel : closeLabel;
    const targetLabel = opening ? closeLabel : menuLabel;
    const seq: string[] = [currentLabel];
    let last = currentLabel;
    for (let i = 0; i < 3; i++) { last = last === menuLabel ? closeLabel : menuLabel; seq.push(last); }
    if (last !== targetLabel) seq.push(targetLabel);
    seq.push(targetLabel);
    setTextLines(seq);
    gsap.set(inner, { yPercent: 0 });
    const finalShift = ((seq.length - 1) / seq.length) * 100;
    textCycleAnimRef.current = gsap.to(inner, { yPercent: -finalShift, duration: 0.5 + seq.length * 0.07, ease: "power4.out" });
  }, [menuLabel, closeLabel]);

  const setMenu = useCallback((target: boolean) => {
    if (openRef.current === target) return;
    openRef.current = target;
    setOpen(target);
    if (target) { onMenuOpen?.(); playOpen(); } else { onMenuClose?.(); playClose(); }
    animateIcon(target);
    animateColor(target);
    animateText(target);
  }, [playOpen, playClose, animateIcon, animateColor, animateText, onMenuOpen, onMenuClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    const onPointer = (event: MouseEvent) => {
      if (!closeOnClickAway) return;
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && toggleBtnRef.current && !toggleBtnRef.current.contains(target)) setMenu(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); };
  }, [open, closeOnClickAway, setMenu]);

  const layers = (() => {
    const raw = colors.length ? colors.slice(0, 4) : ["#1e1e22", "#35353c"];
    const arr = [...raw];
    if (arr.length >= 3) arr.splice(Math.floor(arr.length / 2), 1);
    return arr;
  })();
  const isExternal = (link: string) => /^https?:\/\//.test(link);

  return <>
    <button ref={toggleBtnRef} className="sm-toggle" aria-label={open ? closeLabel : menuLabel} aria-expanded={open} aria-controls="staggered-menu-panel" onClick={() => setMenu(!openRef.current)} type="button">
      <span className="sm-toggle-textWrap" aria-hidden="true">
        <span ref={textInnerRef} className="sm-toggle-textInner">{textLines.map((line, i) => <span className="sm-toggle-line" key={i}>{line}</span>)}</span>
      </span>
      <span ref={iconRef} className={toggleIcon === "menu" ? "sm-icon sm-icon--menu" : "sm-icon"} aria-hidden="true">
        {toggleIcon === "menu" ? <Icon name="menu" size={24} className="sm-menu-glyph" /> : null}
        <span ref={plusHRef} className="sm-icon-line" />
        <span ref={plusVRef} className="sm-icon-line sm-icon-line-v" />
      </span>
    </button>
    <div className={(className ? className + " " : "") + "staggered-menu-wrapper fixed-wrapper"} style={{ "--sm-accent": accentColor } as CSSProperties} data-position={position} data-open={open || undefined}>
      <div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
        {layers.map((color, i) => <div key={i} className="sm-prelayer" style={{ background: color }} />)}
      </div>
      <aside id="staggered-menu-panel" ref={panelRef} className="staggered-menu-panel" aria-hidden={!open} inert={!open}>
        <div className="sm-panel-inner">
          <ul className="sm-panel-list" role="list" data-numbering={displayItemNumbering || undefined}>
            {items.map((item, idx) => <li className="sm-panel-itemWrap" key={item.label + idx}>
              <Link className="sm-panel-item" href={item.link} aria-label={item.ariaLabel} data-index={idx + 1} onClick={() => setMenu(false)}>
                <span className="sm-panel-itemLabel">{item.label}</span>
              </Link>
            </li>)}
          </ul>
          {displaySocials && socialItems.length > 0 ? <div className="sm-socials" aria-label={socialsTitle}>
            <h3 className="sm-socials-title">{socialsTitle}</h3>
            <ul className="sm-socials-list" role="list">
              {socialItems.map((s, i) => <li key={s.label + i} className="sm-socials-item">
                {isExternal(s.link)
                  ? <a href={s.link} target="_blank" rel="noopener noreferrer" className="sm-socials-link">{s.label}</a>
                  : <Link href={s.link} className="sm-socials-link" onClick={() => setMenu(false)}>{s.label}</Link>}
              </li>)}
            </ul>
          </div> : null}
        </div>
      </aside>
    </div>
  </>;
}

export default StaggeredMenu;
