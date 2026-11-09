import type { InfoKey, Paper, SavedPaper, TableColumn, TableTag } from "./types";

export const TITLE_COLUMN_ID = "info-title";

const INFO_COLUMNS: { key: InfoKey; name: string; description: string }[] = [
  { key: "title", name: "Tên bài", description: "Tên đầy đủ của bài báo, giữ nguyên ngôn ngữ gốc" },
  { key: "authors", name: "Tác giả", description: "Họ tên các tác giả, theo thứ tự ghi trong bài" },
  { key: "year", name: "Năm", description: "Năm công bố của bài" },
  { key: "source", name: "Tạp chí hoặc nơi xuất bản", description: "Tên tạp chí, kỷ yếu hoặc nơi xuất bản, kèm số tập nếu có" },
  { key: "language", name: "Ngôn ngữ", description: "Ngôn ngữ viết bài" },
];

const SUGGESTED_CONTENT: { id: string; name: string; description: string }[] = [
  { id: "cau-hoi", name: "Câu hỏi nghiên cứu", description: "Câu hỏi hoặc mục tiêu mà bài đặt ra" },
  { id: "phuong-phap", name: "Phương pháp", description: "Thiết kế nghiên cứu, mô hình hoặc kỹ thuật phân tích chính" },
  { id: "mau", name: "Mẫu", description: "Cỡ mẫu, đối tượng, địa điểm, thời gian khảo sát" },
  { id: "ket-qua", name: "Kết quả", description: "Phát hiện chính, kèm con số quan trọng nếu có" },
  { id: "han-che", name: "Hạn chế", description: "Những hạn chế mà chính tác giả nêu trong bài" },
];

// Câu hỏi gợi ý kiểm tra, hiện khi duyệt ô. Nhắc đúng chỗ AI hay nhầm ở từng cột.
// Gắn theo mã cột nên cột gợi ý bị đổi tên vẫn giữ câu hỏi. Cột do sinh viên tự thêm dùng câu chung.
const REVIEW_QUESTIONS: Record<string, string> = {
  "cau-hoi": "Đây là câu hỏi của chính bài này, hay chỉ là ý trong phần tóm tắt hoặc phần tổng quan?",
  "phuong-phap": "Đây là phương pháp bài này dùng, hay phương pháp của nghiên cứu khác mà bài nhắc tới?",
  mau: "Con số này là mẫu thật sự được phân tích, hay là tổng thể ban đầu hoặc mẫu của nghiên cứu khác?",
  "ket-qua": "Đây là kết quả của bài này, hay của nghiên cứu khác mà bài dẫn lại?",
  "han-che": "Đây là hạn chế của chính nghiên cứu, hay của đối tượng được nghiên cứu?",
};

export const GENERIC_REVIEW_QUESTION = "Câu trích này có thật sự trả lời điều cột hỏi không?";

export function reviewQuestion(columnId: string): string {
  return REVIEW_QUESTIONS[columnId] ?? GENERIC_REVIEW_QUESTION;
}

function infoColumn({ key, name, description }: (typeof INFO_COLUMNS)[number]): TableColumn {
  return { id: `info-${key}`, name, description, kind: "info", infoKey: key, visible: true };
}

export const NOTE_COLUMN_ID = "ghi-chu";
export const TAGS_COLUMN_ID = "nhan";

function ownColumns(): TableColumn[] {
  return [
    { id: TAGS_COLUMN_ID, name: "Nhãn", description: "Nhãn bạn tự đặt cho bài. AI không điền vào cột này.", kind: "tags", visible: true },
    { id: NOTE_COLUMN_ID, name: "Ghi chú", description: "Ghi chú riêng của bạn, viết bằng Markdown. AI không điền vào cột này.", kind: "note", visible: true },
  ];
}

export function suggestedColumns(): TableColumn[] {
  return [
    ...INFO_COLUMNS.map(infoColumn),
    ...SUGGESTED_CONTENT.map((column): TableColumn => ({ ...column, kind: "content", visible: true })),
    ...ownColumns(),
  ];
}

// Cột do sinh viên tự viết: không có mô tả cho AI, không bao giờ "chưa điền".
export function isOwnColumn(column: TableColumn): boolean {
  return column.kind === "note" || column.kind === "tags";
}

