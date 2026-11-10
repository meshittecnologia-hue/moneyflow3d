/* MoneyFlow 3D — Módulo 3: estoque de filamentos.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ---
   MÓDULO 3 — ESTOQUE DE FILAMENTOS
   --- */
function openEstoqueModal(item){
  // Popular select de filamentos
  const sf=document.getElementById('est-fil-id');
  sf.innerHTML='<option value="">Selecione</option>'+DB.filamentos.map(f=>`<option value="${f.id}">${esc(f.nome)} — ${esc(f.tipo)}</option>`).join('');
  if(item){
    document.getElementById('modal-estoque-title').textContent='Editar estoque';
    document.getElementById('est-edit-id').value=item.id;
    sf.value=item.filId;
    document.getElementById('est-qtd').value=item.qtd;
    document.getElementById('est-min').value=item.min;
    document.getElementById('est-obs').value=item.obs||'';
  } else {
    document.getElementById('modal-estoque-title').textContent='Registrar entrada';
    document.getElementById('est-edit-id').value='';
    document.getElementById('est-qtd').value=1;
    document.getElementById('est-min').value=1;
    document.getElementById('est-obs').value='';
  }
  document.getElementById('modal-estoque').classList.add('open');
}



function renderEstoque(){
  if(!DB.estoque)DB.estoque=[];
  const q=(document.getElementById('est-search')||{}).value?.toLowerCase()||'';
  const itens=DB.estoque.filter(i=>!q||i.nome.toLowerCase().includes(q));
  // Alertas
  const alertas=DB.estoque.filter(i=>i.qtd<=i.min);
  const alertEl=document.getElementById('est-alertas');
  if(alertas.length){
    alertEl.innerHTML=`<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:12px 16px;color:var(--red);font-size:13px">
      ⚠️ <strong>Estoque baixo:</strong> ${alertas.map(a=>`${esc(a.nome)} (${a.qtd} carretel${a.qtd!==1?'s':''})`).join(', ')}
    </div>`;
  } else {alertEl.innerHTML='';}

  const el=document.getElementById('est-list');
  if(!itens.length){
    el.innerHTML=`<div style="background:var(--bg2);border:1px dashed var(--border2);border-radius:var(--r);padding:28px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">📦</div>
      <div style="font-size:14px;color:var(--text2);font-weight:500;margin-bottom:4px">Nenhum carretel registrado ainda</div>
      <div style="font-size:12px;color:var(--text3)">Clique em "+ Registrar entrada" para adicionar seu primeiro carretel</div>
    </div>`;
    return;
  }
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">${itens.map(i=>{
    const low=i.qtd<=i.min;
    return `<div style="background:var(--bg2);border:1px solid ${low?'rgba(239,68,68,.4)':'var(--border)'};border-radius:var(--radius);padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;background:rgba(148,163,184,.15);color:#94a3b8;padding:2px 8px;border-radius:20px">${esc(i.tipo)}</span>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" data-click='openEstoqueModal(${JSON.stringify(i)})' title="Editar">✏</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" data-click="delEstoque('${i.id}')">✕</button>
        </div>
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">${esc(i.nome)}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <button data-click="ajustarQtdEstoque('${i.id}',-1)" style="width:28px;height:28px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:16px;color:var(--text);line-height:1">−</button>
        <div style="text-align:center;flex:1">
          <div style="font-size:24px;font-weight:800;color:${low?'var(--red)':'var(--text)'}">${i.qtd}</div>
          <div style="font-size:10px;color:var(--text3)">carretel${i.qtd!==1?'s':''}</div>
        </div>
        <button data-click="ajustarQtdEstoque('${i.id}',1)" style="width:28px;height:28px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:16px;color:var(--text);line-height:1">+</button>
      </div>
      <div style="font-size:11px;color:var(--text3)">Alerta em ≤ ${i.min} carretel${i.min!==1?'s':''} ${low?'⚠️':''}</div>
      ${i.obs?`<div style="font-size:11px;color:var(--text3);margin-top:4px;font-style:italic">${esc(i.obs)}</div>`:''}
      <div style="font-size:10px;color:var(--text3);margin-top:6px">Atualizado: ${i.atualizado||'—'}</div>
    </div>`;
  }).join('')}</div>`;
}


