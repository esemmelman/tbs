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
    if (path.pathname.endsWith('tbs_menu_nodes_v1')) rows = db.nodes;
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
    return true;
  };
  w.eval(fs.readFileSync('documents.js', 'utf8'));
  w.eval(fs.readFileSync('app.js', 'utf8'));
  await settle();
  return {
    w,
    get: id => w.document.querySelector(id),
    labels: () => [...w.document.querySelectorAll('#menu .item')].map(item => item.textContent),
    async open(student) { w.navigate('#' + student + '-doc'); await settle(); },
    edit(html) { const el = w.document.querySelector('#document-editor'); el.innerHTML = html; el.dispatchEvent(new w.Event('input')); },
    async save() { w.document.querySelector('#save-document').click(); await settle(); }
  };
}

test('Contacts is first, student menus contain Doc, and Main/Back work', async t => {
  const c = await client(t, database());
  assert.deepEqual(c.labels(), ['Contacts', 'Zoom']);
  assert.equal(c.get('#menu a').href, contactsURL);
  c.w.navigate('#zoom');
  assert.deepEqual(c.labels(), ['Emelia Esterkin', 'Sasha Esterkin']);
  c.get('#menu a').click();
  assert.deepEqual(c.labels(), ['Doc']);
  assert.equal(c.get('#menu .item').tagName, 'BUTTON');
  c.get('#menu .item').click();
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
  await a.save();
  assert.match(db.documents.get('emelia-esterkin-doc').content_html, new RegExp(String(new Date().getFullYear())));
  await a.open('sasha-esterkin');
  assert.equal(a.get('#document-editor').innerHTML, '');
  a.edit('<i>Sasha only</i>');
  await a.save();
  assert.equal(db.documents.get('sasha-esterkin-doc').content_html, '<i>Sasha only</i>');
  assert.match(db.documents.get('emelia-esterkin-doc').content_html, /Lesson notes/);
  await b.w.syncAll();
  assert.match(b.get('#document-editor').textContent, new RegExp(String(new Date().getFullYear())));
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
  assert.equal(c.get('#document-status').textContent, 'Saved');
});
