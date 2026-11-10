# RHero

**Office operations for RH Aero Systems, Dubai South.** Built for the office manager and the cleaning team:
cleaning rounds the cleaners tick off on their phones, live pantry / cleaning / stationery stock with
red–orange–green warnings, a "to supply" list with purchase orders, employee item requests, gate-pass
requests and an automatic 4 PM daily report.

It installs like an app on iPhone and Android (PWA, "Add to Home Screen"), keeps working without
internet (ticks and counts are sent automatically when the phone is back online) and updates every
screen live.

---

## Try it

Open the app and tap one of the demo accounts on the sign-in screen (sample data, rebuilt every day):

| Who | Sign in with | Language |
| --- | --- | --- |
| Dina Maged — office manager | `dina@demo.rhero.app` · `RHero-demo-2026` | English |
| Grace Nakato — cleaner | phone `050 111 1111` · PIN `1111` | Luganda |
| Esther Akello — cleaner | phone `050 222 2222` · PIN `2222` | English |

Shortcut links: `/login?demo=manager`, `/login?demo=cleaner`, `/login?demo=cleaner2`.

The real workspace (RH Aero Systems — Dubai South) is separate from the demo and starts with the full
catalogue (rooms, rounds, tasks, 88 stock items) but no history.

## How the day works

| Time | Round | What happens |
| --- | --- | --- |
| 08:30–09:30 | **Morning deep clean** | Big round before staff arrive at 9: desks, offices, meeting rooms, reception, kitchen, floors, prayer room, toilets (toilet clean 1 of 3) |
| 13:00–14:00 | **Lunch refresh** | Small round during the 1 PM break: desks while staff are away, toilets (2 of 3), kitchen as the break ends |
| 15:00–15:30 | **Afternoon toilet check** | Toilet clean 3 of 3 and supplies refill |
| 15:30–16:00 | **Daily stock count** | Cleaners count every pantry & cleaning item: *opened* packs and sealed packs *in store* |
| 16:00 | **Daily report** | Cleaning done / missed, stock counted, what to order now, open problems. Shared by WhatsApp, email or print |

Weekly extras are built in (glass partitions on Tuesday, descaling on Wednesday, fridge clear-out on Friday).
Times, tasks, rooms and working days are all editable by the office manager.

### Stock colours

* **Red — order now:** sealed stock is at or below the minimum.
* **Orange — running low:** at or below the warning level.
* **Green — in stock.**

"To supply" shows, for every red/orange item, how many are needed to get back to the target level and how
many are available now. One tap turns the list into a purchase order (share, print, mark ordered,
receive — receiving adds the stock back).

## Cleaners

* Sign in with **phone number + PIN** — no email needed. UAE (`050 123 4567`) and Ugandan
  (`0772 123 456` or `+256 772 123 456`) numbers both work.
* The office manager adds a cleaner in **Team** and sends the login on WhatsApp with one tap
  (the message is written in the cleaner's language).
* App languages: **English, Luganda, Kiswahili** (the team is from Uganda), plus Arabic, Hindi, Urdu, Bengali,
  Malayalam and Tagalog. Task names in another language always show the English name underneath, so
  everyone uses the same names as the office.
* Big buttons, one tap per task, photo with problem reports, and everything works offline.

## Office manager

Dashboard (live), cleaning (today / history / problems / setup), inventory (pantry, cleaning and stationery,
Excel import, CSV export, item history), to supply + purchase orders, requests & orders (monitors, desks, chairs,
docks …), gate passes, forms & templates (QR codes and links for the item request and gate access forms —
employees and visitors fill them in without an account), daily reports, team and settings (report time, shift,
working days, phone notifications).

## Technology

* **Frontend:** React 18 + TypeScript + Vite, Tailwind CSS, TanStack Query (cached and persisted for instant
  start-up), installable PWA with a Workbox service worker. Hosted on **Vercel**.
* **Backend:** **Supabase** — Postgres with row-level security on every table (each workspace only sees
  its own data; cleaners cannot see requests, passes or orders), Realtime for live screens, Storage for problem
  photos, Edge Functions (`rh-admin` for phone + PIN accounts, `rh-push` for Web Push), and `pg_cron` every
  5 minutes for round alerts and the 4 PM report.
* All database objects are prefixed `rh_` (`supabase/migrations`).

```
src/
  screens/cleaner   phone app for the cleaners
  screens/manager   office manager app (desktop + mobile)
  screens/public    request and gate-pass forms (no login), printable templates
  lib/              data hooks, offline outbox, realtime, phone sign-in, stock rules
  i18n/             cleaner app translations
supabase/
  migrations/       schema, security, functions, demo generator
  functions/        rh-admin, rh-push (Edge Functions)
  seed/catalog.json default rooms, rounds, tasks and stock items (with translations)
scripts/            e2e test, brand asset generator, setup helpers
```

## Develop

```bash
npm install
npm run dev
```

```bash
npm test            # unit tests (phone numbers, stock rules, rounds, offline queue, translations)
npm run build && npm run preview
BASE=http://localhost:4173 npm run e2e   # full browser test: manager + cleaner phones, live updates
npm run e2e:cleanup                      # removes the test cleaner and rebuilds the demo
```

The Supabase URL and public key are built in; to point the app at another project set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Deploy

Vercel picks everything up from `vercel.json` (Vite build, SPA rewrites, cache headers). Import the repository
in Vercel and deploy — no environment variables are required.

## Roadmap

* **Phase 2:** invoices, budgets & spend tracking, staff kits, petty cash, access cards, keys, PO box, stamps.
* **Phase 3:** SAP and other system connections, employee self-service portal, uniforms.
