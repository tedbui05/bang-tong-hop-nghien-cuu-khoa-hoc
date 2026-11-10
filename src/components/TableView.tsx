"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { exportTableToExcel } from "@/lib/export-xlsx";
import { quoteList } from "@/lib/paper-viewer";
import { checkColumnName, countUnfilled, isInfoEdited, newContentColumn, removedInfoColumns, TITLE_COLUMN_ID } from "@/lib/columns";
import type { PreviewState } from "@/lib/preview-state";
import { countLabels, listLanguages, STATUS_LABELS, type StatusFilter } from "@/lib/sheet";
import { useStore, type CloudState } from "@/lib/store";
import { isCellEdited, type LabelKey, type SheetTable } from "@/lib/types";
import { ColumnMenu } from "./ColumnMenu";
import { EvidencePanel } from "./EvidencePanel";
import { chipBlur, chipKey, EvidencePreviewLayer, paperTarget, useEvidencePreview, type EvidenceTarget } from "./EvidencePreview";
import { FormatBar, useCellFormatting } from "./FormatBar";
import { StatusIcon } from "./StatusBadge";
import { SheetGrid, type SheetSelection, type SheetSort } from "./SheetGrid";
import { SkeletonLines, StateMessage } from "./StateMessage";
import { useScrollHint } from "./useScrollHint";
import { ResetDataButton } from "./ResetDataButton";
import { SaveStatus } from "./SaveStatus";
import { VersionHistory } from "./VersionHistory";
import { DeleteTableDialog, RowMenu, SelectionBar, UndoToast } from "./TableActions";
import { SAMPLE_TABLE_ID } from "@/lib/table-ops";
import { historyShortcut, isTypingTarget } from "@/lib/history";

const STATUS_ORDER: LabelKey[] = ["needs_review", "verified", "page_corrected", "not_found", "manual"];
const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.2, 1.3];

export function TableView({ state }: { state: PreviewState }) {
  const { activeTable, hydrated, demoOpen, openDemo, closeDemo, history, undo, redo, versionsEnabled } = useStore();
  const [showDeleted, setShowDeleted] = useState(false);
  const table = state === "trong" ? null : activeTable;
  // Bảng minh hoạ chỉ sống trong trang này: rời trang là đóng.
  useEffect(() => closeDemo, [closeDemo]);

  // Cmd+Z hoàn tác, Cmd+Shift+Z làm lại, chỉ ở trang bảng. Đang gõ trong ô chữ thì để trình duyệt hoàn tác chữ trong ô.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const action = historyShortcut(event, isTypingTarget(document.activeElement));
      if (!action) return;
      event.preventDefault();
      if (action === "undo") undo();
      else redo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  if (!hydrated && state === "binh-thuong") {
    return (
      <main id="noi-dung" className="page page--wide">
        <StateMessage tone="loading" title="Đang mở bảng của bạn…">
          <SkeletonLines count={7} />
        </StateMessage>
      </main>
    );
  }

  // Có bảng thì chiếm trọn màn hình; các trạng thái khác dùng khung trang thường.
  if (state === "binh-thuong" && table) {
    return (
      <main id="noi-dung" className="sheet-page">
        {/* Mỗi bảng có bộ lọc và vùng chọn riêng nên đổi bảng là dựng lại từ đầu. */}
        <Sheet key={demoOpen ? `minh-hoa-${table.id}` : table.id} table={table} />
      </main>
    );
  }

  return (
    <main id="noi-dung" className="page page--wide">
      <div className="page-heading">
        <h1>Bảng tổng hợp</h1>
        {table ? (
          <Link className="button button--primary" href="/tao-bang">
            Tạo bảng mới
          </Link>
        ) : null}
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
        <section className="welcome" aria-labelledby="chao-mung">
          <h2 id="chao-mung">Lập bảng tổng quan tài liệu, có câu trích để kiểm chứng</h2>
          <p>
            Bạn đặt ra các cột cần điền, tải bài báo PDF lên. AI đề xuất nội dung từng ô kèm câu trích nguyên văn và số trang;
            app tự kiểm tra câu trích có thật trong bài; bạn duyệt từng ô rồi mới lưu vào bảng, và xuất được ra Excel.
          </p>
          {history.canUndo ? (
            <p className="welcome__undo">
              <button type="button" className="button button--secondary" onClick={undo}>
                ↶ {history.undoTitle}
              </button>
            </p>
          ) : null}
          <div className="welcome__actions">
            <Link className="button button--primary" href="/tao-bang">
              Tạo bảng đầu tiên
            </Link>
            <button type="button" className="link-button" onClick={openDemo}>
              Xem bảng minh hoạ
            </button>
            {versionsEnabled ? (
              <button type="button" className="link-button" onClick={() => setShowDeleted(true)}>
                Khôi phục bảng đã xoá
              </button>
            ) : null}
          </div>
          {showDeleted ? <VersionHistory table={null} onClose={() => setShowDeleted(false)} /> : null}
        </section>
      ) : null}

      <p className="fine-print">Dữ liệu được lưu trên trình duyệt này. Hãy xuất Excel để giữ bản sao.</p>
    </main>
  );
}

