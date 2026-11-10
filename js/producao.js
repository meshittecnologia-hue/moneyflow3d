/* MoneyFlow 3D — Módulo 4: fila de produção, painel de pedidos, rastreio, transportadora, vista do CRM.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ---
   MÓDULO 4 — FILA DE PRODUÇÃO
   --- */
const FILA_STATUS={
  aguardando:    {label:'🕐 Aguardando',      cor:'var(--text3)'},
  fatiando:      {label:'⚙ Fatiando',         cor:'var(--blue)'},
  imprimindo:    {label:'🖨 Imprimindo',       cor:'var(--accent)'},
  pos_processo:  {label:'🎨 Pós-processo',    cor:'var(--yellow)'},
  pronto:        {label:'✅ Pronto',           cor:'var(--green)'},
  ag_envio:      {label:'📬 Ag. Envio/Coleta',cor:'#f472b6'},
  enviado:       {label:'🚚 Enviado',          cor:'#38bdf8'},
  entregue:      {label:'📦 Entregue',         cor:'#6b7294'},
};

function openFilaModal(item){
  if(!DB.clientes)DB.clientes=[];
  const sc=document.getElementById('fp-cliente');
  sc.innerHTML='<option value="">Sem cliente vinculado</option>'+DB.clientes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  if(item){
    document.getElementById('modal-fila-title').textContent='Editar pedido';
    document.getElementById('fila-edit-id').value=item.id;
    document.getElementById('fp-produto').value=item.produto;
    sc.value=item.clienteId||'';
    document.getElementById('fp-qtd').value=item.qtd;
    document.getElementById('fp-prazo').value=item.prazo||'';
    document.getElementById('fp-status').value=item.status;
    document.getElementById('fp-obs').value=item.obs||'';
    document.getElementById('fp-transportadora').value=item.transportadora||'';
    document.getElementById('fp-rastreio').value=item.rastreio||'';
  } else {
    document.getElementById('modal-fila-title').textContent='Novo pedido';
    document.getElementById('fila-edit-id').value='';
    document.getElementById('fp-produto').value='';
    document.getElementById('fp-qtd').value=1;
    document.getElementById('fp-prazo').value='';
    document.getElementById('fp-status').value='aguardando';
    document.getElementById('fp-obs').value='';
    document.getElementById('fp-transportadora').value='';
    document.getElementById('fp-rastreio').value='';
  }
  document.getElementById('modal-fila').classList.add('open');
}




function abrirRastreioObrigatorio(filaId){
  document.getElementById('rastreio-fila-id').value=filaId;
  document.getElementById('rastreio-obrigatorio').value='1';
  document.getElementById('rastreio-transportadora').value='';
  document.getElementById('rastreio-codigo').value='';
  document.getElementById('rastreio-outro-nome').value='';
  // Modo obrigatório — mostrar aviso laranja, esconder botão pular
  document.getElementById('rastreio-msg-obrigatorio').style.display='block';
  document.getElementById('rastreio-msg-normal').style.display='none';
  document.getElementById('rastreio-btn-pular').style.display='none';
  document.getElementById('modal-rastreio').classList.add('open');
  // Inicializar estado dos campos (select em '' = mostra aviso pular por padrão, mas aqui é obrigatório então queremos código visível)
  toggleRastreioOutro();
}

function abrirRastreioOpcional(filaId){
  document.getElementById('rastreio-fila-id').value=filaId;
  document.getElementById('rastreio-obrigatorio').value='0';
  document.getElementById('rastreio-transportadora').value='';
  document.getElementById('rastreio-codigo').value='';
  document.getElementById('rastreio-outro-nome').value='';
  // Modo opcional
  document.getElementById('rastreio-msg-obrigatorio').style.display='none';
  document.getElementById('rastreio-msg-normal').style.display='block';
  document.getElementById('rastreio-btn-pular').style.display='';
  document.getElementById('modal-rastreio').classList.add('open');
  // Inicializar estado: select em '' → aviso aparece imediatamente
  toggleRastreioOutro();
}

function pularRastreio(){
  document.getElementById('rastreio-aviso-pular').style.display='none';
  closeModal('modal-rastreio');
}


