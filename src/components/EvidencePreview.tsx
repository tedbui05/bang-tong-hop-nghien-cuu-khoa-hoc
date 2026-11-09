"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { evidenceLabel, evidenceSpokenLabel, evidenceView, NOT_MARKED_NOTE } from "@/lib/evidence";
import { fileHash, loadPages, savePdf } from "@/lib/paper-files";
import type { PdfPage } from "@/lib/pdf-read";
import { forgetPaperPdf, openPaperPdf, pageSize } from "@/lib/pdf-view";
import { STATUS_LABELS } from "@/lib/sheet";
import { getLabelKey, type AiCell, type Paper } from "@/lib/types";
import { PageTextView } from "./PageTextView";
import { PdfPageView } from "./PdfPageView";
import { StatusIcon } from "./StatusBadge";

// page: trang muốn mở, chỉ dùng cho ô "cần kiểm tra" vì câu có ở nhiều trang. Bỏ trống thì mở trang mặc định.
export type EvidenceTarget = { paper: Paper; cell: AiCell; columnName: string; pages?: PdfPage[] | null; page?: number };

type Mode = "hover" | "focus" | "click";
type PreviewState = { target: EvidenceTarget; anchor: HTMLElement; mode: Mode; fullscreen: boolean };

// Chờ chừng này trước khi mở khi rê chuột, để không hiện khi chỉ lướt qua.
const HOVER_DELAY_MS = 500;
// Rời nhãn chừng này mới đóng, để kịp di chuột vào khung.
const CLOSE_DELAY_MS = 250;
const ZOOMS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

function isPhone() {
  return window.matchMedia("(max-width: 640px)").matches;
}

// Điều khiển khung xem trước: mở khi rê chuột (chờ nửa giây), khi Tab tới nhãn, khi bấm hoặc chạm vào nhãn.
export function useEvidencePreview() {
  const [state, setState] = useState<PreviewState | null>(null);
  const current = useRef<PreviewState | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nhãn vừa được trả focus khi đóng khung: lần focus đó không được mở lại khung.
  const returning = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((next: PreviewState | null) => {
    current.current = next;
    setState(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = closeTimer.current = null;
  }, []);

  const api = useMemo(
    () => ({
      hoverIn(target: EvidenceTarget, anchor: HTMLElement) {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = null;
        const now = current.current;
        if (now && now.anchor === anchor) return;
        if (openTimer.current) clearTimeout(openTimer.current);
        openTimer.current = setTimeout(() => {
          openTimer.current = null;
          // Khung đang ghim (bấm vào nhãn khác) thì không đổi khi chỉ rê chuột.
          if (current.current && current.current.mode !== "hover") return;
          set({ target, anchor, mode: "hover", fullscreen: false });
        }, HOVER_DELAY_MS);
      },
      hoverOut() {
        if (openTimer.current) clearTimeout(openTimer.current);
        openTimer.current = null;
        if (current.current?.mode !== "hover" || current.current.fullscreen) return;
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => set(null), CLOSE_DELAY_MS);
      },
      // Chuột vào trong khung: không đóng nữa.
      keep() {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = null;
      },
      focusIn(target: EvidenceTarget, anchor: HTMLElement) {
        clearTimers();
        if (returning.current === anchor) {
          returning.current = null;
          return;
        }
        if (current.current?.anchor === anchor) return;
        set({ target, anchor, mode: "focus", fullscreen: false });
      },
      toggle(target: EvidenceTarget, anchor: HTMLElement) {
        clearTimers();
        const now = current.current;
        if (now && now.anchor === anchor && now.mode === "click") set(null);
        else set({ target, anchor, mode: "click", fullscreen: false });
      },
      fullscreen(on: boolean) {
        const now = current.current;
        if (now) set({ ...now, fullscreen: on, mode: on ? "click" : now.mode });
      },
      close(returnFocus = false) {
        clearTimers();
        const now = current.current;
        set(null);
        if (!returnFocus || !now) return;
        // Bảng có thể đã vẽ lại ô (nhãn cũ bị thay): tìm nhãn mới của cùng ô.
        const anchor = now.anchor.isConnected
          ? now.anchor
          : document.querySelector<HTMLElement>(
              `.ev-chip[data-paper="${CSS.escape(now.target.paper.id)}"][data-column="${CSS.escape(now.target.cell.column)}"]`,
            );
        if (!anchor) return;
        returning.current = anchor;
        anchor.focus({ preventScroll: true });
        // Nếu focus không gây sự kiện (nhãn đã đang được focus) thì bỏ cờ.
        setTimeout(() => {
          if (returning.current === anchor) returning.current = null;
        }, 0);
      },
      isOpenFor(anchor: HTMLElement) {
        return current.current?.anchor === anchor;
      },
    }),
    [clearTimers, set],
  );

  useEffect(() => clearTimers, [clearTimers]);
  return { state, ...api };
}

