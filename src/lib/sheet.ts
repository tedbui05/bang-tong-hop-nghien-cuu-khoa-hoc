import { getLabelKey, type LabelKey, type ReviewCell, type SavedPaper } from "./types";

export type StatusFilter = "all" | LabelKey;

export const STATUS_LABELS: Record<LabelKey, string> = {
  verified: "đã khớp",
  page_corrected: "đã sửa số trang",
  needs_review: "cần kiểm tra",
  not_found: "không tìm thấy",
  manual: "do bạn điền",
};

export function countLabels(papers: SavedPaper[]): Record<LabelKey, number> {
  const counts: Record<LabelKey, number> = { verified: 0, page_corrected: 0, needs_review: 0, not_found: 0, manual: 0 };
  papers.forEach((paper) => paper.cells.forEach((cell) => (counts[getLabelKey(cell)] += 1)));
  return counts;
}

// Bỏ dấu và chữ hoa để tìm "hieu suat" vẫn ra "hiệu suất". Mỗi ký tự sau khi gấp nhớ vị trí gốc.
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  Array.from(text).reduce((position, char) => {
    const part = char
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase();
    for (let i = 0; i < part.length; i += 1) {
      folded += part[i];
      map.push(position);
    }
    return position + char.length;
  }, 0);
  return { folded, map };
}

export function foldText(text: string): string {
  return foldWithMap(text).folded.replace(/\s+/g, " ").trim();
}

export type TextPart = { text: string; match: boolean };

// Tách chữ thành các đoạn có và không khớp từ khóa, để đánh dấu nhẹ phần khớp.
export function splitMatches(text: string, query: string): TextPart[] {
  const needle = foldText(query);
  if (!needle) return [{ text, match: false }];
  const { folded, map } = foldWithMap(text);
  const parts: TextPart[] = [];
  let from = 0;
  let index = folded.indexOf(needle);
  while (index !== -1) {
    const start = map[index];
    const lastFolded = index + needle.length - 1;
    const lastSource = map[lastFolded];
    const end = lastSource + Array.from(text.slice(lastSource))[0].length;
    if (start > from) parts.push({ text: text.slice(from, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    from = end;
    index = folded.indexOf(needle, index + needle.length);
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}

export function paperMatches(paper: SavedPaper, needle: string): boolean {
  if (!needle) return true;
  const fields = [...Object.values(paper.info), ...paper.cells.map((cell) => cell.value_vi)];
  return fields.some((field) => foldText(field).includes(needle));
}

export function cellMatchesFilter(cell: ReviewCell | undefined, filter: StatusFilter): boolean {
  return filter === "all" || (cell !== undefined && getLabelKey(cell) === filter);
}
