-- Aplicada em 08/11/2026 pelo SQL Editor (item 1.8).
-- O backend usa a secret key (papel service_role) e não tinha permissão de escrita
-- em admin_logs e em várias outras tabelas ("permission denied for table admin_logs").
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
