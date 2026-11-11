/* MoneyFlow 3D — Painel admin. Saiu do admin.html (item 25: sem código no HTML, permite ligar a CSP). */
// ============================================================
// CONFIG SUPABASE
// ============================================================
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
  document.documentElement.style.setProperty('--faixa', '22px');
});
const SUPABASE_URL  = AMBIENTES[AMBIENTE].supabase;
const SUPABASE_ANON = AMBIENTES[AMBIENTE].anon;
// URL da API Python (backend/). Nenhuma chave secreta fica neste arquivo.
const ADMIN_API_URL = AMBIENTES[AMBIENTE].api;

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// Proteção contra XSS (auditoria, problema 10): todo texto vindo do banco
// passa por esc() antes de ir para innerHTML.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Para valores dentro de atributos data-click: escapa para string JS e depois para HTML.
function escJs(v) {
  return esc(String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' '));
}

let currentAdmin = null;
let allUsers = [];
let allSubs = [];

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !pass) { errEl.textContent = 'Preencha e-mail e senha.'; return; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { errEl.textContent = 'Credenciais inválidas: ' + error.message; return; }

  // Aguardar sessão estabilizar
  await new Promise(r => setTimeout(r, 500));

  // Verificar se é admin
  const { data: profile, error: profileError } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
  
  if (profileError) { 
    errEl.textContent = 'Erro ao carregar perfil: ' + profileError.message; 
    await sb.auth.signOut();
    return; 
  }
  
  if (!profile || profile.role !== 'admin') {
    await sb.auth.signOut();
    errEl.textContent = 'Acesso restrito. Role atual: ' + (profile?.role || 'não encontrado');
    return;
  }

  currentAdmin = profile;
  initApp();
}

async function doLogout() {
  // Não faz signOut — mantém sessão para biometria automática no próximo acesso
  currentAdmin = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  // Recarrega para acionar boot com biometria
  location.reload();
}

async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (profile && profile.role === 'admin') {
    currentAdmin = profile;
    initApp();
  }
}

function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const name = currentAdmin.name || currentAdmin.email.split('@')[0];
  document.getElementById('admin-name').textContent = name;
  document.getElementById('admin-avatar').textContent = name[0].toUpperCase();
  applyThemeAdmin();
  loadDashboard();
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function showPage(page) {
  document.body.classList.remove('menu-aberto');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  // Item 25: marca o item do menu pelo nome da página (antes usava o "event" implícito do onclick,
  // que com js/eventos.js aponta para a página inteira e quebrava a função).
  const nav = document.querySelector(`.nav-item[data-click="showPage('${page}')"]`);
  if (nav) nav.classList.add('active');

  if (page === 'dashboard')     loadDashboard();
  if (page === 'users')         loadUsers();
  if (page === 'subscriptions') loadSubscriptions();
  if (page === 'modules')       loadModules();
  if (page === 'logs')          loadLogs();
  if (page === 'webhooks')      loadWebhooks();
  if (page === 'config')        loadConfigPage();
  // backup não precisa carregar nada
}

// ============================================================
// CONFIGURAÇÕES DO ADMIN
// ============================================================
const ADMIN_RP_ID   = location.hostname || 'localhost';
const ADMIN_RP_NAME = 'MoneyFlow 3D Admin';

function loadConfigPage() {
  // Logo
  const logo = localStorage.getItem('admin_logo');
  const prev = document.getElementById('admin-logo-preview');
  const btnRem = document.getElementById('btn-remove-logo');
  if (logo) {
    prev.innerHTML = `<img src="${logo}" style="max-width:100%;max-height:100%;object-fit:contain">`;
    btnRem.style.display = '';
  }
  // Dados empresa
  const s = JSON.parse(localStorage.getItem('admin_settings') || '{}');
  document.getElementById('cfg-sysname').value = s.sysname || 'MoneyFlow 3D';
  document.getElementById('cfg-empresa').value = s.empresa || '';
  // Biometria
  renderAdminBioStatus();
}

function carregarLogoAdmin(e) {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Imagem muito grande (máx 2MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    localStorage.setItem('admin_logo', ev.target.result);
    document.getElementById('admin-logo-preview').innerHTML = `<img src="${ev.target.result}" style="max-width:100%;max-height:100%;object-fit:contain">`;
    document.getElementById('btn-remove-logo').style.display = '';
    showToast('Logo salva!', 'success');
  };
  reader.readAsDataURL(file);
}

function removerLogoAdmin() {
  localStorage.removeItem('admin_logo');
  document.getElementById('admin-logo-preview').innerHTML = '<span style="font-size:12px;color:var(--text3)">Sem logo</span>';
  document.getElementById('btn-remove-logo').style.display = 'none';
  showToast('Logo removida', 'success');
}

