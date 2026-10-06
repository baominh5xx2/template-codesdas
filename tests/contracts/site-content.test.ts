import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPages, loadSite } from "@/site/load";

/** Routes that exist outside src/content. */
const STATIC_ROUTES = new Set(["/chat", "/playground", "/api/domains", "/api/health"]);
/** Anchors rendered by the interactive workspace section. */
const WORKSPACE_ANCHORS = ["bat-dau"];

function walk(value: unknown, visit: (key: string, value: unknown, parent: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) value.forEach(item => walk(item, visit));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) { visit(key, child, value as Record<string, unknown>); walk(child, visit); }
  }
}

describe("website content (src/content)", () => {
  const site = loadSite();
  const pages = loadPages();
  const anchors = new Map(pages.map(page => [`/${page.slug}`.replace(/\/$/, "") || "/", new Set([
    ...page.sections.flatMap(section => (section.id ? [section.id] : [])),
    ...(page.sections.some(section => section.type === "workspace") ? WORKSPACE_ANCHORS : []),
  ])]));

  it("parses the site and every page against the schema with unique slugs", () => {
    expect(site.brand.team).toBeTruthy();
    expect(pages.some(page => page.slug === "")).toBe(true);
  });

  it("only references images that exist in /public", () => {
    const missing: string[] = [];
    walk([site, ...pages], (key, value) => {
      if ((key === "image" || key === "logo") && typeof value === "string" && !existsSync(path.join(process.cwd(), "public", value))) missing.push(value);
    });
    expect(missing).toEqual([]);
  });

  it("links only to existing pages, routes and section anchors", () => {
    const broken: string[] = [];
    for (const [owner, content] of [["site", site] as const, ...pages.map(page => [`/${page.slug}`, page] as const)]) {
      walk(content, (key, value) => {
        if (key !== "href" || typeof value !== "string" || /^https?:\/\//.test(value)) return;
        const [beforeHash, anchor] = value.split("#");
        const route = (beforeHash.split("?")[0] || (value.startsWith("#") ? owner : "/")).replace(/\/$/, "") || "/";
        const pageAnchors = anchors.get(route === "site" ? "/" : route);
        if (!pageAnchors && !STATIC_ROUTES.has(route)) broken.push(`${owner}: ${value} (không có trang)`);
        else if (anchor && pageAnchors && !pageAnchors.has(anchor)) broken.push(`${owner}: ${value} (không có mục #${anchor})`);
      });
    }
    expect(broken).toEqual([]);
  });
});
