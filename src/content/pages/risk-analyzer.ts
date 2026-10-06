import { definePage } from "@/site/schema";

/** Trang use case "/templates/risk-analyzer". Sửa chữ, ảnh hoặc thêm/bớt section tuỳ đề thi. */
export default definePage({
  slug: "templates/risk-analyzer",
  title: "Phân tích rủi ro",
  description: "Chấm điểm rủi ro theo quy tắc rõ ràng, chỉ ra từng tín hiệu trong nội dung và gợi ý việc nên làm ngay.",
  header: "transparent",
  sections: [
    {
      type: "hero",
      variant: "bottom",
      image: "/images/risk-hero.jpg",
      kicker: "Mẫu 03 · Risk & safety",
      title: "Phân tích rủi ro",
      subtitle: "Bấm hay không bấm?",
      height: "80vh",
      actions: [{ label: "Bắt đầu ngay", href: "#bat-dau", style: "inverse" }],
    },
    // Demo tương tác: form nhập, kết quả, sáu trạng thái của lượt chạy (src/problem-templates/risk-analyzer).
    { type: "workspace", template: "risk-analyzer" },
    {
      type: "notices",
      tone: "subtle",
      heading: { title: "Vì sao tin được kết quả?", subtitle: "Ba nguyên tắc của mẫu này." },
      items: [
        { title: "Quy tắc công khai", text: "Trọng số từng tín hiệu được ghi rõ, không phải hộp đen.", tone: "ice" },
        { title: "Thiếu dữ liệu không phải an toàn", text: "Tín hiệu chưa kiểm tra làm giảm độ đầy đủ, không làm giảm điểm.", tone: "warning" },
        { title: "Hành động cụ thể", text: "Mỗi kết luận đi kèm việc nên làm ngay.", tone: "navy" },
      ],
    },
  ],
});