function salvarConfigAdmin() {
  const s = {
    sysname: document.getElementById('cfg-sysname').value.trim() || 'MoneyFlow 3D',
    empresa: document.getElementById('cfg-empresa').value.trim(),
  };
  localStorage.setItem('admin_settings', JSON.stringify(s));
  showToast('Configurações salvas!', 'success');
}

async function alterarSenhaAdmin() {
  const nova  = document.getElementById('cfg-nova-senha').value;
  const conf  = document.getElementById('cfg-conf-senha').value;
  const msg   = document.getElementById('cfg-senha-msg');
  if (!nova || !conf) { msg.innerHTML = '<span style="color:var(--red)">Preencha os dois campos.</span>'; return; }
  if (nova !== conf)  { msg.innerHTML = '<span style="color:var(--red)">As senhas não coincidem.</span>'; return; }
  if (nova.length < 8){ msg.innerHTML = '<span style="color:var(--red)">Mínimo 8 caracteres.</span>'; return; }
  const { error } = await sb.auth.updateUser({ password: nova });
  if (error) { msg.innerHTML = `<span style="color:var(--red)">${esc(error.message)}</span>`; return; }
  msg.innerHTML = '<span style="color:var(--green)">✅ Senha alterada com sucesso!</span>';
  document.getElementById('cfg-nova-senha').value = '';
  document.getElementById('cfg-conf-senha').value = '';
}

// ── BIOMETRIA ADMIN ──────────────────────────────────────────
function b64urlAdmin(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function fromB64urlAdmin(s) {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  while(s.length%4) s+='=';
  return Uint8Array.from(atob(s), c=>c.charCodeAt(0)).buffer;
}

function renderAdminBioStatus() {
  const el = document.getElementById('admin-bio-status'); if (!el) return;
  if (!window.PublicKeyCredential) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px">Este navegador/dispositivo não suporta biometria.</div>'; return;
  }
  const hasCred = localStorage.getItem('admin_bio_cred');
  if (hasCred) {
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-weight:600;color:var(--green)">✅ Biometria ativa neste dispositivo</div>
        <div style="font-size:12px;color:var(--text3);margin-top:3px">Próximo acesso ao painel será pelo sensor biométrico</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-click="removerAdminBio()">Remover</button>
    </div>`;
  } else {
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-weight:600">🔐 Biometria não configurada</div>
        <div style="font-size:12px;color:var(--text3);margin-top:3px">Ative para entrar com Face ID / impressão digital / Windows Hello</div>
      </div>
      <button class="btn btn-primary btn-sm" data-click="ativarAdminBio()">Ativar agora</button>
    </div>`;
  }
}

async function ativarAdminBio() {
  if (!window.PublicKeyCredential) { showToast('Dispositivo não suporta biometria', 'error'); return; }
  try {
    const uid = new Uint8Array(16); crypto.getRandomValues(uid);
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { id: ADMIN_RP_ID, name: ADMIN_RP_NAME },
      user: { id: uid, name: currentAdmin?.email || 'admin', displayName: 'Admin MoneyFlow 3D' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000, attestation: 'none'
    }});
    localStorage.setItem('admin_bio_cred', b64urlAdmin(cred.rawId));
    renderAdminBioStatus();
    showToast('Biometria ativada! Próximo acesso será automático.', 'success');
  } catch(e) {
    showToast('Não foi possível ativar: ' + e.message, 'error');
  }
}

async function loginAdminBio() {
  const credId = localStorage.getItem('admin_bio_cred'); if (!credId) return;
  try {
    await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: ADMIN_RP_ID,
      allowCredentials: [{ type: 'public-key', id: fromB64urlAdmin(credId) }],
      userVerification: 'required', timeout: 60000
    }});
    // Biometria ok — fazer login com sessão salva
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if (profile?.role === 'admin') { currentAdmin = profile; initApp(); }
    }
  } catch(e) { /* silencioso — usuário cancela */ }
}

