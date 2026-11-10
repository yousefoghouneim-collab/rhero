-- RHero 0006: hardening suggested by the Supabase security advisor
alter function public.rh_item_status(numeric, numeric, numeric) set search_path = public;
alter function public.rh_seeding() set search_path = public;
alter function public.rh_touch_updated_at() set search_path = public;
alter function public.rh_tasks_title_changed() set search_path = public;
alter function public.rh_areas_name_changed() set search_path = public;
alter function public.rh_try_date(text) set search_path = public;
alter function public.rh_try_time(text) set search_path = public;
alter function public.rh_try_num(text) set search_path = public;

-- trigger functions are never called through the API
revoke execute on function public.rh_fill_ref(), public.rh_issue_notify(), public.rh_order_line_fill(), public.rh_pass_notify(),
  public.rh_request_notify(), public.rh_stock_count_apply(), public.rh_stock_count_fill(), public.rh_stock_move_apply(),
  public.rh_stock_move_fill(), public.rh_task_done_fill() from public, anon, authenticated;
-- helpers used by row-level security: signed-in users only
revoke execute on function public.rh_my_org(), public.rh_is_manager(), public.rh_org_now(uuid), public.rh_org_today(uuid) from public, anon;
grant execute on function public.rh_my_org(), public.rh_is_manager(), public.rh_org_now(uuid), public.rh_org_today(uuid) to authenticated;
