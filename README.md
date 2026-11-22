# Daily Delivery Manager

Water can and milk delivery management: customers, products, daily deliveries, monthly bills,
payments, reports, WhatsApp bills, light/dark theme, installable PWA. React + Vite + Supabase.

## 1. Database (once)
1. Create a project at supabase.com.
2. SQL Editor -> paste `supabase/schema.sql` -> Run (choose "Run and enable RLS" if asked).
3. Authentication -> URL Configuration: set Site URL and add Redirect URLs for your site
   (e.g. `http://localhost:5173/` and `https://YOUR-USER.github.io/YOUR-REPO/`).
4. For quick testing turn off Authentication -> Providers -> Email -> "Confirm email".
   For real customers set up your own email service under Authentication -> SMTP Settings
   (Supabase's built-in email has a low hourly limit).

## 2. Settings file
Copy `.env.example` to `.env` and fill in your Project URL and anon/publishable key
(Supabase -> Settings -> API). Never use the `service_role` / secret key.

## 3. Run on a computer
    npm install
    npm run dev        # open the printed address
    npm run build      # production build in dist/

## 4. Deploy to GitHub Pages
Option A (from a computer): set `VITE_BASE=/YOUR-REPO/` in `.env`, then `npm run deploy`.
Option B (from a phone, no computer): upload this project's zip to a GitHub repo, add
`.github/workflows/deploy.yml` (unzip, `npm install`, `npm run build` with
`VITE_BASE=/<repo>/`, then upload `dist` to Pages), and in Settings -> Pages choose
"GitHub Actions" as the source.

## 5. Install on Android
Open the site in Chrome -> menu -> "Install app" / "Add to Home screen" (or use the
"Install app on this phone" button in More -> Settings).

## Notes
- Offline: the screens open without internet, but loading and saving data needs internet.
- Each business only sees its own data (Row Level Security on every table).
