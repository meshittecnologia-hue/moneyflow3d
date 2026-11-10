/* MoneyFlow 3D — Constantes, estado em memória (DB), carga do Supabase e gravação de cada cadastro.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
const MPs=[
  {id:'shopee_fg',  name:'Shopee Frete Grátis',fee:0.14},
  {id:'shopee_std', name:'Shopee Standard',    fee:0.16},
  {id:'ml',         name:'Mercado Livre',       fee:0.115},
  {id:'amazon',     name:'Amazon',              fee:0.15},
  {id:'infinitypay',name:'Infinity Pay Créd.',  fee:0.1249},
  {id:'pix',        name:'Pix / Direto',        fee:0},
];

const FIL_DEFAULT=[
  // PLA
  {id:101,nome:'PLA ESUN',marca:'ESUN',cor:'Natural',tipo:'PLA',custo:170,peso:1000},
  {id:102,nome:'PLA 3DX Natural',marca:'3DX NATURAL',cor:'Natural',tipo:'PLA',custo:150,peso:1000},
  {id:103,nome:'PLA 3D LAB',marca:'3D LAB',cor:'Variada',tipo:'PLA',custo:90,peso:1000},
  {id:104,nome:'PLA Macarrão Verde',marca:'3DFILA',cor:'Verde',tipo:'PLA',custo:110,peso:1000},
  {id:105,nome:'PLA VOOLT MATTE Blue 1',marca:'VOOLT',cor:'Azul',tipo:'PLA',custo:120,peso:1000},
  // ABS — ordenado por cor
  {id:106,nome:'ABS Amarelo',marca:'GTMAX3D',cor:'Amarelo',tipo:'ABS',custo:0,peso:1000},
  {id:107,nome:'ABS Azul Bebê',marca:'GTMAX3D',cor:'Azul Bebê',tipo:'ABS',custo:0,peso:1000},
  {id:108,nome:'ABS Azul Claro',marca:'GTMAX3D',cor:'Azul Claro',tipo:'ABS',custo:0,peso:1000},
  {id:109,nome:'ABS Azul Escuro',marca:'GTMAX3D',cor:'Azul Escuro',tipo:'ABS',custo:0,peso:1000},
  {id:110,nome:'ABS BR Dental',marca:'3DLAB',cor:'Branco',tipo:'ABS',custo:0,peso:1000},
  {id:111,nome:'ABS Cinza',marca:'GTMAX3D',cor:'Cinza',tipo:'ABS',custo:0,peso:1000},
  {id:112,nome:'ABS Cinza',marca:'3DLAB',cor:'Cinza',tipo:'ABS',custo:0,peso:1000},
  {id:113,nome:'ABS Eco Plast',marca:'GTMAX3D',cor:'Variada',tipo:'ABS',custo:0,peso:1000},
  {id:114,nome:'ABS Laranja',marca:'GTMAX3D',cor:'Laranja',tipo:'ABS',custo:0,peso:1000},
  {id:115,nome:'ABS Laranja',marca:'3DLAB',cor:'Laranja',tipo:'ABS',custo:0,peso:1000},
  {id:116,nome:'ABS Laranja Fluor',marca:'GTMAX3D',cor:'Laranja Fluor',tipo:'ABS',custo:0,peso:1000},
  {id:117,nome:'ABS Lilás',marca:'GTMAX3D',cor:'Lilás',tipo:'ABS',custo:0,peso:1000},
  {id:118,nome:'ABS Marrom',marca:'GTMAX3D',cor:'Marrom',tipo:'ABS',custo:0,peso:1000},
  {id:119,nome:'ABS Nude',marca:'GTMAX3D',cor:'Nude',tipo:'ABS',custo:0,peso:1000},
  {id:120,nome:'ABS Pink',marca:'GTMAX3D',cor:'Pink',tipo:'ABS',custo:0,peso:1000},
  {id:121,nome:'ABS Pink',marca:'3DLAB',cor:'Pink',tipo:'ABS',custo:0,peso:1000},
  {id:122,nome:'ABS Preto',marca:'GTMAX3D',cor:'Preto',tipo:'ABS',custo:0,peso:1000},
  {id:123,nome:'ABS Preto',marca:'VOOLT',cor:'Preto',tipo:'ABS',custo:0,peso:1000},
  {id:124,nome:'ABS Roxo',marca:'GTMAX3D',cor:'Roxo',tipo:'ABS',custo:0,peso:1000},
  {id:125,nome:'ABS Verde',marca:'PRINTALOT',cor:'Verde',tipo:'ABS',custo:0,peso:1000},
  {id:126,nome:'ABS Verde Escuro',marca:'3DLAB',cor:'Verde Escuro',tipo:'ABS',custo:0,peso:1000},
  {id:127,nome:'ABS Verde Limão',marca:'3DLAB',cor:'Verde Limão',tipo:'ABS',custo:0,peso:1000},
  {id:128,nome:'ABS Vermelho',marca:'PRINTALOT',cor:'Vermelho',tipo:'ABS',custo:0,peso:1000},
];

let selMP='shopee_fg',modo='v',relP=7,compSel=[],lastCalc={},impOrigin='config',filOrigin='page',editFilId=null;
let prodViewMode='lista';
let crmViewMode='grid';
let orcAtual=null;
let crmDetalheId=null;

let DB={config:{kwh:0.85},impressoras:[{id:1,nome:'Bambu Lab X1 Carbon',inv:9500,roi:18,watts:350,hpd:8,fail:5}],filamentos:FIL_DEFAULT,produtos:[]};

/* ── DB ─────────────────────────────────────────────── */

