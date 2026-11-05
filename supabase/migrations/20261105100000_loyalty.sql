-- Loyalty card: every N completed visits, the next visit is a reward (free or discounted).
-- Visits are counted from bookings marked "completed" for the customer's phone number,
-- so nothing extra is stored per customer.

alter table public.shops
  add column if not exists loyalty_every  int  not null default 5 check (loyalty_every between 0 and 50),
  add column if not exists loyalty_reward text not null default 'الحلاقة السادسة مجاناً' check (char_length(loyalty_reward) <= 80);

-- Customer-facing progress, gated by booking code + phone like get_booking_public.
create or replace function public.get_loyalty_public(p_code text, p_phone text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'every', s.loyalty_every,
    'reward', s.loyalty_reward,
    'visits', (select count(*) from public.bookings x where x.customer_id = c.id and x.status = 'completed')
  )
  from public.bookings b
  join public.customers c on c.id = b.customer_id
  join public.shops s on s.id = b.shop_id
  where b.code = upper(btrim(p_code))
    and c.phone = public.normalize_iq_phone(p_phone)
    and s.loyalty_every > 0;
$$;
revoke all on function public.get_loyalty_public(text, text) from public;
grant execute on function public.get_loyalty_public(text, text) to anon, authenticated;
