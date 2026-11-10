/* MoneyFlow 3D — Importação de dados.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ── IMPORTAR ────────────────────────────────────────── */
let impTipo='produtos', gsTipo='produtos';

function setImpTipo(t){
  impTipo=t;
  ['prod','fil','cat','cli'].forEach(x=>{
    const el=document.getElementById('imp-t-'+x);if(el)el.classList.remove('active');
  });
  const map={produtos:'prod',filamentos:'fil',catalogo:'cat',clientes:'cli'};
  const el=document.getElementById('imp-t-'+map[t]);if(el)el.classList.add('active');
}

function setGSTipo(t){
  gsTipo=t;
  ['prod','fil','cat'].forEach(x=>{
    document.getElementById('gs-t-'+x).classList.remove('active');
  });
  const map={produtos:'prod',filamentos:'fil',catalogo:'cat'};
  document.getElementById('gs-t-'+map[t]).classList.add('active');
}

function handleDrop(e){
  e.preventDefault();
  document.getElementById('drop-zone').style.borderColor='var(--border2)';
  const file=e.dataTransfer.files[0];
  if(file)processFile(file);
}

function handleFileUpload(e){
  const file=e.target.files[0];
  if(file)processFile(file);
}

function processFile(file){
  const reader=new FileReader();
  reader.onload=function(e){
    const text=e.target.result;
    const rows=parseCSV(text);
    previewImport(rows,file.name);
  };
  reader.readAsText(file,'UTF-8');
}

