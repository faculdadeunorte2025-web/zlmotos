function agAtualizarBadgeEspera() {
  const btn = document.getElementById('btn-lista-espera');
  if (!btn) return;
  const count = agListaEspera.filter(e => e.status === 'aguardando').length;
  btn.textContent = count > 0 ? '⏳ Lista de Espera (' + count + ')' : '⏳ Lista de Espera';
}

async function agConfirmarEspera() {
  const nome = document.getElementById('espera-nome').value.trim();
  if (!nome) { mostrarErro('Informe o nome do cliente'); return; }

  agListaEspera.push({
    id: 'esp_' + Date.now(),
    nome,
    telefone: document.getElementById('espera-tel').value.trim(),
    veiculo: document.getElementById('espera-veiculo').value.trim(),
    servico: document.getElementById('espera-servico').value.trim(),
    dataPreferencia: document.getElementById('espera-data').value,
    obs: document.getElementById('espera-obs').value.trim(),
    criadoEm: new Date().toISOString(),
    status: 'aguardando' // aguardando, agendado, cancelado
  });

  await salvarAgendamentos();
  document.getElementById('ag-espera-overlay').remove();
  mostrarToast('✓ ' + nome + ' adicionado à lista de espera');
  renderAgendamentos();
}

async function agEsperaAgendar(id) {
  const item = agListaEspera.find(e => e.id === id);
  if (!item) return;
  // Criar agendamento a partir da espera
  agNovoAgendamento(item.dataPreferencia || hojeISO());
  const ag = agendamentos[agendamentos.length - 1];
  if (!ag) return;
  ag.cliente = item.nome;
  ag.telefone = item.telefone;
  ag.veiculo = item.veiculo;
  ag.tipo = item.servico || ag.tipo;
  ag.obs = item.obs;
  // Marcar espera como agendado
  item.status = 'agendado';
  await salvarAgendamentos();
  mostrarToast('✓ Agendamento criado para ' + item.nome);
  renderAgendamentos();
}

async function agEsperaRemover(id) {
  confirmarExclusao('este item da lista de espera', async () => {
    agListaEspera = agListaEspera.filter(e => e.id !== id);
    await salvarAgendamentos();
    renderAgendamentos();
  });
}

// ══════════════════════════════════════════════════════
// REQ 1: BLOQUEAR HORÁRIOS NO CALENDÁRIO
// ══════════════════════════════════════════════════════

