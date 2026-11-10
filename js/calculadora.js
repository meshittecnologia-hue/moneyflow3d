/* MoneyFlow 3D — Calculadora de precificação (etapas), seletor de filamento e dashboard.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ── CALC STEPS ─────────────────────────────────────── */
function goStep(n){
  [1,2,3,4].forEach(i=>{
    document.getElementById('s'+i).style.display=i===n?'block':'none';
    const s=document.getElementById('cstep'+i);
    s.classList.toggle('active',i===n);
    if(i<n)s.classList.add('done');else s.classList.remove('done');
  });
  if(n===4)renderResult();
}

function setModo(m){
  modo=m;
  document.getElementById('tv').classList.toggle('active',m==='v');
  document.getElementById('ta').classList.toggle('active',m==='a');
  document.getElementById('c-markup').value=m==='v'?200:100;
  document.getElementById('c-mhint').textContent=m==='v'?'Varejo: 150–300%':'Atacado: 80–150%';
  calcRT();
}

function gv(id){return parseFloat(document.getElementById(id).value)||0;}

function calcCustos(){
  const impId=parseInt(document.getElementById('c-imp').value||0);
  const imp=DB.impressoras.find(x=>x.id===impId)||DB.impressoras[0]||{inv:9500,roi:18,watts:350,hpd:8,fail:5};
  const kwh=DB.config.kwh;
  const grams=gv('c-grams');
  const filId=parseInt(document.getElementById('c-fil').value||0);
  const fil=DB.filamentos.find(x=>x.id===filId);
  const fkg=fil&&fil.custo>0?(fil.custo/(fil.peso/1000)):120;
  const emb=gv('c-emb'),ins=gv('c-ins');
  const printH=gv('c-th')+gv('c-tm')/60+gv('c-ts')/3600;
  const hora=gv('c-hora'),tman=gv('c-tman'),markup=gv('c-markup')/100;
  const horasMes=imp.hpd*25;
  const deprH=imp.roi>0?(imp.inv/(imp.roi*horasMes)):0;
  const energiaH=(imp.watts/1000)*kwh;
  const maquina=(deprH+energiaH)*printH;
  const fail=maquina*(imp.fail/100);
  const filamento=(grams/1000)*fkg;
  const mo=hora*(tman/60);
  const total=maquina+fail+filamento+emb+ins+mo;
  const base=total*(1+markup);
  const desconto=gv('c-desconto')/100;
  const baseFinal=base*(1-desconto);
  return{total,base,baseFinal,maquina,fail,filamento,emb,ins,mo,markup,desconto,printH};
}

function calcRT(){if(document.getElementById('s4').style.display==='block')renderResult();}

let priceTog='sug';
function setPriceTog(t){
  priceTog=t;
  document.getElementById('ptog-sug').classList.toggle('active',t==='sug');
  document.getElementById('ptog-final').classList.toggle('active',t==='final');
  if(lastCalc.base){
    const displayBase=priceTog==='final'?lastCalc.baseFinal:lastCalc.base;
    renderMPGrid(displayBase, lastCalc.total);
  }
}

function renderResult(){
  const r=calcCustos();lastCalc=r;
  const displayBase=priceTog==='final'?r.baseFinal:r.base;
  renderMPGrid(displayBase,r.total);
  renderCustos(r);
  // AllMP always shows both prices side by side
  renderAllMP(r.base,r.total,r.baseFinal,r.desconto);
}

// Item 25: clique no marketplace (antes era código solto no HTML).
function escolherMarketplace(id, base, total){
  selMP=id; renderMPGrid(base,total); renderBreakdown(base,total,lastCalc);
}

function renderMPGrid(base,total){
  document.getElementById('c-mpgrid').innerHTML=MPs.map(mp=>`
    <div class="mp-btn ${mp.id===selMP?'active':''}" data-click="escolherMarketplace('${mp.id}',${base},${total})">
      <div class="mp-name">${esc(mp.name)}</div>
      <div class="mp-fee">${mp.fee>0?(mp.fee*100).toFixed(2)+'%':'0%'}</div>
    </div>`).join('');
  renderBreakdown(base,total,lastCalc);
}

