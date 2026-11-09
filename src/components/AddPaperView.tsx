"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { waitingMessage } from "@/lib/ai-extract";
import { SAMPLE_PAPER_NAME, SAMPLE_PAPER_URL, isAppSamplePaper } from "@/lib/app-sample";
import { hasContentColumn, isOwnColumn } from "@/lib/columns";
import { MAX_PDF_BYTES, formatMegabytes } from "@/lib/pdf-read";
import type { PreviewState } from "@/lib/preview-state";
import { STATUS_LABELS } from "@/lib/sheet";
import { useStore, type QueueItem } from "@/lib/store";
import { getLabelKey, type LabelKey } from "@/lib/types";
import { SkeletonLines, StateMessage } from "./StateMessage";
import { StatusIcon } from "./StatusBadge";

const PRIVACY_NOTE = "Chỉ tải lên bài báo đã công bố. Không tải tài liệu mật hoặc chưa công bố.";

export function AddPaperView({ state }: { state: PreviewState }) {
  // Đổi trạng thái xem thử thì dựng lại form từ đầu.
  return <AddPaperContent key={state} state={state} />;
}

// Đọc mọi file trong thư mục được kéo thả vào, kể cả thư mục con.
async function filesFromDrop(items: DataTransferItemList): Promise<File[]> {
  const entries = [...items].map((item) => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => Boolean(entry));
  const out: File[] = [];
  async function walk(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) => (entry as FileSystemFileEntry).file(resolve, () => resolve(null)));
      if (file) out.push(file);
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries trả về từng đợt, gọi đến khi hết.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve, () => resolve([])));
      if (!batch.length) break;
      for (const child of batch) await walk(child);
    }
  }
  for (const entry of entries) await walk(entry);
  return out;
}

