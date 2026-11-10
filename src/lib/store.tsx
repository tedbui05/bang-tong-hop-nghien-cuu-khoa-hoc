"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addHighlightRange, withFormat, withRowFill } from "./cell-format";
import { moveColumn as moveInList, reorderColumns as reorderList, TITLE_COLUMN_ID } from "./columns";
import { chooseStart, fromRows, isEmptyPlan, planSync, snapshotOf, type Snapshot } from "./cloud-sync";
import { logEvent, scheduleFlush, setEventSender } from "./events";
import { isAppSamplePaper } from "./app-sample";
import { isSaveShortcut } from "./save-status";
import { reviewCells, reviewPaper, sampleTable, toReviewCells } from "./sample-data";
import { isSamplePaper, nextActiveAfterDelete, removePapers, restorePapers, SAMPLE_TABLE_ID, startingTables, type RemovedPapers } from "./table-ops";
import type { FillKey, TagColorKey } from "./palette";
import { clearPaperFiles, deletePaperFiles, deletePending, fileHash, loadAllPending, loadPages, savePages, savePdf, savePending } from "./paper-files";
import { canQuickApprove, pruneToColumns, type QueueError, type ReviewSession } from "./paper-pipeline";
import { readPdfInBrowser } from "./pdf-browser";
import { processPaper, type FileMeta } from "./process-paper";
import { cloudConfigured, currentUserId, getAccessToken, sendEvents, supabaseRemote } from "./supabase-browser";
import { getLabelKey, type CellFormat, type Highlight, type Paper, type PaperInfo, type ReviewCell, type SavedPaper, type SheetTable, type TableColumn } from "./types";

// Bản xem thử giữ dữ liệu trong trình duyệt để tải lại trang không mất bảng và định dạng.
// Khi có cơ sở dữ liệu thì thay phần đọc và ghi này. Bài AI đã điền nhưng chưa lưu vào bảng (kể cả phần đã duyệt dở)
// được giữ riêng trong IndexedDB (paper-files.ts), vì mất là tốn thêm một lượt AI.
const STORAGE_KEY = "tcb-bang-v1";
// Có thay đổi trên trình duyệt chưa lưu lên máy chủ (ví dụ lúc mất mạng). Mở lại app thì gửi bản trình duyệt lên trước.
const DIRTY_KEY = "tcb-bang-chua-luu-may-chu";
// Người dùng mới bắt đầu từ bảng trống (không còn tự tạo Bảng mẫu, người dùng chọn ngày 10/11/2026).
const PRISTINE = "[]";
// Thông báo "Hoàn tác" hiện 8 giây. File PDF của bài vừa xoá được giữ lâu hơn một chút rồi mới xoá khỏi IndexedDB.
export const UNDO_SECONDS = 8;
const UNDO_FILE_GRACE_MS = (UNDO_SECONDS + 7) * 1000;

// Trạng thái lưu lên máy chủ (Supabase). local: chưa cài Supabase hoặc chưa có dữ liệu riêng nên chỉ giữ trên trình duyệt.
export type CloudState = "local" | "loading" | "saving" | "saved" | "offline" | "error";

