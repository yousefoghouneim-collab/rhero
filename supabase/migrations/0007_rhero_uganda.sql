-- =====================================================================
-- RHero 0007: the cleaning team is from Uganda
--  * cleaners can pick Luganda (lg) and Kiswahili (sw) — any short language
--    code is accepted from now on, the app falls back to English
--  * existing areas / rounds / tasks get the lg + sw translations from the
--    default catalog (supabase/seed/catalog.json, loaded into rh_catalog)
--  * demo cleaners: Grace Nakato (Luganda) and Esther Akello (English)
-- =====================================================================
create or replace function public.rh_touch(p_language text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.rh_profiles
     set last_seen_at = now(),
         language = case when p_language ~ '^[a-z]{2,3}$' then p_language else language end
   where id = auth.uid();
end $$;
revoke execute on function public.rh_touch(text) from public, anon;
grant execute on function public.rh_touch(text) to authenticated;

-- copy the Luganda + Kiswahili names from the catalog into every workspace (matched on the English text)
with cat as (select data from public.rh_catalog where id = 1)
update public.rh_areas a
   set name_i18n = a.name_i18n || jsonb_build_object('lg', x->'i18n'->>'lg', 'sw', x->'i18n'->>'sw')
  from cat, jsonb_array_elements(cat.data->'areas') x
 where a.name = x->>'name' and x->'i18n' ? 'lg';

with cat as (select data from public.rh_catalog where id = 1)
update public.rh_routines r
   set name_i18n = r.name_i18n || jsonb_build_object('lg', x->'i18n'->>'lg', 'sw', x->'i18n'->>'sw')
  from cat, jsonb_array_elements(cat.data->'routines') x
 where r.name = x->>'name' and x->'i18n' ? 'lg';

with cat as (select data from public.rh_catalog where id = 1)
update public.rh_tasks t
   set title_i18n = t.title_i18n || jsonb_build_object('lg', x->'i18n'->>'lg', 'sw', x->'i18n'->>'sw')
  from cat, jsonb_array_elements(cat.data->'tasks') x
 where t.title = x->>'title' and x->'i18n' ? 'lg';

-- demo team
update public.rh_profiles p set full_name = 'Grace Nakato', language = 'lg'
  from public.rh_orgs o where o.id = p.org_id and o.is_demo and p.phone = '+971501111111';
update public.rh_profiles p set full_name = 'Esther Akello', language = 'en'
  from public.rh_orgs o where o.id = p.org_id and o.is_demo and p.phone = '+971502222222';

-- the demo notification names whoever is the first demo cleaner (no hard-coded name)
do $$
declare v_def text;
        v_old text := '''Dishwasher is leaking water under the door — Ramesh Kumar'',';
        v_new text := '''Dishwasher is leaking water under the door — '' || coalesce((select full_name from public.rh_profiles where id = v_c1), ''cleaner''),';
begin
  select pg_get_functiondef('public.rh_seed_demo(uuid)'::regprocedure) into v_def;
  if position(v_old in v_def) > 0 then
    execute replace(v_def, v_old, v_new);
  end if;
end $$;
