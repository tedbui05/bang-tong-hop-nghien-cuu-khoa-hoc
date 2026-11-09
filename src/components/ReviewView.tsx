"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { reviewQuestion } from "@/lib/columns";
import { canQuickApprove } from "@/lib/paper-pipeline";
import type { PreviewState } from "@/lib/preview-state";
import { useStore } from "@/lib/store";
import { filledByText, getLabelKey } from "@/lib/types";
import { EvidencePreviewLayer, useEvidencePreview } from "./EvidencePreview";
import { EvidenceSide } from "./EvidenceSide";
import { InfoCard } from "./InfoCard";
import { LeaveGuard } from "./LeaveGuard";
import { ReviewCard } from "./ReviewCard";
import { SkeletonLines, StateMessage } from "./StateMessage";

export function ReviewView({ state }: { state: PreviewState }) {
  const router = useRouter();
  const { review, startSampleReview, activeTable, queue, queueLoaded, openReview } = useStore();
  const firstReady = queue.find((item) => item.status === "ready")?.id ?? null;
  const processing = queue.some((item) => ["waiting", "reading", "ai", "checking"].includes(item.status));

  // Chưa mở bài nào mà có bài chờ duyệt: mở bài đầu tiên.
  useEffect(() => {
    if (state === "binh-thuong" && !review && firstReady) openReview(firstReady);
  }, [state, review, firstReady, openReview]);

  if (state === "dang-tai") {
    return (
      <main id="noi-dung" className="page">
        <h1 className="page-title">Duyệt bài</h1>
        <StateMessage tone="loading" title="Đang đọc bài và kiểm tra câu trích…">
          <SkeletonLines count={5} />
        </StateMessage>
      </main>
    );
  }

  if (state === "loi") {
    return (
      <main id="noi-dung" className="page">
        <h1 className="page-title">Duyệt bài</h1>
        <StateMessage
          tone="error"
          title="Chưa đọc xong bài này"
          action={
            <Link className="button button--secondary" href="/them-bai">
              Tải lại bài báo
            </Link>
          }
        >
          <p>Quá trình đọc bị gián đoạn. Hãy tải lại bài báo và thử lần nữa.</p>
        </StateMessage>
      </main>
    );
  }

  if (state !== "trong" && !review && (!queueLoaded || firstReady || processing)) {
    return (
      <main id="noi-dung" className="page">
        <h1 className="page-title">Duyệt bài</h1>
        <StateMessage
          tone="loading"
          title={processing && !firstReady ? "AI đang đọc bài, có thể mất 1 đến 2 phút" : "Đang mở bài chờ duyệt…"}
          action={
            processing && !firstReady ? (
              <Link className="button button--secondary" href="/them-bai">
                Xem hàng chờ
              </Link>
            ) : undefined
          }
        >
          {processing && !firstReady ? <p>Bài sẽ hiện ở đây ngay khi AI điền xong và app kiểm tra xong câu trích.</p> : null}
          <SkeletonLines count={5} />
        </StateMessage>
      </main>
    );
  }

  if (state === "trong" || !review) {
    return (
      <main id="noi-dung" className="page">
        <h1 className="page-title">Duyệt bài</h1>
        <StateMessage
          tone="empty"
          title="Chưa có bài nào chờ duyệt"
          action={
            <>
              <Link className="button button--primary" href="/them-bai">
                Thêm bài báo
              </Link>
              <button
                type="button"
                className="button button--quiet"
                disabled={!activeTable}
                onClick={() => {
                  startSampleReview();
                  router.push("/duyet-bai");
                }}
              >
                Xem bài mẫu
              </button>
            </>
          }
        >
          <p>Tải một bài báo lên, các ô AI đề xuất sẽ hiện ở đây để bạn duyệt.</p>
        </StateMessage>
      </main>
    );
  }

  return <ReviewSession key={review.id} />;
}

