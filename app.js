const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const TABLE = 'tbs_menu_nodes_v1';
const menu = document.querySelector('#menu');
const back = document.querySelector('#back');
const main = document.querySelector('#main');
const status = document.querySelector('#status');
const documents = createStudentDocuments(request);
const panel = document.querySelector('.panel');
let nodes = [];
let loaded = false;
let syncing = false;
let fingerprint = '';

// Navigation stays on this device; menu content is shared in Supabase.
history.replaceState({ menuDepth: 0 }, '');
function currentMenu() {
  const id = location.hash.slice(1);
  return nodes.find(node => node.id === id && (node.kind === 'menu' || node.kind === 'document')) || null;
}
function navigate(hash) {
  if (location.hash === hash) { render(); return; }
  history.pushState({ menuDepth: (history.state?.menuDepth || 0) + 1 }, '', hash || location.pathname + location.search);
  status.textContent = '';
  render();
  if (currentMenu()?.kind === 'document') document.querySelector('#document-title').focus();
  else menu.querySelector('.item')?.focus();
}
function render() {
  const parent = currentMenu();
  main.disabled = !location.hash;
  back.disabled = !(history.state?.menuDepth > 0);
  const isDocument = parent?.kind === 'document';
  panel.classList.toggle('document-open', isDocument);
  menu.hidden = isDocument;
  if (isDocument) {
    const student = nodes.find(node => node.id === parent.parent_id);
    documents.open(parent, student?.label || 'Student');
    return;
  }
  documents.close();
  menu.setAttribute('aria-label', parent?.label || 'Main menu');
  const focusedId = menu.contains(document.activeElement) ? document.activeElement.dataset.nodeId : null;
  menu.replaceChildren();
  if (!loaded) return;
  const entries = nodes.filter(node => node.parent_id === (parent?.id || null));
  for (const entry of entries) {
    const isLink = entry.kind === 'menu' || Boolean(entry.url);
    const item = document.createElement(isLink ? 'a' : 'button');
    item.className = 'item';
    item.dataset.nodeId = entry.id;
    item.textContent = entry.label;
    if (entry.kind === 'document') {
      item.type = 'button';
      item.addEventListener('click', () => navigate('#' + entry.id));
    } else if (entry.kind === 'menu') {
      item.href = '#' + entry.id;
      item.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate('#' + entry.id);
      });
    } else if (entry.url) {
      item.href = entry.url;
    } else {
      item.type = 'button';
      item.addEventListener('click', () => { status.textContent = 'No Zoom link has been added for ' + entry.label + ' yet.'; });
    }
    menu.append(item);
    if (entry.id === focusedId) item.focus();
  }
  if (!entries.length) status.textContent = 'This menu is empty.';
}
async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
      ...options,
      headers: { apikey: SUPABASE_KEY, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) throw new Error('Request failed: ' + response.status);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
async function syncAll() { await Promise.allSettled([syncMenus(), documents.sync()]); }
async function syncMenus() {
  if (syncing) return;
  syncing = true;
  try {
    const data = await request(TABLE + '?select=id,parent_id,label,kind,url,sort_order&order=sort_order.asc,id.asc');
    if (!Array.isArray(data)) throw new Error('Invalid menu response');
    const nextFingerprint = JSON.stringify(data);
    const hadSyncError = status.dataset.syncError === 'true';
    if (!loaded || nextFingerprint !== fingerprint) {
      nodes = data;
      fingerprint = nextFingerprint;
      loaded = true;
      status.textContent = '';
      render();
    } else if (hadSyncError) {
      status.textContent = '';
    }
    status.dataset.syncError = 'false';
  } catch (error) {
    status.dataset.syncError = 'true';
    status.textContent = loaded ? 'Unable to sync. Showing the last loaded menu; retrying shortly.' : 'Unable to load menus. Check your connection; retrying shortly.';
  } finally {
    syncing = false;
  }
}
main.addEventListener('click', () => navigate(''));
back.addEventListener('click', () => { if (history.state?.menuDepth > 0) history.back(); });
window.addEventListener('popstate', () => { status.textContent = ''; render(); menu.querySelector('.item')?.focus(); });
window.addEventListener('hashchange', render);
window.addEventListener('focus', syncAll);
window.addEventListener('online', syncAll);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAll(); });
setInterval(() => { if (!document.hidden) syncAll(); }, 5000);
status.textContent = 'Loading menus…';
render();
syncMenus();
