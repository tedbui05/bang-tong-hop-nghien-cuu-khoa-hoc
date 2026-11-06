"use client";

import { useState } from "react";
import { cellText, isInfoEdited, TITLE_COLUMN_ID } from "@/lib/columns";
import { getLabelKey, getReviewReason, isCellEdited, type ReviewCell, type SavedPaper, type TableColumn } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

type Props = {
  selection: { paper: SavedPaper; cell: ReviewCell | undefined; column: TableColumn; count: number } | null;
  onClose: () => void;
};

// Nằm ở vị trí thanh công thức: hiện đầy đủ ô đang chọn cùng bằng chứng của ô đó.
export function EvidenceBar({ selection, onClose }: Props) {
  return (
    <section
      className={`evidence-bar${selection ? " evidence-bar--open" : ""}`}
      aria-label="Bằng chứng của ô đang chọn"
      aria-live="polite"
      tabIndex={selection ? 0 : undefined}
    >
      {selection ? (
        <EvidenceContent
          key={`${selection.paper.id}-${selection.column.id}`}
          selection={selection}
          onClose={onClose}
        />
      ) : (
        <p className="evidence-bar__hint">Chọn một ô để xem nội dung đầy đủ và câu trích gốc.</p>
      )}
    </section>
  );
}

function EvidenceContent({ selection, onClose }: { selection: NonNullable<Props["selection"]>; onClose: () => void }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const { paper, cell, column, count } = selection;
  const countNote = count > 1 ? <span className="evidence-bar__count">Đã chọn {count} ô</span> : null;
  const closeButton = (
    <button type="button" className="link-button evidence-bar__close" onClick={onClose}>
      Đóng
    </button>
  );

  const head = (
    <div className="evidence-bar__head">
      <h2>{column.name}</h2>
      {column.id !== TITLE_COLUMN_ID ? (
        <span className="evidence-bar__cite" translate="no">
          {paper.info.title}
        </span>
      ) : null}
      {countNote}
      {closeButton}
    </div>
  );

  if (column.kind === "info") {
    const value = cellText(paper, column);
    return (
      <div className="evidence-bar__grid">
        <div>
          {head}
          {column.id === TITLE_COLUMN_ID ? (
            <p className="source-text evidence-bar__value" lang={paper.language_code} translate="no">
              {value}
            </p>
          ) : (
            <p className={value ? "evidence-bar__value" : "evidence-bar__value cell-muted"} translate="no">
              {value || "chưa điền"}
            </p>
          )}
          {isInfoEdited(paper, column) && column.infoKey ? (
            <p className="evidence-bar__original">
              <span className="sheet-edited">đã sửa</span> AI đề xuất ban đầu: {paper.suggested_info[column.infoKey]}
            </p>
          ) : null}
        </div>
        <p className="evidence-bar__meta">Đây là thông tin bài, được xác nhận ở bước duyệt nên không kèm câu trích.</p>
      </div>
    );
  }

  if (!cell) {
    return (
      <div className="evidence-bar__grid">
        <div>
          {head}
          <p className="evidence-bar__value cell-muted">chưa điền</p>
        </div>
        <div>
          <button type="button" className="button button--secondary" disabled>
            Điền ô này bằng AI
          </button>
          <p className="evidence-bar__meta">Nút này sẽ dùng được khi đã nối AI. Bạn vẫn có thể bấm đúp vào ô để tự gõ.</p>
        </div>
      </div>
    );
  }

  const label = getLabelKey(cell);
  const flagged = label === "needs_review";
  const edited = isCellEdited(cell);

  return (
    <div className="evidence-bar__grid">
      <div>
        {head}
        <p className={label === "not_found" && !edited ? "evidence-bar__value cell-muted" : "evidence-bar__value"}>
          {cell.value_vi}
        </p>
        {edited ? (
          <p className="evidence-bar__original">
            <span className="sheet-edited">đã sửa</span> AI đề xuất ban đầu: {cell.suggested_value}
          </p>
        ) : null}
      </div>

      <div>
        <div className="evidence-bar__status">
          <StatusBadge label={label} />
        </div>
        {cell.quote_original ? (
          <>
            <blockquote className="source-text evidence-bar__quote" lang={paper.language_code} translate="no">
              {cell.quote_original}
            </blockquote>
            <div className="evidence-bar__meta">
              <span>{flagged ? `AI ghi trang ${cell.page}, chưa xác định được` : `Trang ${cell.page} của file PDF`}</span>
              {cell.quote_vi ? (
                <button
                  type="button"
                  className="link-button"
                  aria-expanded={showTranslation}
                  onClick={() => setShowTranslation(!showTranslation)}
                >
                  {showTranslation ? "Ẩn bản dịch" : "Xem bản dịch"}
                </button>
              ) : null}
            </div>
            {showTranslation ? <p className="evidence-bar__translation">{cell.quote_vi}</p> : null}
            {label === "page_corrected" ? (
              <p className="evidence-bar__meta">
                AI ghi trang {cell.ai_page}, câu này nằm ở trang {cell.page} nên app đã sửa lại.
              </p>
            ) : null}
            {flagged ? <p className="evidence-bar__reason">{getReviewReason(cell)}</p> : null}
          </>
        ) : (
          <p className="evidence-bar__meta">
            {edited ? "Nội dung do bạn điền, không có câu trích." : "Bài không có thông tin cho cột này nên không có câu trích."}
          </p>
        )}
      </div>
    </div>
  );
}
