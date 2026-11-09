"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addHighlightRange, withFormat, withRowFill } from "./cell-format";
import { moveColumn as moveInList, reorderColumns as reorderList, TITLE_COLUMN_ID } from "./columns";
import { logEvent } from "./events";
import { reviewCells, reviewPaper, sampleTable, toReviewCells } from "./sample-data";
import type { FillKey, TagColorKey } from "./palette";
import type { PdfPage } from "./pdf-read";
import { getLabelKey, type CellFormat, type FilledBy, type Highlight, type Paper, type PaperInfo, type ReviewCell, type SavedPaper, type SheetTable, type TableColumn } from "./types";

// Bản xem thử giữ dữ liệu trong trình duyệt để tải lại trang không mất bảng và định dạng.
// Khi có cơ sở dữ liệu thì thay phần đọc và ghi này. Bài đang duyệt dở không được giữ.
const STORAGE_KEY = "tcb-bang-v1";

function readSaved(): { tables: SheetTable[]; activeId: string | null } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const valid =
      Array.isArray(data?.tables) &&
      data.tables.every((table: SheetTable) => table?.id && table?.name && Array.isArray(table?.columns) && Array.isArray(table?.papers));
    return valid ? { tables: data.tables, activeId: data.activeId ?? null } : null;
  } catch {
    return null;
  }
}

export type CellTarget = { paperId: string; columnId: string };

export type ReviewSession = {
  tableId: string;
  paper: Paper;
  fileName: string | null;
  // Chữ của từng trang trong file vừa tải, để sau này kiểm tra câu trích. Không lưu vào localStorage.
  pages: PdfPage[] | null;
  cells: ReviewCell[];
  infoConfirmed: boolean;
};

type ColumnChange = Partial<Pick<TableColumn, "name" | "description" | "visible" | "width">>;

type Store = {
  tables: SheetTable[];
  activeTable: SheetTable | null;
  setActiveTable: (id: string) => void;
  createTable: (name: string, description: string, columns: TableColumn[]) => void;
  // Các thao tác với cột luôn áp dụng cho bảng đang mở.
  addColumn: (column: TableColumn) => void;
  changeColumn: (id: string, change: ColumnChange) => void;
  deleteColumn: (id: string) => void;
  moveColumn: (id: string, offset: number) => void;
  reorderColumns: (ids: string[]) => void;
  review: ReviewSession | null;
  savedTitle: string | null;
  // filledBy: model AI đã điền bài. Bản xem thử chưa nối AI nên chưa truyền vào.
  startReview: (fileName: string | null, pages?: PdfPage[] | null, filledBy?: FilledBy) => void;
  updateCell: (index: number, change: Partial<Pick<ReviewCell, "value_vi" | "review">>) => void;
  updateInfo: (info: PaperInfo) => void;
  setInfoConfirmed: (confirmed: boolean) => void;
  saveReview: () => boolean;
  // Sửa một ô đã lưu ngay trong bảng tổng hợp.
  editSavedCell: (paperId: string, column: TableColumn, value: string) => void;
  // Các thao tác dưới đây không đổi nội dung ô nên không ghi là "ô bị sửa".
  formatCells: (targets: CellTarget[], change: (current: CellFormat) => Partial<CellFormat>) => void;
  fillRows: (paperIds: string[], fill: FillKey | null) => void;
  addHighlight: (target: CellTarget, highlight: Highlight) => void;
  removeHighlight: (target: CellTarget, highlight: Highlight) => void;
  clearHighlights: (target: CellTarget) => void;
  updateHighlights: (target: CellTarget, highlights: Highlight[]) => void;
  createTag: (name: string, color: TagColorKey) => string;
  toggleTag: (paperId: string, tagId: string) => void;
  deleteTag: (tagId: string) => void;
  // Đã đọc xong dữ liệu trong trình duyệt chưa.
  hydrated: boolean;
  saveFailed: boolean;
  resetData: () => void;
};

