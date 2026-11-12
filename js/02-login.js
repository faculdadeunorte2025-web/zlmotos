// LOGIN / LOGOUT — Firebase Authentication
// ═══════════════════════════════════════════
async function fazerLogin() {
  const email = document.getElementById('login-user').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const erro  = document.getElementById('login-erro');
  const btn   = document.querySelector('.btn-login');
  if (!email || !pass) {
    erro.textContent = 'Preencha e-mail e senha';
    erro.classList.add('visivel');
    setTimeout(() => erro.classList.remove('visivel'), 3000);
    return;
  }
  btn.textContent = 'Entrando...';
  btn.disabled = true;
  try {
    await window._firebaseSignIn(window._auth, email, pass);
    erro.classList.remove('visivel');
    document.getElementById('login-screen').style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'flex'; app.style.flexDirection = 'column'; app.style.minHeight = '100vh';
    const chatBtn = document.getElementById('zl-chat-btn');
    if (chatBtn) chatBtn.style.display = 'flex';
    await inicializarDados();
    iniciarSession();
  } catch(e) {
    let msg = 'E-mail ou senha incorretos';
    if (e.code === 'auth/too-many-requests') msg = 'Muitas tentativas. Tente mais tarde.';
    if (e.code === 'auth/network-request-failed') msg = 'Sem conexão com a internet';
    erro.textContent = msg;
    erro.classList.add('visivel');
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
    setTimeout(() => erro.classList.remove('visivel'), 4000);
  } finally {
    btn.textContent = 'Entrar';
    btn.disabled = false;
  }
}

async function fazerLogout(timeout) {
  clearInterval(sessionInterval);
  try { if (typeof _flushPendingSaves === 'function') await _flushPendingSaves(); } catch(e) {}
  // Espera as gravações em andamento antes de sair
  try { if (window._salvamentoSeguro) await window._salvamentoSeguro.gravarPendentes(); } catch(e) {}
  try { _pararTudo(); } catch(e) {}
  try { if (window._salvamentoSeguro) window._salvamentoSeguro.limpar(); } catch(e) {}
  try { await window._firebaseSignOut(window._auth); } catch(e) {}
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  if (timeout) {
    const erro = document.getElementById('login-erro');
    erro.textContent = 'Sessão expirada por inatividade';
    erro.classList.add('visivel');
    setTimeout(() => { erro.classList.remove('visivel'); erro.textContent = 'E-mail ou senha incorretos'; }, 4000);
  }
}

// ═══════════════════════════════════════════
// LOGIN DO MECÂNICO — só com nome, sem senha
// ═══════════════════════════════════════════
function alternarLoginMec() {
  const area = document.getElementById('mec-login-area');
  const aberto = area.style.display !== 'none';
  area.style.display = aberto ? 'none' : 'block';
}

async function mecFazerLogin() {
  const input = document.getElementById('mec-login-nome');
  const nome  = (input ? input.value : '').trim();
  const erroEl = document.getElementById('mec-login-erro');
  erroEl.style.display = 'none';

  if (!nome) { erroEl.textContent = 'Informe seu nome completo'; erroEl.style.display = 'block'; return; }

  try {
    // Autentica de forma anônima — necessário pra ter permissão de leitura/escrita no Firestore
    if (!window._auth.currentUser) {
      await window._firebaseSignInAnon(window._auth);
    }

    const slug = _slugNome(nome);
    const ref  = window._fsDoc('mecanico_index', slug);
    const snap = await window._firestoreGetDoc(ref);

    if (!snap.exists() || !(snap.data().oficinas||[]).length) {
      erroEl.textContent = 'Nome não encontrado. Peça pro dono da oficina te cadastrar primeiro.';
      erroEl.style.display = 'block';
      return;
    }

    const oficinas = snap.data().oficinas.filter(o => (o.nome||'').trim().toLowerCase() === nome.toLowerCase());
    if (oficinas.length === 0) {
      erroEl.textContent = 'Nome não encontrado. Peça pro dono da oficina te cadastrar primeiro.';
      erroEl.style.display = 'block';
      return;
    }
    if (oficinas.length > 1) {
      erroEl.textContent = 'Encontramos esse nome em mais de uma oficina. Peça pro dono confirmar seu cadastro.';
      erroEl.style.display = 'block';
      return;
    }

    window._mecanicoOficinaUid = oficinas[0].uid;
    window._mecanicoNomeAtivo  = nome;
    if (window._mecReiniciarListeners) window._mecReiniciarListeners();

    document.getElementById('login-screen').style.display = 'none';
    renderVisaoMecanico();
  } catch(e) {
    console.error('Erro no login do mecânico:', e);
    erroEl.textContent = 'Erro ao entrar. Verifique sua conexão e tente de novo.';
    erroEl.style.display = 'block';
  }
}

function mecLogoutSessao() {
  window._mecanicoOficinaUid = null;
  window._mecanicoNomeAtivo  = null;
  if (mecUnsubMecs) { mecUnsubMecs(); mecUnsubMecs = null; }
  if (mecUnsubOrcs) { mecUnsubOrcs(); mecUnsubOrcs = null; }
  if (mecUnsubTar)  { mecUnsubTar();  mecUnsubTar  = null; }
  const cont = document.getElementById('mec-app');
  if (cont) cont.remove();
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('mec-login-nome').value = '';
}