/* ── DB LOCAL (em memória) — dados vêm do Supabase ── */
function loadDB(){
  try{
    const nomes=new Set(DB.filamentos.map(f=>(f.nome||'').toLowerCase().trim()));
    FIL_DEFAULT.forEach(f=>{if(!nomes.has((f.nome||'').toLowerCase().trim()))DB.filamentos.push(f);});
  }catch(e){}
}
async function saveDB(){/* dados persistidos pelo Supabase diretamente */}

/* ═══════════════════════════════════════════════════════
   CAMADA SUPABASE — substitui localStorage por banco real
   Cada usuário vê só seus próprios dados (RLS)
   ═══════════════════════════════════════════════════════ */

let _currentUser = null;
let _userProfile = null;

/* ── DB SYNC ─────────────────────────────────────────── */
function loadDB(){
  // DB em memória — dados vêm do Supabase no initApp()
  // Mantém filamentos default como fallback — deduplicar por nome
  const nomes = new Set(DB.filamentos.map(f=>(f.nome||'').toLowerCase().trim()));
  FIL_DEFAULT.forEach(f=>{ if(!nomes.has((f.nome||'').toLowerCase().trim())) DB.filamentos.push(f); });
}

async function saveDB(){
  // Persist é feito por função específica de cada módulo
  // saveDB() agora é no-op para compatibilidade
}

/* ── LOAD DADOS DO SUPABASE ──────────────────────────── */
async function loadSupabaseData(){
  if(!_currentUser) return;
  const uid = _currentUser.id;

  const [
    { data: produtos,    error: e1 },
    { data: filamentos,  error: e2 },
    { data: impressoras, error: e3 },
    { data: clientes,    error: e4 },
    { data: orcamentos,  error: e5 },
    { data: fila,        error: e6 },
    { data: estoque,     error: e7 },
    { data: concorrentes,error: e8 },
    { data: config,      error: e9 },
  ] = await Promise.all([
    _supa.from('products').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('filaments').select('*').eq('user_id', uid).order('nome'),
    _supa.from('printers').select('*').eq('user_id', uid),
    _supa.from('clientes').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('orcamentos').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('fila_producao').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('estoque').select('*').eq('user_id', uid),
    _supa.from('competitors').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
    _supa.from('user_config').select('*').eq('user_id', uid).single(),
  ]);
  // Log de erros de carregamento para diagnóstico
  const _loadErros = {products:e1,filaments:e2,printers:e3,clientes:e4,orcamentos:e5,fila_producao:e6,estoque:e7,competitors:e8,user_config:e9};
  Object.entries(_loadErros).forEach(([t,e])=>{ if(e) console.error('RLS/load error em',t,':',e.message); });

  // Mapear produtos do Supabase para formato do DB
  DB.produtos = (produtos || []).map(p => ({
    id: p.id, nome: p.name, filamento: p.filament_name || '—',
    custoTotal: p.cost_total || 0, precoBase: p.price_base || 0,
    margem: p.margin || 0, markup: p.markup || 0,
    data: new Date(p.created_at).toLocaleDateString('pt-BR'),
    ts: new Date(p.created_at).getTime(),
    _supaid: p.id
  }));

  // Filamentos — usa os do Supabase + defaults não cadastrados
  if(filamentos && filamentos.length){
    // Deduplicar por nome (não por ID — IDs do FIL_DEFAULT são numéricos, Supabase usa UUIDs)
    const supabaseNomes = new Set(filamentos.map(f=>(f.nome||f.name||'').toLowerCase().trim()));
    const extras = FIL_DEFAULT.filter(f=>!supabaseNomes.has((f.nome||'').toLowerCase().trim()));
    DB.filamentos = [...filamentos.map(f=>({
      id: f.id, nome: f.nome||f.name, marca: f.marca||f.brand||'',
      cor: f.cor||f.color||'', tipo: f.tipo||f.type||'PLA',
      custo: f.custo||f.cost||0, peso: f.peso||f.weight_g||1000
    })), ...extras];
    DB.filamentos.sort((a,b)=>{
      const t=(a.tipo||'').localeCompare(b.tipo||''); if(t!==0) return t;
      const c=(a.cor||'').localeCompare(b.cor||'');  if(c!==0) return c;
      return (a.nome||'').localeCompare(b.nome||'');
    });
  }

  // Impressoras
  if(impressoras && impressoras.length){
    DB.impressoras = impressoras.map(i=>({
      id: i.id, nome: i.name, inv: i.investment||9500,
      roi: i.roi_months||18, watts: i.watts||350,
      hpd: i.hours_per_day||8, fail: i.fail_rate||5
    }));
  }

  // Clientes
  DB.clientes = (clientes || []).map(c=>({
    id: c.id, nome: c.name, wpp: c.whatsapp||'',
    insta: c.instagram||'', email: c.email||'', obs: c.notes||'',
    ts: new Date(c.created_at).getTime()
  }));

  // Orçamentos
  // Item 32: itens é jsonb (sempre lista). Se vier algo ilegível, avisa em vez de inventar um item calado.
  let _orcIlegiveis = 0;
  DB.orcamentos = (orcamentos || []).map(o=>{
    let itens = o.itens, itensErro = false;
    if (typeof itens === 'string') { try { itens = JSON.parse(itens); } catch(e) { itens = null; } }
    if (!Array.isArray(itens) || !itens.length) {
      itensErro = true; _orcIlegiveis++;
      console.error('Orçamento com itens ilegíveis', o.id, o.itens);
      itens = [{ nome: o.produto_nome || 'Item', qtd: o.qtd || 1, preco: o.preco || 0 }];
    }
    return {
      itensErro,
      id: o.id, clienteId: o.cliente_id, clienteNome: o.cliente_nome||'Cliente não informado',
      clienteWpp: o.cliente_wpp||'', produtoNome: o.produto_nome||'',
      produtoId: o.produto_id||null, itens,
      qtd: o.qtd||1, preco: o.preco||0, desc: o.desconto||0,
      total: o.total||0, marketplace: o.marketplace||'', obs: o.obs||'',
      validade: o.validade||'', status: o.status||'pendente',
      data: o.data||new Date(o.created_at).toLocaleDateString('pt-BR'),
      ts: new Date(o.created_at).getTime()
    };
  });
  if (_orcIlegiveis) notify(_orcIlegiveis + ' orçamento(s) com itens ilegíveis — marcados com ⚠ na lista. Fale com o suporte.', 'red');

  // Fila
  DB.fila = (fila || []).map(f=>({
    id: f.id, orcamentoId: f.orcamento_id, produto: f.produto||'',
    clienteId: f.cliente_id, clienteNome: f.cliente_nome||'—',
    qtd: f.qtd||1, prazo: f.prazo||'', status: f.status||'aguardando',
    transportadora: f.transportadora||'', rastreio: f.rastreio||'',
    obs: f.obs||'', criado: f.criado||new Date(f.created_at).toLocaleDateString('pt-BR'),
    ts: new Date(f.created_at).getTime()
  }));

  // Estoque
  DB.estoque = (estoque || []).map(e=>({
    id: e.id, filId: e.filamento_id, nome: e.nome||'',
    tipo: e.tipo||'', qtd: e.qtd||0, min: e.minimo||1,
    obs: e.obs||'', atualizado: e.atualizado||''
  }));

  // Concorrentes
  DB.concorrentes = (concorrentes || []).map(c=>({
    id: c.id, nome: c.name, loja: c.store||'',
    url: c.url||'', preco: c.price||0,
    marketplace: c.marketplace||'', obs: c.notes||''
  }));

  // Config
  if(config){
    DB.config.kwh = config.kwh||0.85;
    DB.config.kwhBase = config.kwh_base||0.85;
    DB.config.bandeira = config.bandeira||'';
  }
}

