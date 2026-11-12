// INICIALIZAR / SALVAR
// ═══════════════════════════════════════════
// ── SELETOR DE ANO ──────────────────────────────────────────────
function abrirModalAno() {
  const anoAtual = document.getElementById('anoGlobal').value || String(new Date().getFullYear());
  const anoBase = parseInt(anoAtual);
  // Gera lista de anos: 3 antes, atual, 3 depois
  const anos = [];
  for (let a = anoBase - 3; a <= anoBase + 3; a++) anos.push(a);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-ano';
  overlay.innerHTML = `
    <div class="modal" style="width:360px">
      <div class="modal-titulo">Selecionar Ano</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
        ${anos.map(a => `
          <button class="btn" onclick="confirmarTrocaAno(${a})"
            style="padding:14px;font-family:'Inter',sans-serif;font-size:1.3rem;letter-spacing:1px;
            ${a == anoAtual ? 'background:rgba(255,255,255,0.125);border:1px solid var(--color-primary);color:var(--color-primary-hover)' : 'background:rgba(255,255,255,.05);border:1px solid var(--color-border);color:var(--color-text-muted)'}">
            ${a}${a == anoAtual ? '<br><span style="font-size:.55rem;letter-spacing:1px">ATUAL</span>' : ''}
          </button>`).join('')}
      </div>
      <button class="btn" style="width:100%;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted)" onclick="fecharModal('modal-ano')">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
}

async function confirmarTrocaAno(novoAno) {
  novoAno = String(novoAno);
  const anoAtual = document.getElementById('anoGlobal').value || String(new Date().getFullYear());
  fecharModal('modal-ano');
  if (novoAno === anoAtual) return;

  // Grava o que estiver pendente do ano atual (só se os dados foram carregados de verdade)
  // CORREÇÃO: antes gravava mesmo com a tela vazia/sem carregar, apagando o ano no Firebase.
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  if (_dadosCarregados && dados && Object.keys(dados).length) {
    try {
      await window._firestoreSetDoc(window._userDoc('zlmotos_' + anoAtual), {
        dados: dados, atualizadoEm: new Date().toISOString()
      });
    } catch(e) { console.warn('Erro ao salvar ano atual:', e); }
  }

  document.getElementById('anoGlobal').value = novoAno;
  _dadosCarregados = false;
  dados = {};
  try {
    const snap = await window._firestoreGetDoc(window._userDoc('zlmotos_' + novoAno));
    if (snap.exists() && snap.data() && snap.data().dados) {
      dados = JSON.parse(JSON.stringify(snap.data().dados));
      mostrarToast('✓ Ano ' + novoAno + ' carregado!');
    } else {
      mostrarToast('Ano ' + novoAno + ' ainda sem lançamentos');
    }
    _dadosCarregados = true;
  } catch(e) {
    mostrarErro('Erro ao carregar ano ' + novoAno + ' — tentando de novo...');
    _agendarNovaTentativa();
  }
  inicializarDadosLocal();
  _escutarAno();
  renderAll();
}
// ─────────────────────────────────────────────────────────────────

function _removerDuplicatas(arr, chave) {
  const vistas = new Set();
  return arr.filter(item => {
    const k = chave(item);
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

// Garante que todos os 12 meses existem e têm todas as listas.
// CORREÇÃO: se um mês estivesse gravado sem "fixos", "variaveis" ou "entradas",
// o sistema inteiro travava e nada aparecia na tela.
function inicializarDadosLocal() {
  for (let m = 0; m < 12; m++) {
    if (!dados[m] || typeof dados[m] !== 'object') {
      dados[m] = { fixos: FIXOS_PADRAO.map(n => ({nome:n,valor:'',data:''})), variaveis:[], entradas:[], obs:'' };
      continue;
    }
    const mes = dados[m];
    if (!Array.isArray(mes.fixos))     mes.fixos = [];
    if (!Array.isArray(mes.variaveis)) mes.variaveis = [];
    if (!Array.isArray(mes.entradas))  mes.entradas = [];
    if (typeof mes.obs !== 'string')   mes.obs = mes.obs ? String(mes.obs) : '';
    mes.fixos = mes.fixos.filter(Boolean);
    mes.variaveis = mes.variaveis.filter(Boolean);
    mes.entradas = mes.entradas.filter(Boolean);
    mes.fixos.forEach(f => { if(!f.data) f.data=''; if(f.pago===undefined) f.pago=false; });
    mes.variaveis.forEach(v => { if(!v.data) v.data=''; if(!v.cat) v.cat='Outros'; if(v.pago===undefined) v.pago=false; });
    mes.entradas.forEach(e => { if(!e.data) e.data=''; if(e.pago===undefined) e.pago=true; });
    // Duplicatas: só remove itens com o MESMO _id (cópia exata de gravação dupla).
    // CORREÇÃO: antes também removia lançamentos diferentes que só tinham
    // mesma data/descrição/valor (ex.: duas trocas de óleo iguais no mesmo dia).
    const antesE = mes.entradas.length, antesV = mes.variaveis.length;
    mes.entradas  = _removerDuplicatas(mes.entradas,  e => e._id || Symbol());
    mes.variaveis = _removerDuplicatas(mes.variaveis, v => v._id || Symbol());
    if (mes.entradas.length < antesE || mes.variaveis.length < antesV) {
      console.log('ZLMotos: duplicatas (mesmo _id) removidas no mês', m);
    }
  }
}

let _dadosCarregados = false;
let _modoOffline = false;
let _tentativaTimer = null;

// Ano que abre por padrão = ano atual do calendário.
// CORREÇÃO: estava fixo "2026" no HTML; em janeiro/2027 abriria (e gravaria) no ano errado.
function _definirAnoPadrao() {
  const el = document.getElementById('anoGlobal');
  if (el && !el.dataset.escolhido) el.value = String(new Date().getFullYear());
}

window.addEventListener('online', () => {
  if (!_modoOffline) return;
  _modoOffline = false;
  const banner = document.getElementById('banner-offline');
  if (banner) banner.remove();
  mostrarToast('Conexão restaurada — sincronizando...');
  if (!_dadosCarregados) inicializarDados(true);
});

window.addEventListener('offline', () => {
  _modoOffline = true;
  const existing = document.getElementById('banner-offline');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'banner-offline';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#d4d4d8;color:#d4d4d8;text-align:center;padding:6px 12px;font-size:.78rem;font-weight:600;letter-spacing:.5px';
  banner.textContent = 'Sem conexão — trabalhando offline. Alterações serão sincronizadas quando a internet voltar.';
  document.body.prepend(banner);
});

function _verificarConexao() {
  if (!navigator.onLine) window.dispatchEvent(new Event('offline'));
}

// Avisa na tela quando há gravações esperando internet
window._avisarPendencia = function(qtd) {
  const st = document.getElementById('saveStatus');
  if (!st) return;
  if (qtd > 0) { st.textContent = '' + qtd + ' pendente(s) — sem internet'; st.classList.add('visible'); }
  else { st.textContent = '✓ SALVO'; setTimeout(() => st.classList.remove('visible'), 2000); }
};

// Quando a gravação segura juntou dados de outro aparelho, atualiza a tela
window._aposJuntarDados = function(chave) {
  if (/^zlmotos_\d{4}$/.test(chave)) inicializarDadosLocal();
  _renderSeguro();
  mostrarToast('Dados de outro aparelho foram incluídos');
};

// Re-renderiza sem atrapalhar quem está digitando
let _renderAdiado = false;
function _renderSeguro() {
  const ativo = document.activeElement;
  const digitando = ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName) && ativo.closest('#mainContent');
  if (digitando) {
    if (!_renderAdiado) {
      _renderAdiado = true;
      ativo.addEventListener('blur', () => setTimeout(() => { _renderAdiado = false; renderAll(); }, 150), { once: true });
    }
    return;
  }
  renderAll();
}

function _agendarNovaTentativa() {
  clearTimeout(_tentativaTimer);
  _tentativaTimer = setTimeout(() => { if (!_dadosCarregados && window._auth && window._auth.currentUser) inicializarDados(true); }, 15000);
}

// Lê um documento do usuário sem derrubar o resto se ele falhar
async function _lerDoc(chave) {
  try {
    const snap = await window._firestoreGetDoc(window._userDoc(chave));
    return { ok: true, existe: snap.exists(), data: snap.exists() ? snap.data() : null };
  } catch(e) {
    console.warn('Falha ao ler ' + chave + ':', e);
    return { ok: false, erro: e };
  }
}

async function inicializarDados(novaTentativa) {
  _dadosCarregados = false;
  if (!novaTentativa) _definirAnoPadrao();

  // 1) Lançamentos do ano — o mais importante
  const ano = await _lerDoc(chaveStorage());
  if (ano.ok) {
    // Sempre a versão do servidor (a cópia offline era só para visualizar)
    dados = (ano.data && ano.data.dados) || {};
    _cargaOk();
  } else {
    // CORREÇÃO: antes, numa falha de rede, o sistema mostrava tudo zerado e
    // a próxima gravação apagava o ano inteiro no Firebase.
    const temCache = _carregarCacheLocal();
    if (!dados || !Object.keys(dados).length) dados = {};
    _mostrarFalhaCarga(temCache);
    _agendarNovaTentativa();
  }

  // 2) Demais documentos — cada um no seu try (um erro não apaga os outros)
  const orc = await _lerDoc('orcamentos_lista');
  if (orc.ok && orc.existe) {
    orcamentos = orc.data.lista || [];
    let semId = false;
    orcamentos.forEach(o => { if (!o.id) { o.id = 'orc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); semId = true; } });
    if (semId) { try { await window._firestoreSetDoc(window._userDoc('orcamentos_lista'), { lista: orcamentos, atualizadoEm: new Date().toISOString() }); } catch(e) {} }
  }

  // Ano anterior (só para o gráfico dos últimos 6 meses no começo do ano)
  dadosAnoAnterior = null;
  if (new Date().getMonth() < 5) {
    try {
      const snapAnt = await window._fsGet(window._userDoc('zlmotos_' + (parseInt(document.getElementById('anoGlobal').value) - 1)));
      if (snapAnt.exists()) dadosAnoAnterior = (snapAnt.data() || {}).dados || null;
    } catch(e) {}
  }
  try { await carregarContasPagar(); } catch(e) { console.warn(e); }
  try { await carregarEmpresa(); } catch(e) { console.warn(e); }
  try { await carregarClientesManuais(); } catch(e) { console.warn(e); }

  inicializarDadosLocal();
  renderAll();
  try { orcVerificarAprovacaoURL(); } catch(e) {}
  iniciarListenersTempoReal();
  _escutarAno();
  try { await categoriasCarregar(); } catch(e) {}
  try { await dashCarregarMeta(); } catch(e) {}
  if (_dadosCarregados) _salvarCacheLocal();
  _verificarBackupAuto();
  _verificarConexao();
  renderAll();
}

function _cargaOk() {
  _dadosCarregados = true;
  clearTimeout(_tentativaTimer);
  const b = document.getElementById('banner-falha-carga'); if (b) b.remove();
}

function _mostrarFalhaCarga(temCache) {
  if (document.getElementById('banner-falha-carga')) return;
  const b = document.createElement('div');
  b.id = 'banner-falha-carga';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99998;background:#792323;color:#f8e8e8;text-align:center;padding:6px 12px;font-size:.78rem;font-weight:600';
  b.textContent = temCache
    ? 'Não consegui falar com o servidor — mostrando a última cópia salva neste aparelho. Tentando de novo...'
    : 'Não consegui carregar seus dados do servidor. Seus dados NÃO foram apagados — tentando de novo...';
  document.body.prepend(b);
}

// ── Listeners em tempo real para todos os dados ──────────────────
let _unsubOrcs = null, _unsubCli = null, _unsubAno = null;

// CORREÇÃO: os lançamentos do ano não tinham atualização em tempo real.
// Com dois aparelhos abertos, um não via o que o outro lançava e, ao salvar,
// apagava os lançamentos do outro.
function _escutarAno() {
  if (_unsubAno) { try { _unsubAno(); } catch(e) {} _unsubAno = null; }
  try {
    const chave = chaveStorage();
    _unsubAno = window._firestoreOnSnapshot(window._userDoc(chave), snap => {
      if (snap.metadata && snap.metadata.hasPendingWrites) return; // eco da nossa gravação
      if (!snap.exists() || chave !== chaveStorage()) return;
      if (_saveTimer) return; // há edição local esperando: a gravação segura vai juntar
      const remoto = snap.data().dados || {};
      if (JSON.stringify(remoto) === JSON.stringify(dados)) return;
      // (se estava mostrando a cópia offline, troca pela versão real do servidor;
      //  enquanto não carregou, nenhuma alteração foi gravada — o usuário é avisado)
      dados = JSON.parse(JSON.stringify(remoto));
      inicializarDadosLocal();
      _cargaOk();
      _renderSeguro();
    });
  } catch(e) { console.warn('_escutarAno:', e); }
}

function iniciarListenersTempoReal() {
  try {
    if (!_unsubOrcs) {
      _unsubOrcs = window._firestoreOnSnapshot(window._userDoc('orcamentos_lista'), snap => {
        if (!snap.exists()) return;
        orcamentos = snap.data().lista || [];
        if (abaAtiva === 13) renderOrcamento();
        renderSidebar && renderSidebar();
      });
    }
    if (!_unsubCli) {
      _unsubCli = window._firestoreOnSnapshot(window._userCollection('clientes'), snap => {
        if (!snap) return;
        // CORREÇÃO: antes, se a lista ficasse vazia, a tela não atualizava
        clientesCadastradosManuais = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (abaAtiva === 20) renderClientes();
      });
    }
  } catch(e) { console.warn('iniciarListenersTempoReal:', e); }
}

// Desliga todos os listeners e limpa a memória (usado no logout).
// CORREÇÃO: depois de sair por inatividade e entrar de novo, os listeners
// antigos ficavam "mortos" e a tela parava de atualizar — e ao salvar uma
// lista desatualizada, dados de outro aparelho eram apagados.
function _pararTudo() {
  [_unsubOrcs, _unsubCli, _unsubAno].forEach(u => { try { u && u(); } catch(e) {} });
  _unsubOrcs = _unsubCli = _unsubAno = null;
  clearTimeout(_tentativaTimer);
  _dadosCarregados = false;
  dados = {};
}

let _saveTimer = null;
async function salvarDados() {
  // Nunca grava se o ano não foi carregado do servidor
  if (!_dadosCarregados) {
    console.warn('ZLMotos: salvarDados() bloqueado — dados ainda não carregados.');
    if (window._auth && window._auth.currentUser) mostrarErro('Ainda carregando seus dados — a alteração não foi salva. Tente em instantes.');
    return;
  }
  if (!dados || Object.keys(dados).length === 0) return;
  const st = document.getElementById('saveStatus');
  if (st) { st.textContent = 'Salvando...'; st.classList.add('salvando'); st.classList.remove('visible'); }
  _salvarCacheLocal();

  clearTimeout(_saveTimer);
  const chave = chaveStorage();
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    try {
      await window._firestoreSetDoc(window._userDoc(chave), { dados: dados, atualizadoEm: new Date().toISOString() });
      const pend = window._salvamentoSeguro ? window._salvamentoSeguro.pendentes() : 0;
      if (st) {
        st.textContent = pend ? 'Salvo no aparelho — envia quando a internet voltar' : '✓ SALVO';
        st.classList.remove('salvando'); st.classList.add('visible');
        if (!pend) setTimeout(() => st.classList.remove('visible'), 2000);
      }
    } catch(e) {
      console.warn('Erro ao salvar no Firestore:', e);
      mostrarErro('Erro ao salvar — verifique sua conexão');
      if (st) { st.textContent = 'Não salvo'; st.classList.remove('salvando'); st.classList.add('visible'); }
    }
  }, 800);
}

// Força qualquer salvamento pendente (adiado) a acontecer AGORA.
// Usado antes de logout/timeout, pra nunca perder a última edição.
async function _flushPendingSaves() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
    try {
      await window._firestoreSetDoc(window._userDoc(chaveStorage()), { dados: dados, atualizadoEm: new Date().toISOString() });
    } catch(e) { console.warn('Erro ao forçar salvamento pendente:', e); }
  }
}

// ═══════════════════════════════════════════
