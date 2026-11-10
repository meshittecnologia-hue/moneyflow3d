-- Item 32 da auditoria: itens do orçamento gravados como TEXTO com JSON dentro.
-- Se o texto viesse quebrado, o app engolia o erro e mostrava um item genérico.
-- Agora: coluna jsonb, sempre uma lista; orçamentos antigos sem itens ganham a lista
-- montada a partir de produto_nome / qtd / preco.

-- 1. Trava: não converte se houver texto que não seja lista (evita perder dado em silêncio).
do $$
declare n integer;
begin
  select count(*) into n from public.orcamentos
  where itens is not null and btrim(itens::text) <> '' and btrim(itens::text) !~ '^\[';
  if n > 0 then
    raise exception 'Há % orçamento(s) com itens que não são lista; revisar antes de converter', n;
  end if;
end $$;

-- 2. Converte a coluna (se ainda for texto).
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'orcamentos' and column_name = 'itens') = 'text' then
    alter table public.orcamentos
      alter column itens type jsonb using nullif(btrim(itens), '')::jsonb;
  end if;
end $$;

-- 3. Orçamentos antigos sem itens: monta a lista com o que existe.
update public.orcamentos
set itens = jsonb_build_array(jsonb_build_object(
      'nome', coalesce(nullif(produto_nome, ''), 'Item'),
      'qtd', coalesce(qtd, 1),
      'preco', coalesce(preco, 0)))
where itens is null;

-- 4. Daqui em diante: obrigatório e sempre lista com pelo menos 1 item.
alter table public.orcamentos alter column itens set not null;
alter table public.orcamentos drop constraint if exists orcamentos_itens_lista;
alter table public.orcamentos add constraint orcamentos_itens_lista
  check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) > 0);
