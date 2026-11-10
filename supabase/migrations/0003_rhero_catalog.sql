-- =====================================================================
-- RHero 0003: default catalog (data-driven)
-- The catalog JSON (supabase/seed/catalog.json) is stored in rh_catalog
-- (loaded by the rh-admin edge function) and copied into an org by
-- rh_seed_catalog(org).
-- =====================================================================
create table if not exists public.rh_catalog (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.rh_catalog enable row level security;
revoke all on public.rh_catalog from anon, authenticated;

create or replace function public.rh_seed_catalog(p_org uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_cat jsonb; a jsonb; r jsonb; t jsonb; v_id uuid; v_sort int;
  v_areas jsonb := '{}'::jsonb; v_routines jsonb := '{}'::jsonb; v_tsort jsonb := '{}'::jsonb;
begin
  select data into v_cat from public.rh_catalog where id = 1;
  if v_cat is null then raise exception 'Default catalog is not loaded'; end if;

  v_sort := 0;
  for a in select * from jsonb_array_elements(v_cat->'areas') loop
    v_sort := v_sort + 1;
    insert into public.rh_areas(org_id, name, name_i18n, icon, sort)
    values (p_org, a->>'name', coalesce(a->'i18n', '{}'::jsonb), coalesce(a->>'icon', '🧹'), v_sort)
    returning id into v_id;
    v_areas := v_areas || jsonb_build_object(a->>'key', v_id);
  end loop;

  v_sort := 0;
  for r in select * from jsonb_array_elements(v_cat->'routines') loop
    v_sort := v_sort + 1;
    insert into public.rh_routines(org_id, name, name_i18n, description, kind, start_time, end_time, icon, color, sort)
    values (p_org, r->>'name', coalesce(r->'i18n', '{}'::jsonb), r->>'desc', coalesce(r->>'kind', 'cleaning'),
            (r->>'start')::time, (r->>'end')::time, coalesce(r->>'icon', '🧹'), coalesce(r->>'color', 'navy'), v_sort)
    returning id into v_id;
    v_routines := v_routines || jsonb_build_object(r->>'key', v_id);
  end loop;

  for t in select * from jsonb_array_elements(v_cat->'tasks') loop
    v_tsort := v_tsort || jsonb_build_object(t->>'routine', coalesce((v_tsort->>(t->>'routine'))::int, 0) + 1);
    insert into public.rh_tasks(org_id, routine_id, area_id, title, title_i18n, days, sort)
    values (p_org, (v_routines->>(t->>'routine'))::uuid, (v_areas->>(t->>'area'))::uuid, t->>'title',
            coalesce(t->'i18n', '{}'::jsonb),
            case when jsonb_typeof(t->'days') = 'array'
                 then array(select jsonb_array_elements_text(t->'days')::int) end,
            (v_tsort->>(t->>'routine'))::int);
  end loop;

  insert into public.rh_items(org_id, code, name, section, category, unit, pack_info, track_opened,
    par_qty, warn_qty, min_qty, monthly_usage, supplier, supplier_url, unit_price, emoji, sort)
  select p_org, x->>'code', x->>'name', x->>'section', x->>'category', coalesce(x->>'unit', 'piece'),
         nullif(x->>'pack', ''), coalesce((x->>'opened')::boolean, true),
         coalesce((x->>'par')::numeric, 0), coalesce((x->>'warn')::numeric, 0), coalesce((x->>'min')::numeric, 0),
         (x->>'monthly')::numeric, nullif(x->>'supplier', ''), nullif(x->>'url', ''), (x->>'price')::numeric,
         x->>'emoji', ord::int
  from jsonb_array_elements(v_cat->'items') with ordinality as e(x, ord);
end $fn$;

revoke execute on function public.rh_seed_catalog(uuid) from public, anon, authenticated;
grant execute on function public.rh_seed_catalog(uuid) to service_role;
