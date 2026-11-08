"use client";

import { useRef, useState, type ReactNode } from "react";
import { cellText, isInfoEdited, TITLE_COLUMN_ID } from "@/lib/columns";
import { getLabelKey, getReviewReason, isCellEdited, type ReviewCell, type SavedPaper, type TableColumn } from "@/lib/types";
import { useStore } from "@/lib/store";
import { TAG_COLORS, type TagColorKey } from "@/lib/palette";
import type { TableTag } from "@/lib/types";
import { HighlightText, useTextSelection } from "./HighlightText";
import { MarkdownView } from "./MarkdownView";
import { StatusBadge } from "./StatusBadge";

export type EvidenceSelection = { paper: SavedPaper; cell: ReviewCell | undefined; column: TableColumn; count: number };

// Khung bằng chứng: chỉ hiện khi đang chọn ô. Máy tính mở bên phải, điện thoại trượt lên từ dưới.
type PanelProps = { selection: EvidenceSelection; tags: TableTag[]; formatBar: ReactNode; onClose: () => void };

export function EvidencePanel({ selection, tags, formatBar, onClose }: PanelProps) {
  const { paper, column, count } = selection;
  return (
    <aside className="evidence-panel" aria-label={`Bằng chứng của ô ${column.name}`} tabIndex={0}>
      {formatBar}
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
      <TagSection paperId={paper.id} paperTags={paper.tags ?? []} tags={tags} />
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
  const { addHighlight, removeHighlight, clearHighlights, editSavedCell } = useStore();
  const box = useRef<HTMLDivElement | null>(null);
  const picked = useTextSelection(box);
  const target = { paperId: paper.id, columnId: column.id };
  const ranges = paper.highlights?.[column.id] ?? [];

  if (column.kind === "note") return <NoteEditor key={paper.note ?? ""} source={paper.note ?? ""} onSave={(value) => editSavedCell(paper.id, column, value)} />;
  if (column.kind === "tags") return <p className="evidence-panel__note">Chọn nhãn cho bài ở phần “Nhãn của bài” bên dưới.</p>;

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
    <div ref={box}>
      <div className="evidence-panel__status">
        <StatusBadge label={label} />
      </div>
      <div className="highlight-tools" role="group" aria-label="Tô sáng đoạn chữ">
        <button
          type="button"
          className="button button--quiet highlight-tools__add"
          disabled={!picked}
          // Giữ nguyên đoạn đang bôi đen khi bấm nút.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!picked) return;
            addHighlight(target, picked);
            window.getSelection()?.removeAllRanges();
          }}
        >
          <span className="highlight-tools__mark" aria-hidden="true" /> Tô sáng đoạn đã chọn
        </button>
        {ranges.length > 0 ? (
          <button type="button" className="link-button highlight-tools__clear" onClick={() => clearHighlights(target)}>
            Bỏ hết tô sáng
          </button>
        ) : null}
      </div>
      {!picked ? <p className="evidence-panel__hint">Bôi đen một đoạn trong nội dung hoặc câu trích để tô sáng như bút dạ quang.</p> : null}
      <Section title="Nội dung đầy đủ">
        <HighlightText
          field="value"
          text={cell.value_vi}
          ranges={ranges}
          className={label === "not_found" && !edited ? "evidence-panel__value cell-muted" : "evidence-panel__value"}
          onRemove={(range) => removeHighlight(target, range)}
        />
        {edited ? (
          <p className="evidence-panel__note">
            <span className="sheet-edited">đã sửa</span> AI đề xuất ban đầu: {cell.suggested_value}
          </p>
        ) : null}
      </Section>

      {cell.quote_original ? (
        <Section title="Câu trích gốc">
          <HighlightText
            as="blockquote"
            field="quote"
            text={cell.quote_original}
            ranges={ranges}
            className="source-text evidence-panel__quote"
            lang={paper.language_code}
            onRemove={(range) => removeHighlight(target, range)}
          />
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
    </div>
  );
}

