/* MoneyFlow 3D — Módulo 1: orçamentos com PDF e WhatsApp, automação para a fila.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ---
   MÓDULO 1 — ORÇAMENTOS com PDF + WhatsApp
   --- */

function addOrcItem(nome='', qtd=1, preco=0){
  const container=document.getElementById('orc-itens-container');
  const row=document.createElement('div');
  row.className='orc-item-row';
  row.style.cssText='display:grid;grid-template-columns:1fr 56px 90px 70px 28px;gap:4px;align-items:center;margin-bottom:6px';
  row.innerHTML=`<input class="orc-item-nome" value="${nome.replace(/"/g,'&quot;')}" placeholder="Nome do item" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rsm);padding:6px 8px;color:var(--text);font-size:12px;width:100%" oninput="calcOrcTotal()">`
    +`<input type="number" class="orc-item-qtd" value="${qtd}" min="1" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rsm);padding:6px 6px;color:var(--text);font-size:12px;width:100%;text-align:center" oninput="calcOrcTotal()">`
    +`<input type="number" class="orc-item-preco" value="${preco||''}" placeholder="0.00" step="0.01" min="0" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rsm);padding:6px 8px;color:var(--text);font-size:12px;width:100%;text-align:right" oninput="calcOrcTotal()">`
    +`<span class="orc-item-sub" style="font-size:12px;color:var(--text2);text-align:right">—</span>`
    +`<button type="button" onclick="this.closest('.orc-item-row').remove();calcOrcTotal()" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:15px;padding:0;line-height:1;width:28px;text-align:center">✕</button>`;
  container.appendChild(row);
  calcOrcTotal();
}

function getOrcItens(){
  return Array.from(document.querySelectorAll('.orc-item-row')).map(row=>({
    nome:(row.querySelector('.orc-item-nome').value||'').trim()||'Item',
    qtd:parseInt(row.querySelector('.orc-item-qtd').value)||1,
    preco:parseFloat(row.querySelector('.orc-item-preco').value)||0
  }));
}

function openOrcModal(){
  if(!DB.orcamentos)DB.orcamentos=[];
  orcAtual=null;
  const sc=document.getElementById('orc-cliente');
  sc.innerHTML='<option value="">Sem cliente</option>'+(DB.clientes||[]).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  const sp=document.getElementById('orc-produto');
  sp.innerHTML='<option value="">Selecionar produto salvo (opcional)</option>'+(DB.produtos||[]).map(p=>`<option value="${p.id}">${esc(p.nome)} — R$${p.precoBase?p.precoBase.toFixed(2):'0.00'}</option>`).join('');
  document.getElementById('orc-itens-container').innerHTML='';
  addOrcItem();
  document.getElementById('orc-desc').value=0;
  document.getElementById('orc-total').value='R$ 0,00';
  document.getElementById('orc-obs').value='';
  const v=new Date();v.setDate(v.getDate()+7);
  document.getElementById('orc-validade').value=v.toISOString().slice(0,10);
  document.getElementById('modal-orc').classList.add('open');
}

function preencherOrcProduto(){
  const pid=document.getElementById('orc-produto').value;
  const p=DB.produtos.find(x=>String(x.id)===String(pid));
  if(!p)return;
  const container=document.getElementById('orc-itens-container');
  const rows=container.querySelectorAll('.orc-item-row');
  const lastRow=rows[rows.length-1];
  if(lastRow){
    const nomeIn=lastRow.querySelector('.orc-item-nome');
    const precoIn=lastRow.querySelector('.orc-item-preco');
    if(!nomeIn.value.trim()&&!precoIn.value){
      nomeIn.value=p.nome;
      precoIn.value=(p.precoBase||0).toFixed(2);
      calcOrcTotal();return;
    }
  }
  addOrcItem(p.nome,1,p.precoBase||0);
}

