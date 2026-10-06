import { definePage } from "@/site/schema";

/** Trang use case "/templates/knowledge-assistant". Sửa chữ, ảnh hoặc thêm/bớt section tuỳ đề thi. */
export default definePage({
  slug: "templates/knowledge-assistant",
  title: "Trợ lý tri thức",
  description: "Hỏi đáp trên chính tài liệu bạn chọn, mỗi câu trả lời trỏ về đúng điều khoản – và biết nói “không tìm thấy”.",
  header: "transparent",
  sections: [
    {
      type: "hero",
      variant: "bottom",
      image: "/images/knowledge-hero.jpg",
      kicker: "Mẫu 06 · Knowledge assistant",
      title: "Trợ lý tri thức",
      subtitle: "Hỏi gì cũng có trích dẫn",
      height: "80vh",
      actions: [{ label: "Bắt đầu ngay", href: "#bat-dau", style: "inverse" }],
    },
    // Demo tương tác: form nhập, kết quả, sáu trạng thái của lượt chạy (src/problem-templates/knowledge-assistant).
    { type: "workspace", template: "knowledge-assistant" },
    {
      type: "notices",
      tone: "subtle",
      heading: { title: "Vì sao tin được kết quả?", subtitle: "Ba nguyên tắc của mẫu này." },
      items: [
        { title: "Chỉ tài liệu đã chọn", text: "Không tra web, không dùng kiến thức chung để lấp chỗ trống.", tone: "ice" },
        { title: "Trích dẫn từng câu", text: "Mỗi câu trả lời trỏ về đúng điều khoản trong tài liệu.", tone: "ice" },
        { title: "Biết nói không tìm thấy", text: "Không có căn cứ thì trả lời thật là không tìm thấy.", tone: "navy" },
      ],
    },
  ],
});
