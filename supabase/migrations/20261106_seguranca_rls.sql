-- MoneyFlow 3D — correções de segurança do banco (auditoria de 04/11/2026)
-- Problemas 6, 7, 8 e 9. Espelha temAcesso()/adminMods do index.html.
-- Aplicada em 06/11/2026 pelo SQL Editor do Supabase.

begin;

-- ─────────────────────────────────────────────────────────────
-- Problema 8: usuário não pode se promover (role/plan) nem estender o teste
-- O app nunca altera essas colunas; só admin e o servidor (secret key) podem.
-- ─────────────────────────────────────────────────────────────
create or replace function public.proteger_campos_profile()
returns trigger
language plpgsql
security invoker  -- precisa ser invoker: em definer, current_user vira o dono (postgres) e a trava não vale
set search_path = public
as $$
begin
  -- Servidor (secret key = service_role), painel SQL (postgres) e admins podem alterar.
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.plan is distinct from old.plan
     or new.plan_expires_at is distinct from old.plan_expires_at
     or new.created_at is distinct from old.created_at
     or new.email is distinct from old.email
     or new.is_blocked is distinct from old.is_blocked
     or new.modules::text is distinct from old.modules::text
     or new.id is distinct from old.id then
    raise exception 'Alteração não permitida: role, plan, plan_expires_at, created_at, email, is_blocked, modules e id só podem ser alterados por um administrador';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_profile on public.profiles;
create trigger trg_proteger_campos_profile
  before update on public.profiles
  for each row execute function public.proteger_campos_profile();

-- ─────────────────────────────────────────────────────────────
-- Problema 9: a regra de acesso (Pro, interno ou 7 dias de teste) passa a valer
-- no banco, e não só na tela. Espelha temAcesso() do index.html.
-- ─────────────────────────────────────────────────────────────
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
        p.plan in ('pro', 'maker', 'interno', 'annual_maker')
        or p.role = 'admin'
        or (p.modules is not null and p.modules::text not in ('', '{}', '[]', 'null'))
        or p.created_at > now() - interval '7 days'
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- Problema 7: RLS ligado em todas as tabelas com dados de usuário,
-- com uma única regra clara: dono com acesso ativo, ou admin.
-- ─────────────────────────────────────────────────────────────
alter table public.filaments    enable row level security;
alter table public.products     enable row level security;
alter table public.user_modules enable row level security;

drop policy if exists "Usuário gerencia próprios filamentos"   on public.filaments;
drop policy if exists "users_own_products"                     on public.products;
drop policy if exists "Usuário gerencia próprias impressoras"  on public.printers;
drop policy if exists "Usuário gerencia próprio catálogo"      on public.catalog;
drop policy if exists "users_own_competitors"                  on public.competitors;
drop policy if exists "Usuário gerencia próprios concorrentes" on public.competitors;
drop policy if exists "users_own_clientes"                     on public.clientes;
drop policy if exists "users_own_estoque"                      on public.estoque;
drop policy if exists "users_own_fila"                         on public.fila_producao;
drop policy if exists "users_own_orcamentos"                   on public.orcamentos;

do $$
declare t text;
begin
  foreach t in array array['filaments','products','printers','catalog','competitors',
                           'clientes','estoque','fila_producao','orcamentos']
  loop
    execute format(
      'create policy dono_com_acesso on public.%I for all to authenticated
         using ((user_id = auth.uid() and public.tem_acesso()) or public.is_admin())
         with check ((user_id = auth.uid() and public.tem_acesso()) or public.is_admin())', t);
  end loop;
end $$;

-- user_config (logo/nome da empresa) continua editável pelo dono mesmo sem plano ativo.
-- user_modules já tinha políticas corretas; só faltava ligar o RLS (acima).

commit;
