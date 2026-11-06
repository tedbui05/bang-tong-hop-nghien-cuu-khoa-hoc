#!/bin/bash
# Chạy trước mỗi lần Claude dùng Bash, Read hoặc Grep. Thoát với mã 2 nghĩa là chặn thao tác đó.
# Chặn: đọc file .env (trừ .env.example), xóa hàng loạt, đưa code lên mạng.
# Đây là lớp chặn theo mẫu chữ, không thể bắt mọi cách viết lệnh.

block() {
  echo "Đã chặn theo quy tắc an toàn của dự án: $1" >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || block "máy chưa có jq nên không kiểm tra được thao tác này."

input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input") || block "không đọc được thông tin thao tác."

# Trả về đúng nếu chuỗi nhắc đến file .env; .env.example không chứa bí mật nên được phép.
mentions_env() {
  sed -E 's/\.env\.example([^A-Za-z0-9_.-]|$)/\1/g' <<<"$1" |
    grep -Eq '(^|[^A-Za-z0-9_])\.(env([^A-Za-z0-9_]|$)|e(n)?[*?[])'
}

case "$tool" in
  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
    if mentions_env "$cmd"; then
      block "không đọc hay in nội dung file .env."
    fi
    if grep -Eq '(^|[^A-Za-z0-9_-])rm[[:space:]]+([^;&|]*[[:space:]])?-(-recursive|[A-Za-z]*[rR])' <<<"$cmd" ||
      grep -Eq '(^|[^A-Za-z0-9_-])find[[:space:]][^;&|]*[[:space:]]-delete' <<<"$cmd" ||
      grep -Eq '(^|[^A-Za-z0-9_-])git([[:space:]]+-[^;&|]*)?[[:space:]]+clean([^A-Za-z0-9_-]|$)' <<<"$cmd"; then
      block "không chạy lệnh xóa hàng loạt."
    fi
    if grep -Eq '(^|[^A-Za-z0-9_-])git([[:space:]]+-[^;&|]*)?[[:space:]]+push([^A-Za-z0-9_-]|$)' <<<"$cmd"; then
      block "không tự đưa code lên mạng, người dùng sẽ tự làm việc này."
    fi
    ;;
  Read)
    target=$(jq -r '.tool_input.file_path // ""' <<<"$input")
    if mentions_env "$target"; then
      block "không đọc file .env."
    fi
    ;;
  Grep)
    target=$(jq -r '[.tool_input.path, .tool_input.glob] | map(. // "") | join(" ")' <<<"$input")
    if mentions_env "$target"; then
      block "không tìm kiếm trong file .env."
    fi
    ;;
esac

exit 0
