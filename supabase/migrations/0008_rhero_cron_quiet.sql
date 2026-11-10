-- =====================================================================
-- RHero 0008: round alerts and the daily report start once a workspace has
-- cleaners (a brand-new workspace stays quiet until the team is added)
-- =====================================================================
create or replace function public.rh_cron_tick() returns void
language plpgsql security definer set search_path = public as $$
declare o record; r record; v_now timestamp; v_today date; v_dow int; v_report_time time;
        v_total int; v_done int; v_data jsonb; v_red int;
begin
  for o in select * from public.rh_orgs loop
    v_now := now() at time zone o.timezone;
    v_today := v_now::date;
    v_dow := extract(isodow from v_today)::int;
    -- nothing to follow up until the office manager has added cleaners
    continue when not exists (select 1 from public.rh_profiles where org_id = o.id and role = 'cleaner' and active);

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
revoke execute on function public.rh_cron_tick() from public, anon, authenticated;
