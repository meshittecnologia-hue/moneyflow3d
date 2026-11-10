/* MoneyFlow 3D — planos e preços (item 24 da auditoria).
 *
 * FONTE ÚNICA. Mudou preço, nome ou link de compra? Mude SÓ aqui.
 * O app (index.html) e o painel (admin.html) leem este arquivo.
 * A página de vendas (lp.html) tem o preço escrito no texto por causa do Google;
 * a verificação automática (scripts/validar_precos.py) barra o PR se ele
 * ficar diferente do que está aqui.
 *
 * O MRR do painel NÃO usa esta tabela: soma o valor que a Kiwify realmente
 * cobrou de cada assinatura ativa (função mrr_atual no Supabase).
 */
(function () {
  var TODOS = ['calc', 'pdf', 'wpp', 'crm', 'fila', 'estoque', 'relatorio', 'ilimitado'];

  var lista = {
    free:         { nome: 'Free',           preco: 0,     aVenda: true,  acessoPro: false, modulos: ['calc'] },
    pro:          { nome: 'Pro',            preco: 23.50, precoDepois: 47, cobranca: 'mensal',
                    aVenda: true,  acessoPro: true, modulos: TODOS },
    // Planos antigos: não se vendem mais; mantidos para quem já tem.
    maker:        { nome: 'Maker (antigo)', preco: null,  aVenda: false, acessoPro: true,  modulos: ['calc', 'pdf', 'wpp', 'crm', 'fila', 'estoque'] },
    annual_maker: { nome: 'Anual (antigo)', preco: null,  cobranca: 'anual', aVenda: false, acessoPro: true, modulos: TODOS },
    interno:      { nome: 'Interno/Staff',  preco: 0,     aVenda: false, acessoPro: true,  modulos: TODOS },
  };

  function brl(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  window.PLANOS = Object.freeze({
    lista: lista,
    checkout: 'https://pay.kiwify.com.br/8epGftp',
    vagasFundador: 50,
    brl: brl,
    nome: function (slug) { return (lista[slug] && lista[slug].nome) || slug || '—'; },
    comAcessoPro: Object.keys(lista).filter(function (k) { return lista[k].acessoPro; }),
  });
})();