// Dòng trạng thái lưu ở chân bảng.
function saveText(saveFailed: boolean, cloud: CloudState): string {
  if (cloud === "offline") return "Mất mạng: thay đổi đang giữ trên trình duyệt này, app sẽ tự lưu lên máy chủ khi có mạng lại.";
  if (cloud === "error") return "Chưa lưu được lên máy chủ, app đang thử lại. Thay đổi vẫn giữ trên trình duyệt này.";
  if (saveFailed && cloud !== "saved" && cloud !== "saving") {
    return "Trình duyệt đang không cho lưu, tải lại trang sẽ mất thay đổi. Hãy xuất Excel để giữ bản sao.";
  }
  if (cloud === "loading") return "Đang đọc dữ liệu đã lưu…";
  if (cloud === "saving") return "Đang lưu lên máy chủ…";
  if (cloud === "saved") return "Đã lưu lên máy chủ, gắn với trình duyệt này. Hãy xuất Excel để giữ bản sao.";
  return "Dữ liệu được lưu trên trình duyệt này. Hãy xuất Excel để giữ bản sao.";
}

const STAT_TILES: { key: LabelKey; label: string }[] = [
  { key: "verified", label: "Đã khớp" },
  { key: "page_corrected", label: "Đã sửa số trang" },
  { key: "needs_review", label: "Cần kiểm tra" },
  { key: "not_found", label: "Không tìm thấy" },
];

