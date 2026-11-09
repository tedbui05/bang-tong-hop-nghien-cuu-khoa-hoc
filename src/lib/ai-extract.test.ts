// Test phần gọi AI bằng câu trả lời giả. Không gọi Gemini thật để không tốn lượt miễn phí.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_INSTRUCTION, buildResponseSchema, buildUserText, makeAiRequest, type AiColumn } from "./ai-prompt";
import { DEFAULT_PRIMARY_TIMEOUT_SECONDS, FALLBACK_TIMEOUT_SECONDS, OVERLOADED_MESSAGE, extractPaper, readExtractBody, readTimeoutSeconds, waitingMessage, type CallModel, type ModelCall, type ModelResult } from "./ai-extract";
import type { PdfPage } from "./pdf-read";
import { filledByText } from "./types";

const columns: AiColumn[] = [
  { id: "info-title", name: "Tên bài", description: "", kind: "info", infoKey: "title" },
  { id: "info-year", name: "Năm", description: "Năm công bố", kind: "info", infoKey: "year" },
  { id: "phuong-phap", name: "Phương pháp", description: "Thiết kế nghiên cứu", kind: "content" },
  { id: "han-che", name: "Hạn chế", description: "", kind: "content" },
  { id: "ghi-chu", name: "Ghi chú", description: "", kind: "note" },
  { id: "nhan", name: "Nhãn", description: "", kind: "tags" },
];

const body = (topic: string) =>
  Array.from({ length: 20 }, (_, i) => `Paragraph ${i + 1} discusses ${topic} in rural schools across the provinces.`).join("\n");

const pages: PdfPage[] = [
  { page: 1, text: body("reading") },
  { page: 2, text: `${body("method")}\nWe surveyed 412 households in three provinces.` },
  { page: 3, text: "References\nSmith J. (2020). A secret reference sentence." },
];

// Các test cũ: chỉ có model chính, không đặt model dự phòng.
const NO_FALLBACK = { primary: "model-chinh" };
const WITH_FALLBACK = { primary: "model-chinh", fallback: "model-du-phong" };

const goodAnswer = {
  info: { title: "A study of reading", year: "2023" },
  cells: [
    {
      column: "phuong-phap",
      status: "proposed",
      value_vi: "Khảo sát 412 hộ ở ba tỉnh",
      quote_original: "We surveyed 412 households in three provinces.",
      quote_vi: "Chúng tôi khảo sát 412 hộ ở ba tỉnh.",
      page: 2,
    },
    { column: "han-che", status: "not_found", value_vi: "không tìm thấy", quote_original: null, quote_vi: null, page: null },
  ],
};

// Hàm gọi AI giả: trả lần lượt từng câu trả lời trong danh sách và ghi lại câu lệnh đã nhận.
function fakeModel(...results: (ModelResult | object | string)[]) {
  const calls: ModelCall[] = [];
  const call: CallModel = async (request) => {
    calls.push(request);
    const next = results[calls.length - 1];
    if (next === undefined) throw new Error("Gọi AI nhiều hơn dự kiến");
    if (typeof next === "string") return { ok: true, text: next };
    if ("ok" in next) return next as ModelResult;
    return { ok: true, text: JSON.stringify(next) };
  };
  return { call, calls };
}

