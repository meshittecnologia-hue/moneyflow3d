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
    // Sessão Supabase válida — se tiver biometria cadastrada, pedir confirmação antes de entrar
    const hasCred = localStorage.getItem('p3d_cred');
    if(window.PublicKeyCredential && hasCred){
      // Mostrar overlay só com botão de biometria, sem campos de email/senha
      document.getElementById('login-overlay').style.display='flex';
      document.getElementById('bio-section').style.display='block';
      const icon = navigator.userAgent.includes('iPhone')||navigator.userAgent.includes('iPad')?'👤':'🔏';
      document.getElementById('bio-icon').textContent=icon;
      // Substituir loginBiometria para não reautenticar no Supabase, só verificar localmente
      setTimeout(async ()=>{
        const err=document.getElementById('login-err');
        const credId=localStorage.getItem('p3d_cred');
        if(!credId){ document.getElementById('login-overlay').style.display='none'; initApp(); return; }
        try{
          document.getElementById('bio-icon').textContent='⏳';
          await navigator.credentials.get({publicKey:{
            challenge:crypto.getRandomValues(new Uint8Array(32)),
            rpId:RP_ID,
            allowCredentials:[{type:'public-key',id:fromB64url(credId)}],
            userVerification:'required',
            timeout:60000
          }});
          sessionStorage.setItem('p3d_ok','1');
          document.getElementById('login-overlay').style.display='none';
          document.getElementById('bio-icon').textContent='🔐';
          initApp();
        }catch(e){
          document.getElementById('bio-icon').textContent='🔐';
          // Biometria cancelada ou falhou — entrar direto com a sessão existente
          if(e.name==='NotAllowedError'){
            // Usuário cancelou — mostrar botão para tentar de novo ou entrar com senha
            err.textContent='Biometria cancelada. Tente novamente ou use sua senha.';
          } else {
            // Outro erro — entra direto com sessão
            document.getElementById('login-overlay').style.display='none';
            initApp();
          }
        }
      }, 300);
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
    // Se tiver biometria mas sem sessão, não adianta — precisa logar com email/senha
    localStorage.removeItem('p3d_cred'); // credencial orphan, limpar
    setTimeout(()=>document.getElementById('login-email').focus(), 150);
  }
})();
