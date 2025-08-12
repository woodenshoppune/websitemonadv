// Simple Express server for site monitoring with HTTP & HTTPS support.
// Optional environment variable SERVER_SKIP_TLS=true will skip TLS certificate verification (use only for testing).

const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const fetch = global.fetch || require('node-fetch');

const DATA_FILE = path.join(__dirname, 'data.json');
let data = { sites: [], logs: [] };

// Load existing data if present
try {
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
  }
} catch(e){ console.error('Failed to read data.json', e); }

function persist() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// If SERVER_SKIP_TLS=true, create an https.Agent that disables cert verification
const skipTls = String(process.env.SERVER_SKIP_TLS || '').toLowerCase() === 'true';
let httpsAgent = undefined;
if (skipTls) {
  httpsAgent = new https.Agent({ rejectUnauthorized: false });
  console.warn('WARNING: TLS certificate verification is DISABLED (SERVER_SKIP_TLS=true). Only use for testing.');
}

async function performCheck(url, timeout=15000) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const id = setTimeout(()=>controller.abort(), timeout);
    // Use node-fetch which respects the agent option when provided
    const options = { method: 'HEAD', redirect: 'follow', signal: controller.signal };
    // attach agent for HTTPS if needed
    if (url.startsWith('https://') && httpsAgent) options.agent = httpsAgent;
    let res;
    try {
      res = await fetch(url, options);
    } catch(e) {
      // fallback to GET if HEAD fails
      const optionsGet = { method: 'GET', redirect: 'follow', signal: controller.signal };
      if (url.startsWith('https://') && httpsAgent) optionsGet.agent = httpsAgent;
      res = await fetch(url, optionsGet);
    } finally {
      clearTimeout(id);
    }
    const latency = Date.now() - start;
    return { status: res.ok ? 'up' : 'down', code: res.status, latency };
  } catch (err) {
    return { status: 'down', code: 0, latency: Date.now() - start, error: err.message };
  }
}

const sched = new Map();

function scheduleSite(site) {
  if (sched.has(site.id)) {
    clearInterval(sched.get(site.id));
    sched.delete(site.id);
  }
  const ms = Math.max(10000, (site.interval || 30) * 1000);
  const iv = setInterval(async () => {
    try {
      const res = await performCheck(site.url);
      const entry = { url: site.url, time: Date.now(), status: res.status, code: res.code, latency: res.latency };
      data.logs.push(entry);
      if (data.logs.length > 5000) data.logs.shift();
      persist();
      console.log('Checked', site.url, res.status, res.code, res.latency + 'ms');
    } catch(e) {
      console.error('Check failed for', site.url, e.message);
    }
  }, ms);
  sched.set(site.id, iv);
}

// schedule existing sites
data.sites.forEach(s => scheduleSite(s));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// API endpoints
app.get('/api/sites', (req, res) => res.json({ sites: data.sites }));

app.post('/api/sites', (req, res) => {
  const site = req.body;
  if (!site || !site.url) return res.status(400).json({ error: 'invalid' });
  if (!data.sites.find(s => s.url === site.url)) {
    data.sites.push(site);
    persist();
    scheduleSite(site);
  }
  res.json({ ok: true, sites: data.sites });
});

app.delete('/api/sites', (req, res) => {
  const { url } = req.body;
  data.sites = data.sites.filter(s => s.url !== url);
  // clear timers of removed
  for (const [id, iv] of Array.from(sched.entries())) {
    const exists = data.sites.find(s => s.id === id);
    if (!exists) { clearInterval(iv); sched.delete(id); }
  }
  persist();
  res.json({ ok: true });
});

app.get('/api/check', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'missing url' });
  try {
    const result = await performCheck(url);
    data.logs.push({ url, time: Date.now(), status: result.status, code: result.code, latency: result.latency });
    if (data.logs.length > 5000) data.logs.shift();
    persist();
    res.json(result);
  } catch (e) {
    res.json({ status: 'down', code: 0, latency: 0, error: e.message });
  }
});

app.get('/api/logs', (req, res) => res.json({ logs: data.logs }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Site monitor server listening on', PORT, 'skipTls=', skipTls));
