const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

const seed = [
  { id: 'zoom', parent_id: null, label: 'Zoom', kind: 'menu', url: null },
  { id: 'emelia-esterkin', parent_id: 'zoom', label: 'Emelia Esterkin', kind: 'item', url: null },
  { id: 'sasha-esterkin', parent_id: 'zoom', label: 'Sasha Esterkin', kind: 'item', url: null }
];
const settle = () => new Promise(resolve => setImmediate(resolve));

function client(database) {
  let context;
  function element() {
    return {
      children: [], dataset: {}, textContent: '',
      append(...children) { this.children.push(...children); },
      replaceChildren() { this.children = []; },
      contains(node) { return this.children.includes(node); },
      setAttribute() {},
      addEventListener(event, callback) { this[event] = callback; },
      querySelector() { return this.children[0]; },
      focus() { context.document.activeElement = this; }
    };
  }
  const elements = Object.fromEntries(['#menu', '#main', '#back', '#status'].map(id => [id, element()]));
  const events = {};
  let position = 0;
  const history = [];
  context = {
    document: { hidden: false, activeElement: null, querySelector: id => elements[id], createElement: element, addEventListener() {} },
    location: { hash: '', pathname: '/tbs/', search: '' },
    window: { addEventListener: (event, fn) => { events[event] = fn; } },
    history: {
      state: null,
      replaceState(state) { this.state = state; history[position] = { state, hash: '' }; },
      pushState(state, _, url) {
        this.state = state;
        context.location.hash = url.startsWith('#') ? url : '';
        history.splice(++position);
        history[position] = { state, hash: context.location.hash };
      },
      back() {
        const previous = history[--position];
        this.state = previous.state;
        context.location.hash = previous.hash;
        events.popstate();
      }
    },
    fetch: async () => {
      if (database.fail) throw new Error('Offline');
      return { ok: true, json: async () => structuredClone(database.rows) };
    },
    AbortController, setTimeout, clearTimeout, setInterval() {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return { context, elements, run: code => vm.runInContext(code, context) };
}

test('two devices load the shared menu, navigate, and observe updates without reseeding', async () => {
  const database = { rows: structuredClone(seed) };
  const a = client(database), b = client(database);
  await settle();
  for (const device of [a, b]) {
    assert.deepEqual(device.elements['#menu'].children.map(item => item.textContent), ['Zoom']);
    device.run("navigate('#zoom')");
    assert.deepEqual(device.elements['#menu'].children.map(item => item.textContent), ['Emelia Esterkin', 'Sasha Esterkin']);
    assert.equal(device.elements['#menu'].children[0].children.length, 0);
  }
  a.elements['#menu'].children[0].click();
  assert.match(a.elements['#status'].textContent, /No Zoom link/);
  database.rows[1].url = 'https://example.com/meeting';
  for (const device of [a, b]) {
    await device.run('syncMenus()');
    assert.equal(device.elements['#menu'].children[0].href, 'https://example.com/meeting');
    assert.equal(device.elements['#menu'].children[0].textContent, 'Emelia Esterkin');
  }
  a.elements['#main'].click();
  assert.equal(a.context.location.hash, '');
  a.elements['#back'].click();
  assert.equal(a.context.location.hash, '#zoom');
  a.elements['#back'].click();
  assert.equal(a.context.location.hash, '');
  assert.equal(a.elements['#back'].disabled, true);
  database.rows = [];
  await a.run('syncMenus()');
  assert.equal(a.elements['#menu'].children.length, 0);
  assert.equal(a.elements['#status'].textContent, 'This menu is empty.');
});

test('network errors are visible, retain loaded content, and recover', async () => {
  const database = { rows: structuredClone(seed), fail: true };
  const device = client(database);
  await settle();
  assert.match(device.elements['#status'].textContent, /Unable to load/);
  database.fail = false;
  await device.run('syncMenus()');
  assert.equal(device.elements['#menu'].children[0].textContent, 'Zoom');
  database.fail = true;
  await device.run('syncMenus()');
  assert.match(device.elements['#status'].textContent, /Unable to sync/);
  assert.equal(device.elements['#menu'].children[0].textContent, 'Zoom');
  database.fail = false;
  await device.run('syncMenus()');
  assert.equal(device.elements['#status'].textContent, '');
});