function removerAdminBio() {
  localStorage.removeItem('admin_bio_cred');
  renderAdminBioStatus();
  showToast('Biometria removida', 'success');
}
function gerarSenha() {
  const maiusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghjkmnpqrstuvwxyz';
  const numeros    = '23456789';
  const especiais  = '@#$!%*?&';
  // Garante pelo menos 1 de cada categoria
  let senha = [
    maiusculas[Math.floor(Math.random()*maiusculas.length)],
    maiusculas[Math.floor(Math.random()*maiusculas.length)],
    minusculas[Math.floor(Math.random()*minusculas.length)],
    minusculas[Math.floor(Math.random()*minusculas.length)],
    numeros[Math.floor(Math.random()*numeros.length)],
    numeros[Math.floor(Math.random()*numeros.length)],
    especiais[Math.floor(Math.random()*especiais.length)],
    especiais[Math.floor(Math.random()*especiais.length)],
  ];
  const todos = maiusculas+minusculas+numeros+especiais;
  while(senha.length < 12) senha.push(todos[Math.floor(Math.random()*todos.length)]);
  // Embaralhar
  senha = senha.sort(()=>Math.random()-.5).join('');
  document.getElementById('new-user-senha').value = senha;
  document.getElementById('new-user-senha').type = 'text';
  document.getElementById('btn-ver-senha').textContent = '🙈';
  document.getElementById('senha-gerada-txt').textContent = senha;
  document.getElementById('senha-gerada-wrap').style.display = 'block';
  validarForcaSenha(senha);
}

function copiarSenha() {
  const txt = document.getElementById('senha-gerada-txt').textContent;
  navigator.clipboard.writeText(txt).then(()=>showToast('Senha copiada!','success'));
}

function toggleSenhaVisivel() {
  const inp = document.getElementById('new-user-senha');
  const btn = document.getElementById('btn-ver-senha');
  if (inp.type === 'password') { inp.type='text'; btn.textContent='🙈'; }
  else { inp.type='password'; btn.textContent='👁'; }
}

function validarForcaSenha(v) {
  const el = document.getElementById('senha-strength');
  if (!v) { el.textContent=''; return true; }
  const tem = {
    mai: /[A-Z]/.test(v),
    min: /[a-z]/.test(v),
    num: /[0-9]/.test(v),
    esp: /[@#$!%*?&]/.test(v),
    len: v.length >= 8,
  };
  const ok = Object.values(tem).filter(Boolean).length;
  if (ok < 3) { el.innerHTML='<span style="color:var(--red)">❌ Senha fraca — use maiúsculas, minúsculas, número e caractere especial</span>'; return false; }
  if (ok < 5) { el.innerHTML='<span style="color:var(--yellow)">⚠️ Senha média — adicione mais variedade</span>'; return false; }
  el.innerHTML='<span style="color:var(--green)">✅ Senha forte</span>'; return true;
}
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('theme-icon').textContent = isLight ? '☀️' : '🌙';
  document.getElementById('theme-label').textContent = isLight ? 'Tema Escuro' : 'Tema Claro';
  localStorage.setItem('admin_theme', isLight ? 'light' : 'dark');
}

function applyThemeAdmin() {
  const saved = localStorage.getItem('admin_theme');
  if (saved === 'light') {
    document.body.classList.add('light');
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Tema Escuro';
  }
}
function jsonToCSV(data) {
  if (!data || !data.length) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h] === null || row[h] === undefined ? '' : String(row[h]);
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(';')
  );
  return '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

async function backupTable(table) {
  const status = document.getElementById('backup-status');
  status.textContent = '⏳ Exportando ' + table + '...';
  const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false });
  if (error) { status.textContent = '❌ Erro: ' + error.message; return; }
  if (!data || !data.length) { status.textContent = 'ℹ️ Nenhum dado em ' + table; return; }
  const csv = jsonToCSV(data);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(csv, `moneyflow3d_${table}_${date}.csv`, 'text/csv;charset=utf-8');
  status.textContent = `✅ ${data.length} registros exportados de ${table}`;
  showToast('Backup de ' + table + ' baixado!', 'success');
}