function AddPaperContent({ state }: { state: PreviewState }) {
  const { activeTable, hydrated, queue, addFiles } = useStore();
  const table = state === "trong" ? null : activeTable;
  const [dragging, setDragging] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [sampleState, setSampleState] = useState<"idle" | "loading" | "missing" | "offline">("idle");
  const folderInput = useRef<HTMLInputElement | null>(null);
  const canAdd = Boolean(table && hydrated && hasContentColumn(table.columns));

  const items = queue.filter((item) => !item.sample);
  // Bài mẫu đang chờ xử lý hoặc chờ duyệt ở bảng này: không cho thêm bản nữa, mỗi bản tốn 1 lượt AI.
  const sampleQueued = items.some((item) => isAppSamplePaper(item.fileName) && item.tableId === table?.id && item.status !== "saved");
  const working = items.some((item) => ["waiting", "reading", "ai", "checking"].includes(item.status));

  // Tải lại trang khi còn bài chưa xử lý xong thì mất file: nhắc trước.
  useEffect(() => {
    if (!working) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [working]);

  function take(files: File[]) {
    if (!canAdd || files.length === 0) return;
    // Bỏ file ẩn của hệ điều hành (.DS_Store) khỏi danh sách báo bỏ qua.
    const visible = files.filter((file) => !file.name.startsWith("."));
    setSkipped(addFiles(visible));
  }

  async function addSamplePaper() {
    setSampleState("loading");
    try {
      const response = await fetch(SAMPLE_PAPER_URL);
      if (!response.ok) {
        setSampleState("missing");
        return;
      }
      take([new File([await response.blob()], SAMPLE_PAPER_NAME, { type: "application/pdf" })]);
      setSampleState("idle");
    } catch {
      setSampleState("offline");
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const list = event.dataTransfer.items?.length ? await filesFromDrop(event.dataTransfer.items) : [...event.dataTransfer.files];
    take(list.length ? list : [...event.dataTransfer.files]);
  }

  if (state === "dang-tai") {
    return (
      <main id="noi-dung" className="page page--narrow">
        <h1 className="page-title">Thêm bài báo</h1>
        <StateMessage tone="loading" title="Đang đọc bài báo…">
          <p>Bước này có thể mất một lúc.</p>
          <SkeletonLines />
        </StateMessage>
      </main>
    );
  }

  return (
    <main id="noi-dung" className="page page--narrow">
      <h1 className="page-title">Thêm bài báo</h1>

      {state === "loi" ? (
        <StateMessage
          tone="error"
          title="Chưa đọc được file này"
          action={
            <Link className="button button--secondary" href="/them-bai">
              Chọn file khác
            </Link>
          }
        >
          <p>File có thể bị hỏng hoặc là bản scan. Hãy thử file PDF bôi đen được chữ.</p>
        </StateMessage>
      ) : !table ? (
        <StateMessage
          tone="empty"
          title="Hãy tạo bảng trước"
          action={
            <Link className="button button--primary" href="/tao-bang">
              Tạo bảng mới
            </Link>
          }
        >
          <p>Thiết lập các cột trước, thông tin của bài sẽ được điền theo đúng các cột đó.</p>
        </StateMessage>
      ) : (
        <>
          <label
            className={`dropzone${dragging ? " dropzone--active" : ""}${canAdd ? "" : " dropzone--disabled"}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => void handleDrop(event)}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={!canAdd}
              className="visually-hidden"
              aria-describedby="privacy-note"
              onChange={(event) => {
                take([...(event.target.files ?? [])]);
                event.target.value = "";
              }}
            />
            <strong>Kéo thả file PDF hoặc cả thư mục vào đây</strong>
            <span>
              hoặc bấm để chọn file. Chọn được nhiều file, mỗi file tối đa {formatMegabytes(MAX_PDF_BYTES)}. App đọc lần lượt
              từng bài.
            </span>
          </label>

          <div className="dropzone-actions">
            <button type="button" className="link-button" disabled={!canAdd} onClick={() => folderInput.current?.click()}>
              Chọn cả thư mục
            </button>
            <input
              ref={folderInput}
              type="file"
              multiple
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              {...{ webkitdirectory: "" }}
              onChange={(event) => {
                take([...(event.target.files ?? [])]);
                event.target.value = "";
              }}
            />
          </div>

          <div className="sample-paper">
            <p className="sample-paper__text">
              Chưa có bài báo trong máy? Thử với bài mẫu do app tạo. Đây không phải bài báo thật: tên người, tạp chí và số
              liệu đều là hư cấu. AI đọc bài mẫu cũng tính 1 lượt trong ngày.
            </p>
            <div className="sample-paper__actions">
              <button
                type="button"
                className="button button--secondary"
                disabled={!canAdd || sampleState === "loading" || sampleQueued}
                onClick={() => void addSamplePaper()}
              >
                {sampleState === "loading" ? "Đang lấy bài mẫu…" : sampleQueued ? "Bài mẫu đã ở hàng chờ" : "Tải bài mẫu để thử"}
              </button>
              <a className="link-button" href={SAMPLE_PAPER_URL} download={SAMPLE_PAPER_NAME}>
                Tải file về máy để xem
              </a>
            </div>
            {sampleState === "offline" || sampleState === "missing" ? (
              <p className="field-error" role="alert">
                {sampleState === "offline"
                  ? "Chưa lấy được bài mẫu. Hãy kiểm tra mạng rồi bấm lại."
                  : "Máy chủ chưa có file bài mẫu. Hãy báo người quản lý app."}
              </p>
            ) : null}
          </div>

          {!hasContentColumn(table.columns) ? (
            <p className="field-error">Bảng chưa có cột nội dung nào để điền. Hãy thêm cột trước.</p>
          ) : null}

          {skipped.length > 0 ? (
            <p className="notice notice--soft" role="status">
              Đã bỏ qua {skipped.length} file không phải PDF: {skipped.slice(0, 5).join(", ")}
              {skipped.length > 5 ? ` và ${skipped.length - 5} file khác` : ""}.
            </p>
          ) : null}

          <p id="privacy-note" className="fine-print fine-print--tight">
            {PRIVACY_NOTE}
          </p>

          {items.length > 0 ? <PaperQueue items={items} /> : null}

          <section className="columns-section" aria-labelledby="cac-cot">
            <h2 id="cac-cot">Sẽ điền vào bảng “{table.name}” theo các cột:</h2>
            <ul className="column-chips">
              {table.columns.filter((column) => !isOwnColumn(column)).map((column) => (
                <li key={column.id} title={column.description || undefined}>
                  {column.name}
                </li>
              ))}
            </ul>
            <Link className="link-button" href="/">
              Đổi cột ngay trên bảng
            </Link>
          </section>
        </>
      )}
    </main>
  );
}

function PaperQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const { openReview, retryItem, removeItem } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const waitingAi = items.some((item) => item.status === "ai");

  // Đồng hồ để đếm số giây đã chờ AI.
  useEffect(() => {
    if (!waitingAi) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitingAi]);

  const ready = items.filter((item) => item.status === "ready").length;
  const saved = items.filter((item) => item.status === "saved").length;
  const left = items.filter((item) => ["waiting", "reading", "ai", "checking"].includes(item.status)).length;

  return (
    <section className="queue" aria-labelledby="hang-cho">
      <div className="queue__head">
        <h2 id="hang-cho">Hàng chờ</h2>
        <p className="queue__summary">
          {items.length} bài
          {left ? ` · ${left} đang xử lý` : ""}
          {ready ? ` · ${ready} chờ duyệt` : ""}
          {saved ? ` · ${saved} đã lưu` : ""}
        </p>
      </div>
      <ol className="queue__list">
        {items.map((item) => (
          <li key={item.id} className={`queue-item queue-item--${item.status}`}>
            <div className="queue-item__main">
              <p className="queue-item__name">{item.fileName}</p>
              <QueueStatusLine item={item} now={now} />
            </div>
            <div className="queue-item__actions">
              {item.status === "ready" ? (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    openReview(item.id);
                    router.push("/duyet-bai");
                  }}
                >
                  Duyệt bài
                </button>
              ) : null}
              {item.status === "error" && item.error?.retry ? (
                <button type="button" className="button button--secondary" onClick={() => retryItem(item.id)}>
                  Thử lại
                </button>
              ) : null}
              {item.status === "ready" ? (
                <button
                  type="button"
                  className="button button--quiet"
                  aria-label={`Bỏ ${item.fileName}, không lưu vào bảng`}
                  onClick={() => {
                    // Bỏ là mất kết quả AI của bài này: hỏi lại cho chắc.
                    if (window.confirm(`Bỏ bài “${item.fileName}”? Kết quả AI của bài này sẽ mất, muốn điền lại phải tải bài lên lần nữa.`)) {
                      removeItem(item.id);
                    }
                  }}
                >
                  Bỏ bài này
                </button>
              ) : null}
              {item.status === "waiting" || item.status === "error" || item.status === "saved" ? (
                <button
                  type="button"
                  className="button button--quiet"
                  aria-label={`Bỏ ${item.fileName} khỏi danh sách`}
                  onClick={() => removeItem(item.id)}
                >
                  Bỏ khỏi danh sách
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function QueueStatusLine({ item, now }: { item: QueueItem; now: number }) {
  if (item.status === "error" && item.error) {
    return (
      <div className="queue-item__error" role="alert">
        <p className="queue-item__error-title">{item.error.title}</p>
        <p>{item.error.detail}</p>
      </div>
    );
  }
  if (item.status === "ai") {
    const seconds = Math.max(0, Math.floor((now - (item.aiStartedAt ?? now)) / 1000));
    return (
      <p className="queue-item__status">
        <span className="spinner" aria-hidden="true" />
        <span role="status">{waitingMessage(seconds)}</span>
        <span className="queue-item__time">Đã chờ {seconds} giây</span>
      </p>
    );
  }
  if (item.status === "ready" && item.session) {
    const counts = new Map<LabelKey, number>();
    for (const cell of item.session.cells) counts.set(getLabelKey(cell), (counts.get(getLabelKey(cell)) ?? 0) + 1);
    const order: LabelKey[] = ["verified", "page_corrected", "needs_review", "not_found"];
    return (
      <div className="queue-item__status queue-item__status--ready">
        <span role="status">AI đã điền xong, chờ bạn duyệt.</span>
        <ul className="queue-item__counts" aria-label="Kết quả kiểm tra câu trích">
          {order
            .filter((key) => counts.get(key))
            .map((key) => (
              <li key={key} className={`queue-count queue-count--${key}`}>
                <StatusIcon label={key} />
                {counts.get(key)} {STATUS_LABELS[key]}
              </li>
            ))}
        </ul>
      </div>
    );
  }
  const text: Record<string, string> = {
    waiting: "Đang chờ đến lượt",
    reading: "Đang đọc chữ trong file…",
    checking: "Đang kiểm tra câu trích…",
    saved: "Đã lưu vào bảng",
  };
  return (
    <p className="queue-item__status">
      {item.status === "reading" || item.status === "checking" ? <span className="spinner" aria-hidden="true" /> : null}
      <span role="status">{text[item.status] ?? ""}</span>
    </p>
  );
}
