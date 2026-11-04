-- =====================================================================
-- نظام حجوزات صالون الحلاقة — المخطط الأساسي
-- Barber booking system — initial schema
-- Timezone logic: all timestamps are timestamptz; local wall-clock logic
-- uses shops.timezone (default Asia/Baghdad).
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------
do $$ begin
  create type public.booking_status as enum ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_source as enum ('online', 'admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Normalises Iraqi mobile numbers to 9647XXXXXXXXX. Returns null when invalid.
create or replace function public.normalize_iq_phone(p text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  -- Arabic-Indic digits are converted by the app before reaching here.
  if d like '00964%' then d := substr(d, 3); end if;
  if d like '9640%' then d := '964' || substr(d, 5); end if;
  if d like '07%' and length(d) = 11 then d := '964' || substr(d, 2); end if;
  if d like '7%' and length(d) = 10 then d := '964' || d; end if;
  if d ~ '^9647[0-9]{9}$' then return d; end if;
  return null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.shops (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name                   text not null check (char_length(btrim(name)) between 2 and 80),
  tagline                text check (char_length(tagline) <= 160),
  about                  text check (char_length(about) <= 1000),
  logo_url               text check (char_length(logo_url) <= 500),
  cover_url              text check (char_length(cover_url) <= 500),
  phone                  text check (phone is null or phone ~ '^9647[0-9]{9}$'),
  whatsapp               text check (whatsapp is null or whatsapp ~ '^9647[0-9]{9}$'),
  instagram              text check (char_length(instagram) <= 60),
  address                text check (char_length(address) <= 200),
  maps_url               text check (char_length(maps_url) <= 500),
  timezone               text not null default 'Asia/Baghdad',
  slot_interval_minutes  int  not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  booking_window_days    int  not null default 30 check (booking_window_days between 1 and 180),
  min_notice_minutes     int  not null default 30 check (min_notice_minutes between 0 and 1440),
  max_active_per_customer int not null default 2 check (max_active_per_customer between 1 and 10),
  auto_confirm           boolean not null default false,
  -- true: times follow each other by service length (10:00, 10:30, 11:00…) and pick up right
  -- after existing bookings, so the day fills without gaps. false: fixed grid every slot_interval_minutes.
  sequential_slots       boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists public.shop_admins (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists shop_admins_user_idx on public.shop_admins (user_id);

create table if not exists public.barbers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 60),
  title       text check (char_length(title) <= 60),
  photo_url   text check (char_length(photo_url) <= 500),
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (shop_id, id)
);
create index if not exists barbers_shop_idx on public.barbers (shop_id, sort_order);

create table if not exists public.services (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops(id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 2 and 80),
  description       text check (char_length(description) <= 300),
  price_iqd         int  not null check (price_iqd between 0 and 10000000),
  duration_minutes  int  not null check (duration_minutes between 5 and 480),
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shop_id, id)
);
create index if not exists services_shop_idx on public.services (shop_id, sort_order);

-- weekday: 0 = الأحد (Sunday) … 6 = السبت (Saturday), same as extract(dow)
create table if not exists public.working_hours (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),
  is_open      boolean not null default true,
  open_time    time not null default '16:00',
  close_time   time not null default '24:00',
  break_start  time,
  break_end    time,
  unique (shop_id, weekday),
  check (open_time < close_time),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_start < break_end and break_start >= open_time and break_end <= close_time))
);

-- Holidays, vacations, ad-hoc breaks. barber_id null = whole shop closed.
create table if not exists public.blocked_times (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  barber_id   uuid,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text check (char_length(reason) <= 120),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (shop_id, barber_id) references public.barbers (shop_id, id) on delete cascade
);
create index if not exists blocked_times_range_idx on public.blocked_times using gist (shop_id, tstzrange(starts_at, ends_at, '[)'));

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 60),
  phone       text not null check (phone ~ '^9647[0-9]{9}$'),
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (shop_id, phone),
  unique (shop_id, id)
);
create index if not exists customers_name_idx on public.customers (shop_id, name);

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops(id) on delete cascade,
  customer_id    uuid not null,
  service_id     uuid not null,
  barber_id      uuid not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         public.booking_status not null default 'pending',
  price_iqd      int not null check (price_iqd >= 0),
  code           text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  customer_note  text check (char_length(customer_note) <= 300),
  admin_note     text check (char_length(admin_note) <= 500),
  source         public.booking_source not null default 'online',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (shop_id, customer_id) references public.customers (shop_id, id) on delete cascade,
  foreign key (shop_id, service_id)  references public.services  (shop_id, id) on delete restrict,
  foreign key (shop_id, barber_id)   references public.barbers   (shop_id, id) on delete restrict,
  -- The core guarantee: one barber can never have two overlapping live bookings,
  -- even under concurrent requests (enforced by the database, not the app).
  constraint bookings_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'completed'))
);
create index if not exists bookings_shop_start_idx on public.bookings (shop_id, starts_at);
create index if not exists bookings_customer_idx on public.bookings (customer_id, starts_at desc);
create index if not exists bookings_status_idx on public.bookings (shop_id, status);

