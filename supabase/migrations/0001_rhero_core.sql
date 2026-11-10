-- =====================================================================
-- RHero — office operations for RH Aero Systems (Dubai)
-- 0001: core schema, helpers, triggers, RLS, realtime, storage
-- All objects are prefixed rh_ so they live safely beside other apps
-- in this shared Supabase project.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.rh_orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  is_demo boolean not null default false,
  timezone text not null default 'Asia/Dubai',
  settings jsonb not null default jsonb_build_object(
    'report_time', '16:00',
    'work_days', jsonb_build_array(1,2,3,4,5),
    'shift_start', '08:30',
    'shift_end', '17:30',
    'staff_arrival', '09:00',
    'currency', 'AED'
  ),
  form_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  demo_seeded_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.rh_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('manager','cleaner')),
  phone text,
  email text,
  language text not null default 'en',
  color text,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rh_profiles_org_idx on public.rh_profiles(org_id);
create unique index if not exists rh_profiles_phone_uniq on public.rh_profiles(phone) where phone is not null;

create table if not exists public.rh_areas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  icon text not null default '🧹',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rh_areas_org_idx on public.rh_areas(org_id);

create table if not exists public.rh_routines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  description text,
  kind text not null default 'cleaning' check (kind in ('cleaning','toilets','stock')),
  start_time time not null,
  end_time time not null,
  days int[] not null default '{1,2,3,4,5}',
  color text not null default 'navy',
  icon text not null default '🧹',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists rh_routines_org_idx on public.rh_routines(org_id);

create table if not exists public.rh_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  routine_id uuid not null references public.rh_routines(id) on delete cascade,
  area_id uuid references public.rh_areas(id) on delete set null,
  title text not null,
  title_i18n jsonb not null default '{}'::jsonb,
  days int[],
  assignee_id uuid references public.rh_profiles(id) on delete set null,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rh_tasks_org_idx on public.rh_tasks(org_id);
create index if not exists rh_tasks_routine_idx on public.rh_tasks(routine_id);

create table if not exists public.rh_task_done (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  task_id uuid not null references public.rh_tasks(id) on delete cascade,
  routine_id uuid not null references public.rh_routines(id) on delete cascade,
  day date not null,
  done_by uuid references public.rh_profiles(id) on delete set null,
  done_at timestamptz not null default now(),
  note text,
  photo_path text,
  unique (task_id, day)
);
create index if not exists rh_task_done_org_day_idx on public.rh_task_done(org_id, day);

create table if not exists public.rh_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  code text,
  name text not null,
  section text not null check (section in ('pantry','stationery')),
  category text not null,
  unit text not null default 'piece',
  pack_info text,
  track_opened boolean not null default true,
  par_qty numeric not null default 0 check (par_qty >= 0),
  warn_qty numeric not null default 0 check (warn_qty >= 0),
  min_qty numeric not null default 0 check (min_qty >= 0),
  monthly_usage numeric,
  supplier text,
  supplier_url text,
  unit_price numeric,
  emoji text,
  location text,
  sort int not null default 0,
  active boolean not null default true,
  qty_opened numeric not null default 0,
  qty_store numeric not null default 0,
  last_counted_at timestamptz,
  last_counted_by uuid references public.rh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rh_items_org_idx on public.rh_items(org_id, section);

create table if not exists public.rh_stock_counts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  item_id uuid not null references public.rh_items(id) on delete cascade,
  day date not null,
  qty_opened numeric not null default 0 check (qty_opened >= 0),
  qty_store numeric not null default 0 check (qty_store >= 0),
  prev_total numeric,
  received_since numeric not null default 0,
  used numeric,
  counted_by uuid references public.rh_profiles(id) on delete set null,
  counted_at timestamptz not null default now(),
  note text,
  unique (item_id, day)
);
create index if not exists rh_stock_counts_org_day_idx on public.rh_stock_counts(org_id, day);

