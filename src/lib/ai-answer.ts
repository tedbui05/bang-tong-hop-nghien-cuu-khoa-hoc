// Đọc câu trả lời của AI và kiểm tra đúng khuôn. Gemini đã được yêu cầu trả đúng khuôn,
// nhưng vẫn kiểm tra lại: câu trả lời sai khuôn thì báo lý do để gửi lại một lần.
// Đây chưa phải bước kiểm tra câu trích có thật trong bài: check luôn để null.
import { NOT_FOUND_TEXT, type AiRequest } from "./ai-prompt";
import type { AiCell, PaperInfo } from "./types";

export type AiAnswer = { cells: AiCell[]; info: Partial<PaperInfo> };

// problem: lý do sai khuôn, viết ngắn để gửi lại cho AI. Không chứa dữ liệu bí mật.
export type ParseResult = { ok: true; answer: AiAnswer } | { ok: false; problem: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseAiAnswer(raw: string, request: AiRequest): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, problem: "câu trả lời không phải JSON hợp lệ" };
  }
  if (!isRecord(data)) return { ok: false, problem: "câu trả lời phải là một object JSON" };
  if (!isRecord(data.info)) return { ok: false, problem: "thiếu phần info" };
  if (!Array.isArray(data.cells)) return { ok: false, problem: "thiếu danh sách cells" };

  const info: Partial<PaperInfo> = {};
  for (const key of request.infoKeys) {
    const value = data.info[key];
    if (value !== null && value !== undefined && typeof value !== "string") {
      return { ok: false, problem: `info.${key} phải là chữ hoặc null` };
    }
    const cleaned = text(value);
    if (cleaned) info[key] = cleaned;
  }

  const wanted = new Set(request.contentColumns.map((column) => column.id));
  const seen = new Map<string, AiCell>();
  for (const item of data.cells) {
    if (!isRecord(item)) return { ok: false, problem: "mỗi phần tử của cells phải là object" };
    const column = typeof item.column === "string" ? item.column : "";
    if (!wanted.has(column)) return { ok: false, problem: `có cột lạ "${column.slice(0, 60)}"` };
    if (seen.has(column)) return { ok: false, problem: `cột "${column}" bị trả về hai lần` };

    if (item.status === "not_found") {
      if (text(item.quote_original) || (item.page !== null && item.page !== undefined)) {
        return { ok: false, problem: `cột "${column}" là not_found nhưng lại có câu trích hoặc số trang` };
      }
      seen.set(column, {
        column,
        value_vi: NOT_FOUND_TEXT,
        quote_original: null,
        quote_vi: null,
        page: null,
        status: "not_found",
        check: null,
        ai_page: null,
      });
      continue;
    }

    if (item.status !== "proposed") return { ok: false, problem: `cột "${column}" có status không hợp lệ` };
    const value_vi = text(item.value_vi);
    const quote_original = text(item.quote_original);
    const quote_vi = text(item.quote_vi);
    if (!value_vi) return { ok: false, problem: `cột "${column}" thiếu value_vi` };
    if (!quote_original) return { ok: false, problem: `cột "${column}" thiếu quote_original` };
    if (!quote_vi) return { ok: false, problem: `cột "${column}" thiếu quote_vi` };
    if (typeof item.page !== "number" || !Number.isInteger(item.page) || item.page < 1) {
      return { ok: false, problem: `cột "${column}" thiếu số trang hoặc số trang không phải số nguyên dương` };
    }
    // Số trang không có trong bài chưa tính là sai khuôn: bước kiểm tra câu trích sẽ tự tìm trang đúng.
    seen.set(column, {
      column,
      value_vi,
      // Giữ nguyên câu trích như AI chép, chỉ bỏ khoảng trắng ở hai đầu.
      quote_original,
      quote_vi,
      page: item.page,
      status: "proposed",
      check: null,
      ai_page: item.page,
    });
  }

  const missing = request.contentColumns.filter((column) => !seen.has(column.id)).map((column) => `"${column.id}"`);
  if (missing.length) return { ok: false, problem: `thiếu cột ${missing.join(", ")}` };

  // Trả về theo đúng thứ tự cột của bảng.
  return { ok: true, answer: { cells: request.contentColumns.map((column) => seen.get(column.id)!), info } };
}
