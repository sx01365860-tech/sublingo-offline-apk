# Quyết định kỹ thuật OCR cho bản chạy thử

## OCR tiếng Trung

Gói `expo-mlkit-ocr` đã được loại khỏi phương án tích hợp: mã Android công khai của phiên bản 0.2.7 chỉ khởi tạo `TextRecognizerOptions.DEFAULT_OPTIONS`, tức recognizer Latin. Nó không đáp ứng yêu cầu phụ đề tiếng Trung dù phần mô tả package nói dùng ML Kit v2.

Thay vào đó, bản thử nghiệm dùng `@react-native-ml-kit/text-recognition`. Tài liệu package cho phép gọi `TextRecognition.recognize(uri, TextRecognitionScript.CHINESE)`, trong đó `TextRecognitionScript.CHINESE` chọn recognizer Chinese on-device. Package được autolink ở React Native mới; APK phát hành cần native prebuild, do đó không chạy tính năng OCR trong Expo Go.

> Quyết định này giữ video và ảnh frame ở thiết bị. Kết quả OCR sẽ trở thành cue SRT cục bộ; không có video gốc nào được gửi đến dịch vụ online.

## Giới hạn pipeline trong APK đầu tiên

`expo-video` được dùng để xem trước video đã chọn. App cung cấp lựa chọn vùng phụ đề và cấu trúc project/cue, nhưng việc trích frame theo thời gian hoàn chỉnh cần một native video-frame extractor riêng. Trong bản chạy thử, OCR được kích hoạt trên ảnh frame do người dùng chọn hoặc ảnh thumbnail, nhằm kiểm tra binding OCR Chinese, luồng biên tập và xuất SRT trước.

## Nguồn

- https://github.com/rbayuokt/expo-mlkit-ocr/blob/main/android/src/main/java/expo/modules/mlkitocr/ExpoMlkitOcrModule.kt
- https://github.com/a7medev/react-native-ml-kit/tree/main/text-recognition
- https://developers.google.com/ml-kit/vision/text-recognition/v2/android
