import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoStateSchema } from "@/demo/schemas";
import { getTemplateMeta, siteMenu, TEMPLATES } from "@/problem-templates/catalog.client";
import { getTemplateFixture } from "@/problem-templates/fixtures";
import { TemplateWorkspace } from "@/problem-templates/workspaces.client";
import { Hero, SiteFooter } from "@/ui/kit";
import { SiteHeader } from "@/ui/kit/client";

type Props = { params: Promise<{ templateId: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meta = getTemplateMeta((await params).templateId);
  return meta ? { title: meta.manifest.title, description: meta.tagline } : {};
}

export default async function TemplatePage({ params, searchParams }: Props) {
  const meta = getTemplateMeta((await params).templateId);
  if (!meta) notFound();
  const rawState = (await searchParams).state;
  const parsed = DemoStateSchema.safeParse(typeof rawState === "string" ? rawState : "success");
  const state = parsed.success ? parsed.data : "success";
  // Fixtures are a development aid; production shows the honest "unavailable" state.
  const demoEnabled = process.env.NODE_ENV !== "production";
  const fixture = getTemplateFixture(meta.id, demoEnabled ? state : "unavailable");

  return <>
    <SiteHeader transparent menu={siteMenu()} />
    <main>
      <Hero align="bottom" height="80vh" image={meta.images.hero} kicker={meta.kicker} title={meta.heroTitle} subtitle={meta.headline}
        actions={<Link href="#bat-dau" className="vn-btn vn-btn--inverse">Bắt đầu ngay</Link>} />
      <TemplateWorkspace id={meta.id} bundle={fixture.bundle} extras={fixture.extras} state={demoEnabled ? state : "unavailable"} />
    </main>
    <SiteFooter templates={TEMPLATES.map(t => ({ id: t.id, title: t.manifest.title }))} />
  </>;
}
