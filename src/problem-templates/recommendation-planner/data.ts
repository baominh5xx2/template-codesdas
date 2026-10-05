import { z } from "zod";

export const PlannerInputSchema = z.object({
  destination: z.literal("da-nang"),
  days: z.number().int().min(1).max(7),
  budgetPerNight: z.number().int().min(200, "Ngân sách tối thiểu 200 nghìn đ").max(20_000),
  interests: z.array(z.enum(["beach", "culture", "food", "nature", "shopping"])),
  withKids: z.boolean(),
  maxPerDay: z.number().int().min(2).max(5),
  weights: z.object({ price: z.number().min(0).max(100), rating: z.number().min(0).max(100), distance: z.number().min(0).max(100) }).refine(w => w.price + w.rating + w.distance > 0, "Cần ít nhất một tiêu chí có trọng số"),
});
export type PlannerInput = z.infer<typeof PlannerInputSchema>;
export type Weights = PlannerInput["weights"];

export type Stay = { id: string; name: string; area: string; price: number; rating: number; distance: number; kidFriendly: boolean; image: string; blurb: string; lat: number; lng: number };
export type PlaceInfo = { id: string; name: string; lat: number; lng: number; description: string };
export type PlanItem = { id: string; day: number; time: string; placeId: string; title: string; note?: string };

/** Illustrative options with placeholder names — not real listings or prices. */
export const STAYS: Stay[] = [
  { id: "stay-beach", name: "Khách sạn ven biển Mỹ Khê", area: "Sơn Trà, Đà Nẵng", price: 1200, rating: 8.6, distance: 3.5, kidFriendly: true, image: "/images/beach.jpg", blurb: "Ngay sát biển, có hồ bơi trẻ em và phòng gia đình.", lat: 16.0628, lng: 108.2468 },
  { id: "stay-oldtown", name: "Homestay phố cổ Hội An", area: "Minh An, Hội An", price: 850, rating: 9.1, distance: 28, kidFriendly: false, image: "/images/boat.jpg", blurb: "Nhà cổ ấm cúng, đi bộ ra phố đèn lồng; cầu thang dốc.", lat: 15.8794, lng: 108.3282 },
  { id: "stay-sontra", name: "Resort bán đảo Sơn Trà", area: "Bán đảo Sơn Trà", price: 3200, rating: 9.3, distance: 10, kidFriendly: true, image: "/images/planner-card.jpg", blurb: "Yên tĩnh giữa rừng và biển, nhiều tiện ích nghỉ dưỡng.", lat: 16.1135, lng: 108.2985 },
  { id: "stay-center", name: "Căn hộ trung tâm Hải Châu", area: "Hải Châu, Đà Nẵng", price: 700, rating: 8.1, distance: 1, kidFriendly: true, image: "/images/dashboard-hero.jpg", blurb: "Gọn gàng, gần chợ Cồn và cầu Rồng, tự nấu ăn được.", lat: 16.0700, lng: 108.2205 },
];

export const PLACES: PlaceInfo[] = [
  { id: "my-khe", name: "Biển Mỹ Khê", lat: 16.0594, lng: 108.247, description: "Bãi biển dài, cát mịn – đẹp nhất lúc bình minh." },
  { id: "son-tra", name: "Bán đảo Sơn Trà", lat: 16.1, lng: 108.278, description: "Đường ven rừng, chùa Linh Ứng và điểm ngắm toàn cảnh thành phố." },
  { id: "cau-rong", name: "Cầu Rồng", lat: 16.0612, lng: 108.2275, description: "Phun lửa, phun nước vào tối cuối tuần." },
  { id: "cho-con", name: "Chợ Cồn", lat: 16.068, lng: 108.2143, description: "Thiên đường ăn vặt địa phương." },
  { id: "ba-na", name: "Bà Nà Hills", lat: 15.995, lng: 107.996, description: "Cáp treo, Cầu Vàng và khí hậu mát mẻ – cần gần trọn một ngày." },
  { id: "ngu-hanh-son", name: "Ngũ Hành Sơn", lat: 16.0036, lng: 108.263, description: "Núi đá vôi, hang động và làng đá Non Nước." },
  { id: "hoi-an", name: "Phố cổ Hội An", lat: 15.877, lng: 108.3266, description: "Phố đèn lồng, thả hoa đăng trên sông Hoài." },
];

export const PLAN: PlanItem[] = [
  { id: "p1", day: 1, time: "06:00", placeId: "my-khe", title: "Đón bình minh ở biển Mỹ Khê" },
  { id: "p2", day: 1, time: "15:00", placeId: "son-tra", title: "Dạo bán đảo Sơn Trà", note: "Thuê xe 7 chỗ nếu đi cùng trẻ nhỏ" },
  { id: "p3", day: 1, time: "21:00", placeId: "cau-rong", title: "Xem Cầu Rồng phun lửa", note: "Chỉ tối thứ bảy, chủ nhật" },
  { id: "p4", day: 2, time: "08:00", placeId: "ba-na", title: "Bà Nà Hills và Cầu Vàng" },
  { id: "p5", day: 2, time: "18:30", placeId: "cho-con", title: "Ăn tối ở chợ Cồn" },
  { id: "p6", day: 3, time: "08:30", placeId: "ngu-hanh-son", title: "Khám phá Ngũ Hành Sơn" },
  { id: "p7", day: 3, time: "15:30", placeId: "hoi-an", title: "Phố cổ Hội An và thả hoa đăng" },
];

export const DEFAULT_WEIGHTS: Weights = { price: 40, rating: 40, distance: 20 };
export const DEFAULT_BUDGET = 1500;

export type RankedStay = Stay & { score: number; violations: string[] };

/** Deterministic weighted ranking; hard-constraint violators are kept but ranked after valid options. */
export function rankStays(stays: Stay[], weights: Weights, budget: number, withKids: boolean): RankedStay[] {
  const span = (key: "price" | "rating" | "distance") => {
    const values = stays.map(stay => stay[key]);
    return { min: Math.min(...values), range: Math.max(...values) - Math.min(...values) || 1 };
  };
  const p = span("price"), r = span("rating"), d = span("distance");
  const total = weights.price + weights.rating + weights.distance || 1;
  return stays.map(stay => {
    const score = (weights.price * (1 - (stay.price - p.min) / p.range) + weights.rating * ((stay.rating - r.min) / r.range) + weights.distance * (1 - (stay.distance - d.min) / d.range)) / total;
    const violations = [
      ...(stay.price > budget ? [`Vượt ngân sách ${budget.toLocaleString("vi-VN")} nghìn đ/đêm`] : []),
      ...(withKids && !stay.kidFriendly ? ["Không phù hợp trẻ nhỏ"] : []),
    ];
    return { ...stay, score: Math.round(score * 100), violations };
  }).sort((a, b) => Number(a.violations.length > 0) - Number(b.violations.length > 0) || b.score - a.score);
}

/** Hard-constraint checks for an edited plan. */
export function validatePlan(plan: PlanItem[], maxPerDay: number): string[] {
  const issues: string[] = [];
  const days = [...new Set(plan.map(item => item.day))].sort();
  for (const day of days) {
    const items = plan.filter(item => item.day === day);
    if (items.length > maxPerDay) issues.push(`Ngày ${day} có ${items.length} hoạt động, vượt giới hạn ${maxPerDay} hoạt động/ngày.`);
    const ids = items.map(item => item.placeId);
    if (ids.includes("ba-na") && ids.includes("hoi-an")) issues.push(`Ngày ${day} có cả Bà Nà và Hội An – hai nơi cách nhau hơn 60 km, không đủ thời gian.`);
  }
  return issues;
}
