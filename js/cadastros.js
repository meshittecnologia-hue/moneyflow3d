/* MoneyFlow 3D — Produtos, filamentos, máquina e custos, relatório, comparar, modais e catálogo.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ── PRODUTOS ───────────────────────────────────────── */
function setViewMode(m){
  prodViewMode=m;
  document.getElementById('prod-view-lista').style.display=m==='lista'?'block':'none';
  document.getElementById('prod-view-grid').style.display=m==='grid'?'block':'none';
  document.getElementById('view-lista-btn').style.cssText='padding:5px 12px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:600;'+(m==='lista'?'background:var(--accent);color:#fff':'background:transparent;color:var(--text2)');
  document.getElementById('view-grid-btn').style.cssText='padding:5px 12px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:600;'+(m==='grid'?'background:var(--accent);color:#fff':'background:transparent;color:var(--text2)');
  renderProdutos();
}
function renderProdutos(){
  const q=(document.getElementById('prod-search')?.value||'').toLowerCase();
  const fm=document.getElementById('prod-filter-margem')?.value||'';
  let ps=[...DB.produtos];
  if(q) ps=ps.filter(p=>(p.nome||'').toLowerCase().includes(q)||(p.filamento||'').toLowerCase().includes(q));
  if(fm==='boa') ps=ps.filter(p=>p.margem>30);
  else if(fm==='media') ps=ps.filter(p=>p.margem>=15&&p.margem<=30);
  else if(fm==='baixa') ps=ps.filter(p=>p.margem<15);
  const totalProd=DB.produtos.length;
  const shownProd=ps.length;
  const ctrEl=document.getElementById('prod-counter');
  if(ctrEl){
    if(shownProd===totalProd) ctrEl.textContent=totalProd+' produto'+(totalProd!==1?'s':'');
    else ctrEl.innerHTML=`<span style="color:var(--accent);font-weight:600">${shownProd}</span> de <strong>${totalProd}</strong> produto${totalProd!==1?'s':''} exibido${shownProd!==1?'s':''}`;
  }
  if(prodViewMode==='lista'){
    const emptyEl=document.getElementById('prod-empty');
    if(emptyEl) emptyEl.style.display=ps.length?'none':'block';
    document.getElementById('prod-tbody').innerHTML=ps.map(p=>{
      const mc=p.margem>30?'badge-green':p.margem>15?'badge-yellow':'badge-red';
      return`<tr>
        <td style="font-weight:500">${esc(p.nome)}</td>
        <td style="color:var(--text2)">${esc(p.filamento)}</td>
        <td>R$ ${(p.custoTotal||0).toFixed(2)}</td>
        <td style="font-weight:600">R$ ${(p.precoBase||0).toFixed(2)}</td>
        <td><span class="badge ${mc}">${(p.margem||0).toFixed(1)}%</span></td>
        <td style="color:var(--text3)">${p.data}</td>
        <td><div style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" onclick="editarProduto('${p.id}')" title="Editar">✏</button><button class="btn btn-danger btn-sm" onclick="delProd('${p.id}')">✕</button></div></td>
      </tr>`;}).join('');
  } else {
    const mc2=(m)=>m>30?'var(--green)':m>15?'var(--yellow)':'var(--red)';
    const grid=document.getElementById('prod-grid');
    const empty2=document.getElementById('prod-empty-grid');
    if(!ps.length){grid.innerHTML='';empty2.style.display='block';return;}
    empty2.style.display='none';
    grid.innerHTML=ps.map(p=>`
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px">
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">${esc(p.nome)}</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">${esc(p.filamento)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:10px">
          <div style="color:var(--text3)">Custo</div><div>R$ ${(p.custoTotal||0).toFixed(2)}</div>
          <div style="color:var(--text3)">Preço</div><div style="font-weight:600;color:var(--accent)">R$ ${(p.precoBase||0).toFixed(2)}</div>
          <div style="color:var(--text3)">Margem</div><div style="font-weight:700;color:${mc2(p.margem)}">${(p.margem||0).toFixed(1)}%</div>
          <div style="color:var(--text3)">Data</div><div>${p.data}</div>
        </div>
        <div style="display:flex;gap:6px;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="criarOrcamentoProduto('${p.id}')">📄 Orçar</button>
          <button class="btn btn-ghost btn-sm" onclick="editarProduto('${p.id}')" title="Editar">✏</button>
          <button class="btn btn-danger btn-sm" onclick="delProd('${p.id}')">✕</button>
        </div>
      </div>`).join('');
  }
}
function criarOrcamentoProduto(id){
  const p=DB.produtos.find(x=>String(x.id)===String(id));if(!p)return;
  if(!DB.orcamentos)DB.orcamentos=[];
  showPage('orcamentos');
  setTimeout(()=>{
    openOrcModal();
    if(p){
      const container=document.getElementById('orc-itens-container');
      container.innerHTML='';
      addOrcItem(p.nome,1,p.precoBase||0);
    }
    calcOrcTotal();
  },100);
}