/* ── SALVAR PRODUTO ──────────────────────────────────── */
async function salvar(){
  const nome = document.getElementById('c-nome').value.trim()||'Produto sem nome';
  const filId = parseInt(document.getElementById('c-fil').value||0);
  const fil = DB.filamentos.find(x=>x.id===filId);
  const r = lastCalc;
  const uid = _currentUser.id;

  // Tentar insert completo; se falhar por coluna inexistente, tentar versão mínima
  const _insertCompleto = {
    user_id: uid, name: nome,
    filament_name: fil?fil.nome:'—',
    cost_total: parseFloat(r.total.toFixed(2)),
    price_base: parseFloat(r.base.toFixed(2)),
    margin: parseFloat((r.base>0?((r.base-r.total)/r.base*100):0).toFixed(2)),
    markup: parseFloat((r.markup*100).toFixed(2)),
    print_hours: parseFloat(r.printH.toFixed(4)),
    grams_used: parseFloat((parseFloat(document.getElementById('c-grams').value)||0).toFixed(2)),
    packaging: parseFloat((r.emb||0).toFixed(2)),
    supplies: parseFloat((r.ins||0).toFixed(2)),
    labor_hour: parseFloat((parseFloat(document.getElementById('c-hora').value)||0).toFixed(2)),
  };
  let { data, error } = await _supa.from('products').insert(_insertCompleto).select().single();

  // Se erro de coluna inexistente, tentar só colunas básicas
  if(error && (error.message.includes('column') || error.message.includes('schema cache'))){
    console.warn('Insert completo falhou, tentando versão básica:', error.message);
    const _insertBasico = { user_id: uid, name: nome, filament_name: fil?fil.nome:'—',
      cost_total: parseFloat(r.total.toFixed(2)), price_base: parseFloat(r.base.toFixed(2)),
      margin: parseFloat((r.base>0?((r.base-r.total)/r.base*100):0).toFixed(2)),
      markup: parseFloat((r.markup*100).toFixed(2)) };
    const res2 = await _supa.from('products').insert(_insertBasico).select().single();
    data = res2.data; error = res2.error;
  }

  if(error){ notify('Erro ao salvar: '+error.message,'red'); console.error('salvar produto',error); return; }

  // Adicionar no DB local
  DB.produtos.unshift({
    id: data.id, nome, filamento: fil?fil.nome:'—',
    custoTotal: r.total, precoBase: r.base, margem: r.base>0?((r.base-r.total)/r.base*100):0,
    markup: r.markup*100, data: new Date().toLocaleDateString('pt-BR'), ts: Date.now()
  });
  notify('Produto salvo!'); showPage('produtos');
}