function agBloquearHorario(data) {
  const bloqueados = agHorariosBloqueados[data] || [];
  const HORAS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

  const overlay = document.createElement('div');
  overlay.className = 'est-mov-overlay';
  overlay.id = 'ag-bloq-overlay';
  const fmtData = new Date(data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});

  overlay.innerHTML = `
    <div class="est-mov-box" style="width:380px">
      <div class="est-mov-titulo" style="color:#fca5a5">🔒 Bloquear Horários</div>
      <div style="font-size:.82rem;color:var(--color-text-muted);margin-bottom:14px">${fmtData}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        ${HORAS.map(h => `
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.82rem;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.08);background:${bloqueados.includes(h)?'rgba(239,68,68,.15)':'rgba(255,255,255,.03)'}">
            <label class="neon-checkbox" style="--primary:#ef4444;--primary-dark:#b91c1c;flex-shrink:0">
              <input type="checkbox" value="${h}" ${bloqueados.includes(h)?'checked':''}/>
              <div class="neon-checkbox__frame">
                <div class="neon-checkbox__glow"></div>
                <div class="neon-checkbox__box"></div>
                <div class="neon-checkbox__borders"><span></span><span></span><span></span><span></span></div>
                <div class="neon-checkbox__check-container">
                  <svg class="neon-checkbox__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="neon-checkbox__particles"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
                <div class="neon-checkbox__rings"><div class="ring"></div><div class="ring"></div><div class="ring"></div></div>
                <div class="neon-checkbox__sparks"><span></span><span></span><span></span><span></span></div>
              </div>
            </label>
            ${h}
          </label>`).join('')}
      </div>
      <div class="modal-btns">
        <button class="btn-modal-cancel" onclick="document.getElementById('ag-bloq-overlay').remove()">Cancelar</button>
        <button class="btn-modal-ok" onclick="agSalvarBloqueio('${data}')">💾 Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function agSalvarBloqueio(data) {
  const checks = document.querySelectorAll('#ag-bloq-overlay input[type=checkbox]:checked');
  const horas = Array.from(checks).map(c => c.value);
  if (horas.length === 0) {
    delete agHorariosBloqueados[data];
  } else {
    agHorariosBloqueados[data] = horas;
  }
  await salvarAgendamentos();
  document.getElementById('ag-bloq-overlay').remove();
  mostrarToast(horas.length > 0 ? `🔒 ${horas.length} horário(s) bloqueado(s)` : '✓ Bloqueios removidos');
  renderAgendamentos();
}

// ══════════════════════════════════════════════════════
// REQ 2: LEMBRETE 24H ANTES DO AGENDAMENTO
// ══════════════════════════════════════════════════════

function agVerificarLembretes() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];

  const agAmanha = agendamentos.filter(a => a.data === amanhaStr && a.status !== 'cancelado' && a.status !== 'concluido');
  if (agAmanha.length === 0) return;

  const msg = agAmanha.length === 1
    ? `📅 Lembrete: você tem 1 agendamento amanhã — ${agAmanha[0].cliente||'Cliente'} às ${agAmanha[0].hora||'—'}`
    : `📅 Lembrete: você tem ${agAmanha.length} agendamentos amanhã`;

  // Mostrar toast de lembrete
  setTimeout(() => mostrarToast(msg, 6000), 2000);
}

// ══════════════════════════════════════════════════════
// REQ 3: CADASTRO COMPLETO — CPF/CNPJ NA OS E ORÇAMENTO
// ══════════════════════════════════════════════════════

function fmtCPFCNPJ(v) {
  const n = (v||'').replace(/\D/g,'');
  if (n.length <= 11) {
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// ══════════════════════════════════════════════════════
// REQ 4: MÚLTIPLOS VEÍCULOS POR CLIENTE
// ══════════════════════════════════════════════════════

let clientesCadastrados = []; // cache de clientes com múltiplos veículos

function clienteBuscarVeiculos(nome) {
  if (!nome || nome.length < 3) return [];
  const nomeLower = nome.toLowerCase();
  const mapa = {};
  ordens.filter(o => o.cliente && o.cliente.toLowerCase().includes(nomeLower)).forEach(os => {
    const key = os.cliente.toLowerCase();
    if (!mapa[key]) mapa[key] = { cliente: os.cliente, veiculos: [] };
    if (os.veiculo && !mapa[key].veiculos.find(v => v.placa === os.placa)) {
      mapa[key].veiculos.push({ veiculo: os.veiculo, placa: os.placa||'' });
    }
  });
  return Object.values(mapa);
}

function clienteAutoCompleteOS(osId, campo) {
  const os = ordens.find(o => o.id === osId);
  if (!os) return;
  const nome = os.cliente || '';
  const resultados = clienteBuscarVeiculos(nome);
  const container = document.getElementById('os-veiculo-sugestoes-' + osId);
  if (!container) return;

  if (resultados.length === 0 || nome.length < 3) { container.innerHTML = ''; return; }

  const cliente = resultados[0];
  if (cliente.veiculos.length <= 1) { container.innerHTML = ''; return; }

  container.innerHTML = '<div style="font-size:.68rem;color:var(--color-text-muted);margin-bottom:4px">Veículos anteriores:</div>'
    + cliente.veiculos.map(v =>
        '<button onclick="osSalvarCampo(\'' + osId + '\',\'veiculo\',\'' + v.veiculo.replace(/'/g,"\\'") + '\');osSalvarCampo(\'' + osId + '\',\'placa\',\'' + v.placa + '\');document.getElementById(\'os-veiculo-sugestoes-' + osId + '\').innerHTML=\'\'" '
        + 'style="display:block;width:100%;text-align:left;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:5px 10px;margin-bottom:4px;cursor:pointer;font-size:.78rem;color:var(--texto)">'
        + v.veiculo + (v.placa ? ' <span style="color:var(--color-text-muted)">· ' + v.placa + '</span>' : '')
        + '</button>'
      ).join('');
}

// ══════════════════════════════════════════════════════
// REQ 5: PONTO DE REPOSIÇÃO AUTOMÁTICO
// ══════════════════════════════════════════════════════

function estVerificarReposicao() {
  const precisamRepor = estoque.filter(p => {
    const qtd = parseFloat(p.qtd)||0;
    const min = parseFloat(p.minimo)||0;
    return min > 0 && qtd === 0;
  });

  if (precisamRepor.length === 0) return;

  // Mostrar alerta de reposição após 3s do carregamento
  setTimeout(() => {
    const nomes = precisamRepor.slice(0,3).map(p => p.nome).join(', ');
    const extra = precisamRepor.length > 3 ? ` e mais ${precisamRepor.length - 3}` : '';
    mostrarToast(`⚠️ Reposição necessária: ${nomes}${extra}`, 5000);
  }, 3000);
}

function renderRelatorioReposicao() {
  const main = document.getElementById('mainContent');
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const zerados = estoque.filter(p => (parseFloat(p.qtd)||0) === 0 && (parseFloat(p.minimo)||0) > 0);
  const criticos = estoque.filter(p => {
    const qtd = parseFloat(p.qtd)||0; const min = parseFloat(p.minimo)||0;
    return qtd > 0 && min > 0 && qtd <= min;
  });

  const renderRows = (lista, cor) => lista.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:16px">Nenhum item</td></tr>'
    : lista.map(p => `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
        <td style="padding:8px 10px;font-weight:600">${p.nome}</td>
        <td style="padding:8px 10px;text-align:center;font-family:'JetBrains Mono',monospace;color:${cor}">${parseFloat(p.qtd)||0}</td>
        <td style="padding:8px 10px;text-align:center;color:var(--color-text-muted)">${parseFloat(p.minimo)||0}</td>
        <td style="padding:8px 10px;text-align:right">${parseFloat(p.custo)>0?fmt(p.custo):'—'}</td>
        <td style="padding:8px 10px;text-align:center">
          <button class="btn btn-sm" style="font-size:.68rem" onclick="sbIr(14)">Ver no estoque →</button>
        </td>
      </tr>`).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#fca5a5">🔄 Ponto de Reposição</span>
      <div class="toolbar-right">
        <button class="btn-voltar" onclick="sbIr(18)" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
        <button class="btn btn-sm" onclick="sbIr(14)">📦 Ir para Estoque</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:900;color:#fca5a5">${zerados.length}</div>
        <div style="font-size:.72rem;color:var(--color-text-muted)">Zerados (compra urgente)</div>
      </div>
      <div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:900;color:#fbbf24">${criticos.length}</div>
        <div style="font-size:.72rem;color:var(--color-text-muted)">Críticos (abaixo do mínimo)</div>
      </div>
    </div>

    <div style="background:rgba(13,35,71,.6);border:1px solid rgba(239,68,68,.2);border-radius:14px;padding:16px 20px;margin-bottom:16px">
      <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#fca5a5;margin-bottom:12px">⛔ ZERADOS — COMPRA URGENTE</div>
      <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead><tr style="border-bottom:1px solid rgba(255,255,255,.08)">
          <th style="padding:8px 10px;text-align:left;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">PEÇA</th>
          <th style="padding:8px 10px;text-align:center;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">ATUAL</th>
          <th style="padding:8px 10px;text-align:center;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">MÍNIMO</th>
          <th style="padding:8px 10px;text-align:right;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">CUSTO</th>
          <th></th>
        </tr></thead>
        <tbody>${renderRows(zerados, '#fca5a5')}</tbody>
      </table>
    </div>

    <div style="background:rgba(13,35,71,.6);border:1px solid rgba(251,191,36,.2);border-radius:14px;padding:16px 20px">
      <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#fbbf24;margin-bottom:12px">⚠️ CRÍTICOS — ABAIXO DO MÍNIMO</div>
      <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead><tr style="border-bottom:1px solid rgba(255,255,255,.08)">
          <th style="padding:8px 10px;text-align:left;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">PEÇA</th>
          <th style="padding:8px 10px;text-align:center;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">ATUAL</th>
          <th style="padding:8px 10px;text-align:center;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">MÍNIMO</th>
          <th style="padding:8px 10px;text-align:right;font-size:.65rem;color:var(--color-text-muted);letter-spacing:2px">CUSTO</th>
          <th></th>
        </tr></thead>
        <tbody>${renderRows(criticos, '#fbbf24')}</tbody>
      </table>
    </div>
  `;
}

