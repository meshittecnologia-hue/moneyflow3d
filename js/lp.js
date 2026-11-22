/* MoneyFlow 3D — Página de vendas (sem código no HTML, por causa da CSP). */

// ── Calculadora ao vivo do topo ─────────────────────────────────────────────
// Mesma fórmula do sistema (js/calculadora.js → calcCustos e renderBreakdown), com uma máquina
// e um filamento de exemplo. Os números mostrados batem com o app para os mesmos dados.
var LP_MAQ = { inv: 9500, roi: 18, watts: 350, hpd: 8, fail: 5, kwh: 0.85, fkg: 170, emb: 2.5, hora: 30, tman: 15 };
var LP_CANAIS = [0.14, 0.115, 0.15, 0];
var LP_PECAS = [
  { g: 12, min: 45, mk: 150 },   // chaveiro
  { g: 85, min: 260, mk: 100 },  // suporte de headset
  { g: 180, min: 420, mk: 100 }, // vaso médio
  { g: 60, min: 360, mk: 200 },  // action figure
];
var lpCanalAtual = 0, lpPrecoMostrado = 75.62, lpAuto = null;

function lpBRL(v) {
  var neg = v < 0; v = Math.abs(v);
  var s = v.toFixed(2).split('.'), i = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '− ' : '') + i + ',' + s[1];
}

function lpMoeda(v) { return (v < 0 ? '− ' : '') + 'R$ ' + lpBRL(Math.abs(v)); }

function lpConta(g, horas, mk, fee) {
  var m = LP_MAQ;
  var depr = m.roi > 0 ? m.inv / (m.roi * m.hpd * 25) : 0;
  var energia = (m.watts / 1000) * m.kwh;
  var maquina = (depr + energia) * horas;
  var falha = maquina * (m.fail / 100);
  var fil = (g / 1000) * m.fkg;
  var mo = m.hora * (m.tman / 60);
  var total = maquina + falha + fil + m.emb + mo;
  var preco = total * (1 + mk / 100);
  var taxa = preco * fee;
  return { maq: maquina + falha, fil: fil, emb: m.emb, mo: mo, total: total, preco: preco, taxa: taxa, lucro: preco - total - taxa };
}

function lpAnimaPreco(alvo) {
  var el = document.getElementById('demo-price');
  if (!el) return;
  var ini = lpPrecoMostrado, t0 = null, dur = 420;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) dur = 0;
  lpPrecoMostrado = alvo;
  function passo(t) {
    if (t0 === null) t0 = t;
    var p = dur ? Math.min(1, (t - t0) / dur) : 1;
    var e = 1 - Math.pow(1 - p, 3);
    el.textContent = lpBRL(ini + (alvo - ini) * e);
    if (p < 1) requestAnimationFrame(passo);
  }
  requestAnimationFrame(passo);
}

function lpCalc() {
  var rg = document.getElementById('r-g'), rh = document.getElementById('r-h'), rmk = document.getElementById('r-mk');
  if (!rg || !rh || !rmk) return;
  var g = +rg.value, min = +rh.value, mk = +rmk.value;
  document.getElementById('o-g').textContent = g + ' g';
  document.getElementById('o-h').textContent = Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0');
  document.getElementById('o-mk').textContent = mk + '%';
  var r = lpConta(g, min / 60, mk, LP_CANAIS[lpCanalAtual]);
  lpAnimaPreco(r.preco);
  document.getElementById('demo-lucro').textContent = lpMoeda(r.lucro);
  document.getElementById('demo-margin').textContent = (r.preco > 0 ? Math.round(r.lucro / r.preco * 100) : 0) + '%';
  document.getElementById('lucro-box').classList.toggle('negativo', r.lucro < 0);
  var partes = [r.fil, r.maq, r.emb, r.mo, r.taxa, Math.max(r.lucro, 0)];
  var soma = partes.reduce(function (a, b) { return a + b; }, 0) || 1;
  var faixas = document.querySelectorAll('#camadas i');
  for (var i = 0; i < faixas.length; i++) faixas[i].style.flexBasis = (partes[i] / soma * 100).toFixed(2) + '%';
  var ids = ['l-fil', 'l-maq', 'l-emb', 'l-mo', 'l-tax', 'l-luc'], vals = [r.fil, r.maq, r.emb, r.mo, r.taxa, r.lucro];
  ids.forEach(function (id, k) { document.getElementById(id).textContent = lpMoeda(vals[k]); });
}

function lpMarca(seletor, idx) {
  document.querySelectorAll(seletor).forEach(function (b, k) { b.setAttribute('aria-pressed', k === idx ? 'true' : 'false'); });
}

function lpAplicaPeca(i) {
  var p = LP_PECAS[i];
  document.getElementById('r-g').value = p.g;
  document.getElementById('r-h').value = p.min;
  document.getElementById('r-mk').value = p.mk;
  lpMarca('.pecas .chip', i);
  lpCalc();
}

function lpParaDemo() { if (lpAuto) { clearInterval(lpAuto); lpAuto = null; } }

// Ações dos botões e controles (data-click / data-input no lp.html).
function lpPeca(i) { lpParaDemo(); lpAplicaPeca(i); }
function lpCanal(i) { lpParaDemo(); lpCanalAtual = i; lpMarca('.canais .chip', i); lpCalc(); }
function lpMexeu() { lpParaDemo(); lpMarca('.pecas .chip', -1); lpCalc(); }

(function () {
  if (!document.getElementById('calc')) return;
  lpCalc();
  // Enquanto ninguém mexe, a calculadora troca de peça sozinha para mostrar o preço mudando.
  var reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduz) return;
  var atual = 1;
  lpAuto = setInterval(function () { atual = (atual + 1) % LP_PECAS.length; lpAplicaPeca(atual); }, 3500);
  var calc = document.getElementById('calc');
  ['pointerdown', 'keydown', 'focusin'].forEach(function (ev) { calc.addEventListener(ev, lpParaDemo, { once: true }); });
})();

// ── Preço de lançamento: contagem regressiva REAL até 31/12/2026 23h59 (Brasília) ──
// A data vem de planos.js (lancamentoAte). Depois do prazo a faixa diz que acabou.
(function () {
  var box = document.getElementById('prazo-box'), txt = document.getElementById('prazo-texto');
  if (!box || !txt) return;
  var fim = new Date('2026-12-31T23:59:59-03:00').getTime();
  function atualizar() {
    var falta = fim - Date.now();
    if (falta <= 0) {
      box.firstChild.textContent = 'Preço de lançamento encerrado';
      txt.textContent = '';
      return;
    }
    var d = Math.floor(falta / 864e5), h = Math.floor(falta / 36e5) % 24, m = Math.floor(falta / 6e4) % 60;
    txt.textContent = 'faltam ' + d + ' dia' + (d === 1 ? '' : 's') + ', ' + h + 'h ' + m + 'min';
    setTimeout(atualizar, 30000);
  }
  atualizar();
})();
