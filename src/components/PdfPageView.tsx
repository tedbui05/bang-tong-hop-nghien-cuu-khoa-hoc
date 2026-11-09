"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPdfPage } from "@/lib/pdf-view";
import type { TextRange } from "@/lib/types";

type Props = {
  doc: PDFDocumentProxy;
  paperId: string;
  page: number;
  scale: number;
  ranges: TextRange[];
  // Báo đoạn tô đầu tiên (nếu có) khi vẽ xong, để khung chứa tự cuộn tới.
  onRendered?: (firstMark: HTMLElement | null) => void;
  // Kích thước dự kiến, để giữ chỗ khi chưa vẽ xong và không làm khung nhảy.
  placeholder?: { width: number; height: number };
};

// Một trang PDF: ảnh trang, lớp chữ trong suốt và câu trích tô vàng.
export function PdfPageView({ doc, paperId, page, scale, ranges, onRendered, placeholder }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const callback = useRef(onRendered);
  useEffect(() => {
    callback.current = onRendered;
  });
  const rangeKey = JSON.stringify(ranges);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    let current = true;
    const own = JSON.parse(rangeKey) as TextRange[];
    renderPdfPage(element, paperId, doc, page, scale, own, () => current)
      .then((result) => {
        if (result && current) callback.current?.(result.marks[0] ?? null);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [doc, paperId, page, scale, rangeKey]);

  if (failed) return <p className="pdf-page__error">Chưa vẽ được trang {page}. Hãy đóng khung rồi mở lại.</p>;
  return (
    <div
      ref={box}
      className="pdf-page"
      style={placeholder ? { width: placeholder.width * scale, height: placeholder.height * scale } : undefined}
      aria-label={`Trang ${page} của file PDF`}
      role="group"
    />
  );
}