function readDirty(): boolean {
  try {
    return window.localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDirty(dirty: boolean) {
  try {
    if (dirty) window.localStorage.setItem(DIRTY_KEY, "1");
    else window.localStorage.removeItem(DIRTY_KEY);
  } catch {
    // Trình duyệt chặn bộ nhớ: bỏ qua.
  }
}

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

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

export type { ReviewSession } from "./paper-pipeline";

// Một bài trong hàng chờ ở trang tải bài. Mỗi lần chỉ xử lý một bài, theo thứ tự.
// waiting: chờ đến lượt. reading: đọc chữ của PDF. ai: chờ AI. checking: kiểm tra câu trích.
// ready: chờ sinh viên duyệt. saved: đã lưu vào bảng. error: có lỗi, xem error.
export type QueueStatus = "waiting" | "reading" | "ai" | "checking" | "ready" | "saved" | "error";

export type QueueItem = {
  id: string;
  tableId: string;
  fileName: string;
  size: number;
  status: QueueStatus;
  // Lúc bắt đầu chờ AI, để đổi dòng chữ sau 60 giây.
  aiStartedAt?: number;
  error?: QueueError;
  session?: ReviewSession;
  // Bài mẫu của bản xem thử: không giữ trong IndexedDB.
  sample?: boolean;
  // File PDF và chữ của trang đã giữ trong trình duyệt: bài lỗi (ví dụ hết lượt AI) vẫn nằm trong hàng chờ
  // sau khi tải lại trang và bấm Thử lại được mà không cần chọn lại file.
  stored?: FileMeta | null;
};

const BUSY: QueueStatus[] = ["reading", "ai", "checking"];

type ColumnChange = Partial<Pick<TableColumn, "name" | "description" | "visible" | "width">>;

type Store = {
  tables: SheetTable[];
  // Bảng đang hiện: bảng minh hoạ nếu đang mở, không thì bảng riêng đang chọn.
  activeTable: SheetTable | null;
  // Bảng nhận bài mới: bảng riêng đang chọn, không bao giờ là Bảng mẫu hay bảng minh hoạ.
  targetTable: SheetTable | null;
  setActiveTable: (id: string) => void;
  // Bảng minh hoạ: chỉ mở khi người dùng bấm "Xem bảng minh hoạ". Thử được nhưng không lưu, không ghi thao tác.
  demoOpen: boolean;
  openDemo: () => void;
  closeDemo: () => void;
  // Xoá bài khỏi bảng đang hiện. Trả về phần đã xoá để hoàn tác.
  deletePapers: (paperIds: string[]) => RemovedPapers | null;
  undoDeletePapers: (removed: RemovedPapers) => void;
  // Xoá cả một bảng riêng, kể cả bài chờ duyệt của bảng đó.
  deleteTable: (tableId: string) => void;
  createTable: (name: string, description: string, columns: TableColumn[]) => void;
  // Các thao tác với cột luôn áp dụng cho bảng đang mở.
  addColumn: (column: TableColumn) => void;
  changeColumn: (id: string, change: ColumnChange) => void;
  deleteColumn: (id: string) => void;
  moveColumn: (id: string, offset: number) => void;
  reorderColumns: (ids: string[]) => void;
  // Bài đang mở ở trang duyệt.
  review: ReviewSession | null;
  savedTitle: string | null;
  queue: QueueItem[];
  // Đã đọc xong các bài chờ duyệt giữ trong IndexedDB chưa.
  queueLoaded: boolean;
  // Thêm file vào hàng chờ. Trả về tên các file bị bỏ qua vì không phải PDF.
  addFiles: (files: File[]) => string[];
  retryItem: (id: string) => void;
  removeItem: (id: string) => void;
  openReview: (id: string) => void;
  // Mở bài mẫu của bản xem thử (không gọi AI).
  startSampleReview: () => void;
  updateCell: (index: number, change: Partial<Pick<ReviewCell, "value_vi" | "review">>) => void;
  // "Duyệt nhanh cả dòng": xác nhận mọi ô chưa duyệt. Chỉ gọi khi canQuickApprove đúng.
  quickApprove: () => void;
  updateInfo: (info: PaperInfo) => void;
  setInfoConfirmed: (confirmed: boolean) => void;
  // Trả về mã bài kế tiếp đang chờ duyệt (nếu có), hoặc false khi chưa lưu được.
  saveReview: () => { next: string | null } | false;
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
  cloud: CloudState;
  savedAt: number | null;
  saveFlash: number;
  // Lưu ngay mọi thay đổi lên máy chủ (trước khi xuất Excel). true: máy chủ đã có đúng dữ liệu đang thấy.
  syncNow: () => Promise<boolean>;
  resetData: () => Promise<void>;
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
  const [tables, setTables] = useState<SheetTable[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [demo, setDemo] = useState<SheetTable | null>(null);
  // File của bài vừa xoá: chờ hết thời gian hoàn tác mới xoá khỏi IndexedDB.
  const fileTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [queueLoaded, setQueueLoaded] = useState(false);
  // File gốc của các bài chưa xử lý xong. Không đưa vào state vì không cần vẽ lại.
  const files = useRef(new Map<string, File>());
  const busy = useRef(false);
  const tablesRef = useRef(tables);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const skipReset = useRef(false);
  const [cloud, setCloud] = useState<CloudState>("local");
  // Lúc lưu xong gần nhất (lên máy chủ, hoặc vào trình duyệt khi chưa cài máy chủ), cho dòng "Đã lưu lúc 08:10".
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Tăng mỗi lần bấm Cmd+S, để trang bảng chớp chữ "Đã lưu".
  const [saveFlash, setSaveFlash] = useState(0);
  // Bản dữ liệu đang có trên máy chủ. null: chưa đọc từ máy chủ (chưa bắt đầu đồng bộ).
  const snapshot = useRef<Snapshot | null>(null);
  const cloudStarted = useRef(false);
  // Dữ liệu đọc từ trình duyệt lúc mở app, để biết sau đó có thay đổi thật chưa.
  const loadedJson = useRef(PRISTINE);
  const syncing = useRef<Promise<boolean> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bước xử lý hàng chờ cần bảng mới nhất (cột có thể đổi trong lúc chờ).
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Máy chủ không có dữ liệu trình duyệt nên chỉ đọc được sau khi trang đã hiện.
  useEffect(() => {
    const saved = readSaved();
    // Phải đọc sau khi hiện trang để khớp với máy chủ.
    if (saved) {
      // Chỉ có Bảng mẫu y nguyên (bản cũ tự lưu cho mọi người): coi như người dùng mới.
      const start = startingTables(saved.tables);
      setTables(start);
      setActiveId(start.some((table) => table.id === saved.activeId) ? saved.activeId : (start[0]?.id ?? null));
      loadedJson.current = JSON.stringify(start);
    }
    setHydrated(true);
  }, []);

  // Gửi phần đã đổi lên máy chủ. Lỗi thì giữ trên trình duyệt và thử lại sau.
  const sync = useCallback(async function syncOnce(): Promise<boolean> {
    if (!snapshot.current) return false;
    if (syncing.current) {
      await syncing.current;
      return syncOnce();
    }
    const run = (async () => {
      const current = tablesRef.current;
      const plan = planSync(snapshot.current!, current);
      if (isEmptyPlan(plan)) {
        if (tablesRef.current === current) writeDirty(false);
        setCloud("saved");
        return true;
      }
      setCloud("saving");
      try {
        await supabaseRemote.apply(plan);
        snapshot.current = snapshotOf(current);
        if (tablesRef.current === current) writeDirty(false);
        setSavedAt(Date.now());
        setCloud("saved");
        return true;
      } catch {
        setCloud(isOffline() ? "offline" : "error");
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void syncOnce(), 20000);
        return false;
      }
    })();
    syncing.current = run;
    try {
      return await run;
    } finally {
      syncing.current = null;
    }
  }, []);

  // Đọc dữ liệu trên máy chủ và chọn bản làm gốc (xem chooseStart trong cloud-sync.ts).
  const start = useCallback(async function startOnce(): Promise<void> {
    if (cloudStarted.current) return;
    cloudStarted.current = true;
    setCloud("loading");
    try {
      const remote = await supabaseRemote.load();
      const serverTables = fromRows(remote.tables, remote.papers);
      // Bản máy chủ chỉ có Bảng mẫu y nguyên: coi như trống. Ảnh chụp vẫn là bản máy chủ thật,
      // nên lần đồng bộ sau sẽ xoá dòng Bảng mẫu đó trên máy chủ.
      const remoteTables = startingTables(serverTables);
      const localHasData = JSON.stringify(tablesRef.current) !== PRISTINE;
      const choice = chooseStart(remoteTables.length > 0, localHasData, readDirty());
      snapshot.current = snapshotOf(serverTables);
      if (choice === "use_remote") {
        tablesRef.current = remoteTables;
        setTables(remoteTables);
        setActiveId((current) => (remoteTables.some((table) => table.id === current) ? current : (remoteTables[0]?.id ?? null)));
        writeDirty(false);
        setCloud("saved");
      } else if (choice === "push_local") {
        // Kể cả dữ liệu đã có trên trình duyệt từ trước khi có máy chủ: chuyển hết lên.
        await sync();
      } else {
        setCloud("saved");
      }
    } catch {
      cloudStarted.current = false;
      setCloud(isOffline() ? "offline" : "error");
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void startOnce(), 20000);
    }
  }, [sync]);
  useEffect(() => {
    if (!hydrated || skipReset.current) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tables, activeId }));
        setSaveFailed(false);
        if (!cloudConfigured()) setSavedAt(Date.now());
      } catch {
        setSaveFailed(true);
      }
      if (!cloudConfigured()) return;
      if (snapshot.current) {
        writeDirty(true);
        void sync();
      } else {
        const json = JSON.stringify(tables);
        // Đổi gì đó trước khi đọc xong máy chủ: đánh dấu để bản trình duyệt được gửi lên.
        if (json !== loadedJson.current) writeDirty(true);
        // Có dữ liệu riêng (sửa bảng mẫu, tạo bảng, lưu bài, hoặc dữ liệu cũ trên trình duyệt): đăng nhập ẩn danh và lưu lên máy chủ.
        if (json !== PRISTINE) void start();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [hydrated, tables, activeId, sync, start]);


  // Có phiên đăng nhập từ trước thì đọc dữ liệu trên máy chủ ngay khi mở app.
  useEffect(() => {
    if (!hydrated || !cloudConfigured()) return;
    setEventSender((items) => sendEvents(items));
    void currentUserId().then((userId) => {
      if (userId) void start();
    });
    const online = () => {
      scheduleFlush(0);
      if (snapshot.current) void sync();
      else if (JSON.stringify(tablesRef.current) !== PRISTINE || readDirty()) void start();
    };
    const offline = () => setCloud((current) => (current === "local" ? current : "offline"));
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [hydrated, sync, start]);

  const syncNow = useCallback(async () => {
    if (!cloudConfigured()) return false;
    if (!snapshot.current) {
      await start();
      return snapshot.current !== null && !readDirty();
    }
    return sync();
  }, [sync, start]);

  // Cmd+S: lưu ngay những gì chưa gửi. Không có gì mới thì không gửi gì, chỉ báo "Đã lưu".
  const saveNow = useCallback(async () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tables: tablesRef.current, activeId }));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
    if (cloudConfigured() && (snapshot.current || JSON.stringify(tablesRef.current) !== PRISTINE)) await syncNow();
    else if (!cloudConfigured()) setSavedAt(Date.now());
    setSaveFlash((value) => value + 1);
  }, [activeId, syncNow]);

  // Cmd+S / Ctrl+S ở mọi trang: không mở hộp lưu trang của trình duyệt, chỉ lưu ngay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) return;
      event.preventDefault();
      void saveNow();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [saveNow]);

  const resetData = useCallback(async () => {
    // Dữ liệu đã lưu lên máy chủ cũng phải xoá, không thì mở lại app sẽ đọc lại từ máy chủ.
    if (snapshot.current) {
      try {
        await supabaseRemote.clear();
      } catch {
        window.alert("Chưa xoá được dữ liệu trên máy chủ. Hãy kiểm tra kết nối mạng rồi thử lại.");
        return;
      }
    }
    skipReset.current = true;
    writeDirty(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Trình duyệt chặn bộ nhớ thì tải lại cũng về dữ liệu mẫu.
    }
    // Xoá cả file PDF và bài chờ duyệt đã giữ trong trình duyệt.
    void clearPaperFiles().finally(() => window.location.reload());
  }, []);

  const ownTable = useMemo(() => tables.find((table) => table.id === activeId) ?? null, [tables, activeId]);
  const activeTable = demo ?? ownTable;
  const targetTable = ownTable && ownTable.id !== SAMPLE_TABLE_ID ? ownTable : null;
  // Bài chờ duyệt thuộc bảng nào thì đổi theo cột của bảng đó. Đang xem bảng minh hoạ thì không đụng bài nào.
  const sessionTableId = demo ? null : activeId;

  // Đang xem bảng minh hoạ: sửa trong bộ nhớ, không vào danh sách bảng nên không lưu, không đồng bộ.
  const updateActive = useCallback(
    (change: (table: SheetTable) => SheetTable) => {
      if (demo) {
        setDemo((current) => (current ? change(current) : current));
        return;
      }
      setTables((current) => current.map((table) => (table.id === activeId ? change(table) : table)));
    },
    [activeId, demo],
  );

  // Đổi mọi bài chờ duyệt (ví dụ khi xoá hoặc đổi thứ tự cột).
  const mapSessions = useCallback((change: (session: ReviewSession) => ReviewSession) => {
    setQueue((current) => current.map((item) => (item.session ? { ...item, session: change(item.session) } : item)));
  }, []);

  const setActiveTable = useCallback((id: string) => {
    setSavedTitle(null);
    setDemo(null);
    setActiveId(id);
  }, []);

  const openDemo = useCallback(() => {
    setSavedTitle(null);
    setDemo(structuredClone(sampleTable));
  }, []);
  const closeDemo = useCallback(() => setDemo(null), []);

  const createTable = useCallback<Store["createTable"]>((name, description, columns) => {
    const id = `bang-${crypto.randomUUID()}`;
    setTables((current) => [...current, { id, name, description, columns, papers: [] }]);
    setSavedTitle(null);
    setDemo(null);
    setActiveId(id);
  }, []);

  // Xoá bài không ghi thao tác (không tính vào số liệu đo hiệu quả). File PDF chờ hết thời gian hoàn tác mới xoá.
  const deletePapers = useCallback<Store["deletePapers"]>(
    (paperIds) => {
      const table = activeTable;
      if (!table || !paperIds.length) return null;
      const { removed } = removePapers(table, paperIds);
      if (!removed.items.length) return null;
      updateActive((current) => removePapers(current, paperIds).table);
      if (!demo) {
        for (const { paper } of removed.items) {
          const timer = setTimeout(() => {
            fileTimers.current.delete(paper.id);
            void deletePaperFiles(paper.id);
          }, UNDO_FILE_GRACE_MS);
          fileTimers.current.set(paper.id, timer);
        }
      }
      return removed;
    },
    [activeTable, updateActive, demo],
  );

  const undoDeletePapers = useCallback<Store["undoDeletePapers"]>(
    (removed) => {
      for (const { paper } of removed.items) {
        const timer = fileTimers.current.get(paper.id);
        if (timer) clearTimeout(timer);
        fileTimers.current.delete(paper.id);
      }
      if (demo && demo.id === removed.tableId) {
        setDemo((current) => (current ? restorePapers(current, removed) : current));
        return;
      }
      setTables((current) => current.map((table) => restorePapers(table, removed)));
    },
    [demo],
  );

  // Xoá cả bảng (đã hỏi lại ở giao diện): bài, bài chờ duyệt của bảng đó và file của chúng. Không ghi thao tác.
  const deleteTable = useCallback<Store["deleteTable"]>((tableId) => {
    const table = tablesRef.current.find((item) => item.id === tableId);
    if (!table) return;
    const next = nextActiveAfterDelete(tablesRef.current, tableId);
    setTables((current) => current.filter((item) => item.id !== tableId));
    setActiveId((current) => (current === tableId ? next : current));
    setSavedTitle(null);
    for (const paper of table.papers) void deletePaperFiles(paper.id);
    setQueue((current) => {
      for (const item of current) {
        if (item.tableId !== tableId) continue;
        files.current.delete(item.id);
        if (item.status !== "saved") {
          void deletePaperFiles(item.id);
          void deletePending(item.id);
        }
      }
      return current.filter((item) => item.tableId !== tableId);
    });
    setOpenId((current) => (current && queueRef.current.find((item) => item.id === current)?.tableId === tableId ? null : current));
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
      mapSessions((current) =>
        current.tableId !== sessionTableId
          ? current
          : {
              ...current,
              cells: current.cells.filter((cell) => cell.column !== id),
              paper: { ...current.paper, ...infoWithout(current.paper, column) },
            },
      );
    },
    [activeId, activeTable, updateActive, mapSessions, sessionTableId],
  );

  const applyOrder = useCallback(
    (columns: TableColumn[]) => {
      updateActive((table) => ({ ...table, columns }));
      mapSessions((current) => (current.tableId === sessionTableId ? { ...current, cells: sortCells(current.cells, columns) } : current));
    },
    [sessionTableId, updateActive, mapSessions],
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
      // Chỉ đổi nội dung một ô do AI đề xuất mới tính là sửa. Ghi chú, nhãn, ô "chưa điền" sinh viên tự gõ
      // và ô "do bạn điền" không tính vào chỉ số.
      const paper = activeTable?.papers.find((item) => item.id === paperId);
      const cell = paper?.cells.find((item) => item.column === column.id);
      const fromAi = column.infoKey
        ? Boolean(paper?.suggested_info[column.infoKey])
        : column.kind === "content" && (cell?.status === "proposed" || cell?.status === "not_found");
      // Bảng minh hoạ, bài có sẵn của Bảng mẫu và bài mẫu do app tạo không tính vào số liệu.
      const counted = !demo && !isSamplePaper(paperId) && !isAppSamplePaper(paper?.file?.name);
      if (fromAi && counted) logEvent("o_bi_sua", { cot: column.id, bai: paperId, noi: "bang" });
      updateActive((table) => ({
        ...table,
        papers: table.papers.map((paper) => (paper.id === paperId ? editCell(paper, column, value) : paper)),
      }));
    },
    [activeTable, updateActive, demo],
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

  const patchItem = useCallback((id: string, change: Partial<QueueItem>) => {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  // Đọc lại các bài AI đã điền nhưng chưa lưu vào bảng, kèm chữ của trang.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = ((await loadAllPending()) ?? []) as QueueItem[];
      const items = await Promise.all(
        saved
          .filter((item) => item?.id && ((item.session && item.status === "ready") || (item.status === "error" && item.stored)))
          .map(async (item) => (item.session ? { ...item, session: { ...item.session, pages: await loadPages(item.id) } } : item)),
      );
      if (cancelled) return;
      setQueue((current) => [...items.filter((item) => !current.some((other) => other.id === item.id)), ...current]);
      setQueueLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Giữ bài chờ duyệt (kể cả phần đã duyệt dở) trong IndexedDB. Chữ của trang đã giữ riêng nên không ghi lại.
  useEffect(() => {
    if (!queueLoaded) return;
    const timer = setTimeout(() => {
      for (const item of queue) {
        if (item.status === "ready" && item.session && !item.sample) {
          void savePending(item.id, { ...item, session: { ...item.session, pages: null } });
        } else if (item.status === "error" && item.stored) {
          // Bài lỗi mà file đã được giữ: giữ lại trong hàng chờ để bấm Thử lại sau (ví dụ hết lượt AI hôm nay).
          void savePending(item.id, item);
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [queue, queueLoaded]);

  const addFiles = useCallback<Store["addFiles"]>(
    (list) => {
      if (!targetTable || !hydrated) return list.map((file) => file.name);
      const skipped: string[] = [];
      const added: QueueItem[] = [];
      for (const file of list) {
        // Lọc theo đuôi hoặc loại file. File đổi đuôi thành .pdf sẽ bị phát hiện khi đọc (xem 1024 byte đầu).
        if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
          skipped.push(file.name);
          continue;
        }
        const id = `bai-${crypto.randomUUID()}`;
        files.current.set(id, file);
        added.push({ id, tableId: targetTable.id, fileName: file.name, size: file.size, status: "waiting" });
      }
      if (added.length) {
        setSavedTitle(null);
        setQueue((current) => [...current, ...added]);
      }
      return skipped;
    },
    [targetTable, hydrated],
  );

  // Xử lý lần lượt từng bài: chỉ khi không có bài nào đang xử lý mới lấy bài chờ kế tiếp.
  useEffect(() => {
    if (!hydrated || busy.current || queue.some((item) => BUSY.includes(item.status))) return;
    const next = queue.find((item) => item.status === "waiting");
    if (!next) return;
    busy.current = true;
    void (async () => {
      const file = files.current.get(next.id);
      const table = tablesRef.current.find((item) => item.id === next.tableId);
      // Không còn file trong trang (đã tải lại trang) nhưng chữ của bài đã được giữ: dùng lại chữ đó.
      const storedPages = !file && next.stored ? await loadPages(next.id) : null;
      try {
        if ((!file && !storedPages) || !table) {
          patchItem(next.id, {
            status: "error",
            error: {
              title: !file ? "File không còn trong trang này" : "Không còn bảng để điền",
              detail: !file ? "Trang đã được tải lại nên app không còn giữ file. Hãy chọn lại file." : "Bảng đã bị xoá. Hãy chọn bảng khác rồi tải lại bài.",
              retry: false,
            },
          });
          return;
        }
        const outcome = await processPaper(
          {
            id: next.id,
            tableId: table.id,
            columns: table.columns,
            ...(file ? { file } : { pages: storedPages!, fileMeta: next.stored! }),
            onStage: (stage) => patchItem(next.id, stage === "ai" ? { status: "ai", aiStartedAt: Date.now() } : { status: stage }),
          },
          {
            readPdf: readPdfInBrowser,
            callApi: async (body) => {
              // Máy chủ chỉ nhận yêu cầu có phiên đăng nhập (kể cả ẩn danh) để đếm lượt dùng AI.
              const session = await getAccessToken();
              if (!session.ok) return { ok: false, error: session.error, attempts: 0, usedFallback: false };
              const response = await fetch("/api/dien-bang", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
                body: JSON.stringify(body),
              });
              return response.json().catch(() => null);
            },
            hash: fileHash,
            savePdf,
            savePages,
          },
        );
        if (!outcome.ok) {
          patchItem(next.id, { status: "error", error: outcome.error, stored: outcome.stored ?? next.stored ?? null });
          return;
        }
        // Cột có thể đã bị xoá trong lúc chờ AI: chỉ giữ các cột bảng đang có.
        const latestTable = tablesRef.current.find((item) => item.id === next.tableId);
        const session = latestTable ? pruneToColumns(outcome.session, latestTable.columns) : outcome.session;
        // Ghi thao tác: lúc tải bài (kèm model đã điền) và từng ô cần kiểm tra. Bài mẫu do app tạo không tính.
        const log: typeof logEvent = isAppSamplePaper(next.fileName) ? () => undefined : logEvent;
        log("tai_bai", {
          bai: session.id,
          so_o: session.cells.length,
          so_trang: session.pages?.length ?? 0,
          model: session.paper.filled_by?.model ?? "",
          du_phong: session.paper.filled_by?.fallback ? 1 : 0,
          giu_pdf: outcome.pdfSaved ? 1 : 0,
        });
        session.cells
          .filter((cell) => getLabelKey(cell) === "needs_review")
          .forEach((cell) => log("o_can_kiem_tra", { cot: cell.column, bai: session.id }));
        files.current.delete(next.id);
        patchItem(next.id, { status: "ready", session, error: undefined });
      } catch {
        patchItem(next.id, { status: "error", error: { title: "Có lỗi khi xử lý bài này", detail: "Hãy bấm Thử lại.", retry: true } });
      } finally {
        busy.current = false;
        // Kích để effect chạy lại và lấy bài kế tiếp.
        setQueue((current) => [...current]);
      }
    })();
  }, [queue, hydrated, patchItem]);

  const retryItem = useCallback<Store["retryItem"]>(
    (id) => patchItem(id, { status: "waiting", error: undefined, aiStartedAt: undefined }),
    [patchItem],
  );

  const removeItem = useCallback<Store["removeItem"]>((id) => {
    files.current.delete(id);
    setQueue((current) => {
      const item = current.find((other) => other.id === id);
      // Bài đã lưu vào bảng vẫn cần file PDF để xem bằng chứng, chỉ bỏ khỏi danh sách.
      if (item && item.status !== "saved") void deletePaperFiles(id);
      return current.filter((other) => other.id !== id);
    });
    setOpenId((current) => (current === id ? null : current));
  }, []);

  const openReview = useCallback<Store["openReview"]>((id) => {
    setSavedTitle(null);
    setOpenId(id);
  }, []);

  // Bài mẫu của bản xem thử: chỉ những cột trùng với bài mẫu mới có đề xuất, cột khác để "chưa điền".
  const startSampleReview = useCallback(() => {
    // Chưa đọc xong dữ liệu đã lưu thì chưa biết bảng nào đang mở, tránh lưu nhầm vào bảng mẫu.
    if (!targetTable || !hydrated) return;
    const { columns } = targetTable;
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
    // Mỗi lần mở là một bài mới có mã riêng, để bài sau không ghi đè bài trước.
    const id = `bai-${crypto.randomUUID()}`;
    const session: ReviewSession = {
      id,
      tableId: targetTable.id,
      paper: { ...reviewPaper, id, info: keepInfo(reviewPaper.info), suggested_info: keepInfo(reviewPaper.suggested_info) },
      fileName: null,
      pages: null,
      cells,
      infoConfirmed: false,
    };
    setSavedTitle(null);
    setQueue((current) => [...current, { id, tableId: targetTable.id, fileName: "Bài mẫu", size: 0, status: "ready", session, sample: true }]);
    setOpenId(id);
  }, [targetTable, hydrated]);

  const review = useMemo(() => queue.find((item) => item.id === openId && item.status === "ready")?.session ?? null, [queue, openId]);

  const updateOpen = useCallback(
    (change: (session: ReviewSession) => ReviewSession) => {
      setQueue((current) => current.map((item) => (item.id === openId && item.session ? { ...item, session: change(item.session) } : item)));
    },
    [openId],
  );

  const updateCell = useCallback<Store["updateCell"]>(
    (index, change) =>
      updateOpen((current) => ({
        ...current,
        cells: current.cells.map((cell, i) => (i === index ? { ...cell, ...change, quick: false } : cell)),
      })),
    [updateOpen],
  );

  const quickApprove = useCallback<Store["quickApprove"]>(
    () =>
      updateOpen((current) => (!canQuickApprove(current.cells) ? current : {
        ...current,
        cells: current.cells.map((cell) => (cell.review === "pending" ? { ...cell, review: "confirmed", quick: true } : cell)),
      })),
    [updateOpen],
  );

  const updateInfo = useCallback<Store["updateInfo"]>(
    (info) => updateOpen((current) => ({ ...current, paper: { ...current.paper, info } })),
    [updateOpen],
  );

  const setInfoConfirmed = useCallback<Store["setInfoConfirmed"]>(
    (infoConfirmed) => updateOpen((current) => ({ ...current, infoConfirmed })),
    [updateOpen],
  );

  const saveReview = useCallback<Store["saveReview"]>(() => {
    // AI chỉ đề xuất: còn ô chưa duyệt hoặc chưa xác nhận thông tin bài thì không được lưu.
    if (!review || !review.infoConfirmed || review.cells.some((cell) => cell.review === "pending")) return false;
    const isSample = (queue.find((item) => item.id === review.id)?.sample ?? false) || isAppSamplePaper(review.paper.file?.name);
    const table = tables.find((item) => item.id === review.tableId);
    const final = table ? pruneToColumns(review, table.columns) : review;
    // Bài mẫu của bản xem thử không qua AI, bài mẫu do app tạo chỉ để thử: không ghi vào chỉ số.
    const log: typeof logEvent = isSample ? () => undefined : logEvent;

    final.cells.forEach((cell) =>
      log(cell.review === "edited" ? "o_bi_sua" : "o_giu_nguyen", {
        cot: cell.column,
        noi: "duyet",
        bai: review.id,
        ...(cell.quick ? { cach: "duyet_nhanh" } : {}),
      }),
    );
    (Object.keys(final.paper.info) as (keyof PaperInfo)[]).forEach((key) =>
      log(review.paper.info[key] !== review.paper.suggested_info[key] ? "o_bi_sua" : "o_giu_nguyen", {
        cot: `info-${key}`,
        noi: "duyet",
        bai: review.id,
      }),
    );
    log("bam_luu_vao_bang", {
      bai: review.paper.id,
      ...(review.paper.filled_by ? { model: review.paper.filled_by.model, du_phong: review.paper.filled_by.fallback ? 1 : 0 } : {}),
    });

    const saved: SavedPaper = { ...final.paper, cells: final.cells };
    setTables((current) =>
      current.map((table) =>
        table.id === review.tableId
          ? { ...table, papers: [...table.papers.filter((paper) => paper.id !== saved.id), saved] }
          : table,
      ),
    );
    void deletePending(review.id);
    setActiveId(review.tableId);
    setSavedTitle(saved.info.title);
    const next = queue.find((item) => item.status === "ready" && item.id !== review.id && item.tableId === review.tableId)?.id ?? null;
    setQueue((current) => current.map((item) => (item.id === review.id ? { ...item, status: "saved", session: undefined } : item)));
    setOpenId(next);
    return { next };
  }, [review, queue, tables]);

  const value = useMemo(
    () => ({
      tables,
      activeTable,
      setActiveTable,
      targetTable,
      demoOpen: demo !== null,
      openDemo,
      closeDemo,
      deletePapers,
      undoDeletePapers,
      deleteTable,
      createTable,
      addColumn,
      changeColumn,
      deleteColumn,
      moveColumn,
      reorderColumns,
      review,
      savedTitle,
      queue,
      queueLoaded,
      addFiles,
      retryItem,
      removeItem,
      openReview,
      startSampleReview,
      quickApprove,
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
      cloud,
      savedAt,
      saveFlash,
      syncNow,
      resetData,
      editSavedCell,
    }),
    [
      tables,
      activeTable,
      setActiveTable,
      targetTable,
      demo,
      openDemo,
      closeDemo,
      deletePapers,
      undoDeletePapers,
      deleteTable,
      createTable,
      addColumn,
      changeColumn,
      deleteColumn,
      moveColumn,
      reorderColumns,
      review,
      savedTitle,
      queue,
      queueLoaded,
      addFiles,
      retryItem,
      removeItem,
      openReview,
      startSampleReview,
      quickApprove,
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
      cloud,
      savedAt,
      saveFlash,
      syncNow,
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
