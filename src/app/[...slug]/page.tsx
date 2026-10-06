import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoStateSchema } from "@/demo/schemas";
import { findPage, loadPages, loadSite } from "@/site/load";
import { SectionView } from "@/site/sections";
import { SiteFooter } from "@/ui/kit";
import { SiteHeader } from "@/ui/kit/client";

type Props = { params: Promise<{ slug?: string[] }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

const slugOf = (parts: string[] | undefined) => (parts ?? []).join("/");

/** Every page comes from src/content; this route only looks it up and renders its sections. */
export function generateStaticParams() {
  return loadPages()
    .filter(page => Boolean(page.slug))
    .map(page => ({ slug: page.slug.split("/") }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = findPage(slugOf((await params).slug));
  if (!page) return {};
  const site = loadSite();
  return { title: page.slug ? page.title : { absolute: page.title }, description: page.description ?? site.metadata.description };
}

export default async function ContentPage({ params, searchParams }: Props) {
  const page = findPage(slugOf((await params).slug));
  if (!page) notFound();
  const site = loadSite();
  const rawState = (await searchParams).state;
  const parsed = DemoStateSchema.safeParse(typeof rawState === "string" ? rawState : "success");
  // Fixtures are a development aid; production shows the honest "unavailable" state.
  const demoState = process.env.NODE_ENV === "production" ? "unavailable" : parsed.success ? parsed.data : "success";

  return <>
    <SiteHeader transparent={page.header === "transparent"} variant={page.header === "cover" ? "cover" : "default"}
      menu={site.menu} nav={site.nav} brand={site.brand} />
    <main>{page.sections.map((section, index) => <SectionView key={`${section.type}-${index}`} section={section} context={{ demoState }} />)}</main>
    <SiteFooter brand={site.brand} footer={site.footer} />
  </>;
}
