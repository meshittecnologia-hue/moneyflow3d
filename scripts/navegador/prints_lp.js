// Gera os prints do app usados na página de vendas (img/app-*.png), com dados de exemplo.
// Rodar: node scripts/navegador/prints_lp.js   (mesmo Supabase simulado do teste_app.js)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.resolve(__dirname, '../..');
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const servidor = http.createServer((req, res) => {
  const arq = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});
const src = fs.readFileSync(path.join(__dirname, 'teste_app.js'), 'utf8');
const SUPABASE_FALSO = eval(src.match(/const SUPABASE_FALSO = (`[\s\S]*?`);/)[1]);

async function abrir(nav, opts) {
  const pg = await nav.newPage(opts);
  await pg.route(/supabase-js/, r => r.fulfill({ contentType: 'application/javascript', body: SUPABASE_FALSO }));
  await pg.route(/jspdf|sentry-cdn/, r => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await pg.route(/onrender\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await pg.route(/localhost:8766\/index\.html/, async r => {
    const resp = await r.fetch();
    r.fulfill({ response: resp, body: (await resp.text()).replace(/ integrity="[^"]+"/g, '') });
  });
  await pg.goto('http://localhost:8766/index.html');
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    [...document.body.children].forEach(e => { if (/^HOMOLOGA/.test(e.textContent || '')) e.remove(); });
    document.querySelectorAll('.trial-banner,#trial-banner,.banner-trial').forEach(e => e.remove());
    showPage('calc');
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('c-nome', 'Suporte de headset'); set('c-grams', 85); set('c-th', 4); set('c-tm', 20);
    set('c-hora', 30); set('c-tman', 15); set('c-markup', 150); set('c-emb', 2.5);
    const imp = document.getElementById('c-imp'); if (imp) imp.value = '1';
    goStep(4); calcRT();
    window.scrollTo(0, 0);
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => [...document.body.children].forEach(e => { if (/^HOMOLOGA/.test(e.textContent || '')) e.remove(); }));
  return pg;
}

(async () => {
  await new Promise(r => servidor.listen(8766, r));
  const nav = await chromium.launch();
  const pc = await abrir(nav, { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  await pc.screenshot({ path: path.join(RAIZ, 'css/img/app-calculadora.png') });
  const cel = await abrir(nav, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await cel.screenshot({ path: path.join(RAIZ, 'css/img/app-celular.png') });
  await nav.close(); servidor.close();
  console.log('prints OK');
})();
