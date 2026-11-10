-- Lịch sử phiên bản của bảng (nút "Lịch sử phiên bản" trong menu của bảng, xem src/lib/versions.ts).
-- Chạy trong SQL Editor của Supabase, sau file du-lieu-bang.sql. Chạy lại cũng không sao.
--
-- Ai được làm gì:
-- - Mỗi người dùng (kể cả đăng nhập ẩn danh) chỉ xem, thêm, xoá phiên bản của chính mình (owner_id = auth.uid()).
--   Không ai sửa được phiên bản đã lưu (khôi phục là đọc ra, không sửa dòng).
-- - Người chưa đăng nhập (anon) không dùng được bảng này.
-- - Phiên bản là bản chụp cả bảng (cột, nhãn, mọi bài) dạng JSON. Không có file PDF: file chỉ nằm trong trình duyệt.
-- - Phiên bản tự lưu (trước khi xoá cột, xoá nhiều bài, xoá bảng, khôi phục): giữ tối đa 30 bản mới nhất mỗi bảng,
--   bản cũ hơn tự bị xoá. Phiên bản người dùng tự đặt tên không bao giờ tự bị xoá. Số 30 là số tạm.

create table if not exists public.sheet_versions (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  -- Bảng gốc. Không ràng buộc với sheet_tables: bảng đã xoá vẫn giữ phiên bản để khôi phục lại được.
  table_id text not null check (char_length(table_id) between 1 and 200),
  table_name text not null check (char_length(table_name) between 1 and 500),
  -- Tên người dùng đặt ("Trước khi gửi thầy"); trống với phiên bản tự lưu.
  name text check (name is null or char_length(name) between 1 and 200),
  -- Vì sao app tự lưu ("Trước khi xoá cột Hạn chế").
  reason text check (reason is null or char_length(reason) <= 500),
  kind text not null check (kind in ('tu_dat', 'tu_dong')),
  paper_count integer not null default 0 check (paper_count >= 0),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 8000000),
  created_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists sheet_versions_owner_table on public.sheet_versions (owner_id, table_id, created_at desc);

alter table public.sheet_versions enable row level security;

revoke all on table public.sheet_versions from anon, authenticated;
grant select, insert, delete on table public.sheet_versions to authenticated;
grant all on table public.sheet_versions to service_role;

drop policy if exists "doc phien ban cua minh" on public.sheet_versions;
drop policy if exists "them phien ban cua minh" on public.sheet_versions;
drop policy if exists "xoa phien ban cua minh" on public.sheet_versions;
create policy "doc phien ban cua minh" on public.sheet_versions for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "them phien ban cua minh" on public.sheet_versions for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "xoa phien ban cua minh" on public.sheet_versions for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Trước khi thêm: mỗi người tối đa 300 phiên bản tự đặt tên (để không làm đầy cơ sở dữ liệu).
-- Sau khi thêm: chỉ giữ 30 phiên bản tự lưu mới nhất của mỗi bảng.
-- Đặt ở trigger (không đặt trong chính sách, vì chính sách đếm dòng của chính bảng đó bị Postgres báo vòng lặp 42P17).
-- security invoker: chỉ đếm và xoá được dòng của chính người đó (đi qua RLS).
create or replace function public.gioi_han_phien_ban()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    if new.kind = 'tu_dat' then
      select count(*) into n from public.sheet_versions v where v.owner_id = new.owner_id and v.kind = 'tu_dat';
      if n >= 300 then
        raise exception 'Đã đủ 300 phiên bản tự đặt tên' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;
  -- AFTER INSERT: xoá phiên bản tự lưu cũ hơn 30 bản mới nhất của cùng bảng.
  delete from public.sheet_versions v
  where v.owner_id = new.owner_id
    and v.table_id = new.table_id
    and v.kind = 'tu_dong'
    and v.id not in (
      select k.id from public.sheet_versions k
      where k.owner_id = new.owner_id and k.table_id = new.table_id and k.kind = 'tu_dong'
      order by k.created_at desc, k.id desc
      limit 30
    );
  return null;
end;
$$;

revoke all on function public.gioi_han_phien_ban() from public, anon, authenticated;

drop trigger if exists gioi_han_phien_ban_truoc on public.sheet_versions;
drop trigger if exists gioi_han_phien_ban_sau on public.sheet_versions;
create trigger gioi_han_phien_ban_truoc before insert on public.sheet_versions for each row execute function public.gioi_han_phien_ban();
create trigger gioi_han_phien_ban_sau after insert on public.sheet_versions for each row execute function public.gioi_han_phien_ban();

-- Kiểm tra sau khi chạy (chạy từng câu trong SQL Editor):
-- 1. Đã bật RLS (rls_bat phải là true):
--    select relname as bang, relrowsecurity as rls_bat from pg_class where relname = 'sheet_versions';
-- 2. Đúng ba chính sách, đều so owner_id với auth.uid():
--    select policyname, cmd, qual, with_check from pg_policies where tablename = 'sheet_versions' order by policyname;
-- 3. Người chưa đăng nhập không có quyền gì, người đã đăng nhập không có quyền sửa (update):
--    select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'sheet_versions' order by grantee, privilege_type;
-- Sau đó chạy: npm run test:phan-quyen (có thêm các mục kiểm tra chéo cho sheet_versions).
