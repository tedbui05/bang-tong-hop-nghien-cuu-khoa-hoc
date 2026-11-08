"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { CellComponent, ColumnDefinition, Options, RowComponent, Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import "@/app/sheet.css";
import { effectiveFill, formatOf } from "@/lib/cell-format";
import { cellText, isInfoEdited, TITLE_COLUMN_ID } from "@/lib/columns";
import { markdownToDom } from "@/lib/markdown";
import { cellMatchesFilter, foldText, paperMatches, splitMatches, STATUS_ICON_PATHS, STATUS_LABELS, type StatusFilter } from "@/lib/sheet";
import { getLabelKey, isCellEdited, type LabelKey, type ReviewCell, type SavedPaper, type TableColumn, type TableTag } from "@/lib/types";
import { SkeletonLines, StateMessage } from "./StateMessage";

export type SheetSort = { field: string; dir: "asc" | "desc" };

export type SheetSelection = { paperId: string; field: string; count: number; cells: { paperId: string; columnId: string }[] };

type Props = {
  papers: SavedPaper[];
  columns: TableColumn[];
  tags: TableTag[];
  tagFilter: string;
  query: string;
  statusFilter: StatusFilter;
  columnFilters: Record<string, string>;
  wrap: boolean;
  zoom: number;
  sort: SheetSort | null;
  hasSelection: boolean;
  onHeaderClick: (columnId: string, anchor: DOMRect) => void;
  onColumnsMoved: (ids: string[]) => void;
  onColumnResized: (id: string, width: number) => void;
  onSelection: (selection: SheetSelection | null) => void;
  onVisibleCount: (count: number) => void;
  onEdit: (paperId: string, column: TableColumn, value: string) => void;
  onAddPaper: () => void;
};

// Thay đổi nào cần dựng lại phần tiêu đề của bảng.
function columnSignature(columns: TableColumn[]): string {
  return JSON.stringify(columns.map((column) => [column.id, column.name, column.description]));
}

function columnLetter(index: number): string {
  let letter = "";
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) letter = String.fromCharCode(65 + (n % 26)) + letter;
  return letter;
}

function textNodes(parent: HTMLElement, text: string, query: string) {
  splitMatches(text, query).forEach((part) => {
    const node = document.createElement(part.match ? "mark" : "span");
    // Luôn gán bằng textContent, không ghép chuỗi HTML.
    node.textContent = part.text;
    parent.append(node);
  });
}

