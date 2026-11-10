/* MoneyFlow 3D — Plano e módulos liberados, inicialização, dados de exemplo, tema, menu e navegação entre páginas.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ── VERIFICAR PLANO/MÓDULOS ─────────────────────────── */
async function verificarAcesso(){
  if(!_currentUser) return;
  const { data: profile } = await _supa.from('profiles').select('*').eq('id', _currentUser.id).single();
  _userProfile = profile;

  if(!profile){ notify('Perfil não encontrado. Contate o administrador.','red'); return; }
  if(profile.is_blocked){ notify('Conta suspensa. Contate o administrador.','red'); await doLogout(); return; }

  await carregarSettings(profile);

  // Exibir email na topbar
  const emailEl = document.getElementById('topbar-email');
  if(emailEl) emailEl.textContent = _currentUser.email;

  // Aplicar bloqueio de módulos por plano
  aplicarBloqueioPlano(profile);

  // Backup JSON: somente admins
  const backupCard = document.getElementById('backup-dados-card');
  if(backupCard){
    backupCard.style.display = (profile.role === 'admin') ? '' : 'none';
  }
}

/* ── CONTROLE DE ACESSO POR PLANO ─────────────────────── */
const PLANOS_PRO = PLANOS.comAcessoPro;
const PRECO_PRO = PLANOS.brl(PLANOS.lista.pro.preco);
const PRECO_PRO_DEPOIS = PLANOS.brl(PLANOS.lista.pro.precoDepois);
// Preço e link de compra nas telas vêm de planos.js (fonte única, item 24).
document.querySelectorAll('.js-preco-pro').forEach(el => { el.textContent = PRECO_PRO; });
document.querySelectorAll('.js-checkout').forEach(el => { el.href = PLANOS.checkout; });

function temAcesso(profile){
  if(!profile) return false;
  const plano = profile.plan || 'free';
  if(PLANOS_PRO.includes(plano)) return true;
  // Trial: verifica created_at + 7 dias
  if(profile.created_at){
    const criado = new Date(profile.created_at);
    const expira = new Date(criado.getTime() + 7*24*60*60*1000);
    if(new Date() < expira) return true;
  }
  return false;
}

function diasRestantesTrial(profile){
  if(!profile || !profile.created_at) return 0;
  const plano = profile.plan || 'free';
  if(PLANOS_PRO.includes(plano)) return 999;
  const criado = new Date(profile.created_at);
  const expira = new Date(criado.getTime() + 7*24*60*60*1000);
  const diff = Math.ceil((expira - new Date()) / (1000*60*60*24));
  return Math.max(0, diff);
}

