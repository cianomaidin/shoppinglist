# Shopping List

A real-time shared shopping list PWA. Add items, check them off, and see updates instantly across all devices. Items are automatically categorised into grocery aisles using Claude AI.

**Stack:** React 19 + Vite + Tailwind CSS 4 · Supabase (Postgres + Realtime + Edge Functions) · Deployed on Vercel

---

## Features

- Real-time sync across devices (Supabase Realtime)
- Items auto-categorised into grocery aisles via Claude Haiku (Supabase Edge Function)
- Push notifications when items are added (OneSignal)
- Emoji picker per item
- Quantity + notes per item
- List history — view past lists and reuse as templates
- PWA — installable on mobile

---

## Project Structure

```
src/
  App.jsx          # Main app — all UI and Supabase logic
  supabase.js      # Supabase client init
  firebase.js      # Firebase client (legacy, not actively used)
  sw.js            # Service worker (Workbox PWA + OneSignal)
  index.css        # Global styles
  main.jsx         # Entry point

supabase/
  functions/
    categorise/    # Edge Function: auto-categorises new items via Claude Haiku
    notify/        # Edge Function: sends push notifications via OneSignal

scripts/
  generate-icons.cjs  # Icon generation helper
```

---

## Database Schema

Two tables in Supabase (public schema):

### `lists`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key, default gen_random_uuid() |
| name | text | e.g. "Shop · 28 Apr" |
| status | text | `active` or `completed` |
| created_at | timestamptz | default now() |
| completed_at | timestamptz | Set when list is completed |

### `shopping_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key, default gen_random_uuid() |
| list_id | uuid | Foreign key → lists.id |
| name | text | Item name |
| quantity | text | e.g. "2", "500g" |
| notes | text | Optional note |
| emoji | text | Optional emoji |
| checked | boolean | Default false |
| category | text | Auto-set by `categorise` edge function |
| created_at | timestamptz | default now() |

### Realtime
Enable Realtime on both `lists` and `shopping_items` tables in the Supabase dashboard.

### Edge Function Triggers
Set up a Supabase Database Webhook for `INSERT` on `shopping_items` pointing to the `categorise` function URL, and another for `INSERT` pointing to the `notify` function URL.

---

## Environment Variables

### Frontend (`.env`)

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Supabase Edge Functions (set via `supabase secrets set` or the dashboard)

```
ANTHROPIC_API_KEY=        # For the categorise function (Claude Haiku)
SUPABASE_URL=             # Your project URL
SUPABASE_SERVICE_ROLE_KEY= # Service role key (not the anon key)
ONESIGNAL_APP_ID=         # For the notify function
ONESIGNAL_API_KEY=        # OneSignal REST API key
APP_URL=                  # Your deployed app URL (used in push notification deep link)
```

---

## Local Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Copy and fill in env vars
cp .env.example .env

# Start dev server
npm run dev
```

> `--legacy-peer-deps` is required due to peer dependency conflicts in the current dependency tree.

---

## Deploy

The app is deployed on **Vercel**. Push to `main` to auto-deploy.

Edge functions are deployed via the Supabase CLI:

```bash
supabase functions deploy categorise
supabase functions deploy notify
```

Set edge function secrets:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-...
supabase secrets set ONESIGNAL_APP_ID=...
supabase secrets set ONESIGNAL_API_KEY=...
supabase secrets set APP_URL=https://your-app.vercel.app
```

---

## Notes

- `firebase.js` is present but not actively used — the app was migrated to Supabase. Safe to remove.
- The service worker (`sw.js`) bundles both Workbox (PWA caching) and the OneSignal SDK. They must share a single SW file to avoid conflicts.
- Items are grouped by category in the UI in a fixed aisle order (Fruit & Veg → Meat & Fish → Dairy → Bakery → Frozen → Drinks → Tins & Dry Goods → Toiletries & Health → Household → Other).
