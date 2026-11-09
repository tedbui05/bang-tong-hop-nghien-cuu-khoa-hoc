// Test chặn gọi AI tràn lan. Không cần Supabase hay Gemini: phiên đăng nhập, bộ đếm và AI đều là bản giả.
import { describe, expect, it, vi } from "vitest";
import type { ExtractResult } from "./ai-extract";
import { DEFAULT_TOTAL_DAILY_LIMIT, DEFAULT_USER_DAILY_LIMIT, memoryUsageStore, readAiLimits, vietnamDay } from "./ai-limit";
import { handleDienBang, type HandlerDeps } from "./dien-bang-handler";

const body = {
  columns: [{ id: "ket-qua", name: "Kết quả", description: "Phát hiện chính", kind: "content" }],
  pages: [{ page: 1, text: "Results: the treatment group improved by 13% after one year." }],
};

const okResult: ExtractResult = {
  ok: true,
  answer: { cells: [], info: {} },
  attempts: 1,
  model: "model-chinh",
  usedFallback: false,
  removedReferences: null,
};

// Phiên giả: "phien-<tên>" là phiên hợp lệ của người dùng <tên>.
const verifyUser = async (token: string) => (token.startsWith("phien-") ? token.slice("phien-".length) : null);

function request(token?: string, payload: unknown = body) {
  return new Request("http://localhost/api/dien-bang", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
}

function setup(limits = { perUser: 2, total: 3 }, result: ExtractResult = okResult) {
  const store = memoryUsageStore();
  const extract = vi.fn(async () => result);
  const deps: HandlerDeps = { verifyUser, store, limits, extract, now: () => Date.UTC(2026, 10, 9, 3) };
  return { store, extract, deps, send: (token?: string) => handleDienBang(request(token), deps) };
}

async function errorOf(response: Response) {
  return ((await response.json()) as { error: { code: string; title: string; retry: boolean } }).error;
}

describe("chỉ nhận yêu cầu có phiên đăng nhập", () => {
  it("không có phiên: từ chối, không gọi AI, không tính lượt", async () => {
    const { send, extract, store } = setup();
    const response = await send();
    expect(response.status).toBe(401);
    expect((await errorOf(response)).code).toBe("not_signed_in");
    expect(extract).not.toHaveBeenCalled();
    expect(store.counts().totals.size).toBe(0);
  });

  it("phiên không hợp lệ hoặc kiểm tra phiên bị lỗi: từ chối", async () => {
    const { deps, extract } = setup();
    expect((await handleDienBang(request("ma-gia-mao"), deps)).status).toBe(401);
    deps.verifyUser = async () => {
      throw new Error("mất mạng");
    };
    expect((await handleDienBang(request("phien-an"), deps)).status).toBe(401);
    expect(extract).not.toHaveBeenCalled();
  });

  it("có phiên hợp lệ (kể cả ẩn danh): gọi AI và trả kết quả", async () => {
    const { send, extract } = setup();
    const response = await send("phien-an");
    expect(response.status).toBe(200);
    expect(((await response.json()) as ExtractResult).ok).toBe(true);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});

describe("giới hạn số bài mỗi ngày", () => {
  it("vượt giới hạn cá nhân: bị chặn, không gọi AI, báo tiếng Việt kèm Thử lại", async () => {
    const { send, extract } = setup({ perUser: 2, total: 100 });
    expect((await send("phien-an")).status).toBe(200);
    expect((await send("phien-an")).status).toBe(200);
    const blocked = await send("phien-an");
    expect(blocked.status).toBe(429);
    const error = await errorOf(blocked);
    expect(error.code).toBe("limit_user");
    expect(error.title).toBe("Bạn đã dùng hết lượt AI hôm nay");
    expect(error.retry).toBe(true);
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it("một người hết lượt cá nhân: người khác vẫn dùng được", async () => {
    const { send } = setup({ perUser: 1, total: 100 });
    expect((await send("phien-an")).status).toBe(200);
    expect((await send("phien-an")).status).toBe(429);
    expect((await send("phien-binh")).status).toBe(200);
  });

  it("vượt giới hạn tổng của cả app: bị chặn, kể cả người chưa dùng lượt nào (nhiều danh tính ẩn danh)", async () => {
    const { send, extract } = setup({ perUser: 5, total: 3 });
    for (const name of ["a", "b", "c"]) expect((await send(`phien-${name}`)).status).toBe(200);
    const blocked = await send("phien-moi-tao");
    expect(blocked.status).toBe(429);
    expect((await errorOf(blocked)).code).toBe("limit_total");
    expect(extract).toHaveBeenCalledTimes(3);
  });

  it("sang ngày mới (giờ Việt Nam) thì lượt được tính lại", async () => {
    const { deps } = setup({ perUser: 1, total: 100 });
    expect((await handleDienBang(request("phien-an"), deps)).status).toBe(200);
    expect((await handleDienBang(request("phien-an"), deps)).status).toBe(429);
    deps.now = () => Date.UTC(2026, 10, 9, 17, 1); // 00:01 ngày 10/11 giờ Việt Nam
    expect((await handleDienBang(request("phien-an"), deps)).status).toBe(200);
  });

  it("chưa gọi AI lần nào (ví dụ bài quá dài): trả lại lượt", async () => {
    const tooLong: ExtractResult = { ok: false, error: { code: "too_long", title: "Bài quá dài", detail: "", retry: false }, attempts: 0, usedFallback: false };
    const { send, store } = setup({ perUser: 1, total: 100 }, tooLong);
    await send("phien-an");
    await send("phien-an");
    expect(store.counts().users.get(`2026-11-09:an`)).toBe(0);
  });

  it("dữ liệu gửi lên sai: từ chối trước khi tính lượt", async () => {
    const { deps, store } = setup();
    const response = await handleDienBang(request("phien-an", { columns: "sai" }), deps);
    expect(response.status).toBe(400);
    expect(store.counts().totals.size).toBe(0);
  });

  it("máy chủ chưa cài bộ đếm: không gọi AI", async () => {
    const { deps, extract } = setup();
    deps.store = null;
    const response = await handleDienBang(request("phien-an"), deps);
    expect(response.status).toBe(503);
    expect(extract).not.toHaveBeenCalled();
  });

  it("bộ đếm bị lỗi: không gọi AI, báo thử lại", async () => {
    const { deps, extract } = setup();
    deps.store = { claim: async () => Promise.reject(new Error("db")), release: async () => undefined };
    const response = await handleDienBang(request("phien-an"), deps);
    expect(response.status).toBe(503);
    expect((await errorOf(response)).retry).toBe(true);
    expect(extract).not.toHaveBeenCalled();
  });
});

describe("đọc giới hạn từ biến môi trường", () => {
  it("số hợp lệ thì dùng, sai hoặc trống thì dùng số mặc định", () => {
    expect(readAiLimits({ AI_GIOI_HAN_MOI_NGUOI_MOI_NGAY: "30", AI_GIOI_HAN_CA_APP_MOI_NGAY: "500" })).toEqual({ perUser: 30, total: 500 });
    expect(readAiLimits({ AI_GIOI_HAN_MOI_NGUOI_MOI_NGAY: "abc", AI_GIOI_HAN_CA_APP_MOI_NGAY: "-1" })).toEqual({
      perUser: DEFAULT_USER_DAILY_LIMIT,
      total: DEFAULT_TOTAL_DAILY_LIMIT,
    });
    expect(readAiLimits({})).toEqual({ perUser: DEFAULT_USER_DAILY_LIMIT, total: DEFAULT_TOTAL_DAILY_LIMIT });
  });

  it("ngày tính theo giờ Việt Nam", () => {
    expect(vietnamDay(Date.UTC(2026, 10, 9, 16, 59))).toBe("2026-11-09");
    expect(vietnamDay(Date.UTC(2026, 10, 9, 17, 0))).toBe("2026-11-10");
  });
});

describe("ghi thao tác dùng model dự phòng", () => {
  it("ghi một thao tác đứng tên người gọi khi bài được điền bằng model dự phòng", async () => {
    const { deps } = setup(undefined, { ...okResult, model: "model-du-phong", usedFallback: true, attempts: 2 });
    const recordEvent = vi.fn(async () => undefined);
    const response = await handleDienBang(request("phien-an"), { ...deps, recordEvent });
    expect(response.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledWith("an", "dung_model_du_phong", { model: "model-du-phong", ket_qua: "duoc" });
  });

  it("không ghi khi dùng model chính, và lỗi khi ghi không làm hỏng kết quả", async () => {
    const { deps } = setup();
    const recordEvent = vi.fn(async () => undefined);
    await handleDienBang(request("phien-an"), { ...deps, recordEvent });
    expect(recordEvent).not.toHaveBeenCalled();

    const fallback = setup(undefined, { ok: false, error: { code: "overloaded", title: "", detail: "", retry: true }, attempts: 2, usedFallback: true });
    const failing = vi.fn(async () => {
      throw new Error("mất mạng");
    });
    const response = await handleDienBang(request("phien-an"), { ...fallback.deps, recordEvent: failing });
    expect(response.status).toBe(200);
    expect(failing).toHaveBeenCalledWith("an", "dung_model_du_phong", { model: "", ket_qua: "loi" });
  });
});
