-- Item 1.5: o painel admin mostra o e-mail de cada evento da Kiwify, mas a coluna não existia.
alter table public.webhook_logs add column if not exists email text;
