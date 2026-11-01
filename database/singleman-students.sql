begin;
update public.tbs_menu_nodes_v1 set sort_order=sort_order+1 where parent_id='zoom' and sort_order>2;
insert into public.tbs_menu_nodes_v1 (id,parent_id,label,kind,sort_order) values
('ahava-singleman','zoom','Ahava Singleman','menu',-1),
('ahava-singleman-doc','ahava-singleman','Doc','document',0),
('stuart-leo-singleman','zoom','Stuart-Leo Singleman','menu',3),
('stuart-leo-singleman-doc','stuart-leo-singleman','Doc','document',0);
insert into public.tbs_student_documents_v1 (node_id) values ('ahava-singleman-doc'),('stuart-leo-singleman-doc');
commit;
