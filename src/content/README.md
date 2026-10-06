# Nội dung trang web dự thi

Toàn bộ chữ, ảnh và thứ tự các khối trên trang web nằm trong thư mục này. Muốn đổi nội dung cho một đề thi, bạn chỉ sửa các file ở đây, **không cần đụng vào code giao diện**.

```
src/content/
  site.ts              Logo, tên đội, menu, header, footer, tiêu đề SEO
  pages/home.ts        Trang chủ "/"
  pages/<use-case>.ts  Mỗi use case một trang, ví dụ /templates/risk-analyzer
  index.ts             Danh sách các trang (thêm trang mới thì khai báo ở đây)
public/images/         Ảnh (đường dẫn trong nội dung bắt đầu bằng /images/...)
public/brand/          Logo
```

## Sửa nhanh

- **Đổi chữ:** mở file trang, sửa chuỗi trong `title`, `subtitle`, `text`…
- **Đổi ảnh:** chép ảnh vào `public/images/`, rồi đổi `image: "/images/ten-anh.jpg"`.
- **Đổi thứ tự khối:** kéo cả object `{ type: ..., ... }` lên hoặc xuống trong mảng `sections`.
- **Bỏ một khối:** xoá object đó, hoặc comment nó lại.
- **Thêm khối:** chép một mẫu ở bảng dưới rồi dán vào `sections`.

Trình soạn thảo (VS Code) sẽ gợi ý tên field và báo lỗi ngay khi bạn gõ sai `type`, nhờ hàm `definePage(...)`.

## Thêm một trang mới

1. Tạo file `src/content/pages/ten-trang.ts`:
   ```ts
   import { definePage } from "@/site/schema";

   export default definePage({
     slug: "ten-trang",           // URL: /ten-trang  ("" là trang chủ)
     title: "Tên trang",
     header: "transparent",       // "cover" | "transparent" | "solid"
     sections: [
       { type: "hero", variant: "bottom", image: "/images/home-hero.jpg", title: "Tên trang", subtitle: "Một câu giới thiệu" },
     ],
   });
   ```
2. Khai báo trong `src/content/index.ts` (import và thêm vào mảng `pages`).
3. Nếu muốn trang hiện trong menu hoặc footer, thêm link vào `src/content/site.ts`.

## Các loại khối (section)

Mọi khối đều có thể có thêm:
- `id`: dùng làm neo link, ví dụ `id: "ban-do"` thì link tới được bằng `/#ban-do`.
- `tone`: màu nền `"white" | "subtle" | "ice" | "navy"`.
- `heading`: tiêu đề khối, dạng `{ title, subtitle?, link?: { label, href } }`.

| `type` | Dùng để | Field chính |
|---|---|---|
| `hero` | Ảnh lớn đầu trang | `variant` (`cover`, `center`, `bottom`), `image`, `kicker?`, `title`, `subtitle?`, `height?`, `actions?: [{ label, href, style }]` |
| `intro` | Đoạn mở đầu, có thể kèm ảnh | `lead`, `paragraphs: []`, `image?` |
| `cards` | Dãy card ảnh + chữ | `layout` (`carousel`, `grid`), `items: [{ title, text?, image, kicker?, href? }]`, `cta?` |
| `tiles` | Ô ảnh có tiêu đề đè lên ảnh | `items: [{ title, image, href }]`, `links?: [{ label, href }]` |
| `feature` | Banner ảnh toàn màn hình | `image`, `title`, `text?`, `cta?` |
| `scrollExpand` | Ảnh nở ra khi cuộn | `image`, `title`, `kicker?`, `revealTitle`, `revealText?`, `cta?` |
| `map` | **Bản đồ** tràn màn hình kèm danh sách | `heading`, `groups: [{ title, items: [{ name, lat, lng, text?, link?, meta? }] }]` |
| `linkLists` | Ảnh banner + các cột link | `banner?`, `columns: [{ title?, items: [{ label, href? }] }]` |
| `steps` | Các bước có đánh số | `items: [{ title, text?, image }]` |
| `partners` | Card đối tác hoặc tài nguyên | `items: [{ name, text?, image, href, external? }]` |
| `offers` | Card có giá / mức và nút | `items: [{ image, meta?, title, subtitle?, text?, priceLabel?, price?, cta? }]` |
| `notices` | Ô ghi chú | `items: [{ title, text, tone (ice, navy, warning, success), link? }]` |
| `stats` | Dải số liệu lớn | `items: [{ label, value, unit?, note? }]` |
| `accordion` | Câu hỏi đóng/mở | `items: [{ title, body }]` (body viết Markdown) |
| `prose` | Đoạn văn tự do | `markdown` |
| `workspace` | Demo tương tác của mẫu bài toán | `template` (`data-dashboard`, `document-analyzer`, `risk-analyzer`, `research-intelligence`, `recommendation-planner`, `knowledge-assistant`) |

Ví dụ khối bản đồ:

```ts
{
  type: "map",
  id: "ban-do",
  heading: { title: "Bản đồ ý tưởng", subtitle: "Bấm vào một địa điểm để xem chi tiết." },
  groups: [
    { title: "Địa điểm", items: [
      { name: "Hà Nội", lat: 21.0285, lng: 105.8542, text: "Mô tả ngắn.", link: { label: "Xem thêm", href: "/templates/document-analyzer" } },
    ] },
  ],
},
```

Toạ độ lấy từ Google Maps: chuột phải vào điểm trên bản đồ, dòng đầu tiên là `vĩ độ, kinh độ`.

## Kiểm tra trước khi nộp (pre-submit)

```sh
pnpm test     # kiểm tra nội dung: đúng loại khối, ảnh có tồn tại, link không gãy
pnpm check    # typecheck + lint
pnpm build    # build production
```

`pnpm test` sẽ báo rõ chỗ sai, ví dụ:
`content/pages/home › sections[3].items[0].image: Ảnh phải là đường dẫn trong /public…`

Lưu ý: trong bản production, khối `workspace` hiển thị trạng thái "Sắp ra mắt" thay cho dữ liệu demo. Dùng `pnpm dev` để xem dữ liệu demo.
