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
  return nodes.find(node => node.id === id && ['menu', 'document', 'task'].includes(node.kind)) || null;
}
function isTasksScreen(node) { return node?.kind === 'menu' && /^tasks$/i.test(node.label.trim()); }
function taskScreen() {
  const current = currentMenu();
  return current?.kind === 'task' ? nodes.find(n => n.id === current.parent_id) : isTasksScreen(current) ? current : null;
}
function screenDocument(parent) {
  return ['document', 'task'].includes(parent?.kind) ? parent : nodes.find(node => node.parent_id === parent?.id && node.kind === 'document');
}
function outstandingTaskCounts() {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const counts = new Map();
  for (const node of nodes) {
    if (node.kind !== 'task' && !isTasksScreen(node)) continue;
    const outstanding = node.kind === 'task' && !node.completed ? 1 : 0;
    let ancestor = node.kind === 'task' ? byId.get(node.parent_id) : node;
    const visited = new Set();
    while (ancestor && !visited.has(ancestor.id)) {
      visited.add(ancestor.id);
      counts.set(ancestor.id, (counts.get(ancestor.id) || 0) + outstanding);
      ancestor = byId.get(ancestor.parent_id);
    }
  }
  return counts;
}
function navigate(hash) {
  if (location.hash === hash) { render(); return; }
  history.pushState({ menuDepth: (history.state?.menuDepth || 0) + 1 }, '', hash || location.pathname + location.search);
  status.textContent = '';
  render();
  if (screenDocument(currentMenu())) document.querySelector('#document-title').focus();
  else menu.querySelector('.item')?.focus();
}
function render() {
  const parent = currentMenu();
  main.disabled = !location.hash;
  back.disabled = !(history.state?.menuDepth > 0);
  const documentNode = screenDocument(parent);
  const isDocument = Boolean(documentNode);
  panel.classList.toggle('document-open', isDocument);
  menu.hidden = isDocument;
  if (isDocument) {
    const student = nodes.find(node => node.id === documentNode.parent_id);
    documents.open(documentNode, student?.label || 'Student');
  } else documents.close();
  menu.hidden = false;
  menu.setAttribute('aria-label', parent?.label || 'Main menu');
  const focusedId = menu.contains(document.activeElement) ? document.activeElement.dataset.nodeId : null;
  menu.replaceChildren();
  if (!loaded) return;
  const taskCounts = outstandingTaskCounts();
  const entries = nodes.filter(node => node.parent_id === (parent?.id || null) && node.id !== documentNode?.id)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }));
  for (const entry of entries) {
    if (entry.kind === 'task') {
      const row = document.createElement('div');
      row.className = 'task-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(entry.completed);
      checkbox.setAttribute('aria-label', 'Complete ' + entry.label);
      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true;
        try {
          const result = await request(TABLE + '?id=eq.' + encodeURIComponent(entry.id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ completed: checkbox.checked }) });
          if (!result.length) throw new Error('Task unavailable');
          entry.completed = checkbox.checked;
          row.classList.toggle('completed', entry.completed);
          status.textContent = '';
        } catch { checkbox.checked = Boolean(entry.completed); status.textContent = 'Unable to update task. Please try again.'; }
        finally { checkbox.disabled = false; }
      });
      row.classList.toggle('completed', Boolean(entry.completed));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'item task-name';
      button.textContent = (entries.filter(n => n.kind === 'task').indexOf(entry) + 1) + '. ' + entry.label;
      button.addEventListener('click', () => navigate('#' + entry.id));
      row.append(checkbox, button);
      menu.append(row);
      continue;
    }
    const isLink = entry.kind !== 'document';
    const item = document.createElement(isLink ? 'a' : 'button');
    item.className = 'item';
    item.dataset.nodeId = entry.id;
    item.textContent = entry.label + (taskCounts.has(entry.id) ? ' (' + taskCounts.get(entry.id) + ')' : '');
    if (entry.kind === 'document') {
      item.type = 'button';
      item.addEventListener('click', () => navigate('#' + entry.id));
    } else if (!entry.url) {
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
  if (!entries.length && !isDocument) status.textContent = 'This menu is empty.';
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
    const data = await request(TABLE + '?select=id,parent_id,label,kind,url,sort_order,completed&order=sort_order.asc,id.asc');
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

const modifyDialog = document.querySelector('#modify-dialog');
const modifyForm = document.querySelector('#modify-form');
const modifyItem = document.querySelector('#modify-item');
const modifyLabel = document.querySelector('#modify-label');
const modifyURL = document.querySelector('#modify-url');
const modifyParent = document.querySelector('#modify-parent');
const modifyStatus = document.querySelector('#modify-status');
let modifying = false;
function descendants(id) {
  const ids = new Set([id]);
  let count;
  do { count = ids.size; nodes.forEach(node => { if (ids.has(node.parent_id)) ids.add(node.id); }); } while (count !== ids.size);
  return ids;
}
function screenName(node, seen = new Set()) {
  if (!node || seen.has(node.id)) return 'Main';
  seen.add(node.id);
  return screenName(nodes.find(n => n.id === node.parent_id), seen) + ' / ' + node.label;
}
function populateModify() {
  const selected = nodes.find(node => node.id === modifyItem.value);
  const isTask = selected ? selected.kind === 'task' : Boolean(taskScreen());
  document.querySelector('#modify-title').textContent = taskScreen() ? 'Modify tasks' : 'Modify items';
  modifyURL.closest('label').hidden = isTask;
  modifyForm.querySelector('.hint').hidden = isTask;
  modifyLabel.value = selected?.label || '';
  modifyURL.value = selected?.url || '';
  modifyURL.disabled = isTask || selected?.kind === 'document';
  const excluded = selected ? descendants(selected.id) : new Set();
  modifyParent.replaceChildren(new Option('Main', ''));
  nodes.filter(node => !node.url && node.kind !== 'task' && !excluded.has(node.id)).forEach(node => {
    modifyParent.add(new Option(screenName(node), node.id));
  });
  modifyParent.value = selected?.parent_id || (selected ? '' : taskScreen()?.id || currentMenu()?.id || '');
  modifyParent.closest('label').hidden = !selected;
  document.querySelector('#modify-save').textContent = selected ? 'Save' : 'Add';
  document.querySelector('#modify-delete').disabled = !selected;
  modifyStatus.textContent = '';
}
document.querySelector('#modify').addEventListener('click', async () => {
  await syncMenus();
  if (!loaded) return;
  modifyItem.replaceChildren(new Option('Add a new item', ''));
  const current = taskScreen()?.id || currentMenu()?.id || null;
  const choices = taskScreen() ? nodes.filter(n => n.parent_id === current && n.kind === 'task') : [...nodes.filter(n => n.parent_id === current), ...nodes.filter(n => n.parent_id !== current)];
  choices.forEach(node => {
    modifyItem.add(new Option(screenName(node), node.id));
  });
  populateModify();
  modifyDialog.showModal();
  modifyLabel.focus();
});
modifyItem.addEventListener('change', populateModify);
document.querySelector('#modify-close').addEventListener('click', () => modifyDialog.close());
modifyDialog.addEventListener('cancel', event => { if (modifying) event.preventDefault(); });
async function modifyRequest(action) {
  if (modifying) return;
  modifying = true;
  const controls = [...modifyForm.querySelectorAll('input, select, button')];
  const disabled = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  modifyStatus.textContent = 'Saving…';
  try {
    await action();
    await syncMenus();
    if (location.hash && !nodes.some(node => node.id === location.hash.slice(1))) navigate('');
    modifyDialog.close();
  } catch (error) {
    modifyStatus.textContent = error.message || 'Unable to save. Please try again.';
  } finally {
    modifying = false;
    controls.forEach((control, i) => { control.disabled = disabled[i]; });
  }
}
modifyForm.addEventListener('submit', event => {
  event.preventDefault();
  const selected = nodes.find(node => node.id === modifyItem.value);
  const label = modifyLabel.value.trim();
  const isTask = selected ? selected.kind === 'task' : Boolean(taskScreen());
  const url = isTask ? '' : modifyURL.value.trim();
  const parent_id = selected ? modifyParent.value || null : taskScreen()?.id || currentMenu()?.id || null;
  if (!label) { modifyStatus.textContent = 'Enter a name.'; return; }
  if (url && !/^https?:\/\//i.test(url)) { modifyStatus.textContent = 'Use an http:// or https:// URL.'; return; }
  if (selected && descendants(selected.id).has(parent_id)) { modifyStatus.textContent = 'An item cannot be placed inside itself.'; return; }
  if (url && selected && nodes.some(node => node.parent_id === selected.id)) {
    modifyStatus.textContent = 'Move or delete the items inside this screen before giving it a URL.'; return;
  }
  const row = { label, url: url || null, parent_id, kind: isTask ? 'task' : selected?.kind === 'document' ? 'document' : url ? 'item' : 'menu' };
  if (!selected) {
    row.id = crypto.randomUUID();
    row.sort_order = Math.max(-1, ...nodes.filter(n => n.parent_id === parent_id).map(n => n.sort_order || 0)) + 1;
  }
  modifyRequest(async () => {
    const result = await request(TABLE + (selected ? '?id=eq.' + encodeURIComponent(selected.id) : ''), {
      method: selected ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row)
    });
    if (!result.length) throw new Error('The item was not saved. Refresh and try again.');
  });
});
document.querySelector('#modify-delete').addEventListener('click', () => {
  const selected = nodes.find(node => node.id === modifyItem.value);
  if (!selected) return;
  const count = descendants(selected.id).size - 1;
  if (!confirm('Delete “' + selected.label + '”' + (count ? ' and its ' + count + ' nested item(s)' : '') + '? Any attached documents will also be deleted.')) return;
  modifyRequest(async () => {
    const result = await request(TABLE + '?id=eq.' + encodeURIComponent(selected.id), { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    if (!result.length) throw new Error('The item was not deleted. Refresh and try again.');
  });
});
