---
name: check
description: Chạy toàn bộ kiểm tra của dự án (lỗi code, test, build) và báo kết quả bằng lời đơn giản.
disable-model-invocation: true
allowed-tools: Read, Bash(npm run lint), Bash(npm run typecheck), Bash(npm test), Bash(npm run build)
---

Người dùng không rành kỹ thuật. Hãy chạy kiểm tra rồi báo kết quả bằng tiếng Việt đơn giản.

1. Đọc mục `scripts` trong `package.json`. Nếu chưa có `package.json`, báo "Dự án chưa có code nên chưa có gì để kiểm tra" rồi dừng.
2. Chạy lần lượt những lệnh có trong `scripts`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Một lệnh lỗi thì vẫn chạy tiếp các lệnh sau.
3. Báo cáo một bảng gồm: tên việc kiểm tra (kiểm tra lỗi code, kiểm tra kiểu dữ liệu, chạy test, thử build) và kết quả **Đạt**, **Lỗi** hoặc **Chưa có**.
4. Với mỗi lỗi, nói rõ lỗi đó nghĩa là gì, ảnh hưởng gì đến app và nằm ở file nào. Không dán nguyên đoạn báo lỗi dài.

Quy tắc:

- Lệnh chưa có trong `scripts` thì ghi "Chưa có", không tính là đạt.
- Chỉ báo cáo, không tự sửa code. Hỏi người dùng có muốn sửa không.
- Nếu lỗi do thiếu biến môi trường, chỉ nói tên biến còn thiếu. Không mở file `.env`, và không chép key hay mật khẩu xuất hiện trong kết quả chạy lệnh.