function calcOrcTotal(){
  const itens=getOrcItens();
  const desc=parseFloat(document.getElementById('orc-desc').value)||0;
  const subtotal=itens.reduce((s,i)=>s+i.qtd*i.preco,0);
  const total=subtotal*(1-desc/100);
  document.querySelectorAll('.orc-item-row').forEach(row=>{
    const qtd=parseInt(row.querySelector('.orc-item-qtd').value)||1;
    const preco=parseFloat(row.querySelector('.orc-item-preco').value)||0;
    row.querySelector('.orc-item-sub').textContent='R$'+(qtd*preco).toFixed(2).replace('.',',');
  });
  document.getElementById('orc-total').value='R$ '+total.toFixed(2).replace('.',',');
  return total;
}


function renderOrcamentos(){
  if(!DB.orcamentos)DB.orcamentos=[];
  const q=(document.getElementById('orc-search')||{}).value?.toLowerCase()||'';
  const sf=(document.getElementById('orc-status-filter')||{}).value||'';
  let orcs=DB.orcamentos.filter(o=>{
    const mq=!q||o.clienteNome.toLowerCase().includes(q)||o.produtoNome.toLowerCase().includes(q);
    const ms=!sf||o.status===sf;
    return mq&&ms;
  });
  const statusCores={pendente:'var(--yellow)',aprovado:'var(--green)',recusado:'var(--red)'};
  const statusLabel={pendente:'Pendente',aprovado:'Aprovado',recusado:'Recusado'};
  const el=document.getElementById('orc-list');
  if(!orcs.length){el.innerHTML='<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">Nenhum orçamento ainda</div><div class="empty-sub">Crie um orçamento para gerar PDF e enviar pelo WhatsApp</div></div>';return;}
  el.innerHTML=`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:1px solid var(--border)">
      <th style="padding:10px 14px;font-size:11px;color:var(--text3);text-align:left;font-weight:700;text-transform:uppercase">Cliente</th>
      <th style="padding:10px 14px;font-size:11px;color:var(--text3);text-align:left;font-weight:700;text-transform:uppercase">Produto</th>
      <th style="padding:10px 14px;font-size:11px;color:var(--text3);text-align:left;font-weight:700;text-transform:uppercase">Total</th>
      <th style="padding:10px 14px;font-size:11px;color:var(--text3);text-align:left;font-weight:700;text-transform:uppercase">Status</th>
      <th style="padding:10px 14px;font-size:11px;color:var(--text3);text-align:left;font-weight:700;text-transform:uppercase">Data</th>
      <th style="padding:10px 14px;font-size:11px;color:var(--text3);text-align:left;font-weight:700;text-transform:uppercase">Ações</th>
    </tr></thead>
    <tbody>${orcs.map(o=>`
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:12px 14px;font-size:13px;font-weight:600">${esc(o.clienteNome)}</td>
        <td style="padding:12px 14px;font-size:13px;color:var(--text2)">${o.itensErro?'<span title="Itens ilegíveis: confira antes de enviar" style="color:var(--red)">⚠ </span>':''}${esc(o.produtoNome)} × ${o.qtd}</td>
        <td style="padding:12px 14px;font-size:13px;font-weight:700;color:var(--accent)">R$ ${o.total.toFixed(2).replace('.',',')}</td>
        <td style="padding:12px 14px">
          <select onchange="updateOrcStatus('${o.id}',this.value)" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:${statusCores[o.status]||'var(--text)'};font-size:12px;outline:none">
            ${['pendente','aprovado','recusado'].map(s=>`<option value="${s}" ${esc(o.status===s?'selected':'')}>${statusLabel[s]}</option>`).join('')}
          </select>
        </td>
        <td style="padding:12px 14px;font-size:12px;color:var(--text3)">${o.data}</td>
        <td style="padding:12px 14px">
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="verOrcamentoPDF('${o.id}')" title="Gerar PDF">📄 PDF</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--green);border-color:rgba(34,197,94,.3)" onclick="wppOrcamento('${o.id}')" title="WhatsApp">📱 WPP</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--blue);border-color:rgba(59,130,246,.3)" onclick="emailOrcamento('${o.id}')" title="E-mail">✉ Email</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--accent);border-color:rgba(255,107,43,.3)" onclick="editarOrcamento('${o.id}')" title="Editar">✏ Editar</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red);border-color:rgba(239,68,68,.3)" onclick="delOrcamento('${o.id}')" title="Remover">✕</button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function delProd(id){DB.produtos=DB.produtos.filter(x=>String(x.id)!==String(id));saveDB();renderProdutos();notify('Removido','red');}