function renderBreakdown(base,total,r){
  r=r||lastCalc;
  const mp=MPs.find(x=>x.id===selMP);
  const taxa=base*mp.fee,liq=base-total-taxa;
  const ml=base>0?(liq/base*100):0;
  const c=ml>25?'#22c55e':ml>10?'#eab308':'#ef4444';
  document.getElementById('c-price').textContent='R$ '+base.toFixed(2);
  document.getElementById('c-price-label').textContent=priceTog==='final'?'Preço final (com desconto)':'Preço sugerido';
  const discRow=document.getElementById('c-discount-row');
  if(r&&r.desconto>0&&priceTog==='final'){
    discRow.style.display='block';
    document.getElementById('c-price-orig').textContent='R$ '+r.base.toFixed(2);
    document.getElementById('c-discount-pct').textContent='-'+(r.desconto*100).toFixed(1)+'% desconto';
  } else { discRow.style.display='none'; }
  document.getElementById('c-breakdown').innerHTML=`
    <div class="br-row"><span class="br-label">Custo unitário</span><span class="br-val-red">- R$ ${total.toFixed(2)}</span></div>
    ${r&&r.desconto>0&&priceTog==='final'?`<div class="br-row"><span class="br-label">Desconto (${(r.desconto*100).toFixed(1)}%)</span><span class="br-val-red">- R$ ${(r.base-base).toFixed(2)}</span></div>`:''}
    <div class="br-row"><span class="br-label">Taxa ${esc(mp.name)} (${(mp.fee*100).toFixed(2)}%)</span><span class="br-val-red">- R$ ${taxa.toFixed(2)}</span></div>
    <div class="br-row"><span class="br-label">Lucro líquido</span><span class="br-val-green">R$ ${liq.toFixed(2)}</span></div>`;
  document.getElementById('c-mperc').textContent=ml.toFixed(1)+'%';
  document.getElementById('c-mperc').style.color=c;
  const bar=document.getElementById('c-mbar');
  bar.style.width=Math.min(Math.max(ml,0),100)+'%';bar.style.background=c;
}

function renderCustos(r){
  const itens=[
    {l:'Máquina + energia',v:r.maquina+r.fail},
    {l:'Filamento',v:r.filamento},
    {l:'Embalagem',v:r.emb},
    {l:'Insumos extras',v:r.ins},
    {l:'Mão de obra',v:r.mo},
  ].filter(x=>x.v>0);
  const max=Math.max(...itens.map(x=>x.v),0.01);
  const cols=['#ff6b2b','#3b82f6','#22c55e','#eab308','#a855f7'];
  document.getElementById('c-custos').innerHTML=itens.map((it,i)=>`
    <div class="bar-row">
      <div class="bar-label">${it.l}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(it.v/max*100).toFixed(0)}%;background:${cols[i%cols.length]}">${it.v>0.5?'R$'+it.v.toFixed(2):''}</div></div>
      <div class="bar-val">R$ ${it.v.toFixed(2)}</div>
    </div>`).join('')||'<div style="color:var(--text3);font-size:13px">Preencha os dados</div>';
}

function renderAllMP(base,total,baseFinal,desconto){
  baseFinal=baseFinal||base;
  desconto=desconto||0;
  document.getElementById('c-allmp').innerHTML=MPs.map(function(mp){
    var liq=base-total-base*mp.fee, ml=base>0?(liq/base*100):0;
    var liqF=baseFinal-total-baseFinal*mp.fee, mlF=baseFinal>0?(liqF/baseFinal*100):0;
    var col=ml>25?'var(--green)':ml>10?'var(--yellow)':'var(--red)';
    var colF=mlF>25?'var(--green)':mlF>10?'var(--yellow)':'var(--red)';
    var valStr;
    if(desconto>0){
      valStr='<span style="color:var(--text3);font-size:11px;text-decoration:line-through">R$ '+liq.toFixed(2)+'</span>'
            +'<span style="color:'+colF+';font-weight:700;font-size:13px;margin-left:6px">'+mlF.toFixed(1)+'% R$ '+liqF.toFixed(2)+'</span>';
    } else {
      valStr='<span style="color:'+col+';font-weight:700;font-size:13px">'+ml.toFixed(1)+'% R$ '+liq.toFixed(2)+'</span>';
    }
    return '<div class="br-row"><span class="br-label">'+mp.name+'</span><div style="text-align:right">'+valStr+'</div></div>';
  }).join('');
}


