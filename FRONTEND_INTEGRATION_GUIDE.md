# Frontend Integration Guide (Driver + Admin)

This document explains exactly what frontend clients must do with the latest backend updates.
It focuses on API behavior and runtime flow only (no frontend framework code).

---

## 1) Core Concepts

- `is_active`: account-level enable/disable (admin control).
- `is_available`: driver intent to receive offers.
- `presence_status`: real-time app presence state:
  - `offline`
  - `online_idle`
  - `online_active`
- `last_seen_at`: last accepted presence signal time.

### Assignment Eligibility (Driver)

A driver is considered eligible for auto-offers only when all are true:

- account is active
- `is_available = true`
- not restricted
- no active assigned/in-progress order
- no active pending offer
- presence is fresh (`last_seen_at` within configured staleness window)
- `presence_status != offline`

---

## 2) Authentication Flow

## Login

- Admin: `POST /auth/admin/login`
- Driver: `POST /auth/driver/login`

Store returned bearer token and send in:

- `Authorization: Bearer <token>`

## Logout (Token Revocation)

- `POST /auth/logout`

After logout, the same token must be treated as invalid immediately (expect `401` on protected endpoints).

---

## 3) Driver Presence Flow (Required)

The backend now depends on presence signals for accurate availability.

## A) App/Open Session

When driver app enters active foreground session:

- call `POST /drivers/me/presence/open`

Expected result:

- `presence_status` becomes `online_idle`
- `last_seen_at` updated

## B) Availability Toggle

When driver enables receiving orders:

- call `POST /drivers/me/availability` with `{ "is_available": true }`

When driver disables receiving orders:

- call the same endpoint with `{ "is_available": false }`

Note:

- disabling availability forces backend presence state to `offline` for assignment safety.

## C) Heartbeat

Call `POST /drivers/me/presence/heartbeat` periodically with:

- `{ "is_interacting": true }` when user is actively interacting
- `{ "is_interacting": false }` when app is open but idle

Important:

- backend enforces minimum heartbeat interval
- too-frequent duplicate heartbeat returns `400`
- frontend should treat that as expected throttling, not fatal

## D) App Close / Background Exit

When app is closing/logging out/ending active session:

- call `POST /drivers/me/presence/close`

Expected result:

- `presence_status = offline`
- `is_available = false`

---

## 4) Driver Offer Lifecycle (Frontend Behavior)

## Poll/Check Offer Existence

- `GET /driver/orders/current-offer`
  - `200`: pending offer exists (summary only)
  - `204`: no active offer

## Open Offer Details

- `POST /driver/orders/offers/{offer_id}/open`

This marks that driver actually viewed the offer and starts accept window semantics.

## Accept Offer

- `POST /driver/orders/offers/{offer_id}/accept`

New backend guarantee:

- assignment is atomic compare-and-set at DB level
- duplicate same-driver retries are idempotent-safe

Frontend guidance:

- if network timeout occurs after sending accept, retry same endpoint
- treat `200` as success, do not create local duplicate state

## Ignore Offer

- `POST /driver/orders/offers/{offer_id}/ignore`
  - returns `204` on success

---

## 5) Driver Order Execution Flow

After accepted:

- fetch active orders: `GET /driver/orders/active`
- pickup: `POST /driver/orders/{order_id}/pickup`
- complete: `POST /driver/orders/{order_id}/complete`

Frontend should always read server response status/state rather than assuming local state.

---

## 6) Admin Runtime Settings Impacting Frontend

Admin endpoints:

- `GET /admin/settings`
- `PATCH /admin/settings`

Relevant keys:

- `offer_open_timeout_seconds`
- `driver_presence_stale_seconds`
- `driver_presence_heartbeat_min_interval_seconds`
- `driver_restriction_seconds`

Frontend implication:

- heartbeat cadence must respect min interval
- stale threshold controls how quickly inactive drivers are auto-unavailable
- offer UI timers should reflect offer timeout behavior

---

## 7) Error Handling Contract (Frontend)

Use API error payload (`error.code`, `error.message`) to branch UX.

Common statuses:

- `400`: business-rule or validation issue (e.g., heartbeat too frequent)
- `401`: missing/invalid/revoked token
- `403`: permission issue
- `404`: entity/offer/order not found
- `409`: conflict due to state transition/race (already handled/assigned/expired)
- `500`: unexpected server issue

Retry guidance:

- safe retry: `accept` (same offer by same driver), `current-offer`, `GET` endpoints
- avoid blind retry loops for `400`/`409`; refresh state first

---

## 8) Recommended Frontend Runtime Policy

## Presence policy

- On app foreground: call `presence/open`
- Heartbeat interval: slightly above backend min (for example min+1s buffer)
- On visibility change to inactive: send heartbeat with `is_interacting=false`
- On logout/close: call `presence/close`, then `auth/logout`

## Offer policy

- Poll `current-offer` with reasonable interval (or event-triggered refresh)
- Open before showing full order details
- Accept is retry-safe on transient network failures

## Token policy

- On any `401`, clear token and force re-login

---

## 9) End-to-End Driver Flow (Reference)

1. Driver logs in (`/auth/driver/login`)
2. App sends `/drivers/me/presence/open`
3. Driver enables availability (`/drivers/me/availability` true)
4. App sends periodic `/drivers/me/presence/heartbeat`
5. App checks `/driver/orders/current-offer`
6. If offer exists:
   - `/driver/orders/offers/{id}/open`
   - user accepts or ignores
7. If accepted:
   - `/driver/orders/{id}/pickup`
   - `/driver/orders/{id}/complete`
8. On session end:
   - `/drivers/me/presence/close`
   - `/auth/logout`

---

## 10) QA Checklist for Frontend Team

- login returns usable bearer token
- revoked token fails after logout (`401`)
- presence open/heartbeat/close transitions update driver state correctly
- heartbeat spam receives expected `400` and app handles it gracefully
- availability off removes driver from offer flow
- duplicate accept retries do not break state
- after accept, active order flow (pickup/complete) works correctly
- no stuck UI state when server returns `409` or `400`