function editarProduto(id){
  const p=DB.produtos.find(x=>String(x.id)===String(id));
  if(!p)return;
  document.getElementById('ep-id').value=id;
  document.getElementById('ep-nome').value=p.nome||'';
  document.getElementById('ep-custo').value=(p.custoTotal||0).toFixed(2);
  document.getElementById('ep-preco').value=(p.precoBase||0).toFixed(2);
  document.getElementById('ep-markup').value=(p.markup||0).toFixed(1);
  document.getElementById('ep-margem').value=(p.margem||0).toFixed(1)+'%';
  document.getElementById('modal-edit-prod').classList.add('open');
}

function recalcEpMargem(){
  const custo=parseFloat(document.getElementById('ep-custo').value)||0;
  const preco=parseFloat(document.getElementById('ep-preco').value)||0;
  const margem=preco>0?((preco-custo)/preco*100):0;
  document.getElementById('ep-margem').value=margem.toFixed(1)+'%';
}

async function salvarEdicaoProduto(){
  const id=document.getElementById('ep-id').value;
  const nome=document.getElementById('ep-nome').value.trim()||'Produto sem nome';
  const custo=parseFloat(document.getElementById('ep-custo').value)||0;
  const preco=parseFloat(document.getElementById('ep-preco').value)||0;
  const markup=parseFloat(document.getElementById('ep-markup').value)||0;
  const margem=preco>0?((preco-custo)/preco*100):0;
  const {error}=await _supa.from('products').update({
    name:nome, cost_total:custo, price_base:preco, markup:markup, margin:margem
  }).eq('id',id);
  if(error){notify('Erro ao salvar: '+error.message,'red');return;}
  DB.produtos=DB.produtos.map(p=>String(p.id)===String(id)?{...p,nome,custoTotal:custo,precoBase:preco,markup,margem}:p);
  saveDB();
  closeModal('modal-edit-prod');
  renderProdutos();
  notify('Produto atualizado!');
}

function editarOrcamento(id){
  const o=DB.orcamentos.find(x=>String(x.id)===String(id));
  if(!o)return;
  orcAtual=null;
  const sc=document.getElementById('orc-cliente');
  sc.innerHTML='<option value="">Sem cliente</option>'+(DB.clientes||[]).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  const sp=document.getElementById('orc-produto');
  sp.innerHTML='<option value="">Selecionar produto salvo (opcional)</option>'+(DB.produtos||[]).map(p=>`<option value="${p.id}">${esc(p.nome)} — R$${p.precoBase?p.precoBase.toFixed(2):'0.00'}</option>`).join('');
  document.getElementById('orc-cliente').value=o.clienteId||'';
  // Carregar itens no container
  document.getElementById('orc-itens-container').innerHTML='';
  if(o.itens&&o.itens.length){
    o.itens.forEach(item=>addOrcItem(item.nome,item.qtd,item.preco));
  } else {
    addOrcItem(o.produtoNome||'',o.qtd||1,o.preco||0);
  }
  document.getElementById('orc-desc').value=o.desc||0;
  document.getElementById('orc-obs').value=o.obs||'';
  if(o.validade)document.getElementById('orc-validade').value=o.validade;
  const mpSel=document.getElementById('orc-mp');
  if(o.marketplace){for(let i=0;i<mpSel.options.length;i++){if(mpSel.options[i].value===o.marketplace){mpSel.selectedIndex=i;break;}}}
  calcOrcTotal();
  document.getElementById('modal-orc').dataset.editId=id;
  document.getElementById('modal-orc').querySelector('.modal-title').textContent='Editar orçamento';
  document.getElementById('modal-orc').classList.add('open');
}


/* ── AUTOMAÇÃO: orçamento aprovado → fila de produção ── */

function emailOrcamento(id){
  orcAtual=DB.orcamentos.find(x=>String(x.id)===String(id));
  if(!orcAtual)return;
  enviarEmail();
}


