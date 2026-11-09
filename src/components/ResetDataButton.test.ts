import { describe, expect, it } from "vitest";
import { isResetConfirmed } from "./ResetDataButton";

describe("xác nhận đặt lại dữ liệu mẫu", () => {
  it("nhận XOÁ và XÓA, không phân biệt hoa thường, bỏ khoảng trắng hai đầu", () => {
    for (const text of ["XOÁ", "XÓA", "xoá", "xóa", " Xoá "]) expect(isResetConfirmed(text)).toBe(true);
    // Gõ kiểu tổ hợp dấu (NFD) cũng nhận.
    expect(isResetConfirmed("XOÁ".normalize("NFD"))).toBe(true);
  });

  it("không nhận chữ khác hoặc thiếu dấu", () => {
    for (const text of ["", "XOA", "xoa", "XOÁ HẾT", "có", "OK"]) expect(isResetConfirmed(text)).toBe(false);
  });
});