/* ── FILAMENTOS ─────────────────────────────────────── */
function renderFilamentos(){
  const q=(document.getElementById('fil-search')?.value||'').toLowerCase();
  const tipoFil=document.getElementById('fil-filter-tipo')?.value||'';
  const preco=document.getElementById('fil-filter-preco')?.value||'';
  // Ordenar por tipo → cor → nome (agrupamento natural)
  let fs=[...DB.filamentos].sort((a,b)=>{
    const t=(a.tipo||'').localeCompare(b.tipo||''); if(t!==0) return t;
    const c=(a.cor||'').localeCompare(b.cor||'');  if(c!==0) return c;
    return (a.nome||'').localeCompare(b.nome||'');
  });
  if(q) fs=fs.filter(f=>(f.nome||'').toLowerCase().includes(q)||(f.marca||'').toLowerCase().includes(q));
  if(tipoFil) fs=fs.filter(f=>f.tipo===tipoFil);
  if(preco==='com') fs=fs.filter(f=>f.custo>0);
  else if(preco==='sem') fs=fs.filter(f=>!f.custo||f.custo===0);
  const total=DB.filamentos.length;
  const shown=fs.length;
  const filCtr=document.getElementById('fil-counter');
  if(filCtr){
    if(shown===total){
      filCtr.textContent=total+' filamento'+(total!==1?'s':'');
    } else {
      filCtr.innerHTML=`<span style="color:var(--accent);font-weight:600">${shown}</span> de <strong>${total}</strong> filamento${total!==1?'s':''} exibido${shown!==1?'s':''}`;
    }
  }
  document.getElementById('fil-empty').style.display=shown?'none':'block';
  const FIL_BADGE={bg:'rgba(148,163,184,.15)',text:'#94a3b8'};
  document.getElementById('fil-tbody').innerHTML=fs.map(f=>{
    const corHex = (f.cor&&/^#[0-9A-Fa-f]{3,8}$/.test(f.cor)) ? f.cor : null;
    const dotBg = corHex || 'rgba(148,163,184,0.35)';
    const dotHtml = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${dotBg};border:1px solid rgba(0,0,0,.15);vertical-align:middle;margin-right:6px;flex-shrink:0"></span>`;
    return`<tr>
      <td style="font-weight:600">${dotHtml}${esc(f.nome)}</td>
      <td style="color:var(--text2)">${esc(f.marca||'—')}</td>
      <td style="color:var(--text2)">${corHex?`<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${corHex};border:1px solid rgba(0,0,0,.15)"></span>${esc(f.cor)}</span>`:f.cor||'—'}</td>
      <td><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${FIL_BADGE.bg};color:${FIL_BADGE.text}">${esc(f.tipo)}</span></td>
      <td>${f.custo>0?'R$ '+(f.custo/(f.peso/1000)).toFixed(2):'<span style="color:var(--accent);font-size:11px">cadastrar preço</span>'}</td>
      <td style="color:var(--text2)">${f.custo>0?'R$ '+(f.custo/f.peso).toFixed(4):'—'}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="editFil('${f.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="delFil('${f.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}
function syncColorPicker(){
  const hex=document.getElementById('mf-cor')?.value;
  const picker=document.getElementById('mf-cor-picker');
  if(picker&&hex&&/^#[0-9A-Fa-f]{6}$/.test(hex))picker.value=hex;
}

function delFil(id){
  if(!confirm('Excluir este filamento?'))return;
  DB.filamentos=DB.filamentos.filter(x=>String(x.id)!==String(id));
  saveDB();renderFilamentos();notify('Filamento removido','red');
}
function editFil(id){
  const f=DB.filamentos.find(x=>String(x.id)===String(id));if(!f)return;
  editFilId=id;
  document.getElementById('mf-nome').value=f.nome;
  document.getElementById('mf-marca').value=f.marca||'';
  document.getElementById('mf-cor').value=f.cor||'';
  const picker=document.getElementById('mf-cor-picker');
  if(picker&&f.cor&&f.cor.startsWith('#')&&f.cor.length===7)picker.value=f.cor;
  else if(picker)picker.value='#cccccc';
  document.getElementById('mf-tipo').value=f.tipo;
  document.getElementById('mf-custo').value=f.custo;
  document.getElementById('mf-peso').value=f.peso;
  document.getElementById('modal-fil').classList.add('open');
}

/* ── CONFIG ─────────────────────────────────────────── */
function renderConfig(){
  document.getElementById('cfg-kwh').value=DB.config.kwh;
  setTimeout(renderBioStatus,50);
  document.getElementById('imp-list').innerHTML=DB.impressoras.map(i=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <div style="font-weight:500">${esc(i.nome)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">R$ ${i.inv} | ROI ${i.roi}m | ${i.watts}W | ${i.hpd}h/dia | ${i.fail}% falhas</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="delImp('${i.id}')">Excluir</button>
    </div>`).join('')||'<div style="color:var(--text3);font-size:13px">Nenhuma impressora cadastrada</div>';
}

/* ── RELATÓRIO ──────────────────────────────────────── */
function baixarRelatorio(){
  const ps=DB.produtos;
  if(!ps.length){notify('Nenhum produto para exportar','red');return;}
  const header='Produto;Filamento;Custo (R$);Preço Base (R$);Margem (%);Markup (%);Data';
  const rows=ps.map(p=>`${p.nome};${p.filamento};${p.custoTotal.toFixed(2)};${p.precoBase.toFixed(2)};${p.margem.toFixed(1)};${p.markup.toFixed(0)};${p.data}`);
  const csv=[header,...rows].join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='relatorio_moneyflow3d_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  notify('Relatório exportado!');
}

function setP(d,btn){relP=d;document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderRelatorio();}
function renderRelatorio(){
  const ps=DB.produtos;
  const totalLiq=ps.reduce((a,b)=>a+(b.precoBase-b.custoTotal),0);
  const avgM=ps.length?(ps.reduce((a,b)=>a+b.markup,0)/ps.length).toFixed(0):0;
  document.getElementById('rel-metrics').innerHTML=`
    <div class="metric"><div class="metric-label">Produtos</div><div class="metric-value">${ps.length}</div></div>
    <div class="metric"><div class="metric-label">Lucro total (1/produto)</div><div class="metric-value green">R$ ${totalLiq.toFixed(2)}</div></div>
    <div class="metric"><div class="metric-label">Markup médio</div><div class="metric-value">${avgM}%</div></div>`;
  const sorted=[...ps].sort((a,b)=>(b.precoBase-b.custoTotal)-(a.precoBase-a.custoTotal));
  const maxL=sorted.length?Math.max(...sorted.map(x=>x.precoBase-x.custoTotal)):1;
  document.getElementById('rel-chart').innerHTML=sorted.map(p=>{
    const liq=p.precoBase-p.custoTotal;
    const c=p.margem>30?'#22c55e':p.margem>15?'#eab308':'#ef4444';
    return`<div class="bar-row"><div class="bar-label">${esc(p.nome)}</div><div class="bar-track"><div class="bar-fill" style="width:${(liq/maxL*100).toFixed(0)}%;background:${c}">R$ ${liq.toFixed(2)}</div></div><div class="bar-val">R$ ${liq.toFixed(2)}</div></div>`;
  }).join('')||'<div style="color:var(--text3);font-size:13px;padding:12px 0">Nenhum produto ainda</div>';
}

/* ── COMPARAR ───────────────────────────────────────── */
function renderComparar(){
  if(!DB.concorrentes)DB.concorrentes=[];
  const ps=DB.produtos;
  const concs=DB.concorrentes;
  // Populate product selector
  const selProd=document.getElementById('comp-sel-prod');
  const selConc=document.getElementById('comp-sel-conc');
  if(selProd){
    const curProd=selProd.value;
    selProd.innerHTML='<option value="">— Selecione um produto —</option>'+
      ps.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    if(curProd)selProd.value=curProd;
  }
  if(selConc){
    const curConc=selConc.value;
    selConc.innerHTML='<option value="">— Selecione um concorrente —</option>'+
      concs.map(c=>`<option value="${c.id}">${esc(c.nome)}${esc(c.loja?' ('+c.loja+')':'')}</option>`).join('');
    if(curConc)selConc.value=curConc;
  }
  renderConcList();
}
function updateComp(){ /* selects são usados em runBenchmarkSelecionado */ }
function renderCompResult(){ runBenchmarkSelecionado(); }
function runBenchmarkSelecionado(){
  const prodId=document.getElementById('comp-sel-prod')?.value;
  const concId=document.getElementById('comp-sel-conc')?.value;
  const el=document.getElementById('comp-result');
  if(!prodId||!concId){
    el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px 0;text-align:center">Selecione um produto e um concorrente para comparar</div>';
    return;
  }
  const p=DB.produtos.find(x=>String(x.id)===String(prodId));
  const c=DB.concorrentes.find(x=>String(x.id)===String(concId));
  if(!p||!c){el.innerHTML='';return;}
  // Reutilizar lógica de renderBenchmark com os dois selecionados
  compSel=[String(prodId)];
  _benchSingleConc=concId;
  renderBenchmark();
  _benchSingleConc=null;
}
let _benchSingleConc=null;

function renderBenchmark(){
  var meusProdutos = DB.produtos.filter(function(x){return compSel.includes(String(x.id));});
  var concorrentes = _benchSingleConc
    ? (DB.concorrentes||[]).filter(c=>String(c.id)===String(_benchSingleConc))
    : DB.concorrentes||[];
  var el = document.getElementById('comp-result');
  if(!meusProdutos.length && !concorrentes.length){el.innerHTML='';return;}
  if(!meusProdutos.length){el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px 0">Selecione um produto acima para ver o benchmark</div>';return;}
  if(!concorrentes.length){el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:12px 0">Cadastre um concorrente para ver o benchmark</div>';return;}

  var MPs_TAXA = {'Shopee':0.14,'Mercado Livre':0.115,'Amazon':0.15,'WhatsApp/Direto':0,'Pix / Direto':0,'Infinity Pay Créd.':0.1249,'Outro':0};
  var html = '';

  meusProdutos.forEach(function(p){
    concorrentes.forEach(function(c){
      var diff = p.precoBase - c.preco;
      var diffPct = c.preco>0 ? ((p.precoBase - c.preco)/c.preco*100) : 0;
      var taxaMP = MPs_TAXA[c.marketplace]||0;
      var lucroConc = c.preco - (c.preco * taxaMP);
      var lucroMeu = p.precoBase - p.custoTotal - (p.precoBase * taxaMP);
      var margemConc = c.preco>0 ? ((c.preco - (c.preco*taxaMP))/c.preco*100) : 0;
      var posLabel = diff>0 ? '📈 Mais caro' : diff<0 ? '📉 Mais barato' : '➡️ Mesmo preço';
      var posCor = diff>0 ? 'var(--yellow)' : diff<0 ? 'var(--red)' : 'var(--text2)';
      var diffAbs = Math.abs(diff).toFixed(2);
      var diffPctAbs = Math.abs(diffPct).toFixed(1);
      var sinal = diff>=0?'+':'-';
      var analise = '📊 Preço competitivo. Monitore o concorrente e mantenha a qualidade.';
      var corAnalise = 'var(--text2)';
      if(diff>0 && p.margem>30){analise='✅ Preço acima do concorrente com margem saudável. Justifique o valor com qualidade e atendimento.';corAnalise='var(--green)';}
      else if(diff>0 && p.margem<=30){analise='⚠️ Preço acima do concorrente mas margem baixa. Considere reduzir custos ou ajustar o preço.';corAnalise='var(--yellow)';}
      else if(diff<0 && p.margem>30){analise='🏆 Preço abaixo do concorrente com boa margem. Excelente posicionamento competitivo.';corAnalise='var(--green)';}
      else if(diff<0 && p.margem<=15){analise='🚨 Preço abaixo do concorrente e margem crítica. Você pode estar vendendo com prejuízo.';corAnalise='var(--red)';}
      var precoSug = c.preco * 0.95;
      var margemSug = p.custoTotal>0 ? ((precoSug - p.custoTotal - precoSug*taxaMP)/precoSug*100) : 0;
      var corMargemMeu = p.margem>30?'var(--green)':p.margem>15?'var(--yellow)':'var(--red)';
      var corLucroMeu = lucroMeu>0?'var(--green)':'var(--red)';

      html += '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px">';
      // Header
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border)">';
      html += '<div>';
      html += '<div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Benchmark</div>';
      html += '<div style="font-size:15px;font-weight:700">'+p.nome+' <span style="color:var(--text3);font-weight:400">vs</span> '+c.nome+'</div>';
      html += '<div style="font-size:12px;color:var(--text3);margin-top:2px">'+(c.loja||'')+(c.marketplace?' · '+c.marketplace:'')+'</div>';
      html += '</div>';
      html += '<div style="text-align:right">';
      html += '<div style="font-size:11px;color:'+posCor+';font-weight:700">'+posLabel+'</div>';
      html += '<div style="font-size:13px;color:'+posCor+';margin-top:2px">'+sinal+' R$ '+diffAbs+' ('+sinal+diffPctAbs+'%)</div>';
      html += '</div></div>';
      // Cards lado a lado
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
      // Meu produto
      html += '<div style="background:var(--bg3);border-radius:8px;padding:14px;border-left:3px solid var(--accent)">';
      html += '<div style="font-size:10px;color:var(--accent);font-weight:700;text-transform:uppercase;margin-bottom:10px">Seu produto</div>';
      html += '<div style="display:flex;flex-direction:column;gap:7px;font-size:13px">';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Preço</span><span style="font-weight:700">R$ '+p.precoBase.toFixed(2)+'</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Custo</span><span>R$ '+p.custoTotal.toFixed(2)+'</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Lucro líq.</span><span style="color:'+corLucroMeu+'">R$ '+lucroMeu.toFixed(2)+'</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Margem</span><span style="font-weight:700;color:'+corMargemMeu+'">'+p.margem.toFixed(1)+'%</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Markup</span><span>'+p.markup.toFixed(0)+'%</span></div>';
      html += '</div></div>';
      // Concorrente
      html += '<div style="background:var(--bg3);border-radius:8px;padding:14px;border-left:3px solid var(--border)">';
      html += '<div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:10px">Concorrente</div>';
      html += '<div style="display:flex;flex-direction:column;gap:7px;font-size:13px">';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Preço</span><span style="font-weight:700">R$ '+c.preco.toFixed(2)+'</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Custo</span><span style="color:var(--text3)">Desconhecido</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Receita liq.</span><span>R$ '+lucroConc.toFixed(2)+'</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Margem MP</span><span>'+margemConc.toFixed(1)+'%</span></div>';
      html += '<div style="display:flex;justify-content:space-between"><span style="color:var(--text3)">Marketplace</span><span>'+(c.marketplace||'—')+'</span></div>';
      html += '</div></div></div>';
      // Análise
      html += '<div style="background:var(--bg);border-radius:8px;padding:12px 14px;margin-bottom:12px;border-left:3px solid '+corAnalise+'">';
      html += '<div style="font-size:12px;color:'+corAnalise+';font-weight:600;margin-bottom:3px">Análise de posicionamento</div>';
      html += '<div style="font-size:13px;color:var(--text2)">'+analise+'</div>';
      html += '</div>';
      // Sugestão
      if(c.preco>0 && margemSug>10){
        html += '<div style="background:var(--bg);border-radius:8px;padding:12px 14px;margin-bottom:12px;border-left:3px solid var(--blue)">';
        html += '<div style="font-size:12px;color:var(--blue);font-weight:600;margin-bottom:3px">💡 Sugestão de preço competitivo</div>';
        html += '<div style="font-size:13px;color:var(--text2)">Vender a <strong style="color:var(--blue)">R$ '+precoSug.toFixed(2)+'</strong> (5% abaixo do concorrente) geraria margem de <strong>'+margemSug.toFixed(1)+'%</strong>'+(margemSug<15?' — margem baixa, verifique se vale a pena':' — margem saudável')+'.</div>';
        html += '</div>';
      }
      // Link
      if(c.url){html += '<div style="margin-top:6px"><a href="'+c.url+'" target="_blank" style="font-size:12px;color:var(--accent);text-decoration:none">🔗 Ver produto do concorrente ↗</a></div>';}
      html += '</div>';
    });
  });
  el.innerHTML = html;
}

function openConcModal(){
  document.getElementById('mc-nome').value='';
  document.getElementById('mc-loja').value='';
  document.getElementById('mc-url').value='';
  document.getElementById('mc-preco').value=0;
  document.getElementById('mc-obs').value='';
  document.getElementById('modal-conc').classList.add('open');
}
let _concView = 'lista';
let _concCollapsed = {};
function setConcView(v){
  _concView = v;
  const bl = document.getElementById('conc-btn-lista');
  const bb = document.getElementById('conc-btn-blocos');
  if(bl) bl.style.cssText = 'padding:4px 10px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:600;'+(v==='lista'?'background:var(--accent);color:#fff':'background:transparent;color:var(--text2)');
  if(bb) bb.style.cssText = 'padding:4px 10px;border-radius:4px;border:none;cursor:pointer;font-size:12px;font-weight:600;'+(v==='blocos'?'background:var(--accent);color:#fff':'background:transparent;color:var(--text2)');
  renderConcList();
}
function toggleConcCard(id){
  _concCollapsed[id] = !_concCollapsed[id];
  renderConcList();
}
function renderConcList(){
  if(!DB.concorrentes)DB.concorrentes=[];
  const cs=DB.concorrentes;
  document.getElementById('conc-empty').style.display=cs.length?'none':'block';
  if(!cs.length){ document.getElementById('conc-list').innerHTML=''; return; }
  if(_concView==='blocos'){
    document.getElementById('conc-list').innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:4px">' +
      cs.map(function(conc){
        const col = _concCollapsed[conc.id];
        const obsHtml = (!col&&conc.obs)?'<div style="font-size:11px;color:var(--text3);margin-top:4px">'+conc.obs+'</div>':'';
        const urlHtml = (!col&&conc.url)?'<a href="'+conc.url+'" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;margin-top:6px;display:inline-block">\u{1F517} Ver produto</a>':'';
        const metaHtml = (!col&&(conc.loja||conc.mp))?'<div style="font-size:11px;color:var(--text2);margin-top:2px">'+(conc.loja||'')+(conc.mp?' \u00B7 '+conc.mp:'')+'</div>':'';
        const btnToggle = '<button class="btn btn-ghost btn-sm" style="padding:2px 7px;font-size:11px" onclick="toggleConcCard(\''+conc.id+'\')">'+(col?'\u25BC':'\u25B2')+'</button>';
        const btnDel = '<button class="btn btn-danger btn-sm" onclick="delConc(\''+conc.id+'\')">\u2715</button>';
        return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
          +'<div style="font-weight:600;font-size:13px;flex:1;line-height:1.3">'+conc.nome+'</div>'
          +'<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">'+btnToggle+btnDel+'</div>'
          +'</div>'
          +'<div style="font-size:20px;font-weight:700;color:var(--text);margin-top:8px">R$ '+conc.preco.toFixed(2)+'</div>'
          +metaHtml+obsHtml+urlHtml
          +'</div>';
      }).join('')
      + '</div>';
  } else {
    document.getElementById('conc-list').innerHTML = cs.map(function(conc){
      const col = _concCollapsed[conc.id];
      const obsHtml = (!col&&conc.obs)?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+conc.obs+'</div>':'';
      const urlHtml = (!col&&conc.url)?'<a href="'+conc.url+'" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;margin-top:2px;display:inline-block">\u{1F517} Ver produto</a>':'';
      const metaHtml = (!col)?'<div style="font-size:12px;color:var(--text2)">'+(conc.loja||'')+(conc.mp?' \u00B7 '+conc.mp:'')+'</div>':'';
      const btnToggle = '<button class="btn btn-ghost btn-sm" style="padding:2px 7px;font-size:11px" onclick="toggleConcCard(\''+conc.id+'\')">'+(col?'\u25BC':'\u25B2')+'</button>';
      const btnDel = '<button class="btn btn-danger btn-sm" onclick="delConc(\''+conc.id+'\')">\u2715</button>';
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border);gap:10px">'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-weight:600;color:var(--text);margin-bottom:2px">'+conc.nome+'</div>'
        +metaHtml+obsHtml+urlHtml
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
        +'<div style="font-size:18px;font-weight:700;color:var(--text)">R$ '+conc.preco.toFixed(2)+'</div>'
        +btnToggle+btnDel
        +'</div></div>';
    }).join('');
  }
}

async function delConc(id){
  const {error}=await _supa.from('competitors').delete().eq('id',id);
  if(error){notify('Erro: '+error.message,'red');return;}
  DB.concorrentes=DB.concorrentes.filter(x=>String(x.id)!==String(id));
  renderConcList();renderBenchmark();notify('Removido','red');
}

/* ── MODALS ─────────────────────────────────────────── */
function openImpModal(origin){
  impOrigin=origin;
  document.getElementById('mi-nome').value='';
  document.getElementById('mi-inv').value=9500;
  document.getElementById('mi-roi').value=18;
  document.getElementById('mi-watts').value=350;
  document.getElementById('mi-hpd').value=8;
  document.getElementById('mi-fail').value=5;
  document.getElementById('modal-imp').classList.add('open');
}
function openFilModal(origin){
  filOrigin=origin;editFilId=null;
  document.getElementById('mf-nome').value='';
  document.getElementById('mf-marca').value='';
  document.getElementById('mf-cor').value='';
  const picker=document.getElementById('mf-cor-picker');if(picker)picker.value='#cccccc';
  document.getElementById('mf-tipo').value='PLA';
  document.getElementById('mf-custo').value=120;
  document.getElementById('mf-peso').value=1000;
  document.getElementById('modal-fil').classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}



/* ── CATÁLOGO ────────────────────────────────────────── */
let catalogoDB = [];

function renderCatalogo(){
  // A tela do catálogo foi removida do HTML; sem os elementos, não renderiza (evita erro silencioso).
  if(!document.getElementById('cat-grid')||!document.getElementById('cat-empty')||!document.getElementById('cat-search')){
    console.warn('renderCatalogo: tela do catálogo não existe no HTML');
    return;
  }
  const q=(document.getElementById('cat-search').value||'').toLowerCase();
  const items=DB.catalogos||[];
  const filtered=q?items.filter(x=>(x.nome||'').toLowerCase().includes(q)||(x.categoria||'').toLowerCase().includes(q)):items;
  const grid=document.getElementById('cat-grid');
  const empty=document.getElementById('cat-empty');
  if(!filtered.length){grid.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  grid.innerHTML=filtered.map(p=>{
    const mc=p.margem>30?'var(--green)':p.margem>15?'var(--yellow)':'var(--red)';
    return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div style="font-weight:600;font-size:14px;color:var(--text)">${esc(p.nome)}</div>
        <span class="badge badge-blue">${esc(p.categoria||'Geral')}</span>
      </div>
      ${p.descricao?`<div style="font-size:12px;color:var(--text2);margin-bottom:10px">${esc(p.descricao)}</div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div style="color:var(--text3)">Custo</div><div style="font-weight:500">R$ ${(p.custoTotal||0).toFixed(2)}</div>
        <div style="color:var(--text3)">Preço</div><div style="font-weight:600;color:var(--accent)">R$ ${(p.precoBase||0).toFixed(2)}</div>
        <div style="color:var(--text3)">Margem</div><div style="font-weight:600;color:${mc}">${(p.margem||0).toFixed(1)}%</div>
        <div style="color:var(--text3)">Filamento</div><div>${esc(p.filamento||'—')}</div>
        ${p.marketplace?`<div style="color:var(--text3)">Marketplace</div><div>${p.marketplace}</div>`:''}
      </div>
      <div style="margin-top:10px;display:flex;justify-content:flex-end">
        <button class="btn btn-danger btn-sm" onclick="delCatalogo('${p.id}')">✕ Remover</button>
      </div>
    </div>`;
  }).join('');
}

function delCatalogo(id){
  if(!confirm('Remover do catálogo?'))return;
  DB.catalogos=(DB.catalogos||[]).filter(x=>String(x.id)!==String(id));
  saveDB();renderCatalogo();notify('Removido','red');
}

