"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { TITLE_COLUMN_ID } from "@/lib/columns";
import type { InfoKey, Paper, PaperInfo, TableColumn } from "@/lib/types";

type Props = {
  paper: Paper;
  columns: TableColumn[];
  confirmed: boolean;
  register: (element: HTMLElement | null) => void;
  onChange: (info: PaperInfo) => void;
  onConfirm: () => void;
  onNext: () => void;
  onReopen: () => void;
};

// Thông tin bài không có câu trích nên duyệt gộp một lần, nhưng vẫn phải sinh viên xác nhận mới lưu được.
export function InfoCard({ paper, columns, confirmed, register, onChange, onConfirm, onNext, onReopen }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PaperInfo>(paper.info);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const id = useId();

  const changed = columns.some((column) => column.infoKey && paper.info[column.infoKey] !== paper.suggested_info[column.infoKey]);

  function startEditing() {
    setDraft(paper.info);
    setError(null);
    setEditing(true);
  }

  function stopEditing() {
    setEditing(false);
    cardRef.current?.focus({ preventScroll: true });
  }

  function save(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.title.trim()) {
      setError("Tên bài không được để trống.");
      return;
    }
    const next = { ...draft };
    (Object.keys(next) as InfoKey[]).forEach((key) => {
      const value = next[key]?.trim();
      // Để trống một trường là chưa điền, không ghi chuỗi rỗng vào bảng.
      if (value) next[key] = value;
      else if (key !== "title") delete next[key];
    });
    onChange(next);
    stopEditing();
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>) {
    if (editing || event.repeat || event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      if (confirmed) onNext();
      else onConfirm();
    } else if (event.key.toLowerCase() === "e") {
      event.preventDefault();
      startEditing();
    }
  }

  function handleFieldKey(event: KeyboardEvent<HTMLFormElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
    }
  }

  return (
    <article
      ref={(element) => {
        cardRef.current = element;
        register(element);
      }}
      className={confirmed ? "review-card review-card--done" : "review-card"}
      tabIndex={0}
      aria-labelledby={`${id}-tieu-de`}
      aria-keyshortcuts="Enter E"
      onKeyDown={handleCardKey}
    >
      <header className="review-card__header">
        <h2 id={`${id}-tieu-de`}>Thông tin bài</h2>
      </header>

      {editing ? (
        <form className="review-card__edit info-card__form" onSubmit={save} onKeyDown={handleFieldKey} noValidate>
          {columns.map((column, index) => {
            const key = column.infoKey as InfoKey;
            const isTitle = column.id === TITLE_COLUMN_ID;
            return (
              <div key={column.id}>
                <label htmlFor={`${id}-${key}`}>{column.name}</label>
                <input
                  id={`${id}-${key}`}
                  name={key}
                  type="text"
                  autoComplete="off"
                  autoFocus={index === 0}
                  value={draft[key] ?? ""}
                  aria-invalid={isTitle && error ? true : undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, [key]: event.target.value });
                    setError(null);
                  }}
                />
              </div>
            );
          })}
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="review-card__footer">
            <button type="submit" className="button button--primary">
              Lưu phần sửa
            </button>
            <button type="button" className="button button--quiet" onClick={stopEditing}>
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="info-card__list">
            {columns.map((column) => {
              const value = column.infoKey ? paper.info[column.infoKey] : undefined;
              const isTitle = column.id === TITLE_COLUMN_ID;
              return (
                <div key={column.id}>
                  <dt>{column.name}</dt>
                  <dd
                    className={isTitle ? "source-text" : value ? undefined : "cell-muted"}
                    lang={isTitle ? paper.language_code : undefined}
                    translate="no"
                  >
                    {value || "chưa điền"}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="small-note">AI đọc ra những thông tin này. Chúng không kèm câu trích, hãy so với bài gốc trước khi xác nhận.</p>
          <footer className="review-card__footer">
            {confirmed ? (
              <>
                <p className="review-card__state">{changed ? "Bạn đã sửa thông tin bài" : "Bạn đã xác nhận thông tin bài"}</p>
                <button type="button" className="button button--quiet" onClick={startEditing}>
                  Sửa
                </button>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => {
                    onReopen();
                    cardRef.current?.focus({ preventScroll: true });
                  }}
                >
                  Duyệt lại
                </button>
              </>
            ) : (
              <>
                <button type="button" className="button button--confirm" onClick={onConfirm}>
                  Xác nhận
                </button>
                <button type="button" className="button button--quiet" onClick={startEditing}>
                  Sửa
                </button>
              </>
            )}
          </footer>
        </>
      )}
    </article>
  );
}
