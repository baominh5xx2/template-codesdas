import { z } from "zod";
import { pages, site } from "@/content";
import { PageSchema, SiteSchema, type ParsedPage, type ParsedSite } from "./schema";

/** Readable content errors: "pages/home › sections[3].items[0].image: Ảnh phải là …". */
function explain(where: string, error: z.ZodError): Error {
  const lines = error.issues.map(issue => `  • ${where} › ${issue.path.map(p => (typeof p === "number" ? `[${p}]` : `.${String(p)}`)).join("").replace(/^\./, "")}: ${issue.message}`);
  return new Error(`Nội dung trang web chưa hợp lệ:\n${lines.join("\n")}`);
}

export function loadSite(): ParsedSite {
  const parsed = SiteSchema.safeParse(site);
  if (!parsed.success) throw explain("content/site", parsed.error);
  return parsed.data;
}

export function loadPages(): ParsedPage[] {
  const result = pages.map(page => {
    const parsed = PageSchema.safeParse(page);
    if (!parsed.success) throw explain(`content/pages/${page.slug || "home"}`, parsed.error);
    return parsed.data;
  });
  const seen = new Set<string>();
  for (const page of result) {
    if (seen.has(page.slug)) throw new Error(`Nội dung trang web chưa hợp lệ: hai trang cùng slug "${page.slug}".`);
    seen.add(page.slug);
  }
  return result;
}

export function findPage(slug: string): ParsedPage | undefined {
  return loadPages().find(page => page.slug === slug);
}
