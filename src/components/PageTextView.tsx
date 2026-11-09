"use client";

import { useEffect, useRef } from "react";
import { splitByRanges } from "@/lib/evidence";
import type { PdfPage } from "@/lib/pdf-read";
import type { TextRange } from "@/lib/types";

// visible: khung đang hiện. Khung ẩn (điện thoại, chưa mở) thì chưa cuộn được, nên cuộn lại khi hiện ra.
type Props = { pages: PdfPage[]; page: number; ranges: TextRange[]; lang: string; visible?: boolean };

// Chữ của trang như đọc từ PDF, câu trích được tô vàng, tự cuộn đến chỗ tô.
// Câu vắt sang trang sau thì hiện thêm trang sau.
export function PageTextView({ pages, page, ranges, lang, visible = true }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const shown = [page, ...ranges.filter((range) => range.page !== page).map((range) => range.page)].filter(
    (value, index, list) => list.indexOf(value) === index,
  );

  // Chỉ cuộn khung chữ, không cuộn cả trang. Chỉ cuộn lại khi đổi trang hoặc đổi đoạn tô thật sự.
  const rangeKey = JSON.stringify(ranges);
  useEffect(() => {
    const container = box.current;
    if (!container || !visible) return;
    const mark = container.querySelector("mark");
    if (!mark) {
      container.scrollTop = 0;
      return;
    }
    const top = mark.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTop = Math.max(0, top - container.clientHeight / 3);
  }, [page, rangeKey, visible]);

  return (
    <div ref={box} className="page-text">
      {shown.map((number) => {
        const text = pages.find((item) => item.page === number)?.text;
        return (
          <section key={number} className="page-text__page" aria-label={`Trang ${number} của file PDF`}>
            <p className="page-text__number">Trang {number} của file PDF</p>
            {text === undefined ? (
              <p className="small-note">Không có chữ của trang này.</p>
            ) : (
              <p className="page-text__body source-text" lang={lang} translate="no">
                {splitByRanges(text, number, ranges).map((part, index) =>
                  part.marked ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>,
                )}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
