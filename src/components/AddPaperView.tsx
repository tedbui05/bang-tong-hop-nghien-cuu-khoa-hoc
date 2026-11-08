"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { hasContentColumn, isOwnColumn } from "@/lib/columns";
import { readPdfInBrowser } from "@/lib/pdf-browser";
import { MAX_PDF_BYTES, checkPdfFile, formatMegabytes, type PdfError } from "@/lib/pdf-read";
import type { PreviewState } from "@/lib/preview-state";
import { useStore } from "@/lib/store";
import { SkeletonLines, StateMessage } from "./StateMessage";

const PRIVACY_NOTE = "Chỉ tải lên bài báo đã công bố. Không tải tài liệu mật hoặc chưa công bố.";

export function AddPaperView({ state }: { state: PreviewState }) {
  // Đổi trạng thái xem thử thì dựng lại form từ đầu.
  return <AddPaperContent key={state} state={state} />;
}

function AddPaperContent({ state }: { state: PreviewState }) {
  const router = useRouter();
  const { activeTable, startReview, hydrated } = useStore();
  const table = state === "trong" ? null : activeTable;
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<Pick<PdfError, "title" | "detail"> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  // Mỗi lần chọn file hoặc rời trang thì tăng lên, để kết quả của lần đọc cũ không ghi đè lần mới.
  const attempt = useRef(0);

  useEffect(() => {
    const counter = attempt;
    return () => {
      counter.current++;
    };
  }, []);

  async function chooseFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const current = ++attempt.current;
    if (files.length > 1) {
      setFile(null);
      setFileError({
        title: `Bạn vừa chọn ${files.length} file`,
        detail: "Mỗi lần chỉ nhận một bài báo, hãy chọn lại một file.",
      });
      return;
    }
    const chosen = files[0];
    // Kiểm tra nhanh loại file và dung lượng ngay khi chọn, chưa đọc cả file.
    const problem = await checkPdfFile(chosen).catch(() => null);
    if (current !== attempt.current) return;
    setFile(problem ? null : chosen);
    setFileError(problem);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void chooseFiles(event.dataTransfer.files);
  }

  async function startReading() {
    if (!file || !table || !hydrated || !hasContentColumn(table.columns)) return;
    const current = ++attempt.current;
    setReading(true);
    setFileError(null);
    const result = await readPdfInBrowser(file);
    if (current !== attempt.current) return;
    if (!result.ok) {
      setReading(false);
      setFile(null);
      setFileError(result.error);
      return;
    }
    // Chưa nối AI: trang duyệt vẫn hiện bài mẫu, chữ từng trang được giữ để làm bước kiểm tra câu trích.
    startReview(file.name, result.pages);
    router.push("/duyet-bai");
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
                void chooseFiles(event.target.files);
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
                <span>hoặc bấm để chọn từ máy. Một file PDF, tối đa {formatMegabytes(MAX_PDF_BYTES)}.</span>
              </>
            )}
          </label>

          {fileError ? (
            <p id="loi-file" className="field-error" role="alert">
              <strong>{fileError.title}.</strong> {fileError.detail}
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
                onClick={() => void startReading()}
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
