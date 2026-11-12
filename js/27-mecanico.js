// ═══ ÁREA DO MECÂNICO ═══
// ── Atribuir orçamento como tarefa ao mecânico ──
async function orcAtribuirMecanico(orcId) {
  if (!mecMecanicos || mecMecanicos.length === 0) {
    mostrarToast('Nenhum mecânico cadastrado na Área do Mecânico');
    return;
  }
  const orc = orcamentos.find(o => o.id === orcId);
  if (!orc) return;

  // Montar modal de seleção
  const opcoesHTML = mecMecanicos.map(m =>
    `<button onclick="orcConfirmarAtribuicao('${orcId}','${mecEsc(m.nome)}')" style="display:block;width:100%;text-align:left;padding:10px 14px;margin-bottom:6px;background:#1e1e21;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;cursor:pointer;font-size:.88rem" onmouseover="this.style.background='rgba(255,255,255,0.075)'" onmouseout="this.style.background='#1e1e21'">${mecEsc(m.nome)}</button>`
  ).join('');

  const modalEl = document.createElement('div');
  modalEl.id = 'modal-atrib-mec';
  modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  modalEl.innerHTML = `
    <div style="background:#111;border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:24px;min-width:300px;max-width:400px;box-shadow:0 0 30px rgba(255,255,255,0.1)">
      <div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#c2c2c5;margin-bottom:4px">Atribuir Tarefa</div>
      <div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:16px">Orç. ${orc.cliente||'sem cliente'}</div>
      <div style="font-size:.78rem;color:var(--color-text-muted);margin-bottom:12px">Escolha o mecânico:</div>
      ${opcoesHTML}
      <button onclick="document.getElementById('modal-atrib-mec').remove()" class="btn btn-del" style="width:100%;margin-top:8px">Cancelar</button>
    </div>`;
  document.body.appendChild(modalEl);
}

async function orcConfirmarAtribuicao(orcId, nomeMec) {
  document.getElementById('modal-atrib-mec')?.remove();
  const orc = orcamentos.find(o => o.id === orcId);
  if (!orc) return;
  try {
    const ref = _tarDocR('tar_orc_' + orcId);
    await window._fsSet(ref, {
      mecanico: nomeMec,
      tipo: 'orcamento',
      descricao: 'Orçamento: ' + (orc.cliente||'sem cliente') + (orc.veiculo ? ' — ' + orc.veiculo : ''),
      orcId: orcId,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      itens: (orc.itens||[]).map(i => ({ desc: i.desc||i.nome||'', valor: i.valorTotal||i.valor||0 }))
    });
    // Marcar orçamento como atribuído
    await window._firestoreSetDoc(window._userDoc('orcamentos_lista'), {
      lista: orcamentos.map(o => o.id === orcId ? { ...o, mecAtribuido: nomeMec } : o),
      atualizadoEm: new Date().toISOString()
    });
    orcamentos = orcamentos.map(o => o.id === orcId ? { ...o, mecAtribuido: nomeMec } : o);
    renderOrcamento();
    mostrarToast('✓ Tarefa atribuída para ' + nomeMec);
  } catch(e) {
    mostrarToast('Erro ao atribuir tarefa');
    console.error(e);
  }
}

// ── Vincular cliente a orçamento do mecânico ──
function mecVincularCliente(rascId) {
  const todosClientes = [
    ...clientesCadastradosManuais.map(c => c.nome),
    ...Object.keys((() => { const m = {}; orcamentos.forEach(o => { if(o.cliente) m[o.cliente]=1; }); return m; })())
  ].filter((v,i,a) => v && a.indexOf(v)===i).sort();

  if (todosClientes.length === 0) {
    mostrarToast('Nenhum cliente cadastrado');
    return;
  }

  const opcoesHTML = todosClientes.map(nome =>
    `<button onclick="mecConfirmarVinculo('${rascId}','${nome.replace(/'/g,"&#39;")}')" style="display:block;width:100%;text-align:left;padding:8px 14px;margin-bottom:4px;background:#1e1e21;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;cursor:pointer;font-size:.82rem" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='#1e1e21'">${nome}</button>`
  ).join('');

  const modalEl = document.createElement('div');
  modalEl.id = 'modal-vinc-cli';
  modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  modalEl.innerHTML = `
    <div style="background:#111;border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:24px;min-width:300px;max-width:400px;max-height:80vh;overflow-y:auto;box-shadow:0 0 30px rgba(255,255,255,0.075)">
      <div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#eab7b7;margin-bottom:12px">Vincular Cliente</div>
      <input type="text" placeholder="Buscar cliente..." oninput="mecFiltrarVinculo(this.value)" style="width:100%;margin-bottom:12px;padding:8px 12px;background:#1e1e21;border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;font-size:.82rem;box-sizing:border-box">
      <div id="lista-vinc-cli">${opcoesHTML}</div>
      <button onclick="document.getElementById('modal-vinc-cli').remove()" class="btn btn-del" style="width:100%;margin-top:8px">Cancelar</button>
    </div>`;
  document.body.appendChild(modalEl);

  // Guardar lista para filtro
  window._vincClientesList = todosClientes;
  window._vincRascId = rascId;
}

function mecFiltrarVinculo(busca) {
  const lista = (window._vincClientesList||[]).filter(n => n.toLowerCase().includes(busca.toLowerCase()));
  document.getElementById('lista-vinc-cli').innerHTML = lista.map(nome =>
    `<button onclick="mecConfirmarVinculo('${window._vincRascId}','${nome.replace(/'/g,"&#39;")}')" style="display:block;width:100%;text-align:left;padding:8px 14px;margin-bottom:4px;background:#1e1e21;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff;cursor:pointer;font-size:.82rem" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='#1e1e21'">${nome}</button>`
  ).join('') || '<div style="color:var(--color-text-muted);font-size:.8rem;padding:8px">Nenhum cliente encontrado</div>';
}

async function mecConfirmarVinculo(rascId, nomeCliente) {
  document.getElementById('modal-vinc-cli')?.remove();
  try {
    // Buscar veículo e placa do cliente
    const veiculos = clienteBuscarVeiculos(nomeCliente);
    const ultimoVeiculo = veiculos.length && veiculos[0].veiculos.length ? veiculos[0].veiculos[0] : null;

    const update = {
      clienteVinculado: nomeCliente,
      ...(ultimoVeiculo ? { motoVinculada: ultimoVeiculo.veiculo, placaVinculada: ultimoVeiculo.placa } : {})
    };

    const ref = _rascDocR(rascId);
    await window._fsUpdate(ref, update);
    const idx = mecRascunhos.findIndex(r => r._id === rascId);
    if (idx !== -1) Object.assign(mecRascunhos[idx], update);
    renderAreaMecanico();
    mostrarToast('✓ Cliente vinculado: ' + nomeCliente + (ultimoVeiculo ? ' — ' + ultimoVeiculo.veiculo : ''));
  } catch(e) {
    mostrarToast('Erro ao vincular cliente');
    console.error(e);
  }
}
let mecRascunhosPendentes = 0;
let mecTarefasPendentes   = 0;
let mecRascunhos  = [];
let mecMecanicos  = []; // lista de mecânicos cadastrados
let mecTarefas    = []; // todas as tarefas
let mecUnsubOrcs  = null;
let mecUnsubMecs  = null;
let mecUnsubTar   = null;
let mecSubAba     = 'mecanicos'; // 'mecanicos' | 'orcs'
let mecRascunhoEditando = null;
let mecItensEditando    = [];
let mecFiltroStatus     = 'todos';
let mecMecSelecionado   = null; // nome do mec sendo gerenciado

