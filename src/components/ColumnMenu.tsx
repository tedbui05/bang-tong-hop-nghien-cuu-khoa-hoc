"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { checkColumnName, countColumnData, countUnfilled, TITLE_COLUMN_ID } from "@/lib/columns";
import type { SavedPaper, TableColumn } from "@/lib/types";
import type { SheetSort } from "./SheetGrid";

type Props = {
  column: TableColumn;
  columns: TableColumn[];
  papers: SavedPaper[];
  anchor: DOMRect;
  sort: SheetSort | null;
  filter: string;
  onSort: (sort: SheetSort | null) => void;
  onFilter: (value: string) => void;
  onRename: (name: string) => void;
  onDescribe: (description: string) => void;
  onMove: (offset: number) => void;
  onHide: () => void;
  onDelete: () => void;
  onClose: () => void;
};

type View = "menu" | "rename" | "describe" | "filter" | "delete";

// Menu của một cột, mở khi bấm vào tiêu đề cột trên bảng.
export function ColumnMenu(props: Props) {
  const { column, columns, papers, anchor, sort, filter, onSort, onFilter, onRename, onDescribe, onMove, onHide, onDelete, onClose } = props;
  const [view, setView] = useState<View>("menu");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ left: anchor.left, top: anchor.bottom + 4 });
  const panel = useRef<HTMLDivElement | null>(null);

  const isTitle = column.id === TITLE_COLUMN_ID;
  const index = columns.findIndex((item) => item.id === column.id);
  const data = countColumnData(papers, column);
  const unfilled = countUnfilled(papers, column);
  const sorted = sort?.field === column.id ? sort.dir : null;

  // Không cho menu tràn khỏi màn hình.
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - height - 8)),
    });
  }, [anchor, view]);

  // Mỗi lần đổi phần đang hiện thì chuyển con trỏ vào đó, để bàn phím dùng được ngay.
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("input, button:not(:disabled)")?.focus();
  }, [view]);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [onClose]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (view !== "menu" || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  }

  function open(next: View, value = "") {
    setDraft(value);
    setError(null);
    setView(next);
  }

  function submitRename(event: FormEvent) {
    event.preventDefault();
    const problem = checkColumnName(draft, columns, column.id);
    if (problem) {
      setError(problem);
      return;
    }
    onRename(draft.trim());
    onClose();
  }

  function submitDescribe(event: FormEvent) {
    event.preventDefault();
    onDescribe(draft.trim());
    onClose();
  }

  function requestDelete() {
    // Cột chưa có dữ liệu thì không có gì để mất, xoá luôn.
    if (data.filled === 0) {
      onDelete();
      onClose();
    } else {
      open("delete");
    }
  }

  const item = (label: string, action: () => void, disabled = false) => (
    <button type="button" role="menuitem" className="column-menu__item" disabled={disabled} onClick={action}>
      {label}
    </button>
  );
  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div
      ref={panel}
      className="column-menu"
      style={{ left: position.left, top: position.top }}
      role={view === "menu" ? "menu" : "dialog"}
      aria-label={`Cột ${column.name}`}
      onKeyDown={handleKey}
    >
      {view === "menu" ? (
        <>
          <p className="column-menu__head">
            <strong>{column.name}</strong>
            <span>{column.description ? `AI cần tìm: ${column.description}` : "Chưa có mô tả cho AI."}</span>
          </p>
          {item("Đổi tên", () => open("rename", column.name))}
          {item("Sửa mô tả", () => open("describe", column.description))}
          <hr />
          {item(sorted === "asc" ? "Sắp xếp A đến Z (đang dùng)" : "Sắp xếp A đến Z", run(() => onSort({ field: column.id, dir: "asc" })))}
          {item(sorted === "desc" ? "Sắp xếp Z đến A (đang dùng)" : "Sắp xếp Z đến A", run(() => onSort({ field: column.id, dir: "desc" })))}
          {sorted ? item("Bỏ sắp xếp", run(() => onSort(null))) : null}
          {item(filter ? `Lọc (đang lọc “${filter}”)` : "Lọc", () => open("filter", filter))}
          {!isTitle ? (
            <>
              <hr />
              {item("Chuyển sang trái", run(() => onMove(-1)), index <= 1)}
              {item("Chuyển sang phải", run(() => onMove(1)), index === columns.length - 1)}
            </>
          ) : null}
          {column.kind === "content" && unfilled > 0 ? (
            <>
              <hr />
              {item(`Điền ${unfilled} ô chưa điền`, () => {}, true)}
              <p className="column-menu__note">Nút này sẽ dùng được khi đã nối AI. Bạn vẫn có thể bấm đúp vào ô để tự gõ.</p>
            </>
          ) : null}
          {!isTitle ? (
            <>
              <hr />
              {item("Ẩn cột", run(onHide))}
              {item("Xoá cột", requestDelete)}
            </>
          ) : (
            <p className="column-menu__note">Tên bài dùng để nhận biết dòng nên không ẩn hoặc xoá được.</p>
          )}
        </>
      ) : null}

      {view === "rename" ? (
        <form className="column-menu__form" onSubmit={submitRename} noValidate>
          <label htmlFor="menu-ten-cot">Tên cột</label>
          <input
            id="menu-ten-cot"
            name="ten-cot"
            type="text"
            autoComplete="off"
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "menu-loi-cot" : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p id="menu-loi-cot" className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <FormButtons label="Lưu tên" onCancel={onClose} />
        </form>
      ) : null}

      {view === "describe" ? (
        <form className="column-menu__form" onSubmit={submitDescribe} noValidate>
          <label htmlFor="menu-mo-ta">AI cần tìm gì cho cột này</label>
          <input
            id="menu-mo-ta"
            name="mo-ta"
            type="text"
            autoComplete="off"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {data.filled > 0 ? (
            <p className="column-menu__note">Mô tả mới chỉ áp dụng cho lần điền sau. {data.filled} ô đang có nội dung sẽ giữ nguyên.</p>
          ) : null}
          <FormButtons label="Lưu mô tả" onCancel={onClose} />
        </form>
      ) : null}

      {view === "filter" ? (
        <form
          className="column-menu__form"
          onSubmit={(event) => {
            event.preventDefault();
            onClose();
          }}
          noValidate
        >
          <label htmlFor="menu-loc">Lọc cột {column.name}</label>
          <input
            id="menu-loc"
            name="loc-cot"
            type="text"
            autoComplete="off"
            placeholder="Nhập chữ cần lọc…"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              onFilter(event.target.value);
            }}
          />
          <div className="column-menu__buttons">
            <button type="submit" className="button button--secondary">
              Xong
            </button>
            {draft ? (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  onFilter("");
                  onClose();
                }}
              >
                Bỏ lọc
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {view === "delete" ? (
        <div className="column-menu__form" role="alert">
          <p>
            <strong>Xoá cột “{column.name}”?</strong>
          </p>
          <p>
            Sẽ mất {data.filled} ô dữ liệu{data.edited > 0 ? `, trong đó có ${data.edited} ô bạn đã sửa hoặc tự điền` : ""}. Không khôi phục được.
          </p>
          <div className="column-menu__buttons">
            <button type="button" className="button button--secondary" onClick={onClose}>
              Giữ lại
            </button>
            <button type="button" className="button button--primary" onClick={run(onDelete)}>
              Xoá cột
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FormButtons({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="column-menu__buttons">
      <button type="submit" className="button button--primary">
        {label}
      </button>
      <button type="button" className="button button--quiet" onClick={onCancel}>
        Hủy
      </button>
    </div>
  );
}
