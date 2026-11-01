create table public.tbs_menu_nodes_v1 (
  id text primary key,
  parent_id text references public.tbs_menu_nodes_v1(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  kind text not null check (kind in ('menu', 'item')),
  url text check (url is null or url ~ '^https?://'),
  sort_order integer not null default 0,
  check (parent_id is distinct from id),
  check (kind = 'item' or url is null)
);
create index tbs_menu_nodes_v1_parent_order_idx on public.tbs_menu_nodes_v1(parent_id, sort_order, id);
comment on table public.tbs_menu_nodes_v1 is 'Dedicated shared menus for esemmelman/tbs only. Never reuse for other apps.';
alter table public.tbs_menu_nodes_v1 enable row level security;
revoke all on public.tbs_menu_nodes_v1 from anon, authenticated;
grant select on public.tbs_menu_nodes_v1 to anon, authenticated;
create policy tbs_menu_nodes_v1_public_read on public.tbs_menu_nodes_v1 for select to anon, authenticated using (true);
insert into public.tbs_menu_nodes_v1 (id,parent_id,label,kind,sort_order) values
('zoom',null,'Zoom','menu',0),
('emelia-esterkin','zoom','Emelia Esterkin','item',0),
('sasha-esterkin','zoom','Sasha Esterkin','item',1);
