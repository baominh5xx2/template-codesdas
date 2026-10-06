import Link from "next/link";
import { siteMenu, TEMPLATES } from "@/problem-templates/catalog.client";
import { ArticleCard, Hero, LinkList, PartnerCard, Section, SectionHeading, SiteFooter, TileCard, VideoCard } from "@/ui/kit";
import { Carousel, SiteHeader } from "@/ui/kit/client";
import { MapSection } from "@/ui/kit/MapSection";
import { ScrollExpand } from "@/ui/kit/ScrollExpand";

const href = (id: string) => `/templates/${id}`;

const MAP_IDEAS = [
  { id: "ha-noi", city: "Hà Nội", lat: 21.0285, lng: 105.8542, template: "document-analyzer", text: "Đọc hợp đồng thuê nhà trước khi ký – tìm điều khoản bất lợi." },
  { id: "ha-long", city: "Hạ Long", lat: 20.9101, lng: 107.1839, template: "data-dashboard", text: "Bảng điều khiển lượt khách theo mùa cho ngành du lịch." },
  { id: "hue", city: "Huế", lat: 16.4637, lng: 107.5909, template: "research-intelligence", text: "Nghiên cứu xu hướng du lịch xanh từ nhiều nguồn." },
  { id: "da-nang", city: "Đà Nẵng", lat: 16.0544, lng: 108.2022, template: "recommendation-planner", text: "Lịch trình 3 ngày Đà Nẵng – Hội An cho cả gia đình." },
  { id: "tp-hcm", city: "TP. Hồ Chí Minh", lat: 10.7769, lng: 106.7009, template: "risk-analyzer", text: "Kiểm tra tin nhắn nghi lừa đảo ngân hàng." },
  { id: "can-tho", city: "Cần Thơ", lat: 10.0452, lng: 105.7469, template: "knowledge-assistant", text: "Trợ lý hỏi đáp quy chế học vụ có trích dẫn." },
];

const TOPICS = [
  { title: "Du lịch và điểm đến", excerpt: "Lượng khách theo mùa, gợi ý lịch trình, so sánh nơi lưu trú – từ bảng số đến kế hoạch đi chơi.", image: "/images/turquoise.jpg", template: "data-dashboard" },
  { title: "Chống lừa đảo trực tuyến", excerpt: "Tin nhắn mạo danh, đường link lạ, lời mời đầu tư “lãi khủng”: chấm điểm rủi ro và giải thích vì sao.", image: "/images/phishing.jpg", template: "risk-analyzer" },
  { title: "Pháp lý cho mọi người", excerpt: "Hợp đồng thuê nhà, hợp đồng lao động: tìm điều khoản bất lợi trước khi đặt bút ký.", image: "/images/desk.jpg", template: "document-analyzer" },
  { title: "Giáo dục và quy chế", excerpt: "Hỏi đáp quy chế học vụ có trích dẫn từng điều khoản – không bịa khi tài liệu không có.", image: "/images/knowledge-card.jpg", template: "knowledge-assistant" },
  { title: "Nghiên cứu thị trường", excerpt: "Gom nguồn, loại trùng, so sánh phương án và chỉ ra chỗ các nguồn mâu thuẫn nhau.", image: "/images/research-card.jpg", template: "research-intelligence" },
  { title: "Tài chính cá nhân", excerpt: "Theo dõi chi tiêu, so sánh khoản vay, lập kế hoạch tiết kiệm theo ràng buộc của bạn.", image: "/images/screens.jpg", template: "recommendation-planner" },
];

const LAYERS = [
  { title: "Mẫu bài toán", image: "/images/whiteboard.jpg", href: "/#mau-bai-toan" },
  { title: "Tuỳ biến theo đề", image: "/images/meeting.jpg", href: "/#chu-de" },
  { title: "Nền tảng dùng chung", image: "/images/circuit.jpg", href: "/#nang-luc" },
];

const STEPS = [
  { title: "Nhận đề và chọn mẫu", text: "Đề hỏi về rủi ro? Chọn Risk Analyzer. Cần dashboard? Đã có sẵn.", image: "/images/map-travel.jpg" },
  { title: "Viết schema và quy tắc", text: "Khai báo đầu vào, loại artifact, prompt, nguồn và trọng số cho chủ đề của bạn.", image: "/images/code.jpg" },
  { title: "Ghép giao diện", text: "Dùng lại hero, card, biểu đồ và bảng – chỉ thay nội dung.", image: "/images/typing.jpg" },
  { title: "Chạy và trình bày", text: "Kết quả có nguồn, có bằng chứng, xuất được báo cáo. Sẵn sàng cho ban giám khảo!", image: "/images/stars.jpg" },
];

