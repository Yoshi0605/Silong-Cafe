# Silong Café — Customer, kitchen, and sales system

## Local development

1. Copy `.env.example` to `.env` and configure MySQL and `ADMIN_PASSWORD`.
2. Run `npm install` and `npm start`.
3. Open `http://localhost:3000/`; sign in at the footer to open `/kitchen`.

## Cloud MySQL / Vercel

Set these environment variables in Vercel:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_SSL=true` for TiDB, Aiven, or other SSL-required hosts
- `DB_SSL_REJECT_UNAUTHORIZED=true` (set false only for a trusted local/test host)
- Optional `DB_SSL_CA` containing a PEM certificate with `\\n` for line breaks
- `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET`

Import `schema.sql`, then `menu_seed.sql` into the cloud database. Cloud hosts should normally have `DB_CREATE_DATABASE=false` because the database already exists.

Deploy the repository with `vercel.json`; Vercel will serve `server.js` as a serverless Express app while `npm start` remains for local use.

## Operations

- Digital-payment checkout requires a receipt photo and reference number.
- Receipt reference numbers are unique and cannot be reused.
- The kitchen board verifies receipts in a zoomable preview.
- Daily sales use `Asia/Manila` and count only finished (`done`) orders.
- Cancelled orders are excluded from sales.

## Windows: reliable start and stop

Open PowerShell in this project folder and run:

```powershell
npm run dev
```

This clears only the process currently using port `3000`, then starts Silong Café. To stop it:

```powershell
npm run stop
```

Then open:

- Customer: http://localhost:3000/
- Admin: click **Sign in to Admin** at the customer page footer
- Password: the value in `.env` under `ADMIN_PASSWORD`

Do not open a second server with `npm start` while one is already running. Use `npm run dev` for a clean restart.