const StoreContext = createContext<Store | null>(null);

function manualCell(column: string, value: string): ReviewCell {
  return {
    column,
    value_vi: value,
    quote_original: null,
    quote_vi: null,
    page: null,
    status: "manual",
    check: null,
    ai_page: null,
    suggested_value: value,
    review: "confirmed",
  };
}

function editCell(paper: SavedPaper, column: TableColumn, value: string): SavedPaper {
  if (column.kind === "note") return { ...paper, note: value };
  if (column.infoKey) {
    // Tên bài chỉ sửa được ở bước duyệt.
    if (column.id === TITLE_COLUMN_ID) return paper;
    return { ...paper, info: { ...paper.info, [column.infoKey]: value } };
  }
  const existing = paper.cells.find((cell) => cell.column === column.id);
  if (!existing) return { ...paper, cells: [...paper.cells, manualCell(column.id, value)] };
  // Nội dung đổi thì vị trí đoạn tô sáng cũ không còn đúng; câu trích gốc không đổi nên giữ nguyên.
  const highlights = { ...paper.highlights };
  if (highlights[column.id]) highlights[column.id] = highlights[column.id].filter((item) => item.field === "quote");
  return {
    ...paper,
    highlights,
    cells: paper.cells.map((cell) => {
      if (cell !== existing) return cell;
      if (cell.status === "manual") return manualCell(column.id, value);
      return { ...cell, value_vi: value, review: value === cell.suggested_value ? "confirmed" : "edited" };
    }),
  };
}

function withoutColumn(paper: SavedPaper, column: TableColumn): SavedPaper {
  const formats = { ...paper.formats };
  const highlights = { ...paper.highlights };
  delete formats[column.id];
  delete highlights[column.id];
  const base = { ...paper, formats, highlights };
  if (column.kind === "note") return { ...base, note: undefined };
  if (column.kind === "tags") return { ...base, tags: [] };
  if (column.infoKey) return { ...base, ...infoWithout(paper, column) };
  return { ...base, cells: paper.cells.filter((cell) => cell.column !== column.id) };
}

function infoWithout(paper: Paper, column: TableColumn): Pick<Paper, "info" | "suggested_info"> {
  const drop = (info: PaperInfo): PaperInfo => {
    const next = { ...info };
    if (column.infoKey && column.infoKey !== "title") delete next[column.infoKey];
    return next;
  };
  return { info: drop(paper.info), suggested_info: drop(paper.suggested_info) };
}

