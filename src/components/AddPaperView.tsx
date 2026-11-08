"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { hasContentColumn, isOwnColumn } from "@/lib/columns";
import type { PreviewState } from "@/lib/preview-state";
import { useStore } from "@/lib/store";
import { SkeletonLines, StateMessage } from "./StateMessage";

const FAKE_READING_MS = 1500;
const PRIVACY_NOTE = "Chỉ tải lên bài báo đã công bố. Không tải tài liệu mật hoặc chưa công bố.";

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function AddPaperView({ state }: { state: PreviewState }) {
  // Đổi trạng thái xem thử thì dựng lại form từ đầu.
  return <AddPaperContent key={state} state={state} />;
}

function AddPaperContent({ state }: { state: PreviewState }) {
  const router = useRouter();
  const { activeTable, startReview, hydrated } = useStore();
  const table = state === "trong" ? null : activeTable;
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function chooseFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      setFile(null);
      setFileError(`Bạn vừa chọn ${files.length} file. Mỗi lần chỉ nhận một bài báo, hãy chọn lại một file.`);
      return;
    }
    if (!isPdf(files[0])) {
      setFile(null);
      setFileError(`“${files[0].name}” không phải file PDF. Hãy chọn một file PDF.`);
      return;
    }
    setFile(files[0]);
    setFileError(null);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    chooseFiles(event.dataTransfer.files);
  }

  function startReading() {
    if (!file || !table || !hydrated || !hasContentColumn(table.columns)) return;
    setReading(true);
    timer.current = setTimeout(() => {
      startReview(file.name);
      router.push("/duyet-bai");
    }, FAKE_READING_MS);
  }

  return (
    <main id="noi-dung" className="page page--narrow">
      <h1 className="page-title">Thêm bài báo</h1>

      {state === "dang-tai" || reading ? (
        <StateMessage tone="loading" title="Đang đọc bài báo…">
          <p>{file ? `${file.name}. ` : ""}Bước này có thể mất một lúc.</p>
          <SkeletonLines />
        </StateMessage>
      ) : state === "loi" ? (
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
            className={`dropzone${dragging ? " dropzone--active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="visually-hidden"
              aria-describedby={fileError ? "loi-file privacy-note" : "privacy-note"}
              onChange={(event) => {
                chooseFiles(event.target.files);
                event.target.value = "";
              }}
            />
            {file ? (
              <>
                <strong className="dropzone__file">{file.name}</strong>
                <span>Kéo thả hoặc bấm để đổi file khác</span>
              </>
            ) : (
              <>
                <strong>Kéo thả file PDF vào đây</strong>
                <span>hoặc bấm để chọn từ máy</span>
              </>
            )}
          </label>

          {fileError ? (
            <p id="loi-file" className="field-error" role="alert">
              {fileError}
            </p>
          ) : null}

          <p id="privacy-note" className="fine-print fine-print--tight">
            {PRIVACY_NOTE}
          </p>

          {file ? (
            <div className="form-actions">
              <button
                type="button"
                className="button button--primary"
                disabled={!hydrated || !hasContentColumn(table.columns)}
                onClick={startReading}
              >
                Đọc bài báo
              </button>
              {!hasContentColumn(table.columns) ? (
                <p className="form-actions__hint">Bảng chưa có cột nội dung nào để điền. Hãy thêm cột trước.</p>
              ) : null}
            </div>
          ) : null}

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
