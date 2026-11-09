-- Đếm lượt gửi bài cho AI mỗi ngày, theo từng người dùng và cho cả app (xem src/lib/ai-limit.ts).
-- Chạy một lần trong SQL Editor của Supabase. Chạy lại cũng không sao (dùng "if not exists", "or replace").
--
-- Ai được làm gì:
-- - Người dùng (anon, authenticated, kể cả người dùng ẩn danh) không đọc, không ghi được hai bảng này
--   và không gọi được hai hàm này. Họ không tự sửa được số đếm của mình hay của người khác.
-- - Chỉ máy chủ của app, dùng khoá bí mật (vai trò service_role), mới gọi được hàm claim_ai_call và release_ai_call.

-- Số bài mỗi người đã gửi trong ngày (ngày theo giờ Việt Nam).
create table if not exists public.ai_usage_user (
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  count integer not null default 0 check (count >= 0),
  primary key (day, user_id)
);

-- Tổng số bài cả app đã gửi trong ngày.
create table if not exists public.ai_usage_total (
  day date primary key,
  count integer not null default 0 check (count >= 0)
);

-- Bật RLS và không tạo chính sách nào: anon và authenticated không thấy dòng nào.
alter table public.ai_usage_user enable row level security;
alter table public.ai_usage_total enable row level security;

-- Dự án cũ có thể đã tự cấp quyền cho mọi bảng mới: thu lại. Chỉ service_role được dùng.
revoke all on table public.ai_usage_user from anon, authenticated;
revoke all on table public.ai_usage_total from anon, authenticated;
grant select, insert, update on table public.ai_usage_user to service_role;
grant select, insert, update on table public.ai_usage_total to service_role;

-- Kiểm tra và cộng lượt trong một bước. Khoá dòng của ngày (for update) để hai yêu cầu đến cùng lúc
-- không cùng lọt qua giới hạn. Luôn khoá theo thứ tự: tổng của app trước, của người dùng sau.
-- Trả về 'ok' (đã cộng một lượt), 'user' (người này hết lượt), 'total' (cả app hết lượt).
create or replace function public.claim_ai_call(p_user uuid, p_day date, p_user_limit integer, p_total_limit integer)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_user integer;
begin
  insert into public.ai_usage_total (day, count) values (p_day, 0) on conflict (day) do nothing;
  select count into v_total from public.ai_usage_total where day = p_day for update;

  insert into public.ai_usage_user (day, user_id, count) values (p_day, p_user, 0) on conflict (day, user_id) do nothing;
  select count into v_user from public.ai_usage_user where day = p_day and user_id = p_user for update;

  if v_user >= p_user_limit then
    return 'user';
  end if;
  if v_total >= p_total_limit then
    return 'total';
  end if;

  update public.ai_usage_total set count = count + 1 where day = p_day;
  update public.ai_usage_user set count = count + 1 where day = p_day and user_id = p_user;
  return 'ok';
end;
$$;

-- Trả lại một lượt khi máy chủ chưa gọi AI lần nào (ví dụ bài quá dài).
create or replace function public.release_ai_call(p_user uuid, p_day date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.ai_usage_total set count = greatest(count - 1, 0) where day = p_day;
  update public.ai_usage_user set count = greatest(count - 1, 0) where day = p_day and user_id = p_user;
end;
$$;

-- Hàm mới mặc định ai cũng gọi được (PUBLIC): thu lại, chỉ cho service_role.
revoke all on function public.claim_ai_call(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function public.release_ai_call(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_ai_call(uuid, date, integer, integer) to service_role;
grant execute on function public.release_ai_call(uuid, date) to service_role;
