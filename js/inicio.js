/* MoneyFlow 3D — Início: link de nova senha e sessão salva (precisa ser o ÚLTIMO arquivo).
   Parte do antigo index.html (item 16). Ordem de carga definida no index.html. */
// Verificar se é redirect de reset de senha
(async ()=>{
  const hash = window.location.hash;
  if(hash && hash.includes('access_token')){
    const params = new URLSearchParams(hash.substring(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if(type === 'recovery' && accessToken){
      await _supa.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      history.replaceState(null, '', window.location.pathname);
      document.getElementById('login-overlay').style.display='flex';
      document.getElementById('login-section').style.display='none';
      document.getElementById('reset-section').style.display='block';
      setTimeout(()=>document.getElementById('reset-pw').focus(), 150);
      return;
    }
  }

  const { data: { session } } = await _supa.auth.getSession();

  if(session){
    // Sessão salva + bloqueio ligado neste aparelho: pede a biometria antes de mostrar os dados (item 20).
    const hasCred = localStorage.getItem('p3d_cred');
    if(window.PublicKeyCredential && hasCred){
      mostrarBloqueio();
      setTimeout(desbloquearBiometria, 300);
    } else {
      // Sem biometria — entra direto com a sessão salva
      sessionStorage.setItem('p3d_ok','1');
      document.getElementById('login-overlay').style.display='none';
      initApp();
    }
  } else {
    // Sem sessão — mostrar login normal
    sessionStorage.removeItem('p3d_ok');
    document.getElementById('login-overlay').style.display='flex';
    // Sem sessão o bloqueio não tem o que desbloquear: entra com e-mail e senha.
    localStorage.removeItem('p3d_cred');
    setTimeout(()=>document.getElementById('login-email').focus(), 150);
  }
})();
