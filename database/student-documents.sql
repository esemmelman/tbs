alter table public.tbs_menu_nodes_v1 drop constraint tbs_menu_nodes_v1_kind_check;
alter table public.tbs_menu_nodes_v1 add constraint tbs_menu_nodes_v1_kind_check check (kind in ('menu','item','document'));
update public.tbs_menu_nodes_v1 set kind='menu' where id in ('emelia-esterkin','sasha-esterkin');
insert into public.tbs_menu_nodes_v1 (id,parent_id,label,kind,url,sort_order) values
('contacts',null,'Contacts','item','https://docs.google.com/spreadsheets/d/1ozC_GJbJ9wYQ9M5UciM27ogA2STenmCq/edit?gid=2118017502#gid=2118017502',-1),
('emelia-esterkin-doc','emelia-esterkin','Doc','document',null,0),
('sasha-esterkin-doc','sasha-esterkin','Doc','document',null,0);
create table public.tbs_student_documents_v1 (
  node_id text primary key references public.tbs_menu_nodes_v1(id) on delete cascade,
  content_html text not null default '' check (octet_length(content_html) <= 1048576),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
comment on table public.tbs_student_documents_v1 is 'Rich text documents for tbs only, one per student Doc node. Publicly readable and editable without sign-in by design.';
alter table public.tbs_student_documents_v1 enable row level security;
revoke all on public.tbs_student_documents_v1 from anon,authenticated;
grant select on public.tbs_student_documents_v1 to anon,authenticated;
grant update (content_html,revision,updated_at) on public.tbs_student_documents_v1 to anon,authenticated;
create policy tbs_student_documents_v1_read on public.tbs_student_documents_v1 for select to anon,authenticated using (true);
create policy tbs_student_documents_v1_update on public.tbs_student_documents_v1 for update to anon,authenticated using (true) with check (true);
insert into public.tbs_student_documents_v1 (node_id)
select id from public.tbs_menu_nodes_v1 where kind='document';
