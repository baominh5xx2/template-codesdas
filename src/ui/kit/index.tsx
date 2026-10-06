import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, cx, type IconName } from "../primitives";

/**
 * Website kit recreated from design/visit-norway-design/components (Hero, SectionHeading, ArticleCard,
 * TileCard, FeatureBanner, LinkList, ListingCard, OfferCard, PartnerCard, VideoCard, SiteFooter).
 */

export function Img({ src, alt = "", ratio, radius, sizes = "(max-width: 768px) 100vw, 33vw", priority, className, style }: { src?: string; alt?: string; ratio?: string; radius?: string; sizes?: string; priority?: boolean; className?: string; style?: CSSProperties }) {
  return <div className={cx("vn-img", className)} style={{ aspectRatio: ratio, borderRadius: radius, ...style }}>
    {src ? <Image src={src} alt={alt} fill sizes={sizes} priority={priority} style={{ objectFit: "cover" }} /> : null}
  </div>;
}

export function Hero({ image, title, subtitle, kicker, align = "center", height = "92vh", variant = "default", actions, meta }: { image: string; title: ReactNode; subtitle?: ReactNode; kicker?: ReactNode; align?: "center" | "bottom"; height?: string; variant?: "default" | "cover"; actions?: ReactNode; meta?: ReactNode }) {
  const content = <>
    {kicker ? <div className="vn-hero__kicker">{kicker}</div> : null}
    <h1 className="vn-hero__title">{title}</h1>
    {subtitle ? <p className="vn-hero__subtitle">{subtitle}</p> : null}
    {actions ? <div className="vn-hero__actions">{actions}</div> : null}
  </>;
  return <section className={cx("vn-hero", align === "bottom" && "vn-hero--bottom", variant === "cover" && "vn-hero--cover")} style={{ height }}>
    <Img src={image} sizes="100vw" priority />
    <div className="vn-hero__content">
      {variant === "cover" ? <div className="vn-hero__panel">{content}</div> : content}
    </div>
    {meta ? <div className="vn-hero__meta">{meta}</div> : null}
  </section>;
}

export function SectionHeading({ title, subtitle, link, action, size = "l", id }: { title: ReactNode; subtitle?: ReactNode; link?: { label: string; href: string }; action?: ReactNode; size?: "l" | "m"; id?: string }) {
  return <div className={cx("vn-section-heading", size === "m" && "vn-section-heading--m")} id={id}>
    <div className="vn-section-heading__text">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {link ? <Link href={link.href} className="vn-link-arrow">{link.label}<Icon name="arrow-right" size={18} /></Link> : action}
  </div>;
}

export function ArticleCard({ href, image, title, excerpt, kicker, ratio = "4/5" }: { href?: string; image: string; title: ReactNode; excerpt?: ReactNode; kicker?: ReactNode; ratio?: string }) {
  const body = <>
    <Img src={image} ratio={ratio} sizes="320px" />
    <div className="vn-stack vn-stack--s" style={{ gap: 8 }}>
      {kicker ? <span className="vn-article__kicker">{kicker}</span> : null}
      <h3 className="vn-article__title">{title}</h3>
      {excerpt ? <p className="vn-article__excerpt">{excerpt}</p> : null}
    </div>
  </>;
  return href ? <Link href={href} className="vn-article vn-zoom">{body}</Link> : <article className="vn-article">{body}</article>;
}

export function TileCard({ href, image, title, ratio = "4/5", size = "l" }: { href: string; image: string; title: ReactNode; ratio?: string; size?: "l" | "m" }) {
  return <Link href={href} className={cx("vn-tile", size === "m" && "vn-tile--m")} style={{ aspectRatio: ratio }}>
    <Img src={image} sizes="(max-width: 768px) 100vw, 33vw" />
    <div className="vn-tile__body">
      <h3 className="vn-tile__title">{title}</h3>
      <span className="vn-tile__round"><Icon name="arrow-right" size={18} /></span>
    </div>
  </Link>;
}

export function FeatureBanner({ image, title, subtitle, cta }: { image: string; title: ReactNode; subtitle?: ReactNode; cta?: { label: string; href: string } }) {
  return <section className="vn-feature">
    <Img src={image} sizes="100vw" />
    <div className="vn-feature__content">
      <h2>{title}</h2>
      {subtitle ? <div className="vn-feature__sub">{subtitle}</div> : null}
      {cta ? <div style={{ marginTop: 12 }}><Link href={cta.href} className="vn-btn vn-btn--inverse vn-btn--l">{cta.label}</Link></div> : null}
    </div>
  </section>;
}

export type LinkItem = { label: ReactNode; href?: string; onClick?: () => void; meta?: ReactNode };
export function LinkList({ title, items, columns = 1 }: { title?: ReactNode; items: LinkItem[]; columns?: number }) {
  return <div className="vn-linklist">
    {title ? <h3 className="vn-linklist__title">{title}</h3> : null}
    <ul style={{ columns }}>{items.map((item, index) => <li key={index}>
      {item.href ? <Link href={item.href} className="vn-linklist__row"><span>{item.label}</span>{item.meta ? <span className="vn-linklist__meta">{item.meta}</span> : null}<Icon name="chevron-right" size={20} /></Link>
        : <span className="vn-linklist__row" style={{ cursor: "default" }}><span>{item.label}</span>{item.meta ? <span className="vn-linklist__meta">{item.meta}</span> : null}</span>}
    </li>)}</ul>
  </div>;
}

