import { cellText } from "./columns";
import { markdownToPlain } from "./markdown";
import { cssColorToArgb } from "./palette";
import { effectiveFill, formatOf } from "./cell-format";
import { getLabelKey, type SheetTable } from "./types";

const STATUS_FILL = { page_corrected: "--fix-bg", needs_review: "--warn-bg", not_found: "--none-bg" } as const;

function safeFileName(name: string) {
  return `${name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "bang-tong-hop"}.xlsx`;
}

// Xuất các cột đang hiện, theo đúng thứ tự trên bảng, và mọi bài trong bảng.
export async function exportTableToExcel(table: SheetTable): Promise<void> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(table.name.replace(/[\\/?*[\]:]+/g, " ").slice(0, 31) || "Bảng");
  const columns = table.columns.filter((column) => column.visible);

  sheet.columns = columns.map((column) => ({ width: Math.max(10, Math.round((column.width ?? 240) / 8)) }));
  const header = sheet.addRow(columns.map((column) => column.name));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: cssColorToArgb("--on-sheet-head") ?? undefined } };
    const fill = cssColorToArgb("--sheet-head");
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  table.papers.forEach((paper) => {
    const row = sheet.addRow(
      columns.map((column) => {
        const text = cellText(paper, column, table.tags);
        return column.kind === "note" ? markdownToPlain(text) : text;
      }),
    );
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      const format = formatOf(paper, column.id);
      cell.alignment = { vertical: "top", wrapText: true };
      const font: Record<string, unknown> = {};
      if (format.bold) font.bold = true;
      if (format.italic) font.italic = true;
      if (format.underline) font.underline = true;
      const textColor = format.color ? cssColorToArgb(`--text-${format.color}`) : null;
      if (textColor) font.color = { argb: textColor };
      if (Object.keys(font).length > 0) cell.font = font;

      const model = column.kind === "content" ? paper.cells.find((item) => item.column === column.id) : undefined;
      const label = model ? getLabelKey(model) : null;
      const userFill = effectiveFill(paper, column.id);
      const statusVar = label && label in STATUS_FILL ? STATUS_FILL[label as keyof typeof STATUS_FILL] : null;
      const fillColor = cssColorToArgb(userFill ? `--fill-${userFill}` : (statusVar ?? "")) ;
      if (fillColor) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
      // Tô màu riêng có thể che trạng thái, nên ô cần kiểm tra luôn mang theo lời nhắc.
      if (label === "needs_review") cell.note = "Cần kiểm tra: hãy đối chiếu với bài gốc.";
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(table.name);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
