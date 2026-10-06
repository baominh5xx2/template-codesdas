# Chat UI — ChatGPT layout, white theme

Ngày: **2026-10-05**, cập nhật **2026-10-06**. Trạng thái: **UI đã triển khai; 24 browser acceptance checks đã pass với SDK/runtime thật và controlled provider**. Bàn phím phần mềm trên thiết bị thật và browser zoom 200% còn cần manual QA; mobile emulation/visualViewport resize không thay thế hai checks này.

User chọn bố cục chat như ảnh ChatGPT đính kèm và **theme trắng**. Đây là visual/interaction spec cho [Core PRD](../../platform-build-spec.md), [C01 spec](2026-10-05-chat-foundation-design.md) và [C01 plan](../plans/2026-10-05-chat-foundation-implementation-plan.md). Thay thế quyết định theme theo browser light/dark trước đó. UI hiện có tại `/`; commands, harness và evidence limits nằm ở [docs index](../../README.md#chạy-browser-acceptance).

## 1. Hướng thiết kế

Dùng workspace chat tối giản: sidebar trái, header mỏng, transcript ở giữa và composer dưới cùng. Nền main trắng, bề mặt phụ xám nhẹ, chữ gần đen, outline icons. Khoảng trắng giúp đọc câu trả lời dài; không dùng gradient, glass, hero marketing hoặc dashboard cards cho chat text cơ bản.

Ảnh user cung cấp là reference cho bố cục và mật độ. Không copy tên/logo ChatGPT, nội dung hội thoại hay các tính năng trong ảnh thành yêu cầu mới. Branding dùng **Hackathon Starter Kit**, thay được bằng domain branding sau.

Các hướng đã cân nhắc:

| Hướng | Quyết định |
|---|---|
| ChatGPT-style workspace, white/neutral | Chọn theo yêu cầu user; phù hợp chat và lịch sử |
| Floating copilot bên cạnh dashboard | Không chọn cho core chat toàn màn hình |
| AI landing page, gradient/accent lớn | Không chọn; làm giảm diện tích đọc và khác reference |

## 2. Bố cục và kích thước

| Vùng | Desktop từ 1024px | Dưới 1024px |
|---|---|---|
| Shell | Chiều cao viewport động, không cuộn toàn trang | Cùng shell; composer không bị bàn phím che |
| Sidebar | Rộng 280px; có thể thu gọn hoàn toàn | Drawer rộng min(280px, viewport − 48px), đóng mặc định |
| Header main | Cao 56px; tên app trái, nút mở sidebar khi thu gọn | Cao 52px; nút mở sidebar và tên app |
| Transcript | Cột tối đa 768px, căn giữa trong main, padding ngang 24px | Chiếm chiều rộng còn lại, padding ngang 16px |
| Composer | Cùng trục/cột 768px của transcript; cách mép dưới 24px | Cách mép dưới 12px + safe-area, ngang 16px |

Main là cột flex: header → transcript scroller → notice/composer. Sidebar có scroller riêng. Composer chiếm một hàng layout thật; không phủ lên message cuối bằng một fixed overlay. Không có cuộn ngang toàn trang. Code/table dài chỉ cuộn ngang bên trong block của chúng.

## 3. White theme tokens

| Token | Giá trị | Dùng cho |
|---|---|---|
| `canvas` | `#FFFFFF` | Main/header/assistant text surface |
| `sidebar` | `#F9F9F9` | Navigation surface |
| `surface` | `#F4F4F4` | Composer, code blocks |
| `userBubble` | `#F1F1F1` | User message |
| `hover` | `#ECECEC` | Hover/selected navigation row |
| `text` | `#171717` | Body/headings/icons |
| `mutedText` | `#666666` | Labels/placeholders/secondary actions |
| `border` | `#E5E5E5` | Dividers/outline |
| `sendBackground` | `#171717` | Send/Stop button |
| `sendForeground` | `#FFFFFF` | Send/Stop icon |
| `focusRing` | `#2563EB` | Visible keyboard focus only |

White theme cố định: đặt light color scheme và override CopilotKit theme tokens ở workspace scope. Browser/OS dark preference không đổi bề mặt, chữ, composer hoặc code block thành dark. Không thêm theme switcher trong scope hiện tại. Technical failure vẫn dùng một notice xám với copy **`Chưa kết nối`**, không đổi thành red toast/banner kỹ thuật.

Tokens là app-owned semantic values; map sang CSS variables của pinned SDK khi triển khai, không giả định tên variable chưa kiểm tra. Không hardcode màu rải rác trong từng component.

## 4. Typography và hình dáng

- Font system sans hỗ trợ tiếng Việt: system-ui/Segoe UI/sans-serif; không tải Google Fonts hoặc cần mạng để boot. Body 16px, line-height 1.65; navigation 14px; welcome 32px desktop/28px mobile, weight 600.
- Transcript có nhịp cách lượt 24px; paragraphs/list đọc được với nội dung dài và dấu tiếng Việt. Assistant text không có bubble lớn hoặc avatar lặp từng đoạn.
- User message căn phải, tối đa min(85% cột, 640px), padding 12px 16px, radius 20px. Long URL/identifier wrap an toàn, không clip nội dung chính.
- Composer radius 24px, padding 12px 16px, không shadow lớn; textarea cao theo nội dung từ khoảng 48px tới 200px rồi cuộn bên trong.
- Sidebar row radius 8px, cao tối thiểu 44px; icon 18–20px, vùng bấm 44×44px. Nút Send/Stop tròn 44px, ở cuối composer.
- Outline SVG icons; không emoji làm icons. Dùng SDK/existing icons trước, không thêm icon dependency chỉ cho design này.

## 5. Anatomy và ownership C01/C02

| UI | C01 — Chat Foundation | C02 — Durable History |
|---|---|---|
| Sidebar shell | Branding, `Cuộc trò chuyện mới`, mở/thu gọn | Reuse shell, thêm list từ DB |
| History list | Chưa render list hoặc fake history rows | Active selection, titles, rename/archive/delete theo spec C02 |
| Transcript | Ephemeral text/Markdown/code, Copy, interrupted partial | Hydrate saved transcript và mở lại hội thoại |
| Header | App name, drawer toggle | Có thể thêm current thread title |
| Composer | Text, Send/Stop | Giữ layout, dùng thread đã persist |

Không hiển thị Scheduled/Library/Plugins/Explore/Projects/Share/model picker/mic/upload/voice từ ảnh khi feature chưa được triển khai. Không dựng account menu giả cho một người local. C03–C05 gắn tool/result/domain UI vào cùng shell theo capability thực tế.

Khung sidebar không làm C01 phụ thuộc Postgres. Có thể sửa draft khi no-env; mọi controls còn hiển thị phải thực hiện hành vi thật của C01.

## 6. States và tương tác

- Empty: welcome **`Bạn muốn hỏi gì?`**, không thêm greeting vào transcript. Composer vẫn ở hàng dưới; phần giữa thoáng, không marketing cards.
- Ready: placeholder **`Nhập tin nhắn…`**, Send **`Gửi`**; chữ người dùng căn phải, assistant đọc theo cột trái.
- Running: Stop **`Dừng`** thay Send; phản hồi xuất hiện dần, không animate lại toàn bộ message mỗi token. Copy thuộc message action, giữ `Sao chép` accessible label.
- Unavailable/failed: một notice **`Chưa kết nối`** đặt ngay trên composer, có **`Thử lại`** theo C01 policy. Không có notice thứ hai trên sidebar/header, không lưu notice thành message.
- Interrupted: giữ partial theo C01 và composer bình thường, không tự hiện notice lỗi. C01 chỉ tạo retry checkpoint cho failed run; sau Stop người dùng gửi turn mới. Visual spec không đổi runtime/controller semantics.
- Scroll: đang ở cuối thì theo stream; cuộn lên thì giữ vị trí, nút về cuối có accessible label. Không kéo focus theo tokens.
- Desktop toggle thu gọn sidebar và mở rộng main; cột nội dung vẫn căn giữa. Mobile drawer là dialog có label, focus trap, Escape/backdrop để đóng và trả focus về nút mở; chọn New chat đóng drawer.
- Enter gửi, Shift+Enter xuống dòng, IME không gửi giữa composition. Composer có programmatic label, không dùng placeholder làm label duy nhất.
- Motion nhẹ khoảng 120–160ms cho controls/drawer khi phù hợp; respect reduced motion. Loading/status announcement không phát lại mỗi token.

## 7. Handoff và nghiệm thu khi user triển khai

[White UI implementation plan](../plans/2026-10-05-chat-white-ui-implementation-plan.md) chia 5 tasks. UI Tasks 1–4 là phần chi tiết thay C01 Task 4; UI Task 5 mở rộng checks C01 Task 5. C02 sở hữu dữ liệu/actions history; file này khóa visual direction, không thay thế technical spec C02. Automated checks đã chạy trên Chromium; các manual limits ghi ở trạng thái đầu file.

- 390×844, 768×1024, 1440×900 và 1920×1080: đúng sidebar/drawer/cột chat/composer, không x overflow.
- Khi browser emulate dark preference: giao diện vẫn trắng, chữ/bubble/code/composer vẫn đọc được.
- Text/secondary text contrast tối thiểu 4.5:1; focus và controls tương tác có contrast nhận biết; không dùng màu là tín hiệu duy nhất.
- Keyboard-only: mở/đóng drawer, New chat, nhập/gửi/dừng/retry/copy, focus restore đúng; 200% zoom không clip controls/nội dung.
- Chat dài, URL dài, code block rộng: nội dung còn truy cập được; message cuối không bị composer che; scroll-up không bị giật xuống.
- No-env và lỗi giữa stream: một `Chưa kết nối`, khung trắng còn dùng được, không fake history/errors/assistant replies.

## 8. Evidence từ ui-ux-pro-max

Local search ngày 2026-10-05 xác nhận active style `ai-native-ui` trong `styles.csv`: conversational layout, minimal chrome, user-right alignment và light support. Query `long text reflow` / domain `ux` trả `Text Reflow and Spacing`, phù hợp chat dài. Áp dụng accessibility/keyboard/reflow guidance; các kích thước và white tokens ở trên là quyết định app theo reference của user.

Design-system query ban đầu trả landing pattern `Product Demo + Features` và palette tím; chúng không phù hợp request nên không đưa vào design. Truy vấn `responsive layout` / stack `nextjs` trả guidance image fill, không liên quan shell chat nên không áp dụng. Font system và white theme là lựa chọn theo context, không trình bày như output palette/font của database.

Nguồn skill: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). Đây là written design; chưa tạo app UI hoặc chạy acceptance tests.
