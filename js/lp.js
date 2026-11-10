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
