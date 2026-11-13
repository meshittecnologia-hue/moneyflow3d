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

// Vagas da oferta fundador: número REAL, lido do banco (função pública vagas_fundador, só contagem).
// Se der erro, mostra só "50 vagas", sem inventar números.
(function () {
  var AMB = {
    'moneyflow3d.com.br': ['https://fqthlewarcqvmqojmzzs.supabase.co', 'sb_publishable_Y1nupemuEmSd9TIlLGg5cg_rS7cyQK2'],
    'www.moneyflow3d.com.br': ['https://fqthlewarcqvmqojmzzs.supabase.co', 'sb_publishable_Y1nupemuEmSd9TIlLGg5cg_rS7cyQK2'],
    'moneyflow3d-web-dev.onrender.com': ['https://ilpjwzbiqbngimnsonfv.supabase.co', 'sb_publishable_RivUXUH7Vlo0hF1XtlMbag_TFR9HN_4'],
  };
  var cfg = AMB[location.hostname];
  var box = document.getElementById('vagas-box');
  if (!cfg || !box) return;
  fetch(cfg[0] + '/rest/v1/rpc/vagas_fundador', {
    method: 'POST',
    headers: { apikey: cfg[1], 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (v) {
      var limite = Number(v.limite) || 50, ocupadas = Math.min(Number(v.ocupadas) || 0, limite);
      var livres = limite - ocupadas, slots = document.getElementById('vagas-slots'), html = '';
      for (var i = 0; i < limite; i++) html += '<div class="slot ' + (i < ocupadas ? 'ocupada' : 'livre') + '"></div>';
      slots.innerHTML = html;
      document.getElementById('vagas-texto').textContent = livres > 0
        ? ocupadas + ' preenchida' + (ocupadas === 1 ? '' : 's') + ' · ' + livres + ' disponíve' + (livres === 1 ? 'l' : 'is')
        : 'Vagas de fundador esgotadas';
      if (livres <= 0) {
        // Esgotou: não vende mais pelo preço de fundador. Botões viram lista de espera.
        box.firstChild.textContent = '⚡ Oferta fundador encerrada ';
        document.querySelectorAll('a[href*="pay.kiwify.com.br"]').forEach(function (a) {
          a.href = 'mailto:suporte@moneyflow3d.com.br?subject=Lista%20de%20espera%20MoneyFlow%203D';
          a.textContent = 'Entrar na lista de espera →';
        });
      }
    })
    .catch(function () { /* fica só "50 vagas", sem números */ });
})();