create table if not exists public.rh_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  ref text,
  supplier text,
  status text not null default 'draft' check (status in ('draft','ordered','partial','received','cancelled')),
  notes text,
  created_by uuid references public.rh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  ordered_at timestamptz,
  expected_on date,
  received_at timestamptz
);
create index if not exists rh_orders_org_idx on public.rh_orders(org_id, created_at desc);

create table if not exists public.rh_order_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  order_id uuid not null references public.rh_orders(id) on delete cascade,
  item_id uuid references public.rh_items(id) on delete set null,
  name text not null,
  unit text,
  qty numeric not null check (qty > 0),
  unit_price numeric,
  received_qty numeric not null default 0
);
create index if not exists rh_order_lines_order_idx on public.rh_order_lines(order_id);

create table if not exists public.rh_stock_moves (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  item_id uuid not null references public.rh_items(id) on delete cascade,
  kind text not null check (kind in ('receive','adjust')),
  qty numeric not null,
  order_id uuid references public.rh_orders(id) on delete set null,
  note text,
  created_by uuid references public.rh_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists rh_stock_moves_item_idx on public.rh_stock_moves(item_id, created_at);

create table if not exists public.rh_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  ref text,
  title text not null,
  category text not null default 'Other',
  qty numeric not null default 1,
  specs text,
  reason text,
  link text,
  needed_by date,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  requester_name text,
  requester_email text,
  requester_phone text,
  department text,
  est_unit_cost numeric,
  supplier text,
  po_number text,
  status text not null default 'new' check (status in ('new','approved','ordered','delivered','rejected','on_hold')),
  notes text,
  source text not null default 'manager' check (source in ('manager','form')),
  created_by uuid references public.rh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rh_requests_org_idx on public.rh_requests(org_id, created_at desc);

create table if not exists public.rh_visitor_passes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  ref text,
  visitor_name text not null,
  id_type text not null default 'emirates_id' check (id_type in ('emirates_id','passport','other')),
  id_number text not null,
  nationality text,
  email text,
  phone text,
  company text,
  occupation text,
  visit_reason text not null,
  visit_date date not null,
  arrival_time time,
  departure_time time,
  host_name text not null,
  host_team text,
  host_email text,
  host_phone text,
  vehicle_plate text,
  equipment text,
  extra_visitors jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','issued','rejected','completed')),
  source text not null default 'manager' check (source in ('manager','form')),
  created_by uuid references public.rh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rh_visitor_passes_org_idx on public.rh_visitor_passes(org_id, visit_date desc);

create table if not exists public.rh_issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  area_id uuid references public.rh_areas(id) on delete set null,
  item_id uuid references public.rh_items(id) on delete set null,
  kind text not null default 'other' check (kind in ('supply','broken','spill','pest','other')),
  note text,
  photo_path text,
  status text not null default 'open' check (status in ('open','resolved')),
  reported_by uuid references public.rh_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.rh_profiles(id) on delete set null
);
create index if not exists rh_issues_org_idx on public.rh_issues(org_id, created_at desc);

create table if not exists public.rh_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  user_id uuid not null references public.rh_profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists rh_notifications_user_idx on public.rh_notifications(user_id, created_at desc);

create table if not exists public.rh_daily_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  day date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (org_id, day)
);

create table if not exists public.rh_push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.rh_profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.rh_counters (
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  prefix text not null,
  period text not null,
  n int not null default 0,
  primary key (org_id, prefix, period)
);

create table if not exists public.rh_alert_log (
  org_id uuid not null references public.rh_orgs(id) on delete cascade,
  key text not null,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (org_id, key, day)
);

-- internal key/value config (no client access)
create table if not exists public.rh_config (
  key text primary key,
  value text not null
);

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------
create or replace function public.rh_my_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.rh_profiles where id = auth.uid() and active
$$;

create or replace function public.rh_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.rh_profiles where id = auth.uid() and active and role = 'manager')
$$;

create or replace function public.rh_org_now(p_org uuid) returns timestamp
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select timezone from public.rh_orgs where id = p_org), 'Asia/Dubai'))
$$;