describe("câu lệnh gửi AI", () => {
  it("ngôn ngữ, tên bài và tác giả lấy theo phần thân bài, không theo phần tóm tắt", () => {
    expect(SYSTEM_INSTRUCTION).toContain("Ngôn ngữ của bài là ngôn ngữ của phần thân bài (phương pháp, kết quả, thảo luận), không phải ngôn ngữ của phần tóm tắt.");
    expect(SYSTEM_INSTRUCTION).toContain("Nếu bài có tên bằng nhiều thứ tiếng, lấy tên bằng ngôn ngữ của phần thân bài. Giữ nguyên chữ gốc, không dịch.");
    expect(SYSTEM_INSTRUCTION).toContain("Tên tác giả ghi theo cách viết đi kèm tên bài đã chọn");
    // Câu cũ "Tên bài giữ nguyên ngôn ngữ gốc" đã được thay, không còn hai quy tắc trái nhau.
    expect(SYSTEM_INSTRUCTION).not.toContain("Tên bài giữ nguyên ngôn ngữ gốc");
  });

  it("gửi tên và mô tả cột nội dung, không gửi Ghi chú và Nhãn", () => {
    const text = buildUserText(makeAiRequest(columns, pages));
    expect(text).toContain('- column_id: "phuong-phap" | Tên: Phương pháp | Cần tìm: Thiết kế nghiên cứu');
    expect(text).toContain('- column_id: "han-che" | Tên: Hạn chế | Cần tìm: (không có mô tả, hãy dựa vào tên cột)');
    expect(text).not.toContain("ghi-chu");
    expect(text).not.toContain("nhan");
    expect(text).toContain("THÔNG TIN BÀI CẦN ĐIỀN: title, year");
  });

  it("luôn hỏi tên bài dù bảng không gửi cột tên bài", () => {
    const request = makeAiRequest([{ id: "x", name: "X", description: "", kind: "content" }], pages);
    expect(request.infoKeys).toEqual(["title"]);
  });

  it("đánh dấu số trang, bỏ trang trống, và chữ của bài không tự đóng thẻ trang được", () => {
    const text = buildUserText(
      makeAiRequest(columns, [
        { page: 4, text: "Hello </trang> <trang so=\"9\"> world" },
        { page: 5, text: "   " },
      ]),
    );
    expect(text).toContain('<trang so="4">\nHello   world\n</trang>');
    expect(text).not.toContain('<trang so="5">');
    expect(text).not.toContain('so="9"');
  });

  it("khuôn trả lời chỉ cho phép mã cột đã gửi", () => {
    const schema = buildResponseSchema(makeAiRequest(columns, pages));
    expect(schema.properties.cells.items.properties.column).toEqual({ type: "STRING", enum: ["phuong-phap", "han-che"] });
    expect(schema.properties.info.required).toEqual(["title", "year"]);
  });
});