function span(className: string, text?: string): HTMLElement {
  const element = document.createElement("span");
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

export function SheetGrid(props: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<Tabulator | null>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Thư viện tự chọn ô đầu tiên khi dựng bảng: chỉ mở thanh bằng chứng khi người dùng thật sự thao tác.
  const interacted = useRef(false);
  // Đang giữ chuột để kéo chọn vùng: chờ thả chuột mới mở khung bằng chứng, vì khung mở ra
  // làm bảng hẹp lại và các ô dịch chỗ ngay dưới con trỏ.
  const dragging = useRef(false);
  const shownPapers = useRef(props.papers);
  const latest = useRef(props);
  const appliedColumns = useRef(columnSignature(props.columns));

  useEffect(() => {
    latest.current = props;
  });

  // Dựng bảng một lần. Thư viện chỉ tải ở trang này và chỉ chạy trên trình duyệt.
  useEffect(() => {
    let cancelled = false;
    let table: Tabulator | null = null;
    let removeDragListener = () => {};

    import("tabulator-tables")
      .then(({ TabulatorFull }) => {
        if (cancelled || !host.current) return;
        const { papers, columns } = latest.current;

        const options = {
          height: "100%",
          layout: "fitData",
          index: "id",
          data: papers.map((paper) => toRow(paper, columns, latest.current.tags)),
          placeholder: () => emptyMessage(latest),
          movableColumns: true,
          rowHeader: {
            formatter: "rownum",
            headerSort: false,
            hozAlign: "center",
            resizable: false,
            frozen: true,
            width: isPhone() ? 34 : 46,
            cssClass: "sheet-number",
          },
          columns: buildColumns(columns, latest),
          selectableRange: 1,
          // Không tự nhảy vào ô đầu khi mở trang, để trang không tự cuộn và không cướp chỗ đang đọc.
          selectableRangeAutoFocus: false,
          selectableRangeRows: true,
          selectableRangeColumns: false,
          selectableRangeClearCells: false,
          editTriggerEvent: "dblclick",
          clipboard: "copy",
          clipboardCopyRowRange: "range",
          clipboardCopyStyled: false,
          clipboardCopyConfig: {
            columnHeaders: false,
            rowHeaders: false,
            rowGroups: false,
            columnCalcs: false,
            dataTree: false,
            formatCells: false,
          },
          // Thư viện giữ phím Tab trong bảng, làm người dùng bàn phím không ra được: trả Tab về cho trình duyệt.
          keybindings: { navPrev: false, navNext: false },
          // Mỗi ô không phải một điểm dừng của phím Tab: trong bảng đi bằng phím mũi tên.
          rowFormatter: (row: RowComponent) => {
            row.getElement().querySelectorAll(".tabulator-cell[tabindex]").forEach((cell) => cell.setAttribute("tabindex", "-1"));
          },
        } as unknown as Options;

        const built = new TabulatorFull(host.current, options);
        table = built;

        built.on("tableBuilt", () => {
          if (cancelled) return;
          tableRef.current = built;
          built.setFilter((data: { id: string }) => rowMatches(data.id, latest.current));
          refreshLetters(built);
          // Dùng phím Tab tới tiêu đề cột ngoài màn hình làm phần tiêu đề tự cuộn: kéo các dòng theo cho thẳng cột.
          const headerContents = built.element.querySelector(".tabulator-header-contents");
          const holder = built.element.querySelector(".tabulator-tableholder");
          headerContents?.addEventListener("scroll", () => {
            if (holder && holder.scrollLeft !== headerContents.scrollLeft) holder.scrollLeft = headerContents.scrollLeft;
          });
          setReady(true);
        });

        built.on("dataFiltered", (_filters: unknown, rows: RowComponent[]) => {
          latest.current.onVisibleCount(rows.length);
        });

        // Bảng đã tự đổi chỗ cột rồi: báo cho bộ nhớ và không dựng lại lần nữa.
        built.on("columnMoved", () => {
          refreshLetters(built);
          const ids = built
            .getColumns()
            .map((column) => column.getField())
            .filter(Boolean);
          const position = (column: TableColumn) => ids.indexOf(column.id);
          appliedColumns.current = columnSignature([...latest.current.columns].sort((a, b) => position(a) - position(b)));
          latest.current.onColumnsMoved(ids);
        });
        built.on("columnResized", (column) => {
          latest.current.onColumnResized(column.getField(), column.getWidth());
        });

        built.on("cellEdited", (cell: CellComponent) => {
          const column = latest.current.columns.find((item) => item.id === cell.getField());
          if (column) latest.current.onEdit(String(cell.getRow().getIndex()), column, String(cell.getValue()));
        });

        const emit = (ranges: { getCells: () => CellComponent[][] }[]) => {
          if (!interacted.current || dragging.current) return;
          const cells = ranges[0]?.getCells().flat().filter((cell) => cell.getField()) ?? [];
          if (cells.length === 0) return;
          revealCell(cells[0]);
          latest.current.onSelection({
            paperId: String(cells[0].getRow().getIndex()),
            field: cells[0].getField(),
            count: cells.length,
            cells: cells.map((cell) => ({ paperId: String(cell.getRow().getIndex()), columnId: cell.getField() })),
          });
        };
        const emitCurrent = () => emit((built as unknown as { getRanges: () => { getCells: () => CellComponent[][] }[] }).getRanges());
        (built as unknown as { on: (name: string, fn: (range: unknown) => void) => void }).on("rangeChanged", emitCurrent);
        const endDrag = () => {
          if (!dragging.current) return;
          dragging.current = false;
          emitCurrent();
        };
        window.addEventListener("mouseup", endDrag);
        removeDragListener = () => window.removeEventListener("mouseup", endDrag);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      removeDragListener();
      tableRef.current = null;
      table?.destroy();
    };
    // Chỉ dựng một lần; dữ liệu mới đi qua latest và các effect bên dưới.
  }, []);

  // Bài nào đổi nội dung hay định dạng thì chỉ vẽ lại dòng đó, không mất vùng đang chọn.
  useEffect(() => {
    const table = tableRef.current;
    const before = shownPapers.current;
    shownPapers.current = props.papers;
    if (!ready || !table || before === props.papers) return;
    props.papers.forEach((paper) => {
      if (before.find((item) => item.id === paper.id) === paper) return;
      const row = table.getRow(paper.id);
      if (!row) return;
      // Dữ liệu dòng cũng phải mới để sắp xếp, lọc và ô sửa dùng đúng chữ.
      void row.update(toRow(paper, latest.current.columns, latest.current.tags));
      row.reformat();
    });
  }, [ready, props.papers]);

  // Tìm kiếm và lọc.
  const { query, statusFilter, columnFilters, tagFilter } = props;
  useEffect(() => {
    const table = tableRef.current;
    if (!ready || !table) return;
    table.refreshFilter();
    table.getRows("active").forEach((row) => row.reformat());
  }, [ready, query, statusFilter, columnFilters, tagFilter]);

  // Hiện đủ chữ và phóng to làm đổi chiều cao dòng nên phải vẽ lại.
  const { wrap, zoom } = props;
  useEffect(() => {
    const table = tableRef.current;
    if (!ready || !table) return;
    table.redraw(true);
  }, [ready, wrap, zoom]);

  // Thêm, xoá, đổi tên hoặc đổi chỗ cột từ menu. Dữ liệu trong bảng vẫn giữ, chỉ dựng lại phần cột.
  const { columns, papers, sort, columnFilters: filters } = props;
  const signature = columnSignature(columns);
  useEffect(() => {
    const table = tableRef.current;
    if (!ready || !table || appliedColumns.current === signature) return;
    appliedColumns.current = signature;
    // Dựng lại cột làm thư viện tự chọn ô đầu tiên: bỏ vùng chọn cũ và chờ người dùng thao tác tiếp.
    interacted.current = false;
    latest.current.onSelection(null);
    const holder = table.element.querySelector(".tabulator-tableholder");
    const scrollLeft = holder?.scrollLeft ?? 0;
    table.setColumns(buildColumns(columns, latest));
    void table.replaceData(papers.map((paper) => toRow(paper, columns, latest.current.tags))).then(() => {
      if (tableRef.current !== table) return;
      refreshLetters(table);
      if (holder) holder.scrollLeft = scrollLeft;
    });
    // Chỉ dựng lại khi tiêu đề cột đổi; papers mới đi qua latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature]);

  // Ẩn hoặc hiện cột.
  const visibility = columns.map((column) => `${column.id}:${column.visible}`).join();
  useEffect(() => {
    const table = tableRef.current;
    if (!ready || !table) return;
    latest.current.columns.forEach((column) => {
      if (column.id === TITLE_COLUMN_ID) return;
      const target = table.getColumn(column.id);
      if (!target || target.isVisible() === column.visible) return;
      if (column.visible) target.show();
      else target.hide();
    });
    refreshLetters(table);
  }, [ready, visibility, signature]);

  // Sắp xếp và dấu hiệu trên tiêu đề cột.
  useEffect(() => {
    const table = tableRef.current;
    if (!ready || !table) return;
    if (sort && table.getColumn(sort.field)) table.setSort(sort.field, sort.dir);
    else table.clearSort();
    table.getColumns().forEach((column) => {
      const field = column.getField();
      const element = column.getElement();
      const dir = sort && sort.field === field ? sort.dir : null;
      element.dataset.sort = dir ?? "";
      if (dir) element.setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
      else element.removeAttribute("aria-sort");
      element.classList.toggle("sheet-col--filtered", Boolean(filters[field]));
    });
  }, [ready, sort, filters, signature]);

  // Khung bằng chứng mở ra làm bảng hẹp lại: giữ ô đang chọn trong phần nhìn thấy.
  const { hasSelection } = props;
  useEffect(() => {
    if (!ready || !hasSelection) return;
    const timer = setTimeout(() => {
      const table = tableRef.current as unknown as { getRanges: () => { getCells: () => CellComponent[][] }[] } | null;
      const cell = table?.getRanges()[0]?.getCells().flat().find((item) => item.getField());
      if (cell) revealCell(cell);
    }, 120);
    return () => clearTimeout(timer);
  }, [ready, hasSelection]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, button, select")) return;
    if (event.key === "Escape") {
      props.onSelection(null);
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    // Enter trên ô đang chọn là mở phần sửa, giống bấm đúp.
    const table = tableRef.current as unknown as { getRanges: () => { getCells: () => CellComponent[][] }[] } | null;
    const cell = table?.getRanges()[0]?.getCells().flat().find((item) => item.getField());
    if (cell && cell.getField() !== TITLE_COLUMN_ID) {
      event.preventDefault();
      cell.edit(true);
    }
  }

  if (loadFailed) {
    return (
      <StateMessage tone="error" title="Chưa mở được bảng">
        <p>Hãy kiểm tra kết nối mạng rồi tải lại trang.</p>
      </StateMessage>
    );
  }

  return (
    <div className="sheet-frame">
      {!ready ? (
        <div className="sheet-loading">
          <SkeletonLines count={6} />
        </div>
      ) : null}
      <div
        className={`sheet-host${wrap ? " sheet-host--wrap" : ""}${props.hasSelection ? "" : " sheet-host--idle"}`}
        style={{ ["--sheet-zoom" as string]: zoom }}
        onMouseDownCapture={(event) => {
          interacted.current = true;
          // Chỉ kéo chọn khi nhấn trong vùng ô; nhấn vào tiêu đề cột hay thanh cuộn thì không.
          if (event.button === 0 && (event.target as HTMLElement).closest(".tabulator-tableholder")) dragging.current = true;
        }}
        onTouchStartCapture={() => {
          interacted.current = true;
        }}
        onKeyDownCapture={() => {
          interacted.current = true;
        }}
        onKeyDown={handleKey}
      >
        <div ref={host} />
      </div>
    </div>
  );
}

// Thư viện chưa tính đến cột cố định khi cuộn: ô được chọn không được chui xuống dưới cột đó hay ra ngoài cạnh phải.
function revealCell(cell: CellComponent) {
  const element = cell.getElement();
  if (element.classList.contains("tabulator-frozen")) return;
  const frozen = element.parentElement?.querySelector(`[tabulator-field="${TITLE_COLUMN_ID}"]`);
  const holder = element.closest(".tabulator-tableholder");
  if (!frozen || !holder) return;
  const box = element.getBoundingClientRect();
  const hidden = frozen.getBoundingClientRect().right - box.left;
  const overflow = box.right - holder.getBoundingClientRect().right;
  if (hidden > 0) holder.scrollLeft -= hidden;
  else if (overflow > 0) holder.scrollLeft += Math.min(overflow, -hidden);
}

function emptyMessage(latest: RefObject<Props>): HTMLElement {
  const box = document.createElement("div");
  box.className = "sheet-empty";
  if (latest.current.papers.length > 0) {
    box.append(span("sheet-empty__text", "Không có bài nào khớp"));
    return box;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--primary";
  button.textContent = "Thêm bài báo";
  button.addEventListener("click", () => latest.current.onAddPaper());
  box.append(span("sheet-empty__text", "Chưa có bài nào. Thêm bài báo để điền vào các cột này."), button);
  return box;
}

const STATUS_CLASSES: Partial<Record<LabelKey, string>> = {
  page_corrected: "sheet-st--fix",
  needs_review: "sheet-st--warn",
  not_found: "sheet-st--none",
};

function statusIcon(label: LabelKey): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", `sheet-icon sheet-icon--${label}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", STATUS_LABELS[label]);
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = STATUS_LABELS[label];
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", STATUS_ICON_PATHS[label]);
  svg.append(title, path);
  return svg;
}

function isPhone() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function refreshLetters(table: Tabulator) {
  table
    .getColumns()
    .filter((column) => column.getField() && column.isVisible())
    .forEach((column, index) => {
      const letter = column.getElement().querySelector(".sheet-letter");
      if (letter) letter.textContent = columnLetter(index);
    });
}

function toRow(paper: SavedPaper, columns: TableColumn[], tags: TableTag[]) {
  const row: Record<string, string> = { id: paper.id };
  columns.forEach((column) => {
    row[column.id] = cellText(paper, column, tags);
  });
  return row;
}

function findPaper(id: string, papers: SavedPaper[]) {
  return papers.find((paper) => paper.id === id);
}

function rowMatches(id: string, props: Props): boolean {
  const paper = findPaper(id, props.papers);
  if (!paper) return false;
  const tagNames = (paper.tags ?? []).map((id) => props.tags.find((tag) => tag.id === id)?.name ?? "");
  if (!paperMatches(paper, foldText(props.query), tagNames)) return false;
  if (props.tagFilter && !(paper.tags ?? []).includes(props.tagFilter)) return false;
  if (props.statusFilter !== "all" && !paper.cells.some((cell) => getLabelKey(cell) === props.statusFilter)) return false;
  return Object.entries(props.columnFilters).every(([field, value]) => {
    const needle = foldText(value);
    if (!needle) return true;
    const column = props.columns.find((item) => item.id === field);
    return column ? foldText(cellText(paper, column, props.tags)).includes(needle) : true;
  });
}

function buildColumns(columns: TableColumn[], latest: RefObject<Props>): ColumnDefinition[] {
  const phone = isPhone();
  return columns.map((column) => {
    const isTitle = column.id === TITLE_COLUMN_ID;
    return {
      title: column.name,
      field: column.id,
      frozen: isTitle,
      visible: isTitle || column.visible,
      cssClass: column.infoKey === "year" ? "sheet-col--num" : undefined,
      hozAlign: column.infoKey === "year" ? "right" : "left",
      width: column.width ?? defaultWidth(column, phone),
      titleFormatter: () => headerTitle(column, latest),
      formatter: (cell: CellComponent) => {
        const content = isTitle ? formatTitle(cell, latest) : formatData(cell, column, latest);
        applyFormat(cell, column, latest);
        return content;
      },
      // Bấm tiêu đề là mở menu; sắp xếp nằm trong menu.
      headerSort: false,
      sorter: (a: string, b: string) => a.localeCompare(b, "vi", { numeric: true }),
      // Tên bài không sửa trong bảng; nhãn chọn trong khung bên phải; ghi chú sửa được nhiều dòng.
      editor: isTitle || column.kind === "tags" ? undefined : column.kind === "note" ? noteEditor : overlayEditor,
    };
  }) as unknown as ColumnDefinition[];
}

function defaultWidth(column: TableColumn, phone: boolean): number {
  if (column.id === TITLE_COLUMN_ID) return phone ? 148 : 320;
  if (column.infoKey === "year") return 88;
  if (column.infoKey === "language") return 124;
  if (column.infoKey) return phone ? 160 : 200;
  return phone ? 200 : 240;
}

// Tên cột là một nút thật, để bàn phím cũng mở được menu. Kéo nút này vẫn đổi được chỗ cột.
function headerTitle(column: TableColumn, latest: RefObject<Props>): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "sheet-head";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sheet-head__title";
  button.dataset.column = column.id;
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-label", `Mở menu cột ${column.name}`);
  button.append(span("sheet-head__name", column.name), span("sheet-head__marks"));

  // Vừa kéo đổi chỗ cột xong thì không mở menu.
  let downX = 0;
  button.addEventListener("mousedown", (event) => {
    downX = event.clientX;
  });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.detail > 0 && Math.abs(event.clientX - downX) > 4) return;
    latest.current.onHeaderClick(column.id, button.getBoundingClientRect());
  });
  // Có sẵn một ký tự trống: thư viện đo chiều cao tiêu đề trước khi chữ A, B, C được điền vào.
  wrapper.append(span("sheet-letter", "\u00A0"), button);
  return wrapper;
}

