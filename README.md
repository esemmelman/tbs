# My Links

A centered shared menu. Contacts opens the supplied Google spreadsheet and appears above Zoom. Zoom opens Emelia Esterkin, Sasha Esterkin, and Talia Gladstein. Each student's screen contains Doc, which opens a separate rich text document. Use Main to return to the starting menu or Back to return to the previous screen.

Menus are stored exclusively in `public.tbs_menu_nodes_v1` in the existing bnaimitzvah Supabase project (`fgomaujsdblpzxhnnqrg`). This dedicated table was checked against existing tables before creation. No other app tables are changed. `database/schema.sql` records the initial setup; do not rerun it on the existing table.

Each menu row has an `id`, `parent_id` (null for the starting screen), `label`, `kind` (`menu`, `item`, or `document`), optional HTTP(S) `url`, and `sort_order`. Edit these rows in Supabase to change shared menus. Menu rows have public read access only. The frontend uses a publishable API key, never a secret or service-role key.

Student documents are stored in the dedicated `public.tbs_student_documents_v1` table, keyed by the student's Doc menu node. `database/student-documents.sql` records the Contacts/menu changes and document setup after the initial schema. Documents are publicly readable and editable without sign-in, as requested. No other app tables are changed.

The editor supports bold, italic, underline, bullets, and a button to insert the current date and time in bold at the cursor using the device's locale and timezone. Rich text is sanitized to basic formatting before storage and display. Changes autosave after 700 ms; Save also saves immediately. Pending drafts are backed up in browser storage when available. A revision filter prevents stale writes: conflicting edits require an explicit choice between Save my version and Use saved version.

Every device loads shared menus and documents from Supabase. Visible pages poll every five seconds and refresh on focus, reconnect, or becoming visible. Clean documents refresh when the editor is not focused, preserving the cursor during editing. Network errors display a message and retry. There is no automatic client-side reseeding.

No runtime dependencies or build step. Serve this directory with any static web server. For development checks, run `npm ci`, `npm run check`, and `npm test`. JSDOM is pinned as a development-only dependency.

Published at https://esemmelman.github.io/tbs/.

The current revision is displayed at the top-left of every menu. When publishing changes, increment the revision in `index.html` and use the same number in both asset query strings to refresh cached CSS and JavaScript.
