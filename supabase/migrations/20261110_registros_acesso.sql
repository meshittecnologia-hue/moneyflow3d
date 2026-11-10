-- Marco Civil da Internet (Lei 12.965/2014, art. 15): guardar registros de acesso à aplicação
-- (data, hora e IP) por 6 meses, em ambiente controlado e seguro. A Política de Privacidade promete isso.
--
-- Quem grava: o backend (/acesso), com a secret key, usando o IP que o servidor vê
-- (o navegador não sabe o próprio IP público e não é confiável para isso).
-- Quem lê: ninguém pelo navegador. Sem políticas de RLS = só a secret key acessa.
-- Sem chave estrangeira para auth.users de propósito: o registro precisa sobreviver 6 meses
-- mesmo que a conta seja apagada antes disso.

create table if not exists public.registros_acesso (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  ip          text not null,
  ip_cadeia   text,
  user_agent  text,
  evento      text not null default 'acesso',
  criado_em   timestamptz not null default now()
);

create index if not exists registros_acesso_criado_em_idx on public.registros_acesso (criado_em);
create index if not exists registros_acesso_user_idx on public.registros_acesso (user_id, criado_em desc);

alter table public.registros_acesso enable row level security;
revoke all on table public.registros_acesso from anon, authenticated;

-- Depois de 6 meses o registro é apagado (minimização, LGPD art. 16).
create or replace function public.limpar_registros_acesso()
returns integer
language sql
security definer
set search_path = ''
as $$
  with apagados as (
    delete from public.registros_acesso
    where criado_em < now() - interval '6 months'
    returning 1
  )
  select count(*)::int from apagados;
$$;
revoke execute on function public.limpar_registros_acesso() from public, anon, authenticated;

-- Roda todo dia às 03h15 (horário de Brasília = 06h15 UTC).
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'limpar-registros-acesso';
select cron.schedule('limpar-registros-acesso', '15 6 * * *', 'select public.limpar_registros_acesso()');
