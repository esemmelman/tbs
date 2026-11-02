/* Keep one blank line, plus a final empty line where the user can type. */
function normalizeDocumentSpacing(root) {
  const blocks = new Set(['P', 'DIV', 'LI', 'BLOCKQUOTE', 'H2', 'H3']);
  let lastLeaf = null;
  function findLast(node) {
    if (node.nodeType === 3) { if (node.textContent.trim()) lastLeaf = node; }
    else if (node.nodeType === 1) {
      if (node.tagName === 'BR' || (blocks.has(node.tagName) && !node.childNodes.length)) lastLeaf = node;
      for (const child of node.childNodes) findLast(child);
    }
  }
  for (const child of root.childNodes) findLast(child);
  let hasText = false;
  let blanks = 0;
  function walk(parent) {
    for (const node of [...parent.childNodes]) {
      if (node.nodeType === 3) {
        if (node.textContent.trim()) { hasText = true; blanks = 0; }
        continue;
      }
      if (node.nodeType !== 1) continue;
      const block = blocks.has(node.tagName);
      if (block && hasText) { hasText = false; blanks = 0; }
      if (block && !node.textContent.trim() && !node.querySelector('img,video,hr')) {
        const trailing = node === lastLeaf || node.contains(lastLeaf);
        if (blanks >= (trailing ? 2 : 1)) node.remove();
        else { node.replaceChildren(document.createElement('br')); blanks++; }
        continue;
      }
      if (node.tagName === 'BR') {
        if (node === lastLeaf) continue; // Browser's final caret placeholder.
        if (hasText) { hasText = false; blanks = 0; }
        else if (blanks >= 1) node.remove();
        else blanks++;
      } else walk(node);
      if (block && hasText) { hasText = false; blanks = 0; }
    }
  }
  walk(root);
}

/* A small shared rich text editor. Only basic formatting is stored/rendered. */
function cleanDocumentHTML(html) {
  const source = document.createElement('template');
  source.innerHTML = html;
  const output = document.createElement('div');
  const allowed = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H2', 'H3', 'SPAN', 'S', 'STRIKE']);
  const dropped = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE']);
  function copy(node, parent) {
    if (node.nodeType === 3) {
      parent.append(document.createTextNode(node.textContent));
    } else if (node.nodeType === 1 && !dropped.has(node.tagName)) {
      const target = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : parent;
      if (target !== parent) parent.append(target);
      for (const child of node.childNodes) copy(child, target);
    }
  }
  for (const node of source.content.childNodes) copy(node, output);
  normalizeDocumentSpacing(output);
  return output.innerHTML;
}