export function ListingCard({ image, location, locationIcon = "map-pin", title, description, footer, href }: { image: string; location?: ReactNode; locationIcon?: IconName; title: ReactNode; description?: ReactNode; footer?: ReactNode; href?: string }) {
  const body = <>
    <Img src={image} sizes="320px" />
    <div className="vn-listing__body">
      {location ? <div className="vn-listing__loc"><Icon name={locationIcon} size={14} />{location}</div> : null}
      <h3 className="vn-listing__title">{title}</h3>
      {description ? <div className="vn-listing__desc">{description}</div> : null}
      {footer ? <div className="vn-listing__foot">{footer}</div> : null}
    </div>
  </>;
  return href ? <Link href={href} className="vn-listing vn-zoom">{body}</Link> : <article className="vn-listing vn-zoom">{body}</article>;
}

export function OfferCard({ image, meta, title, subtitle, description, priceLabel, price, action }: { image: string; meta?: ReactNode; title: ReactNode; subtitle?: ReactNode; description?: ReactNode; priceLabel?: ReactNode; price?: ReactNode; action?: ReactNode }) {
  return <article className="vn-offer vn-zoom">
    <Img src={image} sizes="340px" />
    <div className="vn-offer__body">
      {meta ? <div className="vn-offer__meta">{meta}</div> : null}
      <h3 className="vn-offer__title">{title}</h3>
      {subtitle ? <div className="vn-offer__subtitle">{subtitle}</div> : null}
      {description ? <div className="vn-offer__desc">{description}</div> : null}
      {price !== undefined || action ? <div className="vn-offer__foot">
        <div>{priceLabel ? <div className="vn-offer__price-label">{priceLabel}</div> : null}{price !== undefined ? <div className="vn-offer__price">{price}</div> : null}</div>
        {action}
      </div> : null}
    </div>
  </article>;
}

export function PartnerCard({ href, image, name, description, external }: { href: string; image: string; name: ReactNode; description?: ReactNode; external?: boolean }) {
  return <Link href={href} className="vn-partner vn-zoom">
    <Img src={image} sizes="300px" />
    <div className="vn-partner__name">{name}<Icon name={external ? "external-link" : "arrow-right"} size={16} /></div>
    {description ? <p>{description}</p> : null}
  </Link>;
}

export function VideoCard({ image, title, description, badge }: { image: string; title: ReactNode; description?: ReactNode; badge?: ReactNode }) {
  return <div className="vn-video vn-zoom">
    <div className="vn-video__media"><Img src={image} sizes="380px" /><span className="vn-video__play">{badge ?? <Icon name="play" size={20} style={{ marginLeft: 3 }} />}</span></div>
    <h3 className="vn-video__title">{title}</h3>
    {description ? <p>{description}</p> : null}
  </div>;
}

export function Section({ tone, tight, flushTop, id, children, style }: { tone?: "subtle" | "ice" | "navy"; tight?: boolean; flushTop?: boolean; id?: string; children: ReactNode; style?: CSSProperties }) {
  return <section id={id} className={cx("vn-section", tone && `vn-section--${tone}`, tight && "vn-section--tight", flushTop && "vn-section--flush-top")} style={{ scrollMarginTop: "var(--header-h)", ...style }}>
    <div>{children}</div>
  </section>;
}

export type Brand = { event: string; team: string; logo: string };
export const DEFAULT_BRAND: Brand = { event: "AI Thực chiến", team: "TriplePeek", logo: "/brand/ai-thuc-chien.png" };
export const BRAND = `${DEFAULT_BRAND.event} × ${DEFAULT_BRAND.team}`;

/** Co-brand lockup: contest logo, event name and team name ("AI Thực chiến × TriplePeek"). */
export function BrandLockup({ size = "m", brand = DEFAULT_BRAND }: { size?: "m" | "l"; brand?: Brand }) {
  const px = size === "l" ? 56 : 40;
  return <span className={cx("vn-brand", size === "l" && "vn-brand--l")}>
    <Image src={brand.logo} alt="" width={px} height={px} className="vn-brand__logo" priority={size === "m"} />
    <span className="vn-brand__text">
      <span className="vn-brand__event">{brand.event}</span>
      <span className="vn-brand__x" aria-hidden="true">×</span>
      <span className="vn-brand__team">{brand.team}</span>
    </span>
  </span>;
}

export type FooterContent = { about?: string; columns: Array<{ title: string; links: Array<{ label: string; href: string }> }>; note?: string };

export function SiteFooter({ brand = DEFAULT_BRAND, footer }: { brand?: Brand; footer: FooterContent }) {
  return <footer className="vn-footer">
    <div className="vn-footer__cols">
      <div>
        <div className="vn-footer__brand"><BrandLockup size="l" brand={brand} /></div>
        {footer.about ? <p style={{ color: "var(--vn-ice-200)", fontSize: 15, maxWidth: 300 }}>{footer.about}</p> : null}
      </div>
      {footer.columns.map(column => <div key={column.title}>
        <h3 className="vn-footer__title">{column.title}</h3>
        <ul>{column.links.map(link => <li key={link.href + link.label}><Link href={link.href}>{link.label}</Link></li>)}</ul>
      </div>)}
    </div>
    <div className="vn-footer__bottom">
      <span className="vn-row" style={{ gap: 8 }}><Icon name="globe" size={16} />Tiếng Việt</span>
      {footer.note ? <span>{footer.note}</span> : null}
    </div>
  </footer>;
}
