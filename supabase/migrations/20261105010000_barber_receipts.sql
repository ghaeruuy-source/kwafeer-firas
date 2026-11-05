-- =====================================================================
-- وصل الحجز للحلاق: كل حجز أونلاين يوصل للحلاق اللي انحجز عنده كصورة وصل.
-- Booking receipt for the barber: every online booking is sent to the chosen
-- barber as a receipt image (rendered by the site at /api/receipt/<token>).
--
-- Channels (per barber, both optional):
--   • Telegram  — the real picture, sent with sendPhoto. The barber links his
--                 Telegram once by opening his link from the admin "الحلاقين" page.
--   • WhatsApp  — CallMeBot text with the receipt link (CallMeBot can't send pictures).
-- Secrets live in the `private` schema, which the Supabase API does not expose.
-- Sending uses pg_net; any failure is swallowed so a booking never fails.
--
-- Enable once from the SQL editor:
--   insert into private.notify_config (shop_id, site_url, telegram_bot_token, telegram_bot_username)
--   select id, 'https://silly-figolla-98cb16.netlify.app', '<BOT_TOKEN>', '<bot_username>'
--   from public.shops where slug = 'firas-salon'
--   on conflict (shop_id) do update set site_url = excluded.site_url,
--     telegram_bot_token = excluded.telegram_bot_token, telegram_bot_username = excluded.telegram_bot_username;
--   select private.telegram_set_webhook('firas-salon');
-- =====================================================================

create schema if not exists private;

create table if not exists private.notify_config (
  shop_id               uuid primary key references public.shops(id) on delete cascade,
  site_url              text not null check (site_url ~ '^https://[^/]+$'),
  telegram_bot_token    text check (telegram_bot_token ~ '^[0-9]+:[A-Za-z0-9_-]{20,}$'),
  telegram_bot_username text check (telegram_bot_username ~ '^[A-Za-z0-9_]{4,64}$'),
  webhook_secret        text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  updated_at            timestamptz not null default now()
);
alter table private.notify_config enable row level security;

create table if not exists private.barber_notify (
  barber_id        uuid primary key references public.barbers(id) on delete cascade,
  link_token       text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  telegram_chat_id bigint,
  telegram_name    text,
  linked_at        timestamptz,
  wa_phone         text check (wa_phone ~ '^9647[0-9]{9}$'),
  wa_apikey        text check (char_length(wa_apikey) between 3 and 64)
);
alter table private.barber_notify enable row level security;

create table if not exists private.receipts (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  token      text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);
alter table private.receipts enable row level security;

create or replace function private.receipt_token(p_booking_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private
as $$
declare t text;
begin
  insert into private.receipts (booking_id) values (p_booking_id) on conflict (booking_id) do nothing;
  select token into t from private.receipts where booking_id = p_booking_id;
  return t;
end $$;

-- ---------------------------------------------------------------------
-- Public: receipt data for the image route (needs the secret token)
-- ---------------------------------------------------------------------
create or replace function public.get_booking_receipt(p_token text)
returns json
language sql
stable
security definer
set search_path = public, private
as $$
  select json_build_object(
    'code', b.code,
    'status', b.status,
    'source', b.source,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'created_at', b.created_at,
    'price_iqd', b.price_iqd,
    'customer_name', c.name,
    'customer_phone', c.phone,
    'customer_note', b.customer_note,
    'service_name', s.name,
    'duration_minutes', s.duration_minutes,
    'barber_name', br.name,
    'shop_name', sh.name,
    'timezone', sh.timezone,
    'visit_number', (
      select count(*) from public.bookings x
       where x.customer_id = b.customer_id
         and x.status not in ('cancelled', 'no_show')
         and x.starts_at <= b.starts_at
    )
  )
  from private.receipts r
  join public.bookings b on b.id = r.booking_id
  join public.customers c on c.id = b.customer_id
  join public.services s on s.id = b.service_id
  join public.barbers br on br.id = b.barber_id
  join public.shops sh on sh.id = b.shop_id
  where r.token = p_token and char_length(p_token) = 32
$$;
revoke all on function public.get_booking_receipt(text) from public;
grant execute on function public.get_booking_receipt(text) to anon, authenticated;

-- Admin: receipt token for any booking of their shop (for the "صورة الوصل" button).
create or replace function public.admin_receipt_token(p_booking_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare v_shop uuid;
begin
  select shop_id into v_shop from public.bookings where id = p_booking_id;
  if v_shop is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not public.is_shop_admin(v_shop) then raise exception 'FORBIDDEN'; end if;
  return private.receipt_token(p_booking_id);
end $$;
revoke all on function public.admin_receipt_token(uuid) from public;
grant execute on function public.admin_receipt_token(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Admin: each barber's notification status + Telegram link
-- ---------------------------------------------------------------------
create or replace function public.admin_barber_notify(p_shop_id uuid)
returns table (barber_id uuid, telegram_link text, telegram_linked boolean, telegram_name text, whatsapp_on boolean)
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare v_bot text;
begin
  if not public.is_shop_admin(p_shop_id) then raise exception 'FORBIDDEN'; end if;
  insert into private.barber_notify (barber_id)
    select id from public.barbers where shop_id = p_shop_id
    on conflict (barber_id) do nothing;
  select telegram_bot_username into v_bot from private.notify_config where shop_id = p_shop_id;
  return query
    select n.barber_id,
           case when v_bot is null then null else 'https://t.me/' || v_bot || '?start=' || n.link_token end,
           n.telegram_chat_id is not null,
           n.telegram_name,
           n.wa_apikey is not null and n.wa_phone is not null
      from private.barber_notify n
      join public.barbers b on b.id = n.barber_id
     where b.shop_id = p_shop_id;
end $$;
revoke all on function public.admin_barber_notify(uuid) from public;
grant execute on function public.admin_barber_notify(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Telegram webhook: "/start <link_token>" links that chat to the barber.
-- Called by the site's webhook route with Telegram's secret header.
-- ---------------------------------------------------------------------
create or replace function public.telegram_link_barber(p_secret text, p_link_token text, p_chat_id bigint, p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = public, private
as $$
declare v_name text;
begin
  if p_secret is null or not exists (select 1 from private.notify_config where webhook_secret = p_secret) then
    raise exception 'FORBIDDEN';
  end if;
  update private.barber_notify n
     set telegram_chat_id = p_chat_id, telegram_name = left(p_name, 80), linked_at = now()
   where n.link_token = p_link_token
     and n.barber_id in (select b.id from public.barbers b
                          join private.notify_config c on c.shop_id = b.shop_id
                         where c.webhook_secret = p_secret)
  returning (select name from public.barbers where id = n.barber_id) into v_name;
  return v_name;
end $$;
revoke all on function public.telegram_link_barber(text, text, bigint, text) from public;
grant execute on function public.telegram_link_barber(text, text, bigint, text) to anon, authenticated;

-- Registers the site's webhook with Telegram (run once after setting the bot token).
create or replace function private.telegram_set_webhook(p_shop_slug text)
returns bigint
language plpgsql
security definer
set search_path = public, private
as $$
declare c private.notify_config%rowtype;
begin
  select n.* into c from private.notify_config n join public.shops s on s.id = n.shop_id where s.slug = p_shop_slug;
  if c.telegram_bot_token is null then raise exception 'NO_BOT_TOKEN'; end if;
  return net.http_post(
    url := 'https://api.telegram.org/bot' || c.telegram_bot_token || '/setWebhook',
    body := jsonb_build_object('url', c.site_url || '/api/telegram', 'secret_token', c.webhook_secret,
                               'allowed_updates', jsonb_build_array('message'))
  );
end $$;

-- ---------------------------------------------------------------------
-- The trigger: send the receipt to the booking's barber
-- ---------------------------------------------------------------------
create or replace function private.notify_barber_receipt()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  cfg   private.notify_config%rowtype;
  bn    private.barber_notify%rowtype;
  v_tz  text;
  v_cus record;
  v_svc text;
  v_url text;
  v_txt text;
  v_new boolean := tg_op = 'INSERT';
begin
  if v_new and new.source <> 'online' then return new; end if;
  if not v_new and not (new.status = 'cancelled' and old.status is distinct from 'cancelled') then return new; end if;
  if to_regnamespace('net') is null then return new; end if;

  select * into cfg from private.notify_config where shop_id = new.shop_id;
  if not found then return new; end if;
  select * into bn from private.barber_notify where barber_id = new.barber_id;
  if not found or (bn.telegram_chat_id is null and bn.wa_apikey is null) then return new; end if;

  begin
    select timezone into v_tz from public.shops where id = new.shop_id;
    select name, phone into v_cus from public.customers where id = new.customer_id;
    select name into v_svc from public.services where id = new.service_id;
    v_url := cfg.site_url || '/api/receipt/' || private.receipt_token(new.id);

    if v_new then
      v_txt := '✂️ حجز جديد: ' || v_cus.name || ' — ' || v_svc || E'\n' || private.fmt_when(new.starts_at, v_tz)
            || E'\n' || 'رقم الزبون: ' || private.local_phone(v_cus.phone);
    else
      v_txt := '❌ انلغى الحجز: ' || v_cus.name || ' — ' || v_svc || E'\n' || private.fmt_when(new.starts_at, v_tz)
            || E'\n' || 'الرمز: ' || new.code;
    end if;

    if bn.telegram_chat_id is not null and cfg.telegram_bot_token is not null then
      if v_new then
        perform net.http_post(
          url := 'https://api.telegram.org/bot' || cfg.telegram_bot_token || '/sendPhoto',
          body := jsonb_build_object('chat_id', bn.telegram_chat_id, 'photo', v_url || '?v=' || extract(epoch from now())::bigint,
                                     'caption', v_txt)
        );
      else
        perform net.http_post(
          url := 'https://api.telegram.org/bot' || cfg.telegram_bot_token || '/sendMessage',
          body := jsonb_build_object('chat_id', bn.telegram_chat_id, 'text', v_txt)
        );
      end if;
    end if;

    if bn.wa_apikey is not null and bn.wa_phone is not null then
      perform net.http_get(
        'https://api.callmebot.com/whatsapp.php?phone=' || bn.wa_phone
        || '&text=' || private.urlencode(v_txt || case when v_new then E'\n' || '🧾 الوصل: ' || v_url else '' end)
        || '&apikey=' || private.urlencode(bn.wa_apikey)
      );
    end if;
  exception when others then
    raise warning 'barber receipt notify failed: %', sqlerrm;  -- never block the booking
  end;
  return new;
end $$;
revoke all on function private.notify_barber_receipt() from public;

drop trigger if exists trg_bookings_barber_receipt_ins on public.bookings;
create trigger trg_bookings_barber_receipt_ins after insert on public.bookings
  for each row execute function private.notify_barber_receipt();
drop trigger if exists trg_bookings_barber_receipt_upd on public.bookings;
create trigger trg_bookings_barber_receipt_upd after update of status on public.bookings
  for each row execute function private.notify_barber_receipt();
