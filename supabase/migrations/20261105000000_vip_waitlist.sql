-- VIP waitlist: when a day is fully booked, customers can join it.
-- When a booking is cancelled or marked no-show, the salon is told on WhatsApp
-- who is waiting for that day, so the freed slot goes to them first.

create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  day           date not null,
  customer_name text not null check (char_length(customer_name) between 2 and 60),
  phone         text not null,
  status        text not null default 'waiting' check (status in ('waiting', 'contacted', 'booked', 'removed')),
  created_at    timestamptz not null default now(),
  unique (shop_id, day, phone)
);
create index if not exists waitlist_shop_day_idx on public.waitlist (shop_id, day, created_at);

alter table public.waitlist enable row level security;
drop policy if exists waitlist_admin_all on public.waitlist;
create policy waitlist_admin_all on public.waitlist for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

-- Public entry point: anyone can add themselves; nobody anonymous can read the list.
create or replace function public.join_waitlist(p_shop_slug text, p_day date, p_name text, p_phone text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shop  public.shops;
  v_phone text := public.normalize_iq_phone(p_phone);
  v_name  text := btrim(coalesce(p_name, ''));
  v_pos   int;
begin
  select * into v_shop from public.shops where slug = p_shop_slug;
  if v_shop.id is null then raise exception 'SHOP_NOT_FOUND'; end if;
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then raise exception 'INVALID_NAME'; end if;
  if p_day < (now() at time zone v_shop.timezone)::date
     or p_day > (now() at time zone v_shop.timezone)::date + v_shop.booking_window_days then
    raise exception 'OUTSIDE_WINDOW';
  end if;
  -- simple abuse guard: at most 30 people per day
  if (select count(*) from public.waitlist where shop_id = v_shop.id and day = p_day and status = 'waiting') >= 30 then
    raise exception 'WAITLIST_FULL';
  end if;

  insert into public.waitlist (shop_id, day, customer_name, phone)
  values (v_shop.id, p_day, v_name, v_phone)
  on conflict (shop_id, day, phone) do update set customer_name = excluded.customer_name, status = 'waiting';

  select count(*) into v_pos from public.waitlist w
   where w.shop_id = v_shop.id and w.day = p_day and w.status = 'waiting'
     and w.created_at <= (select created_at from public.waitlist where shop_id = v_shop.id and day = p_day and phone = v_phone);
  return json_build_object('position', v_pos);
end $$;
revoke all on function public.join_waitlist(text, date, text, text) from public;
grant execute on function public.join_waitlist(text, date, text, text) to anon, authenticated;

-- Tell the salon about freed slots + who is waiting for that day.
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
  v_freed boolean := tg_op = 'UPDATE' and new.status in ('cancelled', 'no_show') and old.status is distinct from new.status;
  v_vip text;
begin
  if tg_op = 'INSERT' and new.source <> 'online' then return new; end if;
  if tg_op = 'UPDATE' and not v_freed then return new; end if;
  if to_regnamespace('net') is null then return new; end if;

  select * into s from private.notify_settings where shop_id = new.shop_id and enabled;
  if not found then return new; end if;

  select timezone into v_tz from public.shops where id = new.shop_id;
  select name, phone into v_cus from public.customers where id = new.customer_id;
  select name into v_svc from public.services where id = new.service_id;

  v_msg := case when tg_op = 'INSERT' then '✂️ حجز جديد'
                when new.status = 'no_show' then '⏰ زبون ما اجه'
                else '❌ انلغى حجز' end || E'\n'
        || 'الاسم: ' || v_cus.name || E'\n'
        || 'الرقم: ' || private.local_phone(v_cus.phone) || E'\n'
        || 'الخدمة: ' || v_svc || E'\n'
        || 'الموعد: ' || private.fmt_when(new.starts_at, v_tz) || E'\n'
        || 'السعر: ' || to_char(new.price_iqd, 'FM999,999,999') || ' د.ع' || E'\n'
        || 'الرمز: ' || new.code;

  if v_freed then
    select string_agg(rn || ') ' || customer_name || ' - ' || private.local_phone(phone), E'\n' order by rn)
      into v_vip
      from (select row_number() over (order by created_at) as rn, customer_name, phone
              from public.waitlist
             where shop_id = new.shop_id and status = 'waiting'
               and day = (new.starts_at at time zone v_tz)::date
             limit 5) q;
    if v_vip is not null then
      v_msg := v_msg || E'\n\n⭐ الموعد فرغ! قائمة VIP لهذا اليوم (اتصل بالأول):\n' || v_vip;
    end if;
  end if;

  begin
    execute 'select net.http_get($1)'
      using 'https://api.callmebot.com/whatsapp.php?phone=' || s.phone
            || '&text=' || private.urlencode(v_msg)
            || '&apikey=' || private.urlencode(s.api_key);
  exception when others then
    raise warning 'whatsapp notify failed: %', sqlerrm;
  end;
  return new;
end $$;
revoke all on function private.notify_booking() from public;
