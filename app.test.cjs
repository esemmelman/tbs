const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const contactsURL = 'https://docs.google.com/spreadsheets/d/1ozC_GJbJ9wYQ9M5UciM27ogA2STenmCq/edit?gid=2118017502#gid=2118017502';
const seed = [
  { id: 'contacts', parent_id: null, label: 'Contacts', kind: 'item', url: contactsURL },
  { id: 'zoom', parent_id: null, label: 'Zoom', kind: 'menu', url: null },
  { id: 'emelia-esterkin', parent_id: 'zoom', label: 'Emelia Esterkin', kind: 'menu', url: null },
  { id: 'sasha-esterkin', parent_id: 'zoom', label: 'Sasha Esterkin', kind: 'menu', url: null },
  { id: 'emelia-esterkin-doc', parent_id: 'emelia-esterkin', label: 'Doc', kind: 'document', url: null },
  { id: 'sasha-esterkin-doc', parent_id: 'sasha-esterkin', label: 'Doc', kind: 'document', url: null }
];
const settle = async () => { for (let n = 0; n < 5; n++) await new Promise(resolve => setImmediate(resolve)); };
function database() {
  return { nodes: structuredClone(seed), documents: new Map(['emelia-esterkin-doc', 'sasha-esterkin-doc'].map(node_id => [node_id, { node_id, content_html: '', revision: 0 }])) };
}
async function client(t, db) {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), { url: 'https://example.com/tbs/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  t.after(() => w.close());
  w.fetch = async (url, options = {}) => {
    if (db.offline) throw new Error('Offline');
    const path = new URL(url);
    let rows;
    if (path.pathname.endsWith('tbs_menu_nodes_v1')) {
      const id = path.searchParams.get('id')?.slice(3);
      if (options.method === 'POST') {
        const row = JSON.parse(options.body); db.nodes.push(row); rows = [row];
        if (row.kind === 'task') db.documents.set(row.id, { node_id: row.id, content_html: '', revision: 0 });
      }
      else if (options.method === 'PATCH') { rows = db.nodes.filter(n => n.id === id); rows.forEach(n => Object.assign(n, JSON.parse(options.body))); }
      else if (options.method === 'DELETE') { rows = db.nodes.filter(n => n.id === id); db.nodes = db.nodes.filter(n => n.id !== id); }
      else rows = db.nodes;
    }
    else {
      const id = path.searchParams.get('node_id').slice(3);
      const row = db.documents.get(id);
      if (options.method === 'PATCH') {
        const revision = Number(path.searchParams.get('revision').slice(3));
        if (row && row.revision === revision) { Object.assign(row, JSON.parse(options.body)); rows = [row]; }
        else rows = [];
      } else rows = row ? [row] : [];
    }
    return { ok: true, json: async () => structuredClone(rows) };
  };
  w.document.execCommand = (command, _, value) => {
    if (command === 'insertText') w.document.querySelector('#document-editor').append(w.document.createTextNode(value));
    if (command === 'insertHTML') w.document.querySelector('#document-editor').insertAdjacentHTML('beforeend', value);
    return true;
  };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.confirm = () => true;
  w.eval(fs.readFileSync('documents.js', 'utf8'));
  w.eval(fs.readFileSync('app.js', 'utf8'));
  await settle();
  return {
    w,
    get: id => w.document.querySelector(id),
    labels: () => [...w.document.querySelectorAll('#menu .item')].map(item => item.textContent),
    async open(student) { w.navigate('#' + student + '-doc'); await settle(); },
    edit(html) { const el = w.document.querySelector('#document-editor'); el.innerHTML = html; el.dispatchEvent(new w.Event('input')); },
    async save() { await w.syncAll(); await settle(); }
  };
}

