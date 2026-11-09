"use client";

import { sampleTable } from "@/lib/sample-data";
import { useStore } from "@/lib/store";

// Chỉ các bài có sẵn trong Bảng mẫu mới là dữ liệu minh hoạ gán tay. Bảng của sinh viên, và bài sinh viên tự tải
// vào Bảng mẫu, dùng nhãn do code kiểm tra thật. Chờ đọc xong dữ liệu đã lưu mới hiện, vì lúc mới mở trang
// bảng đang chọn luôn là Bảng mẫu.
export function SampleNote() {
  const { activeTable, hydrated } = useStore();
  if (!hydrated || activeTable?.id !== sampleTable.id) return null;
  return <p>Đang mở Bảng mẫu: các bài có sẵn là dữ liệu minh hoạ, nhãn gán tay, chưa phải kết quả kiểm tra thật.</p>;
}
