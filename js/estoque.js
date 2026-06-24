async function estSalvar() {
  try {
    const ref = window._userDoc('estoque_global');
    await window._firestoreSetDoc(ref, { itens: estoque, atualizadoEm: new Date().toISOString() });
    // Atualiza catálogo automaticamente
    catCarregarDoEstoque();
  } catch(e) {
    console.warn('Erro ao salvar estoque:', e);
    mostrarErro('Erro ao salvar estoque — verifique conexão');
  }
}

function estCalcResumo() {
  const total = estoque.length;
  const totalCusto = estoque.reduce((s,p) => s + (parseFloat(p.custo)||0)*(parseFloat(p.qtd)||0), 0);
  const totalVenda = estoque.reduce((s,p) => s + (parseFloat(p.venda)||0)*(parseFloat(p.qtd)||0), 0);
  const emAlerta = estoque.filter(p => (parseFloat(p.qtd)||0) <= (parseFloat(p.minimo)||0)).length;
  return { total, totalCusto, totalVenda, emAlerta };
}

function atualizarListaEstoque() {
  const el = document.getElementById('est-lista-body');
  if (!el) { renderEstoque(); return; }
  const resumo = estCalcResumo();
  const filtradas = estFiltradas();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  if (!filtradas.length) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted);padding:20px">Nenhuma peça encontrada</td></tr>';
    return;
  }
  el.innerHTML = filtradas.map(function(p) {
    const realIdx = estoque.indexOf(p);
    const qtd = parseFloat(p.qtd)||0;
    const custo = parseFloat(p.custo)||0;
    const venda = parseFloat(p.venda)||0;
    const margem = venda > 0 && custo > 0 ? Math.round(((venda-custo)/custo)*100) : 0;
    const emAlerta = p.minimo && qtd <= parseFloat(p.minimo);
    const margemHtml = margem > 0 ? '<span style="color:#34d399;font-size:.78rem">+' + margem + '%</span>' : '—';
    return '<tr style="' + (emAlerta?'background:rgba(239,68,68,.06)':'') + '">'
      + '<td style="padding:8px 10px;font-weight:600">' + (p.nome||'—') + (emAlerta?'<span style="color:#f87171;font-size:.65rem;margin-left:4px">⚠ baixo</span>':'') + '</td>'
      + '<td style="padding:8px 10px;color:var(--color-text-muted);font-size:.78rem">' + (p.cat||'—') + '</td>'
      + '<td style="padding:8px 10px;font-weight:700;color:' + (emAlerta?'#f87171':'var(--color-text-primary)') + '">' + qtd + '</td>'
      + '<td style="padding:8px 10px;color:var(--color-text-muted)">' + fmtN(custo) + '</td>'
      + '<td class="col-venda" style="padding:8px 10px">' + (venda>0?fmtN(venda):'—') + '</td>'
      + '<td class="col-margem" style="padding:8px 10px">' + margemHtml + '</td>'
      + '<td style="padding:8px 10px;white-space:nowrap"><div style="display:flex;gap:5px;flex-wrap:wrap">'
      + '<button class="btn btn-sm" style="background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);color:var(--color-primary-hover)" onclick="estAbrirMovimento(' + realIdx + ')">↕ Mov.</button>'
      + '<button class="btn btn-sm btn-duplic" onclick="estAbrirCadastro(' + realIdx + ')">✏️</button>'
      + '<button class="btn btn-del btn-sm" onclick="estExcluir(' + realIdx + ')">✕</button>'
      + '</div></td></tr>';
  }).join('');
}

function estFiltradas() {
  return estoque.filter(p => {
    const catOk = estFiltroCAT === 'Todos' || p.cat === estFiltroCAT;
    const buscaOk = !estBusca || p.nome.toLowerCase().includes(estBusca.toLowerCase());
    const alertaOk = !estMostrarApenasAlerta || (parseFloat(p.qtd)||0) <= (parseFloat(p.minimo)||0);
    return catOk && buscaOk && alertaOk;
  });
}

function estAbrirMovimento(idx) {
  const p = estoque[idx];
  const overlay = document.createElement('div');
  overlay.className = 'est-mov-overlay';
  overlay.id = 'est-mov-overlay';
  overlay.innerHTML = `
    <div class="est-mov-box">
      <div class="est-mov-titulo" style="color:var(--color-primary-hover)">📦 Movimentar Estoque</div>
      <div style="font-size:.88rem;color:var(--color-text-primary);margin-bottom:16px;font-weight:600">${p.nome}</div>
      <div style="font-size:.78rem;color:var(--color-text-muted);margin-bottom:16px">Qtd atual: <span style="color:var(--color-primary-hover);font-family:'JetBrains Mono',monospace">${p.qtd||0}</span></div>
      <div class="est-tipo-btns">
        <button class="est-tipo-btn entrada ativo" id="est-btn-entrada" onclick="estToggleTipo('entrada')">▲ Entrada</button>
        <button class="est-tipo-btn saida" id="est-btn-saida" onclick="estToggleTipo('saida')">▼ Saída</button>
      </div>
      <div class="est-mov-campo">
        <label>Quantidade</label>
        <input type="number" id="est-mov-qtd" min="1" step="1" value="1" style="font-family:'JetBrains Mono',monospace;font-size:1.1rem;color:var(--color-primary-hover)"/>
      </div>
      <div class="est-mov-campo" id="est-mov-custo-wrap" style="display:none">
        <label>💰 Custo unitário desta entrada (R$) <span style="font-size:.65rem;color:var(--color-text-muted)">— atualiza custo médio</span></label>
        <input type="number" id="est-mov-custo-entrada" min="0" step="0.01" placeholder="0,00" value="${p.custo||''}" style="font-family:'JetBrains Mono',monospace;color:#fca5a5"/>
        <span style="font-size:.68rem;color:var(--color-text-muted);margin-top:4px">Custo médio atual: R$ ${parseFloat(p.custo||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
      </div>
      <div class="est-mov-campo">
        <label>Motivo (opcional)</label>
        <input type="text" id="est-mov-motivo" placeholder="Ex: Compra fornecedor, Venda balcão..."/>
      </div>
      <div class="modal-btns">
        <button class="btn-modal-cancel" onclick="document.getElementById('est-mov-overlay').remove()">Cancelar</button>
        <button class="btn-modal-ok" onclick="estConfirmarMov(${idx})">Confirmar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  _estTipoMov = 'entrada';
  const custoWrap = document.getElementById('est-mov-custo-wrap');
  if (custoWrap) custoWrap.style.display = '';
}

function estToggleTipo(tipo) {
  _estTipoMov = tipo;
  document.getElementById('est-btn-entrada').classList.toggle('ativo', tipo==='entrada');
  document.getElementById('est-btn-saida').classList.toggle('ativo', tipo==='saida');
  const custoWrap = document.getElementById('est-mov-custo-wrap');
  if (custoWrap) custoWrap.style.display = tipo === 'entrada' ? '' : 'none';
}

function estConfirmarMov(idx) {
  const qtd = parseInt(document.getElementById('est-mov-qtd').value) || 0;
  if (qtd <= 0) { mostrarErro('Informe uma quantidade válida'); return; }
  const p = estoque[idx];
  if (_estTipoMov === 'entrada') {
    const custoEntrada = parseFloat(document.getElementById('est-mov-custo-entrada') ? document.getElementById('est-mov-custo-entrada').value : 0) || 0;
    const qtdAtualAntes = parseFloat(p.qtd)||0;
    const custoAtual = parseFloat(p.custo)||0;
    // Custo médio ponderado: (qtdAnterior * custoAnterior + qtdEntrada * custoEntrada) / qtdTotal
    if (custoEntrada > 0) {
      const novoTotal = qtdAtualAntes + qtd;
      p.custo = novoTotal > 0 ? ((qtdAtualAntes * custoAtual + qtd * custoEntrada) / novoTotal).toFixed(2) : custoEntrada.toFixed(2);
    }
    p.qtd = qtdAtualAntes + qtd;
  } else {
    const atual = parseFloat(p.qtd)||0;
    if (qtd > atual) { mostrarErro('Quantidade insuficiente em estoque'); return; }
    p.qtd = atual - qtd;
  }
  estSalvar();
  document.getElementById('est-mov-overlay').remove();
  mostrarToast(_estTipoMov === 'entrada' ? `✓ +${qtd} unidades adicionadas` : `✓ -${qtd} unidades removidas`);
  renderEstoque();
}

function estAbrirCadastro(idx) {
  const edicao = idx !== undefined;
  const p = edicao ? estoque[idx] : { nome:'', cat:'Freio', qtd:'', custo:'', venda:'', minimo:'' };
  const overlay = document.createElement('div');
  overlay.className = 'est-mov-overlay';
  overlay.id = 'est-cad-overlay';
  overlay.innerHTML = `
    <div class="est-mov-box" style="width:480px">
      <div class="est-mov-titulo" style="color:var(--dourado)">${edicao?'✏️ Editar Peça':'➕ Nova Peça'}</div>
      <div class="est-mov-campo">
        <label>Nome da Peça *</label>
        <input type="text" id="est-cad-nome" value="${(p.nome||'').replace(/"/g,'&quot;')}" placeholder="Ex: Pastilha de freio Honda Titan..."/>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="est-mov-campo">
          <label>Categoria</label>
          <select id="est-cad-cat">
            ${EST_CATS.map(c => '<option value="' + c + '"' + (p.cat===c?' selected':'') + '>' + c + '</option>').join('')}
          </select>
        </div>
        <div class="est-mov-campo">
          <label>Quantidade</label>
          <input type="number" id="est-cad-qtd" value="${p.qtd||''}" min="0" step="1" placeholder="0" style="font-family:'JetBrains Mono',monospace"/>
        </div>
        <div class="est-mov-campo">
          <label>Preço de Custo (R$)</label>
          <input type="number" id="est-cad-custo" value="${p.custo||''}" min="0" step="0.01" placeholder="0,00" style="font-family:'JetBrains Mono',monospace;color:#fca5a5"/>
        </div>
        <div class="est-mov-campo">
          <label>Preço de Venda (R$)</label>
          <input type="number" id="est-cad-venda" value="${p.venda||''}" min="0" step="0.01" placeholder="0,00" style="font-family:'JetBrains Mono',monospace;color:#34d399"/>
        </div>
      </div>
      <div class="est-mov-campo">
        <label>Estoque Mínimo (alerta abaixo disso)</label>
        <input type="number" id="est-cad-min" value="${p.minimo||''}" min="0" step="1" placeholder="Ex: 2" style="font-family:'JetBrains Mono',monospace;color:var(--dourado)"/>
      </div>
      <div class="modal-btns">
        <button class="btn-modal-cancel" onclick="document.getElementById('est-cad-overlay').remove()">Cancelar</button>
        <button class="btn-modal-ok" onclick="estConfirmarCadastro(${edicao?idx:'undefined'})">${edicao?'Salvar':'Cadastrar'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('est-cad-nome').focus();
}

function estConfirmarCadastro(idx) {
  const nome = document.getElementById('est-cad-nome').value.trim();
  if (!nome) { mostrarErro('Informe o nome da peça'); return; }
  const peca = {
    id: (idx !== undefined ? estoque[idx].id : null) || Date.now(),
    nome,
    cat: document.getElementById('est-cad-cat').value,
    qtd: parseFloat(document.getElementById('est-cad-qtd').value) || 0,
    custo: document.getElementById('est-cad-custo').value,
    venda: document.getElementById('est-cad-venda').value,
    minimo: document.getElementById('est-cad-min').value,
  };
  if (idx !== undefined) {
    estoque[idx] = peca;
    mostrarToast('✓ Peça atualizada!');
  } else {
    estoque.unshift(peca);
    mostrarToast('✓ Peça cadastrada!');
  }
  estSalvar();
  document.getElementById('est-cad-overlay').remove();
  renderEstoque();
}

// ── TELA DE VENDA ────────────────────────────────────────────────
function abrirTelaVenda() {
  vendaBusca = '';
  vendaItens = [];
  vendaCliente = { nome: '', tel: '', id: null };
  vendaClienteBusca = '';
  vendaDesconto = 0;
  vendaDescontoTipo = 'valor';
  vendaPagamento = 'dinheiro';
  vendaModoModal = null;
  carregarHistoricoVendas();
  renderTelaVenda();
}

async function carregarHistoricoVendas() {
  try {
    const ref = window._userDoc('vendas_historico');
    const snap = await window._firestoreGetDoc(ref);
    if (snap.exists()) vendaHistorico = snap.data().lista || [];
  } catch(e) {}
}

function vendaEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function vendaSelecionarCliente(nome, tel, id) {
  vendaCliente = { nome, tel: tel||'', id: id||null };
  vendaClienteBusca = nome;
  vendaModoModal = null;
  renderTelaVenda();
}

function vendaCalcTotal() {
  const num = v => parseFloat(v)||0;
  const subtotal = vendaItens.reduce((s,it) => s + num(it.qtd)*num(it.vunit), 0);
  let desc = vendaDescontoTipo === 'percentual' ? subtotal*(num(vendaDesconto)/100) : num(vendaDesconto);
  desc = Math.min(desc, subtotal);
  return { subtotal, descValor: desc, total: subtotal - desc };
}

// ── Modal novo cliente rápido ─────────────────────────────────────
function vendaAbrirModalNovoCliente() {
  vendaModoModal = 'novo-cliente';
  renderTelaVenda();
}

async function vendaSalvarNovoCliente() {
  const nome = (document.getElementById('vnd-cli-nome')?.value||'').trim();
  const tel  = (document.getElementById('vnd-cli-tel')?.value||'').trim();
  const veic = (document.getElementById('vnd-cli-veic')?.value||'').trim();
  if (!nome) { mostrarToast('Informe o nome'); return; }
  const id = 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
  const cli = { id, nome, tel, veic, cpf:'', placa:'', email:'', obs:'', criadoEm: new Date().toISOString() };
  clientesCadastradosManuais.push(cli);
  await salvarCliente(cli);
  vendaSelecionarCliente(nome, tel, id);
  mostrarToast('✓ Cliente cadastrado!');
}