// ─── Sessão de mecânico (login por nome, sem senha) ────────────────────
// Quando um mecânico entra pelo nome, isso guarda a UID da oficina dele.
// Fica null quando é o DONO usando o app normalmente (usa a própria UID).
window._mecanicoOficinaUid = null;
window._mecanicoNomeAtivo  = null;

function _mecUid() {
  return window._mecanicoOficinaUid || (window._auth.currentUser ? window._auth.currentUser.uid : 'anonimo');
}

// ─── Firebase helpers ─────────────────────────────────
// Isolados por UID da oficina: zlmotos/{uid}/mecanico_*/...
function _mecCol()    { return window._fsCol('zlmotos/' + _mecUid() + '/mecanico_mecs'); }
function _mecDocR(n)  { return window._fsDoc('zlmotos/' + _mecUid() + '/mecanico_mecs', encodeURIComponent(n)); }
function _tarCol()    { return window._fsCol('zlmotos/' + _mecUid() + '/mecanico_tar'); }
function _tarDocR(id) { return window._fsDoc('zlmotos/' + _mecUid() + '/mecanico_tar', id); }
function _rascCol2()  { return window._fsCol('zlmotos/' + _mecUid() + '/mecanico_orcs'); }
function _rascDocR(id){ return window._fsDoc('zlmotos/' + _mecUid() + '/mecanico_orcs', id); }

// ─── Coleções ANTIGAS (globais, pré-isolamento) — usadas só na migração ────
function _mecColAntiga()   { return window._fsCol('zlmotos_mecanico_mecs'); }
function _tarColAntiga()   { return window._fsCol('zlmotos_mecanico_tar'); }
function _rascColAntiga()  { return window._fsCol('zlmotos_mecanico_orcs'); }

// ─── Migração única: copia dados globais antigos para a conta do dono ─────
// Rode isso UMA VEZ (pelo botão na tela de Mecânicos, ou pelo console) após o deploy.
// Não apaga os dados antigos automaticamente — só copia. Depois de confirmar
// que está tudo certo na tela, os antigos podem ser apagados manualmente.
async function migrarMecanicoParaUID() {
  if (!window._auth || !window._auth.currentUser) {
    mostrarToast('Você precisa estar logado para migrar.');
    return;
  }
  if (!confirm('Isso vai copiar todos os mecânicos, tarefas e orçamentos das coleções antigas (globais) para a sua conta isolada.\n\nOs dados antigos NÃO serão apagados agora — só copiados.\n\nContinuar?')) return;

  let totalMecs = 0, totalTar = 0, totalOrcs = 0;
  try {
    const getDocs = window._fsGetDocs;

    const snapMecs = await getDocs(_mecColAntiga());
    for (const d of snapMecs.docs) {
      await window._fsSet(_mecDocR(d.id), d.data());
      await _mecIndexAdicionar(d.data().nome || d.id);
      totalMecs++;
    }

    const snapTar = await getDocs(_tarColAntiga());
    for (const d of snapTar.docs) {
      await window._fsSet(_tarDocR(d.id), d.data());
      totalTar++;
    }

    const snapOrcs = await getDocs(_rascColAntiga());
    for (const d of snapOrcs.docs) {
      await window._fsSet(_rascDocR(d.id), d.data());
      totalOrcs++;
    }

    mostrarToast(`✓ Migrado: ${totalMecs} mecânico(s), ${totalTar} tarefa(s), ${totalOrcs} orçamento(s)`);
    console.log('Migração concluída:', { totalMecs, totalTar, totalOrcs });

    // Reinicia os listeners para carregar os dados já isolados
    if (mecUnsubMecs) { mecUnsubMecs(); mecUnsubMecs = null; }
    if (mecUnsubOrcs) { mecUnsubOrcs(); mecUnsubOrcs = null; }
    if (mecUnsubTar)  { mecUnsubTar();  mecUnsubTar  = null; }
    mecIniciarListener();
  } catch(e) {
    console.error('Erro na migração:', e);
    mostrarToast('Erro na migração — veja o console.');
  }
}
window.migrarMecanicoParaUID = migrarMecanicoParaUID;

// ─── Iniciar listeners ────────────────────────────────
function mecIniciarListener() {
  if (!window._fsCol) return;
  if (!mecUnsubMecs) mecEscutarMecanicos();
  if (!mecUnsubOrcs) mecEscutarOrcs();
  if (!mecUnsubTar)  mecEscutarTarefas();
}

function mecEscutarMecanicos() {
  if (mecUnsubMecs) return;
  try {
    mecUnsubMecs = window._firestoreOnSnapshot(_mecCol(), snap => {
      mecMecanicos = [];
      snap.forEach(d => mecMecanicos.push(d.data()));
      mecMecanicos.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
      renderSidebar && renderSidebar();
      if (window._mecanicoOficinaUid) renderVisaoMecanico();
      else if (abaAtiva === 23) renderAreaMecanico();
    });
  } catch(e) { console.warn('mecEscutarMecanicos:', e); }
}

function mecEscutarOrcs() {
  if (mecUnsubOrcs) return;
  try {
    let primeiro = true;
    mecUnsubOrcs = window._firestoreOnSnapshot(_rascCol2(), snap => {
      mecRascunhos = [];
      snap.forEach(d => mecRascunhos.push({ ...d.data(), _id: d.id }));
      mecRascunhos.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm));
      mecRascunhosPendentes = mecRascunhos.filter(r => r.status === 'pendente').length;

      if (!primeiro && mecRascunhosPendentes > 0) {
        mostrarToast('Novo orçamento do mecânico aguardando revisão!');
      }
      primeiro = false;
      renderSidebar && renderSidebar();
      if (window._mecanicoOficinaUid) renderVisaoMecanico();
      else if (abaAtiva === 23 && mecSubAba === 'orcs') renderAreaMecanico();
    });
  } catch(e) { console.warn('mecEscutarOrcs:', e); }
}

function mecEscutarTarefas() {
  if (mecUnsubTar) return;
  try {
    mecUnsubTar = window._firestoreOnSnapshot(_tarCol(), snap => {
      mecTarefas = [];
      snap.forEach(d => mecTarefas.push({ ...d.data(), _id: d.id }));
      mecTarefasPendentes = mecTarefas.filter(t => !t.feita).length;
      if (window._mecanicoOficinaUid) renderVisaoMecanico();
      else if (abaAtiva === 23 && mecSubAba === 'mecanicos') renderAreaMecanico();
    });
  } catch(e) { console.warn('mecEscutarTarefas:', e); }
}

function _mecUiRefresh() {
  if (window._mecanicoOficinaUid) renderVisaoMecanico();
  else renderAreaMecanico();
}

// Derruba e reconecta os 3 listeners do módulo de mecânico, pra sempre
// ficarem escutando o caminho certo (evita ficar preso num UID errado
// por causa de corrida entre carregar a página e confirmar o login).
window._mecReiniciarListeners = function() {
  if (mecUnsubMecs) { mecUnsubMecs(); mecUnsubMecs = null; }
  if (mecUnsubOrcs) { mecUnsubOrcs(); mecUnsubOrcs = null; }
  if (mecUnsubTar)  { mecUnsubTar();  mecUnsubTar  = null; }
  if (window._mecanicoOficinaUid || (window._auth && window._auth.currentUser)) {
    mecIniciarListener();
  }
};

async function mecMarcarTarefaFeita(id, feita) {
  const t = mecTarefas.find(x => (x._id||x.id) === id);
  if (!t) return;
  try {
    await window._fsSet(_tarDocR(id), { ...t, feita, atualizadoEm: new Date().toISOString() });
    mostrarToast(feita ? 'Tarefa concluída!' : 'Tarefa reaberta');
  } catch(e) { mostrarToast('Erro ao atualizar tarefa'); }
}