function formatTitle(cell: CellComponent, latest: RefObject<Props>) {
  const { papers, query } = latest.current;
  const paper = findPaper(String(cell.getRow().getIndex()), papers);
  const title = span("source-text sheet-title");
  if (!paper) return title;
  title.lang = paper.language_code;
  title.translate = false;
  textNodes(title, paper.info.title, query);
  return title;
}

// Định dạng do sinh viên tự làm. Ô đã tô màu thì bỏ nền trạng thái, trạng thái chỉ còn biểu tượng ở góc.
function applyFormat(cell: CellComponent, column: TableColumn, latest: RefObject<Props>) {
  const element = cell.getElement();
  const paper = findPaper(String(cell.getRow().getIndex()), latest.current.papers);
  const format = paper ? formatOf(paper, column.id) : {};
  const fill = paper ? effectiveFill(paper, column.id) : null;
  [...element.classList].filter((name) => /^sheet-(fill|tc)--/.test(name)).forEach((name) => element.classList.remove(name));
  element.classList.toggle("sheet-cell--bold", Boolean(format.bold));
  element.classList.toggle("sheet-cell--italic", Boolean(format.italic));
  element.classList.toggle("sheet-cell--underline", Boolean(format.underline));
  element.classList.toggle("sheet-cell--filled", Boolean(fill));
  if (fill) element.classList.add(`sheet-fill--${fill}`);
  if (format.color) element.classList.add(`sheet-tc--${format.color}`);
}