/* ── SALVAR FILAMENTO ────────────────────────────────── */
async function saveFil(){
  const uid = _currentUser.id;
  const editId = editFilId;
  const fil = {
    nome: document.getElementById('mf-nome').value.trim(),
    marca: document.getElementById('mf-marca').value.trim(),
    cor: document.getElementById('mf-cor').value.trim(),
    tipo: document.getElementById('mf-tipo').value,
    custo: parseFloat(document.getElementById('mf-custo').value)||0,
    peso: parseInt(document.getElementById('mf-peso').value)||1000,
  };
  if(!fil.nome){ notify('Informe o nome','red'); return; }

  // IDs numéricos (<=6 dígitos) = filamentos default do FIL_DEFAULT, não têm UUID no Supabase
  const isDefaultId = editId && /^\d{1,6}$/.test(String(editId));

  if(editId && !isDefaultId){
    // UPDATE normal no Supabase (tem UUID real)
    await _supa.from('filaments').update({
      name: fil.nome, brand: fil.marca, color: fil.cor,
      type: fil.tipo, cost: fil.custo, weight_g: fil.peso
    }).eq('id', editId);
    DB.filamentos = DB.filamentos.map(f=>String(f.id)===String(editId)?{...f,...fil}:f);
  } else {
    // INSERT — novo filamento OU filamento default sendo personalizado
    if(isDefaultId) DB.filamentos = DB.filamentos.filter(f=>String(f.id)!==String(editId));
    const { data } = await _supa.from('filaments').insert({
      user_id: uid, name: fil.nome, brand: fil.marca, color: fil.cor,
      type: fil.tipo, cost: fil.custo, weight_g: fil.peso
    }).select().single();
    if(data) DB.filamentos.push({...fil, id: data.id});
  }
  // Re-sort por tipo → cor → nome após qualquer alteração
  DB.filamentos.sort((a,b)=>{
    const t=(a.tipo||'').localeCompare(b.tipo||''); if(t!==0) return t;
    const c=(a.cor||'').localeCompare(b.cor||'');  if(c!==0) return c;
    return (a.nome||'').localeCompare(b.nome||'');
  });
  editFilId = null;
  closeModal('modal-fil');
  renderFilamentos(); populateSelects();
  notify('Filamento salvo!');
}

/* ── SALVAR CLIENTE ──────────────────────────────────── */
async function saveCliente(){
  const uid = _currentUser.id;
  const id = document.getElementById('cli-id').value;
  const cli = {
    nome: document.getElementById('cli-nome').value.trim()||'Cliente sem nome',
    wpp: document.getElementById('cli-wpp').value.trim(),
    insta: document.getElementById('cli-insta').value.trim(),
    email: document.getElementById('cli-email').value.trim(),
    obs: document.getElementById('cli-obs').value.trim(),
  };

  if(id){
    await _supa.from('clientes').update({
      name: cli.nome, whatsapp: cli.wpp, instagram: cli.insta,
      email: cli.email, notes: cli.obs
    }).eq('id', id);
    DB.clientes = DB.clientes.map(c=>String(c.id)===String(id)?{...c,...cli}:c);
  } else {
    const { data } = await _supa.from('clientes').insert({
      user_id: uid, name: cli.nome, whatsapp: cli.wpp,
      instagram: cli.insta, email: cli.email, notes: cli.obs
    }).select().single();
    if(data) DB.clientes.unshift({...cli, id: data.id, ts: Date.now()});
  }
  closeModal('modal-cliente'); renderCRM(); notify('Cliente salvo!');
}

async function delCliente(id){
  if(!confirm('Remover este cliente?')) return;
  const {error} = await _supa.from('clientes').delete().eq('id', id);
  if(error){ notify('Erro ao remover: '+error.message,'red'); console.error('delCliente',error); return; }
  DB.clientes = DB.clientes.filter(c=>String(c.id)!==String(id));
  renderCRM(); notify('Cliente removido','red');
}