function Sheet({ table }: { table: SheetTable }) {
  const router = useRouter();
  const {
    tables,
    setActiveTable,
    savedTitle,
    saveFailed,
    cloud,
    syncNow,
    editSavedCell,
    addColumn,
    changeColumn,
    deleteColumn,
    moveColumn,
    reorderColumns,
    demoOpen,
    closeDemo,
    deletePapers,
    history,
    undo: undoAction,
    redo: redoAction,
    undoIfLatest,
    deleteTable,
    queue,
  } = useStore();
  const isSampleTable = !demoOpen && table.id === SAMPLE_TABLE_ID;
  const { papers, columns } = table;
  // Điện thoại: hai hàng này cuộn ngang, có vệt mờ ở mép phải khi còn nội dung.
  const statsRow = useRef<HTMLDivElement | null>(null);
  const toolbarRow = useRef<HTMLDivElement | null>(null);
  useScrollHint(statsRow);
  useScrollHint(toolbarRow);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SheetSort | null>(null);
  const [wrap, setWrap] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exportNote, setExportNote] = useState(false);
  // Xuất lúc chưa lưu được lên máy chủ: file vẫn có đủ dữ liệu đang thấy, nhưng nhắc rằng máy chủ chưa có bản này.
  const [exportUnsynced, setExportUnsynced] = useState(false);
  const [selected, setSelected] = useState<SheetSelection | null>(null);
  const [visibleCount, setVisibleCount] = useState(papers.length);
  const [menu, setMenu] = useState<{ columnId: string; anchor: DOMRect } | null>(null);
  const [columnNotice, setColumnNotice] = useState<string | null>(null);
  const [savedNoticeClosed, setSavedNoticeClosed] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  // Bài đánh dấu bằng ô chọn ở đầu dòng; menu của dòng; thông báo hoàn tác; hộp hỏi xoá bảng.
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [rowMenu, setRowMenu] = useState<{ paperId: string; x: number; y: number } | null>(null);
  const [undo, setUndo] = useState<{ message: string; entryId: number | null; key: number } | null>(null);
  const [askDeleteTable, setAskDeleteTable] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  // Chọn một mục trong "Tuỳ chọn bảng" thì đóng danh sách lại.
  const tableOptions = useRef<HTMLDetailsElement | null>(null);
  const pickOption = (run: () => void) => () => {
    if (tableOptions.current) tableOptions.current.open = false;
    run();
  };
  // Khung xem trước trang PDF khi rê chuột, Tab hoặc bấm vào nhãn bằng chứng trong ô.
  const preview = useEvidencePreview();
  const tags = table.tags ?? [];
  const targets = selected?.cells ?? [];
  const formatting = useCellFormatting(targets, papers);

  // Chỉ tính các bài còn trong bảng (bài vừa xoá thì không còn được chọn; hoàn tác thì chọn lại như cũ).
  const selectedIds = useMemo(() => {
    const ids = new Set(papers.map((paper) => paper.id));
    const kept = [...checked].filter((id) => ids.has(id));
    return kept.length === checked.size ? checked : new Set(kept);
  }, [checked, papers]);

  const toggleCheck = useCallback((paperId: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  }, []);

  // Xoá bài không hỏi lại: có thông báo "Hoàn tác" trong vài giây.
  function removeRows(ids: string[]) {
    const removed = deletePapers(ids);
    if (!removed) return;
    if (selected && ids.includes(selected.paperId)) setSelected(null);
    preview.close();
    setUndo({ message: `Đã xoá ${removed.count} bài`, entryId: removed.entryId, key: Date.now() });
  }

  // Mở cả file PDF của bài, ở trang 1, có danh sách câu trích để bấm nhảy tới.
  function openPaper(paperId: string, anchor: HTMLElement) {
    const paper = papers.find((item) => item.id === paperId);
    if (paper) preview.openFull(paperTarget(paper, quoteList(paper.cells, columns)), anchor);
  }

  const closeRowMenu = useCallback(() => setRowMenu(null), []);
  const endUndo = useCallback(() => setUndo(null), []);
  const waitingInTable = queue.filter((item) => item.tableId === table.id && item.status !== "saved").length;

  const counts = useMemo(() => countLabels(papers), [papers]);
  const languages = useMemo(() => listLanguages(papers), [papers]);
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
          quotes: quoteList(selectedPaper.cells, columns),
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

  const notice =
    (exportNote ? "Chưa tạo được file Excel. Hãy thử lại; nếu vẫn lỗi, tải lại trang rồi xuất lần nữa." : null) ??
    (exportUnsynced ? "Đã xuất file Excel. Lưu ý: một vài thay đổi mới nhất chưa lưu được lên máy chủ vì mất mạng; app sẽ tự lưu khi có mạng lại." : null) ??
    columnNotice ??
    (savedTitle && !savedNoticeClosed ? `Đã lưu vào bảng: ${savedTitle}` : null);

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const hasFilters = Boolean(query) || Boolean(tagFilter) || statusFilter !== "all" || Object.values(columnFilters).some(Boolean);

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setTagFilter("");
    setColumnFilters({});
  }

  return (
    <>
      <header className="sheet-titlebar">
        <div className="sheet-titlebar__text">
          <h1>{table.name}</h1>
          <p>{table.description || `${papers.length} bài, ${columns.length} cột`}</p>
          {demoOpen ? null : <SaveStatus />}
        </div>
        <div className="sheet-titlebar__actions">
          {!demoOpen && tables.length > 1 ? (
            <label className="sheet-titlebar__switch">
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
          {demoOpen ? null : (
            <details ref={tableOptions} className="table-options">
              <summary className="button sheet-titlebar__ghost">Tuỳ chọn bảng</summary>
              <div className="table-options__panel">
                <button type="button" className="row-menu__item" onClick={pickOption(() => setShowVersions(true))}>
                  Lịch sử phiên bản…
                </button>
                <button type="button" className="row-menu__item" onClick={pickOption(() => setAskDeleteTable(true))}>
                  {isSampleTable ? "Bỏ bảng minh hoạ…" : "Xoá bảng này…"}
                </button>
              </div>
            </details>
          )}
          <Link className="button sheet-titlebar__ghost" href="/tao-bang">
            Tạo bảng mới
          </Link>
          <Link className="button sheet-titlebar__solid" href="/them-bai">
            Thêm bài báo
          </Link>
        </div>
      </header>

      {demoOpen ? (
        <div className="sample-banner" role="note">
          <p>
            <strong>Bảng minh hoạ:</strong> dữ liệu mẫu, nhãn gán tay. Bạn có thể thử sửa, tô màu, xem PDF, nhưng thay đổi không được lưu.
          </p>
          <button type="button" className="button button--secondary" onClick={closeDemo}>
            Đóng bảng minh hoạ
          </button>
        </div>
      ) : isSampleTable ? (
        <div className="sample-banner" role="note">
          <p>Đây là bảng minh hoạ có sẵn trong app: dữ liệu mẫu, nhãn gán tay, chưa phải kết quả kiểm tra thật.</p>
          <button type="button" className="button button--secondary" onClick={() => setAskDeleteTable(true)}>
            Bỏ bảng minh hoạ
          </button>
        </div>
      ) : null}

      <div ref={statsRow} className="sheet-stats" role="group" aria-label="Tổng quan, bấm để lọc">
        <button type="button" className="sheet-stat" aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          <span className="sheet-stat__number">{papers.length}</span>
          <span className="sheet-stat__label">Tổng số bài</span>
        </button>
        {STAT_TILES.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className={`sheet-stat sheet-stat--${tile.key}`}
            aria-pressed={statusFilter === tile.key}
            onClick={() => setStatusFilter(statusFilter === tile.key ? "all" : tile.key)}
          >
            <span className="sheet-stat__number">{counts[tile.key]}</span>
            <span className="sheet-stat__label">
              <StatusIcon label={tile.key} />
              {tile.label}
            </span>
          </button>
        ))}
        <p className="sheet-stats__extra">
          {editedCount > 0 ? <span>{editedCount} ô đã sửa</span> : null}
          {unfilledCount > 0 ? <span>{unfilledCount} ô chưa điền</span> : null}
          {languages.length > 0 ? <span>{languages.join(", ")}</span> : null}
        </p>
      </div>

      {notice ? (
        <div className="sheet-notice" role="status">
          <p>{notice}</p>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setColumnNotice(null);
              setSavedNoticeClosed(true);
              setExportNote(false);
            }}
          >
            Đóng
          </button>
        </div>
      ) : null}

      <div ref={toolbarRow} className="sheet-toolbar" role="group" aria-label="Công cụ của bảng">
        <UndoRedoButtons history={history} onUndo={undoAction} onRedo={redoAction} />
        <div className="sheet-toolbar__search">
          <label htmlFor="tim-kiem" className="visually-hidden">
            Tìm trong toàn bảng
          </label>
          <input
            id="tim-kiem"
            name="tim-kiem"
            type="search"
            autoComplete="off"
            placeholder="Tìm trong bảng…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <label className="sheet-toolbar__field">
          <span>Lọc</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="all">Tất cả</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]} ({counts[status]})
              </option>
            ))}
          </select>
        </label>

        {tags.length > 0 ? (
          <label className="sheet-toolbar__field">
            <span>Nhãn</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">Tất cả</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <details className="columns-menu">
          <summary className="button button--quiet sheet-toolbar__button">Ẩn, hiện cột</summary>
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
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setExportNote(false);
            setExportUnsynced(false);
            try {
              // Lưu hết lên máy chủ trước, để file Excel đúng bằng dữ liệu đã lưu.
              const synced = cloud === "local" ? true : await syncNow();
              await exportTableToExcel(table);
              if (!synced) setExportUnsynced(true);
            } catch {
              setExportNote(true);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Đang tạo file…" : "Xuất Excel"}
        </button>
      </div>

      {hasFilters && visibleCount === 0 && papers.length > 0 ? (
        <div className="sheet-notice" role="status">
          <p>Không có bài nào khớp.</p>
          <button type="button" className="link-button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      ) : null}

      <div
        className="sheet-workspace"
        onKeyDownCapture={(event: KeyboardEvent<HTMLDivElement>) => {
          // Cmd/Ctrl + B, I, U định dạng các ô đang chọn, trừ khi đang gõ chữ.
          if (!(event.metaKey || event.ctrlKey) || event.altKey || targets.length === 0) return;
          if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
          const key = { b: "bold", i: "italic", u: "underline" }[event.key.toLowerCase()] as "bold" | "italic" | "underline" | undefined;
          if (!key) return;
          event.preventDefault();
          event.stopPropagation();
          formatting.toggle(key);
        }}
      >
        <div className="sheet-workspace__grid">
      {selectedIds.size > 0 ? (
        <SelectionBar
          count={selectedIds.size}
          onClear={() => setChecked(new Set())}
          onDelete={() => {
            const ids = [...selectedIds];
            setChecked(new Set());
            removeRows(ids);
          }}
        />
      ) : null}
      <SheetGrid
        papers={papers}
        columns={columns}
        tags={tags}
        tagFilter={tagFilter}
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
        onAddPaper={() => router.push("/them-bai")}
        selectedIds={selectedIds}
        onToggleSelect={toggleCheck}
        onOpenPaper={openPaper}
        onRowMenu={(paperId, x, y) => setRowMenu({ paperId, x, y })}
        onEvidence={(action, paperId, columnId, anchor, event) => {
          const paper = papers.find((item) => item.id === paperId);
          const cell = paper?.cells.find((item) => item.column === columnId);
          const column = columns.find((item) => item.id === columnId);
          if (!paper || !cell || !column) return;
          const target: EvidenceTarget = { paper, cell, columnName: column.name, quotes: quoteList(paper.cells, columns) };
          if (action === "enter") preview.hoverIn(target, anchor);
          else if (action === "leave") preview.hoverOut();
          else if (action === "focus") preview.focusIn(target, anchor);
          else if (action === "click") preview.toggle(target, anchor);
          else if (action === "blur" && event) chipBlur(event as globalThis.FocusEvent, preview);
          else if (action === "key" && event) chipKey(event as globalThis.KeyboardEvent, preview);
        }}
      />
        </div>
        {selection ? (
          <EvidencePanel
            selection={selection}
            tags={tags}
            formatBar={<FormatBar key={targets.map((target) => `${target.paperId}:${target.columnId}`).join(",")} targets={targets} papers={papers} />}
            onClose={() => {
              // Khung đóng lại thì nút đang giữ focus biến mất: trả focus về bảng để người dùng bàn phím đi tiếp được.
              const inPanel = document.activeElement?.closest(".evidence-panel");
              setSelected(null);
              if (inPanel) document.querySelector<HTMLElement>(".sheet-host .tabulator-tableholder")?.focus({ preventScroll: true });
            }}
            preview={preview}
          />
        ) : null}
      </div>

      <EvidencePreviewLayer preview={preview} />

      {rowMenu ? (
        <RowMenu
          x={rowMenu.x}
          y={rowMenu.y}
          title={papers.find((paper) => paper.id === rowMenu.paperId)?.info.title ?? ""}
          selected={selectedIds.has(rowMenu.paperId)}
          onOpenPaper={() => {
            const button = document.querySelector<HTMLElement>(`.sheet-open-pdf[data-paper="${CSS.escape(rowMenu.paperId)}"]`);
            openPaper(rowMenu.paperId, button ?? document.body);
          }}
          onToggleSelect={() => toggleCheck(rowMenu.paperId)}
          onDelete={() => removeRows([rowMenu.paperId])}
          onClose={closeRowMenu}
        />
      ) : null}

      {undo ? (
        <UndoToast
          key={undo.key}
          message={undo.message}
          // Bảng minh hoạ không có lịch sử hoàn tác nên thông báo không có nút Hoàn tác.
          onUndo={undo.entryId === null ? undefined : () => undoIfLatest(undo.entryId!)}
          onDone={endUndo}
        />
      ) : null}

      {showVersions ? <VersionHistory table={table} onClose={() => setShowVersions(false)} /> : null}

      {askDeleteTable ? (
        <DeleteTableDialog
          table={table}
          waiting={waitingInTable}
          sample={isSampleTable}
          onConfirm={() => deleteTable(table.id)}
          onClose={() => setAskDeleteTable(false)}
        />
      ) : null}

      <footer className="sheet-footer">
        <span>
          Đang hiện {visibleCount}/{papers.length} bài
        </span>
        <span className={`sheet-footer__status${saveFailed || cloud === "offline" || cloud === "error" ? " sheet-footer__error" : ""}`} role="status">
          {saveText(saveFailed, cloud)}
        </span>
        <ResetDataButton />
      </footer>

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

// Nút Hoàn tác, Làm lại trên thanh công cụ. Rê chuột (hoặc trình đọc màn hình) cho biết thao tác sẽ bị hoàn tác.
function UndoRedoButtons({
  history,
  onUndo,
  onRedo,
}: {
  history: { canUndo: boolean; canRedo: boolean; undoTitle: string; redoTitle: string };
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <span className="undo-redo" role="group" aria-label="Hoàn tác, làm lại">
      <button
        type="button"
        className="button button--quiet sheet-toolbar__button undo-redo__button"
        disabled={!history.canUndo}
        title={`${history.undoTitle} (⌘Z)`}
        aria-label={history.undoTitle}
        onClick={onUndo}
      >
        <span aria-hidden="true">↶</span>
      </button>
      <button
        type="button"
        className="button button--quiet sheet-toolbar__button undo-redo__button"
        disabled={!history.canRedo}
        title={`${history.redoTitle} (⌘⇧Z)`}
        aria-label={history.redoTitle}
        onClick={onRedo}
      >
        <span aria-hidden="true">↷</span>
      </button>
    </span>
  );
}
