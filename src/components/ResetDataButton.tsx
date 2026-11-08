"use client";

import { useStore } from "@/lib/store";

// Bản xem thử giữ dữ liệu trong trình duyệt; nút này đưa về dữ liệu mẫu ban đầu.
export function ResetDataButton() {
  const { resetData } = useStore();
  return (
    <button
      type="button"
      className="link-button preview-reset"
      onClick={() => {
        if (window.confirm("Xoá mọi bảng, định dạng, ghi chú và nhãn đã lưu trên trình duyệt này, quay về dữ liệu mẫu?")) resetData();
      }}
    >
      Đặt lại dữ liệu mẫu
    </button>
  );
}