/* ── SALVAR ORÇAMENTO ────────────────────────────────── */
async function saveOrcamento(){
  const uid = _currentUser.id;
  const editId = document.getElementById('modal-orc').dataset.editId||null;
  const cliId = document.getElementById('orc-cliente').value;
  const cli = DB.clientes.find(c=>String(c.id)===String(cliId));
  const desc = parseFloat(document.getElementById('orc-desc').value)||0;

  const itens = getOrcItens().filter(i=>i.nome&&i.preco>0);
  if(!itens.length){ notify('Adicione pelo menos um item com nome e preço','red'); return; }

  const subtotal = itens.reduce((s,i)=>s+i.qtd*i.preco, 0);
  const total = subtotal*(1-desc/100);
  const prodNome = itens.map(i=>i.qtd>1?`${i.qtd}x ${i.nome}`:i.nome).join(', ');
  const qtdTotal = itens.reduce((s,i)=>s+i.qtd, 0);

  const payload = {
    cliente_id: cliId||null,
    cliente_nome: cli?cli.nome:'Cliente não informado',
    cliente_wpp: cli?cli.wpp:'',
    produto_nome: prodNome,
    qtd: qtdTotal,
    preco: itens[0].preco,
    desconto: desc,
    total,
    marketplace: document.getElementById('orc-mp').value,
    obs: document.getElementById('orc-obs').value.trim(),
    validade: document.getElementById('orc-validade').value,
  };

  if(editId){
    const {error}=await _supa.from('orcamentos').update({...payload, itens}).eq('id',editId);
    if(error){notify('Erro ao salvar o orçamento: '+error.message,'red');return;}
    DB.orcamentos=DB.orcamentos.map(o=>String(o.id)===String(editId)?{...o,
      clienteId:cliId,clienteNome:payload.cliente_nome,clienteWpp:payload.cliente_wpp,
      produtoId:null,produtoNome:prodNome,qtd:qtdTotal,preco:itens[0].preco,desc,total,
      itens,itensErro:false,marketplace:payload.marketplace,obs:payload.obs,validade:payload.validade}:o);
    delete document.getElementById('modal-orc').dataset.editId;
    document.getElementById('modal-orc').querySelector('.modal-title').textContent='Novo orçamento';
    closeModal('modal-orc');notify('Orçamento atualizado!');renderOrcamentos();
    return;
  }

  const { data, error } = await _supa.from('orcamentos').insert({user_id:uid,...payload,status:'pendente',itens}).select().single();
  if(error){ notify('Erro ao salvar o orçamento: '+error.message,'red'); return; }

  DB.orcamentos.unshift({
    id: data.id, clienteId: cliId, clienteNome: payload.cliente_nome,
    clienteWpp: payload.cliente_wpp, produtoId: null, produtoNome: prodNome,
    qtd: qtdTotal, preco: itens[0].preco, desc, total, itens,
    marketplace: data.marketplace||payload.marketplace,
    obs: data.obs||payload.obs,
    validade: data.validade||payload.validade,
    status: 'pendente',
    data: new Date(data.created_at).toLocaleDateString('pt-BR'),
    ts: new Date(data.created_at).getTime()
  });
  closeModal('modal-orc'); notify('Orçamento salvo!'); renderOrcamentos();
}

/* ── ATUALIZAR STATUS ORÇAMENTO ──────────────────────── */
async function updateOrcStatus(id, status){
  const o = DB.orcamentos.find(x=>String(x.id)===String(id)); if(!o) return;
  const anterior = o.status;
  o.status = status;

  await _supa.from('orcamentos').update({ status }).eq('id', id);

  if(status==='aprovado' && anterior!=='aprovado'){
    if(!DB.fila) DB.fila=[];
    const jaExiste = DB.fila.find(f=>f.orcamentoId===id);
    let filaId = null;
    if(!jaExiste){
      const { data: filaData } = await _supa.from('fila_producao').insert({
        user_id: _currentUser.id,
        orcamento_id: id,
        produto: o.produtoNome+(o.qtd>1?' × '+o.qtd:''),
        cliente_id: o.clienteId||null,
        cliente_nome: o.clienteNome,
        qtd: o.qtd,
        status: 'aguardando',
        obs: 'Criado automaticamente do orçamento Nº '+String(id).slice(-6),
        criado: new Date().toLocaleDateString('pt-BR'),
      }).select().single();

      if(filaData){
        filaId = filaData.id;
        DB.fila.unshift({
          id: filaId, orcamentoId: id,
          produto: o.produtoNome+(o.qtd>1?' × '+o.qtd:''),
          clienteId: o.clienteId, clienteNome: o.clienteNome,
          qtd: o.qtd, prazo: '', status: 'aguardando',
          transportadora: '', rastreio: '',
          obs: 'Criado automaticamente do orçamento Nº '+String(id).slice(-6),
          criado: new Date().toLocaleDateString('pt-BR'), ts: Date.now()
        });
      }
    } else {
      filaId = jaExiste.id;
    }
    renderOrcamentos();
    if(filaId) abrirRastreioOpcional(filaId);
    return;
  }
  renderOrcamentos();
}

async function delOrcamento(id){
  id=String(id);
  if(!confirm('Remover orçamento?')) return;
  await _supa.from('orcamentos').delete().eq('id', id);
  DB.orcamentos = DB.orcamentos.filter(x=>x.id!==id);
  renderOrcamentos(); notify('Removido','red');
}

