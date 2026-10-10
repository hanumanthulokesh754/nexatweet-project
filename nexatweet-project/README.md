# NexaTweet — Full Project

A full-stack social + AIOps-observability demo app:

- `backend/`  — Node.js/Express API (gateway, user & social services, content/media,
  event bus, notify/analytics, telemetry → health/incident/RCA engines, Nexora adapter,
  resilience layer with chaos injection). See `backend/README.md`.
- `frontend/nexatweet.html` — single-file UI wired to that API (login/signup, feed,
  notifications, chaos lab, system health, RCA), with graceful fallback to a local demo
  mode if the API isn't reachable.

## Run it

1. **Start the backend**
   ```
   cd backend
   npm install
   cp .env.example .env
   # edit .env: set ADMIN_EMAIL to the email you'll register with, to get admin access
   npm run dev
   ```
   This starts the API on `http://localhost:4000` (requires MongoDB; Redis is optional —
   caching just degrades gracefully if it's down).

2. **Open the frontend**
   Serve `frontend/nexatweet.html` with any static server (don't open it as a bare
   `file://` URL — some browsers block the API calls from file pages). For example:
   ```
   cd frontend
   npx serve .
   ```
   Then open the printed URL (e.g. `http://localhost:3000`).

3. **CORS**
   In `backend/.env`, make sure `CORS_ORIGINS` includes whatever origin you're serving
   the frontend from (e.g. `http://localhost:3000`). Restart the backend after changing it.

4. **Sign up**
   The pre-filled `sai@nexora.dev` / `nexora123` fields on the login screen are placeholder
   text only — they are not a real account. Click **Create an account** first. If you
   register with the email you set as `ADMIN_EMAIL`, that account gets admin access to
   System Health, Telemetry, RCA, and the Chaos Lab's live backend toggle.

5. **Tests**
   ```
   cd backend
   npm test
   ```

## What's real vs. simulated in the frontend

Wired to the backend: sign in/up, session persistence, home feed (load/create/like),
notifications (load/mark read), RCA incident list, Chaos Lab toggle, and an admin-only
overlay of live DB status/latency on the System Health panel.

Left as local-only simulation (no matching backend service): CPU/memory numbers,
Messages, Service Topology, Premium billing, comment threads, and "Enter Demo Mode"
(which intentionally never touches the API).
