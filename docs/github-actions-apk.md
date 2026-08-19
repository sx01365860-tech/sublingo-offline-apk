# Build APK bằng GitHub Actions

## Vì sao dùng phương án này

Workflow này không dùng nút Xuất bản hiện tại. GitHub Actions tạo Android native project bằng `expo prebuild` trên máy build cloud, chạy Gradle để tạo một **debug APK** đã được ký debug, sau đó lưu APK trong artifact của workflow. APK này phù hợp để cài và thử nghiệm trực tiếp trên iQOO Z10 Turbo Plus; không dùng để phát hành Google Play.

## Cách chạy

1. Đẩy mã nguồn dự án lên một repository GitHub riêng tư hoặc công khai của bạn. File `.github/workflows/build-apk.yml` phải được giữ nguyên trong repository.
2. Mở repository trên GitHub, chọn **Actions** → **Build Android APK** → **Run workflow**.
3. Chờ job **Build installable APK** hoàn thành. Nếu thất bại, tải log của step có dấu X và gửi lại cho tôi.
4. Mở job thành công, tìm phần **Artifacts**, tải `sublingo-offline-debug-apk`. GitHub tải về một tệp ZIP; giải nén để có `app-debug.apk`.
5. Chép APK sang điện thoại, mở tệp và cho phép cài ứng dụng từ nguồn đó khi Android hỏi. Sau khi cài, dùng tài liệu `docs/tryout-notes.md` để kiểm tra OCR, dịch và xuất SRT.

## Ghi chú an toàn và giới hạn

APK debug chỉ để thử nội bộ. Khi có phản hồi tốt về OCR và giao diện, workflow có thể được nâng cấp thành release APK ký bằng keystore của bạn, rồi tiến tới AAB cho Google Play. GitHub Actions lưu artifact trong 14 ngày theo cấu hình hiện tại.

## Kiểm tra thất bại thường gặp

| Vị trí lỗi | Ý nghĩa | Thông tin cần gửi lại |
| --- | --- | --- |
| `Install JavaScript dependencies` | Lỗi dependency hoặc lockfile | Toàn bộ đoạn log có lỗi đầu tiên |
| `Generate Android native project` | Cấu hình Expo/native module không tương thích | Toàn bộ log của step prebuild |
| `Assemble debug APK` | Lỗi Gradle, Android SDK hoặc module ML Kit | Đoạn log từ dòng `FAILURE` trở lên |
| Không thấy Artifacts | Job chưa thành công hoặc artifact path sai | Ảnh màn hình job và log Upload APK artifact |

## Nguồn

[1] Expo, “Build APKs for Android Emulators and devices”, https://docs.expo.dev/build-reference/apk/

[2] GitHub Docs, “Store and share data with workflow artifacts”, https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow

[3] Codemagic Docs, “React Native apps”, https://docs.codemagic.io/yaml-quick-start/building-a-react-native-app/