/* ── SALVAR FILA ─────────────────────────────────────── */
async function saveFila(){
  const uid = _currentUser.id;
  const editId = document.getElementById('fila-edit-id').value;
  const cliId = document.getElementById('fp-cliente').value;
  const cli = DB.clientes.find(c=>c.id==cliId);

  const payload = {
    produto: document.getElementById('fp-produto').value.trim()||'Pedido sem nome',
    cliente_id: cliId||null,
    cliente_nome: cli?cli.nome:'—',
    qtd: parseInt(document.getElementById('fp-qtd').value)||1,
    prazo: document.getElementById('fp-prazo').value,
    status: document.getElementById('fp-status').value,
    obs: document.getElementById('fp-obs').value.trim(),
    transportadora: document.getElementById('fp-transportadora').value,
    rastreio: document.getElementById('fp-rastreio').value.trim(),
    criado: new Date().toLocaleDateString('pt-BR'),
  };

  if(editId){
    await _supa.from('fila_producao').update(payload).eq('id', editId);
    DB.fila = DB.fila.map(x=>x.id===editId?{...x,...payload,id:editId,clienteId:payload.cliente_id,clienteNome:payload.cliente_nome}:x);
  } else {
    const { data } = await _supa.from('fila_producao').insert({...payload, user_id: uid}).select().single();
    if(data) DB.fila.unshift({...payload, id: data.id, clienteId: payload.cliente_id, clienteNome: payload.cliente_nome, ts: Date.now()});
  }
  closeModal('modal-fila'); renderFila(); notify('Pedido salvo!');
  // Verificar estoque de filamento para o produto
  verificarEstoqueFilamento(payload.produto, payload.qtd);
}

/* ── AVANÇAR STATUS FILA ─────────────────────────────── */
function verificarEstoqueFilamento(nomeProduto, qtdPedido){
  // Encontrar produto no catálogo pelo nome
  const prod = DB.produtos.find(p => p.nome === nomeProduto);
  if(!prod || !prod.filamento || !prod.gramas) return; // sem dados suficientes

  const gramasNecessarios = (prod.gramas || 0) * (qtdPedido || 1);
  if(gramasNecessarios <= 0) return;

  // Encontrar filamento no estoque pelo nome/tipo
  const estoque = DB.estoque || [];
  const filamentoNome = (prod.filamento || '').toLowerCase();

  // Soma total disponível: qtd carretéis × peso do carretel (buscado nos filamentos cadastrados)
  let gramasDisponiveis = 0;
  estoque.forEach(e => {
    const match = (e.nome||'').toLowerCase().includes(filamentoNome) ||
                  filamentoNome.includes((e.tipo||'').toLowerCase());
    if(match && e.qtd > 0) {
      // Peso do carretel: buscar no cadastro de filamentos
      const filCad = DB.filamentos.find(f => f.nome === e.nome || f.id === e.id);
      const pesoPorCarretel = filCad ? (filCad.peso || 1000) : 1000;
      gramasDisponiveis += e.qtd * pesoPorCarretel;
    }
  });

  if(gramasDisponiveis === 0) return; // sem estoque cadastrado — não alertar

  if(gramasNecessarios > gramasDisponiveis) {
    const faltam = (gramasNecessarios - gramasDisponiveis).toFixed(0);
    const temg = gramasDisponiveis.toFixed(0);
    const precisag = gramasNecessarios.toFixed(0);
    // Popup de aviso
    const popup = document.createElement('div');
    popup.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999';
    popup.innerHTML = `<div style="background:var(--bg2);border:2px solid var(--red);border-radius:16px;padding:28px;max-width:380px;width:90%;text-align:center">
      <div style="font-size:40px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:700;color:var(--red);margin-bottom:8px">Filamento insuficiente!</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:16px">
        Para imprimir <strong>${qtdPedido}× ${nomeProduto}</strong> são necessários <strong>${precisag}g</strong> de <strong>${esc(prod.filamento)}</strong>.<br><br>
        Estoque disponível: <strong style="color:var(--red)">${temg}g</strong><br>
        Faltam: <strong style="color:var(--red)">${faltam}g</strong>
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="showPage('filamentos');this.closest('[style*=inset]').remove()" style="padding:8px 18px;background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600">Ver estoque</button>
        <button onclick="this.closest('[style*=inset]').remove()" style="padding:8px 18px;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:8px;cursor:pointer">OK</button>
      </div>
    </div>`;
    document.body.appendChild(popup);
  }
}

async function avancarStatus(id){
  const order=['aguardando','fatiando','imprimindo','pos_processo','pronto','ag_envio','enviado','entregue'];
  const item = DB.fila.find(x=>String(x.id)===String(id)); if(!item) return;
  const idx = order.indexOf(item.status);
  if(idx<order.length-1){
    const proximo = order[idx+1];
    if(item.status==='pronto' && proximo==='ag_envio' && !item.transportadora){
      abrirRastreioObrigatorio(id); return;
    }
    const {error:errAv} = await _supa.from('fila_producao').update({ status: proximo }).eq('id', id);
    if(errAv){ notify('Erro ao avançar: '+errAv.message,'red'); console.error('avancarStatus',errAv); return; }
    item.status = proximo;
    const filtro = document.getElementById('fila-status-filter');
    if(filtro) filtro.value = item.status;
    renderFila();
    notify(FILA_STATUS[item.status].label+' — pedido avançado!');
  }
}