export default function HomePage() {
  const first = TEMPLATES[0];
  return <>
    <SiteHeader variant="cover" menu={siteMenu()} />
    <main>
      <Hero variant="cover" image="/images/home-hero.jpg" title="Từ đề bài đến demo" subtitle="AI Thực chiến × TriplePeek" height="calc(100svh - clamp(72px, 8vw, 88px))" />

      <Section id="mau-bai-toan">
        <SectionHeading title="Mẫu bài toán" subtitle="Sẵn sàng thi chưa? Chọn một dạng bài toán và bắt đầu ngay." />
        <Carousel>{TEMPLATES.map(t => <ArticleCard key={t.id} href={href(t.id)} image={t.images.card} kicker={t.kicker} title={t.manifest.title} excerpt={t.tagline} />)}</Carousel>
        {first ? <div style={{ marginTop: "var(--space-7)", display: "flex", justifyContent: "center" }}><Link href={href(first.id)} className="vn-btn vn-btn--l vn-home-start">Bắt đầu với {first.manifest.title.toLowerCase()}</Link></div> : null}
      </Section>

      <ScrollExpand useWindowScroll overlayScrim={0.75} src="/images/feature-hiker.jpg" alt="Người leo núi ngắm vịnh hẹp" title="Sẵn sàng cho ngày thi" scrollHint="Cuộn xuống">
        <span className="vn-hero__kicker" style={{ color: "var(--vn-ice)" }}>Nhận đề · chọn mẫu · tuỳ biến</span>
        <h2>Có bản demo trong vài giờ</h2>
        <p>Giao diện, dữ liệu mẫu và sáu trạng thái của lượt chạy đã sẵn sàng. Bạn chỉ cần thay nội dung cho đề của mình.</p>
        {first ? <Link href={href(first.id)} className="vn-btn vn-btn--inverse vn-btn--l">Xem một mẫu hoàn chỉnh</Link> : null}
      </ScrollExpand>

      <Section id="chu-de">
        <SectionHeading title="Một mẫu, nhiều chủ đề" subtitle="Cùng một dạng bài toán, đổi schema, nguồn và quy tắc là thành sản phẩm mới." link={{ label: "Tất cả mẫu", href: "/#mau-bai-toan" }} />
        <Carousel>{TOPICS.map(topic => <ArticleCard key={topic.title} href={href(topic.template)} image={topic.image} title={topic.title} excerpt={topic.excerpt} />)}</Carousel>
      </Section>

      <MapSection id="ban-do" title="Bản đồ ý tưởng" subtitle="Mỗi vùng một bài toán mẫu – bấm vào một địa điểm để xem nên bắt đầu từ mẫu nào."
        groups={[
          { title: "Ví dụ theo vùng", items: MAP_IDEAS.map(idea => ({ id: idea.id, name: idea.city, lat: idea.lat, lng: idea.lng, detail: <>{idea.text} <Link href={href(idea.template)}>Mở mẫu →</Link></> })) },
        ]} />

      <Section tone="navy" id="cach-hoat-dong">
        <SectionHeading title="Ba lớp, một luồng" subtitle="Template mô tả dạng bài toán, domain tuỳ biến nó cho đề thi, còn nền tảng lo phần thực thi. Mỗi lớp một chủ, ghép lại không vỡ." />
        <div className="vn-grid vn-grid--tiles">{LAYERS.map(layer => <TileCard key={layer.title} href={layer.href} image={layer.image} title={layer.title} />)}</div>
        <div style={{ marginTop: "var(--space-7)" }}>
          <LinkList columns={2} items={TEMPLATES.map(t => ({ label: t.manifest.title, href: href(t.id) }))} />
        </div>
      </Section>

      <Section id="nang-luc">
        <SectionHeading title="Năng lực dùng chung" subtitle="Không ai phải tự viết lại parser, biểu đồ hay trình xem nguồn." />
        <TileCard href="/playground" image="/images/office.jpg" title="Khám phá fixture playground" ratio="21/9" />
        <div className="vn-grid vn-grid--3" style={{ marginTop: 72, alignItems: "start" }}>
          <LinkList title="Năng lực" items={["Ingestion – CSV, XLSX, PDF", "Extraction theo schema", "Analytics tất định", "Evidence và trích dẫn", "Scoring theo quy tắc"].map(label => ({ label }))} />
          <LinkList title="Hiển thị kết quả" items={["Metric, chart, table", "Insight, recommendation, risk", "Source, evidence, verdict", "Timeline, progress, action", "Map, comparison, report"].map(label => ({ label }))} />
          <LinkList title="Mẫu bài toán" items={TEMPLATES.slice(0, 5).map(t => ({ label: t.manifest.title, href: href(t.id) }))} />
        </div>
      </Section>

      <Section tone="ice">
        <SectionHeading title="Làm thế nào?" subtitle="Bốn bước từ lúc nhận đề tới lúc trình bày trước ban giám khảo." />
        <Carousel>{STEPS.map((step, index) => <VideoCard key={step.title} image={step.image} title={step.title} description={step.text} badge={index + 1} />)}</Carousel>
      </Section>

      <Section id="trang-thai">
        <SectionHeading title="Dành cho nhà phát triển" subtitle="Giao diện đã hoàn chỉnh và chạy bằng dữ liệu demo tổng hợp. Engine sẽ được bật khi nền tảng sẵn sàng." link={{ label: "Mở playground", href: "/playground" }} />
        <div className="vn-grid vn-grid--4">
          <PartnerCard href="/playground" image="/images/dashboard-dark.jpg" name="Fixture playground" description="Xem bộ fixture JSON dùng chung cho cả bốn domain mẫu." />
          <PartnerCard href="/api/domains" image="/images/code.jpg" name="Domain manifests" description="Danh sách domain đã đăng ký, trả về dưới dạng JSON đã kiểm tra schema." external />
          <PartnerCard href="/api/health" image="/images/circuit.jpg" name="Health check" description="Kiểm tra nhanh máy chủ đang chạy ở chế độ nào." external />
          <PartnerCard href={first ? `${href(first.id)}?state=unavailable` : "/"} image="/images/fog.jpg" name="Trạng thái engine" description="POST /api/runs hiện trả về feature_unavailable – giao diện báo đúng như vậy." />
        </div>
      </Section>
    </main>
    <SiteFooter templates={TEMPLATES.map(t => ({ id: t.id, title: t.manifest.title }))} />
  </>;
}