function sortCells(cells: ReviewCell[], columns: TableColumn[]): ReviewCell[] {
  const position = (cell: ReviewCell) => columns.findIndex((column) => column.id === cell.column);
  return [...cells].sort((a, b) => position(a) - position(b));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tables, setTables] = useState<SheetTable[]>([sampleTable]);
  const [activeId, setActiveId] = useState<string | null>(sampleTable.id);
  const [review, setReview] = useState<ReviewSession | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const skipReset = useRef(false);

  // Máy chủ không có dữ liệu trình duyệt nên chỉ đọc được sau khi trang đã hiện.
  useEffect(() => {
    const saved = readSaved();
    /* eslint-disable react-hooks/set-state-in-effect -- phải đọc sau khi hiện trang để khớp với máy chủ */
    if (saved) {
      setTables(saved.tables);
      setActiveId(saved.activeId);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated || skipReset.current) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tables, activeId }));
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [hydrated, tables, activeId]);

  const resetData = useCallback(() => {
    skipReset.current = true;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Trình duyệt chặn bộ nhớ thì tải lại cũng về dữ liệu mẫu.
    }
    window.location.reload();
  }, []);

  const activeTable = useMemo(() => tables.find((table) => table.id === activeId) ?? null, [tables, activeId]);

  const updateActive = useCallback(
    (change: (table: SheetTable) => SheetTable) => {
      setTables((current) => current.map((table) => (table.id === activeId ? change(table) : table)));
    },
    [activeId],
  );

  const setActiveTable = useCallback((id: string) => {
    setSavedTitle(null);
    setActiveId(id);
  }, []);

  const createTable = useCallback<Store["createTable"]>((name, description, columns) => {
    const id = `bang-${crypto.randomUUID()}`;
    setTables((current) => [...current, { id, name, description, columns, papers: [] }]);
    setSavedTitle(null);
    setActiveId(id);
  }, []);

  const addColumn = useCallback<Store["addColumn"]>(
    (column) => updateActive((table) => ({ ...table, columns: [...table.columns, column] })),
    [updateActive],
  );

  const changeColumn = useCallback<Store["changeColumn"]>(
    (id, change) =>
      updateActive((table) => ({
        ...table,
        columns: table.columns.map((column) => (column.id === id ? { ...column, ...change } : column)),
      })),
    [updateActive],
  );

  // Xoá cột là xoá luôn dữ liệu của cột trong mọi bài, kể cả bài đang duyệt dở của bảng này.
  const deleteColumn = useCallback<Store["deleteColumn"]>(
    (id) => {
      if (id === TITLE_COLUMN_ID || !activeId) return;
      const column = activeTable?.columns.find((item) => item.id === id);
      if (!column) return;
      updateActive((table) => ({
        ...table,
        columns: table.columns.filter((item) => item.id !== id),
        papers: table.papers.map((paper) => withoutColumn(paper, column)),
      }));
      setReview(
        (current) =>
          current &&
          (current.tableId !== activeId
            ? current
            : {
                ...current,
                cells: current.cells.filter((cell) => cell.column !== id),
                paper: { ...current.paper, ...infoWithout(current.paper, column) },
              }),
      );
    },
    [activeId, activeTable, updateActive],
  );

  const applyOrder = useCallback(
    (columns: TableColumn[]) => {
      updateActive((table) => ({ ...table, columns }));
      setReview((current) =>
        current && current.tableId === activeId ? { ...current, cells: sortCells(current.cells, columns) } : current,
      );
    },
    [activeId, updateActive],
  );

  const moveColumn = useCallback<Store["moveColumn"]>(
    (id, offset) => {
      if (activeTable) applyOrder(moveInList(activeTable.columns, id, offset));
    },
    [activeTable, applyOrder],
  );

  const reorderColumns = useCallback<Store["reorderColumns"]>(
    (ids) => {
      if (activeTable) applyOrder(reorderList(activeTable.columns, ids));
    },
    [activeTable, applyOrder],
  );

  const editSavedCell = useCallback<Store["editSavedCell"]>(
    (paperId, column, value) => {
      // Ghi chú là chữ riêng của sinh viên, không phải đề xuất của AI nên không tính vào chỉ số.
      if (column.kind !== "note") logEvent("o_bi_sua", { cot: column.id, bai: paperId, noi: "bang" });
      updateActive((table) => ({
        ...table,
        papers: table.papers.map((paper) => (paper.id === paperId ? editCell(paper, column, value) : paper)),
      }));
    },
    [updateActive],
  );

  const updatePapers = useCallback(
    (paperIds: string[], change: (paper: SavedPaper) => SavedPaper) => {
      updateActive((table) => ({
        ...table,
        papers: table.papers.map((paper) => (paperIds.includes(paper.id) ? change(paper) : paper)),
      }));
    },
    [updateActive],
  );

  const formatCells = useCallback<Store["formatCells"]>(
    (targets, change) => {
      updateActive((table) => ({
        ...table,
        papers: table.papers.map((paper) =>
          targets
            .filter((target) => target.paperId === paper.id)
            .reduce((current, target) => withFormat(current, target.columnId, change(current.formats?.[target.columnId] ?? {})), paper),
        ),
      }));
    },
    [updateActive],
  );

  const fillRows = useCallback<Store["fillRows"]>((paperIds, fill) => updatePapers(paperIds, (paper) => withRowFill(paper, fill)), [updatePapers]);

  const addHighlight = useCallback<Store["addHighlight"]>(
    ({ paperId, columnId }, highlight) =>
      updatePapers([paperId], (paper) => ({
        ...paper,
        highlights: { ...paper.highlights, [columnId]: addHighlightRange(paper.highlights?.[columnId] ?? [], highlight) },
      })),
    [updatePapers],
  );

  const removeHighlight = useCallback<Store["removeHighlight"]>(
    ({ paperId, columnId }, highlight) =>
      updatePapers([paperId], (paper) => ({
        ...paper,
        highlights: {
          ...paper.highlights,
          [columnId]: (paper.highlights?.[columnId] ?? []).filter(
            (item) => !(item.field === highlight.field && item.start === highlight.start),
          ),
        },
      })),
    [updatePapers],
  );

  const clearHighlights = useCallback<Store["clearHighlights"]>(
    ({ paperId, columnId }) =>
      updatePapers([paperId], (paper) => {
        const highlights = { ...paper.highlights };
        delete highlights[columnId];
        return { ...paper, highlights };
      }),
    [updatePapers],
  );

  const updateHighlights = useCallback<Store["updateHighlights"]>(
    ({ paperId, columnId }, list) =>
      updatePapers([paperId], (paper) => ({ ...paper, highlights: { ...paper.highlights, [columnId]: list } })),
    [updatePapers],
  );

  const createTag = useCallback<Store["createTag"]>(
    (name, color) => {
      const id = `nhan-${crypto.randomUUID()}`;
      updateActive((table) => ({ ...table, tags: [...(table.tags ?? []), { id, name, color }] }));
      return id;
    },
    [updateActive],
  );

  const toggleTag = useCallback<Store["toggleTag"]>(
    (paperId, tagId) =>
      updatePapers([paperId], (paper) => ({
        ...paper,
        tags: paper.tags?.includes(tagId) ? paper.tags.filter((id) => id !== tagId) : [...(paper.tags ?? []), tagId],
      })),
    [updatePapers],
  );

  const deleteTag = useCallback<Store["deleteTag"]>(
    (tagId) =>
      updateActive((table) => ({
        ...table,
        tags: (table.tags ?? []).filter((tag) => tag.id !== tagId),
        papers: table.papers.map((paper) => ({ ...paper, tags: (paper.tags ?? []).filter((id) => id !== tagId) })),
      })),
    [updateActive],
  );

  // Bản xem thử chưa có AI: chỉ những cột trùng với bài mẫu mới có đề xuất, cột khác để "chưa điền".
  const startReview = useCallback(
    (fileName: string | null, pages: PdfPage[] | null = null, filledBy?: FilledBy) => {
      // Chưa đọc xong dữ liệu đã lưu thì chưa biết bảng nào đang mở, tránh lưu nhầm vào bảng mẫu.
      if (!activeTable || !hydrated) return;
      const { columns } = activeTable;
      const contentIds = columns.filter((column) => column.kind === "content").map((column) => column.id);
      const cells = sortCells(
        toReviewCells(reviewCells).filter((cell) => contentIds.includes(cell.column)),
        columns,
      );
      const keepInfo = (info: PaperInfo): PaperInfo => {
        const next: PaperInfo = { title: info.title };
        columns.forEach((column) => {
          if (column.infoKey && column.infoKey !== "title") next[column.infoKey] = info[column.infoKey];
        });
        return next;
      };
      if (fileName) {
        logEvent("tai_bai", {
          so_o: cells.length,
          so_trang: pages?.length ?? 0,
          ...(filledBy ? { model: filledBy.model, du_phong: filledBy.fallback ? 1 : 0 } : {}),
        });
        if (filledBy?.fallback) logEvent("dung_model_du_phong", { model: filledBy.model });
        cells
          .filter((cell) => getLabelKey(cell) === "needs_review")
          .forEach((cell) => logEvent("o_can_kiem_tra", { cot: cell.column }));
      }
      setSavedTitle(null);
      setReview({
        tableId: activeTable.id,
        // Mỗi lần đọc là một bài mới có mã riêng. Dùng chung mã thì bài sau ghi đè bài trước,
        // vì bản xem thử luôn trả về cùng một bài mẫu.
        paper: {
          ...reviewPaper,
          id: `bai-${crypto.randomUUID()}`,
          info: keepInfo(reviewPaper.info),
          suggested_info: keepInfo(reviewPaper.suggested_info),
          ...(filledBy ? { filled_by: filledBy } : {}),
        },
        fileName,
        pages,
        cells,
        infoConfirmed: false,
      });
    },
    [activeTable, hydrated],
  );

  const updateCell = useCallback<Store["updateCell"]>((index, change) => {
    setReview(
      (current) =>
        current && {
          ...current,
          cells: current.cells.map((cell, i) => (i === index ? { ...cell, ...change } : cell)),
        },
    );
  }, []);

  const updateInfo = useCallback<Store["updateInfo"]>((info) => {
    setReview((current) => current && { ...current, paper: { ...current.paper, info } });
  }, []);

  const setInfoConfirmed = useCallback<Store["setInfoConfirmed"]>((infoConfirmed) => {
    setReview((current) => current && { ...current, infoConfirmed });
  }, []);

  const saveReview = useCallback(() => {
    // AI chỉ đề xuất: còn ô chưa duyệt hoặc chưa xác nhận thông tin bài thì không được lưu.
    if (!review || !review.infoConfirmed || review.cells.some((cell) => cell.review === "pending")) return false;

    review.cells.forEach((cell) =>
      logEvent(cell.review === "edited" ? "o_bi_sua" : "o_giu_nguyen", { cot: cell.column, noi: "duyet" }),
    );
    (Object.keys(review.paper.info) as (keyof PaperInfo)[]).forEach((key) =>
      logEvent(review.paper.info[key] !== review.paper.suggested_info[key] ? "o_bi_sua" : "o_giu_nguyen", {
        cot: `info-${key}`,
        noi: "duyet",
      }),
    );
    logEvent("bam_luu_vao_bang", { bai: review.paper.id });

    const saved: SavedPaper = { ...review.paper, cells: review.cells };
    setTables((current) =>
      current.map((table) =>
        table.id === review.tableId
          ? { ...table, papers: [...table.papers.filter((paper) => paper.id !== saved.id), saved] }
          : table,
      ),
    );
    setActiveId(review.tableId);
    setSavedTitle(saved.info.title);
    setReview(null);
    return true;
  }, [review]);

  const value = useMemo(
    () => ({
      tables,
      activeTable,
      setActiveTable,
      createTable,
      addColumn,
      changeColumn,
      deleteColumn,
      moveColumn,
      reorderColumns,
      review,
      savedTitle,
      startReview,
      updateCell,
      updateInfo,
      setInfoConfirmed,
      saveReview,
formatCells,
      fillRows,
      addHighlight,
      removeHighlight,
      clearHighlights,
      updateHighlights,
      createTag,
      toggleTag,
      deleteTag,
      hydrated,
      saveFailed,
      resetData,
      editSavedCell,
    }),
    [
      tables,
      activeTable,
      setActiveTable,
      createTable,
      addColumn,
      changeColumn,
      deleteColumn,
      moveColumn,
      reorderColumns,
      review,
      savedTitle,
      startReview,
      updateCell,
      updateInfo,
      setInfoConfirmed,
      saveReview,
formatCells,
      fillRows,
      addHighlight,
      removeHighlight,
      clearHighlights,
      updateHighlights,
      createTag,
      toggleTag,
      deleteTag,
      hydrated,
      saveFailed,
      resetData,
      editSavedCell,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore phải nằm trong StoreProvider");
  return store;
}
