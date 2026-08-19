# Điều tra APK hỏng — 2026-08-19

APK người dùng gửi tại thời điểm kiểm tra có kích thước 36 MB và header `PK\x03\x04`, được nhận diện là Android APK với `gradle app-metadata.properties`. Tuy nhiên, phép kiểm tra archive `unzip -t` không tìm thấy **end-of-central-directory signature** (`PK\x05\x06`); đoạn cuối tệp chứa byte `00` và không có ZIP end marker. Vì APK là ZIP archive, tệp này bị cắt dở hoặc mất phần mục lục ZIP, nên không phải gói cài đặt nguyên vẹn.

Artifact GitHub Actions của build sửa crash (run `32204103986`) còn hiệu lực, có zip artifact với kích thước 29,381,054 byte. Không thể dùng APK người dùng gửi để kết luận app còn crash runtime; cần tải lại artifact hoàn chỉnh, giải nén rồi kiểm tra `unzip -t app-debug.apk` trước khi cài.

Việc thay thế wrapper ML Kit legacy trong commit `cc63af3` vẫn là bản sửa được build thành công ở run này. Bản build đó giữ New Architecture của Reanimated và không còn autolink hai package ML Kit legacy.