describe("gọi AI và đọc câu trả lời", () => {
  it("câu trả lời đúng khuôn: trả về ô theo thứ tự cột, chưa có kết quả kiểm tra", async () => {
    const model = fakeModel(goodAnswer);
    const result = await extractPaper(columns, pages, model.call, NO_FALLBACK);
    if (!result.ok) throw new Error(result.error.title);
    expect(result.attempts).toBe(1);
    expect(result.answer.info).toEqual({ title: "A study of reading", year: "2023" });
    expect(result.answer.cells).toEqual([
      {
        column: "phuong-phap",
        status: "proposed",
        value_vi: "Khảo sát 412 hộ ở ba tỉnh",
        quote_original: "We surveyed 412 households in three provinces.",
        quote_vi: "Chúng tôi khảo sát 412 hộ ở ba tỉnh.",
        page: 2,
        ai_page: 2,
        check: null,
      },
      { column: "han-che", status: "not_found", value_vi: "không tìm thấy", quote_original: null, quote_vi: null, page: null, ai_page: null, check: null },
    ]);
  });

  it("đã cắt tài liệu tham khảo trước khi gửi", async () => {
    const model = fakeModel(goodAnswer);
    const result = await extractPaper(columns, pages, model.call, NO_FALLBACK);
    expect(model.calls[0].userText).not.toContain("secret reference sentence");
    expect(result.ok && result.removedReferences).toEqual({ fromPage: 3, toPage: 3 });
  });

  it("sai khuôn lần đầu thì gửi lại một lần, kèm lý do sai", async () => {
    const model = fakeModel("đây không phải JSON", goodAnswer);
    const result = await extractPaper(columns, pages, model.call, NO_FALLBACK);
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(model.calls[1].userText).toContain("Lần trước bạn trả lời sai định dạng: câu trả lời không phải JSON hợp lệ");
    expect(model.calls[0].userText).not.toContain("Lần trước");
  });

  it("sai khuôn hai lần thì báo lỗi, không gọi lần thứ ba", async () => {
    const model = fakeModel("{}", "{}");
    const result = await extractPaper(columns, pages, model.call, NO_FALLBACK);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("bad_format");
    expect(result.error.retry).toBe(true);
    expect(model.calls).toHaveLength(2);
  });

  it("hết lượt hoặc quá tải: báo đúng câu, có nút thử lại, không tự gửi lại", async () => {
    const model = fakeModel({ ok: false, kind: "overloaded" });
    const result = await extractPaper(columns, pages, model.call, NO_FALLBACK);
    if (result.ok) throw new Error("Mong đợi báo lỗi");
    expect(result.error.title).toBe(OVERLOADED_MESSAGE);
    expect(result.error.title).toBe("Hệ thống đang quá tải, vui lòng thử lại sau ít phút");
    expect(result.error.retry).toBe(true);
    expect(model.calls).toHaveLength(1);
  });

  it("quá tải ở lần gửi lại cũng báo quá tải", async () => {
    const model = fakeModel("sai", { ok: false, kind: "overloaded" });
    const result = await extractPaper(columns, pages, model.call, NO_FALLBACK);
    expect(!result.ok && result.error.code).toBe("overloaded");
  });

  it("bài quá dài sau khi cắt tài liệu tham khảo thì không gọi AI", async () => {
    const model = fakeModel();
    const result = await extractPaper(columns, [{ page: 1, text: "a".repeat(100_001) }], model.call, NO_FALLBACK);
    expect(!result.ok && result.error.code).toBe("too_long");
    expect(!result.ok && result.error.detail).toContain("100.001");
    expect(model.calls).toHaveLength(0);
  });

  const wrongAnswers: [string, object][] = [
    ["thiếu cột", { info: {}, cells: [goodAnswer.cells[0]] }],
    ["trùng cột", { info: {}, cells: [goodAnswer.cells[0], goodAnswer.cells[0], goodAnswer.cells[1]] }],
    ["cột lạ", { info: {}, cells: [...goodAnswer.cells, { ...goodAnswer.cells[1], column: "cot-la" }] }],
    ["proposed thiếu câu trích", { info: {}, cells: [{ ...goodAnswer.cells[0], quote_original: null }, goodAnswer.cells[1]] }],
    ["proposed thiếu bản dịch", { info: {}, cells: [{ ...goodAnswer.cells[0], quote_vi: "" }, goodAnswer.cells[1]] }],
    ["proposed thiếu số trang", { info: {}, cells: [{ ...goodAnswer.cells[0], page: null }, goodAnswer.cells[1]] }],
    ["số trang không nguyên", { info: {}, cells: [{ ...goodAnswer.cells[0], page: 2.5 }, goodAnswer.cells[1]] }],
    ["not_found có câu trích", { info: {}, cells: [goodAnswer.cells[0], { ...goodAnswer.cells[1], quote_original: "We surveyed" }] }],
    ["status lạ", { info: {}, cells: [{ ...goodAnswer.cells[0], status: "maybe" }, goodAnswer.cells[1]] }],
    ["info không phải chữ", { info: { year: 2023 }, cells: goodAnswer.cells }],
    ["thiếu info", { cells: goodAnswer.cells }],
  ];
  for (const [name, answer] of wrongAnswers) {
    it(`coi là sai khuôn: ${name}`, async () => {
      const model = fakeModel(answer, answer);
      const result = await extractPaper(columns, pages, model.call, NO_FALLBACK);
      expect(!result.ok && result.error.code).toBe("bad_format");
    });
  }

  it("ô not_found luôn ghi đúng chữ 'không tìm thấy'", async () => {
    const answer = { ...goodAnswer, cells: [goodAnswer.cells[0], { ...goodAnswer.cells[1], value_vi: "Bài không nêu" }] };
    const result = await extractPaper(columns, pages, fakeModel(answer).call, NO_FALLBACK);
    expect(result.ok && result.answer.cells[1].value_vi).toBe("không tìm thấy");
  });
});