test('student names open their editor directly and Main/Back work', async t => {
  const c = await client(t, database());
  assert.deepEqual(c.labels(), ['Contacts', 'Zoom']);
  assert.equal(c.get('#menu a').href, contactsURL);
  c.w.navigate('#zoom');
  assert.deepEqual(c.labels(), ['Emelia Esterkin', 'Sasha Esterkin']);
  c.get('#menu a').click();
  assert.deepEqual(c.labels(), []);
  assert.equal(c.w.location.hash, '#emelia-esterkin');
  await settle();
  assert.equal(c.get('#document-screen').hidden, false);
  assert.equal(c.get('#document-title').textContent, 'Emelia Esterkin — Doc');
  c.get('#main').click();
  assert.deepEqual(c.labels(), ['Contacts', 'Zoom']);
  c.get('#back').click();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(c.get('#document-screen').hidden, false);
});

test('rich text saves per student and syncs to another client; date insertion saves', async t => {
  const db = database(), a = await client(t, db), b = await client(t, db);
  await a.open('emelia-esterkin');
  a.edit('<b>Lesson notes</b><ul><li>Practice</li></ul>');
  await a.save();
  assert.equal(db.documents.get('emelia-esterkin-doc').content_html, '<b>Lesson notes</b><ul><li>Practice</li></ul>');
  await b.open('emelia-esterkin');
  assert.equal(b.get('#document-editor').innerHTML, db.documents.get('emelia-esterkin-doc').content_html);
  a.get('#insert-date').click();
  assert.match(a.get('#document-editor strong').textContent, new RegExp(String(new Date().getFullYear())));
  assert.equal(a.get('#save-document'), null);
  const cursor = a.w.getSelection().getRangeAt(0);
  assert.equal(cursor.startContainer, a.get('#document-editor'));
  assert.equal(cursor.startContainer.childNodes[cursor.startOffset].tagName, 'BR');
  assert.equal(cursor.startContainer.childNodes[cursor.startOffset - 1].tagName, 'BR');
  assert.equal(cursor.startContainer.childNodes[cursor.startOffset - 2].tagName, 'BR');
  await a.save();
  assert.match(db.documents.get('emelia-esterkin-doc').content_html, /<strong>[^<]+<\/strong>/);
  assert.match(db.documents.get('emelia-esterkin-doc').content_html, new RegExp(String(new Date().getFullYear())));
  await a.open('sasha-esterkin');
  assert.equal(a.get('#document-editor').innerHTML, '');
  a.edit('<i>Sasha only</i>');
  await a.save();
  assert.equal(db.documents.get('sasha-esterkin-doc').content_html, '<i>Sasha only</i>');
  assert.match(db.documents.get('emelia-esterkin-doc').content_html, /Lesson notes/);
  b.get('#document-editor').blur(); // Remote updates wait while the automatically focused editor is active.
  await b.w.syncAll();
  assert.match(b.get('#document-editor').textContent, new RegExp(String(new Date().getFullYear())));
});

test('spacing normalization limits mixed paragraph and soft-break gaps without losing formatting', async t => {
  const c = await client(t, database());
  assert.equal(c.w.cleanDocumentHTML('<p><b>A</b></p><p><br></p><div><br></div><p><br></p><p><i>B</i></p>'), '<p><b>A</b></p><p><br></p><p><i>B</i></p>');
  assert.equal(c.w.cleanDocumentHTML('<p>A<br><br><br><br>B</p>'), '<p>A<br><br>B</p>');
  assert.equal(c.w.cleanDocumentHTML('<p>A<br><span><br><br></span><br>B</p>'), '<p>A<br><span><br></span>B</p>');
  assert.equal(c.w.cleanDocumentHTML('<div>A</div><div><br></div><div><br></div><div><br></div>'), '<div>A</div><div><br></div><div><br></div>');
  await c.open('emelia-esterkin');
  c.edit('<p>A</p><div><br></div><div><br></div><p>B</p>');
  assert.equal(c.get('#document-editor').innerHTML, '<p>A</p><div><br></div><p>B</p>');
  await c.save();
});

