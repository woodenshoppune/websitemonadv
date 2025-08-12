Site Monitor — PWA + Bundled Server (HTTP & HTTPS)
====================================================

Overview
- This project is a Progressive Web App (frontend) bundled with a small Node.js server.
- The server performs reliable HTTP & HTTPS checks (avoids browser CORS) and persists sites/logs to disk.

Highlights
- Support for both HTTP and HTTPS targets — specify the protocol in the URL (http://... or https://...).
- Optional server-side skip TLS verification for targets with self-signed certs (see SERVER_SKIP_TLS env var).
- Frontend runs as a PWA with offline app shell caching.

Server features
- Endpoints:
  - GET /api/sites -> { sites: [...] }
  - POST /api/sites -> add site (JSON body: {url, interval, id, ...})
  - DELETE /api/sites -> remove site (JSON body: {url})
  - GET /api/check?url=... -> performs an on-demand check and returns {status, code, latency}
  - GET /api/logs -> returns server-side logs
- Persists to server/data.json
- Schedules per-site checks on the server and stores logs.

Security / TLS notes
- By default the server verifies TLS certificates for HTTPS targets.
- If you need to monitor internal services with self-signed certificates, you can run the server with:
  `SERVER_SKIP_TLS=true node index.js`
  This disables certificate verification (INSECURE — only for testing).

Run locally
1. Ensure Node.js 16+ (Node 18+ recommended).
2. In project root:
   - `cd server`
   - `npm install`
   - `SERVER_SKIP_TLS=false node index.js`   # or set true to skip TLS verification (not recommended)
3. Open http://localhost:3000

Docker
- Build:
  - `docker build -t site-monitor-server .`
- Run:
  - `docker run -p 3000:3000 -e SERVER_SKIP_TLS=false site-monitor-server`

