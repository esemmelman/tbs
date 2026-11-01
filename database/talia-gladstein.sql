begin;
insert into public.tbs_menu_nodes_v1 (id,parent_id,label,kind,sort_order) values
('talia-gladstein','zoom','Talia Gladstein','menu',2),
('talia-gladstein-doc','talia-gladstein','Doc','document',0);
insert into public.tbs_student_documents_v1 (node_id) values ('talia-gladstein-doc');
commit;
