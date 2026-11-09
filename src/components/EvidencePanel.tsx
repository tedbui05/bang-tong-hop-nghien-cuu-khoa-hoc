"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cellText, isInfoEdited, TITLE_COLUMN_ID } from "@/lib/columns";
import { TAG_COLORS, type TagColorKey } from "@/lib/palette";
import { STATUS_LABELS } from "@/lib/sheet";
import { useStore, type CellTarget } from "@/lib/store";
import { CITED_SOURCE_WARNING } from "@/lib/cited-source";
import { filledByText, getLabelKey, getReviewReason, isCellEdited, type Highlight, type LabelKey, type ReviewCell, type SavedPaper, type TableColumn, type TableTag } from "@/lib/types";
import { EvidenceChip, PageMatchButtons, type EvidencePreviewApi } from "./EvidencePreview";
import { HighlightText, useTextSelection } from "./HighlightText";
import { MarkdownView } from "./MarkdownView";
import { StatusIcon } from "./StatusBadge";

export type EvidenceSelection = { paper: SavedPaper; cell: ReviewCell | undefined; column: TableColumn; count: number };

type PanelProps = { selection: EvidenceSelection; tags: TableTag[]; formatBar: ReactNode; onClose: () => void; preview: EvidencePreviewApi };

// Khung bằng chứng, đọc từ trên xuống: đang xem ô nào, trạng thái, nội dung, bằng chứng, nhãn.
// Thanh định dạng dính ở đáy để luôn bấm được mà không chen vào phần đọc.
export function EvidencePanel({ selection, tags, formatBar, onClose, preview }: PanelProps) {
  const { paper, column, count } = selection;

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || (event.target as HTMLElement).closest("input, textarea, select")) return;
    event.preventDefault();
    onClose();
  }

  return (
    <aside className="evidence-panel" aria-label={`Chi tiết ô ${column.name}`} tabIndex={0} onKeyDown={handleKey}>
      <header className="evidence-panel__head">
        <div className="evidence-panel__heading">
          <p className="evidence-panel__eyebrow">
            {count > 1 ? <span className="evidence-panel__count">Đã chọn {count} ô</span> : "Ô đang chọn"}
          </p>
          <h2>{column.name}</h2>
          {column.id !== TITLE_COLUMN_ID ? (
            <p className="source-text evidence-panel__paper" lang={paper.language_code} translate="no" title={paper.info.title}>
              {paper.info.title}
            </p>
          ) : null}
        </div>
        <button type="button" className="evidence-panel__close" aria-label="Đóng khung chi tiết (Esc)" title="Đóng (Esc)" onClick={onClose}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>Đóng</span>
        </button>
      </header>

      <div className="evidence-panel__body">
        <EvidenceContent key={`${paper.id}-${column.id}`} selection={selection} preview={preview} />
        <TagSection paperId={paper.id} paperTags={paper.tags ?? []} tags={tags} />
      </div>

      <footer className="evidence-panel__footer">{formatBar}</footer>
    </aside>
  );
}

