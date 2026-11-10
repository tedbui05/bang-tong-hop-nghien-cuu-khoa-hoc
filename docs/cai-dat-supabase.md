# Cài đặt Supabase

Từ ngày 9/11/2026, máy chủ chỉ gửi bài cho AI khi người dùng có phiên đăng nhập (đăng nhập ẩn danh, không cần tạo tài khoản) và còn lượt trong ngày. Lượt được đếm trong cơ sở dữ liệu Supabase. Chưa cài xong các bước dưới đây thì app báo "Đăng nhập chưa được cài đặt" và không gọi AI.

## 1. Tạo dự án Supabase

Vào https://supabase.com/dashboard, tạo dự án mới (gói miễn phí là đủ). Chọn vùng gần Việt Nam, ví dụ Singapore.

## 2. Bật đăng nhập ẩn danh

Trong dự án: **Authentication → Sign In / Providers**, bật **Allow anonymous sign-ins**, rồi lưu.

Supabase mặc định giới hạn 30 lần đăng nhập ẩn danh mỗi giờ cho mỗi địa chỉ IP. Trước khi mời nhiều người dùng thử, nên bật thêm CAPTCHA (Cloudflare Turnstile) ở **Authentication → Attack Protection** để chặn việc tạo hàng loạt danh tính ẩn danh. App cũng đã có giới hạn tổng cho cả app mỗi ngày để giữ lượt miễn phí của Gemini.

## 3. Tạo bộ đếm lượt

Mở **SQL Editor**, dán toàn bộ nội dung file `supabase/sql/gioi-han-goi-ai.sql`, bấm **Run**. Chạy lại lần nữa cũng không sao.

## 3b. Tạo bảng lưu dữ liệu và thao tác

Cũng trong **SQL Editor**, mở một tab mới (dấu +), dán toàn bộ nội dung file `supabase/sql/du-lieu-bang.sql`, bấm **Run**. Chạy lại cũng không sao.

File này tạo 3 bảng: `sheet_tables` (bảng tổng hợp và cột), `sheet_papers` (bài đã lưu, kèm câu trích, số trang, định dạng), `app_events` (thao tác để đo hiệu quả), bật quy tắc phân quyền để mỗi người chỉ thấy dữ liệu của mình. File PDF không bao giờ được gửi lên đây.

Kiểm tra mọi bảng đã bật phân quyền: chạy câu dưới đây, cột `rls_bat` phải là `true` ở mọi dòng.

```sql
select c.relname as bang, c.relrowsecurity as rls_bat
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by 1;
```

## 4. Lấy địa chỉ và khoá

Trong **Project Settings → API Keys** (và **Data API** để lấy địa chỉ dự án):

- Địa chỉ dự án, dạng `https://xxxx.supabase.co`
- Khoá công khai, bắt đầu bằng `sb_publishable_`
- Khoá bí mật, bắt đầu bằng `sb_secret_`. Khoá này có toàn quyền với cơ sở dữ liệu: không gửi cho ai, không dán vào chat, không đưa vào git.

## 5. Điền vào file biến môi trường

Tự mở file `.env.local` (không nhờ AI mở) và thêm theo mẫu trong `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=<địa chỉ dự án>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<khoá công khai>
SUPABASE_SECRET_KEY=<khoá bí mật>
```

Muốn xem trang số liệu `/metrics` thì thêm `METRICS_MAT_KHAU=<mật khẩu tự đặt, ít nhất 12 ký tự>`. Không đặt thì trang này bị khoá.

Muốn đổi giới hạn (số tạm) thì thêm `AI_GIOI_HAN_MOI_NGUOI_MOI_NGAY` và `AI_GIOI_HAN_CA_APP_MOI_NGAY`. Mặc định: 15 bài mỗi người, 150 bài cả app mỗi ngày.

Tắt `npm run dev` rồi chạy lại để app đọc biến mới.

## 6. Khi đưa lên mạng (ví dụ Vercel)

Thêm đúng các biến trên vào phần Environment Variables của nơi chạy app. Không thêm `AI_DUNG_KET_QUA_MAU`.

Trên Vercel (Project → Settings → Environment Variables):

- Tên biến gõ đúng từng chữ, ví dụ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Giá trị dán nguyên, **không** có dấu ngoặc kép, không có dấu cách hay xuống dòng ở đầu và cuối.
- Mỗi biến phải tích môi trường **Production** (và Preview nếu muốn thử các nhánh khác).
- Hai biến `NEXT_PUBLIC_...` chỉ được gắn vào app **lúc build**. Thêm hoặc sửa biến xong phải deploy lại: vào Deployments, bấm "⋯" ở bản mới nhất, chọn Redeploy và **bỏ tích** "Use existing Build Cache". Chỉ bấm tải lại trang thì không đủ.
- Nhật ký build (Deployments → bản deploy → Build Logs) có dòng "Đã có đủ biến công khai cho môi trường Vercel: production". Thấy dòng "!!! CẢNH BÁO: ... thiếu ..." thì biến chưa tới được bản build (`scripts/kiem-tra-bien-build.mjs`).
- Thiếu hai biến này thì app báo "Đăng nhập chưa được cài đặt" và ghi rõ biến nào thiếu.

## Kiểm tra

Chạy `npm run test:phan-quyen`. Lệnh này tạo hai người dùng ẩn danh tạm, thử đọc, sửa, xoá chéo dữ liệu của nhau, rồi xoá hai người dùng đó. Mọi dòng phải là "ĐẠT".

Tải một bài lên. Nếu dòng của bài báo "Đăng nhập chưa được cài đặt", xem lại bước 4 và 5. Nếu báo "AI chưa được cài đặt đúng" kèm câu "thiếu thông tin để đếm lượt", xem lại `SUPABASE_SECRET_KEY`. Trong Supabase, bảng `ai_usage_user` và `ai_usage_total` sẽ có số đếm sau mỗi bài. Lưu bài vào bảng xong, chân trang bảng tổng hợp ghi "Đã lưu lên máy chủ", và bảng `sheet_papers` có bài vừa lưu.
