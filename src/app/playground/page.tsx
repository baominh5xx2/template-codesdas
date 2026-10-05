import Link from "next/link";
import { DEMO_DOMAINS } from "@/demo/data";

export default function PlaygroundPage() {
  const demoEnabled = process.env.NODE_ENV !== "production";
  return <main className="playground">
    <h1>Fixture Playground</h1>
    <p>{demoEnabled ? "These routes return validated synthetic fixtures. Run execution and external services are not configured." : "Demo fixtures are unavailable in production. Run execution and external services are not configured."}</p>
    {demoEnabled && <ul>{DEMO_DOMAINS.map(domain => <li key={domain.id}>
      <strong>{domain.title}</strong> — {domain.description} <Link href={`/api/demo/${domain.id}`}>Fixture JSON</Link>
    </li>)}</ul>}
    {demoEnabled && <><p><Link href="/api/domains">Domain manifests JSON</Link></p>
      <p><Link href="/api/demo/datasets/sales-quarterly/rows">Dataset rows JSON</Link></p></>}
  </main>;
}
