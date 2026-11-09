// Chỉ để dựng và thử giao diện trên máy khi Gemini quá tải: dùng lại câu trả lời đã lưu trong
// samples/ket-qua-gemini.json thay vì gọi Gemini. Bật bằng AI_DUNG_KET_QUA_MAU=1, và chỉ chạy khi `npm run dev`:
// bản build (production) không bao giờ đọc file này.
// Câu trả lời đã lưu vẫn đi qua bước kiểm tra câu trích trên chữ thật của PDF như câu trả lời mới.
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { ExtractResult } from "./ai-extract";

type SavedRun = { file: string; model: string; muc_suy_nghi?: string; so_giay?: number; ket_qua: Partial<ExtractResult> };

export function sampleAnswersEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.AI_DUNG_KET_QUA_MAU?.trim() === "1";
}

// Chọn lần chạy gần nhất của đúng file đó bằng model chính, mức suy nghĩ "low" (mức đang dùng).
export async function sampleAnswer(fileName: string, contentColumnIds: string[]): Promise<ExtractResult> {
  const notFound: ExtractResult = {
    ok: false,
    error: {
      code: "failed",
      title: "Chưa có câu trả lời mẫu cho bài này",
      detail: "Chế độ dùng câu trả lời đã lưu chỉ có 3 bài trong thư mục samples. Hãy tắt AI_DUNG_KET_QUA_MAU để gọi AI thật.",
      retry: false,
    },
    attempts: 0,
    usedFallback: false,
  };
  let runs: SavedRun[];
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "samples", "ket-qua-gemini.json"), "utf8");
    runs = JSON.parse(raw).lan_chay ?? [];
  } catch {
    return notFound;
  }
  const same = (a: string, b: string) => a.normalize("NFC") === b.normalize("NFC");
  const matches = runs.filter((run) => same(run.file, fileName) && run.ket_qua?.ok);
  const run = matches.filter((item) => (item.muc_suy_nghi ?? "low") === "low" && !item.model.includes("lite")).at(-1) ?? matches.at(-1);
  if (!run || !run.ket_qua.ok || !("answer" in run.ket_qua) || !run.ket_qua.answer) return notFound;

  // Chờ một chút để thấy được màn hình chờ.
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const answer = run.ket_qua.answer;
  console.info("[ai] dùng câu trả lời đã lưu cho", fileName, "(model", run.model + ")");
  return {
    ok: true,
    answer: {
      info: answer.info,
      // Chỉ giữ các cột có trong bảng đang dùng. Bỏ kết quả kiểm tra cũ: trang web kiểm tra lại từ đầu.
      cells: answer.cells
        .filter((cell) => contentColumnIds.includes(cell.column))
        .map((cell) => ({ ...cell, check: null, ai_page: cell.status === "proposed" ? (cell.ai_page ?? cell.page) : null })),
    },
    attempts: 0,
    model: run.ket_qua.model ?? run.model,
    usedFallback: run.ket_qua.usedFallback ?? false,
    removedReferences: run.ket_qua.removedReferences ?? null,
  };
}
