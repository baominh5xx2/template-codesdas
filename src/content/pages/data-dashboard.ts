import { definePage } from "@/site/schema";

/** Trang use case "/templates/data-dashboard". Sửa chữ, ảnh hoặc thêm/bớt section tuỳ đề thi. */
export default definePage({
  slug: "templates/data-dashboard",
  title: "Bảng điều khiển",
  description: "Tải dữ liệu, lọc theo phân khúc và thời gian, đọc KPI, biểu đồ và nhận định có trích dẫn.",
  header: "transparent",
  sections: [
    {
      type: "hero",
      variant: "bottom",
      image: "/images/dashboard-hero.jpg",
      kicker: "Mẫu 01 · Visual analytics",
      title: "Bảng điều khiển",
      subtitle: "Biến bảng số thành câu chuyện",
      height: "80vh",
      actions: [{ label: "Bắt đầu ngay", href: "#bat-dau", style: "inverse" }],
    },
    // Demo tương tác: form nhập, kết quả, sáu trạng thái của lượt chạy (src/problem-templates/data-dashboard).
    { type: "workspace", template: "data-dashboard" },
    {
      type: "notices",
      tone: "subtle",
      heading: { title: "Vì sao tin được kết quả?", subtitle: "Ba nguyên tắc của mẫu này." },
      items: [
        { title: "Số liệu tính tất định", text: "Mọi KPI được tính trực tiếp từ dữ liệu – cùng một tệp luôn cho cùng một con số.", tone: "ice" },
        { title: "Trích dẫn từng dòng", text: "Mỗi nhận định trỏ về đúng dòng dữ liệu gốc để ban giám khảo tự kiểm chứng.", tone: "ice" },
        { title: "Thay bằng dữ liệu của đề", text: "Đổi tệp mẫu và nhãn cột trong src/problem-templates/data-dashboard là xong.", tone: "navy" },
      ],
    },
  ],
});