const TRANSPORTADORAS={
  correios:{nome:'Correios',url:'https://rastreamento.correios.com.br/app/index.php',qparam:'?objeto='},
  mercadolivre:{nome:'Mercado Livre',url:'https://www.mercadolivre.com.br/vendas',qparam:''},
  shopee:{nome:'Shopee',url:'https://shopee.com.br/user/purchase',qparam:''},
  amazon:{nome:'Amazon',url:'https://www.amazon.com.br/gp/css/order-history',qparam:''},
  jadlog:{nome:'Jadlog',url:'https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=',qparam:''},
  total:{nome:'Total Express',url:'https://tracking.totalexpress.com.br/poupup_rastreamento.php?strCode=',qparam:''},
  sequoia:{nome:'Sequoia',url:'https://sequoia.com.br/rastreamento/?codigo=',qparam:''},
  uber:{nome:'Uber Encomendas',url:'https://www.uber.com/br/pt-br/deliver/',qparam:''},
  '99pop':{nome:'99Pop Encomendas',url:'https://99app.com/',qparam:''},
  maos:{nome:'Entrega em mãos',url:'',qparam:''},
  retirada:{nome:'Retirada no local',url:'',qparam:''},
};

function abrirRastreio(transportadora,codigo){
  const t=TRANSPORTADORAS[transportadora];
  if(!t){notify('Transportadora não configurada','red');return;}
  if(!t.url){notify(t.nome+' — sem link de rastreio.','red');return;}
  let url=t.url;
  if(t.qparam&&codigo)url=t.url+t.qparam+encodeURIComponent(codigo);
  window.open(url,'_blank');
}

