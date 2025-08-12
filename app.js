// Frontend for Site Monitor — works with optional server at same origin.
// The server performs HTTP & HTTPS checks; specify full URL with protocol (http:// or https://).

const addBtn = document.getElementById('addBtn');
const urlInput = document.getElementById('urlInput');
const intervalInput = document.getElementById('intervalInput');
const sitesList = document.getElementById('sitesList');
const notifyBtn = document.getElementById('notifyBtn');
const exportBtn = document.getElementById('exportBtn');
const useServerCheckbox = document.getElementById('useServer');

let sites = JSON.parse(localStorage.getItem('sites_v3') || '[]');
let logs = JSON.parse(localStorage.getItem('logs_v3') || '[]');

function save() {
  localStorage.setItem('sites_v3', JSON.stringify(sites));
  localStorage.setItem('logs_v3', JSON.stringify(logs));
}

async function fetchSitesFromServer() {
  try {
    const resp = await fetch('/api/sites');
    if (!resp.ok) throw new Error('no server');
    const data = await resp.json();
    sites = data.sites || sites;
    save();
  } catch(e) {
    console.log('Server not reachable:', e.message);
  }
}

async function render() {
  if (useServerCheckbox.checked) {
    await fetchSitesFromServer();
  }

  sitesList.innerHTML = '';
  sites.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.innerHTML = '<strong>' + s.url + '</strong><div class="small">Last: ' + (s.lastChecked ? new Date(s.lastChecked).toLocaleString() : 'never') + '</div>';
    const status = document.createElement('div');
    status.className = 'badge ' + (s.lastStatus === 'up' ? 'status-up' : (s.lastStatus === 'down' ? 'status-down' : 'status-down'));
    status.textContent = s.lastStatus ? s.lastStatus.toUpperCase() : 'UNKNOWN';
    meta.appendChild(status);
    meta.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const checkNow = document.createElement('button');
    checkNow.textContent = 'Check now';
    checkNow.onclick = () => checkSite(s, true);
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.className = 'danger';
    remove.onclick = async () => {
      if (useServerCheckbox.checked) {
        await fetch('/api/sites', {method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({url:s.url})});
      }
      sites.splice(idx,1); save(); render();
    };
    actions.appendChild(checkNow);
    actions.appendChild(remove);

    card.appendChild(meta);
    card.appendChild(actions);
    sitesList.appendChild(card);
  });
}

async function checkSite(s, manual=false) {
  const started = Date.now();
  let status = 'down';
  let code = null;
  let latency = null;
  try {
    if (useServerCheckbox.checked) {
      const resp = await fetch('/api/check?url=' + encodeURIComponent(s.url));
      const data = await resp.json();
      status = data.status;
      code = data.code;
      latency = data.latency;
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 15000);
      let resp;
      try {
        resp = await fetch(s.url, {method:'HEAD', cache:'no-store', signal: controller.signal});
      } catch(e) {
        resp = await fetch(s.url, {method:'GET', cache:'no-store', signal: controller.signal});
      } finally {
        clearTimeout(timeout);
      }
      code = resp.status || 0;
      status = (resp.ok) ? 'up' : 'down';
      latency = Date.now()-started;
    }
  } catch (err) {
    status = 'down';
    code = 0;
    latency = Date.now()-started;
  }

  s.lastChecked = Date.now();
  s.lastStatus = status;
  save();
  logs.push({url:s.url, time:Date.now(), status, code, latency, manual});
  if (logs.length>2000) logs.shift();
  save();
  render();
  if (manual || s.notifyOnChange) notifyIfNeeded(s, status);
}

function notifyIfNeeded(site, newStatus) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const title = newStatus === 'up' ? 'Site is UP ✅' : 'Site is DOWN ❌';
  const body = site.url + ' is ' + newStatus.toUpperCase();
  new Notification(title, {body, tag: site.url});
}

addBtn.onclick = async () => {
  let url = urlInput.value.trim();
  if (!url) return;
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  const interval = Math.max(10, parseInt(intervalInput.value||30,10));
  const site = {url, interval, lastChecked: null, lastStatus: null, notifyOnChange: true, id: Date.now()+Math.random()};
  sites.push(site);
  save();
  if (useServerCheckbox.checked) {
    try {
      await fetch('/api/sites', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(site)});
    } catch(e){ console.log('server add failed', e.message); }
  }
  render();
  urlInput.value = '';
};

notifyBtn.onclick = async () => {
  if (!('Notification' in window)) {
    alert('Notifications not supported in this browser.');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') notifyBtn.textContent = 'Notifications ON';
};

exportBtn.onclick = () => {
  if (logs.length === 0) {
    alert('No logs yet.');
    return;
  }
  const rows = [['time','url','status','code','latency','manual']];
  logs.forEach(l => rows.push([new Date(l.time).toISOString(), l.url, l.status, l.code, l.latency, l.manual]));
  const csv = rows.map(r => r.map(c => JSON.stringify(c)).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'site-monitor-logs.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// Scheduler - client side only when not using server
function scheduleChecks() {
  sites.forEach(s => { if (s._timer) { clearInterval(s._timer); s._timer = null; } });
  if (useServerCheckbox.checked) return;
  sites.forEach(s => {
    s._timer = setInterval(()=>checkSite(s), Math.max(10000, (s.interval||30)*1000));
    if (!s.lastChecked) checkSite(s);
  });
}

window.addEventListener('visibilitychange', () => {
  if (!document.hidden) sites.forEach(s => checkSite(s));
});

window.addEventListener('beforeunload', () => { sites.forEach(s => { if (s._timer) clearInterval(s._timer); }); });

render();
scheduleChecks();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').then(reg=>{
    console.log('SW registered', reg);
  }).catch(err=>console.warn('SW register failed', err));
}
