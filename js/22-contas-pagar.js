// ═══════════════════════════════════════════
// CONTAS A PAGAR
// ═══════════════════════════════════════════
// Cada conta: { id, nome, valor, vencimento (AAAA-MM-DD), recorrencia, categoria, obs,
//               status: 'pendente' | 'pago', pagoEm, dataPago, proximaId }

const CP_RECORRENCIAS = { unica: 'Única', mensal: 'Mensal', semanal: 'Semanal', anual: 'Anual' };
let cpEditandoId = null;

function _cpEsc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _cpFmt(v) { return 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _cpData(iso) { return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—'; }
// Data local (CORREÇÃO: antes usava a data em UTC; depois das 21h já contava como "amanhã")
function _cpHojeMais(dias) {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function _cpRecorrente(c) { return c.recorrencia === 'mensal' || c.recorrencia === 'semanal' || c.recorrencia === 'anual'; }

// Próximo vencimento. CORREÇÃO: dia 31 + 1 mês não pula mais para o mês seguinte (31/01 → 28/02).
function _cpProximoVencimento(venc, rec) {
  const [a, m, d] = venc.split('-').map(Number);
  if (rec === 'semanal') { const x = new Date(a, m-1, d + 7); return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); }
  let ano = a, mes = m - 1;
  if (rec === 'mensal') { mes += 1; if (mes > 11) { mes = 0; ano += 1; } }
  if (rec === 'anual') ano += 1;
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return ano + '-' + String(mes+1).padStart(2,'0') + '-' + String(Math.min(d, ultimo)).padStart(2,'0');
}

function contasPagarPendentes() { return contasPagar.filter(c => c.status !== 'pago'); }
function contasPagarBadge() {
  const lim = _cpHojeMais(2);
  return contasPagarPendentes().filter(c => c.vencimento && c.vencimento <= lim).length;
}

async function salvarContasPagar() {
  if (!window._auth || !window._auth.currentUser) return;
  try {
    await window._firestoreSetDoc(window._userDoc('contas_pagar'), { lista: contasPagar, atualizadoEm: new Date().toISOString() });
  } catch(e) {
    console.error('Erro ao salvar contas a pagar:', e);
    mostrarErro('Erro ao salvar conta: ' + (e.message || e));
  }
}
async function carregarContasPagar() {
  if (!window._auth || !window._auth.currentUser) return;
  try {
    const s = await window._firestoreGetDoc(window._userDoc('contas_pagar'));
    contasPagar = s.exists() ? (s.data().lista || []) : [];
  } catch(e) {
    console.error('Erro ao carregar contas a pagar:', e);
  }
}

// ── Modal: nova conta ou edição ─────────────────────────────────────
function contasPagarAdicionar(id) {
  if (document.getElementById('modal-cp')) return;
  cpEditandoId = id || null;
  const c = id ? (contasPagar.find(x => x.id === id) || {}) : {};
  const cats = ['Fixo'].concat(CATEGORIAS.filter(x => x !== 'Fixo'));
  const el = document.createElement('div');
  el.id = 'modal-cp';
  el.className = 'modal-overlay';
  el.innerHTML = '<div class="modal" style="width:100%;max-width:440px">'
    + '<div class="modal-titulo">' + (id ? 'Editar conta' : 'Nova conta a pagar') + '</div>'
    + '<div class="orc-field"><label>Nome</label><input id="cp-nome" type="text" placeholder="Ex: Aluguel" value="' + _cpEsc(c.nome) + '"/></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">'
    +   '<div class="orc-field"><label>Valor (R$)</label><input id="cp-valor" type="number" min="0" step="0.01" value="' + _cpEsc(c.valor) + '"/></div>'
    +   '<div class="orc-field"><label>Vencimento</label><input id="cp-venc" type="date" value="' + _cpEsc(c.vencimento) + '"/></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">'
    +   '<div class="orc-field"><label>Repetir</label><select id="cp-rec">'
    +     Object.keys(CP_RECORRENCIAS).map(k => '<option value="' + k + '"' + ((c.recorrencia || 'unica') === k ? ' selected' : '') + '>' + CP_RECORRENCIAS[k] + '</option>').join('')
    +   '</select></div>'
    +   '<div class="orc-field"><label>Categoria da saída</label><select id="cp-cat">'
    +     cats.map(k => '<option value="' + _cpEsc(k) + '"' + ((c.categoria || 'Fixo') === k ? ' selected' : '') + '>' + _cpEsc(k) + '</option>').join('')
    +   '</select></div>'
    + '</div>'
    + '<div class="orc-field" style="margin-top:10px"><label>Observação</label><input id="cp-obs" type="text" value="' + _cpEsc(c.obs) + '"/></div>'
    + '<div class="modal-btns" style="margin-top:16px">'
    +   '<button class="btn-modal-cancel" onclick="fecharModal(\'modal-cp\')">Cancelar</button>'
    +   '<button class="btn-modal-ok" onclick="contasPagarSalvar()">Salvar</button>'
    + '</div></div>';
  el.onclick = e => { if (e.target === el) el.remove(); };
  document.body.appendChild(el);
  setTimeout(() => { const i = document.getElementById('cp-nome'); if (i) i.focus(); }, 50);
}
function contasPagarEditar(id) { contasPagarAdicionar(id); }

async function contasPagarSalvar() {
  const nome = (document.getElementById('cp-nome').value || '').trim();
  const valor = document.getElementById('cp-valor').value || '';
  const venc = document.getElementById('cp-venc').value;
  const rec = document.getElementById('cp-rec').value || 'unica';
  const cat = document.getElementById('cp-cat').value || 'Fixo';
  const obs = (document.getElementById('cp-obs').value || '').trim();
  if (!nome) { mostrarErro('Informe o nome.'); return; }
  if (!venc) { mostrarErro('Informe o vencimento.'); return; }
  if (cpEditandoId) {
    const c = contasPagar.find(x => x.id === cpEditandoId);
    if (c) Object.assign(c, { nome, valor, vencimento: venc, recorrencia: rec, categoria: cat, obs });
  } else {
    contasPagar.push({ id: _gerarId('cp'), nome, valor, vencimento: venc, recorrencia: rec, categoria: cat, obs, status: 'pendente', criadoEm: new Date().toISOString() });
  }
  await salvarContasPagar();
  fecharModal('modal-cp');
  renderContasPagar(); renderSidebar();
  mostrarToast(cpEditandoId ? 'Conta atualizada' : 'Conta adicionada');
  cpEditandoId = null;
}

// ── Marcar como paga: lança a saída no mês e cria a próxima (se repetir) ──
async function contasPagarPago(id) {
  const c = contasPagar.find(x => x.id === id);
  if (!c) return;
  if (!(parseFloat(c.valor) > 0)) { mostrarErro('Essa conta está sem valor. Clique em Editar e informe o valor.'); return; }
  const anoAberto = parseInt(document.getElementById('anoGlobal').value) || new Date().getFullYear();
  const agora = new Date();
  if (anoAberto !== agora.getFullYear()) {
    mostrarErro('Troque para o ano ' + agora.getFullYear() + ' antes de marcar como paga — a saída é lançada no mês de hoje.');
    return;
  }
  if (!_dadosCarregados) { mostrarErro('Aguarde os dados carregarem.'); return; }
  const hoje = hojeISO();
  const hora = String(agora.getHours()).padStart(2,'0') + ':' + String(agora.getMinutes()).padStart(2,'0');
  c.status = 'pago'; c.pagoEm = agora.toISOString(); c.dataPago = hoje;

  // CORREÇÃO: contas antigas sem repetição ("nenhuma" ou vazio) geravam uma cópia nova a cada pagamento.
  if (_cpRecorrente(c)) {
    const prox = Object.assign({}, c, { id: _gerarId('cp'), status: 'pendente', vencimento: _cpProximoVencimento(c.vencimento, c.recorrencia) });
    delete prox.pagoEm; delete prox.dataPago; delete prox.proximaId;
    contasPagar.push(prox);
    c.proximaId = prox.id;
  }

  const m = agora.getMonth();
  if (!dados[m]) inicializarDadosLocal();
  dados[m].variaveis.push({
    data: hoje, hora,
    desc: c.nome + (c.obs ? ' (' + c.obs + ')' : ''),
    valor: c.valor,
    cat: c.categoria || 'Fixo',
    formaPgto: '',
    pago: true,
    _contaPagarId: id,
    _id: _gerarId('v')
  });
  salvarDados();
  await salvarContasPagar();
  renderContasPagar(); renderSidebar();
  mostrarToast('Paga. Saída lançada em ' + MESES[m] + '.');
}

// Desfaz um pagamento: volta para pendente e tira a saída lançada no mês
async function contasPagarDesfazer(id) {
  const c = contasPagar.find(x => x.id === id);
  if (!c || c.status !== 'pago') return;
  confirmarExclusao('o pagamento de "' + _cpEsc(c.nome) + '" (a saída lançada no mês também sai)', async () => {
    let removida = false;
    Object.keys(dados).forEach(m => {
      const lista = dados[m] && dados[m].variaveis;
      if (!Array.isArray(lista)) return;
      const i = lista.findIndex(v => v._contaPagarId === id);
      if (i >= 0) { lista.splice(i, 1); removida = true; }
    });
    if (c.proximaId) {
      const prox = contasPagar.find(x => x.id === c.proximaId);
      if (prox && prox.status !== 'pago') contasPagar = contasPagar.filter(x => x.id !== c.proximaId);
    }
    c.status = 'pendente'; delete c.pagoEm; delete c.dataPago; delete c.proximaId;
    if (removida) salvarDados();
    await salvarContasPagar();
    renderContasPagar(); renderSidebar();
    mostrarToast(removida ? 'Pagamento desfeito' : 'Pagamento desfeito (a saída não estava no ano aberto)');
  });
}

async function contasPagarExcluir(id) {
  const c = contasPagar.find(x => x.id === id);
  if (!c) return;
  confirmarExclusao(_cpEsc(c.nome), async () => {
    contasPagar = contasPagar.filter(x => x.id !== id);
    await salvarContasPagar();
    renderContasPagar(); renderSidebar();
  });
}

// ── Tela ───────────────────────────────────────────────────────────
function renderContasPagar() {
  const main = document.getElementById('mainContent');
  const hoje = hojeISO(), em2 = _cpHojeMais(2);
  const pend = contasPagarPendentes().sort((a,b) => (a.vencimento||'').localeCompare(b.vencimento||''));
  const pagas = contasPagar.filter(c => c.status === 'pago').sort((a,b) => (b.pagoEm||'').localeCompare(a.pagoEm||'')).slice(0, 10);
  const vencidas = pend.filter(c => c.vencimento < hoje);
  const breve = pend.filter(c => c.vencimento >= hoje && c.vencimento <= em2);
  const total = pend.reduce((s,c) => s + (parseFloat(c.valor)||0), 0);

  const situacao = c => c.vencimento < hoje ? { txt: 'Venceu em ' + _cpData(c.vencimento), cor: 'var(--color-danger)' }
    : c.vencimento === hoje ? { txt: 'Vence hoje', cor: 'var(--color-danger)' }
    : c.vencimento <= em2 ? { txt: 'Vence em ' + _cpData(c.vencimento), cor: 'var(--color-text-primary)' }
    : { txt: 'Vence em ' + _cpData(c.vencimento), cor: 'var(--color-text-muted)' };

  const resumo = (valor, rotulo, cor) => '<div class="card"><div class="card-label">' + rotulo + '</div>'
    + '<div class="card-valor" style="font-size:1.35rem;color:' + cor + '">' + valor + '</div></div>';

  let html = '<div class="toolbar"><span>Contas a Pagar</span>'
    + '<div class="toolbar-right"><button class="btn btn-add" onclick="contasPagarAdicionar()">+ Nova conta</button></div></div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">'
    + resumo(vencidas.length, 'Vencidas', vencidas.length ? 'var(--color-danger)' : 'var(--color-text-primary)')
    + resumo(breve.length, 'Vencem em até 2 dias', 'var(--color-text-primary)')
    + resumo(_cpFmt(total), 'Total pendente', 'var(--color-text-primary)')
    + '</div>';

  if (!pend.length) html += '<div style="text-align:center;padding:40px;color:var(--color-text-muted);border:1px dashed var(--color-border-strong);border-radius:12px">Nenhuma conta pendente</div>';
  pend.forEach(c => {
    const s = situacao(c);
    html += '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:10px;margin-bottom:8px">'
      + '<div style="flex:1;min-width:0"><div style="font-size:.9rem;font-weight:600">' + _cpEsc(c.nome) + '</div>'
      + '<div style="font-size:.74rem;color:' + s.cor + '">' + s.txt
      + '<span style="color:var(--color-text-muted)"> · ' + (CP_RECORRENCIAS[c.recorrencia] || 'Única') + (c.obs ? ' · ' + _cpEsc(c.obs) : '') + '</span></div></div>'
      + '<div style="font-size:.95rem;font-weight:600;font-family:var(--font-mono);margin-right:6px">' + (c.valor ? _cpFmt(c.valor) : '—') + '</div>'
      + '<button class="btn btn-sm" onclick="contasPagarPago(\'' + c.id + '\')">Pagar</button>'
      + '<button class="btn btn-sm" onclick="contasPagarEditar(\'' + c.id + '\')">Editar</button>'
      + '<button class="btn btn-sm" onclick="contasPagarExcluir(\'' + c.id + '\')" title="Excluir">✕</button>'
      + '</div>';
  });

  if (pagas.length) {
    html += '<div style="margin-top:24px"><div class="card-label" style="margin-bottom:10px">Pagas recentemente</div>';
    pagas.forEach(c => {
      html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border:1px solid var(--color-border);border-radius:10px;margin-bottom:6px;color:var(--color-text-secondary)">'
        + '<span style="flex:1;font-size:.84rem">' + _cpEsc(c.nome) + '</span>'
        + '<span style="font-size:.74rem">Paga em ' + _cpData(c.dataPago || (c.pagoEm || '').slice(0,10)) + '</span>'
        + '<span style="font-size:.84rem;font-family:var(--font-mono)">' + (c.valor ? _cpFmt(c.valor) : '—') + '</span>'
        + '<button class="btn btn-sm" onclick="contasPagarDesfazer(\'' + c.id + '\')">Desfazer</button>'
        + '</div>';
    });
    html += '</div>';
  }
  main.innerHTML = html;
}