function populateSelects(){
  // Preencher o select hidden (mantém compatibilidade com calcRT)
  const fs=document.getElementById('c-fil');
  const cv=fs.value;
  fs.innerHTML='<option value="">Selecione</option>'+DB.filamentos.map(f=>`<option value="${f.id}">${esc(f.nome)} — ${esc(f.marca)} (${esc(f.tipo)})${f.custo>0?' R$'+(f.custo/(f.peso/1000)).toFixed(0)+'/kg':' — sem preço'}</option>`).join('');
  if(cv)fs.value=cv;else if(DB.filamentos.length)fs.value=DB.filamentos[0].id;
  // Atualizar label visual do picker
  filPickerSync();
  // Preencher impressoras
  const is=document.getElementById('c-imp');
  const ci=is.value;
  is.innerHTML='<option value="">Selecione</option>'+DB.impressoras.map(i=>`<option value="${i.id}">${esc(i.nome)}</option>`).join('');
  if(ci)is.value=ci;else if(DB.impressoras.length)is.value=DB.impressoras[0].id;
}

/* ── FIL-PICKER: select com busca ─────────────────── */
function filPickerSync(){
  const fs=document.getElementById('c-fil');
  const label=document.getElementById('fil-picker-label');
  if(!fs||!label)return;
  const sel=fs.options[fs.selectedIndex];
  if(sel&&sel.value){
    label.textContent=sel.text;
    label.style.color='var(--text)';
  } else {
    label.textContent='Selecione um filamento...';
    label.style.color='var(--text3)';
  }
}

function toggleFilPicker(){
  const drop=document.getElementById('fil-picker-drop');
  if(!drop)return;
  const aberto=drop.style.display!=='none';
  if(aberto){drop.style.display='none';return;}
  drop.style.display='block';
  filPickerRenderList('');
  setTimeout(()=>{
    const inp=document.getElementById('fil-picker-search');
    if(inp){inp.value='';inp.focus();}
  },50);
}

function filPickerSearch(){
  const q=document.getElementById('fil-picker-search').value.toLowerCase();
  filPickerRenderList(q);
}

function filPickerRenderList(q){
  const list=document.getElementById('fil-picker-list');if(!list)return;
  const fs=document.getElementById('c-fil');
  const opts=[...fs.options].filter(o=>o.value&&(!q||o.text.toLowerCase().includes(q)));
  if(!opts.length){
    list.innerHTML='<div style="padding:12px 14px;font-size:13px;color:var(--text3)">Nenhum filamento encontrado</div>';
    return;
  }
  // Agrupar por tipo
  const grupos={};
  opts.forEach(o=>{
    const f=DB.filamentos.find(x=>x.id==o.value);
    const tipo=f?f.tipo:'Outros';
    if(!grupos[tipo])grupos[tipo]=[];
    grupos[tipo].push({value:o.value,text:o.text,selected:o.selected});
  });
  const FIL_COLORS={PLA:'#3b82f6','PLA+':'#06b6d4',ABS:'#22c55e',PETG:'#f97316',TPU:'#eab308',ASA:'#a855f7',PA:'#ef4444',PC:'#64748b',Outros:'#888'};
  list.innerHTML=Object.entries(grupos).map(([tipo,itens])=>`
    <div style="padding:4px 14px 2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${FIL_COLORS[tipo]||'#888'};background:var(--bg2);border-top:1px solid var(--border)">${tipo}</div>
    ${itens.map(i=>`
      <div class="hover-fundo" data-click="filPickerSelect('${i.value}')" style="padding:9px 14px;font-size:13px;cursor:pointer;color:var(--text);${i.selected?'background:var(--bg3);font-weight:600;color:var(--accent)':''}">${i.text}</div>`).join('')}
  `).join('');
}

