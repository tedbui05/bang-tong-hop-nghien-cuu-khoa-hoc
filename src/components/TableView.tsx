"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { checkColumnName, countUnfilled, isInfoEdited, newContentColumn, removedInfoColumns, TITLE_COLUMN_ID } from "@/lib/columns";
import type { PreviewState } from "@/lib/preview-state";
import { countLabels, STATUS_LABELS, type StatusFilter } from "@/lib/sheet";
import { useStore } from "@/lib/store";
import { isCellEdited, type LabelKey, type SheetTable } from "@/lib/types";
import { ColumnMenu } from "./ColumnMenu";
import { EvidenceBar } from "./EvidenceBar";
import { SheetGrid, type SheetSelection, type SheetSort } from "./SheetGrid";
import { SkeletonLines, StateMessage } from "./StateMessage";

const STATUS_ORDER: LabelKey[] = ["needs_review", "verified", "page_corrected", "not_found", "manual"];
const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.2, 1.3];

export function TableView({ state }: { state: PreviewState }) {
  const { tables, activeTable, setActiveTable, savedTitle } = useStore();
  const table = state === "trong" ? null : activeTable;
  const showTable = state === "binh-thuong" && table !== null;

  return (
    <main id="noi-dung" className="page page--wide page--sheet">
      <div className="page-heading">
        <h1>{showTable ? table.name : "Bảng tổng hợp"}</h1>
        <div className="page-heading__actions">
          {showTable && tables.length > 1 ? (
            <label className="sheet-toolbar__field">
              <span>Đổi bảng</span>
              <select value={table.id} onChange={(event) => setActiveTable(event.target.value)}>
                {tables.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link className={showTable ? "button button--secondary" : "button button--primary"} href="/tao-bang">
            Tạo bảng mới
          </Link>
          {showTable ? (
            <Link className="button button--primary" href="/them-bai">
              Thêm bài báo
            </Link>
          ) : null}
        </div>
      </div>

      {state === "dang-tai" ? (
        <StateMessage tone="loading" title="Đang mở bảng của bạn…">
          <SkeletonLines count={7} />
        </StateMessage>
      ) : null}

      {state === "loi" ? (
        <StateMessage
          tone="error"
          title="Chưa mở được bảng"
          action={
            <Link className="button button--secondary" href="/">
              Thử lại
            </Link>
          }
        >
          <p>Hãy kiểm tra kết nối mạng rồi thử lại.</p>
        </StateMessage>
      ) : null}

      {state === "trong" || (state === "binh-thuong" && !table) ? (
        <StateMessage tone="empty" title="Chưa có bảng nào">
          <p>Tạo một bảng, thiết lập các cột cần điền, rồi mới thêm bài báo.</p>
        </StateMessage>
      ) : null}

      {/* Mỗi bảng có bộ lọc và vùng chọn riêng nên đổi bảng là dựng lại từ đầu. */}
      {showTable ? <Sheet key={table.id} table={table} savedTitle={savedTitle} /> : null}

      <p className="fine-print">Dữ liệu được lưu trên trình duyệt này. Hãy xuất Excel để giữ bản sao.</p>
    </main>
  );
}

function Sheet({ table, savedTitle }: { table: SheetTable; savedTitle: string | null }) {
  const { editSavedCell, addColumn, changeColumn, deleteColumn, moveColumn, reorderColumns } = useStore();
  const { papers, columns } = table;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SheetSort | null>(null);
  const [wrap, setWrap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exportNote, setExportNote] = useState(false);
  const [selected, setSelected] = useState<SheetSelection | null>(null);
  const [visibleCount, setVisibleCount] = useState(papers.length);
  const [menu, setMenu] = useState<{ columnId: string; anchor: DOMRect } | null>(null);
  const [columnNotice, setColumnNotice] = useState<string | null>(null);

  const counts = useMemo(() => countLabels(papers), [papers]);
  const languages = useMemo(
    () => [...new Set(papers.map((paper) => paper.info.language).filter(Boolean))],
    [papers],
  );
  const editedCount = useMemo(
    () =>
      papers.reduce(
        (total, paper) =>
          total + paper.cells.filter(isCellEdited).length + columns.filter((column) => isInfoEdited(paper, column)).length,
        0,
      ),
    [papers, columns],
  );
  const unfilledCount = useMemo(
    () => columns.reduce((total, column) => total + countUnfilled(papers, column), 0),
    [papers, columns],
  );

  const selectedPaper = selected ? papers.find((paper) => paper.id === selected.paperId) : undefined;
  const selectedColumn = selected ? columns.find((column) => column.id === selected.field) : undefined;
  const selection =
    selected && selectedPaper && selectedColumn
      ? {
          paper: selectedPaper,
          column: selectedColumn,
          cell: selectedPaper.cells.find((cell) => cell.column === selectedColumn.id),
          count: selected.count,
        }
      : null;

  const menuColumn = menu ? columns.find((column) => column.id === menu.columnId) : undefined;

  function closeMenu() {
    const id = menu?.columnId;
    setMenu(null);
    // Trả con trỏ về đúng tiêu đề cột vừa mở, nếu cột đó vẫn còn và đang hiện.
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.sheet-head__title[data-column="${id}"]`)?.focus());
  }

  function removeColumn(id: string) {
    const name = columns.find((column) => column.id === id)?.name;
    deleteColumn(id);
    setColumnFilters((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (sort?.field === id) setSort(null);
    if (selected?.field === id) setSelected(null);
    setColumnNotice(`Đã xoá cột “${name}”.`);
  }

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const hasFilters = Boolean(query) || statusFilter !== "all" || Object.values(columnFilters).some(Boolean);

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setColumnFilters({});
  }

  return (
    <>
      <p className="overview">
        <span>{papers.length} bài đã lưu</span>
        <span>{counts.verified} ô đã khớp</span>
        <button type="button" className="overview__flag" onClick={() => setStatusFilter("needs_review")}>
          {counts.needs_review} ô cần kiểm tra
        </button>
        {editedCount > 0 ? <span>{editedCount} ô đã sửa</span> : null}
        {unfilledCount > 0 ? <span>{unfilledCount} ô chưa điền</span> : null}
        {languages.length > 0 ? <span>{languages.join(", ")}</span> : null}
      </p>

      {savedTitle ? (
        <p className="notice" role="status">
          Đã lưu vào bảng: <cite translate="no">{savedTitle}</cite>
        </p>
      ) : null}

      {columnNotice ? (
        <p className="notice" role="status">
          {columnNotice}
        </p>
      ) : null}

      <div className="sheet-toolbar" role="group" aria-label="Công cụ của bảng">
        <div className="sheet-toolbar__search">
          <label htmlFor="tim-kiem" className="visually-hidden">
            Tìm trong toàn bảng
          </label>
          <input
            id="tim-kiem"
            name="tim-kiem"
            type="search"
            autoComplete="off"
            placeholder="Tìm trong toàn bảng…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <label className="sheet-toolbar__field">
          <span>Trạng thái</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">Tất cả</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]} ({counts[status]})
              </option>
            ))}
          </select>
        </label>

        <details className="columns-menu">
          <summary className="button button--quiet sheet-toolbar__button">Cột</summary>
          <div className="columns-menu__panel">
            <fieldset>
              <legend className="visually-hidden">Ẩn hoặc hiện cột</legend>
              {columns.map((column) => (
                <label key={column.id}>
                  <input
                    type="checkbox"
                    checked={column.id === TITLE_COLUMN_ID || column.visible}
                    disabled={column.id === TITLE_COLUMN_ID}
                    onChange={(event) => changeColumn(column.id, { visible: event.target.checked })}
                  />
                  {column.name}
                </label>
              ))}
            </fieldset>
            <AddColumnForm
              table={table}
              onAdded={(column, restored) => {
                addColumn(column);
                setColumnNotice(
                  papers.length > 0
                    ? `Đã ${restored ? "thêm lại" : "thêm"} cột “${column.name}”. ${papers.length} ô đang ghi “chưa điền”.`
                    : `Đã ${restored ? "thêm lại" : "thêm"} cột “${column.name}”.`,
                );
              }}
            />
          </div>
        </details>

        <button
          type="button"
          className="button button--quiet sheet-toolbar__button"
          aria-pressed={wrap}
          onClick={() => setWrap(!wrap)}
        >
          {wrap ? "Thu gọn một dòng" : "Hiện đủ chữ"}
        </button>

        <div className="zoom" role="group" aria-label="Phóng to, thu nhỏ bảng">
          <button
            type="button"
            className="button button--quiet sheet-toolbar__button"
            aria-label="Thu nhỏ bảng"
            disabled={zoomIndex === 0}
            onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1])}
          >
            −
          </button>
          <output className="zoom__value">{Math.round(zoom * 100)}%</output>
          <button
            type="button"
            className="button button--quiet sheet-toolbar__button"
            aria-label="Phóng to bảng"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1])}
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="button button--quiet sheet-toolbar__button sheet-toolbar__export"
          onClick={() => setExportNote(true)}
        >
          Xuất Excel
        </button>
      </div>

      {exportNote ? (
        <p className="notice" role="status">
          Bản xem thử chưa tạo được file Excel. Nút này sẽ hoạt động ở bước sau.
        </p>
      ) : null}

      {hasFilters && visibleCount === 0 ? (
        <p className="notice" role="status">
          Không có bài nào khớp.{" "}
          <button type="button" className="link-button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </p>
      ) : null}

      <EvidenceBar selection={selection} onClose={() => setSelected(null)} />

      <SheetGrid
        papers={papers}
        columns={columns}
        query={query}
        statusFilter={statusFilter}
        columnFilters={columnFilters}
        wrap={wrap}
        zoom={zoom}
        sort={sort}
        hasSelection={selected !== null}
        onHeaderClick={(columnId, anchor) => setMenu({ columnId, anchor })}
        onColumnsMoved={reorderColumns}
        onColumnResized={(id, width) => changeColumn(id, { width })}
        onSelection={setSelected}
        onVisibleCount={setVisibleCount}
        onEdit={editSavedCell}
      />

      {menu && menuColumn ? (
        <ColumnMenu
          key={menu.columnId}
          column={menuColumn}
          columns={columns}
          papers={papers}
          anchor={menu.anchor}
          sort={sort}
          filter={columnFilters[menu.columnId] ?? ""}
          onSort={setSort}
          onFilter={(value) => setColumnFilters((current) => ({ ...current, [menu.columnId]: value }))}
          onRename={(name) => changeColumn(menu.columnId, { name })}
          onDescribe={(description) => changeColumn(menu.columnId, { description })}
          onMove={(offset) => moveColumn(menu.columnId, offset)}
          onHide={() => changeColumn(menu.columnId, { visible: false })}
          onDelete={() => removeColumn(menu.columnId)}
          onClose={closeMenu}
        />
      ) : null}
    </>
  );
}

function AddColumnForm({
  table,
  onAdded,
}: {
  table: SheetTable;
  onAdded: (column: SheetTable["columns"][number], restored: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const removedInfo = removedInfoColumns(table.columns);

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = checkColumnName(name, table.columns);
    if (problem) {
      setError(problem);
      nameInput.current?.focus();
      return;
    }
    onAdded(newContentColumn(name.trim(), description.trim()), false);
    setName("");
    setDescription("");
    setError(null);
  }

  return (
    <form className="columns-menu__add" onSubmit={submit} noValidate>
      <strong>Thêm cột mới</strong>
      <label htmlFor="cot-moi">Tên cột</label>
      <input
        ref={nameInput}
        id="cot-moi"
        name="cot-moi"
        type="text"
        autoComplete="off"
        placeholder="Ví dụ: Số liệu tại Việt Nam…"
        value={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "loi-cot-moi" : undefined}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
      />
      {error ? (
        <p id="loi-cot-moi" className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <label htmlFor="mo-ta-cot-moi">AI cần tìm gì cho cột này</label>
      <input
        id="mo-ta-cot-moi"
        name="mo-ta-cot-moi"
        type="text"
        autoComplete="off"
        placeholder="Ví dụ: tỷ lệ, năm của số liệu…"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <button type="submit" className="button button--secondary">
        Thêm cột
      </button>
      {removedInfo.map((column) => (
        <button key={column.id} type="button" className="link-button" onClick={() => onAdded(column, true)}>
          Thêm lại “{column.name}”
        </button>
      ))}
    </form>
  );
}