// ══════════════════════════════════════════════════════
// MÓDULO AGENDAMENTOS
// ══════════════════════════════════════════════════════

let agCalMes = new Date().getMonth();
let agCalAno = new Date().getFullYear();
let agHorariosBloqueados = {}; // { 'YYYY-MM-DD': ['08:00','09:00',...] }
let agListaEspera = []; // clientes aguardando horário
let agModalAberto = null; // id do agendamento em edição

const AG_STATUS = {
  agendado:   { cor: '#60a5fa', bg: 'rgba(96,165,250,.15)',  icon: '🔵', txt: 'Agendado' },
  confirmado: { cor: '#34d399', bg: 'rgba(52,211,153,.15)',  icon: '✅', txt: 'Confirmado' },
  cancelado:  { cor: '#fca5a5', bg: 'rgba(252,165,165,.15)', icon: '❌', txt: 'Cancelado' },
  concluido:  { cor: '#a78bfa', bg: 'rgba(167,139,250,.15)', icon: '🏁', txt: 'Concluído' },
};

const AG_TIPOS = ['Revisão geral','Troca de óleo','Freios','Pneus','Elétrica','Funilaria','Suspensão','Carburador','Corrente','Outro'];

async function salvarAgendamentos() {
  try {
    const ref = window._userDoc('agendamentos_lista');
    await window._firestoreSetDoc(ref, { lista: agendamentos, horariosBloqueados: agHorariosBloqueados, listaEspera: agListaEspera, atualizadoEm: new Date().toISOString() });
  } catch(e) {
    mostrarErro('Erro ao salvar agendamento.');
  }
}

// ── PAINEL DO DIA ─────────────────────────────────────────────
let agDiaSelecionado = null;
let agBuscaCliente = '';

function agAbrirDia(data) {
  agDiaSelecionado = data;
  agModalAberto = null;
  renderAgendamentos();
}

function agModalDiaHTML() {
  if (!agDiaSelecionado) return '';
  const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  const [y, m, d] = agDiaSelecionado.split('-').map(Number);
  const dataObj = new Date(y, m - 1, d);
  const nomeDia = DIAS_SEMANA[dataObj.getDay()];
  const dataFmt = d.toString().padStart(2,'0') + '/' + m.toString().padStart(2,'0') + '/' + y;

  const ags = agendamentos.filter(a => a.data === agDiaSelecionado)
    .sort((a,b) => (a.hora||'').localeCompare(b.hora||''));

  let listaHTML = '';
  if (ags.length === 0) {
    listaHTML = '<div style="text-align:center;padding:20px 0;color:var(--color-text-muted);font-size:.82rem">Nenhum agendamento neste dia</div>';
  } else {
    ags.forEach(a => {
      const s = AG_STATUS[a.status] || AG_STATUS['agendado'];
      listaHTML += `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.06);margin-bottom:6px;background:#1a1b22;cursor:pointer;transition:transform .2s cubic-bezier(.23,1,.32,1),box-shadow .2s,border-color .2s"
        onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background='#212121'"
        onclick="agDiaSelecionado=null;agModalAberto='${a.id}';renderAgendamentos()">
        <div style="font-size:1rem">${s.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.cliente||'Sem nome'}</div>
          <div style="font-size:.7rem;color:var(--color-text-muted)">${a.hora||'—'} &middot; ${a.veiculo||a.tipo||'—'}</div>
        </div>
        ${agStatusBadge(a.status)}
      </div>`;
    });
  }

  return `<div onclick="if(event.target===this){agDiaSelecionado=null;renderAgendamentos()}"
    style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px">
    <div onclick="event.stopPropagation()" style="background:#1a1b22;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.6)">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-size:.68rem;color:var(--color-text-muted);letter-spacing:2px">${nomeDia.toUpperCase()}</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--color-text-primary)">${dataFmt}</div>
        </div>
        <button onclick="agDiaSelecionado=null;renderAgendamentos()"
          style="background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:.9rem">✕</button>
      </div>

      <!-- Lista do dia -->
      <div style="margin-bottom:14px;max-height:280px;overflow-y:auto">
        ${listaHTML}
      </div>

      <!-- Botão novo agendamento -->
      <button onclick="agDiaSelecionado=null;agSelecionarCliente('${agDiaSelecionado}')"
        style="width:100%;padding:11px;background:rgba(43,224,140,.12);border:1px solid rgba(43,224,140,.3);color:#2BE08C;border-radius:10px;cursor:pointer;font-size:.85rem;font-weight:600">
        + Novo Agendamento
      </button>
    </div>
  </div>`;
}

