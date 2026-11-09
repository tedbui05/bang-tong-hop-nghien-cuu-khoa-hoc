"use client";

import { useEffect, type KeyboardEvent } from "react";
import { evidenceView } from "@/lib/evidence";
import type { PdfPage } from "@/lib/pdf-read";
import type { ReviewCell } from "@/lib/types";
import { PageTextView } from "./PageTextView";

type Props = {
  cell: ReviewCell;
  columnName: string;
  pages: PdfPage[] | null;
  lang: string;
  // Điện thoại: khung đang mở (trượt lên từ dưới). Máy tính luôn hiện ở bên phải.
  open: boolean;
  onClose: () => void;
};

function isSmall() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
}

// Khung bên phải trang duyệt: chữ của trang có câu trích, câu trích được tô vàng.
export function EvidenceSide({ cell, columnName, pages, lang, open, onClose }: Props) {
  const view = evidenceView(cell);

  // Điện thoại: khoá cuộn trang phía sau khi khung đang mở.
  useEffect(() => {
    if (!open) return;
    const small = window.matchMedia("(max-width: 900px)").matches;
    if (!small) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <aside
      className={`review-side${open ? " review-side--open" : ""}`}
      aria-label={`Chữ của trang có câu trích, cột ${columnName}`}
      onKeyDown={handleKey}
    >
      <header className="review-side__head">
        <div>
          <p className="review-side__eyebrow">Đoạn gốc trong bài</p>
          <h2>{columnName}</h2>
        </div>
        <button type="button" className="evidence-panel__close review-side__close" aria-label="Đóng khung chữ của trang" onClick={onClose}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>Đóng</span>
        </button>
      </header>
      {view.note ? (
        <p className={view.label === "needs_review" ? "review-side__note review-side__note--warn" : "review-side__note"} role="status">
          {view.note}
        </p>
      ) : null}
      {view.page === null ? (
        <p className="review-side__empty">Bài không có thông tin cho cột này nên không có đoạn gốc để xem.</p>
      ) : !pages ? (
        <p className="review-side__empty">
          Chưa có chữ của bài này trong trình duyệt (bài mẫu hoặc dữ liệu đã bị xoá). Câu trích vẫn hiện ở thẻ bên trái.
        </p>
      ) : (
        <PageTextView pages={pages} page={view.page} ranges={view.ranges} lang={lang} visible={open || !isSmall()} />
      )}
    </aside>
  );
}
