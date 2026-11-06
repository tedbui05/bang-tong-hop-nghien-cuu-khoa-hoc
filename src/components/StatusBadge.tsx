import type { ReactNode } from "react";
import type { LabelKey } from "@/lib/types";

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const LABELS: Record<LabelKey, { text: string; icon: ReactNode }> = {
  verified: { text: "đã khớp", icon: svg(<path d="M3 8.5l3.2 3.2L13 4.8" />) },
  page_corrected: {
    text: "đã sửa số trang",
    icon: svg(<path d="M2.8 13.2l.7-2.9 7.3-7.3a1.5 1.5 0 012.2 2.2l-7.3 7.3-2.9.7z" />),
  },
  needs_review: {
    text: "cần kiểm tra",
    icon: svg(
      <>
        <path d="M8 2.2l6.3 11.3H1.7L8 2.2z" />
        <path d="M8 6.6v3.1M8 11.7v.1" />
      </>,
    ),
  },
  not_found: {
    text: "không tìm thấy",
    icon: svg(
      <>
        <circle cx="8" cy="8" r="5.8" />
        <path d="M5 8h6" />
      </>,
    ),
  },
  manual: {
    text: "do bạn điền",
    icon: svg(<path d="M2.8 13.2l.7-2.9 7.3-7.3a1.5 1.5 0 012.2 2.2l-7.3 7.3-2.9.7z" />),
  },
};

export function StatusBadge({ label }: { label: LabelKey }) {
  return (
    <span className={`badge badge--${label}`}>
      {LABELS[label].icon}
      {LABELS[label].text}
    </span>
  );
}