function verOrcamentoPDF(id){
  const o=DB.orcamentos.find(x=>String(x.id)===String(id));if(!o)return;
  orcAtual=o;
  const s=getSettings();
  const empresa=s.empresa||'MoneyFlow 3D';
  const sysname=s.sysname||'MoneyFlow 3D';
  const logoSrc=s.logo||'';
  const valStr=o.validade?new Date(o.validade).toLocaleDateString('pt-BR'):'—';
  const logoHtml=logoSrc?`<img src="${esc(logoSrc)}" crossorigin="anonymous" style="max-height:50px;max-width:160px;object-fit:contain;margin-bottom:8px"><br>`:'';

  document.getElementById('pdf-preview-content').innerHTML=`
    <div id="pdf-body" style="font-family:sans-serif;font-size:13px;color:#111;padding:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #f97316;padding-bottom:14px">
        <div>${logoHtml}<div style="font-size:17px;font-weight:800;color:#f97316">${sysname}</div><div style="font-size:12px;color:#666">${empresa}</div></div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:800;color:#111">ORÇAMENTO</div>
          <div style="font-size:12px;color:#666">Nº ${String(o.id).slice(-6)}</div>
          <div style="font-size:12px;color:#666">Data: ${o.data}</div>
          <div style="font-size:12px;color:#666">Válido até: ${valStr}</div>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:6px">Cliente</div>
        <div style="font-size:14px;font-weight:700">${o.clienteNome}</div>
        ${o.clienteWpp?`<div style="font-size:12px;color:#555">WhatsApp: ${o.clienteWpp}</div>`:''}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead><tr style="background:#f4f4f4">
          <th style="padding:8px 12px;text-align:left;font-size:12px;border:1px solid #ddd">Produto / Serviço</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;border:1px solid #ddd">Qtd</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;border:1px solid #ddd">Preço unit.</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;border:1px solid #ddd">Subtotal</th>
        </tr></thead>
        <tbody>${(o.itens&&o.itens.length?o.itens:[{nome:o.produtoNome,qtd:o.qtd,preco:o.preco}]).map(item=>`<tr>
          <td style="padding:10px 12px;border:1px solid #ddd;font-weight:600;color:#111">${esc(item.nome)}</td>
          <td style="padding:10px 12px;border:1px solid #ddd;text-align:center;color:#111">${item.qtd}</td>
          <td style="padding:10px 12px;border:1px solid #ddd;text-align:right;color:#111">R$ ${(item.preco||0).toFixed(2).replace('.',',')}</td>
          <td style="padding:10px 12px;border:1px solid #ddd;text-align:right;font-weight:700;color:#111">R$ ${((item.qtd||1)*(item.preco||0)).toFixed(2).replace('.',',')}</td>
        </tr>`).join('')}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <div style="text-align:right">
          ${o.desc>0?`<div style="font-size:12px;color:#888">Subtotal: R$ ${(o.total/(1-o.desc/100)).toFixed(2).replace('.',',')} — Desconto ${esc(o.desc)}%</div>`:''}
          <div style="font-size:12px;color:#888">Canal de venda: ${o.marketplace}</div>
          <div style="font-size:20px;font-weight:800;color:#f97316">Total: R$ ${o.total.toFixed(2).replace('.',',')}</div>
        </div>
      </div>
      ${o.obs?`<div style="background:#fff8f3;border:1px solid #f97316;border-radius:6px;padding:10px 14px;font-size:12px;color:#555"><strong>Observações:</strong> ${esc(o.obs)}</div>`:''}
      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center">
        Orçamento gerado por ${sysname} • ${empresa} • Válido até ${valStr}
      </div>
    </div>`;
  document.getElementById('modal-pdf-preview').classList.add('open');
}

