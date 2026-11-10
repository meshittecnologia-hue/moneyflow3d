/* MoneyFlow 3D — Ambiente (produção/homologação), cliente Supabase, login, senha e biometria.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ── SUPABASE ────────────────────────────────────────── */
// Ambiente escolhido pelo endereço do site. Homologação usa banco e backend separados (item 2.2).
const AMBIENTES = {
  producao:    { supabase: 'https://fqthlewarcqvmqojmzzs.supabase.co', anon: 'sb_publishable_Y1nupemuEmSd9TIlLGg5cg_rS7cyQK2', api: 'https://moneyflow3d-api.onrender.com' },
  homologacao: { supabase: 'https://ilpjwzbiqbngimnsonfv.supabase.co', anon: 'sb_publishable_RivUXUH7Vlo0hF1XtlMbag_TFR9HN_4', api: 'https://moneyflow3d-api-dev.onrender.com' },
};
const AMBIENTE = ['moneyflow3d-web-dev.onrender.com', 'localhost', '127.0.0.1'].includes(location.hostname) ? 'homologacao' : 'producao';
if (AMBIENTE === 'homologacao') document.addEventListener('DOMContentLoaded', () => {
  const faixa = document.createElement('div');
  faixa.textContent = 'HOMOLOGAÇÃO — ambiente de testes, sem dados reais';
  faixa.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#000;font:700 12px/22px sans-serif;text-align:center;pointer-events:none';
  document.body.appendChild(faixa);
});
const SUPABASE_URL = AMBIENTES[AMBIENTE].supabase;
const SUPABASE_ANON = AMBIENTES[AMBIENTE].anon;
// URL da API Python (backend/).
const API_URL = AMBIENTES[AMBIENTE].api;
const _supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
// Proteção contra XSS (auditoria, problema 10): texto vindo do banco passa por esc() antes de ir para innerHTML.
function esc(v){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escJs(v){ return esc(String(v ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ')); }

/* ── LOGIN ──────────────────────────────────────────── */
const RP_ID=location.hostname||'localhost';
const RP_NAME='MoneyFlow 3D';

function b64url(buf){
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function fromB64url(s){
  s=s.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;
}

async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-pw').value;
  const err = document.getElementById('login-err');
  const btn = document.getElementById('login-btn-submit');
  err.textContent = '';
  if(!email){ err.textContent='Informe seu email.'; return; }
  if(!senha){ err.textContent='Informe sua senha.'; return; }
  btn.textContent = 'Entrando...';
  btn.disabled = true;
  const { data, error } = await _supa.auth.signInWithPassword({ email, password: senha });
  btn.textContent = 'Entrar';
  btn.disabled = false;
  if(error){
    err.textContent = 'Email ou senha incorretos.';
    document.getElementById('login-pw').value='';
    document.getElementById('login-pw').focus();
    return;
  }
  sessionStorage.setItem('p3d_ok','1');
  document.getElementById('login-overlay').style.display='none';
  initApp();
  if(window.PublicKeyCredential && !localStorage.getItem('p3d_cred')){
    setTimeout(()=>{ notify('💡 Dica: ligue o bloqueio por biometria em Configurações.'); }, 1200);
  }
}

function toggleEsqueciSenha(){
  const w = document.getElementById('esqueci-wrap');
  w.style.display = w.style.display==='none' ? 'block' : 'none';
  if(w.style.display==='block') document.getElementById('esqueci-email').focus();
}

async function enviarResetSenha(){
  const email = document.getElementById('esqueci-email').value.trim();
  const msg   = document.getElementById('esqueci-msg');
  msg.style.color='var(--text2)'; msg.textContent='Enviando...';
  if(!email){ msg.style.color='var(--red)'; msg.textContent='Informe seu email.'; return; }

  // Backend Python (item 19): envia pelo Resend, com limite de tentativas.
  // A resposta é a mesma exista ou não a conta, para não revelar e-mails cadastrados.
  if (API_URL) {
    try {
      const r = await fetch(API_URL + '/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (r.ok) { msg.style.color='var(--green)'; msg.textContent='Se houver uma conta com esse e-mail, o link chega em instantes. Confira também o spam.'; return; }
      let detalhe = '';
      try { detalhe = (await r.json()).detail || ''; } catch(e) { /* resposta sem corpo */ }
      msg.style.color='var(--red)';
      msg.textContent = r.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos.' : (typeof detalhe === 'string' && detalhe ? detalhe : 'Erro ao enviar. Tente de novo.');
      return;
    } catch(e) {
      console.warn('backend /auth/recover indisponível, usando o envio padrão do Supabase:', e);
    }
  }

  // Sem backend publicado: envio padrão do Supabase (limitado no plano gratuito)
  const { error } = await _supa.auth.resetPasswordForEmail(email, { redirectTo: 'https://moneyflow3d.com.br' });
  if(error){ msg.style.color='var(--red)'; msg.textContent='Erro ao enviar. Verifique o email.'; return; }
  msg.style.color='var(--green)'; msg.textContent='Link enviado! Verifique seu email.';
}
async function doResetSenha(){
  const pw = document.getElementById('reset-pw').value;
  const pw2 = document.getElementById('reset-pw2').value;
  const err = document.getElementById('reset-err');
  err.textContent='';
  if(!pw || pw.length < 6){ err.textContent='Senha deve ter pelo menos 6 caracteres.'; return; }
  if(pw !== pw2){ err.textContent='As senhas não coincidem.'; return; }
  const { error } = await _supa.auth.updateUser({ password: pw });
  if(error){ err.textContent='Erro ao atualizar senha. Tente novamente.'; return; }
  document.getElementById('reset-section').style.display='none';
  document.getElementById('login-section').style.display='block';
  notify('Senha atualizada com sucesso! Faça login.', 'green');
}

async function doLogout(){
  // Encerrar sessão no Supabase para evitar auto-login no reload
  try { await _supa.auth.signOut(); } catch(e) { console.warn('signOut error:', e); }
  sessionStorage.removeItem('p3d_ok');
  location.reload();
}

/* Item 20: a biometria é um BLOQUEIO DE TELA deste aparelho, não um login.
   O servidor não vê a biometria: ela só libera a sessão que já está salva aqui.
   Por isso só existe quando há sessão; sem sessão, o caminho é e-mail e senha. */
function mostrarBloqueio(){
  document.getElementById('login-overlay').style.display='flex';
  document.getElementById('bio-section').style.display='block';
  document.getElementById('login-campos').style.display='none';
  document.getElementById('login-err').textContent='';
  const icon=navigator.userAgent.includes('iPhone')||navigator.userAgent.includes('iPad')?'👤':'🔏';
  document.getElementById('bio-icon').textContent=icon;
}

async function desbloquearBiometria(){
  const err=document.getElementById('login-err');
  const credId=localStorage.getItem('p3d_cred');
  if(!credId){ await sairDoBloqueio(); return; }
  try{
    document.getElementById('bio-icon').textContent='⏳';
    await navigator.credentials.get({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      rpId:RP_ID,
      allowCredentials:[{type:'public-key',id:fromB64url(credId)}],
      userVerification:'required',
      timeout:60000
    }});
    sessionStorage.setItem('p3d_ok','1');
    document.getElementById('login-overlay').style.display='none';
    initApp();
  }catch(e){
    // Nunca abre o app sem a biometria: qualquer falha mantém o bloqueio.
    err.textContent = e.name==='NotAllowedError'
      ? 'Biometria cancelada. Toque em "Desbloquear" de novo ou entre com e-mail e senha.'
      : 'A biometria não funcionou neste aparelho ('+(e.name||'erro')+'). Entre com e-mail e senha.';
  }finally{
    document.getElementById('bio-icon').textContent='🔐';
  }
}

// Sai da sessão e desliga o bloqueio deste aparelho (evita ficar preso numa biometria quebrada).
async function sairDoBloqueio(){
  localStorage.removeItem('p3d_cred');
  await doLogout();
}

function renderBioStatus(){
  const el=document.getElementById('bio-status-card');
  if(!el)return;
  if(location.protocol!=='https:'){
    el.innerHTML='<div style="color:var(--yellow);font-size:13px">⚠️ O bloqueio por biometria só funciona com o endereço seguro (https://).</div>';
    return;
  }
  if(!window.PublicKeyCredential){
    el.innerHTML='<div style="color:var(--text3);font-size:13px">Este navegador não suporta biometria (use Chrome, Safari ou Edge atualizados).</div>';
    return;
  }
  const hasCred=localStorage.getItem('p3d_cred');
  if(hasCred){
    el.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-weight:500;color:var(--green)">✅ Bloqueio ligado neste aparelho</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px">Ao abrir o app, pede Face ID, digital ou Windows Hello</div>
        </div>
        <button class="btn btn-danger btn-sm" data-click="removerBiometria()">Desligar</button>
      </div>`;
  } else {
    el.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-weight:500">🔐 Bloqueio desligado</div>
          <div style="font-size:12px;color:var(--text3);margin-top:3px">Ligue para pedir a biometria ao abrir o app</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-ativar-bio" data-click="ativarBiometriaConfig(this)">Ligar bloqueio</button>
      </div>`;
  }
}

async function ativarBiometriaConfig(btn){
  if(!window.PublicKeyCredential){notify('Navegador não suporta biometria.','red');return;}
  const orig=btn.textContent;
  btn.textContent='⏳ Aguardando...';btn.disabled=true;
  try{
    const uid=new Uint8Array(16);crypto.getRandomValues(uid);
    const cred=await navigator.credentials.create({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      rp:{id:RP_ID,name:RP_NAME},
      user:{id:uid,name:'usuario',displayName:'Usuário MoneyFlow 3D'},
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
      authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},
      timeout:60000,
      attestation:'none'
    }});
    localStorage.setItem('p3d_cred',b64url(cred.rawId));
    notify('Bloqueio por biometria ligado neste aparelho.');
    renderBioStatus();
  }catch(e){
    btn.textContent=orig;btn.disabled=false;
    notify('Erro ao ativar: '+e.message,'red');
  }
}

function removerBiometria(){
  localStorage.removeItem('p3d_cred');
  renderBioStatus();
  notify('Bloqueio por biometria desligado','red');
}

/* ── BOOT ───────────────────────────────────────────── */
function loadSettingsPage(){
  const s=getSettings();
  const sn=document.getElementById('cfg-sysname');if(sn)sn.value=s.sysname||'MoneyFlow 3D';
  const em=document.getElementById('cfg-empresa');if(em)em.value=s.empresa||'MoneyFlow 3D';
  if(s.logo){
    const pi=document.getElementById('logo-preview-img');
    if(pi){pi.src=s.logo;pi.style.display='block';document.getElementById('logo-preview-placeholder').style.display='none';}
    const rb=document.getElementById('btn-rem-logo');if(rb)rb.style.display='inline-flex';
  }
}