test('concurrent edits preserve the draft and require explicit conflict resolution', async t => {
  const db = database(), a = await client(t, db), b = await client(t, db);
  await a.open('emelia-esterkin'); await b.open('emelia-esterkin');
  a.edit('<b>Device A</b>'); await a.save();
  b.edit('<i>Device B</i>'); await b.save();
  assert.equal(b.get('#document-conflict').hidden, false);
  assert.equal(b.get('#document-editor').innerHTML, '<i>Device B</i>');
  assert.equal(db.documents.get('emelia-esterkin-doc').content_html, '<b>Device A</b>');
  b.get('#keep-document').click(); await settle();
  assert.equal(db.documents.get('emelia-esterkin-doc').content_html, '<i>Device B</i>');
  assert.equal(b.get('#document-conflict').hidden, true);
});

test('offline saves retain a draft, recover, and sanitization preserves only safe formatting', async t => {
  const db = database(), c = await client(t, db);
  assert.equal(c.w.cleanDocumentHTML('<script>alert(1)</script><img src=x onerror=alert(1)><b onclick="bad()">Safe</b><a href="javascript:bad()">text</a>'), '<b>Safe</b>text');
  await c.open('sasha-esterkin');
  db.offline = true;
  c.edit('<u>Offline draft</u>'); await c.save();
  assert.match(c.get('#document-status').textContent, /Not saved to Supabase/);
  assert.match(c.w.localStorage.getItem('tbs.doc.draft.v1:sasha-esterkin-doc'), /Offline draft/);
  db.offline = false;
  await c.w.syncAll();
  assert.equal(db.documents.get('sasha-esterkin-doc').content_html, '<u>Offline draft</u>');
  assert.equal(c.w.localStorage.getItem('tbs.doc.draft.v1:sasha-esterkin-doc'), null);
  assert.equal(c.get('#document-status').textContent, '');
});

test('Modify adds screens, edits and moves items, validates URLs and deletes shared items', async t => {
  const db = database(), c = await client(t, db), other = await client(t, db);
  c.w.navigate('#zoom');
  c.get('#modify').click(); await settle();
  assert.equal(c.get('#modify-dialog').open, true);
  assert.equal(c.get('#modify-parent').value, 'zoom');
  assert.equal(c.get('#modify-parent').closest('label').hidden, true);
  c.get('#modify-parent').value = ''; // Adding always uses the current screen.
  c.get('#modify-label').value = 'New screen';
  c.get('#modify-form').dispatchEvent(new c.w.Event('submit', { cancelable: true })); await settle();
  const added = db.nodes.find(n => n.label === 'New screen');
  assert.equal(added.parent_id, 'zoom');
  assert.equal(added.kind, 'menu'); assert.equal(added.url, null);
  await other.w.syncAll(); other.w.navigate('#zoom'); assert.ok(other.labels().includes('New screen'));
  c.get('#modify').click(); await settle();
  c.get('#modify-item').value = added.id;
  c.get('#modify-item').dispatchEvent(new c.w.Event('change'));
  assert.equal(c.get('#modify-parent').closest('label').hidden, false);
  assert.ok(![...c.get('#modify-parent').options].some(o => o.value === added.id));
  c.get('#modify-label').value = 'New link'; c.get('#modify-url').value = 'javascript:alert(1)';
  c.get('#modify-form').dispatchEvent(new c.w.Event('submit', { cancelable: true })); await settle();
  assert.match(c.get('#modify-status').textContent, /https/); assert.equal(added.kind, 'menu');
  c.get('#modify-url').value = 'https://example.com/'; c.get('#modify-parent').value = '';
  c.get('#modify-form').dispatchEvent(new c.w.Event('submit', { cancelable: true })); await settle();
  assert.equal(added.kind, 'item'); assert.equal(added.parent_id, null);
  c.w.navigate(''); assert.ok(c.labels().includes('New link'));
  c.get('#modify').click(); await settle(); c.get('#modify-item').value = added.id;
  c.get('#modify-item').dispatchEvent(new c.w.Event('change'));
  db.offline = true; c.get('#modify-delete').click(); await settle();
  assert.equal(c.get('#modify-dialog').open, true); assert.ok(db.nodes.includes(added));
  db.offline = false; c.get('#modify-delete').click(); await settle();
  assert.ok(!db.nodes.includes(added)); assert.equal(c.get('#modify-dialog').open, false);
  await c.open('emelia-esterkin'); c.get('#modify').click(); await settle();
  assert.equal(c.get('#modify-parent').value, 'emelia-esterkin-doc');
});

