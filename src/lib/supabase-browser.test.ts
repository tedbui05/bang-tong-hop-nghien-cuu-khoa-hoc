import { describe, expect, it } from "vitest";
import { describeAuthError, missingPublicConfig, signInError } from "./supabase-browser";

describe("cấu hình đăng nhập còn thiếu", () => {
  it("nói đúng tên biến thiếu, không có giá trị", () => {
    expect(missingPublicConfig({ url: undefined, key: undefined })).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
    expect(missingPublicConfig({ url: "https://x.supabase.co", key: "" })).toEqual(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
    expect(missingPublicConfig({ url: "https://x.supabase.co", key: "k" })).toEqual([]);
  });
});

describe("lỗi đăng nhập ẩn danh", () => {
  const authError = (status: number, code: string, message: string) => Object.assign(new Error(message), { name: "AuthApiError", status, code });

  it("chỉ nói kiểm tra mạng khi đúng là mạng", () => {
    expect(signInError(new TypeError("Failed to fetch"), false).detail).toContain("kết nối mạng");
    expect(signInError(new Error("bất kỳ"), true).detail).toContain("kết nối mạng");
    expect(signInError(authError(500, "unexpected_failure", "Database error"), false).detail).not.toContain("kết nối mạng");
  });

  it("Supabase tắt đăng nhập ẩn danh", () => {
    expect(signInError(authError(422, "anonymous_provider_disabled", "Anonymous sign-ins are disabled"), false).title).toBe("Đăng nhập ẩn danh chưa được bật");
  });

  it("Supabase đòi CAPTCHA, hoặc đăng nhập quá nhiều lần", () => {
    expect(signInError(authError(400, "captcha_failed", "captcha protection: request disallowed"), false).title).toBe("Máy chủ đăng nhập đòi xác minh");
    expect(signInError(authError(429, "over_request_rate_limit", "Request rate limit reached"), false).title).toBe("Đăng nhập quá nhiều lần");
  });

  it("ghi lỗi gốc gọn, đủ tên, mã và nội dung", () => {
    expect(describeAuthError(authError(422, "anonymous_provider_disabled", "Anonymous sign-ins are disabled"))).toBe(
      "AuthApiError | 422 | anonymous_provider_disabled | Anonymous sign-ins are disabled",
    );
  });
});
