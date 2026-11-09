// Test hàng chờ thao tác: giữ lại khi gửi lỗi (mất mạng), gửi xong thì xoá đúng phần đã gửi.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushEvents, logEvent, readOutbox, setEventSender } from "./events";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: fakeStorage() });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  setEventSender(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hàng chờ thao tác", () => {
  it("chưa có nơi gửi thì giữ trong hàng chờ", async () => {
    logEvent("tai_bai", { bai: "b1" });
    expect(readOutbox()).toEqual([{ event: "tai_bai", detail: expect.objectContaining({ bai: "b1" }) }]);
    expect(await flushEvents()).toBe(false);
  });

  it("gửi lỗi (mất mạng) thì giữ lại, gửi được thì xoá", async () => {
    logEvent("o_bi_sua", { cot: "ket-qua" });
    const send = vi.fn().mockRejectedValueOnce(new Error("mất mạng")).mockResolvedValueOnce(undefined);
    setEventSender(send);
    expect(await flushEvents()).toBe(false);
    expect(readOutbox()).toHaveLength(1);
    expect(await flushEvents()).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(readOutbox()).toEqual([]);
  });

  it("thao tác ghi trong lúc đang gửi không bị mất", async () => {
    logEvent("tai_bai", { bai: "b1" });
    let release!: () => void;
    setEventSender(() => new Promise<void>((resolve) => (release = resolve)));
    const sending = flushEvents();
    logEvent("bam_luu_vao_bang", { bai: "b1" });
    release();
    await sending;
    expect(readOutbox().map((item) => item.event)).toEqual(["bam_luu_vao_bang"]);
  });
});