function exportarPDF(){
  if(!orcAtual){notify('Nenhum orçamento selecionado','red');return;}
  if(typeof window.jspdf==='undefined'&&typeof jsPDF==='undefined'){
    notify('jsPDF não carregado. Tente novamente em 2s.','red');return;
  }
  const {jsPDF}=window.jspdf||{jsPDF:window.jsPDF};
  const doc=new jsPDF({orientation:'p',unit:'mm',format:'a4'});
  const s=getSettings();
  const empresa=s.empresa||'MoneyFlow 3D';
  const sysname=s.sysname||'MoneyFlow 3D';
  const o=orcAtual;
  const valStr=o.validade?new Date(o.validade).toLocaleDateString('pt-BR'):'—';
  const itens=o.itens&&o.itens.length?o.itens:[{nome:o.produtoNome||'Item',qtd:o.qtd||1,preco:o.preco||0}];

  // Header laranja
  doc.setFillColor(249,115,22);
  doc.rect(0,0,210,28,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(18);doc.setFont(undefined,'bold');
  doc.text(sysname,14,16);
  doc.setFontSize(10);doc.setFont(undefined,'normal');
  doc.text(empresa,14,23);
  doc.setFontSize(14);doc.setFont(undefined,'bold');
  doc.text('ORÇAMENTO',196,12,{align:'right'});
  doc.setFontSize(9);doc.setFont(undefined,'normal');
  doc.text('Nº '+String(o.id).slice(-6),196,18,{align:'right'});
  doc.text('Data: '+o.data,196,24,{align:'right'});

  // Cliente
  doc.setTextColor(0,0,0);
  doc.setFontSize(9);doc.setFont(undefined,'bold');
  doc.text('CLIENTE',14,38);
  doc.setDrawColor(249,115,22);doc.setLineWidth(0.5);
  doc.line(14,40,196,40);
  doc.setFont(undefined,'normal');doc.setFontSize(11);
  doc.text(o.clienteNome,14,47);
  if(o.clienteWpp){doc.setFontSize(9);doc.setTextColor(100,100,100);doc.text('WhatsApp: '+o.clienteWpp,14,53);}

  // Tabela de itens
  doc.setTextColor(0,0,0);doc.setFontSize(9);doc.setFont(undefined,'bold');
  doc.text('ITENS DO ORÇAMENTO',14,62);
  doc.setDrawColor(249,115,22);doc.line(14,64,196,64);
  // cabeçalho
  doc.setFillColor(244,244,244);doc.rect(14,65,182,8,'F');
  doc.setFontSize(8);doc.setTextColor(80,80,80);
  doc.text('Produto/Serviço',16,71);
  doc.text('Qtd',118,71,{align:'center'});
  doc.text('Preço unit.',152,71,{align:'right'});
  doc.text('Subtotal',194,71,{align:'right'});

  // Linhas de itens dinamicamente
  let y=73;
  doc.setFont(undefined,'normal');doc.setFontSize(9);doc.setTextColor(0,0,0);
  itens.forEach((item,idx)=>{
    y+=9;
    const subtotal=(item.qtd||1)*(item.preco||0);
    const nome=String(item.nome||'Item').slice(0,48);
    doc.text(nome,16,y);
    doc.text(String(item.qtd||1),118,y,{align:'center'});
    doc.text('R$'+(item.preco||0).toFixed(2),152,y,{align:'right'});
    doc.setFont(undefined,'bold');
    doc.text('R$'+subtotal.toFixed(2),194,y,{align:'right'});
    doc.setFont(undefined,'normal');
    if(idx<itens.length-1){
      doc.setDrawColor(230,230,230);doc.setLineWidth(0.2);
      doc.line(14,y+3,196,y+3);
    }
  });

  y+=5;
  doc.setDrawColor(220,220,220);doc.setLineWidth(0.5);doc.line(14,y,196,y);

  // Desconto e total
  y+=3;
  if(o.desc>0){
    const subtotalBruto=itens.reduce((s,i)=>s+(i.qtd||1)*(i.preco||0),0);
    doc.setFontSize(9);doc.setFont(undefined,'normal');doc.setTextColor(100,100,100);
    doc.text('Subtotal: R$'+subtotalBruto.toFixed(2)+'  |  Desconto: '+o.desc+'%',194,y+6,{align:'right'});
    y+=8;
  }

  // Caixa total
  doc.setFillColor(255,248,243);doc.rect(130,y+2,66,10,'F');
  doc.setDrawColor(249,115,22);doc.rect(130,y+2,66,10,'S');
  doc.setFontSize(11);doc.setFont(undefined,'bold');doc.setTextColor(249,115,22);
  doc.text('TOTAL: R$'+o.total.toFixed(2),194,y+9,{align:'right'});

  // Canal + obs
  y+=16;
  doc.setTextColor(0,0,0);doc.setFontSize(9);doc.setFont(undefined,'normal');
  doc.text('Canal de venda: '+o.marketplace,14,y);
  if(o.obs){
    y+=6;
    doc.setFontSize(8);doc.setTextColor(100,100,100);
    const obsWrapped=doc.splitTextToSize('Observações: '+o.obs,170);
    doc.text(obsWrapped,14,y);
  }

  // Rodapé
  doc.setFontSize(8);doc.setTextColor(150,150,150);
  doc.text('Orçamento gerado por '+sysname+' • '+empresa+' • Válido até '+valStr,105,280,{align:'center'});

  doc.save('orcamento_'+String(o.id).slice(-6)+'_'+o.clienteNome.replace(/\s/g,'_')+'.pdf');
  notify('PDF baixado!');
}

function wppOrcamento(id){
  const o=DB.orcamentos.find(x=>String(x.id)===String(id))||orcAtual;if(!o)return;
  verOrcamentoPDF(o.id);
  setTimeout(()=>compartilharWhatsApp(),200);
}

function compartilharWhatsApp(){
  const o=orcAtual;if(!o){notify('Nenhum orçamento aberto','red');return;}
  const s=getSettings();
  const empresa=s.empresa||'MoneyFlow 3D';
  const valStr=o.validade?new Date(o.validade).toLocaleDateString('pt-BR'):'—';
  const itensMsg=(o.itens&&o.itens.length?o.itens:[{nome:o.produtoNome,qtd:o.qtd,preco:o.preco}]).map(i=>`• ${i.nome} x${i.qtd} — R$ ${((i.qtd||1)*(i.preco||0)).toFixed(2).replace('.',',')}`).join('\n');
  const msg=`*ORÇAMENTO — ${empresa}*\n\nOlá ${o.clienteNome}! 👋\n\n📦 *Itens:*\n${itensMsg}\n${o.desc>0?`🏷 *Desconto:* ${o.desc}%\n`:''}\n💰 *TOTAL: R$ ${o.total.toFixed(2).replace('.',',')}*\n\n🛒 *Canal:* ${o.marketplace}\n📅 *Válido até:* ${valStr}\n${o.obs?`\n📝 *Obs:* ${o.obs}\n`:''}\n_Gerado por ${s.sysname||'MoneyFlow 3D'}_`;
  const num=o.clienteWpp?o.clienteWpp.replace(/\D/g,''):'';
  const url=`https://wa.me/${num?'55'+num:''}?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
  notify('Abrindo WhatsApp...');
}

function enviarEmail(){
  const o=orcAtual;if(!o){notify('Nenhum orçamento aberto','red');return;}
  const s=getSettings();
  const empresa=s.empresa||'MoneyFlow 3D';
  const sysname=s.sysname||'MoneyFlow 3D';
  const valStr=o.validade?new Date(o.validade).toLocaleDateString('pt-BR'):'—';
  // Buscar email do cliente
  const cli=DB.clientes.find(c=>c.id==o.clienteId);
  const emailDest=cli&&cli.email?cli.email:'';
  const assunto=`Orçamento ${empresa} — ${o.produtoNome}`;
  const corpo=`Olá ${o.clienteNome},\n\nSegue seu orçamento:\n\nProduto: ${o.produtoNome}\nQuantidade: ${o.qtd}\nValor unitário: R$ ${o.preco.toFixed(2)}\n${o.desc>0?`Desconto: ${o.desc}%\n`:''}TOTAL: R$ ${o.total.toFixed(2)}\n\nCanal: ${o.marketplace}\nVálido até: ${valStr}\n${o.obs?`\nObservações: ${o.obs}\n`:''}\nQualquer dúvida, entre em contato.\n\nAtenciosamente,\n${empresa} — ${sysname}`;
  const url=`mailto:${emailDest}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  window.open(url,'_self');
  notify('Abrindo cliente de e-mail...');
}

