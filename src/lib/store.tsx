"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { moveColumn as moveInList, reorderColumns as reorderList, TITLE_COLUMN_ID } from "./columns";
import { logEvent } from "./events";
import { reviewCells, reviewPaper, sampleTable, toReviewCells } from "./sample-data";
import { getLabelKey, type Paper, type PaperInfo, type ReviewCell, type SavedPaper, type SheetTable, type TableColumn } from "./types";

// Bộ nhớ tạm cho bản xem thử: tải lại trang là về dữ liệu mẫu ban đầu.
export type ReviewSession = {
  tableId: string;
  paper: Paper;
  fileName: string | null;
  cells: ReviewCell[];
  infoConfirmed: boolean;
};

type ColumnChange = Partial<Pick<TableColumn, "name" | "description" | "visible" | "width">>;

type Store = {
  tables: SheetTable[];
  activeTable: SheetTable | null;
  setActiveTable: (id: string) => void;
  createTable: (name: string, columns: TableColumn[]) => void;
  // Các thao tác với cột luôn áp dụng cho bảng đang mở.
  addColumn: (column: TableColumn) => void;
  changeColumn: (id: string, change: ColumnChange) => void;
  deleteColumn: (id: string) => void;
  moveColumn: (id: string, offset: number) => void;
  reorderColumns: (ids: string[]) => void;
  review: ReviewSession | null;
  savedTitle: string | null;
  startReview: (fileName: string | null) => void;
  updateCell: (index: number, change: Partial<Pick<ReviewCell, "value_vi" | "review">>) => void;
  updateInfo: (info: PaperInfo) => void;
  setInfoConfirmed: (confirmed: boolean) => void;
  saveReview: () => boolean;
  // Sửa một ô đã lưu ngay trong bảng tổng hợp.
  editSavedCell: (paperId: string, column: TableColumn, value: string) => void;
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
  if (column.infoKey) {
    // Tên bài chỉ sửa được ở bước duyệt.
    if (column.id === TITLE_COLUMN_ID) return paper;
    return { ...paper, info: { ...paper.info, [column.infoKey]: value } };
  }
  const existing = paper.cells.find((cell) => cell.column === column.id);
  if (!existing) return { ...paper, cells: [...paper.cells, manualCell(column.id, value)] };
  return {
    ...paper,
    cells: paper.cells.map((cell) => {
      if (cell !== existing) return cell;
      if (cell.status === "manual") return manualCell(column.id, value);
      return { ...cell, value_vi: value, review: value === cell.suggested_value ? "confirmed" : "edited" };
    }),
  };
}

function withoutColumn(paper: SavedPaper, column: TableColumn): SavedPaper {
  if (column.infoKey) return { ...paper, ...infoWithout(paper, column), cells: paper.cells };
  return { ...paper, cells: paper.cells.filter((cell) => cell.column !== column.id) };
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

  const createTable = useCallback<Store["createTable"]>((name, columns) => {
    const id = `bang-${crypto.randomUUID()}`;
    setTables((current) => [...current, { id, name, columns, papers: [] }]);
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
      logEvent("o_bi_sua", { cot: column.id, bai: paperId, noi: "bang" });
      updateActive((table) => ({
        ...table,
        papers: table.papers.map((paper) => (paper.id === paperId ? editCell(paper, column, value) : paper)),
      }));
    },
    [updateActive],
  );

  // Bản xem thử chưa có AI: chỉ những cột trùng với bài mẫu mới có đề xuất, cột khác để "chưa điền".
  const startReview = useCallback(
    (fileName: string | null) => {
      if (!activeTable) return;
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
        logEvent("tai_bai", { so_o: cells.length });
        cells
          .filter((cell) => getLabelKey(cell) === "needs_review")
          .forEach((cell) => logEvent("o_can_kiem_tra", { cot: cell.column }));
      }
      setSavedTitle(null);
      setReview({
        tableId: activeTable.id,
        paper: { ...reviewPaper, info: keepInfo(reviewPaper.info), suggested_info: keepInfo(reviewPaper.suggested_info) },
        fileName,
        cells,
        infoConfirmed: false,
      });
    },
    [activeTable],
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