function NoteEditor({ source, onSave }: { source: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source);
  return (
    <Section title="Ghi chú của bạn">
      {editing ? (
        <form
          className="note-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft.replace(/\s+$/, ""));
            setEditing(false);
          }}
        >
          <label htmlFor="sua-ghi-chu" className="visually-hidden">
            Ghi chú, viết bằng Markdown
          </label>
          <textarea
            id="sua-ghi-chu"
            name="ghi-chu"
            rows={6}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setDraft(source);
                setEditing(false);
              }
            }}
          />
          <p className="evidence-panel__note">**đậm**, *nghiêng*, - gạch đầu dòng, [chữ](https://…)</p>
          <div className="note-editor__actions">
            <button type="submit" className="button button--primary">
              Lưu ghi chú
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                setDraft(source);
                setEditing(false);
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <>
          {source.trim() ? <MarkdownView source={source} /> : <p className="evidence-panel__value cell-muted">Chưa có ghi chú.</p>}
          <button type="button" className="button button--secondary note-editor__open" onClick={() => setEditing(true)}>
            {source.trim() ? "Sửa ghi chú" : "Viết ghi chú"}
          </button>
          <p className="evidence-panel__note">AI không bao giờ điền vào cột này.</p>
        </>
      )}
    </Section>
  );
}

function TagSection({ paperId, paperTags, tags }: { paperId: string; paperTags: string[]; tags: TableTag[] }) {
  const { toggleTag, createTag, deleteTag } = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColorKey>("1");
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="evidence-panel__section tag-section" aria-labelledby="nhan-cua-bai">
      <h3 id="nhan-cua-bai">Nhãn của bài</h3>
      {tags.length > 0 ? (
        <ul className="tag-section__list">
          {tags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                className={`sheet-tag sheet-tag--${tag.color} tag-section__toggle`}
                aria-pressed={paperTags.includes(tag.id)}
                onClick={() => toggleTag(paperId, tag.id)}
              >
                {paperTags.includes(tag.id) ? "✓ " : ""}
                {tag.name}
              </button>
              <button
                type="button"
                className="tag-section__delete"
                aria-label={`Xoá nhãn ${tag.name} khỏi bảng`}
                title="Xoá nhãn khỏi bảng"
                onClick={() => {
                  if (window.confirm(`Xoá nhãn “${tag.name}” khỏi mọi bài trong bảng?`)) deleteTag(tag.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="evidence-panel__note">Chưa có nhãn nào. Tạo nhãn như “quan trọng”, “đọc lại”, “dùng cho chương 2”.</p>
      )}
      <form
        className="tag-section__form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            setError("Hãy nhập tên nhãn.");
            return;
          }
          if (tags.some((tag) => tag.name.toLocaleLowerCase("vi") === trimmed.toLocaleLowerCase("vi"))) {
            setError(`Đã có nhãn “${trimmed}”.`);
            return;
          }
          const id = createTag(trimmed, color);
          toggleTag(paperId, id);
          setName("");
          setError(null);
        }}
        noValidate
      >
        <label htmlFor="nhan-moi" className="visually-hidden">
          Tên nhãn mới
        </label>
        <input
          id="nhan-moi"
          name="nhan-moi"
          type="text"
          autoComplete="off"
          placeholder="Nhãn mới…"
          value={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "loi-nhan" : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        <div className="tag-section__colors" role="radiogroup" aria-label="Màu của nhãn">
          {TAG_COLORS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={color === item.key}
              aria-label={item.name}
              title={item.name}
              className={`tag-section__color sheet-tag--${item.key}`}
              onClick={() => setColor(item.key)}
            />
          ))}
        </div>
        <button type="submit" className="button button--secondary">
          Thêm nhãn
        </button>
      </form>
      {error ? (
        <p id="loi-nhan" className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
