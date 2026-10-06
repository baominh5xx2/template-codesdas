import { defineSite } from "@/site/schema";

/** Brand, header shortcuts, staggered menu and footer shared by every page. */
export default defineSite({
  brand: {
    event: "AI Thực chiến",
    team: "TriplePeek",
    logo: "/brand/ai-thuc-chien.png",
    tagline: "Bài dự thi của nhóm TriplePeek tại AI Thực chiến.",
  },
  metadata: {
    title: "AI Thực chiến × TriplePeek",
    description: "Bài dự thi của nhóm TriplePeek: sáu mẫu bài toán trên một nền tảng dùng chung.",
  },
  nav: [
    { label: "Mẫu bài toán", href: "/#mau-bai-toan", icon: "layers" },
    { label: "Bản đồ", href: "/#ban-do", icon: "map-pin" },
  ],
  menu: {
    items: [
      { label: "Trang chủ", href: "/" },
      { label: "Bảng điều khiển dữ liệu", href: "/templates/data-dashboard" },
      { label: "Phân tích tài liệu", href: "/templates/document-analyzer" },
      { label: "Phân tích rủi ro", href: "/templates/risk-analyzer" },
      { label: "Nghiên cứu tổng hợp", href: "/templates/research-intelligence" },
      { label: "Gợi ý và lập kế hoạch", href: "/templates/recommendation-planner" },
      { label: "Trợ lý tri thức", href: "/templates/knowledge-assistant" },
    ],
    secondaryTitle: "Nhà phát triển",
    secondary: [
      { label: "Playground", href: "/playground" },
      { label: "Domains", href: "/api/domains" },
      { label: "Health", href: "/api/health" },
    ],
  },
  footer: {
    about: "Bài dự thi của nhóm TriplePeek tại AI Thực chiến: sáu mẫu bài toán trên một nền tảng dùng chung.",
    columns: [
      { title: "Mẫu bài toán", links: [
        { label: "Bảng điều khiển dữ liệu", href: "/templates/data-dashboard" },
        { label: "Phân tích tài liệu", href: "/templates/document-analyzer" },
        { label: "Phân tích rủi ro", href: "/templates/risk-analyzer" },
      ] },
      { title: "Thêm mẫu", links: [
        { label: "Nghiên cứu tổng hợp", href: "/templates/research-intelligence" },
        { label: "Gợi ý và lập kế hoạch", href: "/templates/recommendation-planner" },
        { label: "Trợ lý tri thức", href: "/templates/knowledge-assistant" },
      ] },
      { title: "Nhà phát triển", links: [
        { label: "Fixture playground", href: "/playground" },
        { label: "Domain manifests", href: "/api/domains" },
        { label: "Health check", href: "/api/health" },
      ] },
    ],
    note: "Dữ liệu demo tổng hợp · Ảnh: Unsplash",
  },
});
