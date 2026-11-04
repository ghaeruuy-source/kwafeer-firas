-- Run on a database with supabase_stub.sql + migrations applied.
-- Every block raises if an expectation fails.
\set ON_ERROR_STOP 1
\pset tuples_only on
set client_min_messages = warning;

create or replace function pg_temp.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'EXPECTED % BUT SUCCEEDED: %', p_code, p_sql;
exception when others then
  if sqlerrm not like '%' || p_code || '%' then
    raise exception 'EXPECTED % GOT %: %', p_code, sqlerrm, p_sql;
  end if;
end $$;

-- local timestamp helper (Baghdad), next Monday/Tuesday/Friday
create or replace function pg_temp.next_dow(p int) returns date language sql as $$
  select d::date from generate_series((now() at time zone 'Asia/Baghdad')::date + 1,
                                      (now() at time zone 'Asia/Baghdad')::date + 8, '1 day') d
  where extract(dow from d) = p limit 1 $$;
create or replace function pg_temp.at(p_dow int, p_time text) returns timestamptz language sql as $$
  select (pg_temp.next_dow(p_dow) + p_time::time) at time zone 'Asia/Baghdad' $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.iq'),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.iq');
select public.setup_shop('test-shop', 'صالون التجربة', 'owner@test.iq') as shop_id \gset
-- sections 1–8 test the fixed 15-minute grid; section 9 tests sequential mode
update shops set sequential_slots = false;
-- the tests below were written for 10:00–22:00 days
update working_hours set open_time = '10:00', close_time = '22:00';
insert into barbers (id, shop_id, name, sort_order) values
  ('00000000-0000-0000-0000-0000000000b1', :'shop_id', 'علي', 1),
  ('00000000-0000-0000-0000-0000000000b2', :'shop_id', 'حسين', 2);
insert into services (id, shop_id, name, price_iqd, duration_minutes) values
  ('00000000-0000-0000-0000-0000000000c1', :'shop_id', 'حلاقة شعر', 10000, 30),
  ('00000000-0000-0000-0000-0000000000c2', :'shop_id', 'شعر ولحية', 15000, 60);

set role anon;

-- 1. Slots
do $$
declare n int; first_slot time;
begin
  select count(*), min((slot_start at time zone 'Asia/Baghdad')::time) into n, first_slot
  from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c1', pg_temp.next_dow(1)) where available;
  if n <> 47 then raise exception 'expected 47 slots (10:00..21:30), got %', n; end if;
  if first_slot <> '10:00' then raise exception 'first slot %', first_slot; end if;
  select count(*) into n from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c1', pg_temp.next_dow(5));
  if n <> 0 then raise exception 'friday should be closed, got % slots', n; end if;
end $$;

-- 2. Create + overlap protection
select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1',
                      pg_temp.at(1, '10:00'), 'أحمد', '0770 123 4567') ->> 'code' as code1 \gset
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'أحمد', '+964 770 123 4567')$q$, pg_temp.at(1,'10:00')), 'DUPLICATE_BOOKING');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', %L, 'محمد', '07801112222')$q$, pg_temp.at(1,'10:15')), 'SLOT_TAKEN');
do $$
declare r json; b uuid;
begin
  r := create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, pg_temp.at(1,'10:00'), 'محمد', '07801112222');
  if r->>'status' <> 'pending' then raise exception 'status %', r->>'status'; end if;
end $$;
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'كرار', '07501112222')$q$, pg_temp.at(1,'10:00')), 'SLOT_TAKEN');

-- 3. Hours / alignment / phone
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'كرار', '07501112222')$q$, pg_temp.at(1,'09:30')), 'OUTSIDE_HOURS');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c2', null, %L, 'كرار', '07501112222')$q$, pg_temp.at(1,'21:30')), 'OUTSIDE_HOURS');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'كرار', '07501112222')$q$, pg_temp.at(1,'10:07')), 'INVALID_TIME');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'كرار', '07501112222')$q$, pg_temp.at(5,'12:00')), 'OUTSIDE_HOURS');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'كرار', '12345')$q$, pg_temp.at(1,'12:00')), 'INVALID_PHONE');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'ك', '07501112222')$q$, pg_temp.at(1,'12:00')), 'INVALID_NAME');
select pg_temp.expect_error($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, now() + interval '5 minutes', 'كرار', '07501112222')$q$, 'TOO_SOON');

