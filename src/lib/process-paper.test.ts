// Test luồng xử lý một bài: đọc PDF giả, máy chủ giả trả câu trả lời giả. Không gọi AI thật.
import { describe, expect, it, vi } from "vitest";
import { suggestedColumns } from "./columns";
import { canQuickApprove, pruneToColumns } from "./paper-pipeline";
import type { PdfPage } from "./pdf-read";
import { processPaper, type ProcessDeps } from "./process-paper";
import { getLabelKey } from "./types";

const pages: PdfPage[] = [
  { page: 1, text: "Green credit and innovation\nAbstract. We study firms." },
  { page: 2, text: "Methods. We use a difference-in-differences model on 442 firms from 2010 to 2020.\nResults. Green credit raised patents by 13% according to Smith et al. (2019)." },
];

const columns = suggestedColumns();

function answer() {
  return {
    ok: true,
    model: "model-chinh",
    usedFallback: false,
    attempts: 1,
    removedReferences: null,
    answer: {
      info: { title: "Green credit and innovation", authors: "Lin", year: "2023", language: "Tiếng Anh" },
      cells: [
        { column: "cau-hoi", value_vi: "Tín dụng xanh", quote_original: "Green credit and innovation", quote_vi: "x", page: 1, status: "proposed", check: null, ai_page: 1 },
        { column: "phuong-phap", value_vi: "DID", quote_original: "We use a difference-in-differences model on 442 firms", quote_vi: "x", page: 1, status: "proposed", check: null, ai_page: 1 },
        { column: "mau", value_vi: "442 doanh nghiệp", quote_original: "a survey of 500 households in Hanoi", quote_vi: "x", page: 2, status: "proposed", check: null, ai_page: 2 },
        { column: "ket-qua", value_vi: "Tăng 13%", quote_original: "Green credit raised patents by 13% according to Smith et al. (2019)", quote_vi: "x", page: 2, status: "proposed", check: null, ai_page: 2 },
        { column: "han-che", value_vi: "không tìm thấy", quote_original: null, quote_vi: null, page: null, status: "not_found", check: null, ai_page: null },
      ],
    },
  };
}

function deps(apiResult: unknown | Error, read: ProcessDeps["readPdf"] = async () => ({ ok: true, pages })): ProcessDeps & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    readPdf: read,
    callApi: async (body) => {
      calls.push(body);
      if (apiResult instanceof Error) throw apiResult;
      return apiResult;
    },
    hash: async () => "abc",
    savePdf: async () => true,
    savePages: async () => true,
  };
}

const file = new File([new Uint8Array([37, 80, 68, 70])], "lin-2023.pdf", { type: "application/pdf" });
const input = (onStage = vi.fn()) => ({ id: "bai-1", tableId: "bang-1", columns, file, onStage });

describe("xử lý một bài trong hàng chờ", () => {
  it("đọc, gọi AI một lần, kiểm tra câu trích bằng code: nhãn là kết quả kiểm tra thật", async () => {
    const onStage = vi.fn();
    const d = deps(answer());
    const result = await processPaper(input(onStage), d);
    if (!result.ok) throw new Error(result.error.title);
    expect(d.calls).toHaveLength(1);
    expect(onStage.mock.calls.map((call) => call[0])).toEqual(["reading", "ai", "checking"]);

    const labels = Object.fromEntries(result.session.cells.map((cell) => [cell.column, getLabelKey(cell)]));
    expect(labels).toEqual({
      "cau-hoi": "verified",
      "phuong-phap": "page_corrected",
      mau: "needs_review", // câu bịa
      "ket-qua": "verified",
      "han-che": "not_found",
    });

    // Cảnh báo dẫn nguồn khác, vị trí để tô vàng, model đã điền, thông tin bài.
    const ketQua = result.session.cells.find((cell) => cell.column === "ket-qua")!;
    expect(ketQua.cites_other_source).toBe(true);
    expect(ketQua.quote_ranges?.[0].page).toBe(2);
    const phuongPhap = result.session.cells.find((cell) => cell.column === "phuong-phap")!;
    expect(phuongPhap.page).toBe(2);
    expect(phuongPhap.ai_page).toBe(1);
    expect(result.session.cells.every((cell) => cell.review === "pending" && cell.suggested_value === cell.value_vi)).toBe(true);
    expect(result.session.paper.filled_by).toEqual({ model: "model-chinh", fallback: false });
    expect(result.session.paper.info).toEqual({ title: "Green credit and innovation", authors: "Lin", year: "2023", language: "Tiếng Anh" });
    expect(result.session.paper.language_code).toBe("en");
    expect(result.session.paper.file).toEqual({ name: "lin-2023.pdf", size: 4, hash: "abc" });
    expect(result.pdfSaved).toBe(true);
  });

  it("gửi cho máy chủ đúng các cột và chữ của bài, không gửi cột Ghi chú, Nhãn có nội dung lạ", async () => {
    const d = deps(answer());
    await processPaper(input(), d);
    const body = d.calls[0] as { columns: { id: string }[]; pages: PdfPage[]; fileName: string };
    expect(body.pages).toEqual(pages);
    expect(body.fileName).toBe("lin-2023.pdf");
    expect(body.columns.map((column) => column.id)).toEqual(columns.map((column) => column.id));
  });

  it("bài do model dự phòng điền: ghi lại filled_by", async () => {
    const result = await processPaper(input(), deps({ ...answer(), model: "model-du-phong", usedFallback: true }));
    expect(result.ok && result.session.paper.filled_by).toEqual({ model: "model-du-phong", fallback: true });
  });

  it("AI không tìm được tên bài: tạm lấy tên file", async () => {
    const data = answer();
    data.answer.info = { title: "", authors: "Lin", year: "2023", language: "Tiếng Anh" };
    const result = await processPaper(input(), deps(data));
    expect(result.ok && result.session.paper.info.title).toBe("lin-2023");
  });

  it("file PDF lỗi: báo lỗi của file, không gọi AI", async () => {
    const d = deps(answer(), async () => ({ ok: false, error: { code: "scanned", title: "App chưa đọc được file scan", detail: "Hãy tìm bản PDF gốc." } }));
    const result = await processPaper(input(), d);
    expect(result).toEqual({ ok: false, error: { title: "App chưa đọc được file scan", detail: "Hãy tìm bản PDF gốc.", retry: false }, stored: null });
    expect(d.calls).toHaveLength(0);
  });

  it("máy chủ báo lỗi AI: giữ nguyên câu tiếng Việt và nút Thử lại", async () => {
    const error = { code: "overloaded", title: "Hệ thống đang quá tải, vui lòng thử lại sau ít phút", detail: "Bài của bạn chưa bị mất.", retry: true };
    const result = await processPaper(input(), deps({ ok: false, error, attempts: 2, usedFallback: true }));
    // File đã được giữ trước khi gọi AI: bài nằm lại trong hàng chờ để thử lại.
    expect(result).toEqual({ ok: false, error: { title: error.title, detail: error.detail, retry: true }, stored: { name: "lin-2023.pdf", size: 4, hash: "abc" } });
  });

  it("mất mạng hoặc máy chủ trả lời lạ: báo lỗi tiếng Việt kèm Thử lại", async () => {
    const offline = await processPaper(input(), deps(new Error("Failed to fetch")));
    expect(!offline.ok && offline.error.title).toBe("Không kết nối được máy chủ");
    const weird = await processPaper(input(), deps({ hello: 1 }));
    expect(!weird.ok && weird.error.retry).toBe(true);
  });

  it("trình duyệt không giữ được file: vẫn điền bài, chỉ ghi là chưa giữ được PDF", async () => {
    const d = { ...deps(answer()), savePdf: async () => false };
    const result = await processPaper(input(), d);
    expect(result.ok && result.pdfSaved).toBe(false);
  });
});

