# VELTRIX Inventory Intelligence

VELTRIX is an inventory and order management workspace built with React, Vite, Express, and MongoDB.

## Local setup

1. Install Node.js 20+ and run MongoDB locally, or provision a MongoDB Atlas database.
2. Copy `.env.example` to `.env`. Set `MONGODB_URI`, a unique random `JWT_SECRET` (32+ characters), and seed administrator credentials. Do not use the example admin password.
3. Install dependencies: `npm install` and `npm --prefix frontend install`.
4. Run `npm run seed` to create the configured admin and sample data. The seed script does not supply a default password.
5. Run `npm run dev`; the API listens on port 4000 and Vite on port 5173.

For local development, email delivery is optional; without SMTP, email verification is skipped and reset links are not sent. Production startup requires SMTP configuration for account verification and password recovery. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`.

## Included workflows

- Cookie-based registration, sign-in, profile/password management, email verification, and password reset.
- Admin product catalogue with stock movement history, CSV import/export, and image uploads.
- Suppliers, warehouses, product categories, and brands.
- Customer orders with cash-on-delivery and a clearly labeled fictional card simulator. Never enter real payment details. This simulator is not a payment processor.
- Supplier purchase orders with draft, approval, ordering, transit, and receipt flows. Receiving updates stock and records movements.
- Notifications, admin account controls, audit history, and database-backed reports.

## Run and build

- `npm run dev`: API and frontend development servers.
- `npm run seed`: seed configured administrator and sample records.
- `npm run build`: production frontend build.
- `npm run lint`: frontend lint.

The API reference is in [backend/API.md](backend/API.md). The Vite dev server proxies `/api` to the local backend; production Vercel requests use the included same-origin API function and its server-only `BACKEND_URL` variable. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel, Render, Atlas, SMTP, CORS, and uploaded-image storage setup. Uploaded images need a persistent Render disk (set `UPLOAD_DIR`) or object storage to survive service replacement.
