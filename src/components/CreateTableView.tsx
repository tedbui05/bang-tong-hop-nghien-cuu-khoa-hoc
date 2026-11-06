"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  checkColumnName,
  checkTableName,
  hasContentColumn,
  moveColumn,
  newContentColumn,
  removedInfoColumns,
  suggestedColumns,
  titleColumn,
  TITLE_COLUMN_ID,
} from "@/lib/columns";
import type { PreviewState } from "@/lib/preview-state";
import { useStore } from "@/lib/store";
import type { TableColumn } from "@/lib/types";
import { SkeletonLines, StateMessage } from "./StateMessage";

export function CreateTableView({ state }: { state: PreviewState }) {
  // Đổi trạng thái xem thử thì dựng lại form từ đầu, để "Trống" thật sự chưa có cột gợi ý.
  return <CreateTableForm key={state} state={state} />;
}

function CreateTableForm({ state }: { state: PreviewState }) {
  const router = useRouter();
  const { tables, createTable } = useStore();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState<TableColumn[]>(() => (state === "trong" ? [titleColumn()] : suggestedColumns()));
  const [columnErrors, setColumnErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  if (state === "dang-tai") {
    return (
      <main id="noi-dung" className="page page--narrow">
        <h1 className="page-title">Tạo bảng mới</h1>
        <StateMessage tone="loading" title="Đang chuẩn bị bộ cột gợi ý…">
          <SkeletonLines count={5} />
        </StateMessage>
      </main>
    );
  }

  if (state === "loi") {
    return (
      <main id="noi-dung" className="page page--narrow">
        <h1 className="page-title">Tạo bảng mới</h1>
        <StateMessage
          tone="error"
          title="Chưa tạo được bảng"
          action={
            <Link className="button button--secondary" href="/tao-bang">
              Thử lại
            </Link>
          }
        >
          <p>Hãy kiểm tra kết nối mạng rồi thử lại.</p>
        </StateMessage>
      </main>
    );
  }

  function changeColumn(id: string, change: Partial<Pick<TableColumn, "name" | "description">>) {
    setColumns((current) => current.map((column) => (column.id === id ? { ...column, ...change } : column)));
    setColumnErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setFormError(null);
  }

  function addBlankColumn() {
    const column = newContentColumn("", "");
    setColumns((current) => [...current, column]);
    setFocusId(column.id);
    setFormError(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const tableError = checkTableName(name, tables.map((table) => table.name));
    const errors: Record<string, string> = {};
    columns.forEach((column) => {
      const error = checkColumnName(column.name, columns, column.id);
      if (error) errors[column.id] = error;
    });
    const missingContent = !hasContentColumn(columns);
    setNameError(tableError);
    setColumnErrors(errors);
    setFormError(missingContent ? "Bảng cần ít nhất một cột nội dung để AI có việc điền." : null);
    const firstBadColumn = columns.find((column) => errors[column.id]);
    if (tableError || firstBadColumn || missingContent) {
      if (tableError) document.getElementById("ten-bang")?.focus();
      else if (firstBadColumn) document.getElementById(`ten-${firstBadColumn.id}`)?.focus();
      return;
    }
    createTable(
      name.trim(),
      description.trim(),
      columns.map((column) => ({ ...column, name: column.name.trim(), description: column.description.trim() })),
    );
    router.push("/them-bai");
  }

  const removedInfo = removedInfoColumns(columns);
  const missingDescriptions = columns.filter((column) => !column.description.trim()).length;

  return (
    <main id="noi-dung" className="page page--narrow">
      <h1 className="page-title">Tạo bảng mới</h1>

      <form onSubmit={submit} noValidate>
        <div className="setup-field">
          <label htmlFor="ten-bang">Tên bảng</label>
          <input
            id="ten-bang"
            name="ten-bang"
            type="text"
            autoComplete="off"
            placeholder="Ví dụ: Tổng quan tài liệu khóa luận…"
            value={name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "loi-ten-bang" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(null);
            }}
          />
          {nameError ? (
            <p id="loi-ten-bang" className="field-error" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="setup-field setup-field--next">
          <label htmlFor="mo-ta-bang">Mô tả ngắn (không bắt buộc)</label>
          <input
            id="mo-ta-bang"
            name="mo-ta-bang"
            type="text"
            autoComplete="off"
            placeholder="Ví dụ: Tổng quan cho chương 2…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <section className="setup-columns" aria-labelledby="thiet-lap-cot">
          <h2 id="thiet-lap-cot">Các cột của bảng</h2>
          <p className="setup-columns__hint">
            AI sẽ dựa vào tên và mô tả để điền từng cột, nên mô tả càng rõ càng tốt. Sau này bạn vẫn đổi được ngay trên bảng.
          </p>

          {!hasContentColumn(columns) ? (
            <div className="inline-empty">
              <p>Chưa có cột nội dung nào.</p>
              <button type="button" className="button button--secondary" onClick={() => setColumns(suggestedColumns())}>
                Dùng bộ cột gợi ý
              </button>
            </div>
          ) : null}

          <ol className="setup-list">
            {columns.map((column, index) => {
              const isTitle = column.id === TITLE_COLUMN_ID;
              const label = column.name.trim() || `cột thứ ${index + 1}`;
              const error = columnErrors[column.id];
              return (
                <li key={column.id} className="setup-row">
                  <div className="setup-row__fields">
                    <div className="setup-row__name">
                      <label htmlFor={`ten-${column.id}`}>Tên cột</label>
                      {isTitle ? <span className="setup-tag">Bắt buộc</span> : column.kind === "info" ? <span className="setup-tag">Thông tin bài</span> : null}
                    </div>
                    <input
                      id={`ten-${column.id}`}
                      name={`ten-${column.id}`}
                      type="text"
                      autoComplete="off"
                      autoFocus={focusId === column.id}
                      value={column.name}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `loi-${column.id}` : undefined}
                      onChange={(event) => changeColumn(column.id, { name: event.target.value })}
                    />
                    {error ? (
                      <p id={`loi-${column.id}`} className="field-error" role="alert">
                        {error}
                      </p>
                    ) : null}
                    <label htmlFor={`mo-ta-${column.id}`}>AI cần tìm gì cho cột này</label>
                    <input
                      id={`mo-ta-${column.id}`}
                      name={`mo-ta-${column.id}`}
                      type="text"
                      autoComplete="off"
                      placeholder="Ví dụ: cỡ mẫu, đối tượng, địa điểm, thời gian khảo sát…"
                      value={column.description}
                      onChange={(event) => changeColumn(column.id, { description: event.target.value })}
                    />
                  </div>
                  <div className="setup-row__actions">
                    <button
                      type="button"
                      className="button button--quiet setup-row__move"
                      aria-label={`Đưa ${label} lên trên`}
                      disabled={isTitle || index <= 1}
                      onClick={() => setColumns(moveColumn(columns, column.id, -1))}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="button button--quiet setup-row__move"
                      aria-label={`Đưa ${label} xuống dưới`}
                      disabled={isTitle || index === columns.length - 1}
                      onClick={() => setColumns(moveColumn(columns, column.id, 1))}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Xóa ${label}`}
                      disabled={isTitle}
                      onClick={() => setColumns(columns.filter((item) => item.id !== column.id))}
                    >
                      Xóa
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="setup-add">
            <button type="button" className="button button--secondary" onClick={addBlankColumn}>
              Thêm cột
            </button>
            {removedInfo.map((column) => (
              <button
                key={column.id}
                type="button"
                className="link-button"
                onClick={() => setColumns((current) => [...current, column])}
              >
                Thêm lại “{column.name}”
              </button>
            ))}
          </div>
        </section>

        {missingDescriptions > 0 ? (
          <p className="form-actions__hint">
            {missingDescriptions} cột chưa có mô tả. Vẫn tạo được, nhưng AI sẽ chỉ dựa vào tên cột.
          </p>
        ) : null}
        {formError ? (
          <p className="field-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="form-actions">
          <button type="submit" className="button button--primary">
            Tạo bảng và thêm bài
          </button>
        </div>
      </form>
    </main>
  );
}
