-- Lưu bảng, bài và thao tác của sinh viên trên Supabase (xem src/lib/cloud-sync.ts, src/lib/events.ts).
-- Chạy trong SQL Editor của Supabase, sau file gioi-han-goi-ai.sql. Chạy lại cũng không sao.
--
-- Ai được làm gì:
-- - Mỗi người dùng (kể cả đăng nhập ẩn danh) chỉ đọc, thêm, sửa, xoá được dòng của chính mình
--   (owner_id = auth.uid()). Chỉ kiểm tra vai trò authenticated là chưa đủ, vì người dùng ẩn danh cũng có vai trò này.
-- - Người chưa đăng nhập (anon) không dùng được bảng nào.
-- - Thao tác (app_events) chỉ thêm và đọc được của mình, không sửa, không xoá.
-- - Trang /metrics đọc số liệu tổng qua hàm metrics_counts, chỉ khoá bí mật của máy chủ gọi được.
-- - File PDF không bao giờ được gửi lên đây: file chỉ nằm trong trình duyệt của sinh viên.

-- 1. Bảng tổng hợp. Cột, nhãn của bảng nằm trong columns, tags (giống kiểu SheetTable trong src/lib/types.ts).
create table if not exists public.sheet_tables (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 200),
  position integer not null default 0,
  name text not null check (char_length(name) between 1 and 500),
  description text,
  columns jsonb not null default '[]'::jsonb check (jsonb_typeof(columns) = 'array'),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  check (pg_column_size(columns) + pg_column_size(tags) < 500000)
);

-- 2. Bài đã lưu vào bảng. data là cả bài (kiểu SavedPaper): thông tin bài, các ô kèm câu trích, số trang, nhãn kiểm tra,
-- định dạng, tô sáng, ghi chú. title chép ra riêng để dễ đọc khi xem trong Supabase.
create table if not exists public.sheet_papers (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  table_id text not null,
  id text not null check (char_length(id) between 1 and 200),
  position integer not null default 0,
  title text not null default '',
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2000000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, table_id, id),
  foreign key (owner_id, table_id) references public.sheet_tables (owner_id, id) on delete cascade
);

-- 3. Thao tác để đo hiệu quả (tải bài, ô giữ nguyên, ô bị sửa, ô cần kiểm tra, bấm lưu, dùng model dự phòng).
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event text not null check (event in ('tai_bai', 'dung_model_du_phong', 'o_giu_nguyen', 'o_bi_sua', 'o_can_kiem_tra', 'bam_luu_vao_bang')),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) < 4000),
  created_at timestamptz not null default now()
);
create index if not exists app_events_owner_created on public.app_events (owner_id, created_at);
create index if not exists app_events_created on public.app_events (created_at);

-- Bật RLS cho cả ba bảng.
alter table public.sheet_tables enable row level security;
alter table public.sheet_papers enable row level security;
alter table public.app_events enable row level security;

-- Quyền theo vai trò: anon không có gì; authenticated chỉ có những gì cần; service_role cho máy chủ.
revoke all on table public.sheet_tables from anon, authenticated;
revoke all on table public.sheet_papers from anon, authenticated;
revoke all on table public.app_events from anon, authenticated;
grant select, insert, update, delete on table public.sheet_tables to authenticated;
grant select, insert, update, delete on table public.sheet_papers to authenticated;
grant select, insert on table public.app_events to authenticated;
grant all on table public.sheet_tables, public.sheet_papers, public.app_events to service_role;