function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  const headers=lines[0].split(/[;,]/).map(h=>h.trim().replace(/['"]/g,''));
  return lines.slice(1).filter(l=>l.trim()).map(line=>{
    const vals=line.split(/[;,]/).map(v=>v.trim().replace(/^["']|["']$/g,''));
    const obj={};headers.forEach((h,i)=>obj[h]=vals[i]||'');
    return obj;
  });
}

function previewImport(rows,filename){
  const el=document.getElementById('imp-preview');
  if(!rows.length){el.innerHTML='<div style="color:var(--red);font-size:13px">Arquivo vazio ou formato inválido.</div>';return;}
  el.innerHTML=`
    <div style="background:var(--bg3);border-radius:var(--rsm);padding:14px;margin-bottom:10px">
      <div style="font-size:13px;color:var(--text2);margin-bottom:6px">📄 <strong>${filename}</strong> — ${rows.length} linha(s) encontradas</div>
      <div style="font-size:12px;color:var(--text3)">Colunas: ${Object.keys(rows[0]).join(', ')}</div>
    </div>
    <button class="btn btn-primary" onclick="confirmarImport(${JSON.stringify(rows).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,"\'")})">✅ Importar ${rows.length} item(s) como <strong>${impTipo}</strong></button>
  `;
  // safer: store globally
  window._importRows=rows;
  el.innerHTML=`
    <div style="background:var(--bg3);border-radius:var(--rsm);padding:14px;margin-bottom:10px">
      <div style="font-size:13px;color:var(--text2);margin-bottom:6px">📄 <strong>${filename}</strong> — ${rows.length} linha(s) encontradas</div>
      <div style="font-size:12px;color:var(--text3)">Colunas detectadas: ${Object.keys(rows[0]).join(' | ')}</div>
    </div>
    <button class="btn btn-primary" onclick="confirmarImport()">✅ Importar ${rows.length} item(s) como ${impTipo}</button>
  `;
}

function confirmarImport(){
  const rows=window._importRows;
  if(!rows||!rows.length)return;
  let count=0;
  if(impTipo==='produtos'){
    rows.forEach(r=>{
      if(!r.nome)return;
      DB.produtos.unshift({id:Date.now()+Math.random(),nome:r.nome,filamento:r.filamento||'—',custoTotal:parseFloat(r.custoTotal)||0,precoBase:parseFloat(r.precoBase)||0,margem:parseFloat(r.margem)||0,markup:parseFloat(r.markup)||0,data:r.data||new Date().toLocaleDateString('pt-BR'),ts:Date.now()});
      count++;
    });
  } else if(impTipo==='filamentos'){
    rows.forEach(r=>{
      if(!r.nome)return;
      DB.filamentos.push({id:Date.now()+Math.random(),nome:r.nome,marca:r.marca||'',tipo:r.tipo||'PLA',custo:parseFloat(r.custo)||0,peso:parseFloat(r.peso)||1000});
      count++;
    });
  } else if(impTipo==='catalogo'){
    if(!DB.catalogos)DB.catalogos=[];
    rows.forEach(r=>{
      if(!r.nome)return;
      DB.catalogos.push({id:Date.now()+Math.random(),nome:r.nome,descricao:r.descricao||'',categoria:r.categoria||'Geral',custoTotal:parseFloat(r.custoTotal)||0,precoBase:parseFloat(r.precoBase)||0,margem:parseFloat(r.margem)||0,filamento:r.filamento||'—',marketplace:r.marketplace||''});
      count++;
    });
  } else if(impTipo==='clientes'){
    if(!DB.clientes)DB.clientes=[];
    rows.forEach(r=>{
      if(!r.nome)return;
      // Evitar duplicata por nome+whatsapp
      const existe=DB.clientes.find(c=>c.nome===r.nome&&c.wpp===(r.whatsapp||''));
      if(existe)return;
      DB.clientes.unshift({
        id:Date.now()+Math.random(),
        nome:r.nome,
        wpp:r.whatsapp||r.wpp||'',
        insta:r.instagram||r.insta||'',
        email:r.email||'',
        obs:r.observacoes||r.obs||'',
        ts:Date.now()
      });
      count++;
    });
  }
  saveDB();
  notify(count+' itens importados com sucesso!');
  document.getElementById('imp-preview').innerHTML=`<div style="color:var(--green);font-size:13px;font-weight:500">✅ ${count} itens importados!</div>`;
}

function downloadTemplate(tipo){
  const templates={
    produtos:'nome;filamento;custoTotal;precoBase;margem;markup;data\nSuporteGamer;PLA ESUN;8.50;25.50;66.7;200;01/01/2025',
    filamentos:'nome;marca;tipo;custo;peso\nPLA ESUN Preto;ESUN;PLA;170;1000',
    catalogo:'nome;descricao;categoria;precoBase;custoTotal;filamento;marketplace\nSuporteHeadset;Suporte para fone gamer;Gamer;25.50;8.50;PLA ESUN;Shopee',
    clientes:'nome;whatsapp;instagram;email;observacoes\nJoão Silva;(62) 99999-1234;@joaosilva;joao@email.com;Cliente fiel prefere PLA\nMaria Santos;(11) 98888-5678;;maria@email.com;'
  };
  const blob=new Blob(['\uFEFF'+templates[tipo]],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='template_'+tipo+'.csv';a.click();
}

async function importGSheets(){
  const url=document.getElementById('gs-url').value.trim();
  const status=document.getElementById('gs-status');
  if(!url){status.innerHTML='<span style="color:var(--red)">Cole a URL primeiro.</span>';return;}
  status.innerHTML='<span style="color:var(--text2)">⏳ Buscando dados...</span>';
  try{
    // convert share URL to export URL if needed
    let fetchUrl=url;
    if(url.includes('docs.google.com/spreadsheets')){
      const match=url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if(match){
        const gid=url.match(/gid=([0-9]+)/);
        fetchUrl=`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${gid?'&gid='+gid[1]:''}`;
      }
    }
    const resp=await fetch(fetchUrl);
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    const text=await resp.text();
    const rows=parseCSV(text);
    window._importRows=rows;
    impTipo=gsTipo;
    status.innerHTML=`<span style="color:var(--green)">✅ ${rows.length} linhas carregadas. </span>`;
    previewImport(rows,'Google Sheets');
    document.getElementById('imp-preview').scrollIntoView({behavior:'smooth'});
  }catch(e){
    status.innerHTML=`<span style="color:var(--red)">Erro: ${e.message}. Verifique se a planilha está publicada como CSV público.</span>`;
  }
}