function Card({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`evidence-card ${className}`}>
      <div className="evidence-card__head">
        <h3>{title}</h3>
        {aside ? <div className="evidence-card__aside">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

// Dải trạng thái: nhãn kèm biểu tượng và một câu giải thích, để không phải dò tìm ở nhiều chỗ.
function StatusStrip({ label, children }: { label: LabelKey; children: ReactNode }) {
  return (
    <div className={`status-strip status-strip--${label}`} role="status">
      <span className="status-strip__label">
        <StatusIcon label={label} />
        {STATUS_LABELS[label].charAt(0).toUpperCase() + STATUS_LABELS[label].slice(1)}
      </span>
      <p>{children}</p>
    </div>
  );
}

function statusText(cell: ReviewCell, label: LabelKey): string {
  if (label === "verified") return `Câu trích có đúng ở trang ${cell.page} của file PDF.`;
  if (label === "page_corrected") return `AI ghi trang ${cell.ai_page}, câu này nằm ở trang ${cell.page} nên app đã sửa lại.`;
  if (label === "needs_review") return `${getReviewReason(cell)} AI ghi trang ${cell.ai_page ?? cell.page}.`;
  if (label === "manual") return "Nội dung do bạn tự điền, không có câu trích.";
  return "Bài không có thông tin cho cột này nên không có câu trích.";
}

function HighlightAction({
  field,
  picked,
  ranges,
  onAdd,
  onClear,
}: {
  field: Highlight["field"];
  picked: Highlight | null;
  ranges: Highlight[];
  onAdd: () => void;
  onClear: () => void;
}) {
  const own = ranges.filter((range) => range.field === field).length;
  if (picked?.field === field) {
    return (
      <button
        type="button"
        className="highlight-tools__add"
        // Giữ nguyên đoạn đang bôi đen khi bấm nút.
        onPointerDown={(event) => event.preventDefault()}
        onClick={onAdd}
      >
        <span className="highlight-tools__mark" aria-hidden="true" /> Tô sáng đoạn đã chọn
      </button>
    );
  }
  return own > 0 ? (
    <button type="button" className="link-button highlight-tools__clear" onClick={onClear}>
      Bỏ tô sáng ({own})
    </button>
  ) : null;
}

function EvidenceContent({ selection, preview }: { selection: EvidenceSelection; preview: EvidencePreviewApi }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const { paper, cell, column } = selection;
  const { addHighlight, removeHighlight, editSavedCell, updateHighlights } = useStore();
  const box = useRef<HTMLDivElement | null>(null);
  const picked = useTextSelection(box);
  const target: CellTarget = { paperId: paper.id, columnId: column.id };
  const ranges = paper.highlights?.[column.id] ?? [];

  if (column.kind === "note") {
    return <NoteEditor key={paper.note ?? ""} source={paper.note ?? ""} onSave={(value) => editSavedCell(paper.id, column, value)} />;
  }

  if (column.kind === "tags") {
    return <p className="evidence-panel__note evidence-panel__lead">Chọn hoặc tạo nhãn cho bài ở phần “Nhãn của bài” bên dưới.</p>;
  }

  if (column.kind === "info") {
    const value = cellText(paper, column);
    const isTitle = column.id === TITLE_COLUMN_ID;
    return (
      <>
        <Card title="Thông tin bài">
          <p
            className={`evidence-panel__value${isTitle ? " source-text" : ""}${value ? "" : " cell-muted"}`}
            lang={isTitle ? paper.language_code : undefined}
            translate="no"
          >
            {value || "chưa điền"}
          </p>
          {isInfoEdited(paper, column) && column.infoKey ? (
            <p className="evidence-panel__note">
              <span className="sheet-edited">đã sửa</span> AI đề xuất ban đầu: {paper.suggested_info[column.infoKey]}
            </p>
          ) : null}
        </Card>
        <p className="evidence-panel__note evidence-panel__lead">Thông tin bài được xác nhận ở bước duyệt nên không kèm câu trích.</p>
      </>
    );
  }

  if (!cell) {
    return (
      <Card title="Nội dung">
        <p className="evidence-panel__value cell-muted">chưa điền</p>
        <div className="evidence-card__actions">
          <button type="button" className="button button--secondary" disabled>
            Điền ô này bằng AI
          </button>
        </div>
        <p className="evidence-panel__note">Nút này sẽ dùng được khi đã nối AI. Bạn vẫn có thể bấm đúp vào ô để tự gõ.</p>
      </Card>
    );
  }

  const label = getLabelKey(cell);
  const edited = isCellEdited(cell);
  const addPicked = () => {
    if (!picked) return;
    addHighlight(target, picked);
    window.getSelection()?.removeAllRanges();
  };
  const clearField = (field: Highlight["field"]) => updateHighlights(target, ranges.filter((range) => range.field !== field));
  const action = (field: Highlight["field"]) => (
    <HighlightAction field={field} picked={picked} ranges={ranges} onAdd={addPicked} onClear={() => clearField(field)} />
  );

  return (
    <div ref={box} className="evidence-panel__stack">
      <StatusStrip label={label}>{statusText(cell, label)}</StatusStrip>

      {cell.cites_other_source ? (
        <p className="cite-warning" role="note">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M8 2.5l6 11H2z M8 6.5v3.2 M8 11.8v.1" />
          </svg>
          <span>{CITED_SOURCE_WARNING}.</span>
        </p>
      ) : null}

      {paper.filled_by && cell.status !== "manual" ? (
        <p className={paper.filled_by.fallback ? "evidence-panel__note filled-by--fallback" : "evidence-panel__note"}>
          {filledByText(paper.filled_by)}
        </p>
      ) : null}

      <Card title="Nội dung đầy đủ" aside={action("value")}>
        <HighlightText
          field="value"
          text={cell.value_vi}
          ranges={ranges}
          className={label === "not_found" && !edited ? "evidence-panel__value cell-muted" : "evidence-panel__value"}
          onRemove={(range) => removeHighlight(target, range)}
        />
        {edited ? (
          <details className="evidence-panel__original">
            <summary>
              <span className="sheet-edited">đã sửa</span> Xem đề xuất ban đầu của AI
            </summary>
            <p>{cell.suggested_value}</p>
          </details>
        ) : null}
      </Card>

      {cell.quote_original ? (
        <Card title="Câu trích gốc" aside={action("quote")} className="evidence-card--quote">
          <HighlightText
            as="blockquote"
            field="quote"
            text={cell.quote_original}
            ranges={ranges}
            className="source-text evidence-panel__quote"
            lang={paper.language_code}
            onRemove={(range) => removeHighlight(target, range)}
          />
          <div className="evidence-card__meta">
            <EvidenceChip target={{ paper, cell, columnName: column.name }} preview={preview} />
            {cell.quote_vi ? (
              <button type="button" className="link-button" aria-expanded={showTranslation} onClick={() => setShowTranslation(!showTranslation)}>
                {showTranslation ? "Ẩn bản dịch" : "Xem bản dịch"}
              </button>
            ) : null}
          </div>
          {showTranslation && cell.quote_vi ? <p className="evidence-panel__translation">{cell.quote_vi}</p> : null}
          <PageMatchButtons target={{ paper, cell, columnName: column.name }} preview={preview} />
        </Card>
      ) : null}

      {cell.quote_original ? (
        <p className="evidence-panel__tip">Mẹo: bôi đen một đoạn trong nội dung hoặc câu trích để tô sáng như bút dạ quang. Bấm vào đoạn đã tô để bỏ.</p>
      ) : null}
    </div>
  );
}

function NoteEditor({ source, onSave }: { source: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(source);
  const cancel = () => {
    setDraft(source);
    setEditing(false);
  };
  return (
    <Card
      title="Ghi chú của bạn"
      aside={
        !editing ? (
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            {source.trim() ? "Sửa ghi chú" : "Viết ghi chú"}
          </button>
        ) : null
      }
    >
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
                cancel();
              }
            }}
          />
          <p className="evidence-panel__note">**đậm**, *nghiêng*, - gạch đầu dòng, [chữ](https://…)</p>
          <div className="evidence-card__actions">
            <button type="submit" className="button button--primary">
              Lưu ghi chú
            </button>
            <button type="button" className="button button--quiet" onClick={cancel}>
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <>
          {source.trim() ? <MarkdownView source={source} /> : <p className="evidence-panel__value cell-muted">Chưa có ghi chú.</p>}
          <p className="evidence-panel__note">Ghi chú riêng của bạn. AI không bao giờ điền vào cột này.</p>
        </>
      )}
    </Card>
  );
}