// ── Modal novo item manual ────────────────────────────────────────
function vendaAbrirModalNovoItem() {
  vendaModoModal = 'novo-item';
  renderTelaVenda();
}

function vendaAdicionarItemManual() {
  const desc  = (document.getElementById('vnd-item-desc')?.value||'').trim();
  const vunit = parseFloat(document.getElementById('vnd-item-val')?.value||0);
  const qtd   = parseInt(document.getElementById('vnd-item-qtd')?.value||1);
  if (!desc) { mostrarToast('Informe a descrição'); return; }
  const exist = vendaItens.find(it => it.desc === desc);
  if (exist) { exist.qtd += qtd; }
  else { vendaItens.push({ desc, qtd, vunit, _manual: true }); }
  vendaModoModal = null;
  renderTelaVenda();
}

// ── Render ────────────────────────────────────────────────────────
function renderTelaVenda() {
  const main = document.getElementById('mainContent');
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const num  = v => parseFloat(v)||0;

  // Modal novo cliente
  if (vendaModoModal === 'novo-cliente') {
    main.innerHTML = `
      <div class="toolbar">
        <span style="font-family:var(--font-titulo);font-size:1.2rem;letter-spacing:3px;color:#38bdf8">👤 Novo Cliente</span>
        <div class="toolbar-right">
          <button class="btn" onclick="vendaModoModal=null;renderTelaVenda()" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted)">← Voltar</button>
        </div>
      </div>
      <div style="max-width:480px;margin:0 auto;background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:12px">
        <div class="orc-field"><label>👤 Nome *</label><input id="vnd-cli-nome" type="text" placeholder="Nome completo..." autofocus/></div>
        <div class="orc-field"><label>📞 Telefone</label><input id="vnd-cli-tel" type="text" placeholder="(00) 00000-0000"/></div>
        <div class="orc-field"><label>🏍️ Veículo</label><input id="vnd-cli-veic" type="text" placeholder="Ex: Honda CG 160"/></div>
        <button onclick="vendaSalvarNovoCliente()" class="btn btn-add" style="width:100%;padding:13px;font-size:1rem;margin-top:4px">✓ Cadastrar e Selecionar<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
      </div>`;
    return;
  }

  // Modal novo item manual
  if (vendaModoModal === 'novo-item') {
    main.innerHTML = `
      <div class="toolbar">
        <span style="font-family:var(--font-titulo);font-size:1.2rem;letter-spacing:3px;color:#fbbf24">📦 Item Manual</span>
        <div class="toolbar-right">
          <button class="btn" onclick="vendaModoModal=null;renderTelaVenda()" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted)">← Voltar</button>
        </div>
      </div>
      <div style="max-width:480px;margin:0 auto;background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:14px;padding:24px;display:flex;flex-direction:column;gap:12px">
        <div class="orc-field"><label>📝 Descrição *</label><input id="vnd-item-desc" type="text" placeholder="Ex: Filtro de ar, Mão de obra..." autofocus/></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="orc-field"><label>💲 Valor unitário</label><input id="vnd-item-val" type="number" min="0" step="0.01" placeholder="0,00"/></div>
          <div class="orc-field"><label>🔢 Quantidade</label><input id="vnd-item-qtd" type="number" min="1" value="1"/></div>
        </div>
        <button onclick="vendaAdicionarItemManual()" class="btn btn-add" style="width:100%;padding:13px;font-size:1rem;margin-top:4px">✓ Adicionar à Venda<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
      </div>`;
    return;
  }

  // ── Autocomplete cliente ──────────────────────────────────────
  const clienteSelecionado = vendaCliente.nome !== '';
  const sugs = !clienteSelecionado && vendaClienteBusca.trim()
    ? (clientesCadastradosManuais||[]).filter(c => c.nome.toLowerCase().includes(vendaClienteBusca.toLowerCase())).slice(0,5)
    : [];

  const autoHtml = sugs.length
    ? '<div style="position:absolute;top:100%;left:0;right:0;background:#1a1a2e;border:1px solid var(--color-border);border-radius:10px;z-index:100;overflow:hidden;margin-top:3px">'
      + sugs.map(c => `<div onclick="vendaSelecionarCliente('${vendaEsc(c.nome)}','${vendaEsc(c.tel||'')}','${vendaEsc(c.id)}')"
        style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05)"
        onmouseover="this.style.background='rgba(56,189,248,.1)'" onmouseout="this.style.background=''">
        <div style="font-weight:700;font-size:.88rem">${vendaEsc(c.nome)}</div>
        <div style="font-size:.72rem;color:var(--color-text-muted)">${c.tel||''}${c.veic?' · '+c.veic:''}</div>
      </div>`).join('')
      + '</div>'
    : '';

  const mostrarBtnNovo = vendaClienteBusca.trim() && !clienteSelecionado
    && !(clientesCadastradosManuais||[]).find(c=>c.nome.toLowerCase()===vendaClienteBusca.toLowerCase());

  const campoCliente = `
    <div style="position:relative">
      <div style="display:flex;gap:8px;align-items:center">
        <input id="vnd-cli-inp" type="text" placeholder="Buscar cliente cadastrado..." value="${vendaEsc(vendaClienteBusca)}"
          oninput="vendaClienteBusca=this.value;vendaCliente={nome:'',tel:'',id:null};renderTelaVenda()"
          style="flex:1;background:rgba(255,255,255,.06);border:1px solid ${clienteSelecionado?'rgba(56,189,248,.5)':'var(--color-border)'};border-radius:10px;padding:10px 14px;color:#fff;font-size:.9rem;outline:none"/>
        ${clienteSelecionado ? `<button onclick="vendaCliente={nome:'',tel:'',id:null};vendaClienteBusca='';renderTelaVenda()" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:1.1rem;padding:4px 8px">✕</button>` : ''}
      </div>
      ${autoHtml}
      ${mostrarBtnNovo ? `<button onclick="vendaAbrirModalNovoCliente()" style="margin-top:8px;width:100%;padding:9px;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);border-radius:10px;color:#38bdf8;font-size:.83rem;cursor:pointer;font-weight:600">➕ Cadastrar "${vendaEsc(vendaClienteBusca)}" como novo cliente</button>` : ''}
      <button onclick="vendaAbrirModalNovoCliente()" style="margin-top:6px;background:transparent;border:none;color:var(--color-text-muted);font-size:.75rem;cursor:pointer;padding:2px 0">+ Cadastrar novo cliente</button>
      ${clienteSelecionado ? `<div style="margin-top:5px;font-size:.78rem;color:#38bdf8">✓ ${vendaEsc(vendaCliente.nome)}${vendaCliente.tel?' · '+vendaEsc(vendaCliente.tel):''}</div>` : ''}
    </div>`;

  // ── Itens ────────────────────────────────────────────────────
  const itensHtml = vendaItens.length === 0
    ? '<div style="color:var(--color-text-muted);font-size:.82rem;text-align:center;padding:20px 0">Adicione peças do estoque ou itens manuais</div>'
    : vendaItens.map((it, i) => {
        const sub = num(it.qtd)*num(it.vunit);
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);margin-bottom:6px">
          <div style="flex:1">
            <div style="font-size:.85rem;font-weight:700">${vendaEsc(it.desc)}${it._manual?'<span style="font-size:.6rem;color:#fbbf24;margin-left:4px">manual</span>':''}</div>
            <div style="font-size:.72rem;color:var(--color-text-muted)">R$ ${num(it.vunit).toFixed(2)} un.</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button onclick="vendaAlterarQtd(${i},-1)" style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid var(--color-border);color:#fff;cursor:pointer">−</button>
            <span style="min-width:24px;text-align:center">${it.qtd}</span>
            <button onclick="vendaAlterarQtd(${i},1)" style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid var(--color-border);color:#fff;cursor:pointer">+</button>
          </div>
          <div style="min-width:80px;text-align:right;color:#34d399;font-size:.85rem">${fmtN(sub)}</div>
          <button onclick="vendaRemoverItem(${i})" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:1rem;padding:0 4px">✕</button>
        </div>`;
      }).join('');

  // ── Catálogo estoque ─────────────────────────────────────────
  const filtradas = estoque.filter(p => !vendaBusca.trim() || p.nome.toLowerCase().includes(vendaBusca.toLowerCase()));
  const catHtml = filtradas.length === 0
    ? '<div style="color:var(--color-text-muted);font-size:.82rem;text-align:center;padding:20px 0">Nenhuma peça encontrada</div>'
    : filtradas.map(p => {
        const qtd = num(p.qtd);
        const sem = qtd <= 0;
        const ja  = vendaItens.find(it => it.desc === p.nome);
        return `<div onclick="${sem?'':('vendaAddPeca(this.dataset.nome)')}" data-nome="${p.nome.replace(/"/g,'&quot;')}"
          style="padding:10px 12px;border-radius:10px;margin-bottom:6px;cursor:${sem?'not-allowed':'pointer'};opacity:${sem?.4:1};
          background:${ja?'rgba(16,185,129,.15)':'rgba(255,255,255,.04)'};
          border:1px solid ${ja?'rgba(16,185,129,.4)':'rgba(255,255,255,.07)'};transition:all .15s"
          onmouseover="if(${!sem})this.style.background='rgba(255,255,255,.08)'" onmouseout="this.style.background='${ja?'rgba(16,185,129,.15)':'rgba(255,255,255,.04)'}'">
          <div style="font-size:.85rem;font-weight:700">${vendaEsc(p.nome)}</div>
          <div style="font-size:.72rem;color:var(--color-text-muted);margin-top:2px">${fmtN(p.venda)} | Estoque: ${qtd}${sem?' <span style="color:#f87171">— SEM ESTOQUE</span>':''}</div>
          ${ja?`<div style="font-size:.68rem;color:#34d399;margin-top:2px">✓ ${ja.qtd}x adicionado</div>`:''}
        </div>`;
      }).join('');

  // ── Pagamento ────────────────────────────────────────────────
  const pags = [['dinheiro','💵 Dinheiro'],['pix','📱 Pix'],['cartao','💳 Cartão'],['fiado','🤝 Fiado']];
  const pagHtml = pags.map(([id,label]) =>
    `<button onclick="vendaPagamento='${id}';renderTelaVenda()" style="flex:1;padding:9px 4px;border-radius:10px;font-size:.78rem;font-weight:700;cursor:pointer;
      border:1px solid ${vendaPagamento===id?'rgba(16,185,129,.6)':'rgba(255,255,255,.1)'};
      background:${vendaPagamento===id?'rgba(16,185,129,.2)':'rgba(255,255,255,.04)'};
      color:${vendaPagamento===id?'#34d399':'var(--color-text-muted)'}">${label}</button>`
  ).join('');

  // ── Desconto ─────────────────────────────────────────────────
  const descontoHtml = `
    <div style="display:flex;gap:8px;align-items:center">
      <select onchange="vendaDescontoTipo=this.value;renderTelaVenda()" style="background:rgba(255,255,255,.06);border:1px solid var(--color-border);border-radius:8px;color:#fff;padding:8px 10px;font-size:.82rem">
        <option value="valor" ${vendaDescontoTipo==='valor'?'selected':''}>R$</option>
        <option value="percentual" ${vendaDescontoTipo==='percentual'?'selected':''}>%</option>
      </select>
      <input type="number" min="0" value="${vendaDesconto||''}" placeholder="0"
        oninput="vendaDesconto=parseFloat(this.value)||0;renderTelaVenda()"
        style="flex:1;background:rgba(255,255,255,.06);border:1px solid var(--color-border);border-radius:8px;color:#fff;padding:8px 12px;font-size:.9rem;outline:none"/>
    </div>`;

  const calc = vendaCalcTotal();
  const podeConc = vendaItens.length > 0 && vendaCliente.nome;

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:var(--font-titulo);font-size:1.35rem;letter-spacing:3px;color:#34d399">🛒 Nova Venda</span>
      <div class="toolbar-right">
        <button class="btn" style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);color:#fbbf24" onclick="renderHistoricoVendas()">📋 Histórico</button>
        <button class="btn" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);margin-left:6px" onclick="abaAtiva=14;renderAll()">✕ Cancelar</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:980px;margin:0 auto">

      <!-- COLUNA ESQUERDA -->
      <div style="display:flex;flex-direction:column;gap:12px">

        <!-- CLIENTE -->
        <div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:14px;padding:14px">
          <div style="font-family:var(--font-titulo);font-size:.85rem;letter-spacing:2px;color:#38bdf8;margin-bottom:10px">👤 CLIENTE</div>
          ${campoCliente}
        </div>

        <!-- CATÁLOGO -->
        <div class="orc-catalogo">
          <div class="orc-catalogo-header">
            <div class="orc-catalogo-titulo">🗂️ Peças do Estoque</div>
            <div class="search-wrap"><div class="search-layer sl-dark"></div><div class="search-layer sl-white"></div><div class="search-layer sl-border"></div><div class="search-layer sl-glow"></div><span class="search-icon">${_searchSvg}</span><div class="search-pink"></div><input class="search-input" type="text" placeholder="Buscar peça..." value="${vendaBusca.replace(/"/g,'&quot;')}" oninput="vendaBusca=this.value;atualizarCatalogoVenda()"/><div class="search-filter-btn"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg></div></div>
          </div>
          <div class="orc-catalogo-body" id="venda-cat-lista">${catHtml}</div>
          <button onclick="vendaAbrirModalNovoItem()" style="margin:8px 0 0;width:100%;padding:9px;background:rgba(251,191,36,.08);border:1px dashed rgba(251,191,36,.3);border-radius:10px;color:#fbbf24;font-size:.8rem;cursor:pointer;font-weight:600">📦 + Adicionar item que não está no estoque</button>
        </div>
      </div>

      <!-- COLUNA DIREITA -->
      <div style="display:flex;flex-direction:column;gap:12px">

        <!-- ITENS DA VENDA -->
        <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:16px;flex:1">
          <div style="font-family:var(--font-titulo);font-size:.9rem;letter-spacing:3px;color:#34d399;margin-bottom:12px">🧾 ITENS DA VENDA</div>
          <div style="min-height:100px">${itensHtml}</div>
        </div>

        <!-- PAGAMENTO -->
        <div style="background:rgba(13,35,71,.5);border:1px solid var(--color-border);border-radius:14px;padding:14px">
          <div style="font-family:var(--font-titulo);font-size:.8rem;letter-spacing:2px;color:#a78bfa;margin-bottom:10px">💳 PAGAMENTO</div>
          <div style="display:flex;gap:6px">${pagHtml}</div>
        </div>

        <!-- DESCONTO -->
        <div style="background:rgba(13,35,71,.5);border:1px solid var(--color-border);border-radius:14px;padding:14px">
          <div style="font-family:var(--font-titulo);font-size:.8rem;letter-spacing:2px;color:#fbbf24;margin-bottom:10px">🏷️ DESCONTO</div>
          ${descontoHtml}
        </div>

        <!-- TOTAIS -->
        <div style="background:linear-gradient(135deg,rgba(16,185,129,.15),rgba(16,185,129,.05));border:1px solid rgba(16,185,129,.3);border-radius:14px;padding:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:.82rem;color:var(--color-text-muted)"><span>Subtotal</span><span>${fmtN(calc.subtotal)}</span></div>
          ${calc.descValor>0?`<div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:.82rem;color:#fbbf24"><span>Desconto</span><span>-${fmtN(calc.descValor)}</span></div>`:''}
          <div style="display:flex;justify-content:space-between;font-size:1.2rem;font-weight:700;color:#34d399;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;margin-top:4px"><span>TOTAL</span><span>${fmtN(calc.total)}</span></div>
        </div>

        <!-- BOTÃO CONCLUIR -->
        <button onclick="confirmarVenda()" style="width:100%;padding:16px;background:${podeConc?'linear-gradient(135deg,#16a34a,#15803d)':'rgba(255,255,255,.05)'};border:none;border-radius:14px;color:${podeConc?'white':'var(--color-text-muted)'};font-family:var(--font-titulo);font-size:1.3rem;letter-spacing:3px;cursor:${podeConc?'pointer':'not-allowed'}" ${podeConc?'':'disabled'}>
          ✅ CONCLUIR VENDA
        </button>
        ${!vendaCliente.nome?'<div style="text-align:center;font-size:.72rem;color:var(--color-text-muted)">Selecione um cliente para concluir</div>':''}
      </div>
    </div>`;
}

async function renderHistoricoVendas() {
  await carregarHistoricoVendas();
  const main = document.getElementById('mainContent');
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const PAGS = { dinheiro:'💵', pix:'📱', cartao:'💳', fiado:'🤝' };
  const lista = [...vendaHistorico].reverse();
  const rows = lista.length === 0
    ? '<div style="color:var(--color-text-muted);text-align:center;padding:60px 20px">Nenhuma venda registrada ainda</div>'
    : lista.map(v => {
        const dt = new Date(v.data).toLocaleString('pt-BR');
        return `<div style="background:rgba(255,255,255,.04);border:1px solid var(--color-border);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start">
          <div style="flex:1">
            <div style="font-weight:700;font-size:.95rem">${vendaEsc(v.cliente||'—')} <span style="font-size:.72rem;color:var(--color-text-muted)">· ${dt}</span></div>
            <div style="font-size:.78rem;color:var(--color-text-muted);margin-top:3px">${(v.itens||[]).map(it=>it.qtd+'x '+it.desc).join(', ')}</div>
            <div style="margin-top:5px"><span style="font-size:.72rem;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa;border-radius:6px;padding:2px 8px">${PAGS[v.pagamento]||''} ${v.pagamento||'—'}</span></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.1rem;font-weight:700;color:#34d399">${fmtN(v.total)}</div>
            ${v.desconto>0?`<div style="font-size:.7rem;color:#fbbf24">Desc: -${fmtN(v.desconto)}</div>`:''}
            <div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end">
              <button onclick="vendaGerarPDF(${JSON.stringify(v).replace(/"/g,'&quot;')})" style="font-size:.72rem;padding:4px 8px;background:rgba(200,16,46,.1);border:1px solid rgba(200,16,46,.3);color:#fca5a5;border-radius:6px;cursor:pointer">📄 PDF</button>
              <button onclick="vendaWhatsApp(${JSON.stringify(v).replace(/"/g,'&quot;')})" style="font-size:.72rem;padding:4px 8px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.3);color:#34d399;border-radius:6px;cursor:pointer">📲 WhatsApp</button>
            </div>
          </div>
        </div>`;
      }).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:var(--font-titulo);font-size:1.35rem;letter-spacing:3px;color:#fbbf24">📋 Histórico de Vendas</span>
      <div class="toolbar-right">
        <button class="btn btn-add verde" onclick="abrirTelaVenda()">🛒 Nova Venda</button>
        <button class="btn" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);margin-left:6px" onclick="abaAtiva=14;renderAll()">✕ Fechar</button>
      </div>
    </div>
    <div style="max-width:820px;margin:0 auto">${rows}</div>`;
}

