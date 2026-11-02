# My Links

A centered shared menu. Contacts opens the supplied Google spreadsheet and appears above Zoom. Zoom opens Ahava Singleman, Emelia Esterkin, Ever Meza, Sasha Esterkin, Stuart-Leo Singleman, and Talia Gladstein. Clicking a student displays their existing rich text document directly, without an intermediate Doc link. Existing document links still work. Successful saves have no status message; loading, pending saves, conflicts, and errors remain visible. Use Main to return to the starting menu or Back to return to the previous screen.

Menus are stored exclusively in `public.tbs_menu_nodes_v1` in the existing bnaimitzvah Supabase project (`fgomaujsdblpzxhnnqrg`). This dedicated table was checked against existing tables before creation. No other app tables are changed. `database/schema.sql` records the initial setup; do not rerun it on the existing table.

Each menu row has an `id`, `parent_id` (null for the starting screen), `label`, `kind` (`menu`, `item`, or `document`), optional HTTP(S) `url`, and `sort_order`. Use Modify beside Back on any screen to add, edit, move, or delete shared menu items. Every screen lists its items alphabetically. The popup includes a name and optional HTTP(S) URL. New items are automatically placed on the current screen; editing an existing item also offers a parent-screen selector. A blank URL opens a nested screen. Existing documents retain their document type. Deleting a screen also deletes its nested items and attached documents after confirmation. Menu rows are publicly readable and editable without sign-in, matching document editing. The scoped grants and RLS policies are recorded in database/menu-editing.sql. The frontend uses a publishable API key, never a secret or service-role key.

Student documents are stored in the dedicated `public.tbs_student_documents_v1` table, keyed by the student's Doc menu node. `database/student-documents.sql` records the Contacts/menu changes and document setup after the initial schema. Documents are publicly readable and editable without sign-in, as requested. No other app tables are changed.

The editor supports bold, italic, underline, bullets, and a button to insert the current date and time in bold at the cursor using the device's locale and timezone. Rich text is sanitized to basic formatting before storage and display. Changes autosave after 700 ms. Timestamps leave one blank line before the next typing line, with the cursor positioned there. Editor spacing is compact and consecutive blank lines are limited to one (plus the final empty typing line). Pending drafts are backed up in browser storage when available. A revision filter prevents stale writes: conflicting edits require an explicit choice between Save my version and Use saved version.

Every device loads shared menus and documents from Supabase. Visible pages poll every five seconds and refresh on focus, reconnect, or becoming visible. Clean documents refresh when the editor is not focused, preserving the cursor during editing. Network errors display a message and retry. There is no automatic client-side reseeding.

No runtime dependencies or build step. Serve this directory with any static web server. For development checks, run `npm ci`, `npm run check`, and `npm test`. JSDOM is pinned as a development-only dependency.

Published at https://esemmelman.github.io/tbs/.

The current revision is displayed at the top-left of every menu. When publishing changes, increment the revision in `index.html` and use the same number in both asset query strings to refresh cached CSS and JavaScript.

Screens named Tasks display alphabetical, sequentially numbered tasks. Use Modify to add, rename, move, or delete tasks. Checkboxes toggle completion and strikethrough without opening the task. Click a task name to open its autosaving rich text details with the existing formatting, draft recovery, and conflict handling. New tasks automatically get a document row through a scoped SECURITY INVOKER trigger. The completed column, task type, trigger, and permissions are recorded in database/tasks.sql. No sign-in is required, matching the app's shared editing model.
