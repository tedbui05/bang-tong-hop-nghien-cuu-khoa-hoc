"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import { splitHighlights } from "@/lib/cell-format";
import type { Highlight } from "@/lib/types";

type Props = {
  as?: ElementType;
  field: Highlight["field"];
  text: string;
  ranges: Highlight[];
  className?: string;
  lang?: string;
  onRemove: (range: Highlight) => void;
};

// Hiện chữ kèm các đoạn tô sáng. Chữ gốc giữ nguyên, chỉ bọc thêm phần đánh dấu.
export function HighlightText({ as: Tag = "p", field, text, ranges, className, lang, onRemove }: Props) {
  const own = ranges.filter((range) => range.field === field);
  return (
    <Tag className={className} lang={lang} translate="no" data-hl-field={field}>
      {splitHighlights(text, own).map((piece) =>
        piece.marked ? (
          <mark
            key={piece.start}
            className="text-highlight"
            title="Bấm để bỏ tô sáng"
            onClick={() => {
              if (window.getSelection()?.isCollapsed !== false) {
                const range = own.find((item) => item.start === piece.start);
                if (range) onRemove(range);
              }
            }}
          >
            {piece.text}
          </mark>
        ) : (
          <span key={piece.start}>{piece.text}</span>
        ),
      )}
    </Tag>
  );
}

// Theo dõi đoạn đang bôi đen trong khung, tính vị trí theo chữ gốc.
export function useTextSelection(root: React.RefObject<HTMLElement | null>) {
  const [selected, setSelected] = useState<Highlight | null>(null);
  const last = useRef<Highlight | null>(null);

  useEffect(() => {
    function update() {
      const selection = window.getSelection();
      const box = root.current;
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !box) {
        last.current = null;
        setSelected(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const container = (range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement
      )?.closest<HTMLElement>("[data-hl-field]");
      if (!container || !box.contains(container)) {
        last.current = null;
        setSelected(null);
        return;
      }
      const before = document.createRange();
      before.selectNodeContents(container);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length;
      const end = start + range.toString().length;
      if (end <= start) return;
      const next = { field: container.dataset.hlField as Highlight["field"], start, end };
      last.current = next;
      setSelected(next);
    }
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [root]);

  return selected;
}
