-- =====================================================================
-- إشعار واتساب تلقائي للصالون عند كل حجز جديد أو إلغاء
-- Automatic WhatsApp notification to the shop on new / cancelled bookings.
--
-- Provider: CallMeBot (free, sends WhatsApp messages to the owner's own number).
-- The API key lives in the `private` schema, which is NOT exposed through the
-- Supabase API, so neither customers nor the frontend can ever read it.
-- Sending uses pg_net (async HTTP). If pg_net or the key is missing, nothing
-- is sent and the booking still succeeds.
--
-- Enable it once from the SQL editor:
--   insert into private.notify_settings (shop_id, phone, api_key)
--   select id, '9647806551240', '<CALLMEBOT_APIKEY>' from public.shops where slug = 'firas-salon'
--   on conflict (shop_id) do update set phone = excluded.phone, api_key = excluded.api_key, enabled = true;
-- =====================================================================

do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available; WhatsApp notifications disabled';
end $$;

create schema if not exists private;
revoke all on schema private from public;
do $$ begin
  revoke all on schema private from anon, authenticated;
exception when undefined_object then null; end $$;

create table if not exists private.notify_settings (
  shop_id    uuid primary key references public.shops(id) on delete cascade,
  phone      text not null check (phone ~ '^9647[0-9]{9}$'),
  api_key    text not null check (char_length(api_key) between 3 and 64),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table private.notify_settings enable row level security;

-- Percent-encodes UTF-8 text for a URL query value.
create or replace function private.urlencode(p text)
returns text
language plpgsql
immutable
strict
as $$
declare
  b bytea := convert_to(p, 'UTF8');
  out text := '';
  i int;
  c int;
begin
  for i in 0 .. length(b) - 1 loop
    c := get_byte(b, i);
    if (c between 48 and 57) or (c between 65 and 90) or (c between 97 and 122) or c in (45, 46, 95, 126) then
      out := out || chr(c);
    else
      out := out || '%' || upper(lpad(to_hex(c), 2, '0'));
    end if;
  end loop;
  return out;
end $$;

-- "الأحد 8/11 الساعة 6:00 م" in the shop's timezone.
create or replace function private.fmt_when(p_at timestamptz, p_tz text)
returns text
language plpgsql
stable
as $$
declare
  l timestamp := p_at at time zone p_tz;
  days text[] := array['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  h int := extract(hour from l);
  h12 int := case when h % 12 = 0 then 12 else h % 12 end;
  suffix text := case when h = 0 then 'بالليل' when h < 12 then 'ص' else 'م' end;
begin
  return days[extract(dow from l)::int + 1] || ' ' || extract(day from l)::int || '/' || extract(month from l)::int
         || ' الساعة ' || h12 || ':' || to_char(l, 'MI') || ' ' || suffix;
end $$;

create or replace function private.local_phone(p text)
returns text language sql immutable as $$ select '0' || substr(p, 4) $$;

create or replace function private.notify_booking()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  s     private.notify_settings%rowtype;
  v_tz  text;
  v_cus record;
  v_svc text;
  v_msg text;
begin
  -- Only customer-facing events: a new online booking, or any cancellation.
  if tg_op = 'INSERT' and new.source <> 'online' then return new; end if;
  if tg_op = 'UPDATE' and not (new.status = 'cancelled' and old.status is distinct from 'cancelled') then return new; end if;
  if to_regnamespace('net') is null then return new; end if;

  select * into s from private.notify_settings where shop_id = new.shop_id and enabled;
  if not found then return new; end if;

  select timezone into v_tz from public.shops where id = new.shop_id;
  select name, phone into v_cus from public.customers where id = new.customer_id;
  select name into v_svc from public.services where id = new.service_id;

  v_msg := case when tg_op = 'INSERT' then '✂️ حجز جديد' else '❌ انلغى حجز' end || E'\n'
        || 'الاسم: ' || v_cus.name || E'\n'
        || 'الرقم: ' || private.local_phone(v_cus.phone) || E'\n'
        || 'الخدمة: ' || v_svc || E'\n'
        || 'الموعد: ' || private.fmt_when(new.starts_at, v_tz) || E'\n'
        || 'السعر: ' || to_char(new.price_iqd, 'FM999,999,999') || ' د.ع' || E'\n'
        || 'الرمز: ' || new.code;

  begin
    execute 'select net.http_get($1)'
      using 'https://api.callmebot.com/whatsapp.php?phone=' || s.phone
            || '&text=' || private.urlencode(v_msg)
            || '&apikey=' || private.urlencode(s.api_key);
  exception when others then
    raise warning 'whatsapp notify failed: %', sqlerrm;  -- never block the booking
  end;
  return new;
end $$;
revoke all on function private.notify_booking() from public;

drop trigger if exists trg_bookings_notify_ins on public.bookings;
create trigger trg_bookings_notify_ins after insert on public.bookings
  for each row execute function private.notify_booking();
drop trigger if exists trg_bookings_notify_upd on public.bookings;
create trigger trg_bookings_notify_upd after update of status on public.bookings
  for each row execute function private.notify_booking();
