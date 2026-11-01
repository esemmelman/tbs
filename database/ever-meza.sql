begin;
update public.tbs_menu_nodes_v1 set sort_order=sort_order+1 where parent_id='zoom' and sort_order>0;
insert into public.tbs_menu_nodes_v1 (id,parent_id,label,kind,sort_order) values
('ever-meza','zoom','Ever Meza','menu',1),
('ever-meza-doc','ever-meza','Doc','document',0);
insert into public.tbs_student_documents_v1 (node_id) values ('ever-meza-doc');
commit;
