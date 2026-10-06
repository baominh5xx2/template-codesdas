import { definePage } from "@/site/schema";

/** Trang use case "/templates/document-analyzer". Sửa chữ, ảnh hoặc thêm/bớt section tuỳ đề thi. */
export default definePage({
  slug: "templates/document-analyzer",
  title: "Phân tích tài liệu",
  description: "Trích xuất trường có cấu trúc, đánh dấu bằng chứng ngay trên văn bản và chỉ ra điều khoản còn thiếu.",
  header: "transparent",
  sections: [
    {
      type: "hero",
      variant: "bottom",
      image: "/images/document-hero.jpg",
      kicker: "Mẫu 02 · Document analyzer",
      title: "Phân tích tài liệu",
      subtitle: "Đọc kỹ từng điều khoản",
      height: "80vh",
      actions: [{ label: "Bắt đầu ngay", href: "#bat-dau", style: "inverse" }],
    },
    // Demo tương tác: form nhập, kết quả, sáu trạng thái của lượt chạy (src/problem-templates/document-analyzer).
    { type: "workspace", template: "document-analyzer" },
    {
      type: "notices",
      tone: "subtle",
      heading: { title: "Vì sao tin được kết quả?", subtitle: "Ba nguyên tắc của mẫu này." },
      items: [
        { title: "Trường theo schema", text: "Mỗi loại tài liệu có bộ trường riêng, kiểm tra kiểu bằng Zod.", tone: "ice" },
        { title: "Bằng chứng trên văn bản", text: "Đoạn làm căn cứ được tô màu ngay trong bản xem trước.", tone: "ice" },
        { title: "Thiếu là nói thiếu", text: "Điều khoản không tìm thấy được ghi rõ, không suy đoán.", tone: "navy" },
      ],
    },
  ],
});