function aplicarBloqueioPlano(profile){
  const plano = profile?.plan || 'free';
  const isInterno = plano === 'interno';
  const dias = diasRestantesTrial(profile);

  // profile.modules configurado pelo admin tem prioridade sobre o plano
  const adminMods = Array.isArray(profile?.modules) && profile.modules.length > 0
    ? profile.modules : null;

  // nav ID → módulo necessário para acesso
  const NAV_MOD = {
    'crm':       'crm',
    'orcamentos':'pdf',
    'pedidos':   'crm',
    'fila':      'fila',
    'comparar':  'calc',
    'relatorio': 'relatorio',
  };

  const getAcesso = (slug) => {
    if(adminMods) return adminMods.includes(slug); // admin config tem prioridade total
    if(isInterno) return true;                     // interno sem config específica: tudo
    return temAcesso(profile);
  };

  Object.entries(NAV_MOD).forEach(([navId, slug]) => {
    const nav = document.getElementById('nav-'+navId);
    if(!nav) return;
    if(getAcesso(slug)){
      nav.style.opacity = '';
      nav.onclick = function(){ showPage(navId); };
      const badge = nav.querySelector('.plan-lock');
      if(badge) badge.remove();
    } else {
      nav.style.opacity = '0.5';
      if(!nav.querySelector('.plan-lock')){
        const lock = document.createElement('span');
        lock.className = 'plan-lock';
        lock.textContent = '\u{1F512}';
        lock.style.cssText = 'margin-left:auto;font-size:11px';
        nav.appendChild(lock);
      }
      nav.onclick = function(e){ e.stopPropagation(); abrirModalUpgrade(); };
    }
  });

  const pro = (adminMods && adminMods.length > 0) || isInterno || temAcesso(profile);
  const banner = document.getElementById('trial-banner');
  if(banner){
    if(!pro && dias > 0){
      banner.style.display = 'flex';
      const el = document.getElementById('trial-dias');
      if(el) el.textContent = dias === 1 ? '1 dia' : dias+' dias';
    } else if(!pro && dias === 0){
      banner.style.display = 'flex';
      banner.style.background = 'var(--red)';
      banner.innerHTML = '<span>Seu trial expirou. Assine o MoneyFlow 3D Pro por '+PRECO_PRO+'/mês para continuar.</span><a href="'+PLANOS.checkout+'" target="_blank" style="color:#fff;font-weight:700;text-decoration:underline;white-space:nowrap;margin-left:12px">Assinar agora</a>';
    } else {
      banner.style.display = 'none';
    }
  }
}
function abrirModalUpgrade(){
  const dias = diasRestantesTrial(_userProfile);
  const expirou = dias === 0;
  const m = document.getElementById('modal-upgrade');
  if(m){
    document.getElementById('upgrade-titulo').textContent = expirou ? 'Acesso bloqueado' : 'Módulo exclusivo Pro';
    document.getElementById('upgrade-msg').textContent = expirou
      ? 'Seu acesso expirou. Assine o MoneyFlow 3D Pro por '+PRECO_PRO+'/mês e desbloqueie tudo. Garantia de 7 dias com reembolso total.'
      : 'Este módulo está disponível no plano Pro. Aproveite a oferta de fundador: '+PRECO_PRO+'/mês para sempre (sobe para '+PRECO_PRO_DEPOIS+'/mês após os '+PLANOS.vagasFundador+' primeiros).';
    m.classList.add('open');
  }
}

/* ── INIT APP ────────────────────────────────────────── */
async function initApp(){
  applyTheme();
  const { data: { user } } = await _supa.auth.getUser();
  _currentUser = user;
  await verificarAcesso();
  await loadSupabaseData();
  loadDB(); // mantém filamentos default
  if(!DB.catalogos) DB.catalogos=[];
  renderDashboard();
  renderBioStatus();
  loadSettingsPage();
  checkFirstLogin(_currentUser.id);
}


/* ── ONBOARDING / DADOS DE EXEMPLO ──────────────────── */
function checkFirstLogin(userId){
  if(DB.impressoras.length===0 && DB.produtos.length===0){
    const key='mf3d_welcomed_'+userId;
    if(!localStorage.getItem(key)){
      setTimeout(()=>{ document.getElementById('modal-welcome').classList.add('open'); }, 600);
    }
  }
}
function dispensarOnboarding(){
  document.getElementById('modal-welcome').classList.remove('open');
  localStorage.setItem('mf3d_welcomed_'+_currentUser.id,'1');
}
async function carregarExemplos(){
  const btn=document.getElementById('btn-seed-loading');
  if(btn){ btn.textContent='⏳ Carregando...'; btn.disabled=true; }
  const uid=_currentUser.id;
  try{
    // 1. Impressora
    const {data:imp}=await _supa.from('printers').insert({
      user_id:uid, name:'Ender 3 Pro (Exemplo)',
      investment:1800, roi_months:18, watts:250, hours_per_day:8, fail_rate:5
    }).select().single();

    // 2. Filamentos
    const {data:fil1}=await _supa.from('filaments').insert({
      user_id:uid, name:'PLA Branco (Exemplo)', brand:'Genérico', color:'#f5f5f5', type:'PLA', cost:99.90, weight_g:1000
    }).select().single();
    const {data:fil2}=await _supa.from('filaments').insert({
      user_id:uid, name:'PETG Preto (Exemplo)', brand:'Genérico', color:'#1a1a1a', type:'PETG', cost:115.00, weight_g:1000
    }).select().single();

    // 3. Produtos (campos básicos — compatível com qualquer schema)
    await _supa.from('products').insert([
      { user_id:uid, name:'Vaso Decorativo (Exemplo)', filament_name:'PLA Branco (Exemplo)',
        cost_total:6.88, price_base:12.38, margin:44.4, markup:80,
        print_hours:3, grams_used:45, packaging:0, supplies:0, labor_hour:0 },
      { user_id:uid, name:'Suporte de Celular (Exemplo)', filament_name:'PLA Branco (Exemplo)',
        cost_total:3.71, price_base:7.42, margin:50.0, markup:100,
        print_hours:1.5, grams_used:25, packaging:0, supplies:0, labor_hour:0 },
      { user_id:uid, name:'Chaveiro Personalizado (Exemplo)', filament_name:'PETG Preto (Exemplo)',
        cost_total:1.38, price_base:3.31, margin:58.3, markup:140,
        print_hours:0.5, grams_used:10, packaging:0, supplies:0, labor_hour:0 },
    ]);

    // 4. Cliente
    await _supa.from('clientes').insert({
      user_id:uid, name:'João Silva (Exemplo)',
      whatsapp:'(11) 99999-0000', email:'joao@exemplo.com',
      notes:'Cliente de exemplo — pode excluir'
    });

    localStorage.setItem('mf3d_welcomed_'+uid,'1');
    document.getElementById('modal-welcome').classList.remove('open');
    notify('Dados de exemplo carregados! 🎉');
    await loadSupabaseData();
    loadDB();
    renderDashboard();
    showPage('produtos');
  }catch(e){
    if(btn){ btn.textContent='⚡ Carregar exemplos'; btn.disabled=false; }
    notify('Erro ao carregar exemplos: '+e.message,'red');
    console.error('carregarExemplos',e);
  }
}

