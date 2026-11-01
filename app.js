const SUPABASE_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const TABLE = 'tbs_menu_nodes_v1';
const menu = document.querySelector('#menu');
const back = document.querySelector('#back');
const main = document.querySelector('#main');
const status = document.querySelector('#status');
let nodes = [];
let loaded = false;
let syncing = false;
let fingerprint = '';

// Navigation stays on this device; menu content is shared in Supabase.
history.replaceState({ menuDepth: 0 }, '');
function currentMenu() {
  const id = location.hash.slice(1);
  return nodes.find(node => node.id === id && node.kind === 'menu') || null;
}
function navigate(hash) {
  if (location.hash === hash) return;
  history.pushState({ menuDepth: (history.state?.menuDepth || 0) + 1 }, '', hash || location.pathname + location.search);
  status.textContent = '';
  render();
  menu.querySelector('.item')?.focus();
}
function render() {
  const parent = currentMenu();
  main.disabled = !location.hash;
  back.disabled = !(history.state?.menuDepth > 0);
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
    if (entry.kind === 'menu') {
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
async function syncMenus() {
  if (syncing) return;
  syncing = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(SUPABASE_URL + '/rest/v1/' + TABLE + '?select=id,parent_id,label,kind,url,sort_order&order=sort_order.asc,id.asc', {
      headers: { apikey: SUPABASE_KEY }, cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) throw new Error('Menu request failed: ' + response.status);
    const data = await response.json();
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
    clearTimeout(timeout);
    syncing = false;
  }
}
main.addEventListener('click', () => navigate(''));
back.addEventListener('click', () => { if (history.state?.menuDepth > 0) history.back(); });
window.addEventListener('popstate', () => { status.textContent = ''; render(); menu.querySelector('.item')?.focus(); });
window.addEventListener('hashchange', render);
window.addEventListener('focus', syncMenus);
window.addEventListener('online', syncMenus);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncMenus(); });
setInterval(() => { if (!document.hidden) syncMenus(); }, 5000);
status.textContent = 'Loading menus…';
render();
syncMenus();
