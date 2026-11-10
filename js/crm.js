/* MoneyFlow 3D — Módulo 2: CRM de clientes.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ---
   MÓDULO 2 — CRM DE CLIENTES
   --- */
function openClienteModal(cli){
  document.getElementById('modal-cliente-title').textContent=cli?'Editar cliente':'Novo cliente';
  document.getElementById('cli-id').value=cli?cli.id:'';
  document.getElementById('cli-nome').value=cli?cli.nome:'';
  document.getElementById('cli-wpp').value=cli?cli.wpp:'';
  document.getElementById('cli-insta').value=cli?cli.insta:'';
  document.getElementById('cli-email').value=cli?cli.email:'';
  document.getElementById('cli-obs').value=cli?cli.obs:'';
  document.getElementById('modal-cliente').classList.add('open');
}



function exportarClientesCSV(){
  if(!DB.clientes||!DB.clientes.length){notify('Nenhum cliente para exportar','red');return;}
  const header='nome;whatsapp;instagram;email;observacoes;orcamentos;total_gasto';
  const rows=DB.clientes.map(c=>{
    const orcCount=(DB.orcamentos||[]).filter(o=>o.clienteId==c.id).length;
    const totalGasto=(DB.orcamentos||[]).filter(o=>o.clienteId==c.id&&o.status==='aprovado').reduce((s,o)=>s+o.total,0);
    return[c.nome,c.wpp||'',c.insta||'',c.email||'',c.obs||'',orcCount,totalGasto.toFixed(2)].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';');
  });
  const csv='\uFEFF'+header+'\n'+rows.join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='clientes_precoexato3d_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();notify('Clientes exportados!');
}

function abrirDetalheCliente(id){
  crmDetalheId=id;
  const c=DB.clientes.find(x=>String(x.id)===String(id));if(!c)return;
  const orcs=(DB.orcamentos||[]).filter(o=>o.clienteId==id).sort((a,b)=>b.ts-a.ts);
  const pedidos=(DB.fila||[]).filter(f=>f.clienteId==id).sort((a,b)=>b.ts-a.ts);
  const totalGasto=orcs.filter(o=>o.status==='aprovado').reduce((s,o)=>s+o.total,0);
  const statusCor={pendente:'var(--yellow)',aprovado:'var(--green)',recusado:'var(--red)'};

  document.getElementById('crm-detalhe-body').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:20px">
      <div>
        <div style="font-size:20px;font-weight:800">${esc(c.nome)}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px">
          ${c.wpp?`<a href="https://wa.me/55${c.wpp.replace(/\D/g,'')}" target="_blank" style="color:var(--green);font-size:13px;text-decoration:none">📱 ${esc(c.wpp)}</a>`:''}
          ${c.email?`<a href="mailto:${esc(c.email)}" style="color:var(--blue);font-size:13px;text-decoration:none">✉ ${esc(c.email)}</a>`:''}
          ${c.insta?`<span style="color:var(--text2);font-size:13px">📸 ${c.insta}</span>`:''}
        </div>
        ${c.obs?`<div style="font-size:12px;color:var(--text3);margin-top:6px;font-style:italic">${esc(c.obs)}</div>`:''}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" data-click="abrirClientePorId('${c.id}')">✏ Editar</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
      <div style="background:var(--bg3);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--accent)">${orcs.length}</div>
        <div style="font-size:11px;color:var(--text3)">Orçamentos</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--blue)">${pedidos.filter(p=>p.status!=='entregue').length}</div>
        <div style="font-size:11px;color:var(--text3)">Em produção</div>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--green)">R$${totalGasto.toFixed(2)}</div>
        <div style="font-size:11px;color:var(--text3)">Total aprovado</div>
      </div>
    </div>

    ${orcs.length?`
    <div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em">Orçamentos</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${orcs.map(o=>`
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:6px;padding:10px 14px;flex-wrap:wrap;gap:6px">
            <div>
              <div style="font-size:13px;font-weight:600">${o.produtoNome}</div>
              <div style="font-size:11px;color:var(--text3)">${o.data} · ${o.marketplace}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:13px;font-weight:700;color:var(--accent)">R$ ${o.total.toFixed(2)}</span>
              <span style="font-size:11px;font-weight:700;color:${statusCor[o.status]||'var(--text3)'}">${esc(o.status.toUpperCase())}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>`:''}

    ${pedidos.length?`
    <div>
      <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.05em">Produção</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${pedidos.map(p=>{
          const st=FILA_STATUS[p.status]||{label:p.status,cor:'var(--text3)'};
          return`<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:6px;padding:10px 14px;flex-wrap:wrap;gap:6px">
            <div>
              <div style="font-size:13px;font-weight:600">${esc(p.produto)}</div>
              <div style="font-size:11px;color:var(--text3)">Qtd: ${p.qtd} · ${p.criado}</div>
              ${p.rastreio?`<div style="font-size:11px;color:var(--accent);cursor:pointer" data-click="abrirRastreio('${p.transportadora||''}','${p.rastreio}')">📦 ${p.rastreio} ↗</div>`:''}
            </div>
            <span style="font-size:12px;font-weight:700;color:${esc(st.cor)}">${st.label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`:''}

    ${!orcs.length&&!pedidos.length?`<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Nenhuma interação registrada ainda</div>`:''}
  `;
  document.getElementById('modal-crm-detalhe').classList.add('open');
}

function renderCRM(){
  if(!DB.clientes)DB.clientes=[];
  const q=(document.getElementById('crm-search')||{}).value?.toLowerCase()||'';
  let clientes=DB.clientes.filter(c=>!q||c.nome.toLowerCase().includes(q)||(c.wpp||'').includes(q)||(c.email||'').toLowerCase().includes(q));
  const el=document.getElementById('crm-list');

  // Header com stats e exportar
  const totalClientes=DB.clientes.length;
  const comOrc=new Set((DB.orcamentos||[]).map(o=>o.clienteId).filter(Boolean)).size;
  const statsHtml=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
    <div style="display:flex;gap:16px;flex:1">
      <div style="font-size:12px;color:var(--text3)">${totalClientes} cliente${totalClientes!==1?'s':''} · ${comOrc} com orçamento</div>
    </div>
    <button class="btn btn-ghost btn-sm" data-click="exportarClientesCSV()">⬇ Exportar CSV</button>
  </div>`;

  if(!clientes.length){
    el.innerHTML=statsHtml+`<div style="background:var(--bg2);border:1px dashed var(--border2);border-radius:var(--r);padding:32px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">👥</div>
      <div style="font-size:14px;color:var(--text2);font-weight:500;margin-bottom:4px">Nenhum cliente cadastrado</div>
      <div style="font-size:12px;color:var(--text3)">Cadastre clientes para vincular a orçamentos e pedidos</div>
    </div>`;
    return;
  }
  el.innerHTML=statsHtml+(crmViewMode==='lista'?renderCRMLista(clientes):renderCRMGrid(clientes));
}