function formatData(cell: CellComponent, column: TableColumn, latest: RefObject<Props>) {
  const { papers, query, statusFilter } = latest.current;
  const paper = findPaper(String(cell.getRow().getIndex()), papers);
  const element = cell.getElement();
  const wrapper = document.createDocumentFragment();
  const unfilled = () => {
    wrapper.append(span("sheet-text sheet-muted", "chưa điền"));
    return wrapper as unknown as HTMLElement;
  };

  if (!paper) return unfilled();

  if (column.kind === "note") {
    return paper.note?.trim() ? markdownToDom(paper.note) : span("sheet-text");
  }

  if (column.kind === "tags") {
    const list = span("sheet-text sheet-tags");
    (paper.tags ?? []).forEach((id) => {
      const tag = latest.current.tags.find((item) => item.id === id);
      if (tag) list.append(span(`sheet-tag sheet-tag--${tag.color}`, tag.name));
    });
    return list;
  }

  if (column.kind === "info") {
    const value = cellText(paper, column);
    if (!value) return unfilled();
    const text = span("sheet-text");
    text.translate = false;
    if (isInfoEdited(paper, column)) text.append(span("sheet-edited", "đã sửa"), " ");
    textNodes(text, value, query);
    wrapper.append(text);
    return wrapper as unknown as HTMLElement;
  }

  const model: ReviewCell | undefined = paper.cells.find((item) => item.column === column.id);
  element.classList.toggle("sheet-cell--dim", !cellMatchesFilter(model, statusFilter));
  Object.values(STATUS_CLASSES).forEach((name) => element.classList.remove(name));
  if (!model) return unfilled();

  const label = getLabelKey(model);
  const edited = isCellEdited(model);
  const statusClass = STATUS_CLASSES[label];
  if (statusClass) element.classList.add(statusClass);
  if (label === "needs_review") wrapper.append(span("sheet-flag"));
  const text = span(label === "not_found" && !edited ? "sheet-text sheet-text--none" : "sheet-text");
  text.append(statusIcon(label));
  if (edited) text.append(span("sheet-edited", "đã sửa"), " ");
  textNodes(text, model.value_vi, query);
  wrapper.append(text);
  return wrapper as unknown as HTMLElement;
}

