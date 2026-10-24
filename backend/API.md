# API overview

Base URL: http://localhost:4000/api. Authenticated routes use the HTTP-only accessToken cookie. Admin endpoints require an active admin account. JSON validation errors use an error property.

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | /health | Public | API and MongoDB readiness |
| POST | /auth/register | Public | Create account; sends verification when SMTP is configured |
| POST | /auth/verify-email | Public | Verify email token |
| POST | /auth/resend-verification | Public | Resend verification link |
| POST | /auth/login, /auth/logout | Public | Start or clear session |
| GET | /auth/me | Signed in | Current account |
| PATCH | /auth/profile, /auth/password | Signed in | Update profile or password |
| POST | /auth/forgot-password, /auth/reset-password | Public | Request and consume reset token |
| POST | /uploads/profile-image | Signed in | Upload profile image (JPEG/PNG/WebP/GIF, 4 MB max) |
| GET | /products | Signed in | Search/filter/paginate active products |
| POST/PATCH/DELETE | /products, /products/:id | Admin | Create, update metadata, or archive product |
| POST | /products/import | Admin | Import up to 1,000 CSV rows |
| GET | /products/export.csv | Admin | Export active inventory as spreadsheet-safe CSV |
| POST | /uploads/product-image | Admin | Upload product image (JPEG/PNG/WebP/GIF, 4 MB max) |
| POST | /inventory/:id/adjust | Admin | Adjust stock and record movement |
| GET | /inventory/movements | Admin | Stock movement history |
| GET/POST/PATCH/DELETE | /catalog, /catalog/:type, /catalog/:id | Admin | Manage categories and brands |
| GET/POST/PATCH/DELETE | /suppliers, /suppliers/:id | Admin | Manage suppliers |
| GET/POST/PATCH/DELETE | /warehouses, /warehouses/:id | Admin | Manage warehouses |
| GET/POST | /purchase-orders | Admin | List or create supplier purchase orders |
| PATCH | /purchase-orders/:id/status | Admin | Advance purchase order status |
| POST | /purchase-orders/:id/receive | Admin | Receive order and add stock with movement records |
| GET/POST | /orders | Signed in | List own orders or place an order (POST accepts optional idempotencyKey for safe retries) |
| GET | /orders/:id | Signed in | Read an order only when owned by the caller (admins can read all) |
| PATCH | /orders/:id/status, /orders/:id/collect-cod | Admin | Fulfill/cancel order or collect COD after delivery |
| GET | /payments/transactions | Signed in | Paginated payment records limited to the caller's own orders |
| GET | /admin/users, PATCH /admin/users/:id/status | Admin | Manage accounts |
| GET/PATCH | /admin/users/:id | Admin | View account, recent orders/activity, and edit name, email, or role |
| GET | /admin/audit, /notifications, /reports/summary | Admin/signed in | Audit, notifications, and reports |
| POST/GET | /support | Signed in | Create a support request and list only your requests (admins can list all) |
| PATCH | /support/:id | Admin | Update a support request status and add a note |
| GET/PATCH | /settings | Admin | Read/update persisted workspace display and notification preferences |

`GET /reports/summary` accepts optional ISO-compatible `from`, `to`, and `category` query parameters. Sales, user, and movement counts use the selected date range; inventory valuation and current stock represent current inventory, optionally limited to a category. `GET /payments/transactions` accepts `page`, `limit`, and `status` (`paid`, `refunded`, or `failed`).

Order status changes are separate from payment status. New orders start as `pending`; admins may approve or reject them. Rejection requires a reason, restores reserved stock, and refunds a successful demo-card payment in the simulator record. COD remains pending until an admin marks it collected after delivery.

The optional `idempotencyKey` on order creation is unique per signed-in user and should be reused when retrying the same checkout after a network timeout. The support workspace is available at `/support`; customers see only their cases and admins can review and update all cases.

CSV import headers must include name, sku, category, cost, price, stock, and min. Optional columns include brand, description, barcode, supplier, warehouse, location, and image. Existing or duplicate SKUs reject the import without importing rows. Inventory export creates a compatible CSV.

Passwords are limited to 72 UTF-8 bytes to avoid bcrypt truncation. Inventory and order money is rounded to cents. The fictional card simulator never stores card numbers or CVVs and is not a payment processor.

The API validates its environment before startup. Production requires a unique JWT secret, HTTPS frontend/backend origins, MongoDB, and SMTP. TRUST_PROXY is disabled by default; configure a hop count only when the API is behind a trusted reverse proxy. Configure SMTP variables from the root .env.example to send email.
