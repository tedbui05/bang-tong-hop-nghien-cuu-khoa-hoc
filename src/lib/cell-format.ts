import type { FillKey } from "./palette";
import type { CellFormat, Highlight, SavedPaper } from "./types";

export function formatOf(paper: SavedPaper, columnId: string): CellFormat {
  return paper.formats?.[columnId] ?? {};
}

// Màu của ô thắng màu cả hàng; fill = null nghĩa là ô này đã bỏ màu dù cả hàng có tô.
export function effectiveFill(paper: SavedPaper, columnId: string): FillKey | null {
  const fill = formatOf(paper, columnId).fill;
  if (fill === null) return null;
  return fill ?? paper.rowFill ?? null;
}

function cleanFormat(format: CellFormat): CellFormat | null {
  const next = { ...format };
  (Object.keys(next) as (keyof CellFormat)[]).forEach((key) => {
    if (next[key] === undefined || next[key] === false) delete next[key];
  });
  return Object.keys(next).length > 0 ? next : null;
}

export function withFormat(paper: SavedPaper, columnId: string, change: Partial<CellFormat>): SavedPaper {
  const merged = cleanFormat({ ...formatOf(paper, columnId), ...change });
  const formats = { ...paper.formats };
  if (merged) formats[columnId] = merged;
  else delete formats[columnId];
  return { ...paper, formats };
}

// Tô cả hàng: bỏ màu riêng của từng ô để cả hàng đồng đều.
export function withRowFill(paper: SavedPaper, fill: FillKey | null): SavedPaper {
  const formats: Record<string, CellFormat> = {};
  Object.entries(paper.formats ?? {}).forEach(([columnId, format]) => {
    const rest = { ...format };
    delete rest.fill;
    if (Object.keys(rest).length > 0) formats[columnId] = rest;
  });
  return { ...paper, formats, rowFill: fill ?? undefined };
}

// Gộp các đoạn chồng nhau để không tô hai lớp.
export function addHighlightRange(list: Highlight[], next: Highlight): Highlight[] {
  const same = list.filter((item) => item.field === next.field);
  const others = list.filter((item) => item.field !== next.field);
  const merged = [...same, next]
    .sort((a, b) => a.start - b.start)
    .reduce<Highlight[]>((result, item) => {
      const last = result[result.length - 1];
      if (last && item.start <= last.end) last.end = Math.max(last.end, item.end);
      else result.push({ ...item });
      return result;
    }, []);
  return [...others, ...merged];
}

export type TextPiece = { text: string; start: number; marked: boolean };

export function splitHighlights(text: string, ranges: Highlight[]): TextPiece[] {
  const pieces: TextPiece[] = [];
  let position = 0;
  [...ranges]
    .filter((range) => range.end > range.start && range.start < text.length)
    .sort((a, b) => a.start - b.start)
    .forEach((range) => {
      const end = Math.min(range.end, text.length);
      if (range.start > position) pieces.push({ text: text.slice(position, range.start), start: position, marked: false });
      pieces.push({ text: text.slice(range.start, end), start: range.start, marked: true });
      position = end;
    });
  if (position < text.length) pieces.push({ text: text.slice(position), start: position, marked: false });
  return pieces;
}