// ── SELETOR DE CLIENTE ────────────────────────────────────────
let agSelecionarClienteData = null;

function agSelecionarCliente(data) {
  agSelecionarClienteData = data;
  agBuscaCliente = '';
  renderAgendamentos();
}

function agSelecionarClienteComHora(data, hora) {
  agSelecionarClienteData = data;
  agBuscaCliente = '';
  agHoraPre = hora;
  renderAgendamentos();
}

function agSelecionarClienteHTML() {
  if (!agSelecionarClienteData) return '';

  const busca = agBuscaCliente.toLowerCase();
  const lista = (clientesCadastradosManuais || [])
    .filter(c => !busca || (c.nome||'').toLowerCase().includes(busca) || (c.telefone||'').includes(busca))
    .slice(0, 20);

  let itens = '';
  if (lista.length === 0) {
    itens = '<div style="text-align:center;padding:20px;color:var(--color-text-muted);font-size:.82rem">Nenhum cliente encontrado</div>';
  } else {
    lista.forEach(c => {
      itens += `<div onclick="agCriarComCliente('${c.id}')"
        style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.05);margin-bottom:5px;background:#1a1b22;cursor:pointer;transition:transform .2s cubic-bezier(.23,1,.32,1),box-shadow .2s,border-color .2s"
        onmouseover="this.style.background='rgba(255,255,255,.07)'" onmouseout="this.style.background='#212121'">
        <div style="width:34px;height:34px;border-radius:50%;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:#93c5fd;flex-shrink:0">
          ${(c.nome||'?').charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nome||'—'}</div>
          <div style="font-size:.7rem;color:var(--color-text-muted)">${c.telefone||''} ${c.veiculo ? '&middot; ' + c.veiculo : ''}</div>
        </div>
        <span style="font-size:.65rem;color:var(--color-text-muted)">▶</span>
      </div>`;
    });
  }

  return `<div onclick="if(event.target===this){agSelecionarClienteData=null;renderAgendamentos()}"
    style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px">
    <div onclick="event.stopPropagation()" style="background:#1a1b22;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.6)">

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-size:.92rem;font-weight:700;color:var(--color-text-primary)">📅 Novo Agendamento</div>
        <button onclick="agSelecionarClienteData=null;renderAgendamentos()"
          style="background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:.9rem">✕</button>
      </div>

      <!-- Data -->
      <div style="margin-bottom:12px">
        <label style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);display:block;margin-bottom:5px">Data do agendamento</label>
        <input type="date" value="${agSelecionarClienteData}"
          oninput="agSelecionarClienteData=this.value"
          style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--color-text-primary);border-radius:10px;padding:9px 14px;font-size:.85rem"/>
      </div>

      <!-- Busca -->
      <div style="margin-bottom:8px">
        <label style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45);display:block;margin-bottom:5px">Cliente</label>
        <input type="text" placeholder="Buscar cliente..." value="${agBuscaCliente}"
          oninput="agBuscaCliente=this.value;renderAgendamentos()"
          style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--color-text-primary);border-radius:10px;padding:9px 14px;font-size:.85rem;margin-bottom:0"/>
      </div>

      <!-- Lista -->
      <div style="max-height:300px;overflow-y:auto;margin-bottom:12px">
        ${itens}
      </div>

      <!-- Sem cadastro -->
      <div style="border-top:1px solid rgba(255,255,255,.06);padding-top:12px;text-align:center">
        <span style="font-size:.75rem;color:var(--color-text-muted)">Cliente não cadastrado? </span>
        <button onclick="agCriarSemCliente()"
          style="background:transparent;border:none;color:#93c5fd;font-size:.75rem;cursor:pointer;text-decoration:underline">Adicionar sem cadastro</button>
      </div>
    </div>
  </div>`;
}

function agCriarComCliente(clienteId) {
  const cli = (clientesCadastradosManuais || []).find(c => c.id === clienteId);
  agNovoAgendamento(agSelecionarClienteData, cli);
  agSelecionarClienteData = null;
}

function agCriarSemCliente() {
  agNovoAgendamento(agSelecionarClienteData, null);
  agSelecionarClienteData = null;
}