-- Chính sách: luôn so owner_id với auth.uid(). Sửa thì có cả using và with check để không ai đổi dòng sang tên người khác.
drop policy if exists "doc bang cua minh" on public.sheet_tables;
drop policy if exists "them bang cua minh" on public.sheet_tables;
drop policy if exists "sua bang cua minh" on public.sheet_tables;
drop policy if exists "xoa bang cua minh" on public.sheet_tables;
create policy "doc bang cua minh" on public.sheet_tables for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "them bang cua minh" on public.sheet_tables for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "sua bang cua minh" on public.sheet_tables for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "xoa bang cua minh" on public.sheet_tables for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "doc bai cua minh" on public.sheet_papers;
drop policy if exists "them bai cua minh" on public.sheet_papers;
drop policy if exists "sua bai cua minh" on public.sheet_papers;
drop policy if exists "xoa bai cua minh" on public.sheet_papers;
create policy "doc bai cua minh" on public.sheet_papers for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "them bai cua minh" on public.sheet_papers for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "sua bai cua minh" on public.sheet_papers for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "xoa bai cua minh" on public.sheet_papers for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "doc thao tac cua minh" on public.app_events;
drop policy if exists "ghi thao tac cua minh" on public.app_events;
create policy "doc thao tac cua minh" on public.app_events for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "ghi thao tac cua minh" on public.app_events for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- Giới hạn số dòng mỗi người, để một người không làm đầy cơ sở dữ liệu: tối đa 200 bảng, 5000 bài,
-- 3000 thao tác trong 24 giờ (một bài có khoảng 10 đến 20 thao tác).
-- Đặt ở trigger, không đặt trong chính sách: chính sách đếm dòng của chính bảng đó sẽ bị Postgres báo vòng lặp (42P17).
-- security invoker: phép đếm vẫn đi qua RLS nên chỉ thấy dòng của chính người đó.
create or replace function public.gioi_han_so_dong()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if tg_table_name = 'sheet_tables' then
    -- Sửa bảng đã có (upsert) thì không tính là thêm.
    if exists (select 1 from public.sheet_tables t where t.owner_id = new.owner_id and t.id = new.id) then
      return new;
    end if;
    select count(*) into n from public.sheet_tables t where t.owner_id = new.owner_id;
    if n >= 200 then
      raise exception 'Đã đủ 200 bảng' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'sheet_papers' then
    if exists (select 1 from public.sheet_papers p where p.owner_id = new.owner_id and p.table_id = new.table_id and p.id = new.id) then
      return new;
    end if;
    select count(*) into n from public.sheet_papers p where p.owner_id = new.owner_id;
    if n >= 5000 then
      raise exception 'Đã đủ 5000 bài' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'app_events' then
    select count(*) into n from public.app_events e where e.owner_id = new.owner_id and e.created_at > now() - interval '24 hours';
    if n >= 3000 then
      raise exception 'Quá nhiều thao tác trong 24 giờ' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.gioi_han_so_dong() from public, anon, authenticated;

drop trigger if exists gioi_han_so_dong on public.sheet_tables;
drop trigger if exists gioi_han_so_dong on public.sheet_papers;
drop trigger if exists gioi_han_so_dong on public.app_events;
create trigger gioi_han_so_dong before insert on public.sheet_tables for each row execute function public.gioi_han_so_dong();
create trigger gioi_han_so_dong before insert on public.sheet_papers for each row execute function public.gioi_han_so_dong();
create trigger gioi_han_so_dong before insert on public.app_events for each row execute function public.gioi_han_so_dong();

-- 4. Số liệu cho trang /metrics: đếm thao tác theo loại, không trả về mã người dùng hay nội dung ô.
-- Dòng có event rỗng (null) là dòng tổng: so_nguoi của dòng này là số người dùng khác nhau trong khoảng thời gian.
create or replace function public.metrics_counts(p_from timestamptz, p_to timestamptz)
returns table (event text, noi text, cach text, loai text, du_phong text, so_lan bigint, so_nguoi bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select x.event, x.noi, x.cach, x.loai, x.du_phong, count(*) as so_lan, count(distinct x.owner_id) as so_nguoi
  from (
    select
      e.event,
      coalesce(e.detail ->> 'noi', '') as noi,
      coalesce(e.detail ->> 'cach', '') as cach,
      case when e.detail ->> 'cot' like 'info-%' then 'thong_tin' else 'noi_dung' end as loai,
      coalesce(e.detail ->> 'du_phong', '') as du_phong,
      e.owner_id
    from public.app_events e
    where e.created_at >= p_from and e.created_at < p_to
  ) x
  group by grouping sets ((x.event, x.noi, x.cach, x.loai, x.du_phong), ());
$$;

revoke all on function public.metrics_counts(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.metrics_counts(timestamptz, timestamptz) to service_role;

-- Kiểm tra: mọi bảng trong schema public đều phải có rls_bat = true.
-- select c.relname as bang, c.relrowsecurity as rls_bat
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1;