async function updateFilaStatus(id, status){
  const item = DB.fila.find(x=>String(x.id)===String(id)); if(!item) return;
  if(status==='ag_envio' && !item.transportadora){
    abrirRastreioObrigatorio(id); return;
  }
  item.status = status;
  await _supa.from('fila_producao').update({ status }).eq('id', id);
  renderFila(); notify('Status atualizado!');
}

async function delFila(id){
  if(!confirm('Remover este pedido da fila?')) return;
  const {error} = await _supa.from('fila_producao').delete().eq('id', id);
  if(error){ notify('Erro ao remover: '+error.message,'red'); console.error('delFila',error); return; }
  DB.fila = DB.fila.filter(x=>String(x.id)!==String(id));
  renderFila(); notify('Removido da fila','red');
}

/* ── SALVAR RASTREIO ─────────────────────────────────── */
async function salvarRastreioRapido(){
  const filaId = document.getElementById('rastreio-fila-id').value;
  const obrigatorio = document.getElementById('rastreio-obrigatorio').value==='1';
  const item = DB.fila.find(x=>x.id===filaId||x.id===parseInt(filaId));
  if(!item){ closeModal('modal-rastreio'); return; }

  const transp = document.getElementById('rastreio-transportadora').value;
  const outro = document.getElementById('rastreio-outro-nome').value.trim();
  const codigo = document.getElementById('rastreio-codigo').value.trim();
  const semCodigo = ['maos','retirada'];

  if(!transp){ notify('Selecione a forma de entrega para continuar.','red'); return; }
  if(transp==='outro' && !outro){ notify('Informe o nome da transportadora.','red'); return; }
  if(obrigatorio && !semCodigo.includes(transp) && transp!=='outro' && !codigo){
    notify('Informe o código de rastreio para continuar.','red'); return;
  }

  item.transportadora = transp==='outro'?('outro:'+outro):transp;
  item.rastreio = codigo;

  const update = { transportadora: item.transportadora, rastreio: codigo };
  if(obrigatorio){
    item.status = 'ag_envio';
    update.status = 'ag_envio';
    const filtro = document.getElementById('fila-status-filter');
    if(filtro) filtro.value = 'ag_envio';
  }

  await _supa.from('fila_producao').update(update).eq('id', item.id);
  closeModal('modal-rastreio');
  if(obrigatorio){ renderFila(); notify('📦 Forma de entrega registrada!'); }
  else if(codigo||semCodigo.includes(transp)){ notify('✅ Aprovado! Entrega cadastrada.'); }
  else { notify('✅ Orçamento aprovado! Pedido na fila de produção.'); }
}

/* ── SALVAR ESTOQUE ──────────────────────────────────── */
async function saveEstoque(){
  const uid = _currentUser.id;
  const editId = document.getElementById('est-edit-id').value;
  const filId = document.getElementById('est-fil-id').value;
  if(!filId){ notify('Selecione um filamento','red'); return; }
  const fil = DB.filamentos.find(f=>f.id==filId);
  const item = {
    filamento_id: filId, nome: fil?fil.nome:'Filamento',
    tipo: fil?fil.tipo:'', qtd: parseInt(document.getElementById('est-qtd').value)||0,
    minimo: parseInt(document.getElementById('est-min').value)||1,
    obs: document.getElementById('est-obs').value.trim(),
    atualizado: new Date().toLocaleDateString('pt-BR'),
  };

  if(editId){
    await _supa.from('estoque').update(item).eq('id', editId);
    DB.estoque = DB.estoque.map(x=>x.id===editId?{...x,filId:filId,qtd:item.qtd,min:item.minimo,obs:item.obs,atualizado:item.atualizado}:x);
  } else {
    const ex = DB.estoque.find(x=>x.filId==filId);
    if(ex){
      ex.qtd += item.qtd; ex.atualizado = item.atualizado;
      await _supa.from('estoque').update({ qtd: ex.qtd, atualizado: ex.atualizado }).eq('id', ex.id);
    } else {
      const { data } = await _supa.from('estoque').insert({...item, user_id: uid}).select().single();
      if(data) DB.estoque.push({id: data.id, filId, nome: item.nome, tipo: item.tipo, qtd: item.qtd, min: item.minimo, obs: item.obs, atualizado: item.atualizado});
    }
  }
  closeModal('modal-estoque'); renderEstoque(); notify('Estoque atualizado!');
}

async function ajustarQtdEstoque(id, delta){
  const item = DB.estoque.find(x=>String(x.id)===String(id)); if(!item) return;
  item.qtd = Math.max(0, item.qtd+delta);
  item.atualizado = new Date().toLocaleDateString('pt-BR');
  await _supa.from('estoque').update({ qtd: item.qtd, atualizado: item.atualizado }).eq('id', id);
  renderEstoque();
}

async function delEstoque(id){
  if(!confirm('Remover do estoque?')) return;
  await _supa.from('estoque').delete().eq('id', id);
  DB.estoque = DB.estoque.filter(x=>String(x.id)!==String(id));
  renderEstoque(); notify('Removido','red');
}