async function mecNovoOrcamentoMec() {
  const id = 'orc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  const rascunho = {
    id, mecanico: window._mecanicoNomeAtivo, moto: '', placa: '', cliente: '',
    itens: [], status: 'pendente', criadoEm: new Date().toISOString()
  };
  try {
    await window._fsSet(_rascDocR(id), rascunho);
    mecRascunhoEditando = id;
    mecItensEditando = [];
    renderVisaoMecanico();
  } catch(e) { mostrarToast('Erro ao criar orçamento'); console.error(e); }
}

function renderVisaoMecanico() {
  mecIniciarListener();
  const nome = window._mecanicoNomeAtivo;

  let cont = document.getElementById('mec-app');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'mec-app';
    cont.style.cssText = 'max-width:760px;margin:0 auto;padding:24px 18px 60px';
    document.body.appendChild(cont);
  }

  // Editando um orçamento? Mostra a tela de edição completa (reaproveitada do dono, sem aprovar/reprovar)
  if (mecRascunhoEditando) {
    const r = mecRascunhos.find(x => (x._id||x.id) === mecRascunhoEditando);
    if (!r) { mecRascunhoEditando = null; }
    else { cont.innerHTML = mecRenderEdicao(r, true); return; }
  }

  const minhasTarefas = mecTarefas.filter(t => (t.mecanico||'').trim().toLowerCase() === nome.toLowerCase());
  const pendentes = minhasTarefas.filter(t => !t.feita).sort((a,b) => new Date(b.criadoEm)-new Date(a.criadoEm));
  const feitas    = minhasTarefas.filter(t => t.feita).sort((a,b) => new Date(b.criadoEm)-new Date(a.criadoEm));
  const meusOrcs  = mecRascunhos.filter(r => (r.mecanico||'').trim().toLowerCase() === nome.toLowerCase())
                                 .sort((a,b) => new Date(b.criadoEm)-new Date(a.criadoEm));

  const STATUS_LABEL = {
    pendente:  { txt:'Aguardando', cls:'badge-warning' },
    revisando: { txt:'Em revisão', cls:'badge-info' },
    aprovado:  { txt:'Aprovado',   cls:'badge-success' },
    reprovado: { txt:'Reprovado',  cls:'badge-danger' },
  };

  function renderTarefaMec(t) {
    return `
      <div style="background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:12px 14px;display:flex;align-items:flex-start;gap:10px;${t.feita?'opacity:.6':''}">
        <div style="flex:1;min-width:0">
          <div style="font-size:.9rem;font-weight:600;${t.feita?'text-decoration:line-through;color:var(--color-text-muted)':''}">${mecEsc(t.titulo||t.descricao||'')}</div>
          ${t.moto?`<div style="font-size:.76rem;color:var(--color-text-muted);margin-top:2px">${mecEsc(t.moto)}${t.placa?' · '+mecEsc(t.placa):''}</div>`:''}
          ${t.desc?`<div style="font-size:.76rem;color:var(--color-text-muted);margin-top:2px">${mecEsc(t.desc)}</div>`:''}
        </div>
        <button onclick="mecMarcarTarefaFeita('${t._id||t.id}', ${!t.feita})"
                class="btn" style="font-size:.75rem;padding:6px 12px;flex-shrink:0;
                ${t.feita ? '' : 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.175);color:#5fac86'}">
          ${t.feita ? 'Reabrir' : '✓ Concluir'}
        </button>
      </div>
    `;
  }

  cont.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">
      <div>
        <div style="font-size:1.3rem;font-weight:700">Olá, ${mecEsc(nome.split(' ')[0])}!</div>
        <div style="font-size:.78rem;color:var(--color-text-muted)">Suas tarefas e orçamentos</div>
      </div>
      <button onclick="mecLogoutSessao()" class="btn btn-del" style="font-size:.78rem;padding:6px 12px">Sair</button>
    </div>

    <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:10px">TAREFAS PENDENTES ${pendentes.length?'('+pendentes.length+')':''}</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      ${pendentes.length ? pendentes.map(renderTarefaMec).join('') : '<div style="color:var(--color-text-muted);font-size:.85rem;padding:10px 0">Nenhuma tarefa pendente </div>'}
    </div>

    ${feitas.length ? `
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:10px">CONCLUÍDAS (${feitas.length})</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
        ${feitas.map(renderTarefaMec).join('')}
      </div>` : ''}

    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px">
      <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary)">SEUS ORÇAMENTOS</div>
      <button onclick="mecNovoOrcamentoMec()" class="btn btn-primary" style="font-size:.78rem;padding:6px 14px">+ Novo Orçamento</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${meusOrcs.length
        ? meusOrcs.map(r => mecRenderCard(r, STATUS_LABEL, true)).join('')
        : '<div style="text-align:center;padding:30px;color:var(--color-text-muted);font-size:.85rem">Você ainda não enviou nenhum orçamento</div>'
      }
    </div>
  `;
}

// ─── Render principal ─────────────────────────────────
function renderAreaMecanico() {
  const el = document.getElementById('mainContent');
  if (!el) return;
  mecIniciarListener();

  const totalPend = mecRascunhosPendentes;
  const subTabs = [
    { k:'mecanicos', lbl:'Mecânicos & Tarefas' },
    { k:'orcs',      lbl:'Orçamentos' + (totalPend>0?' ('+totalPend+')':'') },
  ];

  const subTabHTML = `
    <div style="display:flex;gap:6px;margin-bottom:20px;border-bottom:1px solid var(--color-border);padding-bottom:0">
      ${subTabs.map(s => `
        <div onclick="mecSubAba='${s.k}';renderAreaMecanico()"
             style="padding:9px 16px;font-size:.85rem;font-weight:600;cursor:pointer;
                    border-bottom:2px solid ${mecSubAba===s.k?'var(--color-primary)':'transparent'};
                    color:${mecSubAba===s.k?'var(--color-primary)':'var(--color-text-muted)'};
                    transition:all .2s;margin-bottom:-1px">
          ${s.lbl}
        </div>
      `).join('')}
    </div>
  `;

  el.innerHTML = `
    <div style="max-width:900px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:1.4rem;font-weight:700;letter-spacing:-.01em">Área do Mecânico</div>
          <div style="font-size:.78rem;color:var(--color-text-muted);margin-top:2px">Gerencie mecânicos, tarefas e revise orçamentos</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <button onclick="migrarMecanicoParaUID()"
                  title="Copia mecânicos, tarefas e orçamentos das coleções antigas (globais) para a sua conta isolada"
                  style="font-size:.72rem;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.175);
                         background:rgba(255,255,255,0.04);color:#d4d4d8;cursor:pointer;font-weight:600">
            Migrar dados antigos p/ minha conta
          </button>
          <div style="display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--color-text-muted)">
            <span style="width:7px;height:7px;border-radius:50%;background:var(--color-success);display:inline-block;box-shadow:0 0 6px var(--color-success)"></span>
            Tempo real
          </div>
        </div>
      </div>
      ${subTabHTML}
      <div id="mec-sub-content">
        ${mecSubAba === 'mecanicos' ? mecRenderMecanicos() : mecRenderOrcs()}
      </div>
    </div>
  `;
}

// ─── SUB: MECÂNICOS & TAREFAS ─────────────────────────
function mecRenderMecanicos() {
  // Se tem mecânico selecionado, mostra gerenciamento dele
  if (mecMecSelecionado) return mecRenderGerenciar(mecMecSelecionado);

  if (!mecMecanicos.length) {
    return `
      <div style="text-align:center;padding:32px 20px 20px;color:var(--color-text-muted)">
        Nenhum mecânico cadastrado ainda.<br>
        <span style="font-size:.8rem;margin-top:8px;display:block">Use o formulário abaixo para cadastrar um mecânico.</span>
      </div>
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px 18px">
        <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Cadastrar Primeiro Mecânico</div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div style="flex:1;min-width:160px">
            <label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Nome completo</label>
            <input id="novo-mec-nome" class="input-field" placeholder="Ex: Carlos Silva" maxlength="60" style="width:100%" onkeydown="if(event.key==='Enter')mecCadastrar()">
          </div>
          <button onclick="mecCadastrar()" class="btn btn-primary" style="height:38px;padding:0 20px;white-space:nowrap">Cadastrar</button>
        </div>
        <div style="font-size:.72rem;color:var(--color-text-muted);margin-top:8px">Após cadastrar, o mecânico poderá entrar no app com esse nome.</div>
      </div>
    `;
  }

  return mecMecanicos.map(m => {
    const tarefasMec  = mecTarefas.filter(t => t.mecanico === m.nome);
    const pendentes   = tarefasMec.filter(t => !t.feita).length;
    const feitas      = tarefasMec.filter(t => t.feita).length;
    const orcsMec     = mecRascunhos.filter(r => r.mecanico === m.nome);
    const orcsWait    = orcsMec.filter(r => r.status === 'pendente').length;
    const ultimo      = m.ultimoAcesso ? new Date(m.ultimoAcesso).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Nunca acessou';

    return `
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px 18px;margin-bottom:12px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;cursor:pointer;transition:border-color .2s"
           onclick="mecMecSelecionado='${mecEsc(m.nome)}';renderAreaMecanico()"
           onmouseover="this.style.borderColor='var(--color-primary)'"
           onmouseout="this.style.borderColor='var(--color-border)'">
        <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.075);border:2px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:var(--color-primary);flex-shrink:0">
          ${mecEsc(m.nome.charAt(0).toUpperCase())}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:1rem;font-weight:700">${mecEsc(m.nome)}</div>
          <div style="font-size:.75rem;color:var(--color-text-muted);margin-top:2px">Último acesso: ${ultimo}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${pendentes > 0 ? `<span style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:3px 10px;font-size:.68rem;font-weight:700;color:#d4d4d8">${pendentes} tarefa(s)</span>` : ''}
          ${feitas > 0 ? `<span style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:3px 10px;font-size:.68rem;font-weight:700;color:#5fac86">${feitas} feita(s)</span>` : ''}
          ${orcsWait > 0 ? `<span style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:3px 10px;font-size:.68rem;font-weight:700;color:var(--color-primary)">${orcsWait} orc.</span>` : ''}
          <span style="color:var(--color-text-muted);font-size:.9rem">›</span>
        </div>
        <!-- Botão remover -->
        <button onclick="event.stopPropagation();mecRemoverMecanico('${mecEsc(m.nome)}')"
                title="Remover mecânico"
                style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:.82rem;padding:4px 6px;border-radius:var(--radius-sm);transition:color .2s;flex-shrink:0"
                onmouseover="this.style.color='var(--color-primary)'" onmouseout="this.style.color='var(--color-text-muted)'">Excluir</button>
      </div>
    `;
  }).join('') + `

    <!-- ── Cadastrar novo mecânico ── -->
    <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px 18px;margin-top:8px">
      <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Cadastrar Novo Mecânico</div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Nome completo</label>
          <input id="novo-mec-nome" class="input-field" placeholder="Ex: Carlos Silva" maxlength="60" style="width:100%" onkeydown="if(event.key==='Enter')mecCadastrar()">
        </div>
        <button onclick="mecCadastrar()" class="btn btn-primary" style="height:38px;padding:0 20px;white-space:nowrap">Cadastrar</button>
      </div>
      <div style="font-size:.72rem;color:var(--color-text-muted);margin-top:8px">Após cadastrar, o mecânico poderá entrar no app com esse nome.</div>
    </div>
  `;
}

// ─── Gerenciar mecânico específico ────────────────────
function mecRenderGerenciar(nome) {
  const tarefasMec = mecTarefas.filter(t => t.mecanico === nome);
  const pendentes  = tarefasMec.filter(t => !t.feita).sort((a,b) => new Date(b.criadoEm)-new Date(a.criadoEm));
  const feitas     = tarefasMec.filter(t =>  t.feita).sort((a,b) => new Date(b.criadoEm)-new Date(a.criadoEm));

  function renderTarefa(t) {
    return `
      <div style="background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:12px 14px;display:flex;align-items:flex-start;gap:10px;${t.feita?'opacity:.6':''}">
        <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${t.feita?'var(--color-success)':'var(--color-border-strong)'};background:${t.feita?'var(--color-success)':'none'};flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#000">
          ${t.feita?'✓':''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.9rem;font-weight:600;${t.feita?'text-decoration:line-through;color:var(--color-text-muted)':''}">${mecEsc(t.titulo)}</div>
          ${t.moto?`<div style="font-size:.76rem;color:var(--color-text-muted);margin-top:2px">${mecEsc(t.moto)}${t.placa?' · '+mecEsc(t.placa):''}</div>`:''}
          ${t.desc?`<div style="font-size:.76rem;color:var(--color-text-muted);margin-top:2px">${mecEsc(t.desc)}</div>`:''}
          <div style="font-size:.68rem;color:var(--color-text-muted);margin-top:4px;font-family:var(--font-mono)">
            ${t.feita?'Concluído':'Atribuído'} · ${new Date(t.criadoEm).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
        <button onclick="mecDeletarTarefa('${t._id}')" title="Remover"
                style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:.82rem;padding:3px 5px;border-radius:var(--radius-sm);flex-shrink:0;transition:color .2s"
                onmouseover="this.style.color='var(--color-primary)'" onmouseout="this.style.color='var(--color-text-muted)'">✕</button>
      </div>
    `;
  }

  // Agrupa pendentes por data
  const gruposPend = {};
  pendentes.forEach(t => {
    const d = new Date(t.criadoEm).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
    if (!gruposPend[d]) gruposPend[d] = [];
    gruposPend[d].push(t);
  });
  const datasPend = Object.keys(gruposPend).sort((a,b) => {
    const p = s => { const [d,m,y]=s.split('/'); return new Date(y,m-1,d); };
    return p(b)-p(a);
  });

  const pendentesHTML = pendentes.length
    ? datasPend.map((data,di) => {
        const ts  = gruposPend[data];
        const gid = 'mec-tar-pend-' + encodeURIComponent(nome) + '-' + di;
        const aberto = di === 0;
        return `
          <div style="margin-bottom:8px">
            <div onclick="mecToggleGrp('${gid}')"
                 style="display:flex;align-items:center;justify-content:space-between;
                        padding:7px 12px;background:rgba(255,255,255,0.04);
                        border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius-sm);
                        cursor:pointer;user-select:none">
              <span style="font-size:.8rem;font-weight:700;color:var(--color-warning)">${data}</span>
              <span style="font-size:.75rem;color:var(--color-text-muted)">
                ${ts.length} tarefa(s) &nbsp;<span id="arr-${gid}">${aberto?'▼':'▶'}</span>
              </span>
            </div>
            <div id="${gid}" style="display:flex;flex-direction:column;gap:6px;padding-top:6px;${aberto?'':'display:none'}">
              ${ts.map(renderTarefa).join('')}
            </div>
          </div>
        `;
      }).join('')
    : '<div style="color:var(--color-text-muted);font-size:.82rem;padding:12px 0">Nenhuma tarefa pendente.</div>';

  const gidFeitas = 'mec-tar-feitas-' + encodeURIComponent(nome);
  const feitasHTML = feitas.length ? `
    <div style="margin-top:8px">
      <div onclick="mecToggleGrp('${gidFeitas}')"
           style="display:flex;align-items:center;justify-content:space-between;
                  padding:7px 12px;background:rgba(255,255,255,0.035);
                  border:1px solid rgba(255,255,255,0.09);border-radius:var(--radius-sm);
                  cursor:pointer;user-select:none">
        <span style="font-size:.8rem;font-weight:700;color:var(--color-success)">Concluídas</span>
        <span style="font-size:.75rem;color:var(--color-text-muted)">
          ${feitas.length} tarefa(s) &nbsp;<span id="arr-${gidFeitas}">▶</span>
        </span>
      </div>
      <div id="${gidFeitas}" style="display:none;flex-direction:column;gap:6px;padding-top:6px">
        ${feitas.map(renderTarefa).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div>
      <button onclick="mecMecSelecionado=null;renderAreaMecanico()" class="btn" style="font-size:.8rem;margin-bottom:16px">← Todos os Mecânicos</button>

      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px 18px;margin-bottom:18px;display:flex;align-items:center;gap:14px">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.075);border:2px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:700;color:var(--color-primary)">
          ${mecEsc(nome.charAt(0).toUpperCase())}
        </div>
        <div>
          <div style="font-size:1.1rem;font-weight:700">${mecEsc(nome)}</div>
          <div style="font-size:.75rem;color:var(--color-text-muted)">${pendentes.length} pendente(s) · ${feitas.length} concluída(s)</div>
        </div>
      </div>

      <!-- Atribuir nova tarefa -->
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px 18px;margin-bottom:18px">
        <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Atribuir Nova Tarefa</div>
        <div style="margin-bottom:10px">
          <label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Tarefa *</label>
          <input id="nt-titulo" class="input-field" placeholder="Ex: Trocar óleo da CB300" maxlength="120" style="width:100%" onkeydown="if(event.key==='Enter')document.getElementById('nt-moto').focus()">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Moto (opcional)</label>
            <input id="nt-moto" class="input-field" placeholder="Ex: Honda CG 160" style="width:100%" onkeydown="if(event.key==='Enter')document.getElementById('nt-placa').focus()">
          </div>
          <div>
            <label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Placa (opcional)</label>
            <input id="nt-placa" class="input-field" placeholder="ABC-1234" style="width:100%;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Descrição adicional (opcional)</label>
          <textarea id="nt-desc" class="input-field" placeholder="Detalhes da tarefa..." style="width:100%;resize:vertical;min-height:55px"></textarea>
        </div>
        <button onclick="mecAtribuirTarefa('${mecEsc(nome)}')" class="btn btn-primary" style="font-size:.85rem;padding:8px 20px">Atribuir Tarefa</button>
      </div>

      <!-- Tarefas -->
      <div style="font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:10px">TAREFAS</div>
      ${pendentesHTML}
      ${feitasHTML}
    </div>
  `;
}

function mecToggleGrp(id) {
  const el  = document.getElementById(id);
  const arr = document.getElementById('arr-' + id);
  if (!el) return;
  const aberto = el.style.display !== 'none' && el.style.display !== '';
  el.style.display = aberto ? 'none' : 'flex';
  if (arr) arr.textContent = aberto ? '▶' : '▼';
}

async function mecAtribuirTarefa(nome) {
  const titulo = (document.getElementById('nt-titulo').value||'').trim();
  const moto   = (document.getElementById('nt-moto').value||'').trim();
  const placa  = (document.getElementById('nt-placa').value||'').trim().toUpperCase();
  const desc   = (document.getElementById('nt-desc').value||'').trim();

  if (!titulo) { mostrarToast('Informe o título da tarefa'); return; }

  const id = 'tar_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  try {
    await window._fsSet(_tarDocR(id), {
      id, mecanico: nome, titulo, moto, placa, desc,
      feita: false,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
    mostrarToast('Tarefa atribuída a ' + nome + '!');
    ['nt-titulo','nt-moto','nt-placa','nt-desc'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } catch(e) { mostrarToast('Erro ao atribuir tarefa'); console.error(e); }
}

async function mecDeletarTarefa(id) {
  if (!confirm('Remover esta tarefa?')) return;
  try {
    await window._fsDel(_tarDocR(id));
    mostrarToast('Tarefa removida');
  } catch(e) { mostrarToast('Erro ao remover'); }
}

// ─── Índice público: nome do mecânico → oficina(s) ─────────────────────
// Coleção de nível raiz (não isolada), só com nome + uid — sem dados sensíveis.
// Usada na tela de login do mecânico pra descobrir a qual oficina ele pertence.
function _slugNome(nome) {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function _mecIndexDocR(nome) { return window._fsDoc('mecanico_index', _slugNome(nome)); }

async function _mecIndexAdicionar(nome) {
  try {
    const ref = _mecIndexDocR(nome);
    const snap = await window._firestoreGetDoc(ref);
    const uid = _mecUid();
    let oficinas = (snap.exists() ? (snap.data().oficinas || []) : []).filter(o => o.uid !== uid);
    oficinas.push({ uid, nome });
    await window._fsSet(ref, { oficinas });
  } catch(e) { console.warn('Erro ao indexar mecânico:', e); }
}

async function _mecIndexRemover(nome) {
  try {
    const ref = _mecIndexDocR(nome);
    const snap = await window._firestoreGetDoc(ref);
    if (!snap.exists()) return;
    const uid = _mecUid();
    const oficinas = (snap.data().oficinas || []).filter(o => o.uid !== uid);
    if (oficinas.length) await window._fsSet(ref, { oficinas });
    else await window._fsDel(ref);
  } catch(e) { console.warn('Erro ao remover do índice:', e); }
}

async function mecCadastrar() {
  const input = document.getElementById('novo-mec-nome');
  const nome  = (input ? input.value : '').trim();
  if (!nome) { mostrarToast('Informe o nome do mecânico'); return; }
  if (mecMecanicos.find(m => m.nome.toLowerCase() === nome.toLowerCase())) {
    mostrarToast('Mecânico já cadastrado!'); return;
  }
  try {
    await window._fsSet(_mecDocR(nome), {
      nome,
      cadastradoEm: new Date().toISOString(),
      ultimoAcesso: null,
      ativo: true
    });
    await _mecIndexAdicionar(nome);
    mostrarToast('' + nome + ' cadastrado! Já pode entrar no app.');
    if (input) input.value = '';
  } catch(e) { mostrarToast('Erro ao cadastrar'); console.error(e); }
}

async function mecRemoverMecanico(nome) {
  if (!confirm('Remover o mecânico "' + nome + '"?\n\nEle não conseguirá mais entrar no app.')) return;
  try {
    await window._fsDel(_mecDocR(nome));
    await _mecIndexRemover(nome);
    mostrarToast('' + nome + ' removido');
    if (mecMecSelecionado === nome) mecMecSelecionado = null;
  } catch(e) { mostrarToast('Erro ao remover'); }
}

// ─── SUB: ORÇAMENTOS ──────────────────────────────────
function mecRenderOrcs() {
  const STATUS_LABEL = {
    pendente:  { txt:'Aguardando', cls:'badge-warning' },
    revisando: { txt:'Em revisão', cls:'badge-info' },
    aprovado:  { txt:'Aprovado',   cls:'badge-success' },
    reprovado: { txt:'Reprovado',  cls:'badge-danger' },
  };

  const filtros = ['todos','pendente','revisando','aprovado','reprovado'];
  const fLabel  = { todos:'Todos', pendente:'Pendentes', revisando:'Em revisão', aprovado:'Aprovados', reprovado:'Reprovados' };

  if (mecRascunhoEditando) {
    const r = mecRascunhos.find(x => x._id === mecRascunhoEditando || x.id === mecRascunhoEditando);
    if (!r) { mecRascunhoEditando = null; }
    else { return mecRenderEdicao(r); }
  }

  const lista = mecFiltroStatus === 'todos'
    ? mecRascunhos
    : mecRascunhos.filter(r => r.status === mecFiltroStatus);

  return `
    <div>
      <!-- Resumo -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
        ${['pendente','revisando','aprovado','reprovado'].map(s => {
          const cnt = mecRascunhos.filter(r => r.status === s).length;
          const cor = { pendente:'#d4d4d8', revisando:'#919194', aprovado:'#5fac86', reprovado:'#e4e4e7' }[s];
          const ico = { pendente:'', revisando:'', aprovado:'', reprovado:'' }[s];
          return `<div onclick="mecFiltroStatus='${s}';renderAreaMecanico()"
                       style="background:var(--color-surface);border:1px solid ${mecFiltroStatus===s?cor:'var(--color-border)'};border-radius:var(--radius-md);padding:12px 14px;cursor:pointer;transition:border-color .2s">
            <div style="font-size:1.4rem;font-weight:700;color:${cor};font-family:var(--font-mono)">${cnt}</div>
            <div style="font-size:.68rem;color:var(--color-text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.06em">${ico} ${fLabel[s]}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Filtros -->
      <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
        ${filtros.map(f => `
          <button onclick="mecFiltroStatus='${f}';renderAreaMecanico()"
                  style="padding:5px 14px;border-radius:999px;border:1px solid ${mecFiltroStatus===f?'var(--color-primary)':'var(--color-border)'};background:${mecFiltroStatus===f?'var(--color-primary-soft)':'transparent'};color:${mecFiltroStatus===f?'var(--color-primary)':'var(--color-text-muted)'};font-family:var(--font-body);font-size:.78rem;font-weight:600;cursor:pointer;transition:all .2s">
            ${fLabel[f]}${f==='pendente'&&mecRascunhosPendentes>0?' ('+mecRascunhosPendentes+')':''}
          </button>
        `).join('')}
      </div>

      <!-- Cards -->
      <div style="display:flex;flex-direction:column;gap:12px">
        ${lista.length
          ? lista.map(r => mecRenderCard(r, STATUS_LABEL)).join('')
          : '<div style="text-align:center;padding:40px;color:var(--color-text-muted);font-size:.875rem">Nenhum orçamento encontrado</div>'
        }
      </div>
    </div>
  `;
}

function mecRenderCard(r, STATUS_LABEL, modoMec) {
  const sl   = STATUS_LABEL[r.status] || { txt:r.status, cls:'badge-muted' };
  const rid  = r._id || r.id;
  const data = new Date(r.criadoEm).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  const total = (r.itens||[]).reduce((s,it)=>s+(it.qtd||1)*(it.valor||0),0);
  const bcolor = { pendente:'#d4d4d8', revisando:'#919194', aprovado:'#5fac86', reprovado:'#e4e4e7' }[r.status] || 'var(--color-border)';

  const linhas = (r.itens||[]).map(it =>
    `<tr>
      <td style="padding:6px 10px;color:var(--color-text-secondary);font-size:.82rem">${mecEsc(it.desc)}</td>
      <td style="padding:6px 10px;text-align:center;font-size:.82rem;color:var(--color-text-muted)">${it.qtd||1}x</td>
      <td style="padding:6px 10px;text-align:right;font-size:.82rem;font-family:var(--font-mono);color:var(--color-success)">${mecFmt(it.valor)}</td>
      <td style="padding:6px 10px;text-align:right;font-size:.82rem;font-family:var(--font-mono);color:var(--color-text-primary)">${mecFmt((it.qtd||1)*(it.valor||0))}</td>
    </tr>`
  ).join('');

  return `
    <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px 18px;border-left:3px solid ${bcolor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <div style="font-size:1.05rem;font-weight:700">${mecEsc(r.moto)}</div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
            <span style="font-family:monospace;font-size:.75rem;background:var(--color-elevated);border:1px solid var(--color-border-strong);border-radius:4px;padding:2px 8px;color:var(--color-text-secondary)">${mecEsc(r.placa)}</span>
            ${r.cliente?`<span style="font-size:.8rem;color:var(--color-text-muted)">${mecEsc(r.cliente)}</span>`:''}
            <span style="font-size:.78rem;color:var(--color-text-muted)">${mecEsc(r.mecanico)}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="badge ${sl.cls}">${sl.txt}</span>
          <span style="font-family:var(--font-mono);font-weight:700;font-size:1.1rem;color:var(--color-success)">${mecFmt(total)}</span>
        </div>
      </div>

      <div style="overflow-x:auto;margin-bottom:10px">
        <table style="width:100%;border-collapse:collapse;background:var(--color-elevated);border-radius:6px;overflow:hidden">
          <thead><tr style="border-bottom:1px solid var(--color-border)">
            <th style="padding:6px 10px;text-align:left;font-size:.65rem;color:var(--color-text-muted);letter-spacing:.06em;text-transform:uppercase;font-weight:600">Descrição</th>
            <th style="padding:6px 10px;text-align:center;font-size:.65rem;color:var(--color-text-muted);letter-spacing:.06em;text-transform:uppercase;font-weight:600">Qtd</th>
            <th style="padding:6px 10px;text-align:right;font-size:.65rem;color:var(--color-text-muted);letter-spacing:.06em;text-transform:uppercase;font-weight:600">Unit.</th>
            <th style="padding:6px 10px;text-align:right;font-size:.65rem;color:var(--color-text-muted);letter-spacing:.06em;text-transform:uppercase;font-weight:600">Subtotal</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr style="border-top:1px solid var(--color-border)">
            <td colspan="3" style="padding:8px 10px;font-size:.8rem;font-weight:700;color:var(--color-text-secondary)">TOTAL</td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--color-success)">${mecFmt(total)}</td>
          </tr></tfoot>
        </table>
      </div>

      ${r.obs?`<div style="font-size:.8rem;color:var(--color-text-muted);padding:4px 0 8px">${mecEsc(r.obs)}</div>`:''}
      ${r.obsDono?`<div style="padding:8px 10px;background:rgba(255,255,255,0.03);border-left:2px solid var(--color-primary);border-radius:0 4px 4px 0;font-size:.8rem;color:var(--color-text-secondary);margin-bottom:8px"><strong style="color:var(--color-primary)">Obs. dono:</strong> ${mecEsc(r.obsDono)}</div>`:''}

      <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:10px">Enviado em ${data}</div>

      ${r.clienteVinculado ? `<div style="padding:6px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:.78rem;color:#eab7b7;margin-bottom:10px">
        <strong>${mecEsc(r.clienteVinculado)}</strong>
        ${r.motoVinculada ? ` &nbsp;·&nbsp; ${mecEsc(r.motoVinculada)}` : ''}
        ${r.placaVinculada ? ` &nbsp;·&nbsp; <span style="font-family:monospace">${mecEsc(r.placaVinculada)}</span>` : ''}
      </div>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${modoMec ? `
          ${r.status==='pendente'?`<button onclick="mecEditarOrc('${rid}')" class="btn" style="font-size:.78rem;padding:6px 14px">Editar</button>`:''}
          ${r.status==='pendente'?`<button onclick="mecDeletarOrc('${rid}')" class="btn" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:var(--color-text-muted);font-size:.78rem;padding:6px 12px" title="Excluir orçamento">Excluir</button>`:''}
        ` : `
          <button onclick="mecVincularCliente('${rid}')" class="btn" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:#eab7b7;font-size:.78rem;padding:6px 14px">${r.clienteVinculado ? 'Trocar Cliente' : 'Vincular Cliente'}</button>
          <button onclick="mecEditarOrc('${rid}')" class="btn" style="font-size:.78rem;padding:6px 14px">Editar & Revisar</button>
          ${r.status!=='aprovado'?`<button onclick="mecMarcarStatus('${rid}','revisando')" class="btn" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:#919194;font-size:.78rem;padding:6px 14px">Em Revisão</button>`:''}
          ${r.status!=='aprovado'?`<button onclick="mecConverterOrcamento('${rid}')" class="btn btn-primary" style="font-size:.78rem;padding:6px 16px">Transformar em Orçamento</button>`:''}
          ${r.status!=='reprovado'?`<button onclick="mecReprovRascunho('${rid}')" class="btn" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:var(--color-primary);font-size:.78rem;padding:6px 14px">Reprovar</button>`:''}
          <button onclick="mecDeletarOrc('${rid}')" class="btn" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);color:var(--color-text-muted);font-size:.78rem;padding:6px 12px" title="Excluir orçamento">Excluir</button>
        `}
      </div>
    </div>
  `;
}

function mecRenderEdicao(r, modoMec) {
  const rid   = r._id || r.id;
  const total = mecItensEditando.reduce((s,it)=>s+(it.qtd||1)*(it.valor||0),0);
  return `
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button onclick="${modoMec?'mecFecharEdicaoMec()':'mecFecharEdicaoOrc()'}" class="btn" style="font-size:.8rem">← Voltar</button>
        <div>
          <div style="font-size:1.1rem;font-weight:700">${modoMec?'Editar Orçamento':'Revisar Orçamento'}</div>
          <div style="font-size:.75rem;color:var(--color-text-muted)">${mecEsc(r.mecanico)} · ${mecEsc(r.moto)} · ${mecEsc(r.placa)}</div>
        </div>
      </div>

      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px;margin-bottom:14px">
        <div class="secao-titulo" style="margin-bottom:10px">Dados da Moto</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div><label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Moto</label>
            <input id="ed-moto" class="input-field" value="${mecEsc(r.moto)}" style="width:100%"></div>
          <div><label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Placa</label>
            <input id="ed-placa" class="input-field" value="${mecEsc(r.placa)}" style="width:100%;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></div>
        </div>
        <label style="display:block;font-size:.68rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:5px">Cliente</label>
        <input id="ed-cli" class="input-field" value="${mecEsc(r.cliente||'')}" style="width:100%">
      </div>

      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px;margin-bottom:14px">
        <div class="secao-titulo" style="margin-bottom:10px">Itens</div>
        <div id="ed-itens" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          ${mecItensEditando.map((it,idx)=>`
            <div style="display:grid;grid-template-columns:1fr 70px 110px auto;gap:8px;align-items:center;background:var(--color-elevated);border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:8px 12px">
              <input class="input-field" style="font-size:.88rem" value="${mecEsc(it.desc)}" oninput="mecEditItemOrc(${idx},'desc',this.value)">
              <input class="input-field" type="number" style="font-size:.88rem;text-align:center" value="${it.qtd||1}" min="1" oninput="mecEditItemOrc(${idx},'qtd',this.value)">
              <input class="input-field" type="number" style="font-size:.88rem" value="${it.valor||0}" step="0.01" min="0" oninput="mecEditItemOrc(${idx},'valor',this.value)">
              <button onclick="mecRemItemOrc(${idx})" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:.95rem;padding:2px 5px;border-radius:4px;transition:color .2s" onmouseover="this.style.color='var(--color-primary)'" onmouseout="this.style.color='var(--color-text-muted)'">✕</button>
            </div>
          `).join('')}
        </div>
        <div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.15);border-radius:var(--radius-sm);padding:10px;margin-bottom:12px">
          <div style="display:grid;grid-template-columns:1fr 70px 110px;gap:8px;margin-bottom:8px">
            <input class="input-field" id="en-desc" placeholder="Descrição" style="font-size:.88rem" onkeydown="if(event.key==='Enter')document.getElementById('en-qtd').focus()">
            <input class="input-field" id="en-qtd" type="number" placeholder="Qtd" value="1" min="1" style="font-size:.88rem;text-align:center" onkeydown="if(event.key==='Enter')document.getElementById('en-val').focus()">
            <input class="input-field" id="en-val" type="number" placeholder="R$ Valor" step="0.01" min="0" style="font-size:.88rem" onkeydown="if(event.key==='Enter')mecAddItemOrc()">
          </div>
          <button onclick="mecAddItemOrc()" class="btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.175);color:var(--color-primary);font-size:.8rem;padding:6px 14px">+ Adicionar</button>
        </div>
        <div style="background:var(--color-elevated);border-radius:var(--radius-sm);padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.72rem;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em">Total</span>
          <span id="ed-total" style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:var(--color-success)">${mecFmt(total)}</span>
        </div>
      </div>

      ${modoMec ? '' : `
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:16px;margin-bottom:18px">
        <div class="secao-titulo" style="margin-bottom:8px">Observação para o Mecânico</div>
        <textarea id="ed-obs" class="input-field" style="width:100%;resize:vertical;min-height:60px" placeholder="Comentário para o mecânico...">${mecEsc(r.obsDono||'')}</textarea>
      </div>`}

      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${modoMec ? `
          <button onclick="mecSalvarEdicaoMec('${rid}')" class="btn btn-primary" style="padding:10px 22px">Salvar</button>
          <button onclick="mecFecharEdicaoMec()" class="btn" style="padding:10px 16px">Cancelar</button>
        ` : `
          <button onclick="mecSalvarEdicaoOrc('${rid}')" class="btn btn-primary" style="padding:10px 22px">Salvar</button>
          <button onclick="mecConverterOrcamento('${rid}')" class="btn btn-primary" style="padding:10px 22px;background:var(--color-success);border-color:var(--color-success)">Transformar em Orçamento</button>
          <button onclick="mecReprovRascunho('${rid}')" class="btn" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:var(--color-primary);padding:10px 16px">Reprovar</button>
          <button onclick="mecFecharEdicaoOrc()" class="btn" style="padding:10px 16px">Cancelar</button>
        `}
      </div>
    </div>
  `;
}

function mecFecharEdicaoMec() {
  mecRascunhoEditando = null;
  mecItensEditando = [];
  renderVisaoMecanico();
}

async function mecSalvarEdicaoMec(id) {
  const r = mecRascunhos.find(x => (x._id||x.id) === id);
  if (!r) return;
  const moto  = (document.getElementById('ed-moto').value||'').trim();
  const placa = (document.getElementById('ed-placa').value||'').trim().toUpperCase();
  const cli   = (document.getElementById('ed-cli').value||'').trim();
  if (!moto||!placa) { mostrarToast('Preencha moto e placa'); return; }
  try {
    await window._fsSet(_rascDocR(id), {
      ...r, moto, placa, cliente:cli,
      itens: mecItensEditando,
      atualizadoEm: new Date().toISOString()
    });
    mostrarToast('✓ Salvo!');
    mecRascunhoEditando = null; mecItensEditando = [];
    renderVisaoMecanico();
  } catch(e) { mostrarToast('Erro ao salvar'); console.error(e); }
}

// ─── Ações orçamentos ─────────────────────────────────
function mecEditarOrc(id) {
  const r = mecRascunhos.find(x => (x._id||x.id) === id);
  if (!r) return;
  mecRascunhoEditando = id;
  mecItensEditando = JSON.parse(JSON.stringify(r.itens || []));
  _mecUiRefresh();
}

function mecFecharEdicaoOrc() {
  mecRascunhoEditando = null;
  mecItensEditando = [];
  _mecUiRefresh();
}

function mecEditItemOrc(idx, campo, val) {
  if (!mecItensEditando[idx]) return;
  mecItensEditando[idx][campo] = (campo === 'qtd' || campo === 'valor') ? parseFloat(val)||0 : val;
  const t = mecItensEditando.reduce((s,it)=>s+(it.qtd||1)*(it.valor||0),0);
  const el = document.getElementById('ed-total'); if (el) el.textContent = mecFmt(t);
}

function mecRemItemOrc(idx) {
  mecItensEditando.splice(idx, 1);
  const r = mecRascunhos.find(x => (x._id||x.id) === mecRascunhoEditando);
  if (r) { r.itens = [...mecItensEditando]; _mecUiRefresh(); }
}

function mecAddItemOrc() {
  const desc = (document.getElementById('en-desc').value||'').trim();
  const qtd  = parseFloat(document.getElementById('en-qtd').value)||1;
  const val  = parseFloat(document.getElementById('en-val').value)||0;
  if (!desc) { mostrarToast('Informe a descrição'); return; }
  mecItensEditando.push({ desc, qtd, valor: val });
  const r = mecRascunhos.find(x => (x._id||x.id) === mecRascunhoEditando);
  if (r) { r.itens = [...mecItensEditando]; _mecUiRefresh(); }
}

async function mecSalvarEdicaoOrc(id) {
  const r = mecRascunhos.find(x => (x._id||x.id) === id);
  if (!r) return;
  const moto  = (document.getElementById('ed-moto').value||'').trim();
  const placa = (document.getElementById('ed-placa').value||'').trim().toUpperCase();
  const cli   = (document.getElementById('ed-cli').value||'').trim();
  const obs   = (document.getElementById('ed-obs').value||'').trim();
  if (!moto||!placa) { mostrarToast('Preencha moto e placa'); return; }
  const total = mecItensEditando.reduce((s,it)=>s+(it.qtd||1)*(it.valor||0),0);
  try {
    await window._fsSet(_rascDocR(id), {
      ...r, moto, placa, cliente:cli, obsDono:obs,
      itens: mecItensEditando, total, status:'revisando',
      atualizadoEm: new Date().toISOString()
    });
    mostrarToast('✓ Salvo!');
    mecRascunhoEditando = null; mecItensEditando = [];
  } catch(e) { mostrarToast('Erro ao salvar'); }
}

async function mecMarcarStatus(id, status) {
  const r = mecRascunhos.find(x => (x._id||x.id) === id);
  if (!r) return;
  try {
    await window._fsSet(_rascDocR(id), { ...r, status, atualizadoEm: new Date().toISOString() });
    mostrarToast('Status atualizado!');
  } catch(e) { mostrarToast('Erro'); }
}

async function mecReprovRascunho(id) {
  const obs = prompt('Motivo da reprovação (opcional):') || '';
  const r = mecRascunhos.find(x => (x._id||x.id) === id);
  if (!r) return;
  try {
    await window._fsSet(_rascDocR(id), { ...r, status:'reprovado', obsDono:obs, atualizadoEm: new Date().toISOString() });
    mostrarToast('Reprovado'); mecRascunhoEditando = null; mecItensEditando = [];
  } catch(e) { mostrarToast('Erro'); }
}

async function mecDeletarOrc(id) {
  if (!confirm('Excluir este orçamento do mecânico?\nEsta ação não pode ser desfeita.')) return;
  try {
    await window._fsDel(_rascDocR(id));
    mostrarToast('Orçamento excluído');
    mecRascunhoEditando = null;
    mecItensEditando = [];
  } catch(e) { mostrarToast('Erro ao excluir'); console.error(e); }
}

async function mecConverterOrcamento(id) {
  const r = mecRascunhos.find(x => (x._id||x.id) === id);
  if (!r) return;

  // Cliente vinculado tem prioridade absoluta
  const nomeCliente = r.clienteVinculado || '';
  let moto  = r.motoVinculada  || r.moto  || '';
  let placa = r.placaVinculada || r.placa || '';
  let cli   = nomeCliente;
  let obsD  = r.obsDono;
  let itensC = r.itens || [];

  // Buscar telefone do cliente cadastrado
  let telefone = '';
  if (nomeCliente) {
    const cliCad = clientesCadastradosManuais.find(c => c.nome === nomeCliente);
    if (cliCad) telefone = cliCad.telefone || cliCad.tel || '';
    // Se não achar no cadastro, tenta nas OS
    if (!telefone) {
      const osRef = orcamentos.find(o => (o.cliente||'').trim() === nomeCliente && o.telefone);
      if (osRef) telefone = osRef.telefone || '';
    }
  }

  if (mecRascunhoEditando === id) {
    moto  = (document.getElementById('ed-moto')?.value||'').trim()  || moto;
    placa = (document.getElementById('ed-placa')?.value||'').trim().toUpperCase() || placa;
    // NÃO sobrescreve cli com ed-cli — cliente vinculado tem prioridade
    obsD  = (document.getElementById('ed-obs')?.value||'').trim();
    itensC = mecItensEditando.length ? mecItensEditando : itensC;
  }

  if (!confirm(`Transformar em Orçamento?\n${cli||'Sem cliente'}\n${moto||'—'} · ${placa||'—'}`)) return;

  const total = itensC.reduce((s,it)=>s+(it.qtd||1)*(it.valor||0),0);
  const novoOrc = {
    id: 'orc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    cliente: cli || '',
    telefone: telefone,
    placa, veiculo: moto,
    status: 'pendente', data: new Date().toISOString().slice(0,10), validade:'',
    itens: itensC.map(it=>({ desc:it.desc||'', cat: it.cat||'Peça', qtd: String(it.qtd||1), vunit: String(it.valor||0), obs:'' })),
    total,
    obs: [r.obs, obsD?'[Dono]: '+obsD:'', '[Mecânico: '+r.mecanico+']'].filter(Boolean).join('\n'),
    criadoEm: new Date().toISOString(), origemMecanico: r.mecanico, origemRascunhoId: id
  };
  orcamentos.unshift(novoOrc);
  try {
    const ref = window._userDoc('orcamentos_lista');
    await window._firestoreSetDoc(ref, { lista: orcamentos, atualizadoEm: new Date().toISOString() });
    await window._fsSet(_rascDocR(id), { ...r, moto, placa, cliente:cli, itens:itensC, total, obsDono:obsD, status:'aprovado', atualizadoEm: new Date().toISOString() });
    mostrarToast('Orçamento criado!');
    mecRascunhoEditando = null; mecItensEditando = [];
    abaAtiva = 13; renderAll();
  } catch(e) { orcamentos.shift(); mostrarToast('Erro ao criar orçamento'); console.error(e); }
}

function mecFmt(v) { return 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function mecEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Adiciona helpers de firebase que faltavam para esta seção
window._fsCol  = window._fsCol  || window._firestoreCollection;
window._fsSet  = window._fsSet  || window._firestoreSetDoc;
window._fsGet  = window._fsGet  || window._firestoreGetDoc;
window._fsDel  = window._fsDel  || window._firestoreDeleteDoc;

// Inicia listeners
document.addEventListener('firebase-ready', () => { setTimeout(mecIniciarListener, 600); });
if (window._firebaseReady) setTimeout(mecIniciarListener, 600);