function notify(msg,type='green'){
  const n=document.getElementById('notif');
  n.textContent=msg;n.className='notif '+type;n.classList.add('show');
  setTimeout(()=>n.classList.remove('show'),2500);
}

/* ── THEME ──────────────────────────────────────────── */
function applyTheme(){
  const t=localStorage.getItem('p3d_theme');
  const txt=t==='light'?'🌑 Tema Escuro':'🌙 Tema Claro';
  if(t==='light')document.body.classList.add('light');
  else document.body.classList.remove('light');
  ['theme-btn','theme-btn2'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=txt;});
}
function toggleTheme(){
  const light=document.body.classList.toggle('light');
  localStorage.setItem('p3d_theme',light?'light':'dark');
  const txt=light?'🌑 Tema Escuro':'🌙 Tema Claro';
  ['theme-btn','theme-btn2'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=txt;});
}

/* ── SIDEBAR (MOBILE) ───────────────────────────────── */
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sb-overlay').style.display='block';
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sb-overlay').style.display='none';
}

/* ── NAVIGATION ─────────────────────────────────────── */
const PAGE_TITLES={roadmap:'O que vem por aí',dashboard:'Dashboard',calc:'Nova precificação',produtos:'Produtos',pedidos:'Painel de pedidos',comparar:'Comparar',relatorio:'Relatório',config:'Máquina & custos',filamentos:'Filamentos & estoque',importar:'Importar dados',settings:'Configurações',orcamentos:'Orçamentos',crm:'Clientes (CRM)',fila:'Fila de produção'};
function showPage(p){
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  const ni=document.getElementById('nav-'+p);if(ni)ni.classList.add('active');
  document.getElementById('topbar-title').textContent=PAGE_TITLES[p]||p;
  closeSidebar();
  if(p==='dashboard')renderDashboard();
  if(p==='produtos')renderProdutos();
  if(p==='filamentos'){renderFilamentos();if(!DB.estoque)DB.estoque=[];renderEstoque();}
  if(p==='config')renderConfig();
  if(p==='relatorio')renderRelatorio();
  if(p==='comparar')renderComparar();
  if(p==='calc'){populateSelects();goStep(1);}
  if(p==='catalogo'){if(!DB.catalogos)DB.catalogos=[];} 
  if(p==='orcamentos'){if(!DB.orcamentos)DB.orcamentos=[];renderOrcamentos();}
  if(p==='pedidos'){if(!DB.orcamentos)DB.orcamentos=[];renderPedidos();}
  if(p==='crm'){if(!DB.clientes)DB.clientes=[];renderCRM();}
  if(p==='fila'){if(!DB.fila)DB.fila=[];renderFila();}
  if(p==='settings'){renderBioStatus();loadSettingsPage();}
}