function atualizarCatalogoVenda() {
  const el = document.getElementById('venda-cat-lista');
  if (!el) { renderTelaVenda(); return; }
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const num = v => parseFloat(v)||0;
  const filtradas = estoque.filter(p => !vendaBusca.trim() || p.nome.toLowerCase().includes(vendaBusca.toLowerCase()));
  el.innerHTML = filtradas.length === 0
    ? '<div style="color:var(--color-text-muted);font-size:.82rem;text-align:center;padding:20px 0">Nenhuma peça encontrada</div>'
    : filtradas.map(p => {
        const qtd = num(p.qtd);
        const sem = qtd <= 0;
        const ja  = vendaItens.find(it => it.desc === p.nome);
        return `<div onclick="${sem?'':('vendaAddPeca(this.dataset.nome)')}" data-nome="${p.nome.replace(/"/g,'&quot;')}"
          style="padding:10px 12px;border-radius:10px;margin-bottom:6px;cursor:${sem?'not-allowed':'pointer'};opacity:${sem?.4:1};
          background:${ja?'rgba(16,185,129,.15)':'rgba(255,255,255,.04)'};border:1px solid ${ja?'rgba(16,185,129,.4)':'rgba(255,255,255,.07)'}">
          <div style="font-size:.85rem;font-weight:700">${vendaEsc(p.nome)}</div>
          <div style="font-size:.72rem;color:var(--color-text-muted);margin-top:2px">${fmtN(p.venda)} | Estoque: ${qtd}${sem?' <span style="color:#f87171">— SEM ESTOQUE</span>':''}</div>
          ${ja?`<div style="font-size:.68rem;color:#34d399;margin-top:2px">✓ ${ja.qtd}x adicionado</div>`:''}
        </div>`;
      }).join('');
}

function vendaAddPeca(nome) {
  const p = estoque.find(x => x.nome === nome);
  if (!p) return;
  const exist = vendaItens.find(it => it.desc === nome);
  if (exist) { exist.qtd++; }
  else { vendaItens.push({ desc: nome, qtd: 1, vunit: parseFloat(p.venda)||0 }); }
  renderTelaVenda();
}

function vendaAlterarQtd(idx, delta) {
  const it = vendaItens[idx];
  if (!it) return;
  const nova = it.qtd + delta;
  if (nova <= 0) { vendaItens.splice(idx, 1); }
  else { it.qtd = nova; }
  renderTelaVenda();
}

function vendaRemoverItem(idx) {
  vendaItens.splice(idx, 1);
  renderTelaVenda();
}

