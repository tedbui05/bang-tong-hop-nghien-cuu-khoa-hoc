"use client";

import { useState, type ReactNode } from "react";
import { cellText, isInfoEdited, TITLE_COLUMN_ID } from "@/lib/columns";
import { getLabelKey, getReviewReason, isCellEdited, type ReviewCell, type SavedPaper, type TableColumn } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export type EvidenceSelection = { paper: SavedPaper; cell: ReviewCell | undefined; column: TableColumn; count: number };

// Khung bằng chứng: chỉ hiện khi đang chọn ô. Máy tính mở bên phải, điện thoại trượt lên từ dưới.
export function EvidencePanel({ selection, onClose }: { selection: EvidenceSelection; onClose: () => void }) {
  const { paper, column, count } = selection;
  return (
    <aside className="evidence-panel" aria-label={`Bằng chứng của ô ${column.name}`} tabIndex={0}>
      <header className="evidence-panel__head">
        <div className="evidence-panel__heading">
          <h2>{column.name}</h2>
          {count > 1 ? <span className="evidence-panel__count">Đã chọn {count} ô</span> : null}
        </div>
        <button type="button" className="button button--quiet evidence-panel__close" onClick={onClose}>
          Đóng
        </button>
      </header>
      {column.id !== TITLE_COLUMN_ID ? (
        <p className="source-text evidence-panel__paper" lang={paper.language_code} translate="no">
          {paper.info.title}
        </p>
      ) : null}
      <EvidenceContent key={`${paper.id}-${column.id}`} selection={selection} />
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="evidence-panel__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function EvidenceContent({ selection }: { selection: EvidenceSelection }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const { paper, cell, column } = selection;

  if (column.kind === "info") {
    const value = cellText(paper, column);
    return (
      <>
        <Section title="Nội dung">
          {column.id === TITLE_COLUMN_ID ? (
            <p className="source-text evidence-panel__value" lang={paper.language_code} translate="no">
              {value}
            </p>
          ) : (
            <p className={value ? "evidence-panel__value" : "evidence-panel__value cell-muted"} translate="no">
              {value || "chưa điền"}
            </p>
          )}
          {isInfoEdited(paper, column) && column.infoKey ? (
            <p className="evidence-panel__note">
              <span className="sheet-edited">đã sửa</span> AI đề xuất ban đầu: {paper.suggested_info[column.infoKey]}
            </p>
          ) : null}
        </Section>
        <p className="evidence-panel__note">Đây là thông tin bài, được xác nhận ở bước duyệt nên không kèm câu trích.</p>
      </>
    );
  }

  if (!cell) {
    return (
      <>
        <Section title="Nội dung">
          <p className="evidence-panel__value cell-muted">chưa điền</p>
        </Section>
        <button type="button" className="button button--secondary" disabled>
          Điền ô này bằng AI
        </button>
        <p className="evidence-panel__note">Nút này sẽ dùng được khi đã nối AI. Bạn vẫn có thể bấm đúp vào ô để tự gõ.</p>
      </>
    );
  }

  const label = getLabelKey(cell);
  const flagged = label === "needs_review";
  const edited = isCellEdited(cell);

  return (
    <>
      <div className="evidence-panel__status">
        <StatusBadge label={label} />
      </div>
      <Section title="Nội dung đầy đủ">
        <p className={label === "not_found" && !edited ? "evidence-panel__value cell-muted" : "evidence-panel__value"}>{cell.value_vi}</p>
        {edited ? (
          <p className="evidence-panel__note">
            <span className="sheet-edited">đã sửa</span> AI đề xuất ban đầu: {cell.suggested_value}
          </p>
        ) : null}
      </Section>

      {cell.quote_original ? (
        <Section title="Câu trích gốc">
          <blockquote className="source-text evidence-panel__quote" lang={paper.language_code} translate="no">
            {cell.quote_original}
          </blockquote>
          <p className="evidence-panel__note">
            {flagged ? `AI ghi trang ${cell.page}, chưa xác định được` : `Trang ${cell.page} của file PDF`}
          </p>
          {label === "page_corrected" ? (
            <p className="evidence-panel__note">
              AI ghi trang {cell.ai_page}, câu này nằm ở trang {cell.page} nên app đã sửa lại.
            </p>
          ) : null}
          {flagged ? <p className="evidence-panel__reason">{getReviewReason(cell)}</p> : null}
          {cell.quote_vi ? (
            <>
              <button type="button" className="link-button evidence-panel__toggle" aria-expanded={showTranslation} onClick={() => setShowTranslation(!showTranslation)}>
                {showTranslation ? "Ẩn bản dịch" : "Xem bản dịch"}
              </button>
              {showTranslation ? <p className="evidence-panel__translation">{cell.quote_vi}</p> : null}
            </>
          ) : null}
        </Section>
      ) : (
        <p className="evidence-panel__note">
          {edited || cell.status === "manual" ? "Nội dung do bạn điền, không có câu trích." : "Bài không có thông tin cho cột này nên không có câu trích."}
        </p>
      )}
    </>
  );
}
