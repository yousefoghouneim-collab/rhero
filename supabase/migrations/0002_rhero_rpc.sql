-- =====================================================================
-- RHero 0002: RPCs, daily report, round alerts, public forms, cron
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- Profile heartbeat / language
-- ---------------------------------------------------------------------
create or replace function public.rh_touch(p_language text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.rh_profiles
     set last_seen_at = now(),
         language = case when p_language in ('en','ar','hi','ur','bn','ml','tl') then p_language else language end
   where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Receive a supply order (adds stock)
-- p_lines: [{ "id": <order_line_id>, "qty": <received now> }]  (omitted lines = receive remaining)
-- ---------------------------------------------------------------------
create or replace function public.rh_receive_order(p_order uuid, p_lines jsonb default '[]'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o record; l record; v_qty numeric; v_all boolean := true; v_given numeric;
begin
  select * into o from public.rh_orders where id = p_order;
  if o.id is null or o.org_id is distinct from public.rh_my_org() or not public.rh_is_manager() then
    raise exception 'Not allowed';
  end if;
  if o.status in ('received','cancelled') then raise exception 'This order is already closed'; end if;

  for l in select * from public.rh_order_lines where order_id = p_order loop
    v_given := null;
    select (x->>'qty')::numeric into v_given from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) x where (x->>'id')::uuid = l.id;
    v_qty := greatest(coalesce(v_given, l.qty - l.received_qty), 0);
    if v_qty > 0 then
      update public.rh_order_lines set received_qty = received_qty + v_qty where id = l.id;
      if l.item_id is not null then
        insert into public.rh_stock_moves(item_id, kind, qty, order_id, note)
        values (l.item_id, 'receive', v_qty, p_order, 'Received · ' || o.ref);
      end if;
    end if;
    if l.received_qty + v_qty < l.qty then v_all := false; end if;
  end loop;

  update public.rh_orders
     set status = case when v_all then 'received' else 'partial' end,
         received_at = case when v_all then now() else received_at end,
         ordered_at = coalesce(ordered_at, now())
   where id = p_order;
end $$;

-- ---------------------------------------------------------------------
-- Daily report (cleaning + stock + issues + requests)
-- ---------------------------------------------------------------------
create or replace function public.rh_build_report(p_org uuid, p_day date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text; v_dow int := extract(isodow from p_day)::int; v_today date;
  v_routines jsonb; v_cleaners jsonb; v_stock jsonb; v_issues jsonb; v_requests jsonb; v_passes jsonb;
  v_total int; v_done int; v_late int; v_stock_routine record;
begin
  select timezone into v_tz from public.rh_orgs where id = p_org;
  v_today := public.rh_org_today(p_org);

  with due as (
    select t.id, t.title, t.routine_id, a.name as area, r.name as routine, r.kind, r.icon,
           r.start_time, r.end_time, r.sort as rsort, t.sort as tsort
    from public.rh_tasks t
    join public.rh_routines r on r.id = t.routine_id
    left join public.rh_areas a on a.id = t.area_id
    where t.org_id = p_org and t.active and r.active and r.kind <> 'stock'
      and v_dow = any(r.days) and (t.days is null or v_dow = any(t.days))
  ), j as (
    select due.*, d.done_at, d.done_by,
           (d.done_at is not null and (d.done_at at time zone v_tz)::time > due.end_time) as late
    from due left join public.rh_task_done d on d.task_id = due.id and d.day = p_day
  ), g as (
    select routine_id, routine, kind, icon, start_time, end_time, rsort,
           count(*)::int as total, count(done_at)::int as done, (count(*) filter (where late))::int as late,
           min(done_at) as first_done, max(done_at) as last_done,
           coalesce(jsonb_agg(jsonb_build_object('title', title, 'area', area) order by tsort) filter (where done_at is null), '[]'::jsonb) as missed
    from j group by routine_id, routine, kind, icon, start_time, end_time, rsort
  )
  select coalesce(jsonb_agg(jsonb_build_object(
            'id', routine_id, 'name', routine, 'kind', kind, 'icon', icon,
            'start', to_char(start_time, 'HH24:MI'), 'end', to_char(end_time, 'HH24:MI'),
            'total', total, 'done', done, 'late', late,
            'first_done', first_done, 'last_done', last_done, 'missed', missed) order by rsort), '[]'::jsonb),
         coalesce(sum(total), 0), coalesce(sum(done), 0), coalesce(sum(late), 0)
    into v_routines, v_total, v_done, v_late
  from g;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'done', c.n) order by c.n desc), '[]'::jsonb)
    into v_cleaners
  from (select done_by, count(*)::int as n from public.rh_task_done where org_id = p_org and day = p_day group by done_by) c
  join public.rh_profiles p on p.id = c.done_by;

  select * into v_stock_routine from public.rh_routines
   where org_id = p_org and kind = 'stock' and active and v_dow = any(days) order by sort limit 1;

  with snap as (
    select i.id, i.name, i.emoji, i.unit, i.section, i.category, i.par_qty, i.warn_qty, i.min_qty, i.track_opened,
           case when p_day >= v_today then i.qty_store else c.qty_store end as s_store,
           case when p_day >= v_today then i.qty_opened else c.qty_opened end as s_opened
    from public.rh_items i
    left join public.rh_stock_counts c on c.item_id = i.id and c.day = p_day
    where i.org_id = p_org and i.active
      and ((p_day >= v_today and i.last_counted_at is not null) or c.id is not null)
  )
  select jsonb_build_object(
    'scheduled', v_stock_routine.id is not null,
    'total', (select count(*) from public.rh_items where org_id = p_org and active and section = 'pantry'),
    'counted', (select count(*) from public.rh_stock_counts c join public.rh_items i on i.id = c.item_id
                 where c.org_id = p_org and c.day = p_day and i.section = 'pantry'),
    'counted_at', (select max(counted_at) from public.rh_stock_counts where org_id = p_org and day = p_day),
    'counted_by', (select string_agg(distinct p.full_name, ', ') from public.rh_stock_counts c
                    join public.rh_profiles p on p.id = c.counted_by where c.org_id = p_org and c.day = p_day),
    'red', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'emoji', emoji, 'unit', unit, 'section', section,
              'store', s_store, 'opened', s_opened, 'min', min_qty, 'par', par_qty,
              'need', greatest(par_qty - s_store - s_opened, 0)) order by section, name), '[]'::jsonb)
            from snap where public.rh_item_status(s_store, warn_qty, min_qty) = 'red'),
    'orange', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'emoji', emoji, 'unit', unit, 'section', section,
              'store', s_store, 'opened', s_opened, 'min', min_qty, 'par', par_qty,
              'need', greatest(par_qty - s_store - s_opened, 0)) order by section, name), '[]'::jsonb)
            from snap where public.rh_item_status(s_store, warn_qty, min_qty) = 'orange'),
    'used', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'emoji', i.emoji, 'unit', i.unit, 'used', c.used)
              order by c.used desc), '[]'::jsonb)
             from public.rh_stock_counts c join public.rh_items i on i.id = c.item_id
             where c.org_id = p_org and c.day = p_day and c.used > 0)
  ) into v_stock;

  select jsonb_build_object(
    'new', coalesce((select jsonb_agg(jsonb_build_object('kind', i.kind, 'note', i.note, 'area', a.name, 'status', i.status,
               'at', i.created_at, 'by', p.full_name) order by i.created_at)
             from public.rh_issues i left join public.rh_areas a on a.id = i.area_id
             left join public.rh_profiles p on p.id = i.reported_by
             where i.org_id = p_org and (i.created_at at time zone v_tz)::date = p_day), '[]'::jsonb),
    'open', (select count(*) from public.rh_issues where org_id = p_org and status = 'open')
  ) into v_issues;

  select jsonb_build_object(
    'new_today', (select count(*) from public.rh_requests where org_id = p_org and (created_at at time zone v_tz)::date = p_day),
    'pending', (select count(*) from public.rh_requests where org_id = p_org and status in ('new','approved','on_hold'))
  ) into v_requests;

  select jsonb_build_object(
    'today', (select count(*) from public.rh_visitor_passes where org_id = p_org and visit_date = p_day and status <> 'rejected'),
    'pending', (select count(*) from public.rh_visitor_passes where org_id = p_org and status = 'pending')
  ) into v_passes;

  return jsonb_build_object(
    'day', p_day,
    'generated_at', now(),
    'cleaning', jsonb_build_object('total', v_total, 'done', v_done, 'late', v_late, 'routines', v_routines, 'cleaners', v_cleaners),
    'stock', v_stock,
    'issues', v_issues,
    'requests', v_requests,
    'passes', v_passes
  );