function renderFila(){
  if(!DB.fila)DB.fila=[];
  const sf=(document.getElementById('fila-status-filter')||{}).value||'';
  let itens=DB.fila.filter(i=>!sf||i.status===sf);
  const el=document.getElementById('fila-list');

  const counts={};
  DB.fila.forEach(i=>{counts[i.status]=(counts[i.status]||0)+1;});
  const statusOrder=['aguardando','fatiando','imprimindo','pos_processo','pronto','ag_envio','enviado','entregue'];
  const resumo=statusOrder.map(s=>`
    <div data-click="filtrarFilaStatus('${s}')" style="text-align:center;padding:10px 12px;background:var(--bg2);border:1px solid ${sf===s?FILA_STATUS[s].cor:'var(--border)'};border-radius:8px;cursor:pointer;transition:border-color .15s">
      <div style="font-size:16px;font-weight:800;color:${esc(FILA_STATUS[s].cor)}">${counts[s]||0}</div>
      <div style="font-size:10px;color:var(--text3);white-space:nowrap">${FILA_STATUS[s].label}</div>
    </div>`).join('');
  const resumoHtml=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-bottom:16px">${resumo}</div>`;

  if(!itens.length){
    el.innerHTML=resumoHtml+`<div style="background:var(--bg2);border:1px dashed var(--border2);border-radius:var(--r);padding:32px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">🖨</div>
      <div style="font-size:14px;color:var(--text2);font-weight:500;margin-bottom:4px">${sf?'Nenhum pedido com esse status':'Fila vazia'}</div>
      <div style="font-size:12px;color:var(--text3)">${sf?'Clique no contador acima para limpar o filtro':'Aprove um orçamento ou adicione um pedido manualmente'}</div>
    </div>`;
    return;
  }
  el.innerHTML=resumoHtml+`<div style="display:flex;flex-direction:column;gap:10px">${itens.map(i=>{
    const st=FILA_STATUS[i.status]||{label:i.status,cor:'var(--text3)'};
    const prazoStr=i.prazo?new Date(i.prazo).toLocaleDateString('pt-BR'):'—';
    const atrasado=i.prazo&&i.status!=='entregue'&&new Date(i.prazo)<new Date();
    const transp=i.transportadora?TRANSPORTADORAS[i.transportadora]:null;
    const rastreioHtml=i.rastreio?`
      <div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer" data-click="abrirRastreio('${i.transportadora||''}','${i.rastreio||''}')">
        📦 <span style="color:var(--text2)">${transp?transp.nome:'Rastreio'}:</span> <span style="color:var(--accent);font-weight:600">${i.rastreio}</span> <span style="color:var(--text3)">↗</span>
      </div>`:'';
    return `<div style="background:var(--bg2);border:1px solid ${atrasado?'rgba(239,68,68,.4)':'var(--border)'};border-radius:var(--r);padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;margin-bottom:4px">${esc(i.produto)}</div>
          <div style="font-size:12px;color:var(--text3);display:flex;flex-wrap:wrap;gap:8px;margin-bottom:6px">
            <span>👤 ${i.clienteNome}</span>
            <span>Qtd: ${i.qtd}</span>
            <span>Prazo: ${prazoStr}${atrasado?' ⚠️':''}</span>
            ${i.criado?`<span style="color:var(--text3)">Criado: ${i.criado}</span>`:''}
          </div>
          ${i.obs?`<div style="font-size:12px;color:var(--text3);font-style:italic;margin-bottom:6px">${esc(i.obs)}</div>`:''}
          ${rastreioHtml}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex-shrink:0">
          <select data-change="updateFilaStatus('${i.id}',this.value)" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:${esc(st.cor)};font-size:12px;outline:none">
            ${statusOrder.map(s=>`<option value="${s}" ${esc(i.status===s?'selected':'')}>${FILA_STATUS[s].label}</option>`).join('')}
          </select>
          ${i.status!=='entregue'?`<button class="btn btn-ghost btn-sm" data-click="avancarStatus('${i.id}')" title="Avançar status" style="color:var(--accent)">▶</button>`:''}
          <button class="btn btn-ghost btn-sm" data-click="abrirFilaPorId('${i.id}')" title="Editar">✏</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-click="delFila('${i.id}')" title="Remover">✕</button>
          ${i.clienteNome&&i.clienteNome!=='—'?`<button class="btn btn-ghost btn-sm" style="color:var(--green)" data-click="wppFila('${i.id}')" title="WhatsApp">📱</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}


function wppFila(id){
  const item=DB.fila.find(x=>x.id===id);if(!item)return;
  const cli=DB.clientes.find(c=>c.id==item.clienteId);
  const st=FILA_STATUS[item.status]||{label:item.status};
  const prazoStr=item.prazo?new Date(item.prazo).toLocaleDateString('pt-BR'):'—';
  const s=getSettings();
  const msg=`Olá ${item.clienteNome}! 👋\n\nAtualização do seu pedido:\n\n📦 *${item.produto}*\n📊 Quantidade: ${item.qtd}\n${st.label}\n📅 Prazo: ${prazoStr}\n\n_${s.sysname||'MoneyFlow 3D'} — ${s.empresa||'MoneyFlow 3D'}_`;
  const num=cli&&cli.wpp?cli.wpp.replace(/\D/g,''):'';
  window.open(`https://wa.me/${num?'55'+num:''}?text=${encodeURIComponent(msg)}`,'_blank');
}


/* ---
   PAINEL DE PEDIDOS
   --- */
function renderPedidos(){
  if(!DB.orcamentos)DB.orcamentos=[];
  const q=(document.getElementById('ped-search')||{}).value?.toLowerCase()||'';
  const sf=(document.getElementById('ped-status')||{}).value||'';
  const dias=parseInt((document.getElementById('ped-periodo')||{}).value||0);
  const agora=Date.now();
  const cutoff=dias>0?agora-(dias*24*60*60*1000):0;
  let orcs=DB.orcamentos.filter(o=>{
    const mq=!q||o.clienteNome.toLowerCase().includes(q)||o.produtoNome.toLowerCase().includes(q);
    const ms=!sf||o.status===sf;
    const mt=!cutoff||o.ts>=cutoff;
    return mq&&ms&&mt;
  });
  const todos=DB.orcamentos;
  const aprovados=todos.filter(o=>o.status==='aprovado');
  const pendentes=todos.filter(o=>o.status==='pendente');
  const recusados=todos.filter(o=>o.status==='recusado');
  const totalAprov=aprovados.reduce((s,o)=>s+o.total,0);
  const totalPend=pendentes.reduce((s,o)=>s+o.total,0);
  const taxaAprov=todos.length?((aprovados.length/todos.length)*100).toFixed(0):0;
  const metricsEl=document.getElementById('pedidos-metrics');
  if(metricsEl)metricsEl.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Total</div>
      <div style="font-size:26px;font-weight:800;color:var(--accent)">${todos.length}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid rgba(34,197,94,.3);border-radius:var(--r);padding:14px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Aprovados</div>
      <div style="font-size:26px;font-weight:800;color:var(--green)">${aprovados.length}</div>
      <div style="font-size:11px;color:var(--text3)">R$ ${totalAprov.toFixed(2)}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid rgba(234,179,8,.3);border-radius:var(--r);padding:14px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Pendentes</div>
      <div style="font-size:26px;font-weight:800;color:var(--yellow)">${pendentes.length}</div>
      <div style="font-size:11px;color:var(--text3)">R$ ${totalPend.toFixed(2)}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid rgba(239,68,68,.3);border-radius:var(--r);padding:14px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Recusados</div>
      <div style="font-size:26px;font-weight:800;color:var(--red)">${recusados.length}</div>
    </div>
    <div style="background:var(--bg2);border:1px solid rgba(59,130,246,.3);border-radius:var(--r);padding:14px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Taxa aprovação</div>
      <div style="font-size:26px;font-weight:800;color:var(--blue)">${taxaAprov}%</div>
    </div>`;
  const el=document.getElementById('pedidos-list');if(!el)return;
  if(!orcs.length){
    el.innerHTML=`<div style="background:var(--bg2);border:1px dashed var(--border2);border-radius:var(--r);padding:32px;text-align:center"><div style="font-size:28px;margin-bottom:8px">🗂</div><div style="font-size:14px;color:var(--text2);font-weight:500;margin-bottom:4px">Nenhum pedido encontrado</div><div style="font-size:12px;color:var(--text3)">Crie orçamentos para visualizá-los aqui</div></div>`;
    return;
  }
  const statusCores={pendente:'var(--yellow)',aprovado:'var(--green)',recusado:'var(--red)'};
  const statusLabel={pendente:'🕐 Pendente',aprovado:'✅ Aprovado',recusado:'✕ Recusado'};
  const statusBg={pendente:'rgba(234,179,8,.1)',aprovado:'rgba(34,197,94,.1)',recusado:'rgba(239,68,68,.1)'};
  el.innerHTML=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:2px solid var(--border)">
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">#</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Cliente</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Produto</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Total</th>
      <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Status</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Canal</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Data</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Produção</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Ações</th>
    </tr></thead>
    <tbody>${orcs.map(o=>{
      const pedidoFila=(DB.fila||[]).find(f=>f.orcamentoId===o.id);
      const filaStatus=pedidoFila?FILA_STATUS[pedidoFila.status]:{label:'—',cor:'var(--text3)'};
      return`<tr style="border-bottom:1px solid var(--border)" onmouseenter="this.style.background='rgba(255,255,255,.02)'" onmouseleave="this.style.background=''">
        <td style="padding:11px 14px;color:var(--text3);font-size:11px">${String(o.id).slice(-4)}</td>
        <td style="padding:11px 14px;font-weight:600">${o.clienteNome}</td>
        <td style="padding:11px 14px;color:var(--text2)">${o.produtoNome} × ${o.qtd}</td>
        <td style="padding:11px 14px;font-weight:700;color:var(--accent);text-align:right">R$ ${o.total.toFixed(2).replace('.',',')}</td>
        <td style="padding:11px 14px;text-align:center">
          <select data-change="mudarStatusPedido('${o.id}',this.value)" style="background:${statusBg[o.status]||'var(--bg3)'};border:1px solid ${statusCores[o.status]||'var(--border)'};border-radius:20px;padding:3px 10px;color:${statusCores[o.status]||'var(--text)'};font-size:11px;font-weight:700;outline:none;cursor:pointer">
            ${['pendente','aprovado','recusado'].map(s=>`<option value="${s}" ${esc(o.status===s?'selected':'')}>${statusLabel[s]}</option>`).join('')}
          </select>
        </td>
        <td style="padding:11px 14px;font-size:12px;color:var(--text2)">${o.marketplace||'—'}</td>
        <td style="padding:11px 14px;font-size:12px;color:var(--text3)">${o.data}</td>
        <td style="padding:11px 14px"><span style="font-size:11px;font-weight:700;color:${esc(filaStatus.cor)}">${filaStatus.label}</span></td>
        <td style="padding:11px 14px"><div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" data-click="verOrcamentoPDF('${o.id}')" title="PDF">📄</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--green)" data-click="wppOrcamento('${o.id}')" title="WhatsApp">📱</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--blue)" data-click="emailOrcamento('${o.id}')" title="Email">✉</button>
          ${pedidoFila?`<button class="btn btn-ghost btn-sm" style="color:var(--accent)" data-click="showPage('fila')" title="Ver na fila">🖨</button>`:''}
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>
  <div style="margin-top:10px;font-size:12px;color:var(--text3);display:flex;justify-content:space-between;align-items:center">
    <span>${orcs.length} pedido${orcs.length!==1?'s':''} · Total filtrado: R$ ${orcs.reduce((s,o)=>s+o.total,0).toFixed(2)}</span>
    <button class="btn btn-ghost btn-sm" data-click="exportarPedidosCSV()">⬇ CSV</button>
  </div>`;
}

function exportarPedidosCSV(){
  if(!DB.orcamentos||!DB.orcamentos.length){notify('Nenhum pedido para exportar','red');return;}
  const header='numero;cliente;produto;quantidade;preco_unit;desconto_pct;total;status;canal;data;validade;status_producao';
  const rows=DB.orcamentos.map(o=>{
    const pf=(DB.fila||[]).find(f=>f.orcamentoId===o.id);
    return[String(o.id).slice(-6),o.clienteNome,o.produtoNome,o.qtd,(o.preco||0).toFixed(2),(o.desc||0),(o.total||0).toFixed(2),o.status,o.marketplace||'',o.data,o.validade||'',pf?pf.status:'—']
      .map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(';');
  });
  const csv='\uFEFF'+header+'\n'+rows.join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='pedidos_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();notify('Pedidos exportados!');
}

/* ---
   RASTREIO RÁPIDO (disparado ao aprovar orçamento)
   --- */
function toggleRastreioOutro(){
  const val=document.getElementById('rastreio-transportadora').value;
  const obrigatorio=document.getElementById('rastreio-obrigatorio').value==='1';
  const semCodigo=['maos','retirada'];
  const codigoWrap=document.getElementById('rastreio-codigo-wrap');
  const codigoLabel=document.getElementById('rastreio-codigo-label');

  // Mostrar/ocultar campo de código
  if(semCodigo.includes(val)){
    codigoWrap.style.display='none';
    document.getElementById('rastreio-codigo').value='';
  } else {
    codigoWrap.style.display='';
    if(val==='uber')       codigoLabel.textContent='Código / ID do pedido Uber';
    else if(val==='99pop') codigoLabel.textContent='Código / ID do pedido 99Pop';
    else if(val==='outro') codigoLabel.textContent='Código de rastreio (opcional)';
    else                   codigoLabel.textContent='Código de rastreio';
  }

  // Campo "Outro personalizado"
  document.getElementById('rastreio-outro-wrap').style.display=val==='outro'?'':'none';

  // Aviso "pular" só aparece no modo opcional quando sem rastreio selecionado
  const aviso=document.getElementById('rastreio-aviso-pular');
  if(aviso) aviso.style.display=(!obrigatorio && val==='')?'block':'none';
}


function aplicarBandeira(tipo,adicional){
  const base=DB.config.kwhBase||(parseFloat(document.getElementById('cfg-kwh').value)||0.85);
  const novoValor=base+adicional;
  document.getElementById('cfg-kwh').value=novoValor.toFixed(4);
  DB.config.kwhBase=base;
  DB.config.kwh=novoValor;
  DB.config.bandeira=tipo;
  saveDB();
  const nomes={verde:'🟢 Verde (sem adicional)',amarela:'🟡 Amarela (+R$0,02)',vermelha1:'🔴 Vermelha 1 (+R$0,04)',vermelha2:'🔴 Vermelha 2 (+R$0,08)'};
  const el=document.getElementById('bandeira-atual');
  if(el)el.innerHTML=`<span style="color:var(--text2)">Bandeira: <strong>${nomes[tipo]}</strong> — kWh: R$ ${novoValor.toFixed(4)}</span>`;
  notify('Bandeira aplicada! kWh = R$ '+novoValor.toFixed(4));
}

/* ---
   TRANSPORTADORA OUTRO
   --- */
function toggleTranspOutro(){
  const val=document.getElementById('fp-transportadora').value;
  const wrap=document.getElementById('fp-transp-outro-wrap');
  if(wrap)wrap.style.display=val==='outro'?'':'none';
}

/* ---
   CRM VISTA LISTA/GRID
   --- */
function setCrmView(m){
  crmViewMode=m;
  const btnG=document.getElementById('crm-view-grid-btn');
  const btnL=document.getElementById('crm-view-lista-btn');
  if(btnG)btnG.style.cssText='padding:5px 12px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:600;'+(m==='grid'?'background:var(--accent);color:#fff':'background:transparent;color:var(--text2)');
  if(btnL)btnL.style.cssText='padding:5px 12px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:600;'+(m==='lista'?'background:var(--accent);color:#fff':'background:transparent;color:var(--text2)');
  renderCRM();
}



/* Item 25: ações da fila e do painel de pedidos (antes eram código solto no HTML). */
function abrirFilaPorId(id){ const i=(DB.fila||[]).find(x=>String(x.id)===String(id)); if(i) openFilaModal(i); }
function filtrarFilaStatus(s){
  const f=document.getElementById('fila-status-filter');
  f.value = f.value===s ? '' : s;
  renderFila();
}
function mudarStatusPedido(id, status){ updateOrcStatus(id,status); setTimeout(renderPedidos,100); }