export type EvidencePreviewApi = ReturnType<typeof useEvidencePreview>;

// Nhãn bằng chứng nhỏ, ví dụ "tr. 9 · đã khớp". Ô "không tìm thấy" không có nhãn này.
export function EvidenceChip({ target, preview }: { target: EvidenceTarget; preview: EvidencePreviewApi }) {
  const text = evidenceLabel(target.cell);
  if (!text) return null;
  const { label } = evidenceView(target.cell);
  const open = preview.state?.target.cell === target.cell && preview.state.target.paper.id === target.paper.id;
  return (
    <button
      type="button"
      className={`ev-chip ev-chip--${label}`}
      data-paper={target.paper.id}
      data-column={target.cell.column}
      aria-label={`${evidenceSpokenLabel(target.cell)}. Xem đoạn gốc trong file PDF`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onPointerEnter={(event) => event.pointerType === "mouse" && preview.hoverIn(target, event.currentTarget)}
      onPointerLeave={(event) => event.pointerType === "mouse" && preview.hoverOut()}
      onFocus={(event) => {
        // Chỉ mở ngay khi đến bằng bàn phím; bấm chuột thì để onClick xử lý.
        if (event.currentTarget.matches(":focus-visible")) preview.focusIn(target, event.currentTarget);
      }}
      onBlur={(event) => chipBlur(event, preview)}
      onKeyDown={(event) => chipKey(event, preview)}
      onClick={(event) => {
        event.stopPropagation();
        preview.toggle(target, event.currentTarget);
      }}
    >
      <StatusIcon label={label} />
      {text}
    </button>
  );
}

// Ô "cần kiểm tra" vì câu có ở nhiều trang: mỗi trang một nút, mở khung xem đúng trang đó, có tô vàng câu trích.
export function PageMatchButtons({ target, preview }: { target: EvidenceTarget; preview: EvidencePreviewApi }) {
  const matches = target.cell.page_matches ?? [];
  if (matches.length < 2 || getLabelKey(target.cell) !== "needs_review") return null;
  const openPage = preview.state?.target.cell === target.cell ? (preview.state.target.page ?? null) : null;
  return (
    <div className="page-matches" role="group" aria-label="Mở từng trang có câu trích này">
      {matches.map((match) => (
        <button
          key={match.page}
          type="button"
          className="link-button page-matches__button"
          aria-label={`Xem trang ${match.page} trong file PDF, có tô vàng câu trích`}
          aria-haspopup="dialog"
          aria-expanded={openPage === match.page}
          onClick={(event) => {
            event.stopPropagation();
            preview.toggle({ ...target, page: match.page }, event.currentTarget);
          }}
        >
          Xem trang {match.page}
        </button>
      ))}
    </div>
  );
}

// Dùng chung cho nhãn trong bảng (không phải React).
export function chipBlur(event: FocusEvent<HTMLElement> | globalThis.FocusEvent, preview: EvidencePreviewApi) {
  const next = event.relatedTarget as Node | null;
  if (next && document.querySelector(".ev-pop")?.contains(next)) return;
  if (preview.state?.mode === "focus" && !preview.state.fullscreen) preview.close();
}

export function chipKey(event: KeyboardEvent<HTMLElement> | globalThis.KeyboardEvent, preview: EvidencePreviewApi) {
  if (event.key === "Escape" && preview.state) {
    event.preventDefault();
    event.stopPropagation();
    preview.close(true);
  } else if (event.key === "Tab" && !event.shiftKey && preview.state && !preview.state.fullscreen) {
    // Tab từ nhãn đi vào khung xem trước.
    const first = document.querySelector<HTMLElement>(".ev-pop button:not(:disabled)");
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
}

// Khung nổi và chế độ toàn màn hình.
export function EvidencePreviewLayer({ preview }: { preview: EvidencePreviewApi }) {
  const { state } = preview;
  if (!state) return null;
  return createPortal(
    state.fullscreen ? (
      <PdfFullscreen key={`${state.target.paper.id}-${state.target.cell.column}`} target={state.target} onExit={() => preview.close(true)} />
    ) : (
      <EvidencePopover key={`${state.target.paper.id}-${state.target.cell.column}`} state={state} preview={preview} />
    ),
    document.body,
  );
}

type Loaded =
  | { kind: "loading" }
  // pages: chữ của trang đã lưu lúc đọc bài, để kiểm tra vị trí tô không lệch.
  | { kind: "pdf"; doc: PDFDocumentProxy; pages: PdfPage[] | null }
  | { kind: "missing"; pages: PdfPage[] | null };

// Mở file PDF đã giữ; không còn file thì lấy chữ của trang (nếu còn) để hiện thay.
function usePaperPdf(target: EvidenceTarget) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const paperId = target.paper.id;
  const knownPages = target.pages ?? null;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [doc, pages] = await Promise.all([openPaperPdf(paperId), knownPages ? Promise.resolve(knownPages) : loadPages(paperId)]);
      if (!alive) return;
      setLoaded(doc ? { kind: "pdf", doc, pages } : { kind: "missing", pages });
    })();
    return () => {
      alive = false;
    };
  }, [paperId, knownPages, version]);

  return { loaded, reload: () => setVersion((value) => value + 1) };
}

