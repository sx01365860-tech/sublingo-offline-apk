# Hướng dẫn thử nghiệm — SubLingo Offline v1

## Mục tiêu bản này

Bản chạy thử kiểm tra tính phù hợp của trải nghiệm trên điện thoại Android: chọn video từ bộ nhớ, chọn một frame có phụ đề Trung rõ nét, nhận diện chữ Trung cục bộ, dịch Trung–Việt trên thiết bị, chỉnh cue và xuất SRT. Video gốc không được tải lên trong các luồng này.

> Bản v1 quét **một frame do bạn chọn** để kiểm chứng chất lượng OCR và thao tác SRT. Chức năng quét tự động toàn bộ video theo nhiều frame sẽ được phát triển sau khi nhận phản hồi về tốc độ và độ chính xác trên điện thoại của bạn.

## Kịch bản thử chính

| Bước | Cách thực hiện | Kết quả cần quan sát |
| --- | --- | --- |
| 1 | Mở app, chạm **Tạo dự án từ video**, chọn video có phụ đề cứng tiếng Trung | Video và ảnh preview xuất hiện ở màn hình Thiết lập OCR |
| 2 | Dùng nút `+` hoặc `–` chọn thời điểm có chữ rõ, sau đó chạm **Làm mới frame** | Ảnh frame thay đổi tương ứng; chọn preset Đáy giữa/Đáy rộng nếu cần |
| 3 | Chạm **Quét phụ đề trên frame** | Chữ Trung trở thành một cue trong Trình biên tập; nếu lỗi, thử frame khác |
| 4 | Chạm **Dịch Trung → Việt** | Lần đầu máy cần mạng để tải model Trung–Việt. Sau đó dịch hoạt động bằng model trên thiết bị |
| 5 | Chạm một cue để chỉnh chữ hoặc thời gian | Thay đổi được lưu trong danh sách dự án cục bộ |
| 6 | Chạm **Xuất SRT**, chọn tiếng Việt hoặc song ngữ | Android mở bảng chia sẻ để lưu hoặc gửi tệp SRT UTF-8 |

## Nếu OCR hoặc dịch không chạy

Nếu OCR không đọc được chữ, hãy thử frame có chữ kích thước lớn hơn, nền ít chuyển động hơn, và preset Đáy rộng. Bạn vẫn có thể chạm **Tạo cue thủ công** để kiểm tra biên tập/xuất SRT. Nếu dịch lần đầu báo lỗi, kết nối mạng tạm thời để ML Kit tải model Trung–Việt; những lần dùng sau model vẫn nằm trên máy trừ khi bị Android hoặc người dùng xóa dữ liệu app.

## Phản hồi cần gửi sau khi thử

Hãy ghi lại tên video, vị trí thời gian của frame, ảnh chụp màn hình lỗi nếu có, và nhận xét ngắn về bốn điểm: OCR đọc đúng bao nhiêu, bản dịch có tự nhiên không, tốc độ có chấp nhận được không, và thao tác nào khó dùng. Các thông tin này sẽ quyết định cách tối ưu bước quét hàng loạt và crop phụ đề ở bản tiếp theo.
