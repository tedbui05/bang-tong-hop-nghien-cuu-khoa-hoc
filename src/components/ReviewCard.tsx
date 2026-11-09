"use client";

import { useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { CITED_SOURCE_WARNING } from "@/lib/cited-source";
import type { PdfPage } from "@/lib/pdf-read";
import { getLabelKey, getReviewReason, type Paper, type ReviewCell } from "@/lib/types";
import { EvidenceChip, PageMatchButtons, type EvidencePreviewApi } from "./EvidencePreview";
import { StatusBadge } from "./StatusBadge";

type Props = {
  cell: ReviewCell;
  columnName: string;
  // Câu hỏi gợi ý kiểm tra của cột.
  question: string;
  paper: Paper;
  // Chữ của trang (khi không còn file PDF) và khung xem trước PDF dùng chung của trang duyệt.
  pages: PdfPage[] | null;
  preview: EvidencePreviewApi;
  // Ô đang hiện bằng chứng ở khung bên phải.
  selected: boolean;
  register: (element: HTMLElement | null) => void;
  onSelect: () => void;
  // Điện thoại: mở khung chữ của trang.
  onShowPage: () => void;
  onConfirm: () => void;
  onNext: () => void;
  onChange: (change: Partial<Pick<ReviewCell, "value_vi" | "review">>) => void;
};

export function ReviewCard({ cell, columnName, question, paper, pages, preview, selected, register, onSelect, onShowPage, onConfirm, onNext, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cell.value_vi);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  // Ô "cần kiểm tra": lần Enter đầu chỉ nhắc đối chiếu, lần sau mới xác nhận.
  const [armed, setArmed] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const id = useId();

  const label = getLabelKey(cell);
  const flagged = label === "needs_review";
  const pending = cell.review === "pending";
  const isChanged = cell.value_vi !== cell.suggested_value;

  function startEditing() {
    setDraft(cell.value_vi);
    setError(null);
    setEditing(true);
  }

  function stopEditing() {
    setEditing(false);
    cardRef.current?.focus({ preventScroll: true });
  }

  function saveEdit() {
    const value = draft.trim();
    if (!value) {
      textareaRef.current?.focus();
      setError('Nội dung không được để trống. Bài không có thông tin thì ghi “không tìm thấy”.');
      return;
    }
    onChange({ value_vi: value, review: value === cell.suggested_value ? "confirmed" : "edited" });
    stopEditing();
  }

  // Phím tắt chỉ chạy khi đang chọn thẻ, nên không vướng khi đang gõ chữ.
  function handleCardKey(event: KeyboardEvent<HTMLElement>) {
    if (editing || event.repeat || event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      if (!pending) {
        onNext();
      } else if (flagged && !armed) {
        setArmed(true);
      } else {
        setArmed(false);
        onConfirm();
      }
    } else if (event.key.toLowerCase() === "e") {
      event.preventDefault();
      startEditing();
    }
  }

  function handleTextareaKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      saveEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
    }
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setArmed(false);
  }

  const className = [
    "review-card",
    !pending ? "review-card--done" : "",
    flagged && pending ? "review-card--flagged" : "",
    selected ? "review-card--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      ref={(element) => {
        cardRef.current = element;
        register(element);
      }}
      className={className}
      tabIndex={0}
      aria-labelledby={`${id}-cot`}
      aria-keyshortcuts="Enter E"
      onKeyDown={handleCardKey}
      onBlur={handleBlur}
      onFocus={onSelect}
      onClick={onSelect}
    >
      <header className="review-card__header">
        <h2 id={`${id}-cot`}>{columnName}</h2>
        <StatusBadge label={label} />
      </header>

      {editing ? (
        <div className="review-card__edit">
          <label htmlFor={`${id}-sua`}>Sửa nội dung</label>
          <textarea
            ref={textareaRef}
            id={`${id}-sua`}
            autoComplete="off"
            name="noi-dung"
            rows={4}
            value={draft}
            autoFocus
            aria-invalid={error ? true : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.target.setSelectionRange(event.target.value.length, event.target.value.length)}
            onKeyDown={handleTextareaKey}
          />
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className={label === "not_found" && !isChanged ? "review-card__value cell-muted" : "review-card__value"}>
          {cell.value_vi}
        </p>
      )}

      {isChanged && !editing ? <p className="small-note">AI đề xuất ban đầu: {cell.suggested_value}</p> : null}

      {cell.quote_original ? (
        <div className="evidence">
          <blockquote className="source-text" lang={paper.language_code} translate="no">
            {cell.quote_original}
          </blockquote>

          <div className="evidence__meta">
            <EvidenceChip target={{ paper, cell, columnName, pages }} preview={preview} />
            {flagged ? <span>AI ghi trang {cell.ai_page ?? cell.page}, chưa xác định được vị trí</span> : null}
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

          {showTranslation ? <p className="evidence__translation">{cell.quote_vi}</p> : null}

          {cell.cites_other_source ? (
            <p className="cite-warning" role="note">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M8 2.5l6 11H2z M8 6.5v3.2 M8 11.8v.1" />
              </svg>
              <span>{CITED_SOURCE_WARNING}.</span>
            </p>
          ) : null}

          {pending ? (
            <p className="review-question">
              <span className="review-question__lead">Tự hỏi trước khi xác nhận:</span> {question}
            </p>
          ) : null}

          <button type="button" className="link-button review-card__page-button" onClick={onShowPage}>
            Xem đoạn gốc trong trang {flagged ? cell.ai_page ?? cell.page : cell.page}
          </button>
          <PageMatchButtons target={{ paper, cell, columnName, pages }} preview={preview} />

          {label === "page_corrected" ? (
            <p className="small-note">
              AI ghi trang {cell.ai_page}, câu này nằm ở trang {cell.page} nên app đã sửa lại.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="small-note">Bài không có thông tin cho cột này.</p>
      )}

      {flagged && pending ? (
        <p className="flag-reason">{getReviewReason(cell)}</p>
      ) : null}

      <p className="flag-confirm" role="status">
        {armed ? "Bạn đã đối chiếu với bài gốc chưa? Bấm Enter lần nữa để xác nhận." : ""}
      </p>

      <footer className="review-card__footer">
        {editing ? (
          <>
            <button type="button" className="button button--primary" onClick={saveEdit}>
              Lưu phần sửa
            </button>
            <button type="button" className="button button--quiet" onClick={stopEditing}>
              Hủy
            </button>
            <span className="key-hint">
              <kbd>Ctrl/⌘ + Enter</kbd> lưu <kbd>Esc</kbd> hủy
            </span>
          </>
        ) : pending ? (
          <>
            <button type="button" className="button button--confirm" onClick={onConfirm}>
              Xác nhận
            </button>
            <button type="button" className="button button--quiet" onClick={startEditing}>
              Sửa
            </button>
          </>
        ) : (
          <>
            <p className="review-card__state">
              {cell.review === "edited" ? "Bạn đã sửa ô này" : "Bạn đã xác nhận ô này"}
            </p>
            <button type="button" className="button button--quiet" onClick={startEditing}>
              Sửa
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                onChange({ review: "pending" });
                cardRef.current?.focus({ preventScroll: true });
              }}
            >
              Duyệt lại
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