-- 4. RLS: anon sees no private rows, cannot call admin functions, cannot write
do $$ begin
  if (select count(*) from bookings) <> 0 then raise exception 'anon can read bookings'; end if;
  if (select count(*) from customers) <> 0 then raise exception 'anon can read customers'; end if;
  if (select count(*) from services) <> 2 then raise exception 'anon cannot read services'; end if;
end $$;
do $$ declare n int; begin
  update services set price_iqd = 1; get diagnostics n = row_count;
  if n <> 0 then raise exception 'anon updated services'; end if;
end $$;
select pg_temp.expect_error(format('select admin_report(%L, current_date, current_date)', :'shop_id'), 'permission denied');
select pg_temp.expect_error($q$select _insert_booking(null, null, null, now(), 'a', 'b', null, 'pending', 'online', null)$q$, 'permission denied');

-- 5. Public lookup + cancel (any phone format)
select set_config('test.code1', :'code1', false) \g /dev/null
do $$ declare r json; begin
  r := get_booking_public(lower(current_setting('test.code1')), '+9647701234567');
  if r is null or r->>'barber_name' <> 'علي' then raise exception 'lookup failed %', r; end if;
  if get_booking_public(current_setting('test.code1'), '07809999999') is not null then raise exception 'lookup with wrong phone leaked'; end if;
end $$;

reset role;

-- 6. Break + blocked times
update working_hours set break_start = '14:00', break_end = '15:00' where shop_id = :'shop_id' and weekday = 1;
insert into blocked_times (shop_id, starts_at, ends_at, reason)
values (:'shop_id', pg_temp.next_dow(2)::timestamp at time zone 'Asia/Baghdad', (pg_temp.next_dow(2) + 1)::timestamp at time zone 'Asia/Baghdad', 'عطلة');
insert into blocked_times (shop_id, barber_id, starts_at, ends_at, reason)
values (:'shop_id', '00000000-0000-0000-0000-0000000000b1', pg_temp.at(1,'16:00'), pg_temp.at(1,'17:00'), 'موعد خاص');

set role anon;
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'كرار', '07501112222')$q$, pg_temp.at(1,'13:45')), 'DURING_BREAK');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, %L, 'كرار', '07501112222')$q$, pg_temp.at(2,'12:00')), 'BLOCKED_TIME');
select pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', %L, 'كرار', '07501112222')$q$, pg_temp.at(1,'16:30')), 'BLOCKED_TIME');
do $$ declare n int; r json; begin
  select count(*) into n from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c1', pg_temp.next_dow(1))
   where (slot_start at time zone 'Asia/Baghdad')::time between '13:45' and '14:45';
  if n <> 0 then raise exception 'break slots offered: %', n; end if;
  select count(*) into n from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c1', pg_temp.next_dow(2));
  if n <> 0 then raise exception 'holiday slots offered: %', n; end if;
  -- barber-specific block: "any barber" at 16:30 must go to حسين
  r := create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', null, pg_temp.at(1,'16:30'), 'كرار', '07501112222');
  if (get_booking_public(r->>'code', '07501112222'))->>'barber_name' <> 'حسين' then raise exception 'wrong barber auto-assigned'; end if;
end $$;
reset role;

-- 7. Admin RPCs under RLS
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.expect_error(format('select admin_report(%L, current_date, current_date + 30)', :'shop_id'), 'FORBIDDEN');
do $$ begin if (select count(*) from bookings) <> 0 then raise exception 'stranger reads bookings'; end if; end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$
declare r json; b bookings; other uuid;
begin
  if (select count(*) from bookings) <> 3 then raise exception 'admin sees % bookings', (select count(*) from bookings); end if;
  b := admin_create_booking((select id from shops), '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1',
                            pg_temp.at(1,'11:00'), 'زبون محل', '07711111111', 'confirmed', 'دفع مسبق');
  if b.status <> 'confirmed' or b.source <> 'admin' then raise exception 'admin create %', b; end if;
  -- moving it onto علي's 10:00 booking must fail
  begin
    perform admin_update_booking(b.id, b.service_id, b.barber_id, pg_temp.at(1,'10:00'), 'confirmed', null);
    raise exception 'overlap allowed';
  exception when others then if sqlerrm <> 'SLOT_TAKEN' then raise; end if; end;
  b := admin_set_booking_status(b.id, 'completed');
  r := admin_report((select id from shops), pg_temp.next_dow(1), pg_temp.next_dow(1));
  if (r->>'revenue')::int <> 15000 or (r->>'total')::int <> 4 then raise exception 'report %', r; end if;
  -- cancelling frees the slot; re-activating onto a taken slot fails
  update customers set notes = 'يحب المكينة رقم 2' where phone = '9647701234567';
  if not found then raise exception 'admin cannot edit customer notes'; end if;