test('each screen sorts names alphabetically regardless of database order', async t => {
  const db = database();
  db.nodes.unshift({ id: 'zebra', parent_id: null, label: 'Zebra', kind: 'menu' });
  db.nodes.push({ id: 'alpha', parent_id: null, label: 'alpha', kind: 'menu' });
  db.nodes.push({ id: 'aaron', parent_id: 'zoom', label: 'Aaron', kind: 'menu' });
  const c = await client(t, db);
  assert.deepEqual(c.labels(), ['alpha', 'Contacts', 'Zebra', 'Zoom']);
  c.w.navigate('#zoom');
  assert.deepEqual(c.labels(), ['Aaron', 'Emelia Esterkin', 'Sasha Esterkin']);
});

test('Tasks supports numbered names, completion, rich text, rename, and delete across clients', async t => {
  const db = database();
  db.nodes.push({ id: 'tasks', parent_id: null, label: 'Tasks', kind: 'menu' });
  const a = await client(t, db), b = await client(t, db);
  a.w.navigate('#tasks');
  async function add(name) {
    a.get('#modify').click(); await settle();
    assert.equal(a.get('#modify-url').closest('label').hidden, true);
    a.get('#modify-label').value = name;
    a.get('#modify-form').dispatchEvent(new a.w.Event('submit', { cancelable: true })); await settle();
  }
  await add('Write report'); await add('Call teacher');
  assert.deepEqual(a.labels(), ['1. Call teacher', '2. Write report']);
  const task = db.nodes.find(n => n.label === 'Call teacher');
  assert.equal(task.kind, 'task'); assert.equal(task.parent_id, 'tasks');
  const checkbox = a.get('.task-row input');
  checkbox.checked = true; checkbox.dispatchEvent(new a.w.Event('change')); await settle();
  assert.equal(task.completed, true); assert.equal(a.get('.task-row').classList.contains('completed'), true);
  await b.w.syncAll(); b.w.navigate('#tasks');
  assert.equal(b.get('.task-row input').checked, true);
  a.get('.task-name').click(); await settle();
  assert.equal(a.get('#document-screen').hidden, false);
  assert.equal(a.get('#document-title').textContent, 'Call teacher');
  a.edit('<b>Discuss progress</b><ul><li>Schedule next lesson</li></ul>'); await a.save();
  assert.match(db.documents.get(task.id).content_html, /Discuss progress/);
  b.get('.task-name').click(); await settle();
  assert.equal(b.get('#document-editor').innerHTML, db.documents.get(task.id).content_html);
  assert.equal(b.get('#document-status').textContent, '');
  a.get('#modify').click(); await settle();
  a.get('#modify-item').value = task.id; a.get('#modify-item').dispatchEvent(new a.w.Event('change'));
  a.get('#modify-label').value = 'Ask teacher';
  a.get('#modify-form').dispatchEvent(new a.w.Event('submit', { cancelable: true })); await settle();
  assert.equal(task.label, 'Ask teacher'); assert.equal(task.completed, true);
  a.w.navigate('#tasks');
  db.offline = true;
  a.get('.task-row input').checked = false; a.get('.task-row input').dispatchEvent(new a.w.Event('change')); await settle();
  assert.equal(task.completed, true); assert.equal(a.get('.task-row input').checked, true);
  db.offline = false;
  a.get('.task-row input').checked = false; a.get('.task-row input').dispatchEvent(new a.w.Event('change')); await settle();
  assert.equal(task.completed, false); assert.equal(a.get('.task-row').classList.contains('completed'), false);
  a.get('#modify').click(); await settle(); a.get('#modify-item').value = task.id;
  a.get('#modify-item').dispatchEvent(new a.w.Event('change')); a.get('#modify-delete').click(); await settle();
  assert.deepEqual(a.labels(), ['1. Write report']);
});