describe("model dự phòng", () => {
  const overloaded: ModelResult = { ok: false, kind: "overloaded" };
  const timeout: ModelResult = { ok: false, kind: "timeout" };

  it("model chính trả lời được: không gọi model dự phòng", async () => {
    const model = fakeModel(goodAnswer);
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    if (!result.ok) throw new Error(result.error.title);
    expect(result.model).toBe("model-chinh");
    expect(result.usedFallback).toBe(false);
    expect(model.calls.map((call) => call.model)).toEqual(["model-chinh"]);
  });

  it("model chính quá tải, model dự phòng trả lời được: bài do model dự phòng điền", async () => {
    const model = fakeModel(overloaded, goodAnswer);
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    if (!result.ok) throw new Error(result.error.title);
    expect(result.model).toBe("model-du-phong");
    expect(result.usedFallback).toBe(true);
    expect(result.attempts).toBe(2);
    expect(model.calls.map((call) => call.model)).toEqual(["model-chinh", "model-du-phong"]);
    // Model dự phòng nhận đúng câu lệnh như model chính.
    expect(model.calls[1].userText).toBe(model.calls[0].userText);
    expect(model.calls[1].systemInstruction).toBe(model.calls[0].systemInstruction);
  });

  it("model chính quá giờ: chuyển sang model dự phòng", async () => {
    const model = fakeModel(timeout, goodAnswer);
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    expect(result.ok && result.model).toBe("model-du-phong");
    expect(model.calls.map((call) => call.model)).toEqual(["model-chinh", "model-du-phong"]);
  });

  it("cả hai đều quá tải: báo quá tải, có nút thử lại, chỉ gọi mỗi model một lần", async () => {
    const model = fakeModel(overloaded, overloaded);
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    if (result.ok) throw new Error("Mong đợi báo lỗi");
    expect(result.error.title).toBe("Hệ thống đang quá tải, vui lòng thử lại sau ít phút");
    expect(result.error.retry).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(model.calls.map((call) => call.model)).toEqual(["model-chinh", "model-du-phong"]);
  });

  it("model chính quá giờ, model dự phòng lỗi khác: vẫn báo quá tải kèm nút thử lại", async () => {
    const model = fakeModel(timeout, { ok: false, kind: "failed" });
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    expect(!result.ok && result.error.code).toBe("overloaded");
    expect(!result.ok && result.error.retry).toBe(true);
  });

  it("model dự phòng sai khuôn thì gửi lại một lần cho chính model dự phòng", async () => {
    const model = fakeModel(overloaded, "sai", goodAnswer);
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    expect(result.ok && result.model).toBe("model-du-phong");
    expect(model.calls.map((call) => call.model)).toEqual(["model-chinh", "model-du-phong", "model-du-phong"]);
    expect(model.calls[2].userText).toContain("Lần trước bạn trả lời sai định dạng");
  });

  it("model dự phòng sai khuôn hai lần: báo sai định dạng", async () => {
    const model = fakeModel(overloaded, "sai", "sai");
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    expect(!result.ok && result.error.code).toBe("bad_format");
    expect(model.calls).toHaveLength(3);
  });

  it("model chính sai khuôn: gửi lại cho model chính, không chuyển sang dự phòng", async () => {
    const model = fakeModel("sai", goodAnswer);
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    expect(result.ok && result.model).toBe("model-chinh");
    expect(model.calls.map((call) => call.model)).toEqual(["model-chinh", "model-chinh"]);
  });

  it("model chính sai khuôn hai lần: báo sai định dạng, không gọi model dự phòng", async () => {
    const model = fakeModel("sai", "sai");
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    expect(!result.ok && result.error.code).toBe("bad_format");
    expect(model.calls.map((call) => call.model)).toEqual(["model-chinh", "model-chinh"]);
  });

  it("model chính quá tải ở lần gửi lại vì sai khuôn: vẫn chuyển sang dự phòng", async () => {
    const model = fakeModel("sai", overloaded, goodAnswer);
    const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
    expect(result.ok && result.model).toBe("model-du-phong");
    expect(result.attempts).toBe(3);
  });

  it("lỗi mà model dự phòng không giúp được (key sai, bị chặn): không gọi model dự phòng", async () => {
    for (const kind of ["not_configured", "blocked", "failed"] as const) {
      const model = fakeModel({ ok: false, kind });
      const result = await extractPaper(columns, pages, model.call, WITH_FALLBACK);
      expect(!result.ok && result.error.code, kind).toBe(kind);
      expect(model.calls, kind).toHaveLength(1);
    }
  });

  it("không đặt model dự phòng: quá tải thì báo ngay như cũ", async () => {
    for (const fallback of [undefined, null, "", "  "]) {
      const model = fakeModel(overloaded);
      const result = await extractPaper(columns, pages, model.call, { primary: "model-chinh", fallback });
      expect(!result.ok && result.error.code).toBe("overloaded");
      expect(model.calls).toHaveLength(1);
    }
  });

  it("model dự phòng trùng tên model chính: không gọi lại cùng model", async () => {
    const model = fakeModel(overloaded);
    const result = await extractPaper(columns, pages, model.call, { primary: "model-chinh", fallback: "model-chinh" });
    expect(!result.ok && result.error.code).toBe("overloaded");
    expect(model.calls).toHaveLength(1);
  });
});

