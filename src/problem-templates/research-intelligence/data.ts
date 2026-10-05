import { z } from "zod";

export const ResearchInputSchema = z.object({
  query: z.string().trim().min(10, "Câu hỏi cần ít nhất 10 ký tự"),
  seedUrls: z.array(z.string().url()).max(8),
  domains: z.array(z.string()).min(1, "Chọn ít nhất một nhóm nguồn"),
  maxSources: z.number().int().min(3).max(20),
  timeRange: z.enum(["12m", "24m", "all"]),
});
export type ResearchInput = z.infer<typeof ResearchInputSchema>;
