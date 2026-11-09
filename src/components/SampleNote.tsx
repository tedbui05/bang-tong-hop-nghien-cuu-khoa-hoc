"use client";

import { sampleTable } from "@/lib/sample-data";
import { useStore } from "@/lib/store";

// Chỉ Bảng mẫu mới là dữ liệu minh hoạ gán tay. Bảng của sinh viên dùng nhãn do code kiểm tra thật,
// nên không được ghi là "bản xem thử" ở đó.
export function SampleNote() {
  const { activeTable } = useStore();
  if (activeTable?.id !== sampleTable.id) return null;
  return <p>Đang mở Bảng mẫu: dữ liệu minh hoạ, nhãn gán tay, chưa phải kết quả kiểm tra thật.</p>;
}