function renderCRMGrid(clientes){
  return`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">${clientes.map(c=>{
    const orcCount=(DB.orcamentos||[]).filter(o=>o.clienteId==c.id).length;
    const filaCount=(DB.fila||[]).filter(f=>f.clienteId==c.id&&f.status!=='entregue').length;
    const totalGasto=(DB.orcamentos||[]).filter(o=>o.clienteId==c.id&&o.status==='aprovado').reduce((s,o)=>s+o.total,0);
    const ultimoOrc=(DB.orcamentos||[]).filter(o=>o.clienteId==c.id).sort((a,b)=>b.ts-a.ts)[0];
    const instaUrl=c.insta?'https://instagram.com/'+c.insta.replace('@',''):'';
    return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px;transition:border-color .15s" onmouseenter="this.style.borderColor='var(--accent)'" onmouseleave="this.style.borderColor='var(--border)'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;margin-bottom:3px">${esc(c.nome)}</div>
          ${c.wpp?`<div style="font-size:12px;color:var(--text3)">📱 ${c.wpp}</div>`:''}
          ${c.email?`<div style="font-size:12px;color:var(--text3)">✉ ${esc(c.email)}</div>`:''}
          ${c.insta?`<a href="${instaUrl}" target="_blank" style="font-size:12px;color:#e1306c;text-decoration:none;display:block">📸 ${c.insta}</a>`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-ghost btn-sm" data-click="event.stopPropagation();abrirClientePorId('${c.id}')" title="Editar">✏</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-click="event.stopPropagation();delCliente('${c.id}')" title="Remover">✕</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;border-top:1px solid var(--border);padding-top:10px;margin-bottom:10px">
        <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--accent)">${orcCount}</div><div style="font-size:10px;color:var(--text3)">Orçamentos</div></div>
        <div style="text-align:center"><div style="font-size:18px;font-weight:700;color:var(--blue)">${filaCount}</div><div style="font-size:10px;color:var(--text3)">Em produção</div></div>
        <div style="text-align:center"><div style="font-size:13px;font-weight:700;color:var(--green)">R$${totalGasto.toFixed(0)}</div><div style="font-size:10px;color:var(--text3)">Aprovado</div></div>
      </div>
      ${ultimoOrc?`<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Último orçamento: ${ultimoOrc.data}</div>`:''}
      ${c.obs?`<div style="font-size:11px;color:var(--text3);margin-bottom:8px;font-style:italic">${esc(c.obs)}</div>`:''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" style="flex:1" data-click="abrirDetalheCliente('${c.id}')">📋 Histórico</button>
        ${c.wpp?`<button class="btn btn-ghost btn-sm" style="color:var(--green)" data-click="abrirWppCliente('${c.id}')" title="WhatsApp">📱</button>`:''}
        ${c.email?`<button class="btn btn-ghost btn-sm" style="color:var(--blue)" data-click="abrirEmailCliente('${c.id}')" title="E-mail">✉</button>`:''}
        ${c.insta?`<a href="${instaUrl}" target="_blank" class="btn btn-ghost btn-sm" style="color:#e1306c" title="Instagram">📸</a>`:''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderCRMLista(clientes){
  const instaUrlFn=insta=>insta?'https://instagram.com/'+insta.replace('@',''):'';
  return`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="border-bottom:2px solid var(--border)">
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Nome</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">WhatsApp</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Instagram</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">E-mail</th>
      <th style="padding:10px 14px;text-align:center;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Orç.</th>
      <th style="padding:10px 14px;text-align:right;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Total</th>
      <th style="padding:10px 14px;text-align:left;font-size:11px;color:var(--text3);font-weight:700;text-transform:uppercase">Ações</th>
    </tr></thead>
    <tbody>${clientes.map(c=>{
      const orcCount=(DB.orcamentos||[]).filter(o=>o.clienteId==c.id).length;
      const totalGasto=(DB.orcamentos||[]).filter(o=>o.clienteId==c.id&&o.status==='aprovado').reduce((s,o)=>s+o.total,0);
      const instaUrl=instaUrlFn(c.insta);
      return`<tr style="border-bottom:1px solid var(--border)" onmouseenter="this.style.background='rgba(255,255,255,.02)'" onmouseleave="this.style.background=''">
        <td style="padding:11px 14px;font-weight:600">${esc(c.nome)}${c.obs?`<div style="font-size:11px;color:var(--text3);font-weight:400;font-style:italic">${esc(c.obs)}</div>`:''}</td>
        <td style="padding:11px 14px">${c.wpp?`<a href="https://wa.me/55${c.wpp.replace(/\D/g,'')}" target="_blank" style="color:var(--green);text-decoration:none">📱 ${esc(c.wpp)}</a>`:'—'}</td>
        <td style="padding:11px 14px">${c.insta?`<a href="${instaUrl}" target="_blank" style="color:#e1306c;text-decoration:none">📸 ${c.insta}</a>`:'—'}</td>
        <td style="padding:11px 14px">${c.email?`<a href="mailto:${esc(c.email)}" style="color:var(--blue);text-decoration:none">✉ ${esc(c.email)}</a>`:'—'}</td>
        <td style="padding:11px 14px;text-align:center;font-weight:700;color:var(--accent)">${orcCount}</td>
        <td style="padding:11px 14px;text-align:right;font-weight:700;color:var(--green)">R$ ${totalGasto.toFixed(2)}</td>
        <td style="padding:11px 14px"><div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" data-click="abrirDetalheCliente('${c.id}')" title="Histórico">📋</button>
          <button class="btn btn-ghost btn-sm" data-click="abrirClientePorId('${c.id}')" title="Editar">✏</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-click="delCliente('${c.id}')" title="Remover">✕</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}



/* Item 25: ações dos botões do CRM pelo id (antes iam como código e objeto escritos no HTML). */
function clientePorId(id){ return (DB.clientes||[]).find(c=>String(c.id)===String(id)); }
function abrirClientePorId(id){ const c=clientePorId(id); if(c) openClienteModal(c); }
function abrirWppCliente(id){
  const c=clientePorId(id); if(!c||!c.wpp) return;
  window.open('https://wa.me/55'+String(c.wpp).replace(/\D/g,''),'_blank','noopener');
}
function abrirEmailCliente(id){
  const c=clientePorId(id); if(!c||!c.email) return;
  window.open('mailto:'+encodeURIComponent(c.email).replace(/%40/g,'@'));
}
