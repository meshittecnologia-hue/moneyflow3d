-- Item 24 da auditoria: MRR do painel calculado pelo valor REAL cobrado pela Kiwify,
-- não por uma tabela de preços escrita no HTML.
--
-- Regra (decisão do Antonio, 10/11/2026):
--   * vale a assinatura ativa mais recente de cada usuário;
--   * plano anual entra dividido por 12;
--   * não entram admin, plano interno e perfis sem plano (free);
--   * assinatura ativa sem valor registrado conta como assinante e é sinalizada em sem_valor.
-- Só administradores podem chamar.

create or replace function public.mrr_atual()
returns table (mrr numeric, assinantes integer, sem_valor integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Apenas administradores';
  end if;

  return query
  with ultima as (
    select distinct on (s.user_id) s.user_id, s.plan, s.amount
    from subscriptions s
    where s.status = 'active' and s.user_id is not null
    order by s.user_id, s.created_at desc
  )
  select
    coalesce(sum(case when u.plan = 'annual_maker' then coalesce(u.amount, 0) / 12
                      else coalesce(u.amount, 0) end), 0)::numeric(10, 2),
    count(*)::integer,
    (count(*) filter (where coalesce(u.amount, 0) = 0))::integer
  from ultima u
  join profiles p on p.id = u.user_id
  where p.role is distinct from 'admin'
    and coalesce(p.plan, 'free') not in ('free', 'interno');
end;
$$;

revoke all on function public.mrr_atual() from public, anon;
grant execute on function public.mrr_atual() to authenticated;
