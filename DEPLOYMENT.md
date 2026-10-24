# VELTRIX deployment guide

This project is prepared for a Vite frontend on Vercel and the Express API on Render. The Vercel function proxies `/api/*` requests to Render, so the browser talks to one origin and the HTTP-only login cookie stays first-party.

## 1. Prepare MongoDB Atlas

1. Create or select an Atlas cluster and create a database user with access only to the VELTRIX database.
2. Copy the driver's `mongodb+srv://` connection string. Replace its database name and URL-encode special characters in the username or password.
3. In Atlas Network Access, allow the outbound IP ranges shown for the Render service's region. Render documents the ranges in the service's **Connect → Outbound** panel. Avoid `0.0.0.0/0`; Atlas warns that it permits connections from anywhere. See [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/) and [Render outbound IP addresses](https://render.com/docs/outbound-ip-addresses).

## 2. Deploy the API to Render

1. Push this project to a Git repository and create a Render Blueprint from it. Render reads the root [render.yaml](render.yaml), builds with `npm ci`, starts with `npm start`, and checks `/api/health`.
2. Enter the prompted secret values in Render. Set `MONGODB_URI` to the Atlas string. Render generates `JWT_SECRET` for the service.
3. Set `FRONTEND_ORIGIN` to the exact Vercel site origin, for example `https://veltrix.vercel.app` (no trailing slash). Set `BACKEND_ORIGIN` to the Render service origin, for example `https://veltrix-api.onrender.com` (no path or trailing slash).
4. Configure an SMTP account and enter `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. Production startup intentionally requires SMTP for account verification and password recovery.
5. Wait for deployment, then open `https://YOUR-RENDER-SERVICE.onrender.com/api/health`. It should return `status: ok` and `database: connected`.
6. Create the initial admin once. In the local project's ignored root `.env`, set `MONGODB_URI` to the same Atlas database and add `SEED_ADMIN_EMAIL` plus a unique `SEED_ADMIN_PASSWORD` of at least 12 characters. Make sure your current computer IP is temporarily allowed in Atlas, then run `npm run seed` from the project root. The script only creates the admin/sample records when missing and does not reset an existing admin password. A Render Shell can run the same command on plans that include Shell access.

Render's local filesystem can be ephemeral. To keep uploaded profile and product images through deploys, attach a persistent disk at `/var/data` in the Render service settings and set `UPLOAD_DIR=/var/data/veltrix-uploads`. Render Free services do not support persistent disks; use a plan with disk support or an external object-storage service for durable uploads. Render Free services also sleep after 15 minutes idle and can take about a minute to wake, so that option will feel slow for a live storefront. See [Render Free service limits](https://render.com/docs/free).

## 3. Deploy the frontend to Vercel

1. Import the same Git repository into Vercel.
2. Set **Root Directory** to `frontend`. Use the Vite preset, build command `npm run build`, and output directory `dist`. Vercel documents these settings in [Configure a build](https://vercel.com/docs/builds/configure-a-build).
3. Add the environment variable `BACKEND_URL` to the Vercel project. Set its value to the Render service origin, such as `https://veltrix-api.onrender.com` (no `/api` suffix).
4. Deploy. The frontend's API base is `/api`; do not put MongoDB credentials, SMTP values, or `JWT_SECRET` into any `VITE_*` variable.
5. Copy the final Vercel origin and update Render's `FRONTEND_ORIGIN` to that exact origin. Save the variable and redeploy the API.

The Vercel project needs both `frontend/vercel.json` for SPA route refreshes and `frontend/api/[...path].js` for the API proxy. Vercel supports project rewrites and Node.js functions from the project root; see [Vercel rewrites](https://vercel.com/docs/routing/rewrites) and [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js).

Image uploads are capped at 4 MB so multipart requests stay below Vercel Functions' 4.5 MB request-body limit. See [Vercel Function limits](https://vercel.com/docs/functions/limitations).

## 4. Verify the live site

1. Open the Vercel site and refresh `/login`, `/user/dashboard`, and `/admin/dashboard` directly.
2. Register a customer, sign out, sign in again, and verify that the session remains after refreshing.
3. Place a COD order and confirm it appears in the user order history and admin order queue. Test cards are simulated only; they do not charge money.
4. Check the Vercel function logs and Render logs if an API request fails. A working backend health check must report MongoDB as connected.

## Deployment limitations to plan for

- Vercel and Render deployments are not created by this repository; they require your hosting accounts, Git connection, Atlas configuration, SMTP credentials, and the deployed origins above.
- Card payments remain in clearly labeled demo mode until a real provider and its server-side verification/webhook credentials are configured.
- Uploaded files require Render persistent storage or an external object-storage integration to survive service replacement.