end $$;

-- live preview for the manager ("report so far")
create or replace function public.rh_report_preview(p_day date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public.rh_my_org();
begin
  if v_org is null or not public.rh_is_manager() then raise exception 'Not allowed'; end if;
  return public.rh_build_report(v_org, coalesce(p_day, public.rh_org_today(v_org)));
end $$;

-- (re)save today's report snapshot on demand
create or replace function public.rh_save_report(p_day date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.rh_my_org(); v_day date; v_data jsonb;
begin
  if v_org is null or not public.rh_is_manager() then raise exception 'Not allowed'; end if;
  v_day := coalesce(p_day, public.rh_org_today(v_org));
  v_data := public.rh_build_report(v_org, v_day);
  insert into public.rh_daily_reports(org_id, day, data) values (v_org, v_day, v_data)
  on conflict (org_id, day) do update set data = excluded.data, created_at = now();
  return v_data;
end $$;

-- ---------------------------------------------------------------------
-- Scheduler tick (every 5 min): round-end alerts + 4 PM daily report
-- ---------------------------------------------------------------------
create or replace function public.rh_cron_tick() returns void
language plpgsql security definer set search_path = public as $$
declare o record; r record; v_now timestamp; v_today date; v_dow int; v_report_time time;
        v_total int; v_done int; v_data jsonb; v_red int;
begin
  for o in select * from public.rh_orgs loop
    v_now := now() at time zone o.timezone;
    v_today := v_now::date;
    v_dow := extract(isodow from v_today)::int;

    -- 1) a round just ended: tell the manager if something was left undone
    for r in select * from public.rh_routines
             where org_id = o.id and active and v_dow = any(days)
               and end_time <= v_now::time and end_time > (v_now - interval '30 minutes')::time loop
      if not exists (select 1 from public.rh_alert_log where org_id = o.id and key = 'round:' || r.id and day = v_today) then
        insert into public.rh_alert_log(org_id, key, day) values (o.id, 'round:' || r.id, v_today) on conflict do nothing;
        if r.kind = 'stock' then
          select count(*) into v_total from public.rh_items where org_id = o.id and active and section = 'pantry';
          select count(*) into v_done from public.rh_stock_counts c join public.rh_items i on i.id = c.item_id
            where c.org_id = o.id and c.day = v_today and i.section = 'pantry';
          if v_done < v_total then
            perform public.rh_notify_managers(o.id, 'round', 'Stock count not finished',
              v_done || ' of ' || v_total || ' items counted by ' || to_char(r.end_time, 'HH24:MI'), '/m/inventory');
          end if;
        else
          select count(*), count(d.id) into v_total, v_done
          from public.rh_tasks t left join public.rh_task_done d on d.task_id = t.id and d.day = v_today
          where t.routine_id = r.id and t.active and (t.days is null or v_dow = any(t.days));
          if v_total > 0 and v_done < v_total then
            perform public.rh_notify_managers(o.id, 'round',
              r.name || ': ' || (v_total - v_done) || ' task' || case when v_total - v_done > 1 then 's' else '' end || ' not done',
              v_done || ' of ' || v_total || ' done by ' || to_char(r.end_time, 'HH24:MI'), '/m/cleaning');
          end if;
        end if;
      end if;
    end loop;

    -- 2) daily report at the configured time (default 16:00)
    v_report_time := coalesce(nullif(o.settings->>'report_time', '')::time, time '16:00');
    if coalesce(o.settings->'work_days', '[1,2,3,4,5]'::jsonb) @> to_jsonb(v_dow)
       and v_now::time >= v_report_time
       and not exists (select 1 from public.rh_daily_reports where org_id = o.id and day = v_today) then
      v_data := public.rh_build_report(o.id, v_today);
      insert into public.rh_daily_reports(org_id, day, data) values (o.id, v_today, v_data) on conflict do nothing;
      v_red := jsonb_array_length(v_data->'stock'->'red');
      perform public.rh_notify_managers(o.id, 'report',
        'Daily report · ' || to_char(v_today, 'Dy DD Mon'),
        'Cleaning ' || (v_data->'cleaning'->>'done') || '/' || (v_data->'cleaning'->>'total') ||
        ' · Stock counted ' || (v_data->'stock'->>'counted') || '/' || (v_data->'stock'->>'total') ||
        case when v_red > 0 then ' · ' || v_red || ' to order now' else ' · stock OK' end,
        '/m/reports/' || to_char(v_today, 'YYYY-MM-DD'));
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Public forms (no login): item request & gate pass
-- ---------------------------------------------------------------------
create or replace function public.rh_form_info(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('org', name, 'is_demo', is_demo) from public.rh_orgs where form_token = p_token
$$;

create or replace function public.rh_try_date(p text) returns date
language plpgsql immutable as $$ begin return nullif(p, '')::date; exception when others then return null; end $$;
create or replace function public.rh_try_time(p text) returns time
language plpgsql immutable as $$ begin return nullif(p, '')::time; exception when others then return null; end $$;
create or replace function public.rh_try_num(p text) returns numeric
language plpgsql immutable as $$ begin return nullif(p, '')::numeric; exception when others then return null; end $$;

create or replace function public.rh_submit_form(p_token text, p_kind text, p_data jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_ref text; v_recent int; v_date date;
begin
  select id into v_org from public.rh_orgs where form_token = p_token;
  if v_org is null then raise exception 'This form link is not valid'; end if;

  select count(*) into v_recent from (
    select 1 from public.rh_requests where org_id = v_org and source = 'form' and created_at > now() - interval '1 hour'
    union all
    select 1 from public.rh_visitor_passes where org_id = v_org and source = 'form' and created_at > now() - interval '1 hour'
  ) s;
  if v_recent >= 60 then raise exception 'Too many submissions right now — please try again later'; end if;

  if p_kind = 'request' then
    if coalesce(trim(p_data->>'title'), '') = '' then raise exception 'Please describe the item you need'; end if;
    if coalesce(trim(p_data->>'requester_name'), '') = '' then raise exception 'Please enter your name'; end if;
    insert into public.rh_requests(org_id, title, category, qty, specs, reason, link, needed_by, priority,
      requester_name, requester_email, requester_phone, department, est_unit_cost, source)
    values (v_org,
      left(trim(p_data->>'title'), 200),
      left(coalesce(nullif(trim(p_data->>'category'), ''), 'Other'), 60),
      greatest(coalesce(public.rh_try_num(p_data->>'qty'), 1), 1),
      left(p_data->>'specs', 2000), left(p_data->>'reason', 2000), left(p_data->>'link', 1000),
      public.rh_try_date(p_data->>'needed_by'),
      case when p_data->>'priority' in ('low','normal','high','urgent') then p_data->>'priority' else 'normal' end,
      left(trim(p_data->>'requester_name'), 120), left(p_data->>'requester_email', 200),
      left(p_data->>'requester_phone', 40), left(p_data->>'department', 120),
      public.rh_try_num(p_data->>'est_unit_cost'), 'form')
    returning ref into v_ref;
  elsif p_kind = 'pass' then
    v_date := public.rh_try_date(p_data->>'visit_date');
    if coalesce(trim(p_data->>'visitor_name'), '') = '' then raise exception 'Visitor name is required'; end if;
    if coalesce(trim(p_data->>'id_number'), '') = '' then raise exception 'Emirates ID or passport number is required'; end if;
    if coalesce(trim(p_data->>'visit_reason'), '') = '' then raise exception 'Reason for visit is required'; end if;
    if coalesce(trim(p_data->>'host_name'), '') = '' then raise exception 'Host (who they are meeting) is required'; end if;
    if v_date is null then raise exception 'Visit date is required'; end if;
    insert into public.rh_visitor_passes(org_id, visitor_name, id_type, id_number, nationality, email, phone, company,
      occupation, visit_reason, visit_date, arrival_time, departure_time, host_name, host_team, host_email, host_phone,
      vehicle_plate, equipment, extra_visitors, notes, source)
    values (v_org,
      left(trim(p_data->>'visitor_name'), 120),
      case when p_data->>'id_type' in ('emirates_id','passport','other') then p_data->>'id_type' else 'emirates_id' end,
      left(trim(p_data->>'id_number'), 40), left(p_data->>'nationality', 60), left(p_data->>'email', 200),
      left(p_data->>'phone', 40), left(p_data->>'company', 120), left(p_data->>'occupation', 120),
      left(p_data->>'visit_reason', 1000), v_date,
      public.rh_try_time(p_data->>'arrival_time'), public.rh_try_time(p_data->>'departure_time'),
      left(trim(p_data->>'host_name'), 120), left(p_data->>'host_team', 120), left(p_data->>'host_email', 200),
      left(p_data->>'host_phone', 40), left(p_data->>'vehicle_plate', 40), left(p_data->>'equipment', 1000),
      case when jsonb_typeof(p_data->'extra_visitors') = 'array' then p_data->'extra_visitors' else '[]'::jsonb end,
      left(p_data->>'notes', 2000), 'form')
    returning ref into v_ref;
  else
    raise exception 'Unknown form type';
  end if;
  return v_ref;
end $$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
revoke execute on function public.rh_build_report(uuid, date) from public, anon, authenticated;
revoke execute on function public.rh_cron_tick() from public, anon, authenticated;
revoke execute on function public.rh_notify_managers(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.rh_next_ref(uuid, text) from public, anon, authenticated;
revoke execute on function public.rh_touch(text) from public, anon;
revoke execute on function public.rh_receive_order(uuid, jsonb) from public, anon;
revoke execute on function public.rh_report_preview(date) from public, anon;
revoke execute on function public.rh_save_report(date) from public, anon;
grant execute on function public.rh_touch(text) to authenticated;
grant execute on function public.rh_receive_order(uuid, jsonb) to authenticated;
grant execute on function public.rh_report_preview(date) to authenticated;
grant execute on function public.rh_save_report(date) to authenticated;
grant execute on function public.rh_form_info(text) to anon, authenticated;
grant execute on function public.rh_submit_form(text, text, jsonb) to anon, authenticated;
grant execute on function public.rh_build_report(uuid, date) to service_role;
grant execute on function public.rh_notify_managers(uuid, text, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'rhero-tick') then
    perform cron.unschedule('rhero-tick');
  end if;
  perform cron.schedule('rhero-tick', '*/5 * * * *', 'select public.rh_cron_tick()');
end $$;
