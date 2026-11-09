"use client";

import type { ReactNode } from "react";
import { sampleTable } from "@/lib/sample-data";
import { useStore } from "@/lib/store";

// Thanh nhỏ dưới đầu trang. Chỉ các bài có sẵn trong Bảng mẫu mới là dữ liệu minh hoạ gán tay. Bảng của sinh viên,
// và bài sinh viên tự tải vào Bảng mẫu, dùng nhãn do code kiểm tra thật. Chờ đọc xong dữ liệu đã lưu mới hiện,
// vì lúc mới mở trang bảng đang chọn luôn là Bảng mẫu. extra: công cụ xem thử trạng thái, chỉ có khi chạy dev.
// Không có gì để hiện thì không dựng thanh, để trình đọc màn hình không gặp một vùng trống.
export function SampleNote({ extra }: { extra?: ReactNode }) {
  const { activeTable, hydrated } = useStore();
  const isSample = hydrated && activeTable?.id === sampleTable.id;
  if (!isSample && !extra) return null;
  return (
    <aside className="preview-bar" aria-label={isSample ? "Bảng mẫu" : "Xem thử trạng thái"}>
      {isSample ? <p>Đang mở Bảng mẫu: các bài có sẵn là dữ liệu minh hoạ, nhãn gán tay, chưa phải kết quả kiểm tra thật.</p> : null}
      {extra}
    </aside>
  );
}