function ReviewSession() {
  const router = useRouter();
  const { review, tables, queue, updateCell, quickApprove, updateInfo, setInfoConfirmed, saveReview } = useStore();
  const cards = useRef<(HTMLElement | null)[]>([]);
  const infoCard = useRef<HTMLElement | null>(null);
  const saveButton = useRef<HTMLButtonElement | null>(null);
  // Nơi cần chuyển tới. Nút lưu chỉ nhận được khi đã mở khóa, nên có thể phải chờ lần vẽ sau.
  const focusTarget = useRef<number | "save" | "info" | null>(null);
  // Ô đang xem bằng chứng ở khung bên phải.
  const [active, setActive] = useState(0);
  // Điện thoại: khung chữ của trang trượt lên từ dưới khi bấm "Xem chữ trang".
  const [sheetOpen, setSheetOpen] = useState(false);
  // Khung xem trước trang PDF khi rê chuột, Tab hoặc bấm vào nhãn bằng chứng.
  const preview = useEvidencePreview();

  function applyFocus() {
    const target = focusTarget.current;
    if (target === null) return;
    const element = target === "save" ? saveButton.current : target === "info" ? infoCard.current : cards.current[target];
    if (!element || (element instanceof HTMLButtonElement && element.disabled)) return;
    focusTarget.current = null;
    element.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }

  useEffect(() => {
    applyFocus();
  });

  // Mở trang là chọn sẵn ô chưa duyệt đầu tiên, không cuộn trang để vẫn thấy tên bài.
  useEffect(() => {
    const first = review?.infoConfirmed ? cards.current.find((_, index) => review.cells[index]?.review === "pending") : infoCard.current;
    first?.focus({ preventScroll: true });
    // Chỉ chạy một lần khi mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!review) return null;
  const session = review;

  const table = tables.find((item) => item.id === session.tableId);
  const columns = table?.columns ?? [];
  const columnName = (id: string) => columns.find((column) => column.id === id)?.name ?? id;
  const unfilledColumns = columns.filter(
    (column) => column.kind === "content" && !session.cells.some((cell) => cell.column === column.id),
  );
  const isSample = session.fileName === null;
  const othersWaiting = queue.filter((item) => item.status === "ready" && item.id !== session.id && item.tableId === session.tableId).length;

  // Thẻ thông tin bài cũng là một mục phải duyệt.
  const total = session.cells.length + 1;
  const done = session.cells.filter((cell) => cell.review !== "pending").length + (session.infoConfirmed ? 1 : 0);
  const remaining = total - done;
  const flaggedLeft = session.cells.filter(
    (cell) => cell.review === "pending" && getLabelKey(cell) === "needs_review",
  ).length;
  const quickAllowed = canQuickApprove(session.cells);
  const activeCell = session.cells[Math.min(active, session.cells.length - 1)];

  // Sang ô chưa duyệt kế tiếp, hết rồi thì quay lại từ đầu; không còn ô nào thì chọn nút lưu.
  function goNext(index: number, infoDone = session.infoConfirmed) {
    const count = session.cells.length;
    const order = session.cells.map((_, i) => (index + 1 + i) % count);
    const next = order.find((i) => i !== index && session.cells[i].review === "pending");
    focusTarget.current = next ?? (infoDone ? "save" : "info");
    applyFocus();
  }

  function confirm(index: number) {
    const cell = session.cells[index];
    updateCell(index, { review: cell.value_vi === cell.suggested_value ? "confirmed" : "edited" });
    goNext(index);
  }

  function save() {
    const result = saveReview();
    if (!result) return;
    if (result.next) window.scrollTo({ top: 0 });
    else router.push("/");
  }

  // Giữ chặt Enter sau ô cuối không được tự lưu.
  function guardHeldEnter(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" && event.repeat) event.preventDefault();
  }

  return (
    <>
      <LeaveGuard
        active
        title="Bài này chưa được lưu vào bảng"
        detail={
          isSample
            ? "Bài mẫu không được giữ lại. Nếu rời trang, phần bạn đã duyệt sẽ mất."
            : "Phần bạn đã duyệt vẫn được giữ trên trình duyệt này, bạn có thể quay lại duyệt tiếp ở trang Thêm bài. Bài chỉ hiện trong bảng sau khi bấm “Lưu vào bảng”."
        }
      />
      <div className="review-bar">
        <div className="review-bar__inner review-bar__inner--wide">
          <p className="review-bar__status" role="status">
            <strong>
              Đã duyệt {done}/{total}
            </strong>
            {flaggedLeft > 0 ? <span>Còn {flaggedLeft} ô cần kiểm tra</span> : null}
          </p>
          <button
            ref={saveButton}
            type="button"
            className={remaining > 0 ? "button button--secondary" : "button button--primary"}
            disabled={remaining > 0}
            onClick={save}
            onKeyDown={guardHeldEnter}
          >
            Lưu vào bảng
          </button>
        </div>
        <progress value={done} max={total} aria-label="Tiến độ duyệt" />
      </div>

      <main id="noi-dung" className="page page--wide review-page">
        <div className="paper-heading">
          <h1 className="source-text" lang={session.paper.language_code} translate="no">
            {session.paper.info.title}
          </h1>
          {table ? <p className="paper-heading__meta">Sẽ lưu vào bảng “{table.name}”</p> : null}
          {session.fileName ? <p className="small-note">File: {session.fileName}</p> : null}
          {session.paper.filled_by ? (
            <p className={session.paper.filled_by.fallback ? "small-note filled-by filled-by--fallback" : "small-note filled-by"}>
              {filledByText(session.paper.filled_by)}
            </p>
          ) : null}
          {isSample ? <p className="small-note">Đây là bài mẫu của bản xem thử, chưa qua AI. Nhãn kiểm tra được gán tay.</p> : null}
          {othersWaiting > 0 ? <p className="small-note">Sau bài này còn {othersWaiting} bài chờ duyệt.</p> : null}
        </div>

        <div className="review-layout">
          <div className="review-list">
            <InfoCard
              paper={session.paper}
              columns={columns.filter((column) => column.kind === "info")}
              confirmed={session.infoConfirmed}
              register={(element) => {
                infoCard.current = element;
              }}
              onChange={updateInfo}
              onConfirm={() => {
                setInfoConfirmed(true);
                goNext(-1, true);
              }}
              onNext={() => goNext(-1, true)}
              onReopen={() => setInfoConfirmed(false)}
            />

            {quickAllowed ? (
              <div className="quick-approve">
                <p>Mọi ô đều đã khớp với bài và không có cảnh báo. Bạn vẫn nên lướt qua từng ô trước khi duyệt nhanh.</p>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    quickApprove();
                    focusTarget.current = session.infoConfirmed ? "save" : "info";
                  }}
                >
                  Duyệt nhanh cả dòng
                </button>
              </div>
            ) : null}

            {session.cells.map((cell, index) => (
              <ReviewCard
                key={cell.column}
                cell={cell}
                columnName={columnName(cell.column)}
                question={reviewQuestion(cell.column)}
                paper={session.paper}
                pages={session.pages}
                preview={preview}
                selected={index === active}
                register={(element) => {
                  cards.current[index] = element;
                }}
                onSelect={() => setActive(index)}
                onShowPage={() => {
                  setActive(index);
                  setSheetOpen(true);
                }}
                onConfirm={() => confirm(index)}
                onNext={() => goNext(index)}
                onChange={(change) => updateCell(index, change)}
              />
            ))}
          </div>

          {activeCell ? (
            <EvidenceSide
              cell={activeCell}
              columnName={columnName(activeCell.column)}
              pages={session.pages}
              lang={session.paper.language_code}
              open={sheetOpen}
              onClose={() => {
                setSheetOpen(false);
                cards.current[active]?.focus({ preventScroll: true });
              }}
            />
          ) : null}
        </div>

        {unfilledColumns.length > 0 ? (
          <p className="small-note review-unfilled">
            Chưa điền: {unfilledColumns.map((column) => column.name).join(", ")}.{" "}
            {isSample
              ? "Bài mẫu chỉ có nội dung cho những cột trùng với bài mẫu."
              : "Các cột này được thêm sau khi AI đã đọc bài."}{" "}
            Sau khi lưu, các ô này ghi “chưa điền” và bạn có thể tự gõ trong bảng.
          </p>
        ) : null}

        <p className="shortcut-hint">
          <kbd>Enter</kbd> xác nhận và sang ô tiếp theo <kbd>E</kbd> sửa ô đang chọn
        </p>
      </main>
      <EvidencePreviewLayer preview={preview} />
    </>
  );
}
