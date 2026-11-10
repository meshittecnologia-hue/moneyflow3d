-- Política de Privacidade (10/11/2026): conta SEM plano pago e SEM uso há 90 dias é excluída,
-- com aviso por e-mail 15 dias antes (aos 75 dias). Free em uso nunca é apagado.
-- Quem executa: backend /tarefas/limpeza-contas, chamado 1x por dia pelo GitHub Actions.

alter table public.profiles add column if not exists aviso_exclusao_em timestamptz;

-- Lista quem está perto (>= dias_aviso sem uso) ou já foi avisado.
-- "Último uso" = o mais recente entre: criação da conta, último login, última renovação de sessão
-- (o app renova a sessão sozinho enquanto está em uso) e último registro de acesso.
-- Piso em 10/11/2026: a regra foi publicada nessa data, ninguém conta inatividade antes dela.
create or replace function public.contas_para_limpeza(dias_aviso integer default 75)
returns table (id uuid, email text, nome text, ultimo_acesso timestamptz, aviso_exclusao_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select p.id,
           coalesce(u.email, p.email) as email,
           p.name as nome,
           p.aviso_exclusao_em,
           greatest(
             timestamptz '2026-11-10 00:00:00-03',
             p.created_at, u.created_at, u.last_sign_in_at,
             (select max(s.updated_at) from auth.sessions s where s.user_id = p.id),
             (select max(r.criado_em) from public.registros_acesso r where r.user_id = p.id)
           ) as ultimo_acesso
    from public.profiles p
    join auth.users u on u.id = p.id
    where coalesce(p.role, 'user') <> 'admin'
      and coalesce(p.plan, 'free') not in ('pro', 'maker', 'annual_maker', 'interno')
  )
  select b.id, b.email, b.nome, b.ultimo_acesso, b.aviso_exclusao_em
  from base b
  where b.ultimo_acesso < now() - make_interval(days => dias_aviso)
     or b.aviso_exclusao_em is not null;
$$;
revoke execute on function public.contas_para_limpeza(integer) from public, anon, authenticated;