describe("hết lượt AI: bài vẫn nằm trong hàng chờ", () => {
  it("bị chặn vì hết lượt: giữ file, có Thử lại; thử lại sau khi tải lại trang dùng chữ đã giữ, không đọc lại file", async () => {
    const limit = { ok: false, error: { code: "limit_user", title: "Bạn đã dùng hết lượt AI hôm nay", detail: "Bài vẫn nằm trong hàng chờ.", retry: true }, attempts: 0, usedFallback: false };
    const blocked = await processPaper(input(), deps(limit));
    if (blocked.ok) throw new Error("Mong đợi bị chặn");
    expect(blocked.error.retry).toBe(true);
    expect(blocked.stored).toEqual({ name: "lin-2023.pdf", size: 4, hash: "abc" });

    const readPdf = vi.fn();
    const d = deps(answer(), readPdf);
    const retried = await processPaper({ id: "bai-1", tableId: "bang-1", columns, onStage: vi.fn(), pages, fileMeta: blocked.stored! }, d);
    expect(readPdf).not.toHaveBeenCalled();
    expect(retried.ok && retried.session.paper.file).toEqual(blocked.stored);
    expect(retried.ok && retried.session.fileName).toBe("lin-2023.pdf");
    expect((d.calls[0] as { pages: PdfPage[] }).pages).toEqual(pages);
  });
});

describe("duyệt nhanh cả dòng", () => {
  it("chỉ có khi mọi ô đều đã khớp, không cảnh báo, còn ô chưa duyệt", async () => {
    const result = await processPaper(input(), deps(answer()));
    if (!result.ok) throw new Error();
    const cells = result.session.cells;
    expect(canQuickApprove(cells)).toBe(false);
    const allVerified = cells.map((cell) => ({ ...cell, check: "verified" as const, status: "proposed" as const, cites_other_source: false }));
    expect(canQuickApprove(allVerified)).toBe(true);
    // Một ô "không tìm thấy" là phải duyệt từng ô.
    expect(canQuickApprove([...allVerified.slice(1), cells.find((cell) => cell.column === "han-che")!])).toBe(false);
    // Một ô có cảnh báo dẫn nguồn khác cũng vậy.
    expect(canQuickApprove([{ ...allVerified[0], cites_other_source: true }, ...allVerified.slice(1)])).toBe(false);
    // Đã duyệt hết thì không cần nút nữa.
    expect(canQuickApprove(allVerified.map((cell) => ({ ...cell, review: "confirmed" as const })))).toBe(false);
  });
});

describe("xoá cột trong lúc AI đang đọc bài", () => {
  it("bỏ ô và thông tin bài của cột đã xoá, để thêm lại cột thì ô vẫn trống", async () => {
    const result = await processPaper(input(), deps(answer()));
    if (!result.ok) throw new Error();
    const remaining = columns.filter((column) => column.id !== "han-che" && column.id !== "info-year");
    const pruned = pruneToColumns(result.session, remaining);
    expect(pruned.cells.map((cell) => cell.column)).not.toContain("han-che");
    expect(pruned.cells).toHaveLength(result.session.cells.length - 1);
    expect(pruned.paper.info.year).toBeUndefined();
    expect(pruned.paper.suggested_info.year).toBeUndefined();
    expect(pruned.paper.info.title).toBe("Green credit and innovation");
    expect(pruned.paper.info.authors).toBe("Lin");
  });
});