test('outstanding tasks roll up through every ancestor and update after completion and deletion', async t => {
  const db = database();
  db.nodes.push(
    { id: 'temple', parent_id: null, label: 'Temple Beth David', kind: 'menu' },
    { id: 'brotherhood', parent_id: 'temple', label: 'Brotherhood', kind: 'menu' },
    { id: 'carnival', parent_id: 'brotherhood', label: 'Chanukah Carnival', kind: 'menu' },
    { id: 'tasks', parent_id: 'carnival', label: 'Tasks', kind: 'menu' },
    { id: 'other-tasks', parent_id: 'brotherhood', label: 'Tasks', kind: 'menu' },
    { id: 'task-a', parent_id: 'tasks', label: 'Arrange food', kind: 'task', completed: false },
    { id: 'task-b', parent_id: 'tasks', label: 'Book room', kind: 'task', completed: true },
    { id: 'task-c', parent_id: 'other-tasks', label: 'Call members', kind: 'task', completed: false }
  );
  const a = await client(t, db), b = await client(t, db);
  assert.ok(a.labels().includes('Temple Beth David (2)'));
  a.w.navigate('#temple'); assert.deepEqual(a.labels(), ['Brotherhood (2)']);
  a.w.navigate('#brotherhood'); assert.deepEqual(a.labels(), ['Chanukah Carnival (1)', 'Tasks (1)']);
  a.w.navigate('#carnival'); assert.deepEqual(a.labels(), ['Tasks (1)']);
  a.w.navigate('#tasks'); assert.deepEqual(a.labels(), ['1. Arrange food', '2. Book room']);
  const checkbox = a.get('.task-row input');
  checkbox.checked = true; checkbox.dispatchEvent(new a.w.Event('change')); await settle();
  a.w.navigate('#carnival'); assert.deepEqual(a.labels(), ['Tasks (0)']);
  a.w.navigate('#brotherhood'); assert.deepEqual(a.labels(), ['Chanukah Carnival (0)', 'Tasks (1)']);
  await b.w.syncAll(); assert.ok(b.labels().includes('Temple Beth David (1)'));
  db.nodes = db.nodes.filter(n => n.id !== 'task-c');
  await b.w.syncAll(); assert.ok(b.labels().includes('Temple Beth David (0)'));
});

test('opening rich text places the caret inside once, including reopening a loaded document', async t => {
  const db = database();
  db.documents.get('emelia-esterkin-doc').content_html = '<b>Existing notes</b>';
  const c = await client(t, db);
  c.w.navigate('#emelia-esterkin'); await settle();
  assert.equal(c.w.document.activeElement, c.get('#document-editor'));
  let range = c.w.getSelection().getRangeAt(0);
  assert.equal(range.collapsed, true);
  assert.equal(range.startContainer, c.get('#document-editor'));
  assert.equal(range.startOffset, c.get('#document-editor').childNodes.length);
  c.get('#main').focus(); await c.w.syncAll();
  assert.equal(c.w.document.activeElement, c.get('#main'));
  c.w.navigate(''); c.w.navigate('#emelia-esterkin'); await settle();
  assert.equal(c.w.document.activeElement, c.get('#document-editor'));
  range = c.w.getSelection().getRangeAt(0);
  assert.equal(range.startOffset, c.get('#document-editor').childNodes.length);
});