function TagSection({ paperId, paperTags, tags }: { paperId: string; paperTags: string[]; tags: TableTag[] }) {
  const { toggleTag, createTag, deleteTag } = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColorKey>("1");
  const [error, setError] = useState<string | null>(null);
  const [managing, setManaging] = useState(tags.length === 0);

  return (
    <section className="evidence-card tag-section" aria-labelledby="nhan-cua-bai">
      <div className="evidence-card__head">
        <h3 id="nhan-cua-bai">Nhãn của bài</h3>
        {tags.length > 0 ? (
          <button type="button" className="link-button" aria-expanded={managing} onClick={() => setManaging(!managing)}>
            {managing ? "Xong" : "Thêm, xoá nhãn"}
          </button>
        ) : null}
      </div>
      {tags.length > 0 ? (
        <ul className="tag-section__list" aria-label="Bấm để gắn hoặc bỏ nhãn">
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
              {managing ? (
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
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="evidence-panel__note">Chưa có nhãn nào. Tạo nhãn như “quan trọng”, “đọc lại”, “dùng cho chương 2”.</p>
      )}
      {managing ? (
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
          <label htmlFor="nhan-moi">Nhãn mới</label>
          <input
            id="nhan-moi"
            name="nhan-moi"
            type="text"
            autoComplete="off"
            placeholder="Ví dụ: đọc lại…"
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
          {error ? (
            <p id="loi-nhan" className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