function createStudentDocuments(request) {
  const screen = document.querySelector('#document-screen');
  const editor = document.querySelector('#document-editor');
  const toolbar = document.querySelector('#document-toolbar');
  const status = document.querySelector('#document-status');
  const conflictControls = document.querySelector('#document-conflict');
  const sessions = new Map();
  let active = null;
  let selection = null;
  let composing = false;
  const draftKey = id => 'tbs.doc.draft.v1:' + id;
  function backup(session) {
    try {
      if (session.dirty) localStorage.setItem(draftKey(session.id), JSON.stringify({ html: session.html, revision: session.revision }));
      else localStorage.removeItem(draftKey(session.id));
    } catch { /* Saving to Supabase still works when local storage is unavailable. */ }
  }
  function showState(session) {
    if (active !== session) return;
    toolbar.disabled = !session.loaded;
    editor.contentEditable = String(session.loaded);
    conflictControls.hidden = !session.conflict;
    status.textContent = session.conflict ? 'This document changed on another device. Your text is kept here. Choose which version to save.'
      : session.error || (session.saving ? 'Saving…' : session.dirty ? 'Not saved yet…' : session.loaded ? '' : 'Loading document…');
  }
  function capture() {
    if (!active?.loaded) return;
    normalizeDocumentSpacing(editor);
    const html = cleanDocumentHTML(editor.innerHTML);
    if (html === active.html) return;
    active.html = html;
    active.dirty = true;
    active.error = '';
    backup(active);
    showState(active);
    clearTimeout(active.timer);
    const session = active;
    active.timer = setTimeout(() => save(session), 700);
  }
  async function fetchRow(session) {
    const rows = await request('tbs_student_documents_v1?node_id=eq.' + encodeURIComponent(session.id) + '&select=node_id,content_html,revision,updated_at');
    if (rows.length !== 1) throw new Error('Document is unavailable.');
    return rows[0];
  }
  async function load(session) {
    if (session.loading || session.saving || session.dirty) return;
    session.loading = true;
    try {
      const row = await fetchRow(session);
      // A user may start typing while this request is in flight.
      if (session.dirty || session.saving) return;
      if (session.loaded && row.revision < session.revision) return;
      const html = cleanDocumentHTML(row.content_html);
      if (session.loaded && active === session && document.activeElement === editor && row.revision !== session.revision) return;
      const firstLoad = !session.loaded;
      session.html = html;
      session.revision = row.revision;
      session.loaded = true;
      session.error = '';
      if (firstLoad) {
        try {
          const draft = JSON.parse(localStorage.getItem(draftKey(session.id)) || 'null');
          if (draft && typeof draft.html === 'string' && cleanDocumentHTML(draft.html) !== html) {
            session.html = cleanDocumentHTML(draft.html);
            session.dirty = true;
            session.conflict = draft.revision !== row.revision;
          } else backup(session);
        } catch { /* Ignore a malformed local draft. */ }
      }
      if (active === session && editor.innerHTML !== session.html) {
        editor.innerHTML = session.html;
        selection = null;
      }
      if (session.dirty && !session.conflict) void save(session);
    } catch (error) {
      session.error = 'Unable to load document. Check your connection; retrying shortly.';
    } finally {
      session.loading = false;
      showState(session);
    }
  }
  async function save(session = active) {
    if (!session?.loaded || !session.dirty || session.saving || session.conflict || (active === session && composing)) return;
    clearTimeout(session.timer);
    const html = session.html;
    session.saving = true;
    session.error = '';
    showState(session);
    try {
      const rows = await request('tbs_student_documents_v1?node_id=eq.' + encodeURIComponent(session.id) + '&revision=eq.' + session.revision, {
        method: 'PATCH',
        body: JSON.stringify({ content_html: html, revision: session.revision + 1, updated_at: new Date().toISOString() }),
        headers: { Prefer: 'return=representation' }
      });
      if (rows.length !== 1) {
        const remote = await fetchRow(session);
        // A retry after a lost response can find that the same text was saved.
        if (cleanDocumentHTML(remote.content_html) === html) session.revision = remote.revision;
        else {
          session.conflict = true;
          session.remote = remote;
        }
      } else session.revision = rows[0].revision;
      if (!session.conflict) session.dirty = session.html !== html;
      backup(session);
    } catch (error) {
      session.error = 'Not saved to Supabase. Your draft is kept on this device; retrying shortly.';
      backup(session);
    } finally {
      session.saving = false;
      showState(session);
      if (session.dirty && !session.conflict && !session.error) session.timer = setTimeout(() => save(session), 700);
    }
  }
  function rememberSelection() {
    const value = window.getSelection();
    if (value?.rangeCount && editor.contains(value.getRangeAt(0).commonAncestorContainer)) selection = value.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    editor.focus();
    const value = window.getSelection();
    const range = selection && editor.contains(selection.commonAncestorContainer) ? selection : document.createRange();
    if (range !== selection) { range.selectNodeContents(editor); range.collapse(false); }
    value.removeAllRanges();
    value.addRange(range);
  }
  function command(name, value = null) {
    if (!active?.loaded) return;
    restoreSelection();
    document.execCommand(name, false, value);
    rememberSelection();
    capture();
  }
  for (const button of toolbar.querySelectorAll('button')) {
    button.addEventListener('mousedown', event => event.preventDefault());
    if (button.dataset.command) button.addEventListener('click', () => command(button.dataset.command));
  }
  document.querySelector('#insert-date').addEventListener('click', () => {
    if (!active?.loaded) return;
    const timestamp = document.createElement('strong');
    timestamp.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    restoreSelection();
    document.execCommand('insertHTML', false, timestamp.outerHTML + '<br><br><span data-timestamp-cursor></span><br>');
    const marker = editor.querySelector('[data-timestamp-cursor]');
    if (marker) {
      const range = document.createRange();
      range.setStartBefore(marker);
      range.collapse(true);
      marker.remove();
      const current = window.getSelection();
      current.removeAllRanges();
      current.addRange(range);
    }
    rememberSelection();
    capture();
  });
  document.querySelector('#keep-document').addEventListener('click', async () => {
    const session = active;
    try {
      const remote = await fetchRow(session);
      session.revision = remote.revision;
      session.conflict = false;
      backup(session);
      await save(session);
    } catch { session.error = 'Unable to save. Please try again.'; showState(session); }
  });
  document.querySelector('#reload-document').addEventListener('click', async () => {
    const session = active;
    try {
      const remote = await fetchRow(session);
      session.html = cleanDocumentHTML(remote.content_html);
      session.revision = remote.revision;
      session.dirty = false;
      session.conflict = false;
      session.error = '';
      backup(session);
      if (active === session) { editor.innerHTML = session.html; selection = null; }
      showState(session);
    } catch { session.error = 'Unable to load saved version. Please try again.'; showState(session); }
  });
  editor.addEventListener('input', () => { if (!composing) capture(); });
  editor.addEventListener('compositionstart', () => { composing = true; });
  editor.addEventListener('compositionend', () => { composing = false; capture(); });
  editor.addEventListener('blur', () => { capture(); void save(); });
  editor.addEventListener('paste', event => {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    if (html) command('insertHTML', cleanDocumentHTML(html));
    else command('insertText', event.clipboardData.getData('text/plain'));
  });
  editor.addEventListener('drop', event => event.preventDefault());
  document.addEventListener('selectionchange', rememberSelection);
  window.addEventListener('beforeunload', event => {
    capture();
    if ([...sessions.values()].some(session => session.dirty || session.saving)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  return {
    open(node, student) {
      if (active?.id === node.id) return;
      this.close();
      let session = sessions.get(node.id);
      if (!session) { session = { id: node.id, html: '', revision: 0, loaded: false, dirty: false }; sessions.set(node.id, session); }
      active = session;
      selection = null;
      composing = false;
      screen.hidden = false;
      document.querySelector('#document-title').textContent = student + ' — Doc';
      editor.setAttribute('aria-label', student + ' document');
      editor.innerHTML = session.loaded ? session.html : '';
      showState(session);
      void load(session);
    },
    close() {
      capture();
      if (active) void save(active);
      active = null;
      screen.hidden = true;
    },
    async sync() {
      for (const session of sessions.values()) if (session.dirty) await save(session);
      if (active && !active.dirty) await load(active);
    }
  };
}
