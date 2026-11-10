"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { UNDO_SECONDS } from "@/lib/store";
import type { SheetTable } from "@/lib/types";

// Menu của một dòng (chuột phải, hoặc phím ContextMenu / Shift+F10 trên ô đang chọn).
// Mở xong thì focus vào mục đầu; mũi tên lên xuống để chọn, Esc hoặc bấm ra ngoài để đóng.
export function RowMenu({
  x,
  y,
  title,
  selected,
  onOpenPaper,
  onToggleSelect,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  title: string;
  selected: boolean;
  onOpenPaper: () => void;
  onToggleSelect: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    // Giữ menu trong màn hình.
    const { width, height } = element.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(x, window.innerWidth - width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - height - 8)) });
    element.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const away = (event: Event) => {
      if (!element.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", away, true);
    // Không đóng khi cuộn: chuột phải cũng chọn ô, khung chi tiết mở ra làm bảng tự cuộn ngay lúc đó.
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", away, true);
      window.removeEventListener("resize", onClose);
    };
  }, [x, y, onClose]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(box.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    }
  }

  const item = (label: string, run: () => void, danger = false) => (
    <button
      type="button"
      role="menuitem"
      className={`row-menu__item${danger ? " row-menu__item--danger" : ""}`}
      onClick={() => {
        onClose();
        run();
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={box}
      className="row-menu"
      role="menu"
      aria-label={`Thao tác với bài: ${title}`}
      style={{ left: position.left, top: position.top }}
      onKeyDown={handleKey}
      onContextMenu={(event) => event.preventDefault()}
    >
      <p className="row-menu__title source-text" translate="no">
        {title}
      </p>
      {item("Mở bài gốc", onOpenPaper)}
      {item(selected ? "Bỏ chọn bài này" : "Chọn bài này", onToggleSelect)}
      {item("Xoá bài này", onDelete, true)}
    </div>
  );
}

// "Đã xoá 2 bài" kèm nút Hoàn tác, tự ẩn sau UNDO_SECONDS giây. Không hỏi lại trước khi xoá vì có hoàn tác.
export function UndoToast({ message, onUndo, onDone }: { message: string; onUndo?: () => void; onDone: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDone, UNDO_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [paused, onDone, message]);

  return (
    <div
      className="undo-toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span>{message}</span>
      {onUndo ? (
        <button
          type="button"
          className="undo-toast__button"
          onClick={() => {
            onUndo();
            onDone();
          }}
        >
          Hoàn tác
        </button>
      ) : null}
      <button type="button" className="undo-toast__close" aria-label="Đóng thông báo" onClick={onDone}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// Thanh hiện khi đã đánh dấu bài bằng ô chọn ở đầu dòng.
export function SelectionBar({ count, onClear, onDelete }: { count: number; onClear: () => void; onDelete: () => void }) {
  return (
    <div className="selection-bar" role="region" aria-label="Các bài đã chọn">
      <span>Đã chọn {count} bài</span>
      <button type="button" className="link-button" onClick={onClear}>
        Bỏ chọn
      </button>
      <button type="button" className="button button--secondary selection-bar__delete" onClick={onDelete}>
        Xoá các bài đã chọn
      </button>
    </div>
  );
}

// Hỏi lại trước khi xoá cả bảng (không hoàn tác được).
export function DeleteTableDialog({
  table,
  waiting,
  onConfirm,
  onClose,
}: {
  table: SheetTable;
  waiting: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="confirm-dialog" aria-labelledby="xoa-bang-tieu-de" aria-describedby="xoa-bang-mo-ta" onClose={onClose}>
      <h2 id="xoa-bang-tieu-de">Xoá bảng “{table.name}”?</h2>
      <div id="xoa-bang-mo-ta">
        <p>App sẽ xoá vĩnh viễn, cả trên trình duyệt này lẫn trên máy chủ:</p>
        <ul className="confirm-dialog__list">
          <li>
            {table.papers.length} bài trong bảng{table.papers.length ? ", kể cả định dạng, ghi chú và nhãn" : ""}
          </li>
          {waiting > 0 ? <li>{waiting} bài đang chờ xử lý hoặc chờ duyệt của bảng này</li> : null}
          <li>Các file PDF của những bài này đã giữ trong trình duyệt</li>
        </ul>
        <p>Không khôi phục lại được. Nếu cần giữ, hãy xuất Excel trước.</p>
      </div>
      <div className="confirm-dialog__actions">
        <button type="button" className="button button--primary" autoFocus onClick={onClose}>
          Giữ bảng
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Xoá bảng
        </button>
      </div>
    </dialog>
  );
}
