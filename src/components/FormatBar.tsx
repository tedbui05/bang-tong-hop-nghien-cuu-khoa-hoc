"use client";

import { useState } from "react";
import { formatOf } from "@/lib/cell-format";
import { FILL_COLORS, TEXT_COLORS, type FillKey, type TextColorKey } from "@/lib/palette";
import { useStore, type CellTarget } from "@/lib/store";
import type { CellFormat, SavedPaper } from "@/lib/types";

type Toggle = "bold" | "italic" | "underline";

// Dùng chung cho thanh định dạng và phím tắt Cmd/Ctrl + B, I, U.
export function useCellFormatting(targets: CellTarget[], papers: SavedPaper[]) {
  const { formatCells, fillRows } = useStore();
  const formats = targets.map((target) => {
    const paper = papers.find((item) => item.id === target.paperId);
    return paper ? formatOf(paper, target.columnId) : {};
  });
  const isOn = (key: Toggle) => formats.length > 0 && formats.every((format) => format[key]);

  // Đã bật ở mọi ô đang chọn thì tắt, còn lại thì bật cho tất cả.
  function toggle(key: Toggle) {
    const next = !isOn(key);
    formatCells(targets, () => ({ [key]: next }) as Partial<CellFormat>);
  }

  function setColor(color: TextColorKey | undefined) {
    formatCells(targets, () => ({ color }));
  }

  function setFill(fill: FillKey | null, wholeRow: boolean) {
    const paperIds = [...new Set(targets.map((target) => target.paperId))];
    if (wholeRow) {
      fillRows(paperIds, fill);
      return;
    }
    if (fill) {
      formatCells(targets, () => ({ fill }));
      return;
    }
    // Bỏ màu: ô trong hàng đã tô cả hàng thì ghi rõ "không màu", ô khác thì xoá hẳn.
    const inFilledRow = (target: CellTarget) => Boolean(papers.find((paper) => paper.id === target.paperId)?.rowFill);
    formatCells(targets.filter(inFilledRow), () => ({ fill: null }));
    formatCells(targets.filter((target) => !inFilledRow(target)), () => ({ fill: undefined }));
  }

  return { isOn, toggle, setColor, setFill, current: formats[0] ?? {} };
}

const SHORTCUT = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

export function FormatBar({ targets, papers }: { targets: CellTarget[]; papers: SavedPaper[] }) {
  const { isOn, toggle, setColor, setFill, current } = useCellFormatting(targets, papers);
  const [open, setOpen] = useState<"color" | "fill" | null>(null);
  const [wholeRow, setWholeRow] = useState(false);

  const toggleButton = (key: Toggle, label: string, letter: string, className: string) => (
    <button
      type="button"
      className={`format-bar__button ${className}`}
      aria-pressed={isOn(key)}
      aria-label={`${label} (${SHORTCUT} + ${letter})`}
      title={`${label} (${SHORTCUT} + ${letter})`}
      onClick={() => toggle(key)}
    >
      {letter}
    </button>
  );

  return (
    <div
      className="format-bar"
      role="toolbar"
      aria-label={targets.length > 1 ? `Định dạng ${targets.length} ô đang chọn` : "Định dạng ô"}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(null);
        }
      }}
    >
      <p className="format-bar__label">{targets.length > 1 ? `Định dạng ${targets.length} ô` : "Định dạng ô"}</p>
      <div className="format-bar__row">
        {toggleButton("bold", "In đậm", "B", "format-bar__button--bold")}
        {toggleButton("italic", "In nghiêng", "I", "format-bar__button--italic")}
        {toggleButton("underline", "Gạch chân", "U", "format-bar__button--underline")}
        <button
          type="button"
          className="format-bar__button format-bar__button--wide"
          aria-expanded={open === "color"}
          onClick={() => setOpen(open === "color" ? null : "color")}
        >
          <span className={`format-bar__color-mark ${current.color ? `swatch--text-${current.color}` : ""}`}>A</span> Màu chữ
        </button>
        <button
          type="button"
          className="format-bar__button format-bar__button--wide"
          aria-expanded={open === "fill"}
          onClick={() => setOpen(open === "fill" ? null : "fill")}
        >
          <span className={`format-bar__fill-mark ${current.fill ? `swatch--fill-${current.fill}` : ""}`} aria-hidden="true" /> Tô nền
        </button>
      </div>

      {open === "color" ? (
        <div className="format-bar__palette" role="group" aria-label="Chọn màu chữ">
          {TEXT_COLORS.map((color) => (
            <button
              key={color.key}
              type="button"
              className={`format-bar__swatch swatch--text-${color.key}`}
              aria-label={`Chữ màu ${color.name}`}
              aria-pressed={current.color === color.key}
              title={color.name}
              onClick={() => {
                setColor(color.key);
                setOpen(null);
              }}
            >
              A
            </button>
          ))}
          <button
            type="button"
            className="link-button format-bar__clear"
            onClick={() => {
              setColor(undefined);
              setOpen(null);
            }}
          >
            Màu mặc định
          </button>
        </div>
      ) : null}

      {open === "fill" ? (
        <div className="format-bar__palette" role="group" aria-label="Chọn màu nền">
          {FILL_COLORS.map((color) => (
            <button
              key={color.key}
              type="button"
              className={`format-bar__swatch swatch--fill-${color.key}`}
              aria-label={`Tô nền ${color.name}`}
              aria-pressed={current.fill === color.key}
              title={color.name}
              onClick={() => {
                setFill(color.key, wholeRow);
                // Tô cả hàng chỉ áp dụng cho lần này, tránh lần sau lỡ tay tô hoặc xoá cả hàng.
                setWholeRow(false);
                setOpen(null);
              }}
            />
          ))}
          <button
            type="button"
            className="link-button format-bar__clear"
            onClick={() => {
              setFill(null, wholeRow);
              setWholeRow(false);
              setOpen(null);
            }}
          >
            Xoá màu
          </button>
          <label className="format-bar__row-option">
            <input type="checkbox" checked={wholeRow} onChange={(event) => setWholeRow(event.target.checked)} />
            Áp dụng cho cả hàng
          </label>
        </div>
      ) : null}
    </div>
  );
}