function EvidencePopover({ state, preview }: { state: PreviewState; preview: EvidencePreviewApi }) {
  const { target, anchor } = state;
  const view = evidenceView(target.cell, target.page);
  const { loaded, reload } = usePaperPdf(target);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const box = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  // Trang có câu trích nhưng không tô được (chữ của trang khác lúc đọc bài).
  const [unmarked, setUnmarked] = useState(false);

  // Đặt khung cạnh nhãn: bên dưới nếu đủ chỗ, không thì bên trên. Điện thoại thì trượt lên từ dưới (CSS).
  useEffect(() => {
    function place() {
      if (!anchor.isConnected) {
        preview.close();
        return;
      }
      if (isPhone()) {
        setPosition({});
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const popWidth = Math.min(600, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - popWidth - 8));
      if (below >= 420 || below >= above) setPosition({ left, top: rect.bottom + 6, width: popWidth, maxHeight: Math.min(680, below) });
      else setPosition({ left, bottom: window.innerHeight - rect.top + 6, width: popWidth, maxHeight: Math.min(680, above) });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    // Bảng vẽ lại dòng thì nhãn cũ bị gỡ khỏi trang mà không có sự kiện rời chuột: tự kiểm tra định kỳ.
    const watch = setInterval(() => {
      if (!anchor.isConnected) preview.close(true);
    }, 400);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      clearInterval(watch);
    };
  }, [anchor, preview]);

  // Bấm ra ngoài khung (khi khung đang ghim) thì đóng.
  useEffect(() => {
    if (state.mode === "hover") return;
    const onDown = (event: PointerEvent) => {
      const node = event.target as Node;
      if (box.current?.contains(node) || anchor.contains(node)) return;
      preview.close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [state.mode, anchor, preview]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [loaded.kind]);

  useEffect(() => {
    if (loaded.kind !== "pdf" || view.page === null) return;
    let alive = true;
    void pageSize(loaded.doc, view.page)
      .then((value) => alive && setSize(value))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [loaded, view.page]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      preview.close(true);
    } else if (event.key === "Tab" && !event.shiftKey) {
      // Tab ra khỏi nút cuối cùng: đóng khung và trả về nhãn để đi tiếp.
      const buttons = [...(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, [tabindex='0']") ?? [])];
      if (document.activeElement === buttons.at(-1)) {
        event.preventDefault();
        preview.close(true);
      }
    } else if (event.key === "Tab" && event.shiftKey) {
      const first = box.current?.querySelector<HTMLElement>("button:not(:disabled)");
      if (document.activeElement === first) {
        event.preventDefault();
        anchor.focus({ preventScroll: true });
      }
    }
  }

  const fitScale = size && width ? (width - 2) / size.width : 1;
  const scale = fitScale * zoom;
  const extraPages = [...new Set(view.ranges.map((range) => range.page))].filter((page) => page !== view.page);

  const scrollToMark = useCallback((mark: HTMLElement | null, marked: boolean) => {
    setUnmarked(!marked);
    const element = scroller.current;
    if (!element || !mark) return;
    const markBox = mark.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    element.scrollTop += markBox.top - own.top - element.clientHeight / 3;
    element.scrollLeft += markBox.left - own.left - 16;
  }, []);

  return (
    <div
      ref={box}
      className={`ev-pop${isPhone() ? " ev-pop--sheet" : ""}`}
      style={position}
      role="dialog"
      aria-label={`Đoạn gốc của ô ${target.columnName}, trang ${view.page ?? ""}`}
      onPointerEnter={(event) => event.pointerType === "mouse" && preview.keep()}
      onPointerLeave={(event) => event.pointerType === "mouse" && preview.hoverOut()}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (state.mode === "focus" && next && !box.current?.contains(next) && next !== anchor) preview.close();
      }}
      onKeyDown={handleKey}
    >
      <header className="ev-pop__head">
        <div className="ev-pop__title">
          <span className={`ev-chip ev-chip--${view.label} ev-chip--static`}>
            <StatusIcon label={view.label} />
            {evidenceLabel(target.cell, target.page)}
          </span>
          <span className="ev-pop__column">{target.columnName}</span>
        </div>
        <div className="ev-pop__tools">
          {loaded.kind === "pdf" ? (
            <ZoomButtons zoom={zoom} onZoom={setZoom} />
          ) : null}
          <button
            type="button"
            className="ev-pop__button"
            disabled={loaded.kind !== "pdf"}
            onClick={() => preview.fullscreen(true)}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
            </svg>
            Mở toàn màn hình
          </button>
          <button type="button" className="ev-pop__button ev-pop__close" aria-label="Đóng khung xem trước (Esc)" onClick={() => preview.close(true)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Không còn cả file lẫn chữ của trang thì không có trang để tự tìm: chỉ giữ lời nhắc của ô cần kiểm tra. */}
      {view.note && (view.label === "needs_review" || loaded.kind !== "missing" || loaded.pages) ? (
        <p className={view.label === "needs_review" ? "ev-pop__note ev-pop__note--warn" : "ev-pop__note"} role="status">
          {view.note}
        </p>
      ) : unmarked && !view.note ? (
        <p className="ev-pop__note" role="status">
          {NOT_MARKED_NOTE}
        </p>
      ) : null}

      {loaded.kind === "loading" ? (
        <p className="ev-pop__loading" role="status">
          <span className="spinner" aria-hidden="true" /> Đang mở trang {view.page} của file PDF…
        </p>
      ) : loaded.kind === "pdf" && failed ? (
        <PdfError pages={loaded.pages} target={target} />
      ) : loaded.kind === "pdf" && view.page !== null ? (
        <div ref={scroller} className="ev-pop__scroll">
          {width && size ? (
            <>
              <PdfPageView
                doc={loaded.doc}
                paperId={target.paper.id}
                page={view.page}
                scale={scale}
                ranges={view.ranges}
                expectedText={pageTextOf(loaded.pages, view.page)}
                onRendered={scrollToMark}
                placeholder={size}
              />
              {extraPages.map((page) => (
                <PdfPageView
                  key={page}
                  doc={loaded.doc}
                  paperId={target.paper.id}
                  page={page}
                  scale={scale}
                  ranges={view.ranges}
                  expectedText={pageTextOf(loaded.pages, page)}
                />
              ))}
            </>
          ) : null}
        </div>
      ) : (
        <MissingPdf target={target} pages={loaded.kind === "missing" ? loaded.pages : null} onReloaded={reload} />
      )}
    </div>
  );
}

function pageTextOf(pages: PdfPage[] | null, page: number): string | undefined {
  return pages?.find((item) => item.page === page)?.text;
}

// Không mở được trang PDF (file hỏng hoặc lỗi khi đọc): báo lỗi, vẫn cho xem chữ của trang nếu còn.
function PdfError({ pages, target }: { pages: PdfPage[] | null; target: EvidenceTarget }) {
  const view = evidenceView(target.cell, target.page);
  return (
    <div className="ev-pop__missing" role="alert">
      <p className="ev-pop__note">
        <span className="ev-pop__error">Chưa mở được trang {view.page} của file PDF.</span> Hãy đóng khung rồi mở lại.
        {pages ? " Dưới đây là chữ của trang đọc từ file lúc tải lên." : ""}
      </p>
      {pages && view.page !== null ? (
        <div className="ev-pop__text">
          <PageTextView pages={pages} page={view.page} ranges={view.ranges} lang={target.paper.language_code} />
        </div>
      ) : null}
    </div>
  );
}

function ZoomButtons({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  const index = ZOOMS.indexOf(zoom);
  return (
    <span className="ev-zoom" role="group" aria-label="Phóng to, thu nhỏ">
      <button type="button" className="ev-pop__button" aria-label="Thu nhỏ" disabled={index <= 0} onClick={() => onZoom(ZOOMS[index - 1])}>
        −
      </button>
      <span className="ev-zoom__value" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" className="ev-pop__button" aria-label="Phóng to" disabled={index >= ZOOMS.length - 1} onClick={() => onZoom(ZOOMS[index + 1])}>
        +
      </button>
    </span>
  );
}

// Không còn file PDF trong trình duyệt: hiện chữ của trang (nếu còn), câu trích tô vàng, kèm nút tải lại file.
function MissingPdf({ target, pages, onReloaded }: { target: EvidenceTarget; pages: PdfPage[] | null; onReloaded: () => void }) {
  const view = evidenceView(target.cell, target.page);
  const input = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const data = await file.arrayBuffer();
      const hash = await fileHash(data);
      const expected = target.paper.file?.hash;
      if (expected && hash !== expected) {
        setError("File này khác file đã dùng lúc AI điền bảng, nên vị trí tô vàng có thể không đúng. Hãy chọn đúng file của bài này.");
        return;
      }
      const ok = await savePdf(target.paper.id, { blob: file, name: file.name, size: file.size, hash });
      if (!ok) {
        setError("Trình duyệt không cho lưu file (có thể đang ở cửa sổ ẩn danh hoặc ổ đĩa đầy).");
        return;
      }
      forgetPaperPdf(target.paper.id);
      onReloaded();
    } catch {
      setError("Chưa đọc được file này. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  }

  let body: ReactNode;
  if (pages && view.page !== null) {
    body = (
      <>
        <p className="ev-pop__note">File PDF gốc không còn trong trình duyệt này. Đang hiện chữ của trang đọc từ file lúc tải lên.</p>
        <div className="ev-pop__text">
          <PageTextView pages={pages} page={view.page} ranges={view.ranges} lang={target.paper.language_code} />
        </div>
      </>
    );
  } else {
    body = (
      <>
        <p className="ev-pop__note">
          File PDF gốc và chữ của bài không còn trong trình duyệt này{target.paper.filled_by ? "" : " (bài minh hoạ có sẵn trong app)"}. Câu trích:
        </p>
        <blockquote className="ev-pop__quote source-text" lang={target.paper.language_code} translate="no">
          {target.cell.quote_original}
        </blockquote>
      </>
    );
  }

  return (
    <div className="ev-pop__missing">
      {body}
      <div className="ev-pop__reupload">
        <button type="button" className="button button--secondary" disabled={busy} onClick={() => input.current?.click()}>
          Tải lại file PDF để xem bản gốc
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// Toàn màn hình: cả bài, mở sẵn ở trang có câu trích, vẫn tô vàng, phóng to thu nhỏ, chuyển trang, Esc để thoát.
function PdfFullscreen({ target, onExit }: { target: EvidenceTarget; onExit: () => void }) {
  const view = evidenceView(target.cell, target.page);
  const { loaded } = usePaperPdf(target);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [sizes, setSizes] = useState<{ width: number; height: number }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState<Set<number>>(() => new Set(view.page ? [view.page] : [1]));
  const [currentPage, setCurrentPage] = useState(view.page ?? 1);
  const jumped = useRef(false);
  const pageRefs = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (loaded.kind !== "pdf") return;
    let alive = true;
    void Promise.all(Array.from({ length: loaded.doc.numPages }, (_, i) => pageSize(loaded.doc, i + 1)))
      .then((list) => alive && setSizes(list))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [loaded]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const widest = sizes ? Math.max(...sizes.map((size) => size.width)) : 1;
  const fit = width ? Math.min((width - 32) / widest, 1.6) : 1;
  const scale = fit * zoom;

  // Chỉ vẽ những trang đang ở gần phần nhìn thấy.
  useEffect(() => {
    const root = scroller.current;
    if (!root || !sizes) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Chỉ giữ ảnh của các trang đang ở gần phần nhìn thấy; trang đã cuộn xa thì bỏ ảnh để đỡ tốn bộ nhớ.
        setVisible((before) => {
          const next = new Set(before);
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(page);
            else next.delete(page);
          }
          return next.size === before.size && [...next].every((page) => before.has(page)) ? before : next;
        });
      },
      { root, rootMargin: "600px 0px" },
    );
    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sizes, scale]);

  // Trang đang xem: trang nằm ở một phần ba trên của khung.
  useEffect(() => {
    const root = scroller.current;
    if (!root || !sizes) return;
    const onScroll = () => {
      if (!jumped.current) return;
      const line = root.scrollTop + root.clientHeight / 3;
      let page = 1;
      for (const [number, element] of pageRefs.current) if (element.offsetTop <= line && number > page) page = number;
      setCurrentPage(page);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [sizes]);

  // Mở sẵn ở trang có câu trích.
  useEffect(() => {
    if (!sizes || !width || jumped.current) return;
    const element = pageRefs.current.get(view.page ?? 1);
    if (element && scroller.current) {
      scroller.current.scrollTop = element.offsetTop - 16;
      jumped.current = true;
    }
  }, [sizes, width, view.page]);

  function goTo(page: number) {
    const target = Math.min(Math.max(page, 1), sizes?.length ?? 1);
    const element = pageRefs.current.get(target);
    if (element && scroller.current) scroller.current.scrollTop = element.offsetTop - 8;
    setCurrentPage(target);
  }

  const onMark = useCallback((mark: HTMLElement | null) => {
    const element = scroller.current;
    if (!element || !mark) return;
    const markBox = mark.getBoundingClientRect();
    const own = element.getBoundingClientRect();
    element.scrollTop += markBox.top - own.top - element.clientHeight / 3;
  }, []);

  return (
    <dialog
      ref={dialog}
      className="pdf-full"
      aria-label={`Toàn bộ file PDF, đang ở trang ${currentPage}`}
      onCancel={(event) => {
        event.preventDefault();
        onExit();
      }}
    >
      <header className="pdf-full__bar">
        <div className="pdf-full__title">
          <span className={`ev-chip ev-chip--${view.label} ev-chip--static`}>
            <StatusIcon label={view.label} />
            {evidenceLabel(target.cell, target.page) ?? STATUS_LABELS[view.label]}
          </span>
          <span className="source-text pdf-full__paper" lang={target.paper.language_code} translate="no">
            {target.paper.info.title}
          </span>
        </div>
        <div className="pdf-full__tools">
          <span className="ev-zoom" role="group" aria-label="Chuyển trang">
            <button type="button" className="ev-pop__button" aria-label="Trang trước" disabled={currentPage <= 1} onClick={() => goTo(currentPage - 1)}>
              ‹
            </button>
            <span className="ev-zoom__value">
              Trang {currentPage}/{sizes?.length ?? "…"}
            </span>
            <button
              type="button"
              className="ev-pop__button"
              aria-label="Trang sau"
              disabled={!sizes || currentPage >= sizes.length}
              onClick={() => goTo(currentPage + 1)}
            >
              ›
            </button>
          </span>
          <ZoomButtons zoom={zoom} onZoom={setZoom} />
          <button type="button" className="ev-pop__button" onClick={onExit}>
            Thoát <kbd>Esc</kbd>
          </button>
        </div>
      </header>
      {view.note ? <p className={view.label === "needs_review" ? "ev-pop__note ev-pop__note--warn pdf-full__note" : "ev-pop__note pdf-full__note"}>{view.note}</p> : null}
      <div ref={scroller} className="pdf-full__scroll" tabIndex={0} aria-label="Các trang của file PDF">
        {failed ? (
          <p className="ev-pop__note" role="alert">
            <span className="ev-pop__error">Chưa mở được file PDF này.</span> Hãy thoát rồi mở lại. Nếu vẫn lỗi, hãy tải lại file PDF của bài.
          </p>
        ) : loaded.kind === "loading" || (loaded.kind === "pdf" && !sizes) ? (
          <p className="ev-pop__loading" role="status">
            <span className="spinner" aria-hidden="true" /> Đang mở file PDF…
          </p>
        ) : loaded.kind === "missing" ? (
          <p className="ev-pop__note">File PDF không còn trong trình duyệt này.</p>
        ) : (
          sizes!.map((size, index) => {
            const page = index + 1;
            return (
              <div
                key={page}
                data-page={page}
                ref={(element) => {
                  if (element) pageRefs.current.set(page, element);
                  else pageRefs.current.delete(page);
                }}
                className="pdf-full__page"
                style={{ width: size.width * scale, height: size.height * scale }}
              >
                {visible.has(page) && loaded.kind === "pdf" ? (
                  <PdfPageView
                    doc={loaded.doc}
                    paperId={target.paper.id}
                    page={page}
                    scale={scale}
                    ranges={view.ranges}
                    placeholder={size}
                    expectedText={pageTextOf(loaded.pages, page)}
                    onRendered={page === view.page ? onMark : undefined}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </dialog>
  );
}
