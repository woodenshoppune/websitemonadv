Site Monitor — PWA + Server
==========================

This project contains:
- frontend/ (served at root): PWA (index.html, styles.css, app.js, manifest, service-worker, icons)
- server/ (Node.js): Express server that performs reliable server-side checks (avoids CORS) and schedules checks persistently.

Server features
- Endpoints:
  - GET /api/sites -> { sites: [...] }
  - POST /api/sites -> add site (JSON body: {url, interval, id, ...})
  - DELETE /api/sites -> remove site (JSON body: {url})
  - GET /api/check?url=... -> performs an on-demand check and returns {status, code, latency}
  - GET /api/logs -> returns server-side logs
- Persists sites and logs to disk in server/data.json
- Schedules per-site checks on the server; performs fetch from server (no browser CORS)
- Run with Node 18+ (or install node-fetch if on older Node)

How to run (local)
1. Install Node.js 18+ (or 16+ and run `npm install` which includes node-fetch).
2. In project root:
   - `cd server`
   - `npm install`
   - `node index.js`
3. Open http://localhost:3000 in your browser. The frontend will use server-mode by default (checkbox checked).

Docker
- A Dockerfile is included in /server. Build and run:
  - `docker build -t site-monitor-server server/`
  - `docker run -p 3000:3000 site-monitor-server`

Deployment
- This is a single app that serves both the frontend static files and the API from the same origin. Deploy the server folder to any Node-capable host (Heroku, Railway, Fly.io, VPS).
- For static-only deployment (Netlify/GitHub Pages) you can still use the frontend but will need to run the server separately (or remove server mode).

Limitations & notes
- Server performs HTTP(S) requests to target sites; some hosts may block frequent checks. Be mindful of rate limits.
- This is a simple monitor intended for light use or as a starting point. For production-grade uptime monitoring consider specialized services.

