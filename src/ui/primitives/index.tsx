import Link from "next/link";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export { Icon, type IconName } from "./Icon";

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");
export { cx };

export type ButtonVariant = "primary" | "secondary" | "inverse" | "outline-inverse" | "dark" | "ghost";
export type ButtonSize = "s" | "m" | "l";
function buttonClass(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean, className?: string) {
  return cx("vn-btn", variant !== "primary" && `vn-btn--${variant}`, size !== "m" && `vn-btn--${size}`, fullWidth && "vn-btn--full", className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; iconLeft?: IconName; iconRight?: IconName; fullWidth?: boolean };
export function Button({ variant = "primary", size = "m", iconLeft, iconRight, fullWidth, className, children, type = "button", ...rest }: ButtonProps) {
  const iconSize = size === "s" ? 16 : size === "l" ? 19 : 18;
  return <button type={type} className={buttonClass(variant, size, fullWidth, className)} {...rest}>
    {iconLeft ? <Icon name={iconLeft} size={iconSize} /> : null}
    <span>{children}</span>
    {iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
  </button>;
}

export function ButtonLink({ href, variant = "primary", size = "m", iconLeft, iconRight, fullWidth, className, children }: { href: string; variant?: ButtonVariant; size?: ButtonSize; iconLeft?: IconName; iconRight?: IconName; fullWidth?: boolean; className?: string; children: ReactNode }) {
  const iconSize = size === "s" ? 16 : size === "l" ? 19 : 18;
  return <Link href={href} className={buttonClass(variant, size, fullWidth, className)}>
    {iconLeft ? <Icon name={iconLeft} size={iconSize} /> : null}
    <span>{children}</span>
    {iconRight ? <Icon name={iconRight} size={iconSize} /> : null}
  </Link>;
}

export function Chip({ active, tone = "light", size = "m", href, onClick, children, className, ...aria }: { active?: boolean; tone?: "light" | "dark"; size?: "s" | "m"; href?: string; onClick?: () => void; children: ReactNode; className?: string; "aria-pressed"?: boolean }) {
  const classes = cx("vn-chip", tone === "dark" && "vn-chip--dark", size === "s" && "vn-chip--s", active && "is-active", className);
  if (href) return <Link href={href} className={classes} aria-current={active ? "page" : undefined} scroll={href.startsWith("#") ? undefined : false}>{children}</Link>;
  return <button type="button" className={classes} onClick={onClick} aria-pressed={aria["aria-pressed"] ?? active}>{children}</button>;
}

export type BadgeTone = "neutral" | "blue" | "ice" | "success" | "warning" | "danger" | "navy" | "demo";
export function Badge({ tone = "neutral", icon, dot, children, title }: { tone?: BadgeTone; icon?: IconName; dot?: boolean; children: ReactNode; title?: string }) {
  return <span className={cx("vn-badge", tone !== "neutral" && `vn-badge--${tone}`)} title={title}>
    {dot ? <span className="vn-dot" aria-hidden /> : null}
    {icon ? <Icon name={icon} size={13} /> : null}
    {children}
  </span>;
}

export type NoticeTone = "ice" | "navy" | "warning" | "critical" | "success";
const noticeIcon: Record<NoticeTone, IconName> = { ice: "info", navy: "info", warning: "alert-triangle", critical: "alert-octagon", success: "check-circle" };
export function Notice({ tone = "ice", title, icon, children, actions, role }: { tone?: NoticeTone; title?: ReactNode; icon?: IconName; children?: ReactNode; actions?: ReactNode; role?: "status" | "alert" }) {
  return <aside className={cx("vn-notice", tone !== "ice" && `vn-notice--${tone}`)} role={role}>
    <span className="vn-notice__icon"><Icon name={icon ?? noticeIcon[tone]} size={20} /></span>
    <div className="vn-notice__body">
      {title ? <h4 className="vn-notice__title">{title}</h4> : null}
      {children ? <div className="vn-notice__text">{children}</div> : null}
      {actions ? <div className="vn-row" style={{ marginTop: 8 }}>{actions}</div> : null}
    </div>
  </aside>;
}

export function SectionHeading({ title, subtitle, overline, action, tone = "light", as: Tag = "h2", size = "h2" }: { title: ReactNode; subtitle?: ReactNode; overline?: ReactNode; action?: ReactNode; tone?: "light" | "dark"; as?: "h1" | "h2" | "h3"; size?: "h1" | "h2" | "h3" }) {
  return <div className="vn-section-heading">
    <div className="vn-section-heading__text">
      {overline ? <div className="vn-overline">{overline}</div> : null}
      <Tag className={`vn-${size}`} style={tone === "dark" ? { color: "#fff" } : undefined}>{title}</Tag>
      {subtitle ? <p className="vn-lead" style={tone === "dark" ? { color: "var(--vn-ice-200)" } : undefined}>{subtitle}</p> : null}
    </div>
    {action}
  </div>;
}

export function Card({ title, overline, aside, children, footer, tone = "default", hover, className, id, padding = "m", style }: { title?: ReactNode; overline?: ReactNode; aside?: ReactNode; children?: ReactNode; footer?: ReactNode; tone?: "default" | "flat" | "ice" | "navy"; hover?: boolean; className?: string; id?: string; padding?: "m" | "l"; style?: CSSProperties }) {
  return <section id={id} className={cx("vn-card", tone !== "default" && `vn-card--${tone}`, hover && "vn-card--hover", className)} style={style}>
    <div className={cx("vn-card__body", padding === "l" && "vn-card__body--l")}>
      {title || aside || overline ? <div className="vn-card__head">
        <div className="vn-stack vn-stack--s" style={{ gap: 6 }}>
          {overline ? <div className="vn-overline">{overline}</div> : null}
          {title ? <h3 className="vn-card__title">{title}</h3> : null}
        </div>
        {aside}
      </div> : null}
      {children}
    </div>
    {footer ? <div className="vn-card__foot">{footer}</div> : null}
  </section>;
}

export function EmptyState({ icon = "layers", title, children, action }: { icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <div className="vn-empty">
    <span className="vn-empty__icon"><Icon name={icon} size={26} /></span>
    <h3 className="vn-h4">{title}</h3>
    {children ? <p className="vn-muted vn-small" style={{ maxWidth: "48ch" }}>{children}</p> : null}
    {action}
  </div>;
}

export function Skeleton({ height = 16, width = "100%", radius }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="vn-skeleton" style={{ height, width, borderRadius: radius }} aria-hidden />;
}
