begin;
alter table public.tbs_menu_nodes_v1 add column completed boolean not null default false;
alter table public.tbs_menu_nodes_v1 drop constraint tbs_menu_nodes_v1_kind_check;
alter table public.tbs_menu_nodes_v1 add constraint tbs_menu_nodes_v1_kind_check check(kind in ('menu','item','document','task'));
grant update(completed) on public.tbs_menu_nodes_v1 to anon,authenticated;
grant insert on public.tbs_student_documents_v1 to anon,authenticated;
create policy tbs_student_documents_v1_task_insert on public.tbs_student_documents_v1 for insert to anon,authenticated with check (exists (select 1 from public.tbs_menu_nodes_v1 n where n.id=node_id and n.kind='task'));
create function public.tbs_create_task_document_v1() returns trigger language plpgsql security invoker set search_path='' as $$
begin
if new.kind='task' then
insert into public.tbs_student_documents_v1(node_id) values(new.id) on conflict(node_id) do nothing;
end if;
return new;
end;
$$;
revoke execute on function public.tbs_create_task_document_v1() from public,anon,authenticated;
create trigger tbs_task_document_v1 after insert on public.tbs_menu_nodes_v1 for each row execute function public.tbs_create_task_document_v1();
commit;