function alternarCadastro() {
  const area = document.getElementById('cadastro-area');
  const aberto = area.style.display !== 'none';
  area.style.display = aberto ? 'none' : 'block';
  document.querySelector('.btn-criar').textContent = aberto ? 'Criar conta' : '✕ Cancelar';
}

async function criarConta() {
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const conf  = document.getElementById('cad-conf').value;
  const erro  = document.getElementById('cad-erro');
  const btn   = document.querySelector('#cadastro-area .btn-login');

  erro.style.display = 'none';
  if (!email || !senha || !conf) { erro.textContent = 'Preencha todos os campos'; erro.style.display='block'; return; }
  if (senha.length < 6) { erro.textContent = 'Senha deve ter ao menos 6 caracteres'; erro.style.display='block'; return; }
  if (senha !== conf) { erro.textContent = 'As senhas não coincidem'; erro.style.display='block'; return; }

  btn.textContent = 'Cadastrando...';
  btn.disabled = true;
  try {
    const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    await createUserWithEmailAndPassword(window._auth, email, senha);
    mostrarToast('✓ Conta criada! Fazendo login...');
    // Login automático após cadastro
    document.getElementById('login-user').value = email;
    document.getElementById('login-pass').value = senha;
    alternarCadastro();
    fazerLogin();
  } catch(e) {
    let msg = 'Erro ao criar conta';
    if (e.code === 'auth/email-already-in-use') msg = 'E-mail já cadastrado';
    if (e.code === 'auth/invalid-email') msg = 'E-mail inválido';
    if (e.code === 'auth/weak-password') msg = 'Senha muito fraca';
    erro.textContent = msg; erro.style.display = 'block';
    btn.textContent = 'Cadastrar';
    btn.disabled = false;
  }
}
// ═══════════════════════════════════════════
let sessionSecondsLeft = 900;
let sessionInterval = null;

function resetSession() { sessionSecondsLeft = 900; }
function iniciarSession() {
  clearInterval(sessionInterval);
  sessionSecondsLeft = 900;
  sessionInterval = setInterval(() => {
    sessionSecondsLeft--;
    const m = Math.floor(sessionSecondsLeft / 60);
    const s = sessionSecondsLeft % 60;
    const el = document.getElementById('sessionTimer');
    if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (el) el.style.color = sessionSecondsLeft < 120 ? 'var(--vermelho)' : 'var(--dourado)';
    if (sessionSecondsLeft <= 0) { clearInterval(sessionInterval); fazerLogout(true); }
  }, 1000);
}
document.addEventListener('mousemove', resetSession);
document.addEventListener('keydown', resetSession);
document.addEventListener('click', resetSession);
// ═══════════════════════════════════════════
function abrirModalSenha() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-senha';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-titulo">Alterar Senha</div>
      <div class="modal-campo"><label>Nova Senha</label><input type="password" id="nova-senha" placeholder="Digite a nova senha..."/></div>
      <div class="modal-campo"><label>Confirmar Senha</label><input type="password" id="conf-senha" placeholder="Confirme a nova senha..."/></div>
      <div id="senha-erro" style="color:#eab7b7;font-size:.8rem;margin-top:-8px;margin-bottom:8px;display:none"></div>
      <div class="modal-btns">
        <button class="btn-modal-cancel" onclick="fecharModal('modal-senha')">Cancelar</button>
        <button class="btn-modal-ok" onclick="salvarSenha()">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}
async function salvarSenha() {
  const ns = document.getElementById('nova-senha').value;
  const cs = document.getElementById('conf-senha').value;
  const err = document.getElementById('senha-erro');
  if (!ns) { err.textContent = 'Digite a nova senha.'; err.style.display='block'; return; }
  if (ns.length < 6) { err.textContent = 'Senha deve ter ao menos 6 caracteres.'; err.style.display='block'; return; }
  if (ns !== cs) { err.textContent = 'As senhas não coincidem.'; err.style.display='block'; return; }
  try {
    await window._firebaseUpdatePassword(window._currentUser, ns);
    fecharModal('modal-senha');
    mostrarToast('✓ Senha alterada com sucesso!');
  } catch(e) {
    let msg = 'Erro ao alterar senha.';
    if (e.code === 'auth/requires-recent-login') msg = 'Faça login novamente para alterar a senha.';
    err.textContent = msg; err.style.display='block';
  }
}
function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
function mostrarToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#222225;color:#eaeaed;border:1px solid rgba(255,255,255,.12);border-left:3px solid #5fac86;box-shadow:0 8px 24px rgba(0,0,0,.45);padding:10px 20px;border-radius:8px;font-family:Inter,sans-serif;font-size:.85rem;font-weight:500;letter-spacing:0;z-index:99999;animation:fadeIn .3s ease';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
function mostrarErro(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#222225;color:#f0d6d6;border:1px solid rgba(255,255,255,.12);border-left:3px solid #d56f6f;box-shadow:0 8px 24px rgba(0,0,0,.45);padding:10px 20px;border-radius:8px;font-family:Inter,sans-serif;font-size:.85rem;font-weight:500;z-index:99999;animation:fadeIn .3s ease;display:flex;align-items:center;gap:8px;';
  t.innerHTML = '' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ═══════════════════════════════════════════
