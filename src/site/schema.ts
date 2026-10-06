import { z } from "zod";

/**
 * Content model for the contest website. Pages are lists of sections; every section is plain data
 * (text, image paths, links) so a use case is assembled by editing files in `src/content`.
 * See src/content/README.md for the editor guide.
 */

const text = z.string().min(1);
/** Image under /public, e.g. "/images/home-hero.jpg". */
const image = z.string().regex(/^\/[^\s]+\.(jpe?g|png|webp|avif|gif|svg)$/i, "Ảnh phải là đường dẫn trong /public, ví dụ /images/hero.jpg");
/** Internal path ("/templates/x", "#bat-dau") or http(s) URL. */
const href = z.string().regex(/^(\/|#|https?:\/\/)/, "Link phải bắt đầu bằng /, # hoặc http(s)://");
const link = z.object({ label: text, href });
const tone = z.enum(["white", "subtle", "ice", "navy"]);

export const HeadingSchema = z.object({
  title: text,
  subtitle: z.string().optional(),
  link: link.optional(),
});

const base = {
  /** Anchor for jump links, e.g. "ban-do" → "/#ban-do". */
  id: z.string().regex(/^[a-z0-9-]+$/, "id chỉ gồm chữ thường, số và dấu -").optional(),
  tone: tone.optional(),
  heading: HeadingSchema.optional(),
};

export const SectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"),
    ...base,
    /** "cover": white panel over photo; "center": big centred title; "bottom": title bottom-left. */
    variant: z.enum(["cover", "center", "bottom"]).default("center"),
    image,
    kicker: z.string().optional(),
    title: text,
    subtitle: z.string().optional(),
    height: z.string().optional(),
    actions: z.array(link.extend({ style: z.enum(["primary", "inverse", "outline"]).default("inverse") })).default([]),
  }),
  z.object({
    type: z.literal("intro"),
    ...base,
    lead: text,
    paragraphs: z.array(text).default([]),
    image: image.optional(),
    imageAlt: z.string().optional(),
  }),
  z.object({
    type: z.literal("cards"),
    ...base,
    layout: z.enum(["carousel", "grid"]).default("carousel"),
    items: z.array(z.object({ title: text, text: z.string().optional(), image, kicker: z.string().optional(), href: href.optional() })).min(1),
    cta: link.optional(),
  }),
  z.object({
    type: z.literal("tiles"),
    ...base,
    items: z.array(z.object({ title: text, image, href })).min(1),
    links: z.array(link).default([]),
  }),
  z.object({
    type: z.literal("feature"),
    ...base,
    image,
    title: text,
    text: z.string().optional(),
    cta: link.optional(),
  }),
  z.object({
    type: z.literal("scrollExpand"),
    ...base,
    image,
    /** Large title shown over the small framed photo before it expands. */
    title: text,
    hint: z.string().default("Cuộn xuống"),
    kicker: z.string().optional(),
    /** Content revealed once the photo fills the screen. */
    revealTitle: text,
    revealText: z.string().optional(),
    cta: link.optional(),
  }),
  z.object({
    type: z.literal("map"),
    ...base,
    heading: HeadingSchema,
    groups: z.array(z.object({
      title: text,
      items: z.array(z.object({
        id: z.string().optional(),
        name: text,
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        meta: z.string().optional(),
        text: z.string().optional(),
        link: link.optional(),
      })).min(1),
    })).min(1),
  }),
  z.object({
    type: z.literal("linkLists"),
    ...base,
    banner: z.object({ title: text, image, href }).optional(),
    columns: z.array(z.object({ title: z.string().optional(), items: z.array(z.object({ label: text, href: href.optional() })).min(1) })).min(1),
  }),
  z.object({
    type: z.literal("steps"),
    ...base,
    items: z.array(z.object({ title: text, text: z.string().optional(), image })).min(1),
  }),
  z.object({
    type: z.literal("partners"),
    ...base,
    items: z.array(z.object({ name: text, text: z.string().optional(), image, href, external: z.boolean().default(false) })).min(1),
  }),
  z.object({
    type: z.literal("offers"),
    ...base,
    items: z.array(z.object({
      image,
      meta: z.string().optional(),
      title: text,
      subtitle: z.string().optional(),
      text: z.string().optional(),
      priceLabel: z.string().optional(),
      price: z.string().optional(),
      cta: link.optional(),
    })).min(1),
  }),
  z.object({
    type: z.literal("notices"),
    ...base,
    items: z.array(z.object({
      title: text,
      text: text,
      tone: z.enum(["ice", "navy", "warning", "success"]).default("ice"),
      link: link.optional(),
    })).min(1),
  }),
  z.object({
    type: z.literal("stats"),
    ...base,
    items: z.array(z.object({ label: text, value: text, unit: z.string().optional(), note: z.string().optional() })).min(1),
  }),
  z.object({
    type: z.literal("accordion"),
    ...base,
    /** Each body is Markdown (### headings, lists, **bold**). */
    items: z.array(z.object({ title: text, body: text })).min(1),
  }),
  z.object({
    type: z.literal("prose"),
    ...base,
    markdown: text,
  }),
  z.object({
    type: z.literal("workspace"),
    ...base,
    /** Interactive demo from src/problem-templates (form, results, six run states). */
    template: z.enum(["data-dashboard", "document-analyzer", "risk-analyzer", "research-intelligence", "recommendation-planner", "knowledge-assistant"]),
  }),
]);

export const PageSchema = z.object({
  /** URL path without leading slash: "" is the home page, "templates/risk-analyzer" → /templates/risk-analyzer. */
  slug: z.string().regex(/^([a-z0-9-]+(\/[a-z0-9-]+)*)?$/, "slug chỉ gồm chữ thường, số, - và /"),
  title: text,
  description: z.string().optional(),
  /** "cover": white header above the hero; "transparent": header over the hero photo; "solid": white sticky header. */
  header: z.enum(["cover", "transparent", "solid"]).default("transparent"),
  sections: z.array(SectionSchema).min(1),
});

export const SiteSchema = z.object({
  brand: z.object({ event: text, team: text, logo: image, tagline: z.string().optional() }),
  metadata: z.object({ title: text, description: text }),
  /** Shortcuts on the right of the header (icon + label). */
  nav: z.array(link.extend({ icon: z.enum(["layers", "search", "map-pin", "book", "message-circle", "compass"]).default("layers") })).max(3),
  /** The full-screen staggered menu. */
  menu: z.object({ items: z.array(link).min(1), secondaryTitle: z.string().default(""), secondary: z.array(link).default([]) }),
  footer: z.object({ about: z.string().optional(), columns: z.array(z.object({ title: text, links: z.array(link) })), note: z.string().optional() }),
});

export type Section = z.input<typeof SectionSchema>;
export type ParsedSection = z.output<typeof SectionSchema>;
export type Page = z.input<typeof PageSchema>;
export type ParsedPage = z.output<typeof PageSchema>;
export type Site = z.input<typeof SiteSchema>;
export type ParsedSite = z.output<typeof SiteSchema>;

/** Typed helpers: give editors autocomplete without changing the data. */
export const definePage = (page: Page): Page => page;
export const defineSite = (site: Site): Site => site;
