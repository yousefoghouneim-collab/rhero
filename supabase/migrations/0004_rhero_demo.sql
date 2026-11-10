-- =====================================================================
-- RHero 0004: demo workspace generator
-- Rebuilds a realistic 14-day history for the demo org (cleaning rounds,
-- daily stock counts with consumption, deliveries, orders, requests,
-- gate passes, issues, reports) relative to *today* in Dubai time.
-- Runs automatically on the first demo login of each day.
-- =====================================================================

create or replace function public.rh_seed_demo(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tz text; v_now timestamp; v_today date; v_first date; d date; v_dow int;
  v_mgr uuid; v_c1 uuid; v_c2 uuid; v_who uuid;
  r record; t record; it record;
  v_planned timestamp; v_done_at timestamp;
  v_k int; v_n int; v_win numeric; v_rand numeric; v_daily numeric; v_use int; v_need numeric;
  v_order uuid; v_area text; v_rep jsonb; v_report_time time := time '16:00';
begin
  select timezone into v_tz from public.rh_orgs where id = p_org and is_demo;
  if v_tz is null then raise exception 'Not a demo workspace'; end if;
  perform set_config('rh.seeding', 'on', true);

  v_now := now() at time zone v_tz;
  v_today := v_now::date;
  v_first := v_today - 14;
  perform setseed(((v_today - date '2026-01-01') % 97) / 100.0);

  select id into v_mgr from public.rh_profiles where org_id = p_org and role = 'manager' order by created_at limit 1;
  select id into v_c1 from public.rh_profiles where org_id = p_org and role = 'cleaner' order by created_at limit 1;
  select id into v_c2 from public.rh_profiles where org_id = p_org and role = 'cleaner' order by created_at offset 1 limit 1;
  v_c2 := coalesce(v_c2, v_c1);
  if v_mgr is null or v_c1 is null then raise exception 'Demo users are missing'; end if;

  -- wipe the demo workspace
  delete from public.rh_notifications where org_id = p_org;
  delete from public.rh_daily_reports where org_id = p_org;
  delete from public.rh_alert_log where org_id = p_org;
  delete from public.rh_counters where org_id = p_org;
  delete from public.rh_issues where org_id = p_org;
  delete from public.rh_requests where org_id = p_org;
  delete from public.rh_visitor_passes where org_id = p_org;
  delete from public.rh_stock_counts where org_id = p_org;
  delete from public.rh_stock_moves where org_id = p_org;
  delete from public.rh_order_lines where org_id = p_org;
  delete from public.rh_orders where org_id = p_org;
  delete from public.rh_task_done where org_id = p_org;
  delete from public.rh_tasks where org_id = p_org;
  delete from public.rh_routines where org_id = p_org;
  delete from public.rh_areas where org_id = p_org;
  delete from public.rh_items where org_id = p_org;

  perform public.rh_seed_catalog(p_org);
  -- the demo runs every day so it can always be tried out
  update public.rh_routines set days = '{1,2,3,4,5,6,7}' where org_id = p_org;
  update public.rh_orgs set settings = settings || jsonb_build_object('work_days', jsonb_build_array(1,2,3,4,5,6,7), 'report_time', '16:00')
   where id = p_org;

  create temp table if not exists _rh_st (item_id uuid primary key, total numeric, acc numeric) on commit drop;
  delete from _rh_st where true;
  insert into _rh_st select id, par_qty, random() from public.rh_items where org_id = p_org;

  -- opening stock (full restock two weeks ago)
  insert into public.rh_stock_moves(item_id, kind, qty, note, created_by, created_at)
  select i.id, 'receive', i.par_qty, 'Opening stock', v_mgr, ((v_first - 1) + time '10:00') at time zone v_tz
  from public.rh_items i where i.org_id = p_org and i.par_qty > 0;

  for d in select g::date from generate_series(v_first, v_today, interval '1 day') g loop
    v_dow := extract(isodow from d)::int;

    -- weekly water delivery
    if (d - v_first) % 7 = 0 and d > v_first then
      for it in select i.id, i.par_qty, s.total from public.rh_items i join _rh_st s on s.item_id = i.id
                where i.org_id = p_org and i.code in ('KP11','KP12') loop
        if it.par_qty > it.total then
          insert into public.rh_stock_moves(item_id, kind, qty, note, created_by, created_at)
          values (it.id, 'receive', it.par_qty - it.total, 'Weekly water delivery', v_mgr, (d + time '09:40') at time zone v_tz);
          update _rh_st set total = it.par_qty where item_id = it.id;
        end if;
      end loop;
    end if;

    -- mid-period top-up order (received)
    if d = v_first + 6 then
      insert into public.rh_orders(org_id, supplier, status, notes, created_by, created_at, ordered_at, received_at, expected_on)
      values (p_org, 'OfficeRock', 'received', 'Weekly top-up of low items',
              v_mgr, ((d - 2) + time '11:05') at time zone v_tz, ((d - 2) + time '11:20') at time zone v_tz,
              (d + time '10:30') at time zone v_tz, d)
      returning id into v_order;
      for it in select i.*, s.total from public.rh_items i join _rh_st s on s.item_id = i.id
                where i.org_id = p_org and i.section = 'pantry' and i.code not in ('KP11','KP12')
                  and (s.total - case when i.track_opened and s.total > 0 then 1 else 0 end) <= greatest(i.warn_qty, i.par_qty * 0.6)
                order by i.sort loop
        v_need := it.par_qty - it.total;
        if v_need > 0 then
          insert into public.rh_order_lines(order_id, item_id, name, unit, qty, unit_price, received_qty)
          values (v_order, it.id, it.name, it.unit, v_need, it.unit_price, v_need);
          insert into public.rh_stock_moves(item_id, kind, qty, order_id, note, created_by, created_at)
          values (it.id, 'receive', v_need, v_order, 'Received', v_mgr, (d + time '10:30') at time zone v_tz);
          update _rh_st set total = it.par_qty where item_id = it.id;
        end if;
      end loop;
    end if;

    -- consumption
    for it in select i.id, i.monthly_usage, s.total, s.acc from public.rh_items i join _rh_st s on s.item_id = i.id
              where i.org_id = p_org loop
      v_daily := coalesce(it.monthly_usage, 1) / 30.0 * (0.55 + random() * 0.9);
      v_use := floor(it.acc + v_daily)::int;
      update _rh_st set acc = it.acc + v_daily - v_use, total = greatest(it.total - v_use, 0) where item_id = it.id;
    end loop;

    -- daily pantry & cleaning count (~15:36) — today only once the count window has started
    if d < v_today or v_now::time >= time '15:40' then
      v_who := case when (d - v_first) % 2 = 0 then v_c2 else v_c1 end;
      insert into public.rh_stock_counts(item_id, day, qty_opened, qty_store, counted_by, counted_at)
      select x.id, d, x.op, x.total - x.op, v_who,
             (d + time '15:36' + make_interval(secs => (x.rn * 17)::int)) at time zone v_tz
      from (
        select i.id, s.total, i.sort,
               case when i.track_opened and s.total > 0 then 1 else 0 end as op,
               row_number() over (order by i.sort) as rn
        from public.rh_items i join _rh_st s on s.item_id = i.id
        where i.org_id = p_org and i.section = 'pantry'
      ) x
      where d < v_today or (d + time '15:36' + make_interval(secs => (x.rn * 17)::int)) <= v_now
      order by x.sort;
    end if;

    -- weekly stationery count by the office manager
    if (d - v_first) % 7 = 3 and d < v_today then
      insert into public.rh_stock_counts(item_id, day, qty_opened, qty_store, counted_by, counted_at)
      select i.id, d, 0, s.total, v_mgr, (d + time '10:10' + make_interval(secs => (row_number() over (order by i.sort) * 12)::int)) at time zone v_tz
      from public.rh_items i join _rh_st s on s.item_id = i.id
      where i.org_id = p_org and i.section = 'stationery' order by i.sort;
    end if;

    -- cleaning rounds
    for r in select * from public.rh_routines where org_id = p_org and active and kind <> 'stock' and v_dow = any(days) order by sort loop
      select count(*) into v_n from public.rh_tasks tt where tt.routine_id = r.id and tt.active and (tt.days is null or v_dow = any(tt.days));
      v_k := 0;
      v_win := extract(epoch from (r.end_time - r.start_time)) / 60.0;
      for t in select tt.*, a.name as area_name from public.rh_tasks tt left join public.rh_areas a on a.id = tt.area_id
               where tt.routine_id = r.id and tt.active and (tt.days is null or v_dow = any(tt.days)) order by tt.sort loop
        v_planned := d + r.start_time + make_interval(mins => floor((v_k + 0.6) * v_win * 0.85 / greatest(v_n, 1))::int);
        v_k := v_k + 1;
        v_rand := random();
        continue when v_rand < 0.03;                               -- occasionally missed
        v_done_at := v_planned + make_interval(secs => floor(random() * 240 - 60)::int);
        if v_rand > 0.96 then                                     -- occasionally late
          v_done_at := d + r.end_time + make_interval(mins => (4 + floor(random() * 20))::int);
        end if;
        continue when d = v_today and v_done_at > v_now;          -- today: only what has happened so far
        v_who := case when t.area_name in ('Kitchen & Pantry', 'Women''s Toilets', 'Reception & Entrance') then v_c2 else v_c1 end;
        insert into public.rh_task_done(task_id, day, done_by, done_at) values (t.id, d, v_who, v_done_at at time zone v_tz);
      end loop;
    end loop;
  end loop;

  -- open purchase order (ordered yesterday, delivery tomorrow) for some red items
  insert into public.rh_orders(org_id, supplier, status, notes, created_by, created_at, ordered_at, expected_on)
  values (p_org, 'Cognition UAE', 'ordered', 'Ordered by email — delivery expected tomorrow', v_mgr,
          ((v_today - 1) + time '11:15') at time zone v_tz, ((v_today - 1) + time '11:40') at time zone v_tz, v_today + 1)
  returning id into v_order;
  insert into public.rh_order_lines(order_id, item_id, name, unit, qty, unit_price)
  select v_order, x.id, x.name, x.unit, x.need, x.unit_price from (
    select i.id, i.name, i.unit, i.unit_price, greatest(ceil(i.par_qty - i.qty_store - i.qty_opened), 1) as need,
           row_number() over (order by i.sort) as rn
    from public.rh_items i
    where i.org_id = p_org and i.section = 'pantry' and i.code not in ('KP11')
      and public.rh_item_status(i.qty_store, i.warn_qty, i.min_qty) = 'red'
  ) x where x.rn % 2 = 0;
  if not exists (select 1 from public.rh_order_lines where order_id = v_order) then
    delete from public.rh_orders where id = v_order;
  end if;

  -- a draft order Dina is preparing for stationery
  insert into public.rh_orders(org_id, supplier, status, notes, created_by, created_at)
  values (p_org, 'Al Gurg Stationery', 'draft', 'Monthly stationery — check quantities before sending', v_mgr, now() - interval '3 hours')
  returning id into v_order;
  insert into public.rh_order_lines(order_id, item_id, name, unit, qty, unit_price)
  select v_order, i.id, i.name, i.unit, greatest(ceil(i.par_qty - i.qty_store), 1), i.unit_price
  from public.rh_items i
  where i.org_id = p_org and i.section = 'stationery' and public.rh_item_status(i.qty_store, i.warn_qty, i.min_qty) <> 'green'
  order by i.sort limit 6;
  if not exists (select 1 from public.rh_order_lines where order_id = v_order) then
    delete from public.rh_orders where id = v_order;
  end if;

  -- issues reported by the cleaners
  insert into public.rh_issues(org_id, area_id, kind, note, status, reported_by, created_at, resolved_at, resolved_by)
  select p_org, (select id from public.rh_areas where org_id = p_org and name = x.area), x.kind, x.note, x.status,
         case x.who when 1 then v_c1 else v_c2 end, x.at at time zone v_tz,
         case when x.status = 'resolved' then (x.at + interval '3 hours') at time zone v_tz end,
         case when x.status = 'resolved' then v_mgr end
  from (values
    ('Kitchen & Pantry', 'broken', 'Dishwasher is leaking water under the door', 'open', 1, (v_today - 1) + time '13:42'),
    ('Women''s Toilets', 'supply', 'Sanitary bags almost finished — 1 pack left', 'open', 2, (v_today - 1) + time '09:12'),
    ('Reception & Entrance', 'spill', 'Coffee spilled on the carpet near reception — cleaned, stain remains', 'resolved', 2, (v_today - 3) + time '10:05'),
    ('Men''s Toilets', 'broken', 'Hand dryer not working', 'resolved', 1, (v_today - 6) + time '08:50')
  ) as x(area, kind, note, status, who, at);

  -- misc purchase requests (monitors, chairs, docks …)
  insert into public.rh_requests(org_id, title, category, qty, specs, reason, link, needed_by, priority,
    requester_name, requester_email, department, est_unit_cost, supplier, po_number, status, notes, source, created_by, created_at)
  values
    (p_org, 'Dell 27" monitor (P2725H)', 'IT Equipment', 4, '27" IPS, 1080p, USB-C hub, height-adjustable stand',
     'Four new starters joining the tooling team', 'https://www.dell.com/en-ae', v_today + 10, 'high',
     'Omar Haddad', 'omar.haddad@example.com', 'Engineering', 850, 'Dell UAE', null, 'approved', 'Budget approved by ops manager', 'manager', v_mgr, now() - interval '3 days'),
    (p_org, 'Ergonomic office chair', 'Furniture', 3, 'Mesh back, adjustable lumbar & arms, black',
     'Replacing broken chairs in finance', null, v_today + 14, 'normal',
     'Sara Klein', 'sara.klein@example.com', 'HR & Admin', 1200, 'Office Furniture LLC', 'PO-2610-014', 'ordered', 'Delivery booked for next week', 'manager', v_mgr, now() - interval '6 days'),
    (p_org, 'USB-C docking station (Dell WD19S)', 'IT Equipment', 5, '130 W, dual display, Ethernet',
     'Hot desks in Bay 2 office have no docks', 'https://www.dell.com/en-ae', v_today + 7, 'normal',
     'Khalid Mansour', 'khalid.mansour@example.com', 'IT', 650, null, null, 'new', null, 'form', null, now() - interval '5 hours'),
    (p_org, 'Height-adjustable standing desk', 'Furniture', 1, '140×70 cm, electric, memory presets',
     'Back pain — doctor''s recommendation attached to email', null, v_today + 5, 'urgent',
     'Marcus Weber', 'marcus.weber@example.com', 'Finance', 1850, null, null, 'new', null, 'form', null, now() - interval '26 hours'),
    (p_org, 'Wireless headset (Jabra Evolve2 55)', 'IT Equipment', 2, 'Stereo, ANC, USB-A dongle',
     'Customer calls from open office', null, v_today - 4, 'normal',
     'Aisha Rahman', 'aisha.rahman@example.com', 'Sales', 720, 'Jumbo Electronics', 'PO-2610-011', 'delivered', 'Handed over', 'manager', v_mgr, now() - interval '12 days'),
    (p_org, 'Whiteboard 120×90 cm for Bay 3 office', 'Office Equipment', 1, 'Magnetic, wall-mounted, with marker tray',
     'Daily stand-ups', null, null, 'low',
     'Faisal Noor', 'faisal.noor@example.com', 'Operations', 275, null, null, 'on_hold', 'Waiting for wall approval from facility', 'manager', v_mgr, now() - interval '9 days');

  -- gate passes
  insert into public.rh_visitor_passes(org_id, visitor_name, id_type, id_number, nationality, email, phone, company, occupation,
    visit_reason, visit_date, arrival_time, departure_time, host_name, host_team, host_email, host_phone, vehicle_plate, equipment,
    status, source, created_by, created_at)
  values
    (p_org, 'Rajesh Iyer', 'emirates_id', '784-1988-1234567-1', 'Indian', 'rajesh.iyer@example.com', '+971 55 000 1234', 'UAMCO', 'Tooling Engineer',
     'LEAP engine tooling review', v_today, '10:00', '12:00', 'Omar Haddad', 'Engineering', 'omar.haddad@example.com', null, 'Dubai A 12345', 'Laptop',
     'issued', 'manager', v_mgr, now() - interval '2 days'),
    (p_org, 'Lena Fischer', 'passport', 'C4X9K2L7Q', 'German', 'lena.fischer@example.com', '+49 151 0000000', 'HYDRO Systems (Biberach)', 'GSE Trainer',
     'Ground support equipment training for technicians', v_today + 1, '08:30', '16:30', 'Faisal Noor', 'Operations', 'faisal.noor@example.com', null, null, 'Laptop, training kit',
     'approved', 'manager', v_mgr, now() - interval '1 day'),
    (p_org, 'Priya Nair', 'emirates_id', '784-1996-7654321-2', 'Indian', 'priya.nair@example.com', '+971 50 000 5678', null, 'Candidate',
     'Job interview — Tooling Technician', v_today, '14:00', '15:00', 'Sara Klein', 'HR & Admin', 'sara.klein@example.com', null, null, null,
     'pending', 'form', null, now() - interval '4 hours'),
    (p_org, 'Ahmed Al Mansoori', 'emirates_id', '784-1979-2468135-3', 'Emirati', 'ahmed.mansoori@example.com', '+971 50 000 9012', 'Dubai South', 'Facility Inspector',
     'Quarterly facility inspection', v_today + 3, '09:30', '11:00', 'Dina Maged', 'Office Management', null, null, 'Dubai B 67890', null,
     'pending', 'manager', v_mgr, now() - interval '30 hours');

  -- past daily reports (snapshot at 16:00 each day)
  for d in select g::date from generate_series(v_first, v_today - 1, interval '1 day') g loop
    insert into public.rh_daily_reports(org_id, day, data, created_at)
    values (p_org, d, public.rh_build_report(p_org, d), (d + v_report_time) at time zone v_tz)
    on conflict (org_id, day) do nothing;
  end loop;
  if v_now::time >= v_report_time then
    insert into public.rh_daily_reports(org_id, day, data, created_at)
    values (p_org, v_today, public.rh_build_report(p_org, v_today), (v_today + v_report_time) at time zone v_tz)
    on conflict (org_id, day) do nothing;
  end if;

  -- rounds that already ended today were "alerted" already
  insert into public.rh_alert_log(org_id, key, day)
  select p_org, 'round:' || id, v_today from public.rh_routines where org_id = p_org and end_time <= v_now::time
  on conflict do nothing;

  -- curated notifications for Dina
  select data into v_rep from public.rh_daily_reports where org_id = p_org and day = v_today - 1;
  insert into public.rh_notifications(org_id, user_id, kind, title, body, link, read_at, created_at) values
    (p_org, v_mgr, 'report', 'Daily report · ' || to_char(v_today - 1, 'Dy DD Mon'),
     'Cleaning ' || coalesce(v_rep->'cleaning'->>'done', '0') || '/' || coalesce(v_rep->'cleaning'->>'total', '0') ||
     ' · Stock counted ' || coalesce(v_rep->'stock'->>'counted', '0') || '/' || coalesce(v_rep->'stock'->>'total', '0') ||
     ' · ' || coalesce(jsonb_array_length(v_rep->'stock'->'red'), 0) || ' to order now',
     '/m/reports/' || to_char(v_today - 1, 'YYYY-MM-DD'), now() - interval '2 hours', ((v_today - 1) + v_report_time) at time zone v_tz),
    (p_org, v_mgr, 'issue', 'Something is broken · Kitchen & Pantry', 'Dishwasher is leaking water under the door — ' || coalesce((select full_name from public.rh_profiles where id = v_c1), 'cleaner'),
     '/m/cleaning?tab=issues', null, ((v_today - 1) + time '13:42') at time zone v_tz),
    (p_org, v_mgr, 'request', 'New item request: USB-C docking station (Dell WD19S)', 'Khalid Mansour (IT) · qty 5',
     '/m/requests', null, now() - interval '5 hours'),
    (p_org, v_mgr, 'pass', 'Gate pass request: Priya Nair', 'Visit today · host Sara Klein', '/m/passes', null, now() - interval '4 hours');
  insert into public.rh_notifications(org_id, user_id, kind, title, body, link, created_at)
  select p_org, v_mgr, 'stock_red', i.name || ' is running out',
         'In store: ' || trim(to_char(i.qty_store, 'FM999990.##')) || ' ' || i.unit || ' — order now.', '/m/supply',
         now() - make_interval(mins => (20 + row_number() over (order by i.sort) * 7)::int)
  from public.rh_items i
  where i.org_id = p_org and i.section = 'pantry' and public.rh_item_status(i.qty_store, i.warn_qty, i.min_qty) = 'red'
  order by i.sort limit 3;

  -- recent activity for the team
  update public.rh_profiles set last_seen_at = now() - interval '6 minutes' where id = v_c1;
  update public.rh_profiles set last_seen_at = now() - interval '19 minutes' where id = v_c2 and v_c2 <> v_c1;

  update public.rh_orgs set demo_seeded_on = v_today where id = p_org;
end $$;

-- called by the app right after a demo login (re-seeds once per day, or on demand by the demo manager)
create or replace function public.rh_demo_refresh(p_force boolean default false) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.rh_my_org(); o record;
begin
  if v_org is null then return false; end if;
  select * into o from public.rh_orgs where id = v_org for update;
  if not o.is_demo then return false; end if;
  if p_force and not public.rh_is_manager() then raise exception 'Only the demo manager can reset the demo'; end if;
  if p_force or o.demo_seeded_on is distinct from public.rh_org_today(v_org) then
    perform public.rh_seed_demo(v_org);
    return true;
  end if;
  return false;
end $$;

revoke execute on function public.rh_seed_demo(uuid) from public, anon, authenticated;
grant execute on function public.rh_seed_demo(uuid) to service_role;
revoke execute on function public.rh_demo_refresh(boolean) from public, anon;
grant execute on function public.rh_demo_refresh(boolean) to authenticated;
