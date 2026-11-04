-- صالون فراس: real details from the shop. Run once in the SQL Editor after setup_shop(...).
-- Safe to re-run: it replaces the services list and updates the shop info.
do $$
declare v_shop uuid := (select id from public.shops where slug = 'firas-salon');
begin
  if v_shop is null then raise exception 'run setup_shop first'; end if;

  update public.shops set
    name = 'صالون فراس',
    tagline = 'قصّات رجالية مرتبة، وموعدك محفوظ بدون انتظار.',
    address = 'الحلة، قرب جسر الثورة',
    phone = '9647806551240',
    whatsapp = '9647806551240',
    sequential_slots = true,
    booking_window_days = 30,
    min_notice_minutes = 30
  where id = v_shop;

  -- 4 العصر لـ 12 بالليل، بدون استراحة، الجمعة عطلة
  update public.working_hours set is_open = weekday <> 5, open_time = '16:00', close_time = '24:00', break_start = null, break_end = null
  where shop_id = v_shop;

  -- price board (IQD), every appointment is one hour
  update public.services set is_active = false where shop_id = v_shop;
  insert into public.services (shop_id, name, description, price_iqd, duration_minutes, sort_order) values
    (v_shop, 'حلاقة فقط', null, 15000, 60, 1),
    (v_shop, 'حلاقة VIP مع 3 تسريحات', null, 25000, 60, 2),
    (v_shop, 'تحديد كامل', null, 10000, 60, 3),
    (v_shop, 'مساج كامل', null, 10000, 60, 4),
    (v_shop, 'حلاقة عريس (حنة + زفة)', null, 75000, 60, 5),
    (v_shop, 'حلاقة عريس VIP', '3 أيام + معالج الشعر + 4 تسريحات', 125000, 60, 6),
    (v_shop, 'الاشتراك الشهري', '5 تسريحات + جلسة مساج', 65000, 60, 7),
    (v_shop, 'الاشتراك الشهري VIP', '10 تسريحات + 4 جلسات مساج للوجه + فرچة سشوار هدية + مثبت + دهن', 95000, 60, 8);

  if not exists (select 1 from public.barbers where shop_id = v_shop) then
    insert into public.barbers (shop_id, name, title, sort_order) values (v_shop, 'فراس', 'صاحب الصالون', 1);
  end if;
end $$;
