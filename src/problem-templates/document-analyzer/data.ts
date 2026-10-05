import { z } from "zod";
import type { NormalizedDocument } from "@/contracts/sources";

export const DocumentInputSchema = z.object({
  fileName: z.string().regex(/\.(pdf|docx)$/i, "Chỉ nhận tệp .pdf hoặc .docx"),
  documentType: z.enum(["lease", "employment", "invoice", "other"]),
  checks: z.array(z.enum(["missing-clauses", "fairness", "deadlines"])),
  focus: z.string().max(500).optional(),
});
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

export const SOURCE_ID = "source-lease-pdf";
export const DOCUMENT_ID = "doc-lease";
export const FIELDS_DATASET = "lease-fields";

/** Synthetic lease, page by page. Names and addresses are placeholders. */
export const PAGES: string[][] = [
  [
    "HỢP ĐỒNG THUÊ CĂN HỘ (bản mẫu tổng hợp)",
    "Bên cho thuê (Bên A): Ông Trần Văn A. Bên thuê (Bên B): Bà Nguyễn Thị B.",
    "Điều 1. Đối tượng thuê: Căn hộ số 12.05, Toà C, Khu đô thị Mẫu, diện tích 68 m², gồm 2 phòng ngủ và nội thất cơ bản theo Phụ lục 01.",
    "Điều 2. Thời hạn thuê: 12 tháng, từ ngày 01/11/2026 đến hết ngày 31/10/2027. Hợp đồng được gia hạn nếu hai bên đồng ý bằng văn bản trước 30 ngày.",
    "Điều 3. Giá thuê: 12.000.000 đồng/tháng, cố định trong suốt thời hạn thuê, chưa bao gồm phí quản lý, điện, nước và internet.",
  ],
  [
    "Điều 4. Thanh toán: Bên B thanh toán tiền thuê trước ngày 05 hằng tháng bằng chuyển khoản. Chậm thanh toán quá 10 ngày, Bên B chịu phạt 0,1% số tiền chậm trả cho mỗi ngày.",
    "Điều 5. Đặt cọc: Bên B đặt cọc 36.000.000 đồng, tương đương 03 tháng tiền thuê. Tiền cọc được hoàn trả trong vòng 30 ngày sau khi bàn giao lại căn hộ, sau khi trừ các khoản hư hỏng (nếu có).",
    "Điều 6. Chấm dứt hợp đồng: Bên A có quyền đơn phương chấm dứt hợp đồng khi báo trước 15 ngày. Bên B đơn phương chấm dứt trước hạn sẽ mất toàn bộ tiền đặt cọc.",
  ],
  [
    "Điều 7. Quyền và nghĩa vụ: Bên B sử dụng căn hộ đúng mục đích để ở, không cho thuê lại khi chưa có sự đồng ý của Bên A.",
    "Điều 8. Điều khoản chung: Hai bên cam kết thực hiện đúng hợp đồng. Tranh chấp được giải quyết bằng thương lượng, nếu không thành sẽ đưa ra Toà án có thẩm quyền.",
  ],
];

/** Normalised document with pdf locators whose offsets index into each page's text (paragraphs joined by "\n"). */
export function buildDocument(): NormalizedDocument {
  const segments = PAGES.flatMap((paragraphs, pageIndex) => {
    let offset = 0;
    return paragraphs.map((text, index) => {
      const segment = { id: `p${pageIndex + 1}-s${index + 1}`, text, locator: { type: "pdf" as const, page: pageIndex + 1, start: offset, end: offset + text.length } };
      offset += text.length + 1;
      return segment;
    });
  });
  return { id: DOCUMENT_ID, sourceId: SOURCE_ID, title: "hop-dong-thue-can-ho.pdf", segments, warnings: [] };
}

/** Finds an excerpt on a page and returns its pdf locator; throws so fixtures cannot cite text that is not there. */
export function locate(page: number, excerpt: string) {
  const text = PAGES[page - 1].join("\n");
  const start = text.indexOf(excerpt);
  if (start < 0) throw new Error(`excerpt_not_found: ${excerpt}`);
  return { type: "pdf" as const, page, start, end: start + excerpt.length };
}