type EditorArgs = [CellComponent, (fn: () => void) => void, (value: string) => void, () => void];

function overlayEditor(...args: EditorArgs) {
  return floatingEditor(false, ...args);
}

// Ghi chú: giữ xuống dòng để viết gạch đầu dòng, được để trống. Shift + Enter xuống dòng.
function noteEditor(...args: EditorArgs) {
  return floatingEditor(true, ...args);
}

// Ô sửa nổi phía trên bảng, để sửa được cả câu dài khi đang thu gọn một dòng.
function floatingEditor(
  multiline: boolean,
  cell: CellComponent,
  onRendered: (fn: () => void) => void,
  success: (value: string) => void,
  cancel: () => void,
) {
  const placeholder = span("sheet-edit-placeholder");
  const area = document.createElement("textarea");
  area.className = "sheet-editor";
  area.name = "sua-o";
  area.autocomplete = "off";
  area.value = String(cell.getValue() ?? "");
  area.setAttribute("aria-label", multiline ? "Sửa ghi chú, viết bằng Markdown" : "Sửa nội dung ô");
  if (multiline) area.placeholder = "**đậm**, *nghiêng*, - gạch đầu dòng, [chữ](https://…). Shift + Enter để xuống dòng.";
  let finished = false;

  const close = () => {
    finished = true;
    area.remove();
    holder?.removeEventListener("scroll", commit);
  };

  const holder = cell.getElement().closest(".tabulator-tableholder");

  function place() {
    const rect = cell.getElement().getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 16);
    area.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    area.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - 168))}px`;
    area.style.width = `${width}px`;
  }

  function commit() {
    if (finished) return;
    const value = multiline ? area.value.replace(/\s+$/, "") : area.value.replace(/\s*\n\s*/g, " ").replace(/\t/g, " ").trim();
    // Ô nội dung không được để trống: bỏ thay đổi thay vì xóa mất nội dung. Ghi chú thì được xoá trống.
    if ((!value && !multiline) || value === String(cell.getValue() ?? "")) {
      close();
      cancel();
      return;
    }
    close();
    success(value);
  }

  area.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.isComposing) return;
    if (event.key === "Enter" && !(multiline && event.shiftKey)) {
      event.preventDefault();
      commit();
      (cell.getElement().closest(".tabulator-tableholder") as HTMLElement | null)?.focus({ preventScroll: true });
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
      cancel();
    }
  });
  area.addEventListener("blur", commit);

  onRendered(() => {
    place();
    document.body.append(area);
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
    // Chờ thư viện cuộn xong theo cú bấm vừa rồi, sau đó cuộn bảng mới là lưu và đóng ô sửa.
    setTimeout(() => {
      if (finished) return;
      place();
      holder?.addEventListener("scroll", commit);
    }, 150);
  });

  return placeholder;
}
