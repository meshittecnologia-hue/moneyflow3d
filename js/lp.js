/* MoneyFlow 3D — Página de vendas. Saiu do lp.html (item 25: sem código no HTML, permite ligar a CSP). */
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  btn.classList.toggle('open');
  answer.classList.toggle('open');
}

// Animação do demo
const prices = ['47,90', '62,40', '31,20', '89,00', '47,90'];
const margins = ['38,4%', '41,2%', '35,8%', '43,1%', '38,4%'];
let idx = 0;
setInterval(() => {
  idx = (idx + 1) % prices.length;
  const el = document.getElementById('demo-price');
  const mel = document.getElementById('demo-margin');
  if (el) { el.style.transition = 'opacity 0.3s'; el.style.opacity = 0; setTimeout(() => { el.textContent = prices[idx]; el.style.opacity = 1; }, 300); }
  if (mel) { mel.style.transition = 'opacity 0.3s'; mel.style.opacity = 0; setTimeout(() => { mel.textContent = margins[idx]; mel.style.opacity = 1; }, 300); }
}, 3000);

// Preço de lançamento: contagem regressiva REAL até 31/12/2026 23h59 (Brasília).
// A data vem de planos.js (lancamentoAte). Depois do prazo a faixa diz que acabou.
(function () {
  var box = document.getElementById('prazo-box'), txt = document.getElementById('prazo-texto');
  if (!box || !txt) return;
  var fim = new Date('2026-12-31T23:59:59-03:00').getTime();
  function atualizar() {
    var falta = fim - Date.now();
    if (falta <= 0) {
      box.firstChild.textContent = '⚡ Preço de lançamento encerrado ';
      txt.textContent = '';
      return;
    }
    var d = Math.floor(falta / 864e5), h = Math.floor(falta / 36e5) % 24, m = Math.floor(falta / 6e4) % 60;
    txt.textContent = 'Faltam ' + d + ' dia' + (d === 1 ? '' : 's') + ', ' + h + 'h ' + m + 'min';
    setTimeout(atualizar, 30000);
  }
  atualizar();
})();