function vendaGerarPDF(venda) {
  let jsPDF;
  try { jsPDF = (window.jspdf&&window.jspdf.jsPDF)||window.jsPDF||null; } catch(e) { jsPDF=null; }
  if (!jsPDF) { mostrarToast('PDF não disponível'); return; }
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  let y = 20;
  doc.setFillColor(10,10,11); doc.rect(0,0,210,297,'F');
  doc.setFontSize(22); doc.setTextColor(200,16,46); doc.setFont('helvetica','bold'); doc.text('ZL MOTOS', 20, y);
  doc.setFontSize(10); doc.setTextColor(150,150,160); doc.setFont('helvetica','normal'); doc.text('Comprovante de Venda', 20, y+7);
  doc.text(new Date(venda.data).toLocaleString('pt-BR'), 190, y+7, {align:'right'}); y+=18;
  doc.setDrawColor(200,16,46); doc.setLineWidth(0.5); doc.line(20,y,190,y); y+=8;
  doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('CLIENTE', 20, y);
  doc.setFont('helvetica','normal'); doc.text(venda.cliente||'—', 20, y+6);
  if (venda.telefone) doc.text('Tel: '+venda.telefone, 20, y+12);
  doc.setFont('helvetica','bold'); doc.text('PAGAMENTO', 120, y);
  doc.setFont('helvetica','normal'); doc.text((venda.pagamento||'—').toUpperCase(), 120, y+6); y+=22;
  doc.setDrawColor(50,50,60); doc.line(20,y,190,y); y+=6;
  doc.setFont('helvetica','bold'); doc.setTextColor(200,200,210);
  doc.text('ITEM',20,y); doc.text('QTD',120,y); doc.text('UNIT',145,y); doc.text('TOTAL',170,y);
  y+=5; doc.line(20,y,190,y); y+=6;
  doc.setFont('helvetica','normal'); doc.setTextColor(255,255,255);
  (venda.itens||[]).forEach(it=>{
    const sub=(parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
    doc.text(String(it.desc||'').substring(0,40),20,y); doc.text(String(it.qtd),120,y);
    doc.text(fmtN(it.vunit),145,y); doc.text(fmtN(sub),170,y); y+=7;
    if(y>260){doc.addPage();y=20;}
  });
  y+=2; doc.setDrawColor(50,50,60); doc.line(20,y,190,y); y+=8;
  if(venda.desconto>0){doc.setTextColor(251,191,36);doc.text('Desconto:',130,y);doc.text('-'+fmtN(venda.desconto),190,y,{align:'right'});y+=7;}
  doc.setFontSize(13);doc.setFont('helvetica','bold');doc.setTextColor(52,211,153);
  doc.text('TOTAL:',130,y);doc.text(fmtN(venda.total),190,y,{align:'right'});
  doc.save(`ZL_MOTOS_Venda_${(venda.cliente||'cliente').replace(/\s+/g,'_')}_${Date.now()}.pdf`);
}

function vendaWhatsApp(venda) {
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  let txt = `*ZL MOTOS — Comprovante de Venda*\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `*Cliente:* ${venda.cliente||'—'}\n`;
  if(venda.telefone) txt += `*Telefone:* ${venda.telefone}\n`;
  txt += `*Data:* ${new Date(venda.data).toLocaleString('pt-BR')}\n*Pagamento:* ${(venda.pagamento||'—').toUpperCase()}\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━\n*ITENS*\n`;
  (venda.itens||[]).forEach((it,i)=>{
    const sub=(parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
    txt+=`${i+1}. ${it.desc} — ${it.qtd}x ${fmtN(it.vunit)} = *${fmtN(sub)}*\n`;
  });
  txt+=`━━━━━━━━━━━━━━━━━━━━━━━\n`;
  if(venda.desconto>0) txt+=`*Desconto:* -${fmtN(venda.desconto)}\n`;
  txt+=`*TOTAL: ${fmtN(venda.total)}*\n━━━━━━━━━━━━━━━━━━━━━━━\n_Obrigado pela preferência! 🏍️_`;
  const tel=(venda.telefone||'').replace(/\D/g,'');
  window.open(tel?`https://wa.me/55${tel}?text=${encodeURIComponent(txt)}`:`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank');
}

async function confirmarVenda() {
  if (!vendaItens.length) return;
  if (!vendaCliente.nome.trim()) { mostrarToast('Selecione um cliente'); return; }
  const calc = vendaCalcTotal();
  let erros = [];
  vendaItens.forEach(it => {
    if (it._manual) return; // item manual não desconta estoque
    const idx = estoque.findIndex(p => p.nome === it.desc);
    if (idx < 0) return;
    const qtdAtual = parseFloat(estoque[idx].qtd)||0;
    if (it.qtd > qtdAtual) { erros.push(it.desc); return; }
    estoque[idx].qtd = Math.max(0, qtdAtual - it.qtd);
  });
  if (erros.length) { mostrarErro('Estoque insuficiente: ' + erros.join(', ')); return; }
  await estSalvar();
  const venda = {
    id: 'venda_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    data: new Date().toISOString(),
    cliente: vendaCliente.nome,
    telefone: vendaCliente.tel||'',
    clienteId: vendaCliente.id||null,
    itens: vendaItens.map(it => ({ desc: it.desc, qtd: it.qtd, vunit: it.vunit })),
    subtotal: calc.subtotal,
    desconto: calc.descValor,
    total: calc.total,
    pagamento: vendaPagamento
  };
  try {
    vendaHistorico.push(venda);
    await window._firestoreSetDoc(window._userDoc('vendas_historico'), { lista: vendaHistorico, atualizadoEm: new Date().toISOString() });
  } catch(e) { console.warn('Erro ao salvar venda:', e); }
  mostrarToast('✓ Venda concluída! R$ ' + calc.total.toFixed(2));
  setTimeout(() => {
    if (confirm('Enviar comprovante por WhatsApp?')) vendaWhatsApp(venda);
    else if (confirm('Gerar PDF do comprovante?')) vendaGerarPDF(venda);
  }, 300);
  vendaItens = [];
  vendaCliente = { nome:'', tel:'', id:null };
  vendaClienteBusca = '';
  vendaDesconto = 0;
  vendaPagamento = 'dinheiro';
  abaAtiva = 14;
  renderAll();
}
// ─────────────────────────────────────────────────────────────────
function estExcluir(idx) {
  confirmarExclusao(estoque[idx].nome, () => {
    estoque.splice(idx, 1);
    estSalvar();
    renderEstoque();
  });
}

// ═══════════════════════════════════════════
// RENDER ESTOQUE
// ═══════════════════════════════════════════
// ── C07 — Entrada de Estoque ──────────────────────────────────────
async function estSalvarEntradas() {
  try { await window._firestoreSetDoc(window._userDoc('est_entradas'), { lista: estEntradas, atualizadoEm: new Date().toISOString() }); } catch(e) {}
}
async function estCarregarEntradas() {
  try { const snap = await window._firestoreGetDoc(window._userDoc('est_entradas')); if(snap.exists()) estEntradas=snap.data().lista||[]; } catch(e) {}
}
function estAbrirEntrada() {
  const pecasOpts = estoque.map(p=>`<option value="${p.nome.replace(/"/g,'&quot;')}">${p.nome}</option>`).join('');
  const fornOpts = fornecedores.map(f=>`<option value="${f.nome.replace(/"/g,'&quot;')}">${f.nome}</option>`).join('');
  const modal = document.createElement('div');
  modal.id='est-entrada-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML=`<div onclick="event.stopPropagation()" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#38bdf8;margin-bottom:18px">📥 ENTRADA DE ESTOQUE</div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="orc-field"><label>📦 Peça</label>
        <select id="ent-peca" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 12px;width:100%">
          <option value="">Selecione...</option>${pecasOpts}</select></div>
      <div class="orc-field"><label>🔢 Quantidade</label><input id="ent-qtd" type="number" min="1" value="1"/></div>
      <div class="orc-field"><label>💰 Custo unitário (R$)</label><input id="ent-custo" type="number" min="0" step="0.01" placeholder="0,00"/></div>
      <div class="orc-field"><label>🏭 Fornecedor</label>
        <select id="ent-forn" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 12px;width:100%">
          <option value="">Sem fornecedor</option>${fornOpts}</select></div>
      <div class="orc-field"><label>📅 Data</label><input id="ent-data" type="date" value="${hojeISO()}"/></div>
      <div class="orc-field"><label>📝 Nota fiscal / Obs</label><input id="ent-nf" type="text" placeholder="NF-001, observações..."/></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button onclick="document.getElementById('est-entrada-modal').remove()" style="flex:1;padding:10px;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;cursor:pointer">Cancelar</button>
      <button onclick="estConfirmarEntrada()" style="flex:2;padding:10px;background:rgba(56,189,248,.2);border:1px solid rgba(56,189,248,.4);color:#38bdf8;border-radius:8px;cursor:pointer;font-weight:700">📥 Confirmar Entrada</button>
    </div>
  </div>`;
  modal.onclick=()=>modal.remove();
  document.body.appendChild(modal);
}
async function estConfirmarEntrada() {
  const nomePeca=document.getElementById('ent-peca')?.value;
  const qtd=parseInt(document.getElementById('ent-qtd')?.value)||0;
  const custo=parseFloat(document.getElementById('ent-custo')?.value)||0;
  const forn=document.getElementById('ent-forn')?.value||'';
  const data=document.getElementById('ent-data')?.value||hojeISO();
  const nf=document.getElementById('ent-nf')?.value||'';
  if(!nomePeca){mostrarToast('Selecione uma peça');return;}
  if(qtd<=0){mostrarToast('Informe a quantidade');return;}
  const idx=estoque.findIndex(p=>p.nome===nomePeca);
  if(idx>=0){
    estoque[idx].qtd=(parseFloat(estoque[idx].qtd)||0)+qtd;
    if(custo>0)estoque[idx].custo=custo;
    await estSalvar();
  }
  estEntradas.push({id:'ent_'+Date.now(),peca:nomePeca,qtd,custo,forn,data,nf,criadoEm:new Date().toISOString()});
  await estSalvarEntradas();
  document.getElementById('est-entrada-modal')?.remove();
  mostrarToast(`✓ +${qtd}x ${nomePeca} no estoque!`);
  renderEstoque();
}

// ── C10 — Fornecedores ───────────────────────────────────────────
async function estSalvarFornecedores(){
  try{await window._firestoreSetDoc(window._userDoc('fornecedores'),{lista:fornecedores,atualizadoEm:new Date().toISOString()});}catch(e){}
}
async function estCarregarFornecedores(){
  try{const snap=await window._firestoreGetDoc(window._userDoc('fornecedores'));if(snap.exists())fornecedores=snap.data().lista||[];}catch(e){}
}
function estAbrirFornecedores(){
  const main=document.getElementById('mainContent');
  const rows=fornecedores.length===0
    ?'<div style="text-align:center;color:var(--color-text-muted);padding:32px">Nenhum fornecedor cadastrado</div>'
    :fornecedores.map((f,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.05)">
      <div style="flex:1"><div style="font-weight:700;font-size:.88rem">${f.nome}</div>
      <div style="font-size:.72rem;color:var(--color-text-muted)">${[f.tel,f.email,f.pecas].filter(Boolean).join(' · ')}</div></div>
      ${f.tel?`<button onclick="window.open('https://wa.me/55${f.tel.replace(/\\D/g,'')}','_blank')" style="font-size:.72rem;padding:4px 8px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.3);color:#34d399;border-radius:6px;cursor:pointer">📲</button>`:''}
      <button onclick="fornecedores.splice(${i},1);estSalvarFornecedores();estAbrirFornecedores()" style="background:transparent;border:none;color:#f87171;cursor:pointer">✕</button>
    </div>`).join('');
  main.innerHTML=`<div class="toolbar">
    <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#a78bfa">🏭 Fornecedores</span>
    <div class="toolbar-right"><button class="btn" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted)" onclick="abaAtiva=14;renderAll()">← Voltar</button></div>
  </div>
  <div style="max-width:720px;margin:0 auto">
    <div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:14px;padding:20px;margin-bottom:16px">
      <div style="font-family:'Inter';font-size:.8rem;letter-spacing:2px;color:#a78bfa;margin-bottom:12px">➕ NOVO FORNECEDOR</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="orc-field"><label>🏭 Nome *</label><input id="forn-nome" type="text" placeholder="Nome"/></div>
        <div class="orc-field"><label>📞 WhatsApp</label><input id="forn-tel" type="text" placeholder="(11) 99999-9999"/></div>
        <div class="orc-field"><label>✉️ E-mail</label><input id="forn-email" type="text" placeholder="email@..."/></div>
        <div class="orc-field"><label>📦 Peças</label><input id="forn-pecas" type="text" placeholder="filtros, óleos..."/></div>
        <div class="orc-field" style="grid-column:1/-1"><label>📝 Observações</label><input id="forn-obs" type="text" placeholder="Prazo, condições..."/></div>
      </div>
      <button onclick="estAdicionarFornecedor()" style="margin-top:12px;width:100%;padding:10px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.4);color:#a78bfa;border-radius:8px;cursor:pointer;font-weight:700">+ Adicionar</button>
    </div>
    <div style="background:rgba(255,255,255,.03);border:1px solid var(--color-border);border-radius:14px;overflow:hidden">${rows}</div>
  </div>`;
}
async function estAdicionarFornecedor(){
  const nome=(document.getElementById('forn-nome')?.value||'').trim();
  if(!nome){mostrarToast('Informe o nome');return;}
  fornecedores.push({id:'forn_'+Date.now(),nome,tel:document.getElementById('forn-tel')?.value||'',email:document.getElementById('forn-email')?.value||'',pecas:document.getElementById('forn-pecas')?.value||'',obs:document.getElementById('forn-obs')?.value||'',criadoEm:new Date().toISOString()});
  await estSalvarFornecedores();
  mostrarToast('✓ Fornecedor cadastrado!');
  estAbrirFornecedores();
}