async function backupCompleto() {
  const status = document.getElementById('backup-status');
  status.textContent = '⏳ Exportando backup completo...';
  const tables = ['profiles', 'subscriptions', 'modules', 'user_modules', 'admin_logs', 'webhook_logs'];
  const backup = { exportado_em: new Date().toISOString(), sistema: 'MoneyFlow 3D', versao: '1.0' };
  for (const t of tables) {
    const { data } = await sb.from(t).select('*').order('created_at', { ascending: false });
    backup[t] = data || [];
  }
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(JSON.stringify(backup, null, 2), `moneyflow3d_backup_completo_${date}.json`, 'application/json');
  const total = Object.values(backup).filter(Array.isArray).reduce((s, a) => s + a.length, 0);
  status.textContent = `✅ Backup completo: ${total} registros exportados`;
  showToast('Backup completo baixado!', 'success');
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  const { data: profiles } = await sb.from('profiles').select('plan, created_at, name, email');
  if (!profiles) return;

  const total  = profiles.length;
  const free   = profiles.filter(p => p.plan === 'free').length;

  // MRR = valor real cobrado pela Kiwify em cada assinatura ativa (anual ÷ 12),
  // sem admin, interno e perfis sem plano. Calculado no banco: função mrr_atual().
  const { data: mrrData, error: mrrErr } = await sb.rpc('mrr_atual');
  const m = (mrrData && mrrData[0]) || null;
  document.getElementById('d-total').textContent = total;
  document.getElementById('d-active').textContent = m ? m.assinantes : '—';
  document.getElementById('d-mrr').textContent = m ? PLANOS.brl(m.mrr) : '—';
  document.getElementById('d-mrr-obs').textContent = mrrErr
    ? 'erro ao calcular: ' + mrrErr.message
    : (m && m.sem_valor > 0 ? m.sem_valor + ' assinatura(s) sem valor registrado' : 'valor real cobrado pela Kiwify');
  document.getElementById('d-free').textContent = free;

  // Distribuição por plano
  const dist = {};
  profiles.forEach(p => { dist[p.plan] = (dist[p.plan] || 0) + 1; });
  const distBody = document.getElementById('dash-plan-dist');
  distBody.innerHTML = Object.entries(dist).map(([plan, count]) =>
    `<tr><td><span class="badge badge-${plan === 'annual_maker' ? 'annual' : plan}">${planLabel(plan)}</span></td><td>${count}</td></tr>`
  ).join('') || '<tr><td colspan="2" class="empty-row">Nenhum usuário</td></tr>';

  // Últimos cadastros
  const recent = [...profiles].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0,5);
  document.getElementById('dash-recent').innerHTML = recent.map(p =>
    `<tr>
      <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.name || p.email)}</td>
      <td><span class="badge badge-${p.plan === 'annual_maker' ? 'annual' : p.plan}">${planLabel(p.plan)}</span></td>
      <td>${fmtDate(p.created_at)}</td>
    </tr>`
  ).join('');
}

// ============================================================
// MAPEAMENTO DE PLANOS → MÓDULOS (automático Kiwify)
// ============================================================
// Planos, preços e módulos vêm de planos.js (fonte única, item 24).
const PLAN_MODULES = Object.fromEntries(Object.entries(PLANOS.lista).map(([k, p]) => [k, p.modulos]));
const PLAN_PRICES  = Object.fromEntries(Object.entries(PLANOS.lista).map(([k, p]) => [k, p.preco || 0]));
const PLAN_LABELS  = Object.fromEntries(Object.entries(PLANOS.lista).map(([k, p]) => [k, p.nome]));
document.querySelectorAll('.js-preco-pro').forEach(el => { el.textContent = PLANOS.brl(PLANOS.lista.pro.preco); });
document.querySelectorAll('.js-preco-pro-depois').forEach(el => { el.textContent = PLANOS.brl(PLANOS.lista.pro.precoDepois); });
document.querySelectorAll('.js-checkout').forEach(a => { a.href = PLANOS.checkout; a.textContent = PLANOS.checkout.replace('https://', '') + ' ↗'; });
document.querySelectorAll('.js-opt-pro').forEach(o => {
  o.textContent = 'Pro — ' + PLANOS.brl(PLANOS.lista.pro.preco) + '/mês (Oferta Fundador)';
});

function applyPlanModules(prefix, plan) {
  const mods = PLAN_MODULES[plan] || ['calc'];
  ['calc','pdf','crm','fila','estoque','relatorio','wpp','ilimitado'].forEach(m => {
    const el = document.getElementById(prefix + m);
    if (el) el.checked = mods.includes(m);
  });
}

function newUserPlanChanged() {
  applyPlanModules('new-mod-', document.getElementById('new-user-plan').value);
}
function editPlanChanged() {
  applyPlanModules('edit-mod-', document.getElementById('edit-user-plan').value);
}
function subPlanChanged() {
  const plan = document.getElementById('sub-plan').value;
  applyPlanModules('mod-', plan);
  document.getElementById('sub-amount').value = PLAN_PRICES[plan]?.toFixed(2) || '0.00';
}

function getCheckedModules(prefix) {
  return ['calc','pdf','crm','fila','estoque','relatorio','wpp','ilimitado'].filter(m => {
    const el = document.getElementById(prefix + m); return el && el.checked;
  });
}

// ============================================================
// USUÁRIOS
// ============================================================
async function loadUsers() {
  document.getElementById('users-table').innerHTML = '<tr><td colspan="7" class="loading"><span class="spinner"></span></td></tr>';
  const { data } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  allUsers = data || [];
  renderUsers(allUsers);
}

function filterUsers() {
  const q      = document.getElementById('user-search').value.toLowerCase();
  const plan   = document.getElementById('user-plan-filter').value;
  const role   = document.getElementById('user-role-filter').value;
  const status = document.getElementById('user-status-filter').value;
  const filtered = allUsers.filter(u => {
    const matchQ = !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q);
    const matchP = !plan || u.plan === plan;
    const matchR = !role || u.role === role;
    const matchS = !status || (status === 'blocked' ? u.is_blocked : !u.is_blocked);
    return matchQ && matchP && matchR && matchS;
  });
  renderUsers(filtered);
}

