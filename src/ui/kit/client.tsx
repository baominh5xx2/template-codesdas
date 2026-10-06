"use client";

import Link from "next/link";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, cx, type IconName } from "../primitives";
import { BRAND, BrandLockup, type Brand } from "./index";
import { StaggeredMenu } from "./StaggeredMenu";

/**
 * Horizontal snap rail as on visitnorway.com: as many cards as fit (at least `minCard` px wide, at most
 * `maxPerView`) fill the page column; page dots bottom-left, round arrows bottom-right.
 */
export function Carousel({ maxPerView = 5, minCard = 340, children }: { maxPerView?: number; minCard?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const [perView, setPerView] = useState(3);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 40;
      setPerView(Math.max(1, Math.min(maxPerView, Math.floor((rail.clientWidth + gap) / (minCard + gap)))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [maxPerView, minCard]);
  const pages = Math.max(1, Math.ceil(items.length / perView));
  const go = (next: number) => {
    const rail = ref.current;
    if (!rail) return;
    const target = Math.max(0, Math.min(pages - 1, next));
    const card = rail.children[target * perView] as HTMLElement | undefined;
    rail.scrollTo({ left: card ? card.offsetLeft - rail.offsetLeft : 0, behavior: "smooth" });
  };
  const onScroll = () => {
    const rail = ref.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setPage(max <= 0 ? 0 : Math.round((rail.scrollLeft / max) * (pages - 1)));
  };
  return <div className="vn-carousel">
    <div ref={ref} className="vn-carousel__rail" onScroll={onScroll} style={{ gridAutoColumns: `calc((100% - ${perView - 1} * var(--grid-gap)) / ${perView})` }}>
      {items.map((child, index) => <div key={index}>{child}</div>)}
    </div>
    {pages > 1 ? <div className="vn-carousel__nav">
      <div className="vn-carousel__dots" role="tablist" aria-label="Trang">
        {Array.from({ length: pages }, (_, index) => <button key={index} type="button" role="tab" aria-selected={page === index} aria-label={`Trang ${index + 1}`} className={cx("vn-carousel__dot", page === index && "is-active")} onClick={() => go(index)} />)}
      </div>
      <div className="vn-carousel__arrows">
        <button type="button" className="vn-icon-btn" aria-label="Trước" disabled={page === 0} onClick={() => go(page - 1)}><Icon name="chevron-left" size={20} /></button>
        <button type="button" className="vn-icon-btn" aria-label="Sau" disabled={page >= pages - 1} onClick={() => go(page + 1)}><Icon name="chevron-right" size={20} /></button>
      </div>
    </div> : null}
  </div>;
}

export type SiteMenu = { items: Array<{ label: string; href: string }>; secondary: Array<{ label: string; href: string }>; secondaryTitle: string };

/** 72px header: wordmark left, actions right; transparent over heroes. The menu is a StaggeredMenu panel. */
export type HeaderNavItem = { label: string; href: string; icon: IconName };
const DEFAULT_NAV: HeaderNavItem[] = [{ label: "Mẫu bài toán", href: "/#mau-bai-toan", icon: "layers" }, { label: "Playground", href: "/playground", icon: "search" }];

export function SiteHeader({ transparent, menu, variant = "default", nav = DEFAULT_NAV, brand }: { transparent?: boolean; menu: SiteMenu; variant?: "default" | "cover"; nav?: HeaderNavItem[]; brand?: Brand }) {
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navHidden = variant === "cover" && scrollHidden && !menuOpen;

  useEffect(() => {
    if (variant !== "cover") return;
    let previousY = window.scrollY;
    const onScroll = () => {
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const currentY = Math.min(maxY, Math.max(0, window.scrollY));
      if (currentY <= (headerRef.current?.offsetHeight ?? 88) || menuOpen || navRef.current?.querySelector(":focus-visible")) {
        setScrollHidden(false);
        previousY = currentY;
        return;
      }
      const delta = currentY - previousY;
      // Accumulate small movements so touchpads do not make the controls flicker.
      if (Math.abs(delta) < 8) return;
      setScrollHidden(delta > 0);
      previousY = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant, menuOpen]);

  return <header ref={headerRef} className={cx("vn-site-header", transparent && "vn-site-header--transparent", variant === "cover" && "vn-site-header--cover")}>
    <Link href="/" className="vn-wordmark" aria-label={`${brand ? `${brand.event} × ${brand.team}` : BRAND} — trang chủ`}><BrandLockup brand={brand} /></Link>
    <nav ref={navRef} className={cx("vn-header-nav", navHidden && "vn-header-nav--hidden")} aria-label="Điều hướng chính" aria-hidden={navHidden || undefined} inert={navHidden} onFocusCapture={() => setScrollHidden(false)}>
      {nav.map(item => <Link key={item.href} href={item.href} className="vn-header-act"><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}
      <StaggeredMenu
        position="right"
        items={menu.items.map(item => ({ label: item.label, ariaLabel: `Đi tới ${item.label}`, link: item.href }))}
        socialItems={menu.secondary.map(item => ({ label: item.label, link: item.href }))}
        socialsTitle={menu.secondaryTitle}
        displayItemNumbering
        colors={["#A2D4EC", "#004DE8"]}
        accentColor="#004DE8"
        menuButtonColor={transparent ? "#ffffff" : "#06132A"}
        openMenuButtonColor="#06132A"
        menuLabel="Menu"
        closeLabel="Đóng"
        toggleIcon={variant === "cover" ? "menu" : "plus"}
        onMenuOpen={() => { setMenuOpen(true); setScrollHidden(false); }}
        onMenuClose={() => setMenuOpen(false)}
      />
    </nav>
  </header>;
}
