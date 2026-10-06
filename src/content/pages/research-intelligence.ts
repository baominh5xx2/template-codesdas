import { definePage } from "@/site/schema";

/** Trang use case "/templates/research-intelligence". Sửa chữ, ảnh hoặc thêm/bớt section tuỳ đề thi. */
export default definePage({
  slug: "templates/research-intelligence",
  title: "Nghiên cứu tổng hợp",
  description: "Lập kế hoạch tìm kiếm, gom và loại trùng nguồn, rút phát hiện có trích dẫn và nói rõ chỗ các nguồn không thống nhất.",
  header: "transparent",
  sections: [
    {
      type: "hero",
      variant: "bottom",
      image: "/images/research-hero.jpg",
      kicker: "Mẫu 04 · Research intelligence",
      title: "Nghiên cứu tổng hợp",
      subtitle: "Đọc trăm nguồn, giữ lại điều đáng tin",
      height: "80vh",
      actions: [{ label: "Bắt đầu ngay", href: "#bat-dau", style: "inverse" }],
    },
    // Demo tương tác: form nhập, kết quả, sáu trạng thái của lượt chạy (src/problem-templates/research-intelligence).
    { type: "workspace", template: "research-intelligence" },
    {
      type: "notices",
      tone: "subtle",
      heading: { title: "Vì sao tin được kết quả?", subtitle: "Ba nguyên tắc của mẫu này." },
      items: [
        { title: "Nguồn rõ ràng", text: "Mỗi phát hiện kèm nguồn, ngày xuất bản và đoạn trích.", tone: "ice" },
        { title: "Chỉ ra mâu thuẫn", text: "Khi các nguồn nói khác nhau, báo cáo nói thẳng ra.", tone: "ice" },
        { title: "Không bịa nguồn", text: "Tìm kiếm lỗi thì dừng lại, không tạo nguồn giả để lấp chỗ trống.", tone: "navy" },
      ],
    },
  ],
});