function renderUsers(users) {
  const tbody = document.getElementById('users-table');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Nenhum usuário encontrado</td></tr>'; return; }
  tbody.innerHTML = users.map(u => {
    const mods = u.modules || PLAN_MODULES[u.plan] || ['calc'];
    const modBadges = mods.slice(0,3).map(m=>
      `<span style="font-size:10px;background:rgba(249,115,22,.12);color:var(--accent);padding:1px 6px;border-radius:10px;white-space:nowrap">${m}</span>`
    ).join(' ') + (mods.length > 3 ? `<span style="font-size:10px;color:var(--text3)">+${mods.length-3}</span>` : '');
    return `<tr>
      <td>
        <div style="font-weight:600">${esc(u.name || '—')}</div>
        <div style="font-size:12px;color:var(--text3)">${esc(u.email || '—')}</div>
      </td>
      <td><span class="badge badge-${u.plan === 'annual_maker' ? 'annual' : u.plan === 'interno' ? 'interno' : u.plan}">${esc(PLAN_LABELS[u.plan]||u.plan)}</span></td>
      <td>${u.role === 'admin'
        ? '<span class="badge badge-admin">🔑 Admin</span>'
        : '<span style="font-size:12px;color:var(--text3)">👤 Usuário</span>'}</td>
      <td style="font-size:12px">${modBadges}</td>
      <td>${u.is_blocked
        ? '<span class="badge badge-blocked">Bloqueado</span>'
        : '<span class="badge badge-active">Ativo</span>'}</td>
      <td style="font-size:12px;color:var(--text3)">${fmtDate(u.created_at)}</td>
      <td style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" data-click="abrirUsuarioPorId('${u.id}')">Editar</button>
        <button class="btn btn-sm btn-success" data-click="sendPasswordEmail('${escJs(u.email)}','${escJs(u.name)}')">📧 Senha</button>
        <button class="btn btn-sm" style="background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3)" data-click="confirmarExcluirUser('${escJs(u.id)}','${escJs(u.name||u.email)}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

async function adminApi(path, method, body) {
  if (!ADMIN_API_URL) {
    throw new Error('Backend ainda não publicado — função disponível após o deploy da API');
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Sessão expirada, faça login de novo');
  const res = await fetch(ADMIN_API_URL + path, {
    method,
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* resposta sem corpo */ }
  if (!res.ok) {
    const d = data.detail;
    const msg = typeof d === 'string' ? d : (Array.isArray(d) ? d.map(x => x.msg).join('; ') : `HTTP ${res.status}`);
    throw new Error(msg);
  }
  return data;
}

async function confirmarExcluirUser(id, nome) {
  if (!confirm(`Excluir permanentemente o usuário "${nome}"?\n\nEsta ação não pode ser desfeita. Todos os dados do usuário serão removidos.`)) return;
  try {
    await adminApi(`/admin/users/${encodeURIComponent(String(id))}`, 'DELETE');
    showToast('Usuário excluído com sucesso', 'success');
    loadUsers();
  } catch(e) {
    showToast('Erro ao excluir: ' + e.message, 'error');
  }
}

function toggleSemEmail() {
  // Função legada — elementos removidos do modal novo
}


let modoUsuario = 'convite';

function setModoUsuario(modo) {
  modoUsuario = modo;
  const btnConvite = document.getElementById('btn-modo-convite');
  const btnDireto = document.getElementById('btn-modo-direto');
  const senhaSection = document.getElementById('senha-section');
  const infoConvite = document.getElementById('info-modo-convite');
  const btnCriar = document.getElementById('btn-criar-usuario');
  if (modo === 'convite') {
    btnConvite.style.background = 'var(--accent)';
    btnConvite.style.color = '#fff';
    btnDireto.style.background = 'transparent';
    btnDireto.style.color = 'var(--text2)';
    senhaSection.style.display = 'none';
    infoConvite.style.display = 'block';
    btnCriar.textContent = '📧 Enviar convite';
  } else {
    btnDireto.style.background = 'var(--accent)';
    btnDireto.style.color = '#fff';
    btnConvite.style.background = 'transparent';
    btnConvite.style.color = 'var(--text2)';
    senhaSection.style.display = 'block';
    infoConvite.style.display = 'none';
    btnCriar.textContent = '✅ Criar usuário';
  }
}

function openAddUserModal() {
  document.getElementById('new-user-email').value = '';
  document.getElementById('new-user-name').value = '';
  document.getElementById('new-user-plan').value = 'free';
  document.getElementById('new-user-role').value = 'user';
  document.getElementById('new-user-senha').value = '';
  document.getElementById('new-user-senha').type = 'password';
  document.getElementById('btn-ver-senha').textContent = '👁';
  document.getElementById('senha-strength').textContent = '';
  document.getElementById('senha-gerada-wrap').style.display = 'none';
  document.getElementById('senha-section').style.display = 'none';
  document.getElementById('info-modo-convite').style.display = 'block';
  setModoUsuario('convite');
  applyPlanModules('new-mod-', 'free');
  openModal('modal-add-user');
}





async function addUserManual() {
  const name  = document.getElementById('new-user-name').value.trim();
  const plan  = document.getElementById('new-user-plan').value;
  const role  = document.getElementById('new-user-role').value;
  const mods  = getCheckedModules('new-mod-');
  const email = document.getElementById('new-user-email').value.trim();

  if (!email) { showToast('E-mail obrigatório', 'error'); return; }

  const payload = { email, name, plan, role, modules: mods, mode: modoUsuario === 'convite' ? 'invite' : 'password' };
  if (payload.mode === 'password') {
    const senha = document.getElementById('new-user-senha').value;
    if (!senha) { showToast('Defina uma senha ou gere automaticamente', 'error'); return; }
    if (!validarForcaSenha(senha)) { showToast('Senha não atende aos critérios de segurança', 'error'); return; }
    payload.password = senha;
  }

  try {
    const r = await adminApi('/admin/users', 'POST', payload);
    if (payload.mode === 'invite') {
      if (r.email_sent) showToast('Convite enviado para ' + email + '!', 'success');
      else showToast('Usuário salvo, mas o e-mail NÃO foi enviado: ' + (r.email_error || 'erro desconhecido'), 'error');
    } else {
      showToast(r.existed ? 'Usuário já existia — dados atualizados.' : 'Usuário criado! Compartilhe o email e senha.', 'success');
    }
  } catch (e) {
    showToast('Erro ao salvar usuário: ' + e.message, 'error');
    return;
  }

  closeModal('modal-add-user');
  loadUsers();
}

async function sendPasswordEmail(email, name) {
  if (!email) { showToast('Email não encontrado', 'error'); return; }
  showToast('Gerando link de acesso...', 'success');
  try {
    await adminApi('/admin/users/access-email', 'POST', { email, name: name || '' });
    showToast('✅ Email de acesso enviado para ' + email, 'success');
  } catch (e) {
    showToast('Erro ao enviar email: ' + e.message, 'error');
  }
}

// Item 25: o botão passa só o id (antes passava o objeto inteiro escrito no HTML).
function abrirUsuarioPorId(id) {
  const u = allUsers.find(x => String(x.id) === String(id));
  if (u) openEditUser(u);
}

function openEditUser(u) {
  document.getElementById('edit-user-id').value      = u.id;
  document.getElementById('edit-user-name').value    = u.name || '';
  document.getElementById('edit-user-email').value   = u.email || '';
  document.getElementById('edit-user-plan').value    = u.plan || 'free';
  document.getElementById('edit-user-role').value    = u.role || 'user';
  document.getElementById('edit-user-blocked').value = String(u.is_blocked || false);
  // Aplicar módulos salvos ou default do plano
  const mods = u.modules || PLAN_MODULES[u.plan] || ['calc'];
  ['calc','pdf','crm','fila','estoque','relatorio','wpp','ilimitado'].forEach(m => {
    const el = document.getElementById('edit-mod-' + m);
    if (el) el.checked = mods.includes(m);
  });
  openModal('modal-user');
}

async function saveUser() {
  const id      = document.getElementById('edit-user-id').value;
  const name    = document.getElementById('edit-user-name').value.trim();
  const plan    = document.getElementById('edit-user-plan').value;
  const role    = document.getElementById('edit-user-role').value;
  const blocked = document.getElementById('edit-user-blocked').value === 'true';
  const mods    = getCheckedModules('edit-mod-');

  const { error } = await sb.from('profiles').update({ name, plan, role, is_blocked: blocked, modules: mods }).eq('id', id);
  if (error) { showToast('Erro ao salvar: ' + error.message, 'error'); return; }

  await sb.from('admin_logs').insert({ admin_id: currentAdmin.id, action: 'update_user', target_user: id, details: { plan, role, blocked, mods } });
  closeModal('modal-user');
  showToast('Usuário atualizado com sucesso', 'success');
  loadUsers();
  loadDashboard();
}

// ============================================================
// ASSINATURAS
// ============================================================
async function loadSubscriptions() {
  document.getElementById('subs-table').innerHTML = '<tr><td colspan="6" class="loading"><span class="spinner"></span></td></tr>';
  const { data } = await sb.from('subscriptions').select('*, profiles(name, email)').order('created_at', { ascending: false });
  allSubs = data || [];
  renderSubs(allSubs);
}

function filterSubs() {
  const q      = document.getElementById('sub-search').value.toLowerCase();
  const status = document.getElementById('sub-status-filter').value;
  let filtered = allSubs.filter(s => {
    const email = s.profiles?.email || '';
    const name  = s.profiles?.name  || '';
    const matchQ = !q || email.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    const matchS = !status || s.status === status;
    return matchQ && matchS;
  });
  renderSubs(filtered);
}

function renderSubs(subs) {
  const tbody = document.getElementById('subs-table');
  if (!subs.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhuma assinatura encontrada</td></tr>'; return; }
  tbody.innerHTML = subs.map(s => `
    <tr>
      <td>${esc(s.profiles?.name || s.profiles?.email || '—')}</td>
      <td><span class="badge badge-${s.plan === 'annual_maker' ? 'annual' : s.plan || 'free'}">${planLabel(s.plan)}</span></td>
      <td style="text-transform:capitalize;">${s.platform || '—'}</td>
      <td><span class="badge badge-${s.status}">${statusLabel(s.status)}</span></td>
      <td>R$ ${Number(s.amount||0).toFixed(2)}</td>
      <td>${fmtDate(s.started_at || s.created_at)}</td>
    </tr>
  `).join('');
}

function openAddSubModal() {
  document.getElementById('sub-user-email').value = '';
  openModal('modal-sub');
}

async function saveSubManual() {
  const email  = document.getElementById('sub-user-email').value.trim();
  const plan   = document.getElementById('sub-plan').value;
  const status = document.getElementById('sub-status').value;
  const amount = parseFloat(document.getElementById('sub-amount').value);

  if (!email) { showToast('Informe o e-mail do usuário', 'error'); return; }

  // Buscar usuário pelo e-mail
  const { data: profile } = await sb.from('profiles').select('id').eq('email', email).single();
  if (!profile) { showToast('Usuário não encontrado com esse e-mail', 'error'); return; }

  // Inserir assinatura
  const { error } = await sb.from('subscriptions').insert({
    user_id: profile.id, platform: 'manual', plan, status, amount,
    started_at: new Date(), next_billing_at: new Date(Date.now() + 30*24*60*60*1000)
  });
  if (error) { showToast('Erro: ' + error.message, 'error'); return; }

  // Atualizar plano no perfil
  await sb.from('profiles').update({ plan }).eq('id', profile.id);
  await sb.from('admin_logs').insert({ admin_id: currentAdmin.id, action: 'manual_subscription', target_user: profile.id, details: { plan, status, amount } });

  closeModal('modal-sub');
  showToast('Assinatura criada com sucesso', 'success');
  loadSubscriptions();
}

// ============================================================
// MÓDULOS
// ============================================================
async function loadModules() {
  document.getElementById('modules-table').innerHTML = '<tr><td colspan="6" class="loading"><span class="spinner"></span></td></tr>';
  const { data } = await sb.from('modules').select('*').order('id');
  const tbody = document.getElementById('modules-table');
  if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum módulo</td></tr>'; return; }
  tbody.innerHTML = data.map(m => `
    <tr>
      <td><code style="background:var(--bg3);padding:2px 8px;border-radius:4px;font-size:12px;">${esc(m.slug)}</code></td>
      <td style="font-weight:600;">${esc(m.name)}</td>
      <td style="color:var(--text3);">${esc(m.description || '—')}</td>
      <td>${m.price_monthly > 0 ? 'R$ ' + Number(m.price_monthly).toFixed(2) : 'Grátis'}</td>
      <td><span class="badge ${m.active ? 'badge-active' : 'badge-cancelled'}">${m.active ? 'Ativo' : 'Inativo'}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" data-click='openModuleModal(${JSON.stringify(m)})'>Editar</button>
      </td>
    </tr>
  `).join('');
}

function openModuleModal(m) {
  document.getElementById('modal-module-title').textContent = m ? 'Editar Módulo' : 'Novo Módulo';
  document.getElementById('edit-module-id').value     = m?.id || '';
  document.getElementById('edit-module-slug').value   = m?.slug || '';
  document.getElementById('edit-module-name').value   = m?.name || '';
  document.getElementById('edit-module-desc').value   = m?.description || '';
  document.getElementById('edit-module-price').value  = m?.price_monthly || '';
  document.getElementById('edit-module-active').value = String(m?.active !== false);
  if (m) document.getElementById('edit-module-slug').disabled = true;
  else   document.getElementById('edit-module-slug').disabled = false;
  openModal('modal-module');
}

async function saveModule() {
  const id     = document.getElementById('edit-module-id').value;
  const slug   = document.getElementById('edit-module-slug').value.trim();
  const name   = document.getElementById('edit-module-name').value.trim();
  const desc   = document.getElementById('edit-module-desc').value.trim();
  const price  = parseFloat(document.getElementById('edit-module-price').value) || 0;
  const active = document.getElementById('edit-module-active').value === 'true';

  if (!name) { showToast('Nome é obrigatório', 'error'); return; }

  let error;
  if (id) {
    ({ error } = await sb.from('modules').update({ name, description: desc, price_monthly: price, active }).eq('id', id));
  } else {
    if (!slug) { showToast('Slug é obrigatório', 'error'); return; }
    ({ error } = await sb.from('modules').insert({ slug, name, description: desc, price_monthly: price, active }));
  }

  if (error) { showToast('Erro: ' + error.message, 'error'); return; }
  closeModal('modal-module');
  showToast('Módulo salvo com sucesso', 'success');
  loadModules();
}

// ============================================================
// LOGS
// ============================================================
async function loadLogs() {
  document.getElementById('logs-list').innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  const { data } = await sb.from('admin_logs')
    .select('*, admin:profiles!admin_id(name,email), target:profiles!target_user(name,email)')
    .order('created_at', { ascending: false }).limit(50);

  const el = document.getElementById('logs-list');
  if (!data || !data.length) { el.innerHTML = '<div class="empty-row" style="padding:40px;text-align:center;color:var(--text3);">Nenhum log registrado ainda</div>'; return; }
  el.innerHTML = data.map(l => `
    <div class="log-entry">
      <div>
        <span class="log-action">${esc(l.action)}</span>
        ${l.target ? `→ <strong>${esc(l.target.name || l.target.email)}</strong>` : ''}
        <span style="color:var(--text3);font-size:12px;">por ${esc(l.admin?.name || l.admin?.email || '—')}</span>
      </div>
      ${l.details ? `<div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(JSON.stringify(l.details))}</div>` : ''}
      <div class="log-time">${fmtDateTime(l.created_at)}</div>
    </div>
  `).join('');
}

// ============================================================
// WEBHOOKS
// ============================================================
async function loadWebhooks() {
  const { data } = await sb.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(50);
  const tbody = document.getElementById('webhooks-table');
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum evento recebido ainda.<br><span style="font-size:12px;color:var(--text3)">Os eventos aparecerão aqui quando a primeira compra for realizada na Kiwify.</span></td></tr>';
    return;
  }
  tbody.innerHTML = data.map(w => `
    <tr>
      <td style="text-transform:capitalize">${esc(w.platform || 'kiwify')}</td>
      <td>${esc(w.event || '—')}</td>
      <td style="font-size:12px;color:var(--text3)">${esc(w.email || '—')}</td>
      <td><span class="badge badge-${w.status === 'processed' ? 'active' : w.status === 'ignored' ? 'overdue' : 'blocked'}">${esc(w.status || '—')}</span></td>
      <td>${fmtDateTime(w.created_at)}</td>
    </tr>
  `).join('');
}

// ============================================================
// HELPERS
// ============================================================
function planLabel(plan) {
  return PLANOS.nome(plan);
}
function statusLabel(s) {
  return { active:'Ativo', cancelled:'Cancelado', overdue:'Inadimplente', refunded:'Reembolsado', chargeback:'Chargeback', trial:'Trial' }[s] || s || '—';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR');
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = type === 'success' ? '✓ ' + msg : '✕ ' + msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3000);
}

// Fechar modais clicando fora
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

// ============================================================
// INICIALIZAR
// ============================================================
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile && profile.role === 'admin') {
      const hasCred = window.PublicKeyCredential && localStorage.getItem('admin_bio_cred');
      if (hasCred) {
        document.getElementById('bio-admin-section').style.display = 'block';
        setTimeout(async () => {
          try {
            // Tenta biometria — loginAdminBio já seta currentAdmin e chama initApp
            await loginAdminBio();
            // Se chegou aqui sem entrar, entra direto
            if (!currentAdmin) { currentAdmin = profile; initApp(); }
          } catch(e) {
            currentAdmin = profile;
            initApp();
          }
        }, 400);
      } else {
        currentAdmin = profile;
        initApp();
      }
    } else {
      if (window.PublicKeyCredential && localStorage.getItem('admin_bio_cred')) {
        document.getElementById('bio-admin-section').style.display = 'block';
        setTimeout(loginAdminBio, 600);
      }
    }
  } else {
    if (window.PublicKeyCredential && localStorage.getItem('admin_bio_cred')) {
      document.getElementById('bio-admin-section').style.display = 'block';
      setTimeout(loginAdminBio, 600);
    }
  }
})();