function agNovoAgendamento(data, cli) {
  const id = 'ag_' + Date.now();
  agModalAberto = id;
  agendamentos.push({
    id,
    data: data || hojeISO(),
    hora: agHoraPre || '08:00',
    cliente: cli ? (cli.nome || '') : '',
    telefone: cli ? (cli.telefone || '') : '',
    placa: cli ? (cli.placa || '') : '',
    veiculo: cli ? (cli.veiculo || '') : '',
    tipo: AG_TIPOS[0],
    obs: '',
    status: 'agendado',
    criadoEm: new Date().toISOString()
  });
  agHoraPre = '';
  salvarAgendamentos();
  renderAgendamentos();
}

function agConverterParaOrcamento(agId) {
  const ag = agendamentos.find(a => a.id === agId);
  if (!ag) return;
  orcNovoOrcamento({ cliente: ag.cliente||'', veiculo: ag.veiculo||'', placa: ag.placa||'', telefone: ag.telefone||'', obs: ag.obs||'' });
  agSalvarCampo(agId, 'status', 'confirmado');
  agModalAberto = null;
  abaAtiva = 13;
  renderAll();
  mostrarToast('✓ Chegada confirmada! Orçamento criado para ' + (ag.cliente||'cliente'));
}

// C04 — Agendamento → OS direta ──────────────────────────────────
async function agConverterParaOS(agId) {
  const ag = agendamentos.find(a => a.id === agId);
  if (!ag) return;
  await osCarregarContador();
  osContador++;
  const novaOS = {
    id: 'os_' + Date.now(),
    numero: osContador,
    agId: agId,
    cliente:   ag.cliente||'',
    telefone:  ag.telefone||'',
    veiculo:   ag.veiculo||'',
    placa:     ag.placa||'',
    km:        '',
    itens:     [],
    total:     0,
    status:    'aberta',
    mecanico:  '',
    dataEntrada:      new Date().toISOString().split('T')[0],
    previsaoEntrega:  '',
    descricao:        ag.tipo ? ag.tipo + (ag.obs?'\n'+ag.obs:'') : (ag.obs||''),
    obsInternas:      '',
    obsCliente:       '',
    checklist:        [],
    historico:        [],
    criadoEm:         new Date().toISOString()
  };
  ordens.unshift(novaOS);
  await salvarOS();
  agSalvarCampo(agId, 'status', 'confirmado');
  agModalAberto = null;
  mostrarToast('✓ OS ' + osNumeroFormatado(novaOS.numero) + ' criada! Cliente ' + (ag.cliente||'') + ' chegou.');
  osAberta = novaOS.id;
  abaAtiva = 15;
  renderAll();
}

function agExcluir(id) {
  confirmarExclusao('este agendamento', () => {
    agendamentos = agendamentos.filter(a => a.id !== id);
    if (agModalAberto === id) agModalAberto = null;
    salvarAgendamentos();
    renderAgendamentos();
  });
}

async function agSalvarCampo(id, campo, valor) {
  const ag = agendamentos.find(a => a.id === id);
  if (!ag) return;
  ag[campo] = valor;
  await salvarAgendamentos();
}

function agStatusBadge(status) {
  const s = AG_STATUS[status] || AG_STATUS['agendado'];
  return '<span style="font-size:.68rem;background:' + s.bg + ';border:1px solid ' + s.cor + '33;color:' + s.cor + ';border-radius:6px;padding:2px 8px;white-space:nowrap">' + s.icon + ' ' + s.txt + '</span>';
}

function agDiasDoMes(mes, ano) {
  return new Date(ano, mes + 1, 0).getDate();
}

function agPrimeiroDiaSemana(mes, ano) {
  return new Date(ano, mes, 1).getDay(); // 0=Dom
}

