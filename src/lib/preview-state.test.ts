import { describe, expect, it } from "vitest";
import { parsePreviewState } from "./preview-state";

describe("trạng thái xem thử ?trang-thai=", () => {
  it("chỉ dùng được khi chạy npm run dev", () => {
    expect(parsePreviewState("loi", "development")).toBe("loi");
    expect(parsePreviewState("trong", "development")).toBe("trong");
    expect(parsePreviewState("la", "development")).toBe("binh-thuong");
  });

  it("bản chạy thật bỏ qua tham số này", () => {
    expect(parsePreviewState("loi", "production")).toBe("binh-thuong");
    expect(parsePreviewState("dang-tai", "production")).toBe("binh-thuong");
    expect(parsePreviewState("trong", "test")).toBe("binh-thuong");
  });
});
