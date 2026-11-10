import { describe, expect, it } from "vitest";
import { formatClock, isSaveShortcut, saveStatus } from "./save-status";

const at = new Date(2026, 10, 10, 8, 10).getTime();

describe("trạng thái lưu ở đầu bảng", () => {
  it("đang lưu", () => {
    expect(saveStatus("saving", false, at)).toEqual({ text: "Đang lưu…", tone: "busy" });
    expect(saveStatus("loading", false, null).text).toBe("Đang lưu…");
  });

  it("đã lưu kèm giờ", () => {
    expect(formatClock(at)).toBe("08:10");
    expect(saveStatus("saved", false, at)).toEqual({ text: "Đã lưu lúc 08:10", tone: "ok" });
    expect(saveStatus("local", false, at).text).toBe("Đã lưu trên trình duyệt lúc 08:10");
  });

  it("mất mạng hoặc lỗi: chưa lưu được, sẽ thử lại", () => {
    expect(saveStatus("offline", false, at)).toEqual({ text: "Chưa lưu được, sẽ thử lại khi có mạng", tone: "warn" });
    expect(saveStatus("error", false, at).tone).toBe("warn");
  });

  it("trình duyệt chặn bộ nhớ", () => {
    expect(saveStatus("local", true, null).tone).toBe("warn");
  });
});

describe("phím lưu", () => {
  it("Cmd+S, Ctrl+S là lưu; thêm Shift hay Alt thì không", () => {
    expect(isSaveShortcut({ key: "s", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })).toBe(true);
    expect(isSaveShortcut({ key: "S", metaKey: false, ctrlKey: true, altKey: false, shiftKey: false })).toBe(true);
    expect(isSaveShortcut({ key: "s", metaKey: true, ctrlKey: false, altKey: false, shiftKey: true })).toBe(false);
    expect(isSaveShortcut({ key: "s", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false })).toBe(false);
  });
});
