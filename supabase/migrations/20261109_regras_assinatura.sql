-- Regras de assinatura (09/11/2026)
-- Reembolso/chargeback: o webhook bloqueia na hora (plan = 'free').
-- Cancelamento: o webhook grava plan_expires_at = fim do período pago; depois dessa data
-- o banco já recusa os dados (tem_acesso) e a rotina de hora em hora volta o plano para 'free'.

-- 1. Liga a assinatura do nosso banco à assinatura da Kiwify (renovação e cancelamento chegam por ela).
alter table public.subscriptions add column if not exists external_subscription_id text;
create index if not exists subscriptions_external_subscription_id_idx
  on public.subscriptions (external_subscription_id);

-- 2. plan_expires_at nunca foi usado pelo sistema; valores antigos vencidos são limpos
--    para não bloquear ninguém por engano quando a regra passar a valer.
update public.profiles set plan_expires_at = null
where plan_expires_at is not null and plan_expires_at < now();

-- 3. tem_acesso passa a respeitar a data de fim do plano (admin e interno não vencem).
create or replace function public.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_blocked, false) = false
      and (
        p.role = 'admin'
        or p.plan = 'interno'
        or (p.plan in ('pro', 'maker', 'annual_maker')
            and (p.plan_expires_at is null or p.plan_expires_at > now()))
        or (p.modules is not null and p.modules::text not in ('', '{}', '[]', 'null'))
        or p.created_at > now() - interval '7 days'
      )
  );
$$;

-- 4. Rotina de hora em hora: plano com data vencida volta para 'free' (o app mostra o bloqueio).
create extension if not exists pg_cron;

create or replace function public.expirar_planos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.profiles
     set plan = 'free', plan_expires_at = null
   where plan in ('pro', 'maker', 'annual_maker')
     and role <> 'admin'
     and plan_expires_at is not null
     and plan_expires_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expirar_planos() from public, anon, authenticated;

select cron.unschedule('expirar-planos') where exists (select 1 from cron.job where jobname = 'expirar-planos');
select cron.schedule('expirar-planos', '7 * * * *', $$select public.expirar_planos()$$);