function renderEstoque() {
  const main = document.getElementById('mainContent');
  const resumo = estCalcResumo();
  const lista = estFiltradas();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const rows = lista.map((p, visualIdx) => {
    const realIdx = estoque.indexOf(p);
    const qtd = parseFloat(p.qtd) || 0;
    const min = parseFloat(p.minimo) || 0;
    const custo = parseFloat(p.custo) || 0;
    const venda = parseFloat(p.venda) || 0;
    const margem = custo > 0 ? ((venda - custo) / custo * 100).toFixed(1) : null;
    const emAlerta = qtd <= min;
    const semEstoque = qtd === 0;
    const cc = EST_CAT_COLORS[p.cat] || EST_CAT_COLORS['Outros'];
    const statusBadge = semEstoque
      ? `<span class="est-zero-badge">⛔ Zerado</span>`
      : emAlerta
        ? `<span class="est-alerta-badge">⚠ Baixo</span>`
        : `<span class="est-ok-badge">✓ OK</span>`;
    const margemNum = margem !== null ? parseFloat(margem) : null;
    const margemMeta = parseFloat(empresa.margemMeta) || 30; // meta padrão 30%
    const margemCor = margemNum === null ? 'var(--color-text-muted)' : margemNum >= margemMeta ? '#34d399' : margemNum >= 0 ? '#fbbf24' : '#fca5a5';
    const margemIcon = margemNum === null ? '' : margemNum >= margemMeta ? '✓ ' : margemNum >= 0 ? '⚠ ' : '↓ ';
    const margemHtml = margem !== null
      ? `<span style="font-size:.78rem;font-weight:700;color:${margemCor};font-family:'JetBrains Mono',monospace">${margemIcon}${margem}%</span>`
      : `<span style="color:var(--color-text-muted);font-size:.78rem">—</span>`;

    return `<tr class="${emAlerta?'est-alerta-row':''}">
      <td data-label="Peça" style="font-weight:600;color:var(--color-text-primary)">${p.nome}</td>
      <td data-label="Categoria"><span class="est-cat-tag" style="background:${cc}">${p.cat}</span></td>
      <td class="col-qtd-est" data-label="Qtd" style="font-family:'JetBrains Mono',monospace;font-size:.95rem;color:${semEstoque?'var(--vermelho)':emAlerta?'var(--dourado)':'var(--color-primary-hover)'};font-weight:700">${qtd}${p.reservado>0?'<br><span style="font-size:.6rem;color:#a78bfa">🔒'+p.reservado+' res.</span>':''}</td>
      <td class="col-min" data-label="Mín" style="font-family:'JetBrains Mono',monospace;color:var(--color-text-muted)">${min||'—'}</td>
      <td class="col-status" data-label="Status">${statusBadge}</td>
      <td class="col-custo" data-label="Custo">${custo>0?fmtN(custo):'—'}</td>
      <td class="col-venda" data-label="Venda">${venda>0?fmtN(venda):'—'}</td>
      <td class="col-margem" data-label="Margem">${margemHtml}</td>
      <td data-label="Ações" style="white-space:nowrap">
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button class="btn btn-sm" style="background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);color:var(--color-primary-hover)" onclick="estAbrirMovimento(${realIdx})">↕ Mov.</button>
          <button class="btn btn-sm" style="background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa" onclick="estReservarParaOS(${realIdx})" title="Reservar para OS">🔒</button>
          <button class="btn btn-sm btn-duplic" onclick="estAbrirCadastro(${realIdx})">✏️</button>
          <button class="btn btn-del btn-sm" onclick="estExcluir(${realIdx})">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const emAlertaTotal = resumo.emAlerta;

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#f97316">📦 Estoque</span>
      ${emAlertaTotal>0 ? '<span class="est-alerta-badge" style="font-size:.72rem">⚠ ' + emAlertaTotal + ' item' + (emAlertaTotal>1?'s':'') + ' em alerta</span>' : ''}
      <div class="toolbar-right">
        <button class="btn btn-add verde" onclick="abrirTelaVenda()">🛒 Nova Venda<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
        <button class="btn" style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);color:#38bdf8;margin-right:4px" onclick="estAbrirEntrada()">📥 Entrada de Estoque</button>
        <button class="btn" style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);color:#a78bfa;margin-right:4px" onclick="estAbrirFornecedores()">🏭 Fornecedores</button>
        <button class="btn" style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);color:#fbbf24;margin-right:6px" onclick="renderInventario()">📋 Inventário</button>
<button class="btn btn-add warning" onclick="estAbrirCadastro()">+ Nova Peça<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
      </div>
    </div>

    <!-- CARDS RESUMO -->
    <div class="est-resumo">
      <div class="est-card total"><div class="est-card-label">Total de Itens</div><div class="est-card-valor">${resumo.total}</div></div>
      <div class="est-card custo"><div class="est-card-label">Valor em Custo</div><div class="est-card-valor">${fmtN(resumo.totalCusto)}</div></div>
      <div class="est-card venda"><div class="est-card-label">Valor em Venda</div><div class="est-card-valor">${fmtN(resumo.totalVenda)}</div></div>
      <div class="est-card alerta"><div class="est-card-label">Em Alerta / Zerado</div><div class="est-card-valor">${resumo.emAlerta}</div></div>
    </div>

    <!-- FILTROS -->
    <div class="est-filtros">
      <div class="search-wrap"><div class="search-layer sl-dark"></div><div class="search-layer sl-white"></div><div class="search-layer sl-border"></div><div class="search-layer sl-glow"></div><span class="search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span><div class="search-pink"></div><input class="search-input" type="text" placeholder="Buscar peça..." value="${estBusca}" oninput="estBusca=this.value;atualizarListaEstoque()"/><div class="search-filter-btn"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg></div></div>
      <select style="max-width:160px" onchange="estFiltroCAT=this.value;renderEstoque()">
        <option value="Todos" ${estFiltroCAT==='Todos'?'selected':''}>Todas categorias</option>
        ${EST_CATS.map(c => '<option value="' + c + '" ' + (estFiltroCAT===c?'selected':'') + '>' + c + '</option>').join('')}
      </select>
      <button class="filtro-btn${estMostrarApenasAlerta?' ativo':''}" onclick="estMostrarApenasAlerta=!estMostrarApenasAlerta;renderEstoque()">⚠ Só alertas</button>
    </div>

    <!-- TABELA -->
    <div class="orc-lista">
      <div class="orc-lista-body" style="padding:0">
        ${lista.length === 0
          ? '<div class="orc-vazio">' + (estoque.length===0?'Nenhuma peça cadastrada ainda. Clique em &quot;+ Nova Peça&quot; para começar.':'Nenhuma peça encontrada com os filtros aplicados.') + '</div>'
          : '<div class="tabela-wrap"><div style="overflow-x:auto"><table class="tabela-mobile"><thead><tr><th>Peça</th><th>Categoria</th><th class="col-qtd-est">Qtd</th><th class="col-min">Mín</th><th class="col-status">Status</th><th class="col-custo">Custo</th><th class="col-venda">Venda</th><th class="col-margem">Margem</th><th>Ações</th></tr></thead><tbody id="est-lista-body">' + rows + '</tbody></table></div>'
        }
      </div>
    </div>

    <!-- PEÇAS PARADAS -->
    ${(function(){
      const pecasParadas = estoque.filter(p => {
        // Nunca usadas em nenhum orçamento ou OS
        const usadaOrc = orcamentos.some(o => o.itens && o.itens.some(it => it.desc && p.nome && it.desc.toLowerCase().includes(p.nome.toLowerCase())));
        const usadaOS = ordens.some(o => o.itens && o.itens.some(it => it.desc && p.nome && it.desc.toLowerCase().includes(p.nome.toLowerCase())));
        return !usadaOrc && !usadaOS && (parseFloat(p.qtd)||0) > 0;
      });
      if (pecasParadas.length === 0) return '';
      const rows = pecasParadas.map(p => {
        const realIdx = estoque.indexOf(p);
        const qtd = parseFloat(p.qtd)||0;
        const custo = parseFloat(p.custo)||0;
        const venda = parseFloat(p.venda)||0;
        return '<tr>'
          + '<td style="font-weight:600;color:var(--color-text-primary)">' + p.nome + '</td>'
          + '<td><span class="est-cat-tag" style="background:' + (EST_CAT_COLORS[p.cat]||EST_CAT_COLORS['Outros']) + '">' + (p.cat||'—') + '</span></td>'
          + '<td style="font-family:"JetBrains Mono",monospace;color:#fbbf24;font-weight:700">' + qtd + '</td>'
          + '<td>' + (custo>0?fmtN(custo):'—') + '</td>'
          + '<td>' + (venda>0?fmtN(venda):'—') + '</td>'
          + '<td><button class="btn btn-sm btn-pdf" onclick="estAbrirMov(' + realIdx + ')">↕ Movimentar</button></td>'
          + '</tr>';
      }).join('');
      return '<div style="margin-top:20px;background:rgba(251,191,36,.05);border:1px solid rgba(251,191,36,.2);border-radius:14px;padding:16px 20px">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
        + '<span style="font-family:\'Inter\';font-size:.9rem;letter-spacing:3px;color:#fbbf24">📦 PEÇAS PARADAS — ' + pecasParadas.length + ' item(s)</span>'
        + '<span style="font-size:.7rem;color:var(--color-text-muted)">Peças em estoque nunca usadas em orçamentos ou OS</span>'
        + '</div>'
        + '<div style="overflow-x:auto"><table class="tabela-mobile" style="margin:0"><thead><tr>'
        + '<th>Peça</th><th>Categoria</th><th>Qtd</th><th>Custo</th><th>Venda</th><th></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    })()}
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') fazerLogin(); });
  document.getElementById('login-user').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('login-pass').focus(); });
});


// ═══════════════════════════════════════════
// CHAT ASSISTENTE — lógica
// ═══════════════════════════════════════════
const ZL_MASCOTE = 'data:video/mp4;base64,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';
const ZL_MASCOTE_IS_VIDEO = true;
let zlChatAberto = false;
let zlChatIniciado = false;
let zlChatHistorico = []; // histórico de conversa para contexto

// ── Alertas automáticos ao abrir ──────────────────────
function zlChatAlertas() {
  const alertas = [];
  const hoje = hojeISO();

  // OS paradas
  if (typeof ordens !== 'undefined') {
    const paradas = ordens.filter(o => (o.status==='aberta'||o.status==='andamento') && osEstaParada(o, 3));
    if (paradas.length) alertas.push('⚠️ <b>' + paradas.length + ' OS parada' + (paradas.length>1?'s':'') + ' há mais de 3 dias</b> — ' + paradas.slice(0,2).map(o=>o.cliente||'—').join(', '));
  }

  // Estoque crítico
  if (typeof estoque !== 'undefined') {
    const crit = estoque.filter(p => (parseFloat(p.qtd)||0) === 0);
    if (crit.length) alertas.push('📦 <b>' + crit.length + ' produto' + (crit.length>1?'s':'') + ' zerado' + (crit.length>1?'s':'') + '</b> — ' + crit.slice(0,2).map(p=>p.nome).join(', '));
  }

  // Orçamentos aprovados não pagos
  if (typeof orcamentos !== 'undefined') {
    const inadimp = orcamentos.filter(o => (o.status==='aceito'||o.status==='aprovado') && !o.pago && !(o.valorPago>0));
    if (inadimp.length) alertas.push('💸 <b>' + inadimp.length + ' orçamento' + (inadimp.length>1?'s':'') + ' aprovado' + (inadimp.length>1?'s':'') + ' sem pagamento</b>');
  }

  return alertas;
}

function zlChatToggle() {
  zlChatAberto = !zlChatAberto;
  const box = document.getElementById('zl-chat-box');
  const btn = document.getElementById('zl-chat-btn');
  box.style.display = zlChatAberto ? 'flex' : 'none';
  btn.style.display = zlChatAberto ? 'none' : 'flex';

  if (zlChatAberto && !zlChatIniciado) {
    zlChatIniciado = true;
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    
    zlMsgBot(saudacao + '! 👋 Sou o <b>Jean</b>, assistente da <b>ZL Motos</b>.<br>Pode me perguntar qualquer coisa — financeiro, OS, estoque, clientes, ou só bater um papo! 😄<br><br>' +
      '<span class="zl-tag" onclick="zlChatPergunta(this)">📊 Como está o negócio?</span> ' +
      '<span class="zl-tag" onclick="zlChatPergunta(this)">🔧 OS em aberto</span> ' +
      '<span class="zl-tag" onclick="zlChatPergunta(this)">⚠️ Alertas do dia</span>');

    // Alertas automáticos após 1.5s
    setTimeout(() => {
      const alertas = zlChatAlertas();
      if (alertas.length) {
        zlMsgBot('🔔 <b>Encontrei ' + alertas.length + ' ponto' + (alertas.length>1?'s':'') + ' de atenção:</b><br><br>' + alertas.join('<br>'));
      }
    }, 1800);
  }

  if (zlChatAberto) setTimeout(() => document.getElementById('zl-chat-input').focus(), 300);
}

function zlChatPergunta(el) {
  document.getElementById('zl-chat-input').value = el.textContent.replace(/^[^a-zA-ZÀ-ú]+/,'').trim();
  zlChatEnviar();
}

function zlMsgUser(txt) {
  const msgs = document.getElementById('zl-chat-msgs');
  msgs.innerHTML += `<div class="zl-msg user"><div class="zl-msg-bubble">${txt}</div></div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

function zlMsgBot(txt, delay=600) {
  const msgs = document.getElementById('zl-chat-msgs');
  const tid = 'typing_'+Date.now();
  msgs.innerHTML += `<div class="zl-msg bot" id="${tid}">
    ${ZL_MASCOTE_IS_VIDEO ? `<video class="zl-msg-avatar" src="${ZL_MASCOTE}" muted playsinline style="border-radius:6px"></video>` : `<img class="zl-msg-avatar" src="${ZL_MASCOTE}" alt="ZL"/>`}
    <div class="zl-msg-bubble"><div class="zl-chat-typing"><span></span><span></span><span></span></div></div>
  </div>`;
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => {
    const el = document.getElementById(tid);
    if (el) el.outerHTML = `<div class="zl-msg bot">
      ${ZL_MASCOTE_IS_VIDEO ? `<video class="zl-msg-avatar" src="${ZL_MASCOTE}" muted playsinline style="border-radius:6px"></video>` : `<img class="zl-msg-avatar" src="${ZL_MASCOTE}" alt="ZL"/>`}
      <div class="zl-msg-bubble">${txt}</div>
    </div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }, delay);
}

function zlChatEnviar() {
  const inp = document.getElementById('zl-chat-input');
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = '';
  zlMsgUser(txt);
  setTimeout(() => zlChatResponder(txt), 300);
}

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('zl-chat-input');
  if (inp) inp.addEventListener('keydown', e => { if(e.key==='Enter') zlChatEnviar(); });
});

// ═══════════════════════════════════════════
// MOTOR DE RESPOSTAS — BOT ZL MOTOS
// ═══════════════════════════════════════════
function zlChatResponder(txt) {
  const q = txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const nav = (aba, label) => '<span class="zl-tag" onclick="sbIr(' + aba + ');zlChatToggle()">' + label + '</span>';
  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // ── SAUDAÇÕES / CONVERSAÇÃO ──
  const saudacoes = ['oi','ola','olá','hey','e ai','eai','tudo bem','tudo bom','como vai','bom dia','boa tarde','boa noite','salve','opa'];
  if (saudacoes.some(s => q === s || q.startsWith(s+' ') || q.endsWith(' '+s))) {
    const respostas = [
      'Oi! 😄 Tudo ótimo por aqui! Como posso ajudar a ZL Motos hoje?',
      'Olá! Prontinho pra ajudar! O que precisar? 🏍️',
      'Oi oi! Estou aqui! Quer saber sobre o financeiro, OS, estoque? É só falar!',
      'Ei! Tudo certo! Pode mandar sua pergunta 😊'
    ];
    zlMsgBot(respostas[Math.floor(Math.random()*respostas.length)]);
    return;
  }

  if (q.includes('tudo bem') || q.includes('tudo bom') || q.includes('como vai') || q.includes('como voce esta')) {
    zlMsgBot('Tudo ótimo! Sempre monitorando a ZL Motos por aqui 😄 E você, tudo bem?');
    return;
  }

  if (q.includes('obrigado') || q.includes('valeu') || q.includes('thanks') || q.includes('grato')) {
    zlMsgBot('Disponha! Qualquer coisa é só chamar 👊');
    return;
  }

  if (q === 'sim' || q === 'nao' || q === 'não' || q === 'ok' || q === 'certo' || q === 'beleza') {
    zlMsgBot('Entendido! 👍 Tem mais alguma coisa que posso ajudar?');
    return;
  }

  // ── ALERTAS DO DIA ──
  if (q.includes('alerta') || q.includes('atencao') || q.includes('problema') || q.includes('urgente')) {
    const alertas = zlChatAlertas();
    if (!alertas.length) {
      zlMsgBot('✅ <b>Tudo em dia!</b> Nenhum alerta no momento. Continue assim! 💪');
    } else {
      zlMsgBot('🔔 <b>' + alertas.length + ' alerta' + (alertas.length>1?'s':'') + ' encontrado' + (alertas.length>1?'s':'') + ':</b><br><br>' + alertas.join('<br>'));
    }
    return;
  }

  // ── COMO ESTÁ O NEGÓCIO / RESUMO ──
  if (q.includes('como esta o negocio') || q.includes('resumo') || q.includes('situacao') || q.includes('visao geral') || q.includes('overview')) {
    const mesAtual = new Date().getMonth();
    let resp = '📊 <b>Resumo da ZL Motos — ' + MESES_PT[mesAtual] + '</b><br><br>';
    if (typeof calcularMes === 'function') {
      const c = calcularMes(mesAtual);
      const mesAnt = calcularMes(Math.max(0, mesAtual-1));
      const tendencia = mesAnt.totalLiquido > 0 ? ((c.totalLiquido - mesAnt.totalLiquido) / mesAnt.totalLiquido * 100).toFixed(0) : 0;
      resp += '💰 Lucro: <b style="color:' + (c.totalLiquido>=0?'#34d399':'#fca5a5') + '">' + fmt(c.totalLiquido) + '</b>';
      if (tendencia != 0) resp += ' (' + (tendencia>0?'▲':'▼') + Math.abs(tendencia) + '% vs mês ant.)';
      resp += '<br>';
      resp += '📥 Entradas: <b>' + fmt(c.totalBruto) + '</b> | 📤 Saídas: <b>' + fmt(c.totalSaidas) + '</b><br>';
    }
    if (typeof ordens !== 'undefined') {
      const abertas = ordens.filter(o=>o.status==='aberta'||o.status==='andamento').length;
      resp += '🔧 OS em aberto: <b>' + abertas + '</b><br>';
    }
    if (typeof orcamentos !== 'undefined') {
      const pend = orcamentos.filter(o=>o.status==='pendente'||!o.status).length;
      resp += '📋 Orçamentos pendentes: <b>' + pend + '</b><br>';
    }
    const alertas = zlChatAlertas();
    if (alertas.length) resp += '<br>⚠️ ' + alertas.length + ' alerta' + (alertas.length>1?'s':'') + ' de atenção';
    else resp += '<br>✅ Nenhum alerta';
    zlMsgBot(resp);
    return;
  }

  // ── TENDÊNCIAS ──
  if (q.includes('tendencia') || q.includes('crescendo') || q.includes('caindo') || q.includes('comparacao') || q.includes('historico') || q.includes('evolucao')) {
    if (typeof calcularMes === 'function') {
      const mesAtual = new Date().getMonth();
      const meses = [];
      for (let i = Math.max(0, mesAtual-5); i <= mesAtual; i++) {
        const c = calcularMes(i);
        meses.push({ nome: MESES_PT[i].slice(0,3), lucro: c.totalLiquido, entradas: c.totalBruto });
      }
      const trend = meses[meses.length-1].lucro > meses[0].lucro ? '📈 crescendo' : '📉 caindo';
      const linhas = meses.map(m => m.nome + ': <b>' + fmt(m.lucro) + '</b>').join('<br>');
      zlMsgBot('📈 <b>Tendência dos últimos meses:</b><br><br>' + linhas + '<br><br>O lucro está <b>' + trend + '</b> no período.');
    }
    return;
  }

  // ── DICAS ──
  if (q.includes('dica') || q.includes('sugestao') || q.includes('conselho') || q.includes('melhorar')) {
    const dicas = [];
    if (typeof estoque !== 'undefined') {
      const zerados = estoque.filter(p => (parseFloat(p.qtd)||0) === 0);
      if (zerados.length > 2) dicas.push('📦 Você tem ' + zerados.length + ' produtos zerados — repor estoque pode aumentar as vendas de peças');
    }
    if (typeof orcamentos !== 'undefined') {
      const pendentes = orcamentos.filter(o => !o.status || o.status==='pendente');
      const diasMedio = pendentes.length ? Math.floor(pendentes.reduce((s,o) => s + (Date.now()-new Date(o.criadoEm).getTime())/86400000, 0) / pendentes.length) : 0;
      if (diasMedio > 3) dicas.push('📋 Seus orçamentos pendentes têm média de ' + diasMedio + ' dias — um follow-up pode fechar mais negócios');
    }
    if (typeof ordens !== 'undefined') {
      const paradas = ordens.filter(o => (o.status==='aberta'||o.status==='andamento') && osEstaParada(o,5));
      if (paradas.length) dicas.push('🔧 ' + paradas.length + ' OS parada' + (paradas.length>1?'s':'') + ' há +5 dias — comunique o cliente para evitar insatisfação');
    }
    if (!dicas.length) dicas.push('✅ O negócio está bem! Continue registrando tudo certinho para ter dados mais precisos.');
    zlMsgBot('💡 <b>Dicas para a ZL Motos:</b><br><br>' + dicas.join('<br><br>'));
    return;
  }

  // ── NAVEGAÇÃO ──
  if (q.includes('ir para') || q.includes('abrir') || q.includes('vai para') || q.includes('mostrar') || q.includes('ver a ') || q.includes('acessar')) {
    const meses = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    if (q.includes('estoque')) { zlMsgBot('Clique para ir ao Estoque:<br><br>' + nav(14,'📦 Ir para Estoque')); return; }
    if (q.includes('orcamento')) { zlMsgBot('Clique para ir aos Orçamentos:<br><br>' + nav(13,'📋 Ir para Orçamentos')); return; }
    if (q.includes('ordem') || q.includes(' os ') || q.includes('servi')) { zlMsgBot('Clique para ir às OS:<br><br>' + nav(15,'🔧 Ir para OS')); return; }
    if (q.includes('clientes')) { zlMsgBot('Clique para ir a Clientes:<br><br>' + nav(20,'👥 Ir para Clientes')); return; }
    if (q.includes('config')) { zlMsgBot('Clique para ir às Configurações:<br><br>' + nav(16,'⚙️ Ir para Configurações')); return; }
    if (q.includes('anual') || q.includes('resumo')) { zlMsgBot('Clique para ver o Resumo Anual:<br><br>' + nav(12,'★ Ver Resumo Anual')); return; }
    if (q.includes('agendamento') || q.includes('agenda') || q.includes('calendario')) { zlMsgBot('Clique para ir aos Agendamentos:<br><br>' + nav(17,'📅 Ir para Agendamentos')); return; }
    if (q.includes('fila')) { zlMsgBot('Clique para ir à Fila de Motos:<br><br>' + nav(22,'🏍️ Ir para Fila de Motos')); return; }
    if (q.includes('contador') || q.includes('relatorio')) { zlMsgBot('Clique para ir ao Contador:<br><br>' + nav(21,'📑 Ir para Contador')); return; }
    for (let i = 0; i < meses.length; i++) {
      if (q.includes(meses[i])) { zlMsgBot('Clique para ir a ' + MESES_PT[i] + ':<br><br>' + nav(i,'📅 Ir para ' + MESES_PT[i])); return; }
    }
  }

  // ── AÇÕES DIRETAS ──
  if ((q.includes('criar') || q.includes('novo') || q.includes('abrir')) && q.includes('orcamento')) {
    zlMsgBot('Abrindo novo orçamento:<br><br><span class="zl-tag" onclick="sbIr(13);orcNovoOrcamento();zlChatToggle()">📋 Novo Orçamento</span>');
    return;
  }

  // ── OS ──
  if (q.includes('ordem') || q.includes(' os ') || q.startsWith('os ') || (q.includes('os') && (q.includes('aberta')||q.includes('andamento')||q.includes('conclu')||q.includes('entregue')))) {
    if (typeof ordens !== 'undefined') {
      const abertas = ordens.filter(o=>o.status==='aberta');
      const andamento = ordens.filter(o=>o.status==='andamento');
      const concluidas = ordens.filter(o=>o.status==='concluida');
      const entregues = ordens.filter(o=>o.status==='entregue');
      const palavras = txt.split(/\s+/).filter(w=>w.length>2);
      const osEspec = ordens.find(o => palavras.some(w=>(o.cliente||'').toLowerCase().includes(w.toLowerCase())||(o.placa||'').toLowerCase().includes(w.toLowerCase())));
      if (osEspec) {
        const msTotal = osTempoAtual(osEspec);
        zlMsgBot('🔧 <b>OS ' + osNumeroFormatado(osEspec.numero) + ' — ' + (osEspec.cliente||'—') + '</b><br>🏍️ ' + (osEspec.veiculo||'—') + (osEspec.placa?' — '+osEspec.placa:'') + '<br>📊 Status: <b>' + (osEspec.status||'aberta').toUpperCase() + '</b><br>' + (msTotal>0?'⏱️ Tempo: <b>'+osFmtTempo(msTotal)+'</b><br>':'') + '💰 Total: <b>' + fmt(osEspec.total||0) + '</b><br><br>' + nav(15,'🔧 Ver OS'));
      } else {
        zlMsgBot('🔧 <b>Ordens de Serviço</b><br>Total: <b>' + ordens.length + '</b><br>🔴 Abertas: <b>' + abertas.length + '</b><br>⚙️ Andamento: <b>' + andamento.length + '</b><br>✅ Concluídas: <b>' + concluidas.length + '</b><br>🏁 Entregues: <b>' + entregues.length + '</b><br><br>' + nav(15,'🔧 Ver todas as OS'));
      }
    }
    return;
  }

  // ── ORÇAMENTO ──
  if (q.includes('orcamento') || q.includes('orc')) {
    if (typeof orcamentos !== 'undefined' && orcamentos.length > 0) {
      const palavras = txt.split(/\s+/).filter(w=>w.length>2);
      let encontrados = orcamentos;
      if (palavras.length) encontrados = orcamentos.filter(o=>palavras.some(w=>(o.cliente||'').toLowerCase().includes(w.toLowerCase())));
      if (!encontrados.length) { zlMsgBot('Não encontrei orçamento para esse cliente.<br><br>' + nav(13,'📋 Ver Orçamentos')); }
      else if (encontrados.length===1) {
        const o = encontrados[0];
        const dias = Math.floor((Date.now()-new Date(o.criadoEm).getTime())/86400000);
        zlMsgBot('📋 <b>' + (o.cliente||'—') + '</b><br>🏍️ ' + (o.veiculo||'—') + '<br>💰 Total: <b>' + fmt((o.calc&&o.calc.total)||0) + '</b><br>📊 Status: <b>' + (o.status||'pendente').toUpperCase() + '</b><br>🕐 Criado há ' + dias + ' dia(s)<br><br>' + nav(13,'📋 Ver Orçamentos'));
      } else {
        const lista = encontrados.slice(0,5).map(o=>'• <b>'+(o.cliente||'—')+'</b> — '+fmt((o.calc&&o.calc.total)||0)).join('<br>');
        zlMsgBot('Encontrei <b>'+encontrados.length+'</b> orçamento(s):<br><br>'+lista+'<br><br>'+nav(13,'📋 Ver todos'));
      }
    } else {
      zlMsgBot('Nenhum orçamento salvo ainda.<br><br>' + nav(13,'📋 Criar orçamento'));
    }
    return;
  }

  // ── ESTOQUE ──
  if (q.includes('estoque') || q.includes('peca') || q.includes('produto') || q.includes('item')) {
    if (typeof estoque !== 'undefined') {
      const resumo = estCalcResumo();
      const zerados = estoque.filter(p=>(parseFloat(p.qtd)||0)===0);
      const alertas = estoque.filter(p=>{ const qtd=parseFloat(p.qtd)||0; const min=parseFloat(p.minimo)||0; return qtd>0&&qtd<=min&&min>0; });
      const palavras = txt.split(/\s+/).filter(w=>w.length>3);
      const pecaEspec = estoque.find(p=>palavras.some(w=>p.nome.toLowerCase().includes(w.toLowerCase())));
      if (pecaEspec) {
        const qtd=parseFloat(pecaEspec.qtd)||0; const min=parseFloat(pecaEspec.minimo)||0;
        const status=qtd===0?'⛔ Zerado':qtd<=min&&min>0?'⚠ Baixo':'✅ OK';
        zlMsgBot('📦 <b>'+pecaEspec.nome+'</b><br>Quantidade: <b>'+qtd+'</b> | Mínimo: '+(min||'—')+'<br>Status: '+status+'<br>Custo: '+(pecaEspec.custo?fmt(pecaEspec.custo):'—')+' | Venda: '+(pecaEspec.venda?fmt(pecaEspec.venda):'—')+'<br><br>'+nav(14,'📦 Ver Estoque'));
      } else {
        zlMsgBot('📦 <b>Estoque</b><br>Total: <b>'+resumo.total+'</b><br>Valor custo: <b>'+fmt(resumo.totalCusto)+'</b><br>Valor venda: <b>'+fmt(resumo.totalVenda)+'</b><br>'+(zerados.length?'⛔ <b>'+zerados.length+'</b> zerado(s)<br>':'')+(alertas.length?'⚠ <b>'+alertas.length+'</b> em alerta<br>':'✅ Tudo no limite<br>')+'<br>'+nav(14,'📦 Ver Estoque'));
      }
    }
    return;
  }

  // ── FINANCEIRO ──
  if (q.includes('financ')||q.includes('faturamento')||q.includes('lucro')||q.includes('entrada')||q.includes('saida')||q.includes('receita')||q.includes('caixa')) {
    if (typeof dados !== 'undefined') {
      const meses = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
      let m = new Date().getMonth();
      meses.forEach((mn,i) => { if(q.includes(mn)) m=i; });
      if (q.includes('passado')||q.includes('anterior')) m=Math.max(0,m-1);
      const c = calcularMes(m);
      const cAnt = m>0 ? calcularMes(m-1) : null;
      let resp = '💰 <b>Financeiro — ' + MESES_PT[m] + '</b><br>📥 Entradas: <b>' + fmt(c.totalBruto) + '</b><br>📤 Saídas: <b>' + fmt(c.totalSaidas) + '</b><br>💵 Lucro: <b style="color:' + (c.totalLiquido>=0?'#34d399':'#fca5a5') + '">' + fmt(c.totalLiquido) + '</b>';
      if (cAnt) {
        const diff = c.totalLiquido - cAnt.totalLiquido;
        resp += '<br>' + (diff>=0?'📈 ▲':'📉 ▼') + ' ' + fmt(Math.abs(diff)) + ' vs mês anterior';
      }
      resp += (c.vazio?'<br>⚠ Nenhum lançamento neste mês.':'') + '<br><br>' + nav(m,'📅 Ver ' + MESES_PT[m]) + ' ' + nav(12,'★ Ver Anual');
      zlMsgBot(resp);
    }
    return;
  }

  // ── CLIENTES ──
  if (q.includes('cliente') || q.includes('fidelidade')) {
    if (typeof clientesCadastradosManuais !== 'undefined') {
      const total = clientesCadastradosManuais.length;
      zlMsgBot('👥 <b>Clientes cadastrados: ' + total + '</b><br><br>' + nav(20,'👥 Ver Clientes'));
    }
    return;
  }

  // ── MECÂNICOS ──
  if (q.includes('mecanico')||q.includes('tecnico')||q.includes('meta')||q.includes('ranking')) {
    if (typeof ordens !== 'undefined') {
      const mecsMap = {};
      ordens.forEach(os => {
        const mec=(os.mecanico||'').trim()||'Sem mecânico';
        if(!mecsMap[mec]) mecsMap[mec]={total:0,concluidas:0};
        mecsMap[mec].total++;
        if(os.status==='concluida'||os.status==='entregue') mecsMap[mec].concluidas++;
      });
      const mecs=Object.entries(mecsMap).sort((a,b)=>b[1].concluidas-a[1].concluidas);
      if(!mecs.length) { zlMsgBot('Nenhuma OS cadastrada ainda.'); return; }
      const lista=mecs.map((e,i)=>(i===0?'🥇':i===1?'🥈':i===2?'🥉':'•')+' <b>'+e[0]+'</b> — '+e[1].concluidas+' OS concluídas').join('<br>');
      zlMsgBot('👨‍🔧 <b>Mecânicos</b><br><br>'+lista+'<br><br>'+nav(18,'📊 Ver Dashboard'));
    }
    return;
  }

  // ── AJUDA ──
  if (q.includes('ajuda')||q.includes('help')||q.includes('o que')||q.includes('pode')||q.includes('como')) {
    zlMsgBot('Posso te ajudar com:<br><br>💬 <b>Conversa</b> — pode falar normalmente comigo!<br>📊 <b>Resumo</b> — "como está o negócio?"<br>📈 <b>Tendências</b> — "tendência de lucro"<br>💡 <b>Dicas</b> — "me dê dicas"<br>⚠️ <b>Alertas</b> — "alertas do dia"<br>🧭 <b>Navegar</b> — "ir para estoque"<br>💰 <b>Financeiro</b> — "financeiro maio"<br>🔧 <b>OS</b> — "ordens abertas", "OS do João"<br>📦 <b>Estoque</b> — "zerados", "pastilha de freio"<br>📋 <b>Orçamentos</b> — "orçamento pendentes"<br><br><span class="zl-tag" onclick="zlChatPergunta(this)">Como está o negócio?</span> <span class="zl-tag" onclick="zlChatPergunta(this)">Me dê dicas</span>');
    return;
  }

  // ── GEMINI IA — fallback inteligente com histórico ──
  zlChatIA(txt);
}

async function zlChatIA(pergunta) {
  const GEMINI_KEY = 'AQ.Ab8RN6KxpISXZGLvcrh_SsDQClp7yOV-WyiO3cp3nRRHYMKcmA';
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY;
  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const mesAtual = new Date().getMonth();

  // Contexto financeiro
  let contextoFinanceiro = '';
  if (typeof dados !== 'undefined' && typeof calcularMes === 'function') {
    try {
      const c = calcularMes(mesAtual);
      const cAnt = mesAtual > 0 ? calcularMes(mesAtual-1) : null;
      contextoFinanceiro = '\nFINANCEIRO — ' + MESES_PT[mesAtual] + ':\n- Entradas: ' + fmt(c.totalBruto) + '\n- Saídas: ' + fmt(c.totalSaidas) + '\n- Lucro: ' + fmt(c.totalLiquido) + (cAnt?'\n- vs mês anterior: ' + fmt(c.totalLiquido-cAnt.totalLiquido):'') + '\n';
    } catch(e) {}
  }

  // Contexto OS
  let contextoOS = '';
  if (typeof ordens !== 'undefined') {
    try {
      const abertas=ordens.filter(o=>o.status==='aberta').length;
      const andamento=ordens.filter(o=>o.status==='andamento').length;
      const concluidas=ordens.filter(o=>o.status==='concluida').length;
      contextoOS = '\nOS: Total ' + ordens.length + ' | Abertas: ' + abertas + ' | Andamento: ' + andamento + ' | Concluídas: ' + concluidas + '\n';
    } catch(e) {}
  }

  // Contexto estoque
  let contextoEst = '';
  if (typeof estoque !== 'undefined' && typeof estCalcResumo === 'function') {
    try {
      const r=estCalcResumo();
      const z=estoque.filter(p=>(parseFloat(p.qtd)||0)===0).length;
      contextoEst = '\nESTOQUE: ' + r.total + ' itens | Valor venda: ' + fmt(r.totalVenda) + ' | Zerados: ' + z + '\n';
    } catch(e) {}
  }

  // Contexto orçamentos
  let contextoOrc = '';
  if (typeof orcamentos !== 'undefined') {
    try {
      const pend=orcamentos.filter(o=>o.status==='pendente'||!o.status).length;
      const aprov=orcamentos.filter(o=>o.status==='aceito').length;
      const inadimp=orcamentos.filter(o=>(o.status==='aceito'||o.status==='aprovado')&&!o.pago&&!(o.valorPago>0)).length;
      contextoOrc = '\nORÇAMENTOS: Total ' + orcamentos.length + ' | Pendentes: ' + pend + ' | Aprovados: ' + aprov + ' | Sem pagamento: ' + inadimp + '\n';
    } catch(e) {}
  }

  // Alertas
  const alertas = zlChatAlertas();
  const contextoAlertas = alertas.length ? '\nALERTAS ATIVOS:\n' + alertas.map(a=>a.replace(/<[^>]+>/g,'')).join('\n') + '\n' : '';

  const systemPrompt = `Você é o Jean, assistente virtual da ZL Motos — oficina mecânica de motocicletas em São José do Rio Preto, SP.

DADOS DO SISTEMA:
${contextoFinanceiro}${contextoOS}${contextoEst}${contextoOrc}${contextoAlertas}
PERSONALIDADE:
- Seja amigável, direto e use linguagem informal
- Pode responder saudações normalmente ("oi", "tudo bem", etc.)
- Dê dicas práticas de negócio quando pertinente
- Use emojis com moderação
- Máximo 5 linhas por resposta
- Responda SEMPRE em português brasileiro
- Se não souber algo, diga honestamente`;

  // Adiciona ao histórico
  zlChatHistorico.push({ role: 'user', parts: [{ text: pergunta }] });
  if (zlChatHistorico.length > 10) zlChatHistorico = zlChatHistorico.slice(-10); // mantém últimas 10 msgs

  const typingId = 'typing-' + Date.now();
  zlMsgBot('<span id="' + typingId + '">💭 Pensando...</span>', 0);

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: zlChatHistorico,
        generationConfig: { maxOutputTokens: 400, temperature: 0.8 }
      })
    });
    const data = await response.json();
    const el = document.getElementById(typingId);
    const resposta = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')
      : 'Não consegui processar. Pode reformular?';
    
    // Adiciona resposta ao histórico
    zlChatHistorico.push({ role: 'model', parts: [{ text: resposta.replace(/<[^>]+>/g,'') }] });
    
    if (el) el.parentElement.innerHTML = '🤖 ' + resposta;
    else zlMsgBot('🤖 ' + resposta, 0);
  } catch(e) {
    const el = document.getElementById(typingId);
    const fallback = '⚠️ Não consegui conectar ao Gemini. Verifique a conexão.<br><br><span class="zl-tag" onclick="zlChatPergunta(this)">alertas do dia</span> <span class="zl-tag" onclick="zlChatPergunta(this)">financeiro</span>';
    if (el) el.parentElement.innerHTML = fallback;
    else zlMsgBot(fallback, 0);
  }
}

// ═══════════════════════════════════════════
// MÓDULO ORDENS DE SERVIÇO
// ═══════════════════════════════════════════
// ── Autocomplete de cliente no orçamento ────────────────
function orcClienteAutoComplete(termo) {
  const drop = document.getElementById('orc-cli-drop');
  if (!drop) return;
  if (!termo || termo.length < 1) { drop.style.display = 'none'; return; }
  const sugs = (clientesCadastradosManuais||[])
    .filter(c => c.nome.toLowerCase().includes(termo.toLowerCase()))
    .slice(0, 6);
  if (!sugs.length) { drop.style.display = 'none'; return; }
  drop.style.cssText = 'display:block;position:absolute;top:100%;left:0;right:0;background:#1a1a2e;border:1px solid var(--color-border);border-radius:10px;z-index:200;overflow:hidden;margin-top:3px;box-shadow:0 8px 24px rgba(0,0,0,.4)';
  drop.innerHTML = sugs.map(c =>
    `<div onclick="orcAtribuirCliente('${c.id}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05)"
      onmouseover="this.style.background='rgba(56,189,248,.1)'" onmouseout="this.style.background=''">
      <div style="font-weight:700;color:#fff;font-size:.88rem">${c.nome}</div>
      <div style="font-size:.72rem;color:var(--color-text-muted)">${[c.tel,c.veic,c.placa].filter(Boolean).join(' · ')||'Sem detalhes'}</div>
    </div>`
  ).join('');
}

function orcAtribuirCliente(id) {
  const c = (clientesCadastradosManuais||[]).find(x => x.id === id);
  if (!c) return;
  orcAtual.cliente   = c.nome;
  orcAtual.telefone  = c.tel||c.telefone||orcAtual.telefone||'';
  orcAtual.veiculo   = c.veic||c.veiculo||orcAtual.veiculo||'';
  orcAtual.placa     = c.placa||orcAtual.placa||'';
  orcAtual.clienteId = c.id;
  const drop = document.getElementById('orc-cli-drop');
  if (drop) drop.style.display = 'none';
  renderOrcamento();
  mostrarToast('✓ Cliente atribuído: ' + c.nome);
}

// RF01 — LISTENER DE OS EM TEMPO REAL
// ═══════════════════════════════════════════
// I02 — Peças do estoque na OS ─────────────────────────────────
function osToggleCatalogoEstoque(osId) {
  const el = document.getElementById('os-cat-estoque-'+osId);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function osRenderCatEstoque(osId, busca) {
  const el = document.getElementById('os-cat-lista-'+osId);
  if (!el) return;
  const filtradas = estoque.filter(p => (parseFloat(p.qtd)||0) > 0 && (!busca || p.nome.toLowerCase().includes(busca.toLowerCase())));
  el.innerHTML = filtradas.map(p => `
    <div onclick="osAddPecaEstoque('${osId}','${p.nome.replace(/'/g,"\\'")}') "
      style="padding:7px 10px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);font-size:.75rem"
      onmouseover="this.style.background='rgba(251,191,36,.1)'" onmouseout="this.style.background='rgba(255,255,255,.04)'">
      <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nome}</div>
      <div style="color:var(--color-text-muted);font-size:.68rem">R$ ${parseFloat(p.venda||0).toFixed(2)} · ${p.qtd} em estoque</div>
    </div>`).join('') || '<div style="color:var(--color-text-muted);font-size:.78rem;padding:10px">Nenhuma peça encontrada</div>';
}
async function osAddPecaEstoque(osId, nomePeca) {
  const os = ordens.find(o => o.id === osId);
  const p  = estoque.find(x => x.nome === nomePeca);
  if (!os || !p) return;
  const qtdDisp = parseFloat(p.qtd)||0;
  if (qtdDisp <= 0) { mostrarToast('Sem estoque disponível'); return; }
  if (!os.itens) os.itens = [];
  const exist = os.itens.find(it => it._estoqueNome === nomePeca);
  if (exist) {
    if (exist.qtd >= qtdDisp) { mostrarToast('Estoque insuficiente'); return; }
    exist.qtd++;
  } else {
    os.itens.push({ id: Date.now(), desc: nomePeca, qtd: 1, vunit: parseFloat(p.venda)||0, cat: 'Peça', _estoqueNome: nomePeca });
  }
  // Dar baixa no estoque
  p.qtd = Math.max(0, qtdDisp - 1);
  await estSalvar();
  await salvarOS();
  mostrarToast(`✓ ${nomePeca} adicionada à OS`);
  osAberta = osId;
  renderOS();
}

function osIniciarListenerTempoReal() {
  if (_osUnsubscribe) return; // já ativo
  try {
    const ref = window._userDoc('os_lista');
    _osUnsubscribe = window._firestoreOnSnapshot(ref, snap => {
      if (!snap.exists()) return;
      const novasOrdens = snap.data().lista || [];
      // RF04 — detectar mudança de status e notificar
      novasOrdens.forEach(nova => {
        const antiga = ordens.find(o => o.id === nova.id);
        if (antiga && antiga.status !== nova.status) {
          osNotificarMudancaStatus(nova, antiga.status, nova.status);
        }
      });
      ordens = novasOrdens;
      // RF02 — contadores atualizam automaticamente via re-render
      if (abaAtiva === 15) renderOS();
      osVerificarAlertas(); // RF10
    });
  } catch(e) { console.warn('osIniciarListenerTempoReal:', e); }
}

// RF04 — Notificação ao mover cartão entre colunas
const _osStatusLabels = {
  aberta: 'Em Espera', andamento: 'Em Andamento',
  concluida: 'Finalização', entregue: 'Pronta!'
};
function osNotificarMudancaStatus(os, de, para) {
  const label = _osStatusLabels[para] || para;
  const msg = `🔧 OS ${osNumeroFormatado(os.numero)} — ${os.cliente||'?'} movida para "${label}"`;
  mostrarToast(msg);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('ZL Motos — OS Atualizada', { body: msg, icon: '' }); } catch(e) {}
  }
}

// Solicitar permissão de notificação push
function osSolicitarPermissaoNotificacao() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// RF03+RF04 — Drag-and-drop no Kanban de OS
let _osDragId = null;
function osKanbanDragStart(id, e) {
  _osDragId = id;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.5';
}
function osKanbanDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  document.querySelectorAll('.os-kanban-col').forEach(c => c.classList.remove('drag-over'));
}
function osKanbanDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function osKanbanDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
async function osKanbanDrop(novoStatus, e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!_osDragId) return;
  const os = ordens.find(o => o.id === _osDragId);
  if (!os || os.status === novoStatus) { _osDragId = null; return; }
  await osSalvarCampo(os.id, 'status', novoStatus); // salva + notifica via listener
  _osDragId = null;
}

// RF07/RF08 — Filtrar ordens com busca + filtros rápidos
function osAplicarFiltros(lista) {
  return lista.filter(os => {
    if (osFiltroUrgente && !os.urgente) return false;
    if (osFiltroStatus && (os.status||'aberta') !== osFiltroStatus) return false;
    if (osFiltroAtrasadas) {
      const diasAtras = 7;
      const entrada = os.dataEntrada || os.criadoEm;
      if (!entrada) return false;
      const dias = Math.floor((new Date() - new Date(entrada)) / 86400000);
      if (dias < diasAtras) return false;
    }
    if (osFiltroMecanico && (os.mecanico||'').toLowerCase() !== osFiltroMecanico.toLowerCase()) return false;
    if (osFiltroMecanico && (os.mecanico||"").toLowerCase() !== osFiltroMecanico.toLowerCase()) return false;
    if (osBuscaTermo.trim()) {
      const t = osBuscaTermo.toLowerCase();
      return (os.cliente||"").toLowerCase().includes(t)
        || (os.placa||"").toLowerCase().includes(t)
        || (os.veiculo||"").toLowerCase().includes(t)
        || String(os.numero||"").includes(t);
    }
    return true;
  });
}

function osVerificarAlertas() {
  const urgentes = ordens.filter(o => o.urgente && (o.status==='aberta'||o.status==='andamento'));
  const paradas7 = ordens.filter(o => {
    if (o.status !== 'aberta' && o.status !== 'andamento') return false;
    const entrada = o.dataEntrada || (o.criadoEm ? o.criadoEm.slice(0,10) : null);
    if (!entrada) return false;
    return Math.floor((new Date() - new Date(entrada+'T12:00:00')) / 86400000) >= 7;
  });
  // Badge na sidebar
  const badge = document.getElementById('os-alerta-badge');
  const total = urgentes.length + paradas7.length;
  if (badge) {
    badge.textContent = total > 0 ? total : '';
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
  // Toast para OS paradas há 7+ dias (uma vez por sessão)
  if (!window._os7diasAlertado && paradas7.length > 0) {
    window._os7diasAlertado = true;
    setTimeout(() => {
      mostrarToast(`⏸️ ${paradas7.length} OS parada(s) há mais de 7 dias sem atualização!`);
    }, 2000);
  }
}

// ═══════════════════════════════════════════

let osContador = 0;

async function salvarOS() {
  try {
    const ref = window._userDoc('os_lista');
    await window._firestoreSetDoc(ref, { lista: ordens, atualizadoEm: new Date().toISOString() });
    // Salva também contador
    const refCnt = window._userDoc('os_contador');
    await window._firestoreSetDoc(refCnt, { valor: osContador });
  } catch(e) {
    console.warn('Erro ao salvar OS:', e);
    mostrarErro('Erro ao salvar OS — verifique conexão');
  }
}

async function osCarregarContador() {
  try {
    const ref = window._userDoc('os_contador');
    const snap = await window._firestoreGetDoc(ref);
    if (snap.exists()) osContador = snap.data().valor || 0;
    else osContador = ordens.length;
  } catch(e) { osContador = ordens.length; }
}

function osNumeroFormatado(n) {
  return 'OS-' + String(n).padStart(3, '0');
}

async function osConverterOrcamento(orcId) {
  const orc = orcamentos.find(o => o.id === orcId);
  if (!orc) return;
  if (orc.status !== 'aceito') {
    mostrarErro('Aprove o orçamento primeiro antes de converter em OS');
    return;
  }
  const jaExiste = ordens.find(o => o.orcId === orcId);
  if (jaExiste) {
    mostrarToast('⚠ Já existe uma OS para este orçamento: ' + osNumeroFormatado(jaExiste.numero));
    abaAtiva = 15;
    renderAll();
    return;
  }
  await osCarregarContador();
  osContador++;
  const novaOS = {
    id: 'os_' + Date.now(),
    numero: osContador,
    orcId: orcId,
    cliente: orc.cliente || '',
    telefone: orc.telefone || '',
    veiculo: orc.veiculo || '',
    placa: orc.placa || '',
    km: orc.km || '',
    itens: JSON.parse(JSON.stringify(orc.itens || [])),
    total: ((orc.calc && orc.calc.total) != null && orc.calc.total > 0)
      ? orc.calc.total
      : (orc.itens||[]).reduce((s,it) => s + (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0), 0),
    status: 'aberta',
    mecanico: '',
    dataEntrada: new Date().toISOString().split('T')[0],
    previsaoEntrega: '',
    obsInternas: '',
    obsCliente: orc.obs || '',
    checklist: (orc.itens || []).map((it, i) => ({ id: i, desc: it.desc || '—', cat: it.cat || '', feito: false })),
    criadoEm: new Date().toISOString()
  };
  ordens.unshift(novaOS);
  await salvarOS();
  window._registrarLog('OS_CRIADA', { numero: osNumeroFormatado(novaOS.numero), cliente: novaOS.cliente, veiculo: novaOS.veiculo, total: novaOS.total });
  mostrarToast('✓ OS ' + osNumeroFormatado(novaOS.numero) + ' criada com sucesso!');
  abaAtiva = 15;
  osAberta = novaOS.id;
  renderAll();
}

async function osCancelar(id) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;
  confirmarExclusao(
    'Cancelar OS #' + osNumeroFormatado(os.numero) + '?',
    async () => {
      await osSetStatus(id, 'cancelada');
      mostrarToast('OS #' + osNumeroFormatado(os.numero) + ' cancelada.');
    }
  );
}

async function osSetStatus(id, status) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;
  const agora = new Date().toISOString();
  const statusAnterior = os.status;

  // Registrar tempo de serviço
  if (!os.tempoServico) os.tempoServico = {};

  // Iniciou serviço
  if (status === 'andamento' && statusAnterior !== 'andamento') {
    os.tempoServico.inicio = agora;
    os.tempoServico.fim = null;
    os.tempoServico.totalMs = os.tempoServico.totalMs || 0;
  }

  // Pausou ou concluiu
  if (statusAnterior === 'andamento' && status !== 'andamento') {
    if (os.tempoServico.inicio) {
      const ms = osTempoComercial(new Date(os.tempoServico.inicio), new Date(agora));
      os.tempoServico.totalMs = (os.tempoServico.totalMs || 0) + ms;
      os.tempoServico.fim = agora;
    }
  }

  os.status = status;
  await salvarOS();
  renderAll();
  mostrarToast('✓ Status da OS atualizado');
}

function osFmtTempo(ms) {
  if (!ms || ms <= 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return h + 'h ' + m + 'min';
  return m + ' min';
}

function osTempoAtual(os) {
  if (!os.tempoServico) return 0;
  let total = os.tempoServico.totalMs || 0;
  // Se ainda em andamento, soma apenas o tempo em horário comercial (08h-18h)
  if (os.status === 'andamento' && os.tempoServico.inicio && !os.tempoServico.fim) {
    total += osTempoComercial(new Date(os.tempoServico.inicio), new Date());
  }
  return total;
}

function osTempoComercial(inicio, fim) {
  // Conta apenas milissegundos entre 08:00 e 18:00 de dias úteis (seg-sab)
  let ms = 0;
  let cur = new Date(inicio);
  const HORA_INI = 8, HORA_FIM = 18;

  while (cur < fim) {
    const dow = cur.getDay(); // 0=dom
    if (dow !== 0) { // ignora domingo
      const diaIni = new Date(cur); diaIni.setHours(HORA_INI, 0, 0, 0);
      const diaFim = new Date(cur); diaFim.setHours(HORA_FIM, 0, 0, 0);
      const segIni = Math.max(cur.getTime(), diaIni.getTime());
      const segFim = Math.min(fim.getTime(), diaFim.getTime());
      if (segFim > segIni) ms += segFim - segIni;
    }
    // Avançar para o próximo dia
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }
  return ms;
}

function osCalcTotal(os) {
  if (!os || !Array.isArray(os.itens)) return 0;
  return os.itens.reduce((s, it) => s + (parseFloat(it.qtd)||0) * (parseFloat(it.vunit)||0), 0);
}

async function osSalvarCampo(id, campo, valor) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;

  const camposImportantes = ['status','cliente','veiculo','placa','mecanico','previsaoEntrega','tipoServico','total'];
  if (camposImportantes.includes(campo)) {
    if (!os.historico) os.historico = [];
    const valorAnterior = os[campo];
    if (String(valorAnterior) !== String(valor)) {
      os.historico.push({ data: new Date().toISOString(), campo, de: valorAnterior, para: valor });
      if (os.historico.length > 30) os.historico = os.historico.slice(-30);
      // C01 — WhatsApp automático ao mudar status
      if (campo === 'status' && os.telefone) {
        os[campo] = valor;
        osWhatsAppAutomatico(os, valor);
      }
      // I08 — Lembrete de retorno pós-OS
      if (campo === 'status' && valor === 'entregue') {
        setTimeout(() => {
          const dias = prompt(`Lembrete de retorno para ${os.cliente||'cliente'}:\nEm quantos dias deseja contatar o cliente?\n(deixe em branco para pular)`, '30');
          if (dias && parseInt(dias) > 0) {
            const dataRetorno = new Date();
            dataRetorno.setDate(dataRetorno.getDate() + parseInt(dias));
            if (!os.lembretes) os.lembretes = [];
            os.lembretes.push({ tipo: 'retorno', data: dataRetorno.toISOString().split('T')[0], dias: parseInt(dias), criadoEm: new Date().toISOString() });
            salvarOS();
            mostrarToast(`✓ Lembrete criado para ${dataRetorno.toLocaleDateString('pt-BR')}`);
          }
        }, 800);
      }
    }
  }

  os[campo] = valor;
  os.total = osCalcTotal(os);
  await salvarOS();
}

async function osToggleChecklist(osId, itemId) {
  const os = ordens.find(o => o.id === osId);
  if (!os) return;
  // Garante que checklist existe e está sincronizado com itens
  if (!Array.isArray(os.checklist) || os.checklist.length === 0) {
    os.checklist = (os.itens || []).map((it, i) => ({ id: i, desc: it.desc || '—', cat: it.cat || '', feito: false }));
  }
  const item = os.checklist.find(c => c.id === itemId);
  if (item) item.feito = !item.feito;
  // Atualiza status automaticamente se todos feitos
  const todos = os.checklist.every(c => c.feito);
  if (todos && os.status === 'andamento') {
    os.status = 'concluida';
    mostrarToast('✅ Todos os itens concluídos! OS marcada como Concluída.');
  }
  await salvarOS();
  renderOS();
}


async function osExcluir(id) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;
  confirmarExclusao('OS ' + osNumeroFormatado(os.numero), async () => {
    window._registrarLog('OS_EXCLUIDA', { numero: osNumeroFormatado(os.numero), cliente: os.cliente, veiculo: os.veiculo, status: os.status });
    ordens = ordens.filter(o => o.id !== id);
    await salvarOS();
    renderAll();
    mostrarToast('✓ OS excluída');
  });
}

function osEstaAtrasada(os) {
  if (!os.previsaoEntrega) return false;
  if (os.status === 'entregue' || os.status === 'cancelada') return false;
  return hojeISO() > os.previsaoEntrega;
}

function osEstaParada(os, diasLimite) {
  if (os.status !== 'andamento') return false;
  // Verificar última atualização: usar tempoServico.inicio ou data da OS
  const ref = os.tempoServico && os.tempoServico.inicio ? os.tempoServico.inicio : (os.dataEntrada ? os.dataEntrada + 'T12:00:00' : null);
  if (!ref) return false;
  const diasPassados = (new Date() - new Date(ref)) / (1000*60*60*24);
  return diasPassados >= diasLimite;
}

function osAlertaBadge(os) {
  let badges = '';
  if (osEstaAtrasada(os)) {
    const diasAtraso = Math.ceil((new Date(hojeISO()) - new Date(os.previsaoEntrega + 'T12:00:00')) / (1000*60*60*24));
    badges += ' <span class="badge badge-danger"><span class="badge-dot"></span>🔴 ' + diasAtraso + 'd atraso</span>';
  }
  if (osEstaParada(os, 4)) {
    badges += ' <span class="badge badge-warning"><span class="badge-dot"></span>⏸️ Parada</span>';
  }
  return badges;
}

function osStatusBadge(status) {
  const mapa = {
    'aberta':    { cls: 'badge-primary', dot: true,  icon: '🔵', txt: 'EM ESPERA' },
    'andamento': { cls: 'badge-warning', dot: true,  icon: '⚙️', txt: 'EM ANDAMENTO' },
    'concluida': { cls: 'badge-success', dot: false, icon: '✅', txt: 'FINALIZAÇÃO' },
    'entregue':  { cls: 'badge-purple',  dot: false, icon: '🏁', txt: 'PRONTA!' },
    'cancelada': { cls: 'badge-danger',  dot: false, icon: '❌', txt: 'CANCELADA' },
  };
  const s = mapa[status] || mapa['aberta'];
  return '<span class="badge ' + s.cls + '">' + (s.dot ? '<span class="badge-dot"></span>' : '') + s.icon + ' ' + s.txt + '</span>';
}

let osAberta = null; // OS sendo visualizada em detalhe

function renderOSListaHTML(fmtN, listaFiltrada) {
  const lista = listaFiltrada || ordens;
  if (lista.length === 0) {
    return '<div style="text-align:center;padding:60px 20px;color:var(--color-text-muted)">'
      + '<div style="font-size:3rem;margin-bottom:16px">🔧</div>'
      + '<div style="font-family:\'Inter\';font-size:1.1rem;letter-spacing:3px;margin-bottom:8px">' + (ordens.length === 0 ? 'Nenhuma OS criada' : 'Nenhuma OS encontrada com os filtros') + '</div>'
      + '<div style="font-size:.85rem">' + (ordens.length === 0 ? 'Vá em Orçamentos, aprove um e clique em <b>Converter em OS</b>' : 'Tente limpar os filtros ou buscar por outro termo') + '</div>'
      + '</div>';
  }
  const rows = lista.map(function(os, i) {
    const bg = i%2===0 ? '' : 'background:rgba(255,255,255,.02)';
    return '<tr style="' + bg + '">'
      + '<td style="padding:8px 12px;color:#a78bfa;font-weight:700">' + osNumeroFormatado(os.numero) + '</td>'
      + '<td style="padding:8px 12px;font-weight:600">' + (os.cliente||'—') + '</td>'
      + '<td style="padding:8px 12px;color:var(--color-text-muted);font-size:.78rem;display:none" class="hide-mobile">' + (os.veiculo||'—') + '</td>'
      + '<td style="padding:8px 12px">' + osStatusBadge(os.status) + osGarantiaBadge(os) + osAlertaBadge(os) + (os.urgente ? ' <span style="font-size:.62rem;color:#fca5a5;font-weight:700;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:4px;padding:1px 5px">🔴 URGENTE</span>' : '') + (osTempoAtual(os) > 0 ? ' <span style="font-size:.65rem;color:#a78bfa;background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.3);border-radius:4px;padding:1px 5px">⏱️ ' + osFmtTempo(osTempoAtual(os)) + '</span>' : '') + '</td>'
      + '<td style="padding:8px 12px;color:#6ee7b7">' + fmtN(osCalcTotal(os)) + '</td>'
      + '<td style="padding:8px 12px"><div style="display:flex;gap:4px;flex-wrap:wrap">'
      + '<button class="btn btn-sm btn-duplic" onclick="osAberta=\'' + os.id + '\';renderOS()">📋 Abrir</button>'
      + '<button class="btn btn-sm btn-pdf" onclick="osPDF(\'' + os.id + '\')"><span class="pdf-star pdf-star-1"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-2"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-3"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-4"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-5"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-6"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span>🖨️ PDF</button>'
      + '<button class="btn btn-del btn-sm" onclick="osExcluir(\'' + os.id + '\')">✕</button>'
      + '</div></td></tr>';
  }).join('');
  return '<div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:12px;overflow:hidden">'
    + '<table style="width:100%;font-size:.82rem;border-collapse:collapse">'
    + '<thead><tr style="background:rgba(26,58,107,.8)">'
    + '<th style="padding:10px 12px;text-align:left;font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted)">Nº OS</th>'
    + '<th style="padding:10px 12px;text-align:left;font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted)">Cliente</th>'
    + '<th style="padding:10px 12px;text-align:left;font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted);display:none" class="hide-mobile">Veículo</th>'
    + '<th style="padding:10px 12px;text-align:left;font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted)">Status</th>'
    + '<th style="padding:10px 12px;text-align:left;font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted)">Total</th>'
    + '<th style="padding:10px 12px;text-align:left;font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted)">Ações</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}