/* ── SALVAR IMPRESSORA ───────────────────────────────── */
async function saveImp(){
  const uid = _currentUser.id;
  const imp = {
    nome: document.getElementById('mi-nome').value.trim(),
    inv: parseFloat(document.getElementById('mi-inv').value)||9500,
    roi: parseInt(document.getElementById('mi-roi').value)||18,
    watts: parseInt(document.getElementById('mi-watts').value)||350,
    hpd: parseFloat(document.getElementById('mi-hpd').value)||8,
    fail: parseFloat(document.getElementById('mi-fail').value)||5,
  };
  const { data } = await _supa.from('printers').insert({
    user_id: uid, name: imp.nome, investment: imp.inv,
    roi_months: imp.roi, watts: imp.watts,
    hours_per_day: imp.hpd, fail_rate: imp.fail
  }).select().single();
  if(data) DB.impressoras.push({...imp, id: data.id});
  closeModal('modal-imp');
  if(impOrigin==='calc') populateSelects();
  else renderConfig();
  notify('Impressora adicionada!');
}

async function delImp(id){
  await _supa.from('printers').delete().eq('id', id);
  DB.impressoras = DB.impressoras.filter(x=>String(x.id)!==String(id));
  renderConfig(); notify('Removida','red');
}

/* ── SALVAR CONCORRENTE ──────────────────────────────── */
async function saveConc(){
  const uid = _currentUser.id;
  const c = {
    nome: document.getElementById('mc-nome').value.trim(),
    loja: document.getElementById('mc-loja').value.trim(),
    url: document.getElementById('mc-url').value.trim(),
    preco: parseFloat(document.getElementById('mc-preco').value)||0,
    marketplace: document.getElementById('mc-mp').value,
    obs: document.getElementById('mc-obs').value.trim(),
  };
  const { data } = await _supa.from('competitors').insert({
    user_id: uid, name: c.nome, store: c.loja, url: c.url,
    price: c.preco, marketplace: c.marketplace, notes: c.obs
  }).select().single();
  if(data){ if(!DB.concorrentes)DB.concorrentes=[]; DB.concorrentes.unshift({...c, id: data.id}); }
  closeModal('modal-conc'); renderConcList(); notify('Concorrente salvo!');
}

/* ── SALVAR CONFIG ───────────────────────────────────── */
async function saveConfig(){
  DB.config.kwh = parseFloat(document.getElementById('cfg-kwh').value)||0.85;
  await _supa.from('user_config').upsert({
    user_id: _currentUser.id, kwh: DB.config.kwh,
    kwh_base: DB.config.kwhBase||DB.config.kwh, bandeira: DB.config.bandeira||''
  }, { onConflict: 'user_id' });
  notify('Salvo!');
}

/* ── SALVAR SETTINGS ─────────────────────────────────── */
/* Item 11: logo e nomes ficam no Supabase (profiles + Storage "logos"), não mais no navegador.
   _settings é o espelho em memória, carregado no login. */
let _settings = { sysname: 'MoneyFlow 3D', empresa: 'MoneyFlow 3D', logo: '' };
function getSettings(){ return _settings; }

async function carregarSettings(profile){
  _settings = {
    sysname: profile.system_name || 'MoneyFlow 3D',
    empresa: profile.company || 'MoneyFlow 3D',
    logo: profile.logo_url || '',
  };
  // Migração única: quem já tinha configurado no navegador leva para o banco no primeiro login.
  let antigo = {};
  try { antigo = JSON.parse(localStorage.getItem('p3d_settings') || '{}'); } catch(e) { antigo = {}; }
  if (Object.keys(antigo).length) {
    try {
      const mudou = {};
      if (!profile.system_name && antigo.sysname) mudou.system_name = antigo.sysname;
      if (!profile.company && antigo.empresa) mudou.company = antigo.empresa;
      if (!profile.logo_url && antigo.logo && antigo.logo.startsWith('data:image/')) {
        const blob = await (await fetch(antigo.logo)).blob();
        const url = await enviarLogoStorage(blob);
        if (url) mudou.logo_url = url;
      }
      if (Object.keys(mudou).length) {
        const { error } = await _supa.from('profiles').update(mudou).eq('id', _currentUser.id);
        if (error) throw error;
        if (mudou.system_name) _settings.sysname = mudou.system_name;
        if (mudou.company) _settings.empresa = mudou.company;
        if (mudou.logo_url) _settings.logo = mudou.logo_url;
      }
      localStorage.removeItem('p3d_settings');
    } catch(e) {
      console.warn('Migração da logo/nome para o banco falhou; tenta de novo no próximo login.', e);
    }
  }
  aplicarSettings();
}

function aplicarSettings(){
  const s = _settings;
  const t = document.getElementById('logo-title-text'); if (t) t.textContent = s.sysname;
  const sub = document.getElementById('logo-sub-text'); if (sub) sub.textContent = s.empresa;
  if (s.logo) showLogoImg(s.logo); else esconderLogoImg();
}