describe("giới hạn thời gian và nhật ký của model dự phòng", () => {
  afterEach(() => vi.restoreAllMocks());

  it("đọc GEMINI_TIMEOUT_SECONDS, bỏ trống hoặc ghi sai thì dùng mặc định", () => {
    expect(readTimeoutSeconds(undefined, 60)).toBe(60);
    expect(readTimeoutSeconds("", 60)).toBe(60);
    expect(readTimeoutSeconds("abc", 60)).toBe(60);
    expect(readTimeoutSeconds("-5", 60)).toBe(60);
    expect(readTimeoutSeconds("0", 60)).toBe(60);
    expect(readTimeoutSeconds(" 45 ", 60)).toBe(45);
    expect(readTimeoutSeconds("1", 60)).toBe(1);
    expect(readTimeoutSeconds("0.5", 60)).toBe(1);
    expect(readTimeoutSeconds("99999", 60)).toBe(600);
  });

  it("mặc định chờ model chính 150 giây (số tạm), vì bài tiếng Anh dài có thể mất hơn 2 phút", () => {
    expect(DEFAULT_PRIMARY_TIMEOUT_SECONDS).toBe(150);
  });

  it("dòng chữ ở màn hình chờ: sau 60 giây báo bài dài để sinh viên không tưởng app bị treo", () => {
    expect(waitingMessage(0)).toBe("AI đang đọc bài và điền bảng…");
    expect(waitingMessage(59)).toBe("AI đang đọc bài và điền bảng…");
    expect(waitingMessage(60)).toBe("AI đang đọc bài dài, có thể mất thêm 1 đến 2 phút");
    expect(waitingMessage(140)).toBe("AI đang đọc bài dài, có thể mất thêm 1 đến 2 phút");
  });

  it("giới hạn thời gian chỉ áp cho model chính; model dự phòng được chờ lâu hơn", async () => {
    const model = fakeModel({ ok: false, kind: "timeout" }, goodAnswer);
    await extractPaper(columns, pages, model.call, { ...WITH_FALLBACK, primaryTimeoutMs: 1000 });
    expect(model.calls.map((call) => call.timeoutMs)).toEqual([1000, FALLBACK_TIMEOUT_SECONDS * 1000]);
  });

  it("không đặt giới hạn thì model chính dùng số mặc định", async () => {
    const model = fakeModel(goodAnswer);
    await extractPaper(columns, pages, model.call, NO_FALLBACK);
    expect(model.calls[0].timeoutMs).toBe(DEFAULT_PRIMARY_TIMEOUT_SECONDS * 1000);
  });

  it("ghi thao tác dung_model_du_phong mỗi lần gọi model dự phòng, kèm lý do và kết quả", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await extractPaper(columns, pages, fakeModel({ ok: false, kind: "timeout" }, goodAnswer).call, WITH_FALLBACK);
    await extractPaper(columns, pages, fakeModel({ ok: false, kind: "overloaded" }, { ok: false, kind: "overloaded" }).call, WITH_FALLBACK);
    const events = log.mock.calls.filter((args) => args[0] === "[thao-tac]" && args[1] === "dung_model_du_phong");
    expect(events.map((args) => args[2])).toMatchObject([
      { model: "model-du-phong", ly_do: "timeout", ket_qua: "duoc" },
      { model: "model-du-phong", ly_do: "overloaded", ket_qua: "loi" },
    ]);
  });

  it("không gọi model dự phòng thì không ghi thao tác dung_model_du_phong", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await extractPaper(columns, pages, fakeModel(goodAnswer).call, WITH_FALLBACK);
    expect(log.mock.calls.some((args) => args[1] === "dung_model_du_phong")).toBe(false);
  });
});

describe("dòng 'Điền bởi' ở màn hình duyệt", () => {
  it("model chính", () => {
    expect(filledByText({ model: "gemini-3.6-flash", fallback: false })).toBe("Điền bởi gemini-3.6-flash");
  });

  it("model dự phòng: ghi rõ và nhắc duyệt kỹ", () => {
    const text = filledByText({ model: "gemini-3.5-flash-lite", fallback: true });
    expect(text).toContain("Điền bởi gemini-3.5-flash-lite (model dự phòng)");
    expect(text).toContain("duyệt kỹ");
  });
});

describe("kiểm tra dữ liệu trang web gửi lên", () => {
  it("nhận dữ liệu hợp lệ", () => {
    expect(readExtractBody({ columns, pages })).toEqual({ columns, pages });
  });

  it("từ chối dữ liệu sai", () => {
    expect(readExtractBody(null)).toBeNull();
    expect(readExtractBody({ columns, pages: [] })).toBeNull();
    expect(readExtractBody({ columns: [{ ...columns[0], kind: "khac" }], pages })).toBeNull();
    expect(readExtractBody({ columns, pages: [{ page: 0, text: "a" }] })).toBeNull();
    expect(readExtractBody({ columns, pages: [{ page: 1, text: "a".repeat(2_000_001) }] })).toBeNull();
  });
});