function renderAgendamentos() {
  const main = document.getElementById('mainContent');
  const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Novembro','Dezembro'];
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const hoje = hojeISO();
  const totalDias   = agDiasDoMes(agCalMes, agCalAno);
  const primeiroDia = agPrimeiroDiaSemana(agCalMes, agCalAno);
  const HORARIOS_DIA = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

  // ── STATS ──────────────────────────────────────────────────
  const agsHojeAll = agendamentos.filter(a => a.data === hoje);
  const totalMes   = agendamentos.filter(a => {
    if (!a.data) return false;
    const [y,m] = a.data.split('-').map(Number);
    return y === agCalAno && (m-1) === agCalMes;
  });
  const confirmados = totalMes.filter(a => a.status === 'confirmado' || a.status === 'concluido').length;
  const aguardando  = totalMes.filter(a => a.status === 'agendado').length;
  const cancelados  = totalMes.filter(a => a.status === 'cancelado').length;

  // ── CALENDÁRIO ─────────────────────────────────────────────
  let celulas = [];
  for (let i = 0; i < primeiroDia; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  const diasHTML = celulas.map(d => {
    if (!d) return '<div></div>';
    const dataStr = agCalAno + '-' + String(agCalMes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const agsD = agendamentos.filter(a => a.data === dataStr).sort((a,b) => (a.hora||'').localeCompare(b.hora||''));
    const isHoje = dataStr === hoje;
    const isSel  = agDiaSelecionado === dataStr || (agModalAberto && agendamentos.find(a=>a.id===agModalAberto)?.data===dataStr);
    const isBloq = agHorariosBloqueados[dataStr]?.length > 0;

    const chips = agsD.slice(0,2).map(a => {
      const s = AG_STATUS[a.status] || AG_STATUS['agendado'];
      return '<div style="font-size:.62rem;padding:1px 5px;border-radius:3px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:' + s.bg + ';color:' + s.cor + '">'
        + (a.hora||'') + ' ' + (a.cliente||'').split(' ')[0]
        + '</div>';
    }).join('');
    const extra = agsD.length > 2 ? '<div style="font-size:.58rem;color:var(--color-text-muted)">+' + (agsD.length-2) + '</div>' : '';

    return '<div onclick="agAbrirDia(\'' + dataStr + '\')" style="'
      + 'border:' + (isSel ? '1.5px solid #60a5fa' : isHoje ? '1.5px solid #34d399' : '1px solid rgba(255,255,255,.07)') + ';'
      + 'border-radius:10px;padding:5px 6px;min-height:68px;cursor:pointer;'
      + 'background:' + (isSel ? 'rgba(96,165,250,.08)' : isHoje ? 'rgba(52,211,153,.06)' : 'rgba(255,255,255,.025)') + ';'
      + 'transition:border-color .15s,background .15s'
      + '" onmouseover="this.style.borderColor=\'rgba(255,255,255,.2)\'" onmouseout="this.style.borderColor=\'' + (isSel?'#60a5fa':isHoje?'#34d399':'rgba(255,255,255,.07)') + '\'">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px">'
      + '<div style="font-size:.78rem;font-weight:700;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;'
      + (isHoje ? 'background:#F5D547;color:#0a0a0b' : 'color:var(--color-text-primary)') + '">' + d + '</div>'
      + (isBloq ? '<span style="font-size:.55rem;color:#fca5a5">🔒</span>' : '')
      + (agsD.length > 0 ? '<span style="font-size:.6rem;color:var(--color-text-muted)">' + agsD.length + '</span>' : '')
      + '</div>'
      + chips + extra
      + '</div>';
  }).join('');

  // ── PAINEL LATERAL: timeline do dia selecionado ────────────
  let painelHTML = '';
  if (agDiaSelecionado) {
    const [y,m,d] = agDiaSelecionado.split('-').map(Number);
    const dtObj = new Date(y, m-1, d);
    const nomeDia = DIAS_SEMANA[dtObj.getDay()];
    const dataFmt = String(d).padStart(2,'0') + '/' + String(m).padStart(2,'0') + '/' + y;
    const agsD = agendamentos.filter(a => a.data === agDiaSelecionado).sort((a,b) => (a.hora||'').localeCompare(b.hora||''));

    const timelineHTML = HORARIOS_DIA.map(h => {
      const ag = agsD.find(a => a.hora === h);
      if (ag) {
        const s = AG_STATUS[ag.status] || AG_STATUS['agendado'];
        return '<div style="display:flex;gap:8px;align-items:stretch;margin-bottom:4px">'
          + '<div style="font-size:.7rem;color:var(--color-text-muted);width:38px;padding-top:8px;text-align:right;flex-shrink:0">' + h + '</div>'
          + '<div style="display:flex;flex-direction:column;align-items:center;gap:0;flex-shrink:0">'
          + '<div style="width:8px;height:8px;border-radius:50%;background:' + s.cor + ';margin-top:10px;flex-shrink:0"></div>'
          + '<div style="flex:1;width:1px;background:rgba(255,255,255,.08);margin-top:2px"></div>'
          + '</div>'
          + '<div style="flex:1;padding-bottom:8px">'
          + '<div onclick="agModalAberto=\'' + ag.id + '\';agDiaSelecionado=null;renderAgendamentos()" style="background:' + s.bg + ';border:1px solid ' + s.cor + '33;border-radius:8px;padding:7px 10px;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity=\'.8\'" onmouseout="this.style.opacity=\'1\'">'
          + '<div style="display:flex;justify-content:space-between;align-items:center">'
          + '<span style="font-size:.8rem;font-weight:700;color:var(--color-text-primary)">' + (ag.cliente||'Sem nome') + '</span>'
          + agStatusBadge(ag.status)
          + '</div>'
          + '<div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">' + (ag.tipo||'Serviço') + (ag.veiculo?' &middot; '+ag.veiculo:'') + '</div>'
          + '</div>'
          + '</div>'
          + '</div>';
      } else {
        return '<div style="display:flex;gap:8px;align-items:stretch;margin-bottom:4px">'
          + '<div style="font-size:.7rem;color:rgba(255,255,255,.2);width:38px;padding-top:6px;text-align:right;flex-shrink:0">' + h + '</div>'
          + '<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">'
          + '<div style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.1);margin-top:8px;flex-shrink:0"></div>'
          + '<div style="flex:1;width:1px;background:rgba(255,255,255,.05);margin-top:2px"></div>'
          + '</div>'
          + '<div style="flex:1;padding-bottom:4px">'
          + '<div onclick="agSelecionarClienteComHora(\'' + agDiaSelecionado + '\',\'' + h + '\')" style="padding:4px 8px;border-radius:6px;cursor:pointer;color:rgba(255,255,255,.2);font-size:.72rem;transition:all .15s" onmouseover="this.style.background=\'rgba(52,211,153,.08)\';this.style.color=\'#34d399\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'rgba(255,255,255,.2)\'">'
          + '+ livre — agendar'
          + '</div>'
          + '</div>'
          + '</div>';
      }
    }).join('');

    painelHTML = '<div style="display:flex;flex-direction:column;gap:10px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between">'
      + '<div>'
      + '<div style="font-size:.65rem;letter-spacing:2px;color:var(--color-text-muted);text-transform:uppercase">' + nomeDia + '</div>'
      + '<div style="font-size:.95rem;font-weight:700">' + dataFmt + '</div>'
      + '</div>'
      + '<button onclick="agDiaSelecionado=null;renderAgendamentos()" style="background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:.8rem">✕</button>'
      + '</div>'
      + '<button onclick="agSelecionarCliente(\'' + agDiaSelecionado + '\')" style="width:100%;padding:9px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);color:#34d399;border-radius:8px;cursor:pointer;font-size:.8rem;font-weight:700">+ Novo agendamento neste dia</button>'
      + '<div style="overflow-y:auto;max-height:520px;padding-right:2px">' + timelineHTML + '</div>'
      + '</div>';

  } else if (agModalAberto) {
    const ag = agendamentos.find(a => a.id === agModalAberto);
    if (ag) {
      const s = AG_STATUS[ag.status] || AG_STATUS['agendado'];
      const optsStatus = Object.entries(AG_STATUS).map(([k,v]) => '<option value="' + k + '"' + (ag.status===k?' selected':'') + '>' + v.icon + ' ' + v.txt + '</option>').join('');
      const optsTipo   = AG_TIPOS.map(t => '<option value="' + t + '"' + (ag.tipo===t?' selected':'') + '>' + t + '</option>').join('');
      painelHTML = '<div style="display:flex;flex-direction:column;gap:0">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
        + '<div style="font-size:.65rem;letter-spacing:2px;color:' + s.cor + ';text-transform:uppercase">✏️ Editar Agendamento</div>'
        + '<button onclick="agModalAberto=null;renderAgendamentos()" style="background:transparent;border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:.8rem">✕</button>'
        + '</div>'
        + '<div style="background:' + s.bg + ';border:1px solid ' + s.cor + '33;border-radius:10px;padding:12px;margin-bottom:12px">'
        + '<div style="font-size:1rem;font-weight:700">' + (ag.cliente||'Sem Nome') + '</div>'
        + '<div style="font-size:.75rem;color:var(--color-text-muted);margin-top:2px">' + (ag.tipo||'Serviço') + ' &middot; ' + (ag.data ? new Date(ag.data+'T12:00:00').toLocaleDateString('pt-BR') : '—') + ' ' + (ag.hora||'') + '</div>'
        + '</div>'
        + '<div class="orc-field"><label>📅 Data</label><input type="date" value="' + ag.data + '" oninput="agSalvarCampo(\'' + ag.id + '\',\'data\',this.value);renderAgendamentos()"/></div>'
        + '<div class="orc-field"><label>⏰ Hora</label><input type="time" value="' + (ag.hora||'08:00') + '" oninput="agSalvarCampo(\'' + ag.id + '\',\'hora\',this.value)"/></div>'
        + '<div class="orc-field"><label>👤 Cliente</label><input type="text" value="' + (ag.cliente||'').replace(/"/g,'&quot;') + '" placeholder="Nome do cliente..." oninput="agSalvarCampo(\'' + ag.id + '\',\'cliente\',this.value)"/></div>'
        + '<div class="orc-field"><label>📞 Telefone</label><input type="text" value="' + (ag.telefone||'').replace(/"/g,'&quot;') + '" placeholder="(17) 99999-9999" oninput="agSalvarCampo(\'' + ag.id + '\',\'telefone\',this.value)"/></div>'
        + '<div class="orc-field"><label>🏍️ Veículo</label><input type="text" value="' + (ag.veiculo||'').replace(/"/g,'&quot;') + '" placeholder="Modelo..." oninput="agSalvarCampo(\'' + ag.id + '\',\'veiculo\',this.value)"/></div>'
        + '<div class="orc-field"><label>🔖 Placa</label><input type="text" value="' + (ag.placa||'').replace(/"/g,'&quot;') + '" placeholder="ABC-1234" style="text-transform:uppercase" oninput="agSalvarCampo(\'' + ag.id + '\',\'placa\',this.value.toUpperCase());this.value=this.value.toUpperCase()"/></div>'
        + '<div class="orc-field"><label>🔧 Tipo de Serviço</label><select onchange="agSalvarCampo(\'' + ag.id + '\',\'tipo\',this.value)">' + optsTipo + '</select></div>'
        + '<div class="orc-field"><label>📊 Status</label><select onchange="agSalvarCampo(\'' + ag.id + '\',\'status\',this.value);renderAgendamentos()">' + optsStatus + '</select></div>'
        + '<div class="orc-field"><label>📝 Observações</label><textarea placeholder="Anotações sobre o serviço..." style="height:60px;resize:vertical" oninput="agSalvarCampo(\'' + ag.id + '\',\'obs\',this.value)">' + (ag.obs||'') + '</textarea></div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">'
        + '<button onclick="agConverterParaOrcamento(\'' + ag.id + '\')" class="btn ag-ticket-btn-orc" style="width:100%">🏍️ Confirmar Chegada → Orçamento</button>'
        + '<button onclick="agConverterParaOS(\'' + ag.id + '\')" class="btn" style="width:100%;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.4);color:#a78bfa;font-weight:700">🔧 Iniciar OS diretamente</button>'
        + '<button onclick="agExcluir(\'' + ag.id + '\')" class="btn btn-del" style="width:100%">🗑 Excluir</button>'
        + '</div>'
        + '</div>';
    }
  } else {
    painelHTML = '<div style="text-align:center;padding:30px 16px;color:var(--color-text-muted);font-size:.8rem;border:1px dashed rgba(255,255,255,.1);border-radius:12px">'
      + '<div style="font-size:1.5rem;margin-bottom:8px">📅</div>'
      + 'Clique em um dia para ver a agenda ou em um agendamento para editar'
      + '</div>';
  }

  // ── LISTA HOJE (coluna direita) ────────────────────────────
  const hojeListaHTML = agsHojeAll.length === 0
    ? '<div style="font-size:.75rem;color:var(--color-text-muted);text-align:center;padding:12px 0">Nenhum agendamento hoje</div>'
    : agsHojeAll.sort((a,b)=>(a.hora||'').localeCompare(b.hora||'')).map(a => {
        const s = AG_STATUS[a.status] || AG_STATUS['agendado'];
        return '<div onclick="agModalAberto=\'' + a.id + '\';agDiaSelecionado=null;renderAgendamentos()" class="ag-hoje-card">'
          + '<div style="font-size:.9rem">' + s.icon + '</div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (a.cliente||'Sem nome') + '</div>'
          + '<div style="font-size:.68rem;color:var(--color-text-muted)">' + (a.hora||'—') + ' &middot; ' + (a.tipo||'—') + '</div>'
          + '</div>'
          + agStatusBadge(a.status)
          + '</div>';
      }).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-size:1.1rem;font-weight:700;letter-spacing:2px;color:var(--color-text-primary)">📅 Agendamentos</span>
      <div class="toolbar-right">
        <button class="btn" style="background:rgba(245,213,71,.08);border:1px solid rgba(245,213,71,.2);color:#F5D547" onclick="agAdicionarEspera()" id="btn-lista-espera">⏳ Lista de Espera</button>
        <button class="btn btn-add" onclick="agSelecionarCliente('${hoje}')">+ Novo Agendamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
      </div>
    </div>

    <!-- STATS -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      <div style="background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.15);border-radius:10px;padding:12px">
        <div style="font-size:1.4rem;font-weight:700;color:#60a5fa">${agsHojeAll.length}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">Hoje</div>
      </div>
      <div style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.15);border-radius:10px;padding:12px">
        <div style="font-size:1.4rem;font-weight:700;color:#34d399">${confirmados}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">Confirmados</div>
      </div>
      <div style="background:rgba(245,213,71,.08);border:1px solid rgba(245,213,71,.15);border-radius:10px;padding:12px">
        <div style="font-size:1.4rem;font-weight:700;color:#F5D547">${aguardando}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">Aguardando</div>
      </div>
      <div style="background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.15);border-radius:10px;padding:12px">
        <div style="font-size:1.4rem;font-weight:700;color:#fca5a5">${cancelados}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">Cancelados</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 280px 240px;gap:14px;align-items:flex-start">

      <!-- CALENDÁRIO -->
      <div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-size:.95rem;font-weight:700">${MESES_FULL[agCalMes]} ${agCalAno}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <button onclick="agCalMes--;if(agCalMes<0){agCalMes=11;agCalAno--;}renderAgendamentos()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--color-text-primary);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:.9rem">‹</button>
            <button onclick="agCalMes=new Date().getMonth();agCalAno=new Date().getFullYear();renderAgendamentos()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:.72rem">Hoje</button>
            <button onclick="agCalMes++;if(agCalMes>11){agCalMes=0;agCalAno++;}renderAgendamentos()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--color-text-primary);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:.9rem">›</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">
          ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>'<div style="text-align:center;font-size:.65rem;color:var(--color-text-muted);padding:3px 0;font-weight:600">'+d+'</div>').join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">
          ${diasHTML}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)">
          ${Object.entries(AG_STATUS).map(([k,v])=>'<div style="display:flex;align-items:center;gap:4px;font-size:.65rem;color:var(--color-text-muted)"><div style="width:8px;height:8px;border-radius:2px;background:'+v.cor+'"></div>'+v.txt+'</div>').join('')}
          <div style="display:flex;align-items:center;gap:4px;font-size:.65rem;color:var(--color-text-muted)"><div style="width:8px;height:8px;border-radius:2px;background:rgba(248,113,113,.4)">🔒</div> Bloqueado <span style="font-size:.6rem">(Shift+clique)</span></div>
        </div>
      </div>

      <!-- PAINEL LATERAL: dia selecionado ou edição -->
      <div style="background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;overflow-y:auto;max-height:620px">
        ${painelHTML}
      </div>

      <!-- COLUNA DIREITA: hoje -->
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="zl-card" style="padding:14px">
          <div style="font-family:'Inter';font-size:.75rem;letter-spacing:3px;color:#60a5fa;margin-bottom:10px">📅 HOJE</div>
          ${hojeListaHTML}
        </div>
      </div>

    </div>
  `;

  // Modais overlay
  let agOverlay = document.getElementById('ag-overlay-container');
  if (!agOverlay) {
    agOverlay = document.createElement('div');
    agOverlay.id = 'ag-overlay-container';
    document.body.appendChild(agOverlay);
  }
  agOverlay.innerHTML = agSelecionarClienteData ? agSelecionarClienteHTML() : '';
}

// ═══════════════════════════════════════════
// SINO — RESUMO DO DIA
// ═══════════════════════════════════════════
let sinoAberto = false;