end $$;
reset role;

select 'ALL BOOKING LOGIC TESTS PASSED' as result;

-- 8. Customer cancel
set role anon;
do $$ declare r json; begin
  r := cancel_booking_public(current_setting('test.code1'), '07701234567');
  if r->>'status' <> 'cancelled' then raise exception 'cancel failed %', r; end if;
  perform pg_temp.expect_error(format($q$select cancel_booking_public(%L, '07701234567')$q$, current_setting('test.code1')), 'CANNOT_CANCEL');
  -- slot is free again
  r := create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', pg_temp.at(1,'10:00'), 'مصطفى', '07901234567');
end $$;
reset role;
select 'CANCEL TESTS PASSED';

-- 9. Sequential slots + taken times shown greyed out (Wednesday, 10:00–22:00, no break)
update working_hours set break_start = '14:00', break_end = '14:30' where weekday = 3;
update shops set sequential_slots = true;
set role anon;
do $$
declare n int; t time[]; r json;
begin
  -- 60-min service: chain 10:00, 11:00, 12:00, 13:00, then 14:30 after the break …
  select array_agg((slot_start at time zone 'Asia/Baghdad')::time order by slot_start) into t
  from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c2', pg_temp.next_dow(3));
  if t[1:6] <> array['10:00','11:00','12:00','13:00','14:30','15:30']::time[] then raise exception 'sequential chain %', t; end if;
  -- off-chain time is refused
  perform pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c2', null, %L, 'سيف', '07701010101')$q$, pg_temp.at(3,'10:15')), 'INVALID_TIME');
  -- fill 10:00 for both barbers with a 30-min service
  perform create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', pg_temp.at(3,'10:00'), 'سيف', '07701010101');
  perform create_booking('test-shop', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', pg_temp.at(3,'10:00'), 'زيد', '07702020202');
  -- 10:00 is still listed but not available; 10:30 opens right after the bookings
  select count(*) into n from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c2', pg_temp.next_dow(3))
   where (slot_start at time zone 'Asia/Baghdad')::time = '10:00' and not available and barber_ids = '{}';
  if n <> 1 then raise exception 'taken slot not shown as unavailable'; end if;
  select count(*) into n from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c2', pg_temp.next_dow(3))
   where (slot_start at time zone 'Asia/Baghdad')::time = '10:30' and available;
  if n <> 1 then raise exception 'no back-to-back slot after booking'; end if;
  -- booking a greyed-out time fails, booking the back-to-back one works
  perform pg_temp.expect_error(format($q$select create_booking('test-shop', '00000000-0000-0000-0000-0000000000c2', null, %L, 'علاوي', '07703030303')$q$, pg_temp.at(3,'10:00')), 'SLOT_TAKEN');
  r := create_booking('test-shop', '00000000-0000-0000-0000-0000000000c2', null, pg_temp.at(3,'10:30'), 'علاوي', '07703030303');
  if r->>'code' is null then raise exception 'sequential booking failed'; end if;
end $$;
reset role;
select 'SEQUENTIAL SLOT TESTS PASSED';

-- 10. Default hours (16:00–24:00) and a booking that ends at midnight
reset role;
update working_hours set open_time = '16:00', close_time = '24:00', break_start = null, break_end = null where weekday = 4;
set role anon;
do $$
declare t time[]; r json;
begin
  select array_agg((slot_start at time zone 'Asia/Baghdad')::time order by slot_start) into t
  from get_available_slots('test-shop', '00000000-0000-0000-0000-0000000000c2', pg_temp.next_dow(4));
  if t <> array['16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00']::time[] then raise exception 'midnight day slots %', t; end if;
  r := create_booking('test-shop', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', pg_temp.at(4,'23:00'), 'منتظر', '07805551111');
  if r->>'code' is null then raise exception 'midnight booking failed'; end if;
end $$;
reset role;
select 'MIDNIGHT TESTS PASSED';