create or replace function public.rh_org_today(p_org uuid) returns date
language sql stable security definer set search_path = public as $$
  select public.rh_org_now(p_org)::date
$$;

create or replace function public.rh_item_status(p_store numeric, p_warn numeric, p_min numeric) returns text
language sql immutable as $$
  select case when p_store <= p_min then 'red' when p_store <= p_warn then 'orange' else 'green' end
$$;

-- true while the demo seeder is running (skips per-user checks in triggers)
create or replace function public.rh_seeding() returns boolean
language sql stable as $$ select coalesce(current_setting('rh.seeding', true), '') = 'on' $$;

create or replace function public.rh_next_ref(p_org uuid, p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare v_period text := to_char(public.rh_org_now(p_org), 'YYMM'); v_n int;
begin
  insert into public.rh_counters(org_id, prefix, period, n) values (p_org, p_prefix, v_period, 1)
  on conflict (org_id, prefix, period) do update set n = public.rh_counters.n + 1
  returning n into v_n;
  return p_prefix || '-' || v_period || '-' || lpad(v_n::text, 3, '0');
end $$;

-- notify every active manager of an org
create or replace function public.rh_notify_managers(p_org uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.rh_notifications(org_id, user_id, kind, title, body, link)
  select p_org, p.id, p_kind, p_title, p_body, p_link
  from public.rh_profiles p where p.org_id = p_org and p.role = 'manager' and p.active
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.rh_touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists rh_items_updated on public.rh_items;
create trigger rh_items_updated before update on public.rh_items for each row execute function public.rh_touch_updated_at();
drop trigger if exists rh_requests_updated on public.rh_requests;
create trigger rh_requests_updated before update on public.rh_requests for each row execute function public.rh_touch_updated_at();
drop trigger if exists rh_passes_updated on public.rh_visitor_passes;
create trigger rh_passes_updated before update on public.rh_visitor_passes for each row execute function public.rh_touch_updated_at();

-- translations become stale when the English title changes
create or replace function public.rh_tasks_title_changed() returns trigger
language plpgsql as $$
begin
  if new.title is distinct from old.title and new.title_i18n = old.title_i18n then
    new.title_i18n := '{}'::jsonb;
  end if;
  return new;
end $$;
drop trigger if exists rh_tasks_title on public.rh_tasks;
create trigger rh_tasks_title before update on public.rh_tasks for each row execute function public.rh_tasks_title_changed();

create or replace function public.rh_areas_name_changed() returns trigger
language plpgsql as $$
begin
  if new.name is distinct from old.name and new.name_i18n = old.name_i18n then new.name_i18n := '{}'::jsonb; end if;
  return new;
end $$;
drop trigger if exists rh_areas_name on public.rh_areas;
create trigger rh_areas_name before update on public.rh_areas for each row execute function public.rh_areas_name_changed();
drop trigger if exists rh_routines_name on public.rh_routines;
create trigger rh_routines_name before update on public.rh_routines for each row execute function public.rh_areas_name_changed();

-- task completion: fill org/routine from the task, stamp who did it
create or replace function public.rh_task_done_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; v_today date;
begin
  select org_id, routine_id into t from public.rh_tasks where id = new.task_id;
  if t.org_id is null then raise exception 'Unknown task'; end if;
  new.org_id := t.org_id;
  new.routine_id := t.routine_id;
  if auth.uid() is not null and not public.rh_seeding() then
    new.done_by := coalesce(new.done_by, auth.uid());
    if not public.rh_is_manager() then
      new.done_by := auth.uid();
      v_today := public.rh_org_today(t.org_id);
      if new.day not in (v_today, v_today - 1) then
        raise exception 'Tasks can only be marked for today';
      end if;
      -- never accept a completion time in the future
      if new.done_at > now() + interval '5 minutes' then new.done_at := now(); end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists rh_task_done_fill on public.rh_task_done;
create trigger rh_task_done_fill before insert on public.rh_task_done for each row execute function public.rh_task_done_fill();

-- stock count: compute usage since the previous count
create or replace function public.rh_stock_count_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare i record; prev record;
begin
  select org_id into i from public.rh_items where id = new.item_id;
  if i.org_id is null then raise exception 'Unknown item'; end if;
  new.org_id := i.org_id;
  if not public.rh_seeding() then
    if tg_op = 'UPDATE' then new.counted_at := now(); end if;
    if auth.uid() is not null then new.counted_by := auth.uid(); end if;
  end if;

  select c.qty_opened + c.qty_store as total, c.counted_at into prev
  from public.rh_stock_counts c
  where c.item_id = new.item_id and c.day < new.day
  order by c.day desc limit 1;

  if prev.total is null then
    new.prev_total := null; new.received_since := 0; new.used := null;
  else
    new.prev_total := prev.total;
    select coalesce(sum(m.qty), 0) into new.received_since
    from public.rh_stock_moves m
    where m.item_id = new.item_id and m.created_at > prev.counted_at and m.created_at <= new.counted_at;
    new.used := new.prev_total + new.received_since - (new.qty_opened + new.qty_store);
  end if;
  return new;
end $$;
drop trigger if exists rh_stock_count_fill on public.rh_stock_counts;
create trigger rh_stock_count_fill before insert or update on public.rh_stock_counts for each row execute function public.rh_stock_count_fill();

create or replace function public.rh_stock_count_apply() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record; v_latest date; v_after numeric; v_new_status text; v_old_status text;
begin
  select max(day) into v_latest from public.rh_stock_counts where item_id = new.item_id;
  if new.day < v_latest then return null; end if;

  select * into it from public.rh_items where id = new.item_id;
  select coalesce(sum(qty), 0) into v_after from public.rh_stock_moves
   where item_id = new.item_id and created_at > new.counted_at;

  v_old_status := public.rh_item_status(it.qty_store, it.warn_qty, it.min_qty);
  update public.rh_items set
    qty_opened = new.qty_opened,
    qty_store = new.qty_store + v_after,
    last_counted_at = new.counted_at,
    last_counted_by = new.counted_by
  where id = new.item_id;
  v_new_status := public.rh_item_status(new.qty_store + v_after, it.warn_qty, it.min_qty);

  if v_new_status = 'red' and v_old_status <> 'red' and it.active and not public.rh_seeding() then
    perform public.rh_notify_managers(it.org_id, 'stock_red',
      it.name || ' is running out',
      'In store: ' || trim(to_char(new.qty_store + v_after, 'FM999990.##')) || ' ' || it.unit ||
      case when it.track_opened then ' · opened: ' || trim(to_char(new.qty_opened, 'FM999990.##')) else '' end ||
      ' — order now.',
      '/m/supply');
  end if;
  return null;
end $$;
drop trigger if exists rh_stock_count_apply on public.rh_stock_counts;
create trigger rh_stock_count_apply after insert or update on public.rh_stock_counts for each row execute function public.rh_stock_count_apply();

-- stock moves (deliveries / adjustments) change the store quantity
create or replace function public.rh_stock_move_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select org_id into new.org_id from public.rh_items where id = new.item_id;
  if new.org_id is null then raise exception 'Unknown item'; end if;
  if auth.uid() is not null and not public.rh_seeding() then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  return new;
end $$;
drop trigger if exists rh_stock_move_fill on public.rh_stock_moves;
create trigger rh_stock_move_fill before insert on public.rh_stock_moves for each row execute function public.rh_stock_move_fill();

create or replace function public.rh_stock_move_apply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.rh_items set qty_store = greatest(qty_store + new.qty, 0) where id = new.item_id;
  elsif tg_op = 'DELETE' then
    update public.rh_items set qty_store = greatest(qty_store - old.qty, 0) where id = old.item_id;
  end if;
  return null;
end $$;
drop trigger if exists rh_stock_move_apply on public.rh_stock_moves;
create trigger rh_stock_move_apply after insert or delete on public.rh_stock_moves for each row execute function public.rh_stock_move_apply();

-- references (PO / RQ / GP numbers)
create or replace function public.rh_fill_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref is null then new.ref := public.rh_next_ref(new.org_id, tg_argv[0]); end if;
  return new;
end $$;
drop trigger if exists rh_orders_ref on public.rh_orders;
create trigger rh_orders_ref before insert on public.rh_orders for each row execute function public.rh_fill_ref('PO');
drop trigger if exists rh_requests_ref on public.rh_requests;
create trigger rh_requests_ref before insert on public.rh_requests for each row execute function public.rh_fill_ref('RQ');
drop trigger if exists rh_passes_ref on public.rh_visitor_passes;
create trigger rh_passes_ref before insert on public.rh_visitor_passes for each row execute function public.rh_fill_ref('GP');

create or replace function public.rh_order_line_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select org_id into new.org_id from public.rh_orders where id = new.order_id;
  return new;
end $$;
drop trigger if exists rh_order_line_fill on public.rh_order_lines;
create trigger rh_order_line_fill before insert on public.rh_order_lines for each row execute function public.rh_order_line_fill();

-- issues & form submissions notify the office manager
create or replace function public.rh_issue_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_area text; v_who text;
begin
  if auth.uid() is not null and not public.rh_seeding() then new.reported_by := auth.uid(); end if;
  select org_id into new.org_id from public.rh_profiles where id = new.reported_by;
  if new.org_id is null then raise exception 'Not allowed'; end if;
  if public.rh_seeding() then return new; end if;
  select name into v_area from public.rh_areas where id = new.area_id;
  select full_name into v_who from public.rh_profiles where id = new.reported_by;
  perform public.rh_notify_managers(new.org_id, 'issue',
    case new.kind when 'supply' then 'Supplies needed' when 'broken' then 'Something is broken'
      when 'spill' then 'Spill / mess reported' when 'pest' then 'Pests reported' else 'Issue reported' end
      || coalesce(' · ' || v_area, ''),
    coalesce(new.note, '') || case when v_who is not null then ' — ' || v_who else '' end,
    '/m/cleaning?tab=issues');
  return new;
end $$;
drop trigger if exists rh_issue_notify on public.rh_issues;
create trigger rh_issue_notify before insert on public.rh_issues for each row execute function public.rh_issue_notify();

create or replace function public.rh_request_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'form' and not public.rh_seeding() then
    perform public.rh_notify_managers(new.org_id, 'request',
      'New item request: ' || new.title,
      coalesce(new.requester_name, 'Someone') || coalesce(' (' || new.department || ')', '') || ' · qty ' || trim(to_char(new.qty, 'FM999990.##')),
      '/m/requests');
  end if;
  return null;
end $$;
drop trigger if exists rh_request_notify on public.rh_requests;
create trigger rh_request_notify after insert on public.rh_requests for each row execute function public.rh_request_notify();

create or replace function public.rh_pass_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'form' and not public.rh_seeding() then
    perform public.rh_notify_managers(new.org_id, 'pass',
      'Gate pass request: ' || new.visitor_name,
      'Visit ' || to_char(new.visit_date, 'Dy DD Mon') || ' · host ' || new.host_name,
      '/m/passes');
  end if;
  return null;
end $$;
drop trigger if exists rh_pass_notify on public.rh_visitor_passes;
create trigger rh_pass_notify after insert on public.rh_visitor_passes for each row execute function public.rh_pass_notify();

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.rh_orgs enable row level security;
alter table public.rh_profiles enable row level security;
alter table public.rh_areas enable row level security;
alter table public.rh_routines enable row level security;
alter table public.rh_tasks enable row level security;
alter table public.rh_task_done enable row level security;
alter table public.rh_items enable row level security;
alter table public.rh_stock_counts enable row level security;
alter table public.rh_orders enable row level security;
alter table public.rh_order_lines enable row level security;
alter table public.rh_stock_moves enable row level security;
alter table public.rh_requests enable row level security;
alter table public.rh_visitor_passes enable row level security;
alter table public.rh_issues enable row level security;
alter table public.rh_notifications enable row level security;
alter table public.rh_daily_reports enable row level security;
alter table public.rh_push_subs enable row level security;
alter table public.rh_counters enable row level security;
alter table public.rh_alert_log enable row level security;
alter table public.rh_config enable row level security;

-- nothing for anonymous visitors (public forms go through RPCs)
revoke all on public.rh_orgs, public.rh_profiles, public.rh_areas, public.rh_routines, public.rh_tasks,
  public.rh_task_done, public.rh_items, public.rh_stock_counts, public.rh_orders, public.rh_order_lines,
  public.rh_stock_moves, public.rh_requests, public.rh_visitor_passes, public.rh_issues, public.rh_notifications,
  public.rh_daily_reports, public.rh_push_subs, public.rh_counters, public.rh_alert_log, public.rh_config
  from anon;
revoke all on public.rh_counters, public.rh_alert_log, public.rh_config from authenticated;

-- orgs
drop policy if exists rh_orgs_sel on public.rh_orgs;
create policy rh_orgs_sel on public.rh_orgs for select to authenticated using (id = (select public.rh_my_org()));
drop policy if exists rh_orgs_upd on public.rh_orgs;
create policy rh_orgs_upd on public.rh_orgs for update to authenticated
  using (id = (select public.rh_my_org()) and (select public.rh_is_manager()))
  with check (id = (select public.rh_my_org()));

-- profiles (writes go through the rh-admin edge function / RPCs)
drop policy if exists rh_profiles_sel on public.rh_profiles;
create policy rh_profiles_sel on public.rh_profiles for select to authenticated using (org_id = (select public.rh_my_org()));

-- config tables: members read, managers write
do $$
declare t text;
begin
  foreach t in array array['rh_areas','rh_routines','rh_tasks','rh_items'] loop
    execute format('drop policy if exists %1$s_sel on public.%1$s', t);
    execute format('create policy %1$s_sel on public.%1$s for select to authenticated using (org_id = (select public.rh_my_org()))', t);
    execute format('drop policy if exists %1$s_ins on public.%1$s', t);
    execute format('create policy %1$s_ins on public.%1$s for insert to authenticated with check (org_id = (select public.rh_my_org()) and (select public.rh_is_manager()))', t);
    execute format('drop policy if exists %1$s_upd on public.%1$s', t);
    execute format('create policy %1$s_upd on public.%1$s for update to authenticated using (org_id = (select public.rh_my_org()) and (select public.rh_is_manager())) with check (org_id = (select public.rh_my_org()))', t);
    execute format('drop policy if exists %1$s_del on public.%1$s', t);
    execute format('create policy %1$s_del on public.%1$s for delete to authenticated using (org_id = (select public.rh_my_org()) and (select public.rh_is_manager()))', t);
  end loop;
end $$;

-- task completions
drop policy if exists rh_task_done_sel on public.rh_task_done;
create policy rh_task_done_sel on public.rh_task_done for select to authenticated using (org_id = (select public.rh_my_org()));
drop policy if exists rh_task_done_ins on public.rh_task_done;
create policy rh_task_done_ins on public.rh_task_done for insert to authenticated with check (org_id = (select public.rh_my_org()));
drop policy if exists rh_task_done_upd on public.rh_task_done;
create policy rh_task_done_upd on public.rh_task_done for update to authenticated
  using (org_id = (select public.rh_my_org()) and (done_by = auth.uid() or (select public.rh_is_manager())))
  with check (org_id = (select public.rh_my_org()));
drop policy if exists rh_task_done_del on public.rh_task_done;
create policy rh_task_done_del on public.rh_task_done for delete to authenticated
  using (org_id = (select public.rh_my_org()) and (done_by = auth.uid() or (select public.rh_is_manager())));

-- stock counts: cleaners count pantry items (today), managers everything
drop policy if exists rh_stock_counts_sel on public.rh_stock_counts;
create policy rh_stock_counts_sel on public.rh_stock_counts for select to authenticated using (org_id = (select public.rh_my_org()));
drop policy if exists rh_stock_counts_ins on public.rh_stock_counts;
create policy rh_stock_counts_ins on public.rh_stock_counts for insert to authenticated with check (
  org_id = (select public.rh_my_org()) and (
    (select public.rh_is_manager()) or
    (day >= public.rh_org_today(org_id) - 1 and exists (select 1 from public.rh_items i where i.id = item_id and i.section = 'pantry'))
  ));
drop policy if exists rh_stock_counts_upd on public.rh_stock_counts;
create policy rh_stock_counts_upd on public.rh_stock_counts for update to authenticated
  using (org_id = (select public.rh_my_org()) and ((select public.rh_is_manager()) or day >= public.rh_org_today(org_id) - 1))
  with check (org_id = (select public.rh_my_org()));
drop policy if exists rh_stock_counts_del on public.rh_stock_counts;
create policy rh_stock_counts_del on public.rh_stock_counts for delete to authenticated
  using (org_id = (select public.rh_my_org()) and (select public.rh_is_manager()));

-- manager-only tables
do $$
declare t text;
begin
  foreach t in array array['rh_orders','rh_order_lines','rh_stock_moves','rh_requests','rh_visitor_passes'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all to authenticated using (org_id = (select public.rh_my_org()) and (select public.rh_is_manager())) with check (org_id = (select public.rh_my_org()) and (select public.rh_is_manager()))', t);
  end loop;
end $$;

-- issues
drop policy if exists rh_issues_sel on public.rh_issues;
create policy rh_issues_sel on public.rh_issues for select to authenticated using (org_id = (select public.rh_my_org()));
drop policy if exists rh_issues_ins on public.rh_issues;
create policy rh_issues_ins on public.rh_issues for insert to authenticated with check (org_id = (select public.rh_my_org()));
drop policy if exists rh_issues_upd on public.rh_issues;
create policy rh_issues_upd on public.rh_issues for update to authenticated
  using (org_id = (select public.rh_my_org()) and (select public.rh_is_manager())) with check (org_id = (select public.rh_my_org()));
drop policy if exists rh_issues_del on public.rh_issues;
create policy rh_issues_del on public.rh_issues for delete to authenticated
  using (org_id = (select public.rh_my_org()) and (select public.rh_is_manager()));

-- notifications: own only
drop policy if exists rh_notifications_sel on public.rh_notifications;
create policy rh_notifications_sel on public.rh_notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists rh_notifications_upd on public.rh_notifications;
create policy rh_notifications_upd on public.rh_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists rh_notifications_del on public.rh_notifications;
create policy rh_notifications_del on public.rh_notifications for delete to authenticated using (user_id = auth.uid());

-- daily reports: managers
drop policy if exists rh_daily_reports_sel on public.rh_daily_reports;
create policy rh_daily_reports_sel on public.rh_daily_reports for select to authenticated
  using (org_id = (select public.rh_my_org()) and (select public.rh_is_manager()));

-- push subscriptions: own
drop policy if exists rh_push_subs_all on public.rh_push_subs;
create policy rh_push_subs_all on public.rh_push_subs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Realtime (live dashboard)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['rh_task_done','rh_stock_counts','rh_items','rh_issues','rh_requests','rh_visitor_passes',
                           'rh_notifications','rh_orders','rh_daily_reports','rh_tasks','rh_routines','rh_areas','rh_profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Storage for issue / task photos (private bucket, org folders)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rhero', 'rhero', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists rhero_obj_sel on storage.objects;
create policy rhero_obj_sel on storage.objects for select to authenticated
  using (bucket_id = 'rhero' and (storage.foldername(name))[1] = (select public.rh_my_org())::text);
drop policy if exists rhero_obj_ins on storage.objects;
create policy rhero_obj_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'rhero' and (storage.foldername(name))[1] = (select public.rh_my_org())::text);
drop policy if exists rhero_obj_del on storage.objects;
create policy rhero_obj_del on storage.objects for delete to authenticated
  using (bucket_id = 'rhero' and (storage.foldername(name))[1] = (select public.rh_my_org())::text and (select public.rh_is_manager()));
