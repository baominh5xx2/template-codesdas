import { definePage } from "@/site/schema";

/** Trang use case "/templates/recommendation-planner". Sửa chữ, ảnh hoặc thêm/bớt section tuỳ đề thi. */
export default definePage({
  slug: "templates/recommendation-planner",
  title: "Lập kế hoạch",
  description: "Xếp hạng lựa chọn theo tiêu chí bạn đặt, đánh dấu những gì vi phạm ràng buộc và dựng kế hoạch chỉnh sửa được.",
  header: "transparent",
  sections: [
    {
      type: "hero",
      variant: "bottom",
      image: "/images/planner-hero.jpg",
      kicker: "Mẫu 05 · Recommendation & planning",
      title: "Lập kế hoạch",
      subtitle: "Chọn đúng, đi nhẹ nhàng",
      height: "80vh",
      actions: [{ label: "Bắt đầu ngay", href: "#bat-dau", style: "inverse" }],
    },
    // Demo tương tác: form nhập, kết quả, sáu trạng thái của lượt chạy (src/problem-templates/recommendation-planner).
    { type: "workspace", template: "recommendation-planner" },
    {
      type: "notices",
      tone: "subtle",
      heading: { title: "Vì sao tin được kết quả?", subtitle: "Ba nguyên tắc của mẫu này." },
      items: [
        { title: "Trọng số do bạn chọn", text: "Kéo thanh trượt, thứ hạng cập nhật ngay lập tức.", tone: "ice" },
        { title: "Ràng buộc cứng", text: "Lựa chọn vi phạm ngân sách hay điều kiện được đánh dấu rõ.", tone: "warning" },
        { title: "Lịch trình sửa được", text: "Đổi ngày, đổi thứ tự – ràng buộc được kiểm tra lại sau mỗi thay đổi.", tone: "navy" },
      ],
    },
  ],
});
