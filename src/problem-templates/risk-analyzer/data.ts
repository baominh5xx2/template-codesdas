import { z } from "zod";

export const RiskInputSchema = z.object({
  mode: z.enum(["text", "url", "image"]),
  text: z.string().max(5000).optional(),
  urls: z.array(z.string().url()).max(8),
  fileName: z.string().optional(),
  ruleset: z.enum(["finance-scam", "job-scam", "investment-scam"]),
}).refine(input => (input.mode === "text" ? Boolean(input.text?.trim()) : input.mode === "url" ? input.urls.length > 0 : Boolean(input.fileName)), { message: "Hãy cung cấp nội dung cần kiểm tra", path: ["content"] });
export type RiskInput = z.infer<typeof RiskInputSchema>;

export const MESSAGE_SOURCE = "source-message";
export const RULES_SOURCE = "source-rules";
export const SIGNALS_DATASET = "risk-signals";

/** Synthetic SMS in the common unaccented style. The domain is illustrative and is never linked. */
export const MESSAGE = "[NH-XYZ] Tai khoan cua Quy khach bi tam khoa do dang nhap bat thuong. Vui long xac minh trong 24h tai https://nh-xyz-xacminh.top/kh de tranh bi khoa vinh vien. Khong chia se ma OTP cho bat ky ai.";

export function locateText(excerpt: string) {
  const start = MESSAGE.indexOf(excerpt);
  if (start < 0) throw new Error(`excerpt_not_found: ${excerpt}`);
  return { type: "text" as const, start, end: start + excerpt.length };
}

/** Weighted rules (scam-rules v1, synthetic). Undetectable signals count against completeness, never as safe. */
export const RULES = [
  { id: "urgency", label: "Tạo áp lực thời gian", weight: 25, status: "detected", points: 25 },
  { id: "suspicious-link", label: "Liên kết tên miền lạ", weight: 30, status: "detected", points: 30 },
  { id: "credential-request", label: "Yêu cầu xác minh qua liên kết", weight: 20, status: "detected", points: 20 },
  { id: "otp-bait", label: "Nhắc tới mã OTP", weight: 10, status: "detected", points: 7 },
  { id: "brand-impersonation", label: "Mạo danh thương hiệu", weight: 15, status: "unchecked", points: 0 },
] as const;

export function scoreRules(rules: ReadonlyArray<{ weight: number; status: string; points: number }>) {
  const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
  const known = rules.filter(rule => rule.status !== "unchecked").reduce((sum, rule) => sum + rule.weight, 0);
  const score = rules.reduce((sum, rule) => sum + rule.points, 0);
  return { score, completeness: total ? known / total : 0, level: score >= 70 ? "high" as const : score >= 40 ? "medium" as const : "low" as const };
}
