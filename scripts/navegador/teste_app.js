// Teste no navegador (item 16): abre o app com o Supabase simulado e uma sessão falsa,
// passa por todas as páginas e falha se aparecer qualquer erro de JavaScript.
// Pega erro de ordem entre os arquivos js/, função que sumiu, página que não abre.
// Rodar: node scripts/navegador/teste_app.js   (sobe um servidor local na porta 8765)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const RAIZ = path.resolve(__dirname, '../..');
const JSPDF = require.resolve('jspdf/dist/jspdf.umd.min.js');
const CSP = fs.readFileSync(path.join(__dirname, '../csp.txt'), 'utf8').trim();
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const servidor = http.createServer((req, res) => {
  const arq = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
  const cab = { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' };
  // Item 25: as páginas saem com a mesma CSP de produção (scripts/csp.txt). Qualquer código
  // escrito no HTML ou biblioteca de fora não liberada é bloqueado e reprova o teste.
  if (path.extname(arq) === '.html') cab['Content-Security-Policy'] = CSP;
  res.writeHead(200, cab);
  fs.createReadStream(arq).pipe(res);
});

const SUPABASE_FALSO = `(function(){
  const vazio = { data: [], error: null };
  function q(res){ const p = new Proxy(function(){}, { get: (t, k) => {
    if (k === 'then') return r => r(res);
    if (k === 'single' || k === 'maybeSingle') return () => q({ data: { id: 'u1', plan: 'pro', role: 'user', is_blocked: false, email: 't@t.com', name: 'Teste' }, error: null });
    return () => p; }, apply: () => p }); return p; }
  window.supabase = { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 't@t.com' }, access_token: 'x' } } }),
            getUser: async () => ({ data: { user: { id: 'u1', email: 't@t.com' } } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}) },
    from: () => q(vazio), rpc: () => q(vazio),
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }), remove: async () => ({}) }) },
  }) };
})();`;

(async () => {
  await new Promise(r => servidor.listen(8765, r));
  const navegador = await chromium.launch();
  const pg = await navegador.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message.split('\n')[0]));
  pg.on('dialog', d => d.dismiss());
  pg.on('console', m => { if (m.type() === 'error' && /\[eventos\]|Content Security Policy/.test(m.text())) erros.push(m.text().split('\n')[0]); });
  await pg.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline'))); });
  // Bibliotecas de fora são trocadas por versões falsas (o teste não depende de internet).
  await pg.route(/supabase-js/, r => r.fulfill({ contentType: 'application/javascript', body: SUPABASE_FALSO }));
  // Item 22: o jsPDF é o de verdade (mesma versão do index.html, conferida pela assinatura SRI abaixo).
  await pg.route(/jspdf/, r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(JSPDF) }));
  await pg.route(/sentry-cdn/, r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await pg.route(/localhost:8765\/index\.html/, async r => {
    const resp = await r.fetch();
    r.fulfill({ response: resp, body: (await resp.text()).replace(/ integrity="[^"]+"/g, '') });
  });
  await pg.goto('http://localhost:8765/index.html');
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(async () => {
    const res = { entrou: typeof _currentUser !== 'undefined' && !!_currentUser, paginas: {} };
    for (const p of Object.keys(PAGE_TITLES)) {
      try { showPage(p); await new Promise(x => setTimeout(x, 80));
        const el = document.getElementById('page-' + p);
        res.paginas[p] = el && el.classList.contains('active') ? 'ok' : 'não abriu';
      } catch (e) { res.paginas[p] = 'ERRO ' + e.message; }
    }
    return res;
  });

  // Item 25: cliques de verdade (passam pelo js/eventos.js), não chamando a função direto.
  const cliques = [];
  async function confere(nome, ok) { if (!ok) cliques.push(nome); }
  for (const item of await pg.$$('.nav-item[data-click^="showPage"]')) {
    const alvo = (await item.getAttribute('data-click')).match(/showPage\('([^']+)'\)/)[1];
    if (!(await item.isVisible())) await pg.evaluate(() => typeof openSidebar === 'function' && openSidebar());
    await item.click({ force: true }); await pg.waitForTimeout(60);
    await confere('menu ' + alvo, await pg.evaluate(a => document.getElementById('page-' + a)?.classList.contains('active'), alvo));
  }
  await pg.evaluate(() => showPage('filamentos'));
  await pg.click('#page-filamentos [data-click^="openFilModal"]');
  await confere('abrir modal de filamento', await pg.isVisible('#mf-nome'));
  await pg.fill('#mf-cor-picker', '#ff0000').catch(() => {});
  await pg.dispatchEvent('#mf-cor-picker', 'input').catch(() => {});
  await confere('seletor de cor copia o valor', (await pg.inputValue('#mf-cor')) === '#ff0000');
  await pg.click('#modal-fil [data-click^="closeModal"]');
  await confere('fechar modal de filamento', !(await pg.isVisible('#mf-nome')));
  const temaAntes = await pg.evaluate(() => document.body.classList.contains('light'));
  await pg.evaluate(() => showPage('settings'));
  await pg.click('#theme-btn2', { force: true });
  await confere('trocar tema', temaAntes !== await pg.evaluate(() => document.body.classList.contains('light')));
  await pg.evaluate(() => showPage('crm'));
  await pg.click('[data-click="openClienteModal()"]', { force: true }); await pg.waitForTimeout(60);
  await confere('abrir modal de cliente', await pg.evaluate(() => document.getElementById('modal-cliente').classList.contains('open')));
  // Telas que só desenham botões/linhas quando há dados (foi onde a CSP em modo aviso achou
  // onmouseenter esquecido): CRM em grade e lista, pedidos e fila com um registro cada.
  const comDados = await pg.evaluate(async () => {
    const agora = Date.now(), hoje = new Date().toLocaleDateString('pt-BR');
    DB.clientes = [{ id: 'c-1', nome: 'Cliente Teste', wpp: '62999990000', email: 'c@t.com', insta: '@c', obs: '', ts: agora }];
    DB.orcamentos = [{ id: 'o-1', numero: 1, cliente: 'Cliente Teste', clienteNome: 'Cliente Teste', status: 'pendente', itens: [], total: 10, ts: agora, data: hoje }];
    DB.fila = [{ id: 'f-1', nome: 'Peça', produto: 'Peça', cliente: 'Cliente Teste', status: 'aguardando', ts: agora, data: hoje }];
    const out = [];
    for (const [pag, fn] of [['crm', () => { crmViewMode = 'grade'; renderCRM(); crmViewMode = 'lista'; renderCRM(); }], ['pedidos', renderPedidos], ['fila', renderFila]]) {
      try { showPage(pag); fn(); } catch (e) { out.push(pag + ': ' + e.message); }
    }
    await new Promise(r => setTimeout(r, 200));
    const linha = document.querySelector('.hover-linha');
    if (!linha) out.push('linhas com dados não apareceram');
    return out;
  });
  cliques.push(...comDados);
  // Item 22: gera o PDF do orçamento com o jsPDF real e confere o arquivo baixado.
  const sriIndex = (fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8').match(/jspdf@([\d.]+)\/dist\/jspdf\.umd\.min\.js" integrity="([^"]+)"/) || []);
  const sriLocal = 'sha512-' + require('crypto').createHash('sha512').update(fs.readFileSync(JSPDF)).digest('base64');
  const versaoLocal = require('jspdf/package.json').version;
  if (sriIndex[2] !== sriLocal || sriIndex[1] !== versaoLocal) cliques.push(`jsPDF do index.html (${sriIndex[1]}) diferente do testado (${versaoLocal}) ou SRI errado`);
  try {
    const [baixou] = await Promise.all([
      pg.waitForEvent('download', { timeout: 8000 }),
      pg.evaluate(() => { orcAtual = DB.orcamentos[0]; orcAtual.itens = [{ nome: 'Peça teste', qtd: 2, preco: 15.5 }]; exportarPDF(); }),
    ]);
    const conteudo = fs.readFileSync(await baixou.path());
    if (process.env.PDF_SAIDA) fs.writeFileSync(process.env.PDF_SAIDA, conteudo);
    if (conteudo.slice(0, 5).toString() !== '%PDF-' || conteudo.length < 1500) cliques.push('PDF do orçamento inválido (' + conteudo.length + ' bytes)');
    else console.log('PDF do orçamento: OK (' + baixou.suggestedFilename() + ', ' + conteudo.length + ' bytes, jsPDF ' + versaoLocal + ')');
  } catch (e) { cliques.push('PDF do orçamento: ' + e.message.split('\n')[0]); }
  await pg.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')));
  // Passa o mouse de verdade nas linhas (evento escrito no HTML só reclama quando dispara).
  for (const t of await pg.$$('#page-fila tr, #page-fila [class*="card"], #page-fila div[style*="cursor"]')) await t.hover({ force: true }).catch(() => {});
  await pg.evaluate(() => showPage('crm'));
  for (const t of (await pg.$$('#page-crm tr, #page-crm div[style*="border-radius"]')).slice(0, 15)) await t.hover({ force: true }).catch(() => {});
  const csp = await pg.evaluate(() => window.__csp);
  await pg.close();

  // Item 20: bloqueio por biometria. Simula o leitor do aparelho em cada situação.
  async function bloqueio(resultado, acao) {
    const p = await navegador.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await p.route(/supabase-js/, r => r.fulfill({ contentType: 'application/javascript',
      body: SUPABASE_FALSO.replace('signOut: async () => ({})', 'signOut: async () => { window.__saiu = true; return {}; }') }));
    await p.route(/jspdf/, r => r.fulfill({ contentType: 'application/javascript', body: 'window.jspdf={jsPDF:function(){}}' }));
    await p.route(/sentry-cdn/, r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await p.route(/localhost:8765\/index\.html/, async r => { const resp = await r.fetch();
      r.fulfill({ response: resp, body: (await resp.text()).replace(/ integrity="[^"]+"/g, '') }); });
    await p.addInitScript(res => {
      try { localStorage.setItem('p3d_cred', 'AAAA'); } catch (e) {}
      window.PublicKeyCredential = window.PublicKeyCredential || function () {};
      Object.defineProperty(navigator, 'credentials', { value: { get: async () => {
        if (res === 'ok') return {}; const e = new Error(res); e.name = res; throw e; } } });
    }, resultado);
    await p.goto('http://localhost:8765/index.html');
    await p.waitForTimeout(1200);
    if (acao === 'sair') {
      // doLogout recarrega a página; no teste ele só marca que saiu (o signOut real é testado à parte).
      await p.evaluate(async () => { window.doLogout = async () => { await _supa.auth.signOut(); }; await sairDoBloqueio(); });
    }
    const r = await p.evaluate(() => ({
      overlay: getComputedStyle(document.getElementById('login-overlay')).display,
      campos: getComputedStyle(document.getElementById('login-campos')).display,
      abriu: typeof _currentUser !== 'undefined' && !!_currentUser,
      cred: localStorage.getItem('p3d_cred'), saiu: !!window.__saiu,
      msg: document.getElementById('login-err').textContent }));
    await p.close();
    return { ...r, errs };
  }
  const casos = {
    cancelou: await bloqueio('NotAllowedError'),
    outroErro: await bloqueio('SecurityError'),
    deuCerto: await bloqueio('ok'),
    emailSenha: await bloqueio('NotAllowedError', 'sair'),
  };
  const falhasBloqueio = [];
  if (casos.cancelou.abriu || casos.cancelou.overlay === 'none' || casos.cancelou.campos !== 'none') falhasBloqueio.push('cancelar abriu o app ou mostrou os campos');
  if (casos.outroErro.abriu || casos.outroErro.overlay === 'none') falhasBloqueio.push('erro de biometria abriu o app sem desbloquear');
  if (!casos.deuCerto.abriu || casos.deuCerto.overlay !== 'none') falhasBloqueio.push('biometria correta não abriu o app');
  if (!casos.emailSenha.saiu || casos.emailSenha.cred) falhasBloqueio.push('"entrar com e-mail e senha" não saiu da sessão ou não desligou o bloqueio');
  for (const [k, v] of Object.entries(casos)) if (v.errs.length) falhasBloqueio.push(k + ': ' + v.errs.join('; '));
  console.log('bloqueio por biometria:', falhasBloqueio.length ? falhasBloqueio : 'OK (cancelar, erro, sucesso, sair)');

  // Item 25: painel admin com a CSP ligada — clica em cada item do menu como um usuário.
  const adminFalhas = [];
  {
    const p = await navegador.newPage();
    p.on('pageerror', e => adminFalhas.push('erro: ' + e.message.split('\n')[0]));
    p.on('console', m => { if (m.type() === 'error' && /\[eventos\]|Content Security Policy/.test(m.text())) adminFalhas.push(m.text().split('\n')[0]); });
    p.on('dialog', d => d.dismiss());
    await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline'))); });
    await p.route(/supabase-js/, r => r.fulfill({ contentType: 'application/javascript', body: SUPABASE_FALSO.replace("role: 'user'", "role: 'admin'") }));
    await p.route(/sentry-cdn/, r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await p.route(/localhost:8765\/admin\.html/, async r => { const resp = await r.fetch();
      r.fulfill({ response: resp, body: (await resp.text()).replace(/ integrity="[^"]+"/g, '') }); });
    await p.goto('http://localhost:8765/admin.html');
    await p.waitForTimeout(1200);
    const itens = await p.$$('.nav-item[data-click^="showPage"]');
    if (itens.length < 5) adminFalhas.push('menu do admin com ' + itens.length + ' itens (não entrou?)');
    for (const item of itens) {
      const alvo = (await item.getAttribute('data-click')).match(/showPage\('([^']+)'\)/)[1];
      await item.click({ force: true }); await p.waitForTimeout(150);
      const ok = await p.evaluate(a => document.getElementById('page-' + a)?.classList.contains('active') &&
        document.querySelector(`.nav-item[data-click="showPage('${a}')"]`).classList.contains('active'), alvo);
      if (!ok) adminFalhas.push('menu ' + alvo + ' não abriu');
    }
    adminFalhas.push(...(await p.evaluate(() => window.__csp)).map(v => 'CSP: ' + v));
    await p.close();
  }
  console.log('painel admin:', adminFalhas.length ? adminFalhas : 'OK (menu inteiro clicado)');

  await navegador.close(); servidor.close();

  const ruins = Object.entries(r.paginas).filter(([, v]) => v !== 'ok');
  console.log('entrou com a sessão:', r.entrou);
  console.log('páginas:', Object.keys(r.paginas).length, '| com problema:', ruins.length ? JSON.stringify(ruins) : 'nenhuma');
  console.log('erros de JavaScript:', erros.length ? erros : 'nenhum');
  console.log('cliques com problema:', cliques.length ? cliques : 'nenhum');
  console.log('violações da CSP:', csp.length ? csp : 'nenhuma');
  if (adminFalhas.length || cliques.length || csp.length || !r.entrou || ruins.length || erros.length || Object.keys(r.paginas).length < 10 || falhasBloqueio.length) process.exit(1);
  console.log('TESTE NO NAVEGADOR OK');
})().catch(e => { console.error(e); process.exit(1); });
