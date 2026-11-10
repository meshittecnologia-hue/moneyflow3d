/* MoneyFlow 3D — Configurações: logo, nomes, tema.
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
/* ── SETTINGS / LOGO ─────────────────────────────────── */

function showLogoImg(src){
  document.getElementById('logo-img').src=src;
  document.getElementById('logo-img-wrap').style.display='block';
  document.getElementById('logo-title-text').style.display='none';
  const pi=document.getElementById('logo-preview-img');
  if(pi){pi.src=src;pi.style.display='block';document.getElementById('logo-preview-placeholder').style.display='none';}
  const rb=document.getElementById('btn-rem-logo');if(rb)rb.style.display='inline-flex';
}

function esconderLogoImg(){
  document.getElementById('logo-img-wrap').style.display='none';
  document.getElementById('logo-title-text').style.display='';
  const pi=document.getElementById('logo-preview-img');
  if(pi){pi.removeAttribute('src');pi.style.display='none';document.getElementById('logo-preview-placeholder').style.display='';}
  const rb=document.getElementById('btn-rem-logo');if(rb)rb.style.display='none';
}

const LOGO_TIPOS = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' };
const LOGO_MAX = 1024 * 1024; // 1 MB, mesmo limite do bucket

// Caminho do arquivo dentro do bucket a partir da URL pública (para apagar a logo antiga).
function caminhoLogo(url){
  const m = String(url||'').match(/\/storage\/v1\/object\/public\/logos\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function enviarLogoStorage(blob){
  const ext = LOGO_TIPOS[blob.type];
  if (!ext) throw new Error('Formato não aceito. Use PNG, JPG ou WEBP.');
  if (blob.size > LOGO_MAX) throw new Error('Imagem maior que 1 MB. Reduza e tente de novo.');
  const caminho = `${_currentUser.id}/logo-${Date.now()}.${ext}`;
  const { error } = await _supa.storage.from('logos').upload(caminho, blob, { contentType: blob.type, cacheControl: '31536000' });
  if (error) throw error;
  return _supa.storage.from('logos').getPublicUrl(caminho).data.publicUrl;
}

async function uploadLogo(e){
  const file=e.target.files[0]; e.target.value=''; if(!file) return;
  try{
    notify('Enviando logo...');
    const antiga = _settings.logo;
    const url = await enviarLogoStorage(file);
    const { error } = await _supa.from('profiles').update({ logo_url: url }).eq('id', _currentUser.id);
    if (error) throw error;
    _settings.logo = url;
    showLogoImg(url);
    const velho = caminhoLogo(antiga);
    if (velho) await _supa.storage.from('logos').remove([velho]);
    notify('Logo salva na sua conta!');
  }catch(err){
    notify('Não foi possível salvar a logo: ' + (err.message || err), 'red');
  }
}

async function removerLogo(){
  try{
    const { error } = await _supa.from('profiles').update({ logo_url: null }).eq('id', _currentUser.id);
    if (error) throw error;
    const velho = caminhoLogo(_settings.logo);
    if (velho) await _supa.storage.from('logos').remove([velho]);
    _settings.logo = '';
    esconderLogoImg();
    notify('Logo removida','red');
  }catch(err){
    notify('Não foi possível remover a logo: ' + (err.message || err), 'red');
  }
}

function updateLogoText(){
  const name=document.getElementById('cfg-sysname').value||'MoneyFlow 3D';
  const emp=document.getElementById('cfg-empresa').value||'MoneyFlow 3D';
  document.getElementById('logo-title-text').textContent=name;
  document.getElementById('logo-sub-text').textContent=emp;
}

async function saveSettings(){
  const name=(document.getElementById('cfg-sysname').value||'').trim()||'MoneyFlow 3D';
  const emp=(document.getElementById('cfg-empresa').value||'').trim()||'MoneyFlow 3D';
  const { error } = await _supa.from('profiles').update({ system_name: name, company: emp }).eq('id', _currentUser.id);
  if (error) { notify('Não foi possível salvar: ' + error.message, 'red'); return; }
  _settings.sysname = name; _settings.empresa = emp;
  aplicarSettings();
  notify('Configurações salvas na sua conta!');
}

function exportarDados(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='moneyflow3d_backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();
  notify('Backup exportado!');
}

function restaurarDados(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      DB=JSON.parse(ev.target.result);
      saveDB();renderDashboard();showPage('dashboard');
      notify('Dados restaurados!');
    }catch(err){notify('Arquivo inválido','red');}
  };
  reader.readAsText(file);
}

function limparDados(){
  if(!confirm('Apagar TODOS os produtos, filamentos e catálogo? Esta ação não pode ser desfeita.'))return;
  DB.produtos=[];DB.catalogos=[];
  DB.filamentos=FIL_DEFAULT;
  saveDB();renderDashboard();notify('Dados apagados','red');
}

/* ── THEME (sync both buttons) ───────────────────────── */
