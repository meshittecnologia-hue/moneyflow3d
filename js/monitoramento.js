/* MoneyFlow 3D — Monitoramento de erros (item 27): Sentry, projeto meshit/moneyflow3d-web.
   Carregado logo depois da biblioteca do Sentry e ANTES dos outros arquivos, para pegar
   erro em qualquer um deles. Se o Sentry estiver bloqueado (ex.: bloqueador de anúncio),
   o app funciona igual — só não manda o erro.

   Privacidade (LGPD): não manda IP, e-mail, nome nem o que foi digitado; só a mensagem do
   erro, onde ele aconteceu, o navegador e a página. Sem gravação de tela (Session Replay). */
(function () {
  if (!window.Sentry || typeof Sentry.init !== 'function') return;

  var host = location.hostname;
  var ambiente = host === 'moneyflow3d.com.br' || host === 'www.moneyflow3d.com.br' ? 'producao'
    : host === 'moneyflow3d-web-dev.onrender.com' ? 'homologacao' : null;
  if (!ambiente) return; // computador local / testes: não manda nada

  var EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var TOKEN = /(access_token|refresh_token|token|apikey|signature)=[^&#\s]+/gi;
  function limpar(texto) {
    return typeof texto === 'string' ? texto.replace(EMAIL, '[email]').replace(TOKEN, '$1=[removido]') : texto;
  }

  Sentry.init({
    dsn: 'https://2b7ba99e3331b79cbf989b58c48ea14b@o4512408484577280.ingest.us.sentry.io/4512408490868736',
    environment: ambiente,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // Erros de extensões do navegador e de rede instável não são do app.
    ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', 'Failed to fetch', 'Load failed', 'NetworkError'],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-extension:\/\//i],
    beforeSend: function (evento) {
      if (evento.request) {
        evento.request.url = limpar(evento.request.url);
        delete evento.request.cookies;
        if (evento.request.headers) delete evento.request.headers.Referer;
      }
      if (evento.message) evento.message = limpar(evento.message);
      (evento.exception && evento.exception.values || []).forEach(function (v) { v.value = limpar(v.value); });
      delete evento.user;
      return evento;
    },
    beforeBreadcrumb: function (b) {
      // Não guarda o texto de cliques/campos (pode ter nome de cliente, valores, senha).
      if (b.category === 'ui.input' || b.category === 'ui.click') { b.message = b.message && b.message.split(' > ').pop().replace(/\[.*?\]/g, ''); }
      if (b.category === 'console') return null;
      if (b.data && b.data.url) b.data.url = limpar(b.data.url);
      if (b.message) b.message = limpar(b.message);
      return b;
    },
  });
  Sentry.setTag('pagina', /admin\.html$/.test(location.pathname) ? 'admin' : 'app');
})();
