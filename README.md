# My Links

A centered shared menu. The starting screen contains Zoom, which opens Emelia Esterkin and Sasha Esterkin. Their destination URLs are currently unset; clicking either name explains that its link has not been added. Use Main to return to the starting menu or Back to return to the previous screen.

Menus are stored exclusively in `public.tbs_menu_nodes_v1` in the existing bnaimitzvah Supabase project (`fgomaujsdblpzxhnnqrg`). This dedicated table was checked against existing tables before creation. No other app tables are changed. `database/schema.sql` records the initial setup; do not rerun it on the existing table.

Each row has an `id`, `parent_id` (null for the starting screen), `label`, `kind` (`menu` or `item`), optional HTTP(S) `url`, and `sort_order`. Edit these rows in Supabase to change shared content. Browser clients have public read access only; changes are made through Supabase or an authorized maintenance tool. The frontend uses a publishable API key, never a secret or service-role key.

Every device loads from Supabase without using a browser-local menu copy. Visible pages poll every five seconds and refresh on focus, reconnect, or becoming visible. Network errors retain the last successfully loaded content in memory, display a message, and retry. There is no offline editing or automatic client-side reseeding.

No dependencies or build step. Serve this directory with any static web server. Run `node --check app.js` and `node --test app.test.cjs` for syntax and behavior checks.

Published at https://esemmelman.github.io/tbs/.

The current revision is displayed at the top-left of every menu. When publishing changes, increment the revision in `index.html` and use the same number in both asset query strings to refresh cached CSS and JavaScript.
