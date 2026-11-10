"use client";

import type { ReactNode } from "react";

// Thanh nhỏ dưới đầu trang, chỉ còn công cụ xem thử trạng thái (extra, chỉ có khi chạy dev).
// Câu nhắc Bảng mẫu và bảng minh hoạ nay nằm ngay trên bảng (TableView).
// Không có gì để hiện thì không dựng thanh, để trình đọc màn hình không gặp một vùng trống.
export function SampleNote({ extra }: { extra?: ReactNode }) {
  if (!extra) return null;
  return (
    <aside className="preview-bar" aria-label="Xem thử trạng thái">
      {extra}
    </aside>
  );
}