export function titleColumn(): TableColumn {
  return infoColumn(INFO_COLUMNS[0]);
}

// Cột thông tin bài, Ghi chú và Nhãn đã bị xoá thì có thể thêm lại. Cột mới luôn để trống, dữ liệu cũ đã mất.
export function removedInfoColumns(columns: TableColumn[]): TableColumn[] {
  return [...INFO_COLUMNS.map(infoColumn), ...ownColumns()].filter((item) => !columns.some((column) => column.id === item.id));
}

export function newContentColumn(name: string, description: string): TableColumn {
  return { id: `cot-${crypto.randomUUID()}`, name, description, kind: "content", visible: true };
}

function sameName(a: string, b: string) {
  return a.trim().toLocaleLowerCase("vi") === b.trim().toLocaleLowerCase("vi");
}

// Trả về câu báo lỗi, hoặc null nếu tên dùng được.
export function checkColumnName(name: string, columns: TableColumn[], exceptId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Hãy nhập tên cột.";
  if (columns.some((column) => column.id !== exceptId && sameName(column.name, trimmed))) {
    return `Đã có cột “${trimmed}” rồi.`;
  }
  return null;
}

export function checkTableName(name: string, tableNames: string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Hãy đặt tên cho bảng.";
  if (tableNames.some((other) => sameName(other, trimmed))) return `Đã có bảng “${trimmed}” rồi.`;
  return null;
}

// Đưa cột về vị trí mới. Tên bài luôn đứng đầu nên không cột nào được chen lên trước nó.
export function moveColumn(columns: TableColumn[], id: string, offset: number): TableColumn[] {
  const from = columns.findIndex((column) => column.id === id);
  const to = from + offset;
  if (from < 0 || id === TITLE_COLUMN_ID || to < 1 || to >= columns.length) return columns;
  const next = [...columns];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function reorderColumns(columns: TableColumn[], ids: string[]): TableColumn[] {
  const position = (column: TableColumn) => {
    const index = ids.indexOf(column.id);
    return index === -1 ? ids.length : index;
  };
  return [...columns].sort((a, b) => position(a) - position(b));
}

export function hasContentColumn(columns: TableColumn[]): boolean {
  return columns.some((column) => column.kind === "content");
}

export function infoValue(paper: Paper, column: TableColumn): string | undefined {
  return column.infoKey ? paper.info[column.infoKey] : undefined;
}

export function isInfoEdited(paper: Paper, column: TableColumn): boolean {
  if (!column.infoKey) return false;
  const suggested = paper.suggested_info[column.infoKey];
  return suggested !== undefined && paper.info[column.infoKey] !== suggested;
}

// Chữ của một ô theo cột. Chuỗi rỗng nghĩa là "chưa điền".
export function cellText(paper: SavedPaper, column: TableColumn, tags: TableTag[] = []): string {
  if (column.kind === "note") return paper.note ?? "";
  if (column.kind === "tags") {
    return (paper.tags ?? []).map((id) => tags.find((tag) => tag.id === id)?.name).filter(Boolean).join(", ");
  }
  if (column.kind === "info") return infoValue(paper, column) ?? "";
  return paper.cells.find((cell) => cell.column === column.id)?.value_vi ?? "";
}

// Đếm ô sẽ mất khi xoá cột. Ô "không tìm thấy" có tính, ô "chưa điền" không tính.
export function countColumnData(papers: SavedPaper[], column: TableColumn): { filled: number; edited: number } {
  let filled = 0;
  let edited = 0;
  papers.forEach((paper) => {
    const hasData = column.kind === "tags" ? (paper.tags?.length ?? 0) > 0 : Boolean(cellText(paper, column));
    if (!hasData) return;
    filled += 1;
    if (isOwnColumn(column)) {
      edited += 1;
      return;
    }
    const cell = paper.cells.find((item) => item.column === column.id);
    if (column.kind === "info" ? isInfoEdited(paper, column) : cell && (cell.status === "manual" || cell.value_vi !== cell.suggested_value)) {
      edited += 1;
    }
  });
  return { filled, edited };
}

export function countUnfilled(papers: SavedPaper[], column: TableColumn): number {
  if (isOwnColumn(column)) return 0;
  return papers.length - countColumnData(papers, column).filled;
}
