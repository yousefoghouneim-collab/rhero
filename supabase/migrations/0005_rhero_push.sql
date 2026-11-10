-- =====================================================================
-- RHero 0005: phone push notifications (Web Push via the rh-push edge function)
-- VAPID keys and the hook secret live in rh_config (no client access).
-- Values are set once at deploy time:
--   insert into rh_config(key,value) values ('vapid_public', '<public key>'), ('vapid_jwk', '{"x":..,"y":..,"d":..}'),
--     ('vapid_subject','mailto:...'), ('push_hook_secret','<random>') on conflict (key) do update set value = excluded.value;
-- =====================================================================
create or replace function public.rh_push_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if public.rh_seeding() then return null; end if;
  if not exists (select 1 from public.rh_push_subs where user_id = new.user_id) then return null; end if;
  select value into v_secret from public.rh_config where key = 'push_hook_secret';
  if v_secret is null then return null; end if;
  perform net.http_post(
    url := 'https://yxmyavagjafymwnejaqp.supabase.co/functions/v1/rh-push',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-rh-hook', v_secret)
  );
  return null;
exception when others then
  return null; -- never block a notification because of push
end $$;

drop trigger if exists rh_push_notify on public.rh_notifications;
create trigger rh_push_notify after insert on public.rh_notifications for each row execute function public.rh_push_notify();
revoke execute on function public.rh_push_notify() from public, anon, authenticated;
