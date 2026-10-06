import { definePage } from "@/site/schema";

/** Trang chủ "/" — mỗi phần tử trong `sections` là một khối trên trang, hiển thị theo đúng thứ tự. */
export default definePage({
  slug: "",
  title: "AI Thực chiến × TriplePeek",
  description: "Từ đề bài đến demo: sáu mẫu bài toán của nhóm TriplePeek.",
  header: "cover",
  sections: [
    {
      type: "hero",
      variant: "cover",
      image: "/images/home-hero.jpg",
      title: "Từ đề bài đến demo",
      subtitle: "AI Thực chiến × TriplePeek",
      height: "calc(100svh - clamp(72px, 8vw, 88px))",
      actions: [
        { label: "Mở AI Native Chat", href: "/chat", style: "primary" },
        { label: "Xem mẫu bài toán", href: "/#mau-bai-toan", style: "inverse" },
      ],
    },
    {
      type: "cards",
      id: "mau-bai-toan",
      heading: { title: "Mẫu bài toán", subtitle: "Sẵn sàng thi chưa? Chọn một dạng bài toán và bắt đầu ngay." },
      layout: "carousel",
      items: [
        { kicker: "Mẫu 01 · Visual analytics", title: "Bảng điều khiển dữ liệu", text: "Tải dữ liệu, lọc theo phân khúc và thời gian, đọc KPI, biểu đồ và nhận định có trích dẫn.", image: "/images/dashboard-card.jpg", href: "/templates/data-dashboard" },
        { kicker: "Mẫu 02 · Document analyzer", title: "Phân tích tài liệu", text: "Trích xuất trường có cấu trúc, đánh dấu bằng chứng ngay trên văn bản và chỉ ra điều khoản còn thiếu.", image: "/images/document-card.jpg", href: "/templates/document-analyzer" },
        { kicker: "Mẫu 03 · Risk & safety", title: "Phân tích rủi ro", text: "Chấm điểm rủi ro theo quy tắc rõ ràng, chỉ ra từng tín hiệu trong nội dung và gợi ý việc nên làm ngay.", image: "/images/risk-card.jpg", href: "/templates/risk-analyzer" },
        { kicker: "Mẫu 04 · Research intelligence", title: "Nghiên cứu tổng hợp", text: "Gom và loại trùng nguồn, rút phát hiện có trích dẫn và nói rõ chỗ các nguồn không thống nhất.", image: "/images/research-card.jpg", href: "/templates/research-intelligence" },
        { kicker: "Mẫu 05 · Recommendation & planning", title: "Gợi ý và lập kế hoạch", text: "Xếp hạng lựa chọn theo tiêu chí bạn đặt, đánh dấu vi phạm ràng buộc và dựng kế hoạch chỉnh sửa được.", image: "/images/planner-card.jpg", href: "/templates/recommendation-planner" },
        { kicker: "Mẫu 06 · Knowledge assistant", title: "Trợ lý tri thức", text: "Hỏi đáp trên chính tài liệu bạn chọn, mỗi câu trả lời trỏ về đúng điều khoản.", image: "/images/knowledge-card.jpg", href: "/templates/knowledge-assistant" },
      ],
      cta: { label: "Bắt đầu với bảng điều khiển dữ liệu", href: "/templates/data-dashboard" },
    },
    {
      type: "scrollExpand",
      image: "/images/feature-hiker.jpg",
      title: "Sẵn sàng cho ngày thi",
      kicker: "Nhận đề · chọn mẫu · tuỳ biến",
      revealTitle: "Có bản demo trong vài giờ",
      revealText: "Giao diện, dữ liệu mẫu và sáu trạng thái của lượt chạy đã sẵn sàng. Bạn chỉ cần thay nội dung cho đề của mình.",
      cta: { label: "Xem một mẫu hoàn chỉnh", href: "/templates/data-dashboard" },
    },
    {
      type: "cards",
      id: "chu-de",
      heading: { title: "Một mẫu, nhiều chủ đề", subtitle: "Cùng một dạng bài toán, đổi schema, nguồn và quy tắc là thành sản phẩm mới.", link: { label: "Tất cả mẫu", href: "/#mau-bai-toan" } },
      items: [
        { title: "Du lịch và điểm đến", text: "Lượng khách theo mùa, gợi ý lịch trình, so sánh nơi lưu trú – từ bảng số đến kế hoạch đi chơi.", image: "/images/turquoise.jpg", href: "/templates/data-dashboard" },
        { title: "Chống lừa đảo trực tuyến", text: "Tin nhắn mạo danh, đường link lạ, lời mời đầu tư “lãi khủng”: chấm điểm rủi ro và giải thích vì sao.", image: "/images/phishing.jpg", href: "/templates/risk-analyzer" },
        { title: "Pháp lý cho mọi người", text: "Hợp đồng thuê nhà, hợp đồng lao động: tìm điều khoản bất lợi trước khi đặt bút ký.", image: "/images/desk.jpg", href: "/templates/document-analyzer" },
        { title: "Giáo dục và quy chế", text: "Hỏi đáp quy chế học vụ có trích dẫn từng điều khoản – không bịa khi tài liệu không có.", image: "/images/knowledge-card.jpg", href: "/templates/knowledge-assistant" },
        { title: "Nghiên cứu thị trường", text: "Gom nguồn, loại trùng, so sánh phương án và chỉ ra chỗ các nguồn mâu thuẫn nhau.", image: "/images/research-card.jpg", href: "/templates/research-intelligence" },
        { title: "Tài chính cá nhân", text: "Theo dõi chi tiêu, so sánh khoản vay, lập kế hoạch tiết kiệm theo ràng buộc của bạn.", image: "/images/screens.jpg", href: "/templates/recommendation-planner" },
      ],
    },
    {
      type: "map",
      id: "ban-do",
      heading: { title: "Bản đồ ý tưởng", subtitle: "Mỗi vùng một bài toán mẫu – bấm vào một địa điểm để xem nên bắt đầu từ mẫu nào." },
      groups: [
        { title: "Ví dụ theo vùng", items: [
          { name: "Hà Nội", lat: 21.0285, lng: 105.8542, text: "Đọc hợp đồng thuê nhà trước khi ký – tìm điều khoản bất lợi.", link: { label: "Mở mẫu", href: "/templates/document-analyzer" } },
          { name: "Hạ Long", lat: 20.9101, lng: 107.1839, text: "Bảng điều khiển lượt khách theo mùa cho ngành du lịch.", link: { label: "Mở mẫu", href: "/templates/data-dashboard" } },
          { name: "Huế", lat: 16.4637, lng: 107.5909, text: "Nghiên cứu xu hướng du lịch xanh từ nhiều nguồn.", link: { label: "Mở mẫu", href: "/templates/research-intelligence" } },
          { name: "Đà Nẵng", lat: 16.0544, lng: 108.2022, text: "Lịch trình 3 ngày Đà Nẵng – Hội An cho cả gia đình.", link: { label: "Mở mẫu", href: "/templates/recommendation-planner" } },
          { name: "TP. Hồ Chí Minh", lat: 10.7769, lng: 106.7009, text: "Kiểm tra tin nhắn nghi lừa đảo ngân hàng.", link: { label: "Mở mẫu", href: "/templates/risk-analyzer" } },
          { name: "Cần Thơ", lat: 10.0452, lng: 105.7469, text: "Trợ lý hỏi đáp quy chế học vụ có trích dẫn.", link: { label: "Mở mẫu", href: "/templates/knowledge-assistant" } },
        ] },
      ],
    },
    {
      type: "tiles",
      id: "cach-hoat-dong",
      tone: "navy",
      heading: { title: "Ba lớp, một luồng", subtitle: "Template mô tả dạng bài toán, domain tuỳ biến nó cho đề thi, còn nền tảng lo phần thực thi. Mỗi lớp một chủ, ghép lại không vỡ." },
      items: [
        { title: "Mẫu bài toán", image: "/images/whiteboard.jpg", href: "/#mau-bai-toan" },
        { title: "Tuỳ biến theo đề", image: "/images/meeting.jpg", href: "/#chu-de" },
        { title: "Nền tảng dùng chung", image: "/images/circuit.jpg", href: "/#nang-luc" },
      ],
      links: [
        { label: "Bảng điều khiển dữ liệu", href: "/templates/data-dashboard" },
        { label: "Phân tích tài liệu", href: "/templates/document-analyzer" },
        { label: "Phân tích rủi ro", href: "/templates/risk-analyzer" },
        { label: "Nghiên cứu tổng hợp", href: "/templates/research-intelligence" },
        { label: "Gợi ý và lập kế hoạch", href: "/templates/recommendation-planner" },
        { label: "Trợ lý tri thức", href: "/templates/knowledge-assistant" },
      ],
    },
    {
      type: "linkLists",
      id: "nang-luc",
      heading: { title: "Năng lực dùng chung", subtitle: "Không ai phải tự viết lại parser, biểu đồ hay trình xem nguồn." },
      banner: { title: "Khám phá fixture playground", image: "/images/office.jpg", href: "/playground" },
      columns: [
        { title: "Năng lực", items: [{ label: "Ingestion – CSV, XLSX, PDF" }, { label: "Extraction theo schema" }, { label: "Analytics tất định" }, { label: "Evidence và trích dẫn" }, { label: "Scoring theo quy tắc" }] },
        { title: "Hiển thị kết quả", items: [{ label: "Metric, chart, table" }, { label: "Insight, recommendation, risk" }, { label: "Source, evidence, verdict" }, { label: "Timeline, progress, action" }, { label: "Map, comparison, report" }] },
        { title: "Mẫu bài toán", items: [
          { label: "Bảng điều khiển dữ liệu", href: "/templates/data-dashboard" },
          { label: "Phân tích tài liệu", href: "/templates/document-analyzer" },
          { label: "Phân tích rủi ro", href: "/templates/risk-analyzer" },
          { label: "Nghiên cứu tổng hợp", href: "/templates/research-intelligence" },
          { label: "Gợi ý và lập kế hoạch", href: "/templates/recommendation-planner" },
        ] },
      ],
    },
    {
      type: "steps",
      tone: "ice",
      heading: { title: "Làm thế nào?", subtitle: "Bốn bước từ lúc nhận đề tới lúc trình bày trước ban giám khảo." },
      items: [
        { title: "Nhận đề và chọn mẫu", text: "Đề hỏi về rủi ro? Chọn Risk Analyzer. Cần dashboard? Đã có sẵn.", image: "/images/map-travel.jpg" },
        { title: "Viết schema và quy tắc", text: "Khai báo đầu vào, loại artifact, prompt, nguồn và trọng số cho chủ đề của bạn.", image: "/images/code.jpg" },
        { title: "Ghép giao diện", text: "Dùng lại hero, card, biểu đồ và bảng – chỉ thay nội dung.", image: "/images/typing.jpg" },
        { title: "Chạy và trình bày", text: "Kết quả có nguồn, có bằng chứng, xuất được báo cáo. Sẵn sàng cho ban giám khảo!", image: "/images/stars.jpg" },
      ],
    },
    {
      type: "partners",
      id: "trang-thai",
      heading: { title: "Dành cho nhà phát triển", subtitle: "Giao diện đã hoàn chỉnh và chạy bằng dữ liệu demo tổng hợp. Engine sẽ được bật khi nền tảng sẵn sàng.", link: { label: "Mở playground", href: "/playground" } },
      items: [
        { name: "Fixture playground", text: "Xem bộ fixture JSON dùng chung cho cả bốn domain mẫu.", image: "/images/dashboard-dark.jpg", href: "/playground" },
        { name: "Domain manifests", text: "Danh sách domain đã đăng ký, trả về dưới dạng JSON đã kiểm tra schema.", image: "/images/code.jpg", href: "/api/domains", external: true },
        { name: "Health check", text: "Kiểm tra nhanh máy chủ đang chạy ở chế độ nào.", image: "/images/circuit.jpg", href: "/api/health", external: true },
        { name: "Trạng thái engine", text: "POST /api/runs hiện trả về feature_unavailable – giao diện báo đúng như vậy.", image: "/images/fog.jpg", href: "/templates/data-dashboard?state=unavailable" },
      ],
    },
  ],
});
