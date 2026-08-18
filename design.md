# Thiết kế trải nghiệm mobile — SubLingo Offline

## Mục tiêu bản chạy thử

SubLingo Offline giúp người dùng tạo phụ đề tiếng Việt từ video đã lưu trong điện thoại theo luồng ngắn, rõ ràng và ưu tiên dữ liệu cục bộ: **chọn video → xác định vùng phụ đề → tạo SRT → kiểm tra/dịch → xuất tệp**. Ứng dụng không yêu cầu đăng nhập, không cần đồng bộ đám mây và không tải video lên mạng.

Thiết kế mặc định ở chế độ dọc 9:16, tối ưu thao tác một tay trên màn hình Android lớn. Các hành động chính nằm ở nửa dưới màn hình, vùng chạm tối thiểu 48 dp, và trạng thái xử lý luôn hiển thị để người dùng không nhầm ứng dụng đang treo.

## Danh sách màn hình

| Màn hình | Nội dung chính | Chức năng |
| --- | --- | --- |
| Trang chủ | Lời chào ngắn, nút tạo dự án, danh sách dự án gần đây và giải thích quyền riêng tư | Mở dự án mới hoặc tiếp tục dự án cục bộ |
| Nhập video | Hai cách chọn tệp, thẻ thông tin video và cảnh báo định dạng | Chọn video từ thư viện hoặc bộ nhớ máy |
| Thiết lập OCR | Video/thumbnail, vùng crop phụ đề, preset vị trí và thiết lập ngôn ngữ | Chọn khu vực phụ đề và cấu hình OCR tiếng Trung |
| Tiến trình | Các bước quét, tạo SRT và dịch; thanh phần trăm, thời gian dự kiến, nút hủy | Theo dõi xử lý nền, không khóa UI |
| Trình biên tập SRT | Playback preview, timeline, danh sách từng cue song ngữ | Sửa tiếng Trung, tiếng Việt, thời điểm bắt đầu/kết thúc; gộp và tách cue |
| Xuất tệp | Chọn SRT tiếng Việt/song ngữ, mã hóa UTF-8, vị trí lưu | Xuất và chia sẻ tệp SRT |
| Cài đặt | Chế độ offline/online, lựa chọn model, gói thuật ngữ và xóa dữ liệu | Thay đổi hành vi app nhưng không yêu cầu tài khoản |

## Luồng người dùng chính

Người dùng chạm **Tạo dự án** ở nửa dưới trang chủ và chọn một video cục bộ. Sau khi app đọc metadata, màn hình Thiết lập OCR mở ra với một ảnh preview. Người dùng kéo hoặc chọn preset vùng phụ đề như **Đáy giữa**, sau đó chọn **Trung giản thể → Việt** và nhấn **Bắt đầu tạo SRT**. Khi hoàn tất, app mở Trình biên tập SRT để người dùng rà soát các cue có cờ độ tin cậy thấp. Cuối cùng, người dùng chọn **Xuất SRT tiếng Việt**, đặt tên tệp và chia sẻ/lưu tệp.

Người dùng có thể chọn chế độ dịch offline; app sẽ chỉ sử dụng model đã tải về. Khi bật chế độ AI online ở giai đoạn sau, app hiển thị một xác nhận nêu rõ chỉ văn bản phụ đề được gửi đi, không gửi video gốc.

## Bố cục và tương tác

Trang chủ dùng một CTA nổi bật ở đáy màn hình. Danh sách dự án dùng các thẻ phẳng, mỗi thẻ chỉ hiển thị thumbnail, tên tệp, thời lượng, trạng thái và thời điểm cập nhật. Màn hình Thiết lập OCR ưu tiên video preview ở nửa trên, thanh preset ở giữa và nút bắt đầu cố định ở đáy. Trình biên tập dùng tab segment **Nguyên bản / Bản dịch** để giảm mật độ, thay vì hiển thị hai đoạn văn dài song song trên màn hình nhỏ.

Các trạng thái loading có thông báo mô tả, ví dụ “Đang so sánh các khung hình để gom câu…”, thay vì spinner chung chung. Các thao tác phá hủy như xóa dự án dùng bottom sheet xác nhận. Cử chỉ phức tạp không phải là điều kiện để hoàn thành luồng; mọi thao tác có nút thay thế.

## Màu sắc và nhận diện

| Token | Màu | Vai trò |
| --- | --- | --- |
| Ink | `#0B1020` | Nền dark mặc định, tạo cảm giác tập trung như phòng dựng phim |
| Slate | `#182238` | Thẻ, panel timeline và bề mặt nâng cao |
| Paper | `#F3F7FC` | Văn bản chính trên nền tối |
| Caption Amber | `#F6B84B` | CTA, trạng thái đang xử lý, vùng phụ đề được chọn |
| Signal Cyan | `#37C6D0` | Timeline, control phụ và trạng thái đã sẵn sàng |
| Success Mint | `#55D6A0` | Xuất file thành công |
| Alert Coral | `#FF7A6B` | Cảnh báo hoặc lỗi OCR |

Biểu tượng ứng dụng sẽ là một khung phụ đề màu hổ phách có nét chữ Trung Quốc cách điệu và đường chuyển sang chữ “VI”, trên nền Ink. Biểu tượng không có góc bo sẵn để phù hợp với launcher Android.

## Domain model cho MVP

```ts
type SubtitleProject = {
  id: string;
  videoUri: string;
  sourceName: string;
  durationMs?: number;
  cropPreset: 'bottom-center' | 'bottom-wide' | 'custom';
  crop: { x: number; y: number; width: number; height: number };
  status: 'draft' | 'ready' | 'processing' | 'review' | 'exported';
  cues: SubtitleCue[];
  updatedAt: string;
};

type SubtitleCue = {
  id: string;
  startMs: number;
  endMs: number;
  sourceText: string;
  translatedText: string;
  confidence?: 'high' | 'medium' | 'low';
};
```

## Giới hạn bản chạy thử

Bản chạy thử tập trung kiểm tra luồng sản phẩm và khả năng thao tác của người dùng trên điện thoại. Tính năng xuất video đã gắn phụ đề, TTS, tự dò vùng phụ đề hoàn toàn, tải video mạng xã hội và model OCR nâng cao sẽ không nằm trong luồng đầu tiên. Chúng chỉ được thêm sau khi nhận phản hồi thực tế về độ chính xác OCR và tốc độ xử lý.
