// Chạy trước "npm run build". Chỉ kiểm tra khi build trên Vercel (có biến VERCEL): thiếu biến công khai thì in cảnh báo
// vào nhật ký build. Biến NEXT_PUBLIC_ chỉ được gắn vào code trình duyệt lúc build, thiếu thì app báo
// "Đăng nhập chưa được cài đặt" cho mọi người (gặp ngày 10/11/2026). Chỉ in tên biến, không bao giờ in giá trị.
// Trên máy không kiểm tra, vì file biến môi trường trên máy chỉ được Next.js đọc sau bước này.
const NEEDED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];

if (process.env.VERCEL) {
  const scope = process.env.VERCEL_ENV ?? "không rõ";
  const missing = NEEDED.filter((name) => !process.env[name]?.trim());
  const quoted = NEEDED.filter((name) => /^\s|\s$|^["']|["']$/.test(process.env[name] ?? ""));
  if (missing.length) {
    console.warn(
      `\n!!! CẢNH BÁO: build này (môi trường Vercel: ${scope}) thiếu ${missing.join(", ")}.\n` +
        `!!! App sẽ báo "Đăng nhập chưa được cài đặt". Thêm biến ở Settings → Environment Variables, chọn đúng môi trường "${scope}", rồi deploy lại.\n`,
    );
  } else {
    console.log(`Đã có đủ biến công khai cho môi trường Vercel: ${scope}.`);
  }
  if (quoted.length) console.warn(`!!! CẢNH BÁO: ${quoted.join(", ")} có dấu cách hoặc dấu ngoặc kép ở đầu hay cuối giá trị. Hãy xoá đi.\n`);
}
