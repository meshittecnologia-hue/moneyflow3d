-- Contador REAL de vagas da oferta fundador para a página de vendas (antes era texto fixo no HTML,
-- o que seria propaganda enganosa — CDC art. 37).
-- Vaga ocupada = assinante do plano Pro pela Kiwify com assinatura ativa ou em atraso.
-- Reembolso, chargeback e cancelamento liberam a vaga.
-- Público (anon): devolve só dois números, nenhum dado pessoal.
create or replace function public.vagas_fundador()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'limite', 50,
    'ocupadas', (
      select count(distinct s.user_id)
      from public.subscriptions s
      where s.platform = 'kiwify' and s.plan = 'pro' and s.status in ('active', 'overdue')
    )
  );
$$;
revoke execute on function public.vagas_fundador() from public;
grant execute on function public.vagas_fundador() to anon, authenticated, service_role;
