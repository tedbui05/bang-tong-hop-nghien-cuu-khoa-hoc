---
name: ailog
description: Ghi một mục nhật ký làm việc với AI vào docs/AI_LOG.md.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash(date *)
---

Thêm một mục mới vào cuối `docs/AI_LOG.md`. Nếu file chưa có thì tạo, với tiêu đề `# Nhật ký làm việc với AI`. Không sửa các mục cũ.

Mục này ghi phần trao đổi kể từ mục gần nhất trong file. Lấy ngày giờ bằng lệnh `date '+%Y-%m-%d %H:%M'`. Ghi chú thêm của người dùng (nếu có): $ARGUMENTS

Viết bằng tiếng Việt, ngắn gọn, theo mẫu:

```markdown
## <ngày giờ> — <tên ngắn của phần việc>

- **Đã nhờ AI làm gì:**
- **AI đề xuất gì:**
- **Chấp nhận hay sửa gì, vì sao:**
- **AI đã sai ở đâu:**
```

Quy tắc:

- Chỉ ghi điều thực sự có trong cuộc trao đổi. Nếu người dùng không nói lý do thì ghi "không nêu lý do", không tự suy diễn.
- Ở mục "AI đã sai ở đâu", ghi thẳng cả những chỗ AI bỏ sót hoặc phải làm lại. Nếu không có thì ghi "không có".
- Không ghi API key, mật khẩu hay nội dung file `.env`.
- Không tự lưu vào git. Ghi xong, cho người dùng xem lại mục vừa thêm.