drop trigger if exists trg_shops_updated on public.shops;
create trigger trg_shops_updated before update on public.shops for each row execute function public.set_updated_at();
drop trigger if exists trg_barbers_updated on public.barbers;
create trigger trg_barbers_updated before update on public.barbers for each row execute function public.set_updated_at();
drop trigger if exists trg_services_updated on public.services;
create trigger trg_services_updated before update on public.services for each row execute function public.set_updated_at();
drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists trg_bookings_updated on public.bookings;
create trigger trg_bookings_updated before update on public.bookings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Authorisation helper
-- ---------------------------------------------------------------------
create or replace function public.is_shop_admin(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_admins
    where shop_id = p_shop_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Slot validation (used by trigger, so every write path is checked)
-- Raises errors with stable codes the app maps to Arabic messages.
-- ---------------------------------------------------------------------
create or replace function public.assert_slot_valid(
  p_shop_id uuid, p_barber_id uuid, p_starts timestamptz, p_ends timestamptz, p_exclude_booking uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_wh public.working_hours;
begin
  select timezone into v_tz from public.shops where id = p_shop_id;
  if v_tz is null then raise exception 'SHOP_NOT_FOUND'; end if;

  if not exists (select 1 from public.barbers where id = p_barber_id and shop_id = p_shop_id and is_active) then
    raise exception 'BARBER_UNAVAILABLE';
  end if;

  v_local_start := p_starts at time zone v_tz;
  v_local_end   := p_ends at time zone v_tz;

  if v_local_start::date <> (v_local_end - interval '1 microsecond')::date then
    raise exception 'OUTSIDE_HOURS';
  end if;

  select * into v_wh from public.working_hours
   where shop_id = p_shop_id and weekday = extract(dow from v_local_start)::int;

  if v_wh.id is null or not v_wh.is_open
     or v_local_start::time < v_wh.open_time
     or (v_local_end::time > v_wh.close_time and v_local_end::time <> '00:00')
     or (v_local_end::time = '00:00' and v_wh.close_time <> '23:59:59' and v_wh.close_time <> '24:00') then
    raise exception 'OUTSIDE_HOURS';
  end if;

  if v_wh.break_start is not null
     and v_local_start::time < v_wh.break_end
     and v_local_end::time > v_wh.break_start then
    raise exception 'DURING_BREAK';
  end if;

  if exists (
    select 1 from public.blocked_times bt
    where bt.shop_id = p_shop_id
      and (bt.barber_id is null or bt.barber_id = p_barber_id)
      and tstzrange(bt.starts_at, bt.ends_at, '[)') && tstzrange(p_starts, p_ends, '[)')
  ) then
    raise exception 'BLOCKED_TIME';
  end if;
end $$;

create or replace function public.bookings_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('pending', 'confirmed') and (
       tg_op = 'INSERT'
       or new.starts_at is distinct from old.starts_at
       or new.ends_at   is distinct from old.ends_at
       or new.barber_id is distinct from old.barber_id
       or old.status in ('cancelled', 'no_show')
     ) then
    perform public.assert_slot_valid(new.shop_id, new.barber_id, new.starts_at, new.ends_at, new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_bookings_validate on public.bookings;
create trigger trg_bookings_validate
  before insert or update on public.bookings
  for each row execute function public.bookings_validate();

-- ---------------------------------------------------------------------
-- Random booking code (no 0/O/1/I to avoid confusion)
-- ---------------------------------------------------------------------
create or replace function public.gen_booking_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end $$;

-- ---------------------------------------------------------------------
-- Public: available slots
-- ---------------------------------------------------------------------
-- Returns the day's bookable times. Times on the regular chain that are already
-- taken come back with available = false, so the customer sees them greyed out.
drop function if exists public.get_available_slots(text, uuid, date, uuid);
create function public.get_available_slots(
  p_shop_slug text, p_service_id uuid, p_date date, p_barber_id uuid default null
)
returns table (slot_start timestamptz, barber_ids uuid[], available boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop public.shops;
  v_service public.services;
  v_wh public.working_hours;
  v_today date;
  v_dur interval;
  v_step interval;
begin
  select * into v_shop from public.shops where slug = p_shop_slug;
  if v_shop.id is null then raise exception 'SHOP_NOT_FOUND'; end if;

  select * into v_service from public.services
   where id = p_service_id and shop_id = v_shop.id and is_active;
  if v_service.id is null then raise exception 'SERVICE_UNAVAILABLE'; end if;

  v_today := (now() at time zone v_shop.timezone)::date;
  if p_date < v_today or p_date > v_today + v_shop.booking_window_days then
    return;
  end if;

  select * into v_wh from public.working_hours
   where shop_id = v_shop.id and weekday = extract(dow from p_date)::int;
  if v_wh.id is null or not v_wh.is_open then return; end if;

  v_dur  := make_interval(mins => v_service.duration_minutes);
  v_step := make_interval(mins => v_shop.slot_interval_minutes);

  return query
  with starts as (
    -- the regular chain from opening time
    select lt, true as main from generate_series(p_date + v_wh.open_time, p_date + v_wh.close_time - v_dur,
                                   case when v_shop.sequential_slots then v_dur else v_step end) lt
    where not v_shop.sequential_slots or v_wh.break_start is null or lt < p_date + v_wh.break_start
    union all
    -- sequential mode: a fresh chain right after the break …
    select lt, true from generate_series(p_date + coalesce(v_wh.break_end, v_wh.close_time), p_date + v_wh.close_time - v_dur, v_dur) lt
    where v_shop.sequential_slots and v_wh.break_end is not null
    union all
    -- … and right after every booking or closed period that ends this day, so there are no gaps
    select lt, false from (
      select bk.ends_at as e from public.bookings bk
      where bk.shop_id = v_shop.id and bk.status in ('pending', 'confirmed', 'completed')
        and (bk.ends_at at time zone v_shop.timezone)::date = p_date
      union
      select bt.ends_at from public.blocked_times bt
      where bt.shop_id = v_shop.id and (bt.ends_at at time zone v_shop.timezone)::date = p_date
    ) ends
    cross join lateral generate_series(ends.e at time zone v_shop.timezone, p_date + v_wh.close_time - v_dur, v_dur) lt
    where v_shop.sequential_slots
      and ends.e at time zone v_shop.timezone > p_date + v_wh.open_time
      -- a chain that starts before the break stops at the break (a new one starts after it)
      and (v_wh.break_start is null
           or ends.e at time zone v_shop.timezone >= p_date + v_wh.break_end
           or lt < p_date + v_wh.break_start)
  ),
  candidates as (
    select (lt at time zone v_shop.timezone) as s, bool_or(main) as main
    from starts
    where lt >= p_date + v_wh.open_time
      and lt + v_dur <= p_date + v_wh.close_time
      and (v_wh.break_start is null
           or not (lt < p_date + v_wh.break_end and lt + v_dur > p_date + v_wh.break_start))
      -- a shop-wide closure hides the time completely (it is closed, not booked)
      and not exists (
        select 1 from public.blocked_times bt
        where bt.shop_id = v_shop.id and bt.barber_id is null
          and tstzrange(bt.starts_at, bt.ends_at, '[)')
              && tstzrange(lt at time zone v_shop.timezone, (lt + v_dur) at time zone v_shop.timezone, '[)')
      )
    group by 1
  ),
  barbers_ok as (
    select b.id from public.barbers b
    where b.shop_id = v_shop.id and b.is_active
      and (p_barber_id is null or b.id = p_barber_id)
  ),
  free as (
    select c.s, array_agg(b.id order by b.id) as ids
    from candidates c
    cross join barbers_ok b
    where not exists (
        select 1 from public.bookings bk
        where bk.barber_id = b.id
          and bk.status in ('pending', 'confirmed', 'completed')
          and tstzrange(bk.starts_at, bk.ends_at, '[)') && tstzrange(c.s, c.s + v_dur, '[)')
      )
      and not exists (
        select 1 from public.blocked_times bt
        where bt.shop_id = v_shop.id
          and (bt.barber_id is null or bt.barber_id = b.id)
          and tstzrange(bt.starts_at, bt.ends_at, '[)') && tstzrange(c.s, c.s + v_dur, '[)')
      )
    group by c.s
  )
  select c.s, coalesce(f.ids, '{}'::uuid[]), f.s is not null
  from candidates c
  left join free f on f.s = c.s
  where c.s >= now() + make_interval(mins => v_shop.min_notice_minutes)
    and exists (select 1 from barbers_ok)
    and (f.s is not null or c.main)
  order by c.s;
end $$;

-- ---------------------------------------------------------------------
-- Internal: insert a booking for a given (or any free) barber. Atomic.
-- ---------------------------------------------------------------------
create or replace function public._insert_booking(
  p_shop public.shops, p_service public.services, p_barber_id uuid, p_starts timestamptz,
  p_name text, p_phone text, p_note text, p_status public.booking_status,
  p_source public.booking_source, p_admin_note text
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_iq_phone(p_phone);
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_ends timestamptz := p_starts + make_interval(mins => p_service.duration_minutes);
  v_customer_id uuid;
  v_booking public.bookings;
  v_barber uuid;
  v_code text;
  v_attempt int;
  v_last_error text := 'SLOT_TAKEN';
begin
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then raise exception 'INVALID_NAME'; end if;
  if p_note is not null and char_length(p_note) > 300 then raise exception 'INVALID_NOTE'; end if;

  insert into public.customers (shop_id, name, phone)
  values (p_shop.id, v_name, v_phone)
  on conflict (shop_id, phone) do update set name = excluded.name
  returning id into v_customer_id;

  -- Duplicate protection: same customer, overlapping live booking.
  if exists (
    select 1 from public.bookings
    where customer_id = v_customer_id and status in ('pending', 'confirmed')
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts, v_ends, '[)')
  ) then
    raise exception 'DUPLICATE_BOOKING';
  end if;

  if p_source = 'online' and (
    select count(*) from public.bookings
    where customer_id = v_customer_id and status in ('pending', 'confirmed') and starts_at > now()
  ) >= p_shop.max_active_per_customer then
    raise exception 'TOO_MANY_BOOKINGS';
  end if;

  for v_barber in
    select b.id from public.barbers b
    where b.shop_id = p_shop.id and b.is_active
      and (p_barber_id is null or b.id = p_barber_id)
    order by (
      select count(*) from public.bookings x
      where x.barber_id = b.id and x.status in ('pending', 'confirmed')
        and (x.starts_at at time zone p_shop.timezone)::date = (p_starts at time zone p_shop.timezone)::date
    ), b.sort_order, b.id
  loop
    for v_attempt in 1..5 loop
      v_code := public.gen_booking_code();
      begin
        insert into public.bookings (
          shop_id, customer_id, service_id, barber_id, starts_at, ends_at,
          status, price_iqd, code, customer_note, admin_note, source
        ) values (
          p_shop.id, v_customer_id, p_service.id, v_barber, p_starts, v_ends,
          p_status, p_service.price_iqd, v_code, nullif(btrim(p_note), ''), nullif(btrim(p_admin_note), ''), p_source
        ) returning * into v_booking;
        return v_booking;
      exception
        when unique_violation then
          if sqlerrm like '%bookings_code_key%' then continue; end if;
          raise;
        when exclusion_violation then
          v_last_error := 'SLOT_TAKEN';
          exit; -- try next barber
        when raise_exception then
          -- validation for this barber failed (e.g. barber blocked); try next
          v_last_error := sqlerrm;
          if v_last_error in ('OUTSIDE_HOURS', 'DURING_BREAK') then raise; end if;
          exit;
      end;
    end loop;
  end loop;

  raise exception '%', v_last_error;
end $$;

-- ---------------------------------------------------------------------
-- Public: create booking (anon). Server-side validation lives here.
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
  p_shop_slug text, p_service_id uuid, p_barber_id uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_note text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shop public.shops;
  v_service public.services;
  v_booking public.bookings;
  v_local timestamp;
begin
  select * into v_shop from public.shops where slug = p_shop_slug;
  if v_shop.id is null then raise exception 'SHOP_NOT_FOUND'; end if;

  select * into v_service from public.services
   where id = p_service_id and shop_id = v_shop.id and is_active;
  if v_service.id is null then raise exception 'SERVICE_UNAVAILABLE'; end if;

  if p_starts_at < now() + make_interval(mins => v_shop.min_notice_minutes) then
    raise exception 'TOO_SOON';
  end if;

  v_local := p_starts_at at time zone v_shop.timezone;
  if v_local::date > (now() at time zone v_shop.timezone)::date + v_shop.booking_window_days then
    raise exception 'TOO_FAR';
  end if;
  if extract(second from v_local) <> 0 then
    raise exception 'INVALID_TIME';
  end if;
  -- The time must be one the shop actually offers (grid or sequential mode).
  if not exists (
    select 1 from public.get_available_slots(p_shop_slug, p_service_id, v_local::date, p_barber_id) a
    where a.slot_start = p_starts_at  -- a listed-but-taken time falls through to SLOT_TAKEN
  ) then
    if v_shop.sequential_slots or (extract(epoch from v_local::time)::int / 60) % v_shop.slot_interval_minutes <> 0 then
      raise exception 'INVALID_TIME';
    end if;
  end if;

  v_booking := public._insert_booking(
    v_shop, v_service, p_barber_id, p_starts_at, p_name, p_phone, p_note,
    case when v_shop.auto_confirm then 'confirmed'::public.booking_status else 'pending'::public.booking_status end,
    'online', null
  );

  return json_build_object(
    'code', v_booking.code,
    'status', v_booking.status,
    'starts_at', v_booking.starts_at,
    'ends_at', v_booking.ends_at,
    'barber_name', (select name from public.barbers where id = v_booking.barber_id)
  );
end $$;

-- ---------------------------------------------------------------------
-- Public: look up / cancel a booking (needs code + phone)
-- ---------------------------------------------------------------------
create or replace function public.get_booking_public(p_code text, p_phone text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'code', b.code,
    'status', b.status,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at,
    'price_iqd', b.price_iqd,
    'customer_name', c.name,
    'service_name', s.name,
    'barber_name', br.name,
    'customer_note', b.customer_note,
    'can_cancel', b.status in ('pending', 'confirmed') and b.starts_at > now() + interval '1 hour'
  )
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  join public.services s on s.id = b.service_id
  join public.barbers br on br.id = b.barber_id
  where b.code = upper(btrim(p_code))
    and c.phone = public.normalize_iq_phone(p_phone);
$$;

create or replace function public.cancel_booking_public(p_code text, p_phone text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select b.id into v_id
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  where b.code = upper(btrim(p_code))
    and c.phone = public.normalize_iq_phone(p_phone)
  for update of b;

  if v_id is null then raise exception 'BOOKING_NOT_FOUND'; end if;

  update public.bookings set status = 'cancelled'
  where id = v_id and status in ('pending', 'confirmed') and starts_at > now() + interval '1 hour';
  if not found then raise exception 'CANNOT_CANCEL'; end if;

  return public.get_booking_public(p_code, p_phone);
end $$;

-- ---------------------------------------------------------------------
-- Admin: create / update bookings (checks admin, skips online-only limits)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_booking(
  p_shop_id uuid, p_service_id uuid, p_barber_id uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_status public.booking_status default 'confirmed',
  p_admin_note text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shop public.shops;
  v_service public.services;
begin
  if not public.is_shop_admin(p_shop_id) then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('pending', 'confirmed') then raise exception 'INVALID_STATUS'; end if;
  select * into v_shop from public.shops where id = p_shop_id;
  select * into v_service from public.services where id = p_service_id and shop_id = p_shop_id;
  if v_service.id is null then raise exception 'SERVICE_UNAVAILABLE'; end if;
  return public._insert_booking(v_shop, v_service, p_barber_id, p_starts_at, p_name, p_phone,
                                null, p_status, 'admin', p_admin_note);
end $$;

create or replace function public.admin_update_booking(
  p_booking_id uuid, p_service_id uuid, p_barber_id uuid, p_starts_at timestamptz,
  p_status public.booking_status, p_admin_note text
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_service public.services;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not public.is_shop_admin(v_booking.shop_id) then raise exception 'FORBIDDEN'; end if;
  if p_admin_note is not null and char_length(p_admin_note) > 500 then raise exception 'INVALID_NOTE'; end if;

  select * into v_service from public.services where id = p_service_id and shop_id = v_booking.shop_id;
  if v_service.id is null then raise exception 'SERVICE_UNAVAILABLE'; end if;

  begin
    update public.bookings set
      service_id = v_service.id,
      barber_id  = p_barber_id,
      starts_at  = p_starts_at,
      ends_at    = p_starts_at + make_interval(mins => v_service.duration_minutes),
      price_iqd  = case when v_service.id = v_booking.service_id then v_booking.price_iqd else v_service.price_iqd end,
      status     = p_status,
      admin_note = nullif(btrim(p_admin_note), '')
    where id = p_booking_id
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return v_booking;
end $$;

create or replace function public.admin_set_booking_status(p_booking_id uuid, p_status public.booking_status)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if not public.is_shop_admin(v_booking.shop_id) then raise exception 'FORBIDDEN'; end if;
  begin
    update public.bookings set status = p_status where id = p_booking_id returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return v_booking;
end $$;

-- ---------------------------------------------------------------------
-- Admin: report for a date range (local dates)
-- ---------------------------------------------------------------------
create or replace function public.admin_report(p_shop_id uuid, p_from date, p_to date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_result json;
begin
  if not public.is_shop_admin(p_shop_id) then raise exception 'FORBIDDEN'; end if;
  select timezone into v_tz from public.shops where id = p_shop_id;

  with b as (
    select bk.*, (bk.starts_at at time zone v_tz)::date as local_date
    from public.bookings bk
    where bk.shop_id = p_shop_id
      and bk.starts_at >= (p_from::timestamp at time zone v_tz)
      and bk.starts_at <  ((p_to + 1)::timestamp at time zone v_tz)
  )
  select json_build_object(
    'total',      (select count(*) from b),
    'completed',  (select count(*) from b where status = 'completed'),
    'cancelled',  (select count(*) from b where status = 'cancelled'),
    'no_show',    (select count(*) from b where status = 'no_show'),
    'upcoming',   (select count(*) from b where status in ('pending', 'confirmed')),
    'revenue',    (select coalesce(sum(price_iqd), 0) from b where status = 'completed'),
    'expected',   (select coalesce(sum(price_iqd), 0) from b where status in ('pending', 'confirmed', 'completed')),
    'new_customers', (select count(*) from public.customers c
                      where c.shop_id = p_shop_id
                        and c.created_at >= (p_from::timestamp at time zone v_tz)
                        and c.created_at <  ((p_to + 1)::timestamp at time zone v_tz)),
    'by_day', (select coalesce(json_agg(d order by d.day), '[]'::json) from (
                 select local_date as day, count(*) as bookings,
                        coalesce(sum(price_iqd) filter (where status = 'completed'), 0) as revenue
                 from b group by local_date) d),
    'by_service', (select coalesce(json_agg(s order by s.revenue desc, s.bookings desc), '[]'::json) from (
                 select sv.name, count(*) as bookings,
                        coalesce(sum(b.price_iqd) filter (where b.status = 'completed'), 0) as revenue
                 from b join public.services sv on sv.id = b.service_id
                 where b.status <> 'cancelled'
                 group by sv.name) s),
    'by_barber', (select coalesce(json_agg(x order by x.revenue desc, x.bookings desc), '[]'::json) from (
                 select br.name, count(*) as bookings,
                        coalesce(sum(b.price_iqd) filter (where b.status = 'completed'), 0) as revenue
                 from b join public.barbers br on br.id = b.barber_id
                 where b.status <> 'cancelled'
                 group by br.name) x)
  ) into v_result;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.shops         enable row level security;
alter table public.shop_admins   enable row level security;
alter table public.barbers       enable row level security;
alter table public.services      enable row level security;
alter table public.working_hours enable row level security;
alter table public.blocked_times enable row level security;
alter table public.customers     enable row level security;
alter table public.bookings      enable row level security;

-- Public (anon + authenticated) can read the storefront.
drop policy if exists shops_public_read on public.shops;
create policy shops_public_read on public.shops for select using (true);
drop policy if exists shops_admin_update on public.shops;
create policy shops_admin_update on public.shops for update
  using (public.is_shop_admin(id)) with check (public.is_shop_admin(id));

drop policy if exists shop_admins_self_read on public.shop_admins;
create policy shop_admins_self_read on public.shop_admins for select using (user_id = auth.uid());

drop policy if exists barbers_public_read on public.barbers;
create policy barbers_public_read on public.barbers for select using (is_active or public.is_shop_admin(shop_id));
drop policy if exists barbers_admin_write on public.barbers;
create policy barbers_admin_write on public.barbers for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

drop policy if exists services_public_read on public.services;
create policy services_public_read on public.services for select using (is_active or public.is_shop_admin(shop_id));
drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

drop policy if exists working_hours_public_read on public.working_hours;
create policy working_hours_public_read on public.working_hours for select using (true);
drop policy if exists working_hours_admin_write on public.working_hours;
create policy working_hours_admin_write on public.working_hours for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

-- Private data: admins only. Customers use security-definer RPCs above.
drop policy if exists blocked_times_admin_all on public.blocked_times;
create policy blocked_times_admin_all on public.blocked_times for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

drop policy if exists customers_admin_all on public.customers;
create policy customers_admin_all on public.customers for all
  using (public.is_shop_admin(shop_id)) with check (public.is_shop_admin(shop_id));

drop policy if exists bookings_admin_read on public.bookings;
create policy bookings_admin_read on public.bookings for select using (public.is_shop_admin(shop_id));
-- Booking writes go through admin_* RPCs only (validation + overlap mapping).

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke all on function public._insert_booking(public.shops, public.services, uuid, timestamptz, text, text, text, public.booking_status, public.booking_source, text) from public, anon, authenticated;
revoke all on function public.assert_slot_valid(uuid, uuid, timestamptz, timestamptz, uuid) from public, anon, authenticated;

grant execute on function public.get_available_slots(text, uuid, date, uuid) to anon, authenticated;
grant execute on function public.create_booking(text, uuid, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.get_booking_public(text, text) to anon, authenticated;
grant execute on function public.cancel_booking_public(text, text) to anon, authenticated;

revoke all on function public.admin_create_booking(uuid, uuid, uuid, timestamptz, text, text, public.booking_status, text) from public, anon;
revoke all on function public.admin_update_booking(uuid, uuid, uuid, timestamptz, public.booking_status, text) from public, anon;
revoke all on function public.admin_set_booking_status(uuid, public.booking_status) from public, anon;
revoke all on function public.admin_report(uuid, date, date) from public, anon;
grant execute on function public.admin_create_booking(uuid, uuid, uuid, timestamptz, text, text, public.booking_status, text) to authenticated;
grant execute on function public.admin_update_booking(uuid, uuid, uuid, timestamptz, public.booking_status, text) to authenticated;
grant execute on function public.admin_set_booking_status(uuid, public.booking_status) to authenticated;
grant execute on function public.admin_report(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------
-- Setup helper: run once from the SQL editor (not callable by clients)
--   select public.setup_shop('my-shop', 'اسم الصالون', 'owner@email.com');
-- ---------------------------------------------------------------------
create or replace function public.setup_shop(p_slug text, p_name text, p_admin_email text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
  v_user_id uuid;
  d int;
begin
  select id into v_user_id from auth.users where lower(email) = lower(p_admin_email);
  if v_user_id is null then
    raise exception 'User % not found. Create it first in Authentication > Users.', p_admin_email;
  end if;

  insert into public.shops (slug, name) values (p_slug, p_name)
  on conflict (slug) do update set name = excluded.name
  returning id into v_shop_id;

  for d in 0..6 loop
    insert into public.working_hours (shop_id, weekday, is_open, open_time, close_time)
    values (v_shop_id, d, d <> 5, '16:00', '24:00')
    on conflict (shop_id, weekday) do nothing;
  end loop;

  insert into public.shop_admins (shop_id, user_id) values (v_shop_id, v_user_id)
  on conflict do nothing;

  return v_shop_id;
end $$;
revoke all on function public.setup_shop(text, text, text) from public, anon, authenticated;
