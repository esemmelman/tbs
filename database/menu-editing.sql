-- Shared editing from the Modify dialog, without sign-in, matching this app's document editing model.
begin;
grant insert, delete on public.tbs_menu_nodes_v1 to anon, authenticated;
grant update (label, url, parent_id, kind, sort_order) on public.tbs_menu_nodes_v1 to anon, authenticated;
create policy tbs_menu_nodes_v1_insert on public.tbs_menu_nodes_v1 for insert to anon, authenticated with check (true);
create policy tbs_menu_nodes_v1_update on public.tbs_menu_nodes_v1 for update to anon, authenticated using (true) with check (true);
create policy tbs_menu_nodes_v1_delete on public.tbs_menu_nodes_v1 for delete to anon, authenticated using (true);
commit;