function filPickerSelect(value){
  const fs=document.getElementById('c-fil');
  fs.value=value;
  filPickerSync();
  document.getElementById('fil-picker-drop').style.display='none';
  calcRT();
}

// Fechar picker ao clicar fora
document.addEventListener('click',function(e){
  const wrap=document.getElementById('fil-picker-wrap');
  if(wrap&&!wrap.contains(e.target)){
    const drop=document.getElementById('fil-picker-drop');
    if(drop)drop.style.display='none';
  }
});

/* ── DASHBOARD ──────────────────────────────────────── */
function renderDashboard(){
  document.getElementById('dash-date').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const ps=DB.produtos;
  const avgM=ps.length?(ps.reduce((a,b)=>a+b.margem,0)/ps.length).toFixed(1):0;
  const best=ps.length?ps.reduce((a,b)=>a.margem>b.margem?a:b):null;
  const mc=avgM>30?'green':avgM>15?'yellow':'red';
  const fila=DB.fila||[];
  const pedidosAtivos=fila.filter(x=>!['entregue','cancelado'].includes(x.status)).length;
  const pedidosProntos=fila.filter(x=>x.status==='pronto'||x.status==='ag_envio').length;
  const pedidosImprimindo=fila.filter(x=>x.status==='imprimindo'||x.status==='fatiando').length;
  const pedidosAguardando=fila.filter(x=>x.status==='aguardando').length;
  document.getElementById('dash-metrics').innerHTML=`
    <div class="metric"><div class="metric-label">Produtos</div><div class="metric-value">${ps.length}</div></div>
    <div class="metric"><div class="metric-label">Margem média</div><div class="metric-value ${mc}">${avgM}%</div></div>
    <div class="metric"><div class="metric-label">Melhor produto</div><div class="metric-value" style="font-size:14px;line-height:1.3">${best?best.nome:'—'}</div></div>
    <div class="metric"><div class="metric-label">Filamentos</div><div class="metric-value">${DB.filamentos.length}</div></div>
    <div class="metric"><div class="metric-label">Pedidos ativos</div><div class="metric-value ${pedidosAtivos>0?'yellow':''}">${pedidosAtivos}</div></div>
    <div class="metric" data-click="showPage('fila')" style="cursor:pointer" title="Ver fila"><div class="metric-label">Aguardando</div><div class="metric-value">${pedidosAguardando}</div></div>
    <div class="metric" data-click="showPage('fila')" style="cursor:pointer" title="Ver fila"><div class="metric-label">Imprimindo</div><div class="metric-value blue">${pedidosImprimindo}</div></div>
    <div class="metric" data-click="showPage('fila')" style="cursor:pointer" title="Ver fila"><div class="metric-label">Prontos/Envio</div><div class="metric-value green">${pedidosProntos}</div></div>`;
  const sorted=[...ps].sort((a,b)=>b.margem-a.margem).slice(0,6);
  const maxM=sorted.length?Math.max(...sorted.map(x=>x.margem)):1;
  document.getElementById('dash-chart').innerHTML=sorted.length?sorted.map(p=>{
    const c=p.margem>30?'#22c55e':p.margem>15?'#eab308':'#ef4444';
    return`<div class="bar-row"><div class="bar-label">${esc(p.nome)}</div><div class="bar-track"><div class="bar-fill" style="width:${(p.margem/maxM*100).toFixed(0)}%;background:${c}">${p.margem.toFixed(1)}%</div></div><div class="bar-val">${p.margem.toFixed(1)}%</div></div>`;
  }).join(''):'<div style="color:var(--text3);font-size:13px;padding:12px 0;text-align:center">Nenhum produto ainda</div>';
  document.getElementById('dash-recentes').innerHTML=ps.slice(0,5).map(p=>`
    <div class="br-row"><span class="br-label">${esc(p.nome)}</span><span style="font-size:12px;color:var(--text2)">R$ ${p.precoBase.toFixed(2)}</span></div>`).join('')||'<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhum produto ainda</div>';
}

