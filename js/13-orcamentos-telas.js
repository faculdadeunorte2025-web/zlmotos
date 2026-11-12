// SELEÇÃO DE ORÇAMENTO PARA PDF
// ═══════════════════════════════════════════
let orcSelecionadoId = null;

function orcSelecionarLinha(id, event) {
  // Não selecionar se clicou em botão
  if (event && event.target.tagName === 'BUTTON') return;
  orcSelecionadoId = orcSelecionadoId === id ? null : id;
  orcAtualizarBotaoPDF();
}

function orcAtualizarBotaoPDF() {
  // Atualiza visual dos cards
  document.querySelectorAll('.orc-glass-card').forEach(function(card) {
    card.style.outline = '';
    card.style.boxShadow = '';
  });
  const hint = document.getElementById('orc-pdf-hint');
  const btnPdf = document.getElementById('btn-pdf-lista');
  if (orcSelecionadoId) {
    const card = document.querySelector('.orc-glass-card[data-orcid="' + orcSelecionadoId + '"]');
    if (card) {
      card.style.outline = '2px solid var(--color-primary)';
      card.style.boxShadow = '0 0 16px rgba(255,255,255,0.2)';
    }
    if (hint) { hint.textContent = '✓ Orçamento selecionado — clique em Gerar PDF'; hint.className = 'orc-pdf-hint pronto'; }
    if (btnPdf) { btnPdf.style.opacity = '1'; btnPdf.style.cursor = 'pointer'; btnPdf.disabled = false; }
  } else {
    if (hint) { hint.textContent = 'Clique em um orçamento da lista para selecionar'; hint.className = 'orc-pdf-hint'; }
    if (btnPdf) { btnPdf.style.opacity = '.5'; btnPdf.style.cursor = 'not-allowed'; btnPdf.disabled = true; }
  }
}

function orcPDFSelecionado() {
  if (!orcSelecionadoId) { mostrarErro('Selecione um orçamento na lista antes de gerar o PDF'); return; }
  const orc = orcamentos.find(o => o.id === orcSelecionadoId);
  if (!orc) { mostrarErro('Orçamento não encontrado'); return; }
  // Gerar PDF passando os dados diretamente, sem trocar orcAtual
  orcPDFDireto(orc);
}

// ═══════════════════════════════════════════
// ── KANBAN DE ORÇAMENTOS ────────────────────────────────────────
function renderOrcamentosKanban() {
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const colunas = [
    { key: 'pendente',  keys: ['pendente',''],      icon: '', titulo: 'Pendentes',           cor: '#d4d4d8', bg: 'rgba(255,255,255,0.03)',   borda: 'rgba(255,255,255,0.125)' },
    { key: 'enviado',   keys: ['enviado'],           icon: '', titulo: 'Enviados',            cor: '#adadb0', bg: 'rgba(255,255,255,0.03)',   borda: 'rgba(255,255,255,0.125)' },
    { key: 'aceito',    keys: ['aceito','aprovado'], icon: '', titulo: 'Autorizados',         cor: '#5cab84', bg: 'rgba(255,255,255,0.03)',   borda: 'rgba(255,255,255,0.125)' },
    { key: 'parcial',   keys: ['__parcial__'],       icon: '', titulo: 'Pgto. Parcial',       cor: '#c2c2c5', bg: 'rgba(255,255,255,0.03)',  borda: 'rgba(255,255,255,0.125)' },
    { key: 'pago',      keys: ['__pago__'],          icon: '', titulo: 'Concluídos / Pagos',  cor: '#5fac86', bg: 'rgba(255,255,255,0.03)',   borda: 'rgba(255,255,255,0.125)' },
    { key: 'reprovado', keys: ['reprovado'],          icon: '', titulo: 'Reprovados',          cor: '#dd8c8c', bg: 'rgba(255,255,255,0.03)',  borda: 'rgba(255,255,255,0.125)' },
  ];

  const colunasHTML = colunas.map(col => {
    let itens;
    if (col.key === 'pago') {
      itens = orcamentos.filter(o => {
        const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
        const pago  = parseFloat(o.valorPago||0);
        return o.pago || (pago >= total * 0.999 && total > 0 && (o.status==='aceito'||o.status==='aprovado'));
      });
    } else if (col.key === 'parcial') {
      itens = orcamentos.filter(o => {
        const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
        const pago  = parseFloat(o.valorPago||0);
        return !o.pago && pago > 0 && pago < total * 0.999 && total > 0
          && (o.status==='aceito'||o.status==='aprovado');
      });
    } else if (col.key === 'aceito') {
      itens = orcamentos.filter(o => {
        const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
        const pago  = parseFloat(o.valorPago||0);
        const isPago    = o.pago || (pago >= total * 0.999 && total > 0);
        const isParcial = !isPago && pago > 0;
        return col.keys.includes(o.status||'') && !isPago && !isParcial;
      });
    } else {
      itens = orcamentos.filter(o => col.keys.includes(o.status||''));
    }

    const totalCol = itens.reduce((s,o) => s + parseFloat((o.calc&&o.calc.total)||o.total||0), 0);

    const cards = itens.length === 0
      ? '<div style="text-align:center;color:rgba(255,255,255,.2);font-size:.75rem;padding:20px 0">Nenhum</div>'
      : [...itens].sort((a,b)=>(b.criadoEm||b.data||'').localeCompare(a.criadoEm||a.data||'')).map(o => {
          const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
          const pago  = parseFloat(o.valorPago||0);
          const isPago = o.pago || (pago >= total * 0.999 && total > 0);
          const isParcial = !isPago && pago > 0;
          const diasO = orcDiasDesde(o.criadoEm);
          const vencido = (o.status!=='aceito'&&o.status!=='aprovado') && diasO > 7;
          const dataFmt = o.data ? new Date(o.data+'T12:00:00').toLocaleDateString('pt-BR') : '—';
          const btnOS = '';
          const btnPagar = (o.status==='aceito'||o.status==='aprovado') && !isPago
            ? '<button onclick="event.stopPropagation();orcRegistrarPagamento(\'' + o.id + '\')" style="font-size:.68rem;padding:3px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.175);color:#5cab84;border-radius:6px;cursor:pointer">' + (isParcial?'Completar':'Pagar') + '</button>' : '';
          const pagBadge = isPago ? '<span style="font-size:.6rem;color:#5cab84;font-weight:700">✓ PAGO</span>'
            : isParcial ? '<span style="font-size:.6rem;color:#c2c2c5;font-weight:700">' + fmtN(pago) + ' pago</span>'
            : '';

          return '<div onclick="if(event.target.tagName!==\'BUTTON\'){orcCarregar(\'' + o.id + '\')}"'
            + ' style="background:rgba(255,255,255,.04);border:1px solid ' + (vencido?'rgba(255,255,255,0.15)':col.borda) + ';border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:all .15s"'
            + ' onmouseover="this.style.background=\'rgba(255,255,255,.07)\'" onmouseout="this.style.background=\'rgba(255,255,255,.04)\'">'
            + '<div style="font-weight:700;font-size:.88rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (o.cliente||'—') + '</div>'
            + '<div style="font-size:.72rem;color:var(--color-text-muted);margin:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (o.veiculo||'—') + '</div>'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">'
            + '<span style="font-size:.85rem;font-weight:700;color:' + col.cor + '">' + fmtN(total) + '</span>'
            + '<span style="font-size:.65rem;color:var(--color-text-muted)">' + dataFmt + (vencido?' <span style="color:#eab7b7"></span>':'') + '</span>'
            + '</div>'
            + (pagBadge ? '<div style="margin-top:4px">' + pagBadge + '</div>' : '')
            + '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">'
            + '<button onclick="event.stopPropagation();orcCarregar(\'' + o.id + '\')" style="font-size:.68rem;padding:3px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:6px;cursor:pointer">Editar</button>'
            + btnOS + btnPagar
            + (o.telefone ? '<button onclick="event.stopPropagation();orcWhatsAppDireto(orcamentos.find(x=>x.id===\'' + o.id + '\'))" style="font-size:.68rem;padding:3px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#54a47c;border-radius:6px;cursor:pointer">WPP</button>' : '')
            + '<button onclick="event.stopPropagation();orcExcluirSalvo(\'' + o.id + '\')" style="font-size:.68rem;padding:3px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#dd8c8c;border-radius:6px;cursor:pointer">✕</button>'
            + '</div>'
            + '</div>';
        }).join('');

    return '<div style="flex:1;min-width:200px;background:' + col.bg + ';border:1px solid ' + col.borda + ';border-radius:14px;padding:14px;display:flex;flex-direction:column">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid ' + col.borda + '">'
      + '<div style="font-size:.9rem;font-weight:700;color:' + col.cor + '">' + col.icon + ' ' + col.titulo + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">'
      + '<span style="font-size:.68rem;background:' + col.borda + ';color:' + col.cor + ';border-radius:999px;padding:1px 8px;font-weight:700">' + itens.length + '</span>'
      + (itens.length>0?'<span style="font-size:.6rem;color:var(--color-text-muted)">' + fmtN(totalCol) + '</span>':'')
      + '</div></div>'
      + '<div style="flex:1;overflow-y:auto;max-height:calc(100vh - 200px)">' + cards + '</div>'
      + '</div>';
  }).join('');

  return '<div style="display:flex;gap:12px;align-items:flex-start;overflow-x:auto;padding-bottom:8px">' + colunasHTML + '</div>';
}

function renderOrcamentosListaHTML() {
  const mesesNome = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const filtroHtml = '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px;align-items:center">'
    + '<span style="font-size:.68rem;color:var(--color-text-muted);letter-spacing:1px">MÊS:</span>'
    + '<button class="filtro-btn' + (orcFiltroMes===''?' ativo':'') + '" onclick="orcFiltroMes=\'\';renderOrcamento()" style="font-size:.65rem;padding:2px 8px">Todos</button>'
    + mesesNome.map(function(m,i) {
        var mv = String(i+1).padStart(2,'0');
        return '<button class="filtro-btn' + (orcFiltroMes===mv?' ativo':'') + '" onclick="orcFiltroMes=\'' + mv + '\';renderOrcamento()" style="font-size:.65rem;padding:2px 8px">' + m + '</button>';
      }).join('')
    + '</div>';

  const orcsFiltrados = orcFiltroMes
    ? orcamentos.filter(function(o) {
        var d = o.criadoEm || o.data || '';
        return d.slice(5,7) === orcFiltroMes;
      })
    : orcamentos;

  if (!orcamentos.length) return '';
  if (!orcsFiltrados.length) return filtroHtml + '<div class="orc-vazio">Nenhum orçamento encontrado para este mês.</div>';

  var fmtN = function(v){ return 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); };

  // Agrupa por data
  var gruposOrc = {};
  orcsFiltrados.forEach(function(o) {
    var d = (o.criadoEm || o.data || '').slice(0,10);
    if (!gruposOrc[d]) gruposOrc[d] = [];
    gruposOrc[d].push(o);
  });
  var datasOrc = Object.keys(gruposOrc).sort().reverse();

  var grupoHtml = datasOrc.map(function(d) {
    var itens = gruposOrc[d];
    var totalDia = itens.reduce(function(s,o){ return s + ((o.calc&&o.calc.total)||0); }, 0);
    var dLabel = d ? (function(){ try { return new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}); } catch(e){ return d; } })() : 'Sem data';

    var cardsHtml = itens.map(function(o) {
      var diasO = orcDiasDesde(o.criadoEm);
      var venc = o.status !== 'aceito' && diasO > 7;
      var statusClass = o.status === 'aceito' ? 'aceito'
        : (o.status === 'reprovado' ? 'reprovado'
        : (venc ? 'expirado'
        : (o.status === 'enviado' ? 'enviado' : '')));
      var dataFmt = o.data ? new Date(o.data+'T12:00:00').toLocaleDateString('pt-BR') : '—';
      var btnOS = '';
      var vencBadge = (o.validade && o.validade < hojeISO() && (o.status||'pendente') !== 'aceito')
        ? '<span style="font-size:.62rem;color:#eab7b7">Vencido</span>' : '';

      var totalOrc = parseFloat((o.calc&&o.calc.total)||o.total||0);
      var valorPago = parseFloat(o.valorPago||0);
      var isPago = o.pago || (valorPago >= totalOrc * 0.999 && totalOrc > 0);
      var isParcial = !isPago && valorPago > 0;
      var isAceitoNaoPago = (o.status==='aceito'||o.status==='aprovado') && !isPago;
      var inadimpClass = isAceitoNaoPago && isParcial ? ' orc-card-parcial' : isAceitoNaoPago ? ' orc-card-inadimp' : '';
      var btnPagar = (o.status==='aceito'||o.status==='aprovado') && !isPago ? '<button class="btn btn-sm" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.175);color:#5cab84" onclick="event.stopPropagation();orcRegistrarPagamento(\'' + o.id + '\')">' + (isParcial?'Completar':'Pagar') + '</button>' : '';
      var pagBadge = isPago ? '<span class="inadimp-badge pago">✓ PAGO</span>' : isParcial ? '<span class="inadimp-badge parcial">PARCIAL</span>' : isAceitoNaoPago ? '<span class="inadimp-badge total">NÃO PAGO</span>' : '';
      var cardHtml = '<div class="orc-glass-card ' + statusClass + inadimpClass + '" data-orcid="' + o.id + '" onclick="if(event.target.tagName!==\'BUTTON\'){orcCarregar(\'' + o.id + '\')}">'
        + '<div class="orc-card-dots">'
        + '<div class="orc-card-dot r"></div>'
        + '<div class="orc-card-dot y"></div>'
        + '<div class="orc-card-dot g"></div>'
        + '</div>'
        + '<div class="orc-card-collapsed">'
        + '<div class="orc-card-cliente" title="' + (o.cliente||'') + '">' + (o.cliente||'—') + '</div>'
        + '<div class="orc-card-veiculo" title="' + (o.veiculo||'') + '">' + (o.veiculo||'—') + '</div>'
        + '<div class="orc-card-total">' + fmtN(totalOrc) + '</div>'
        + '</div>'
        + '<div class="orc-card-expanded">'
        + '<div class="orc-card-info-row"><b>' + dataFmt + '</b> &nbsp;|&nbsp; ' + orcStatusBadge(o) + ' ' + vencBadge + ' ' + pagBadge + '</div>'
        + (o.telefone ? '<div class="orc-card-info-row">' + o.telefone + '</div>' : '')
        + '<div class="orc-card-btns">'
        + '<button class="btn btn-sm" style="color:var(--color-text-muted);border-color:rgba(255,255,255,.1)" onclick="event.stopPropagation();orcSetStatus(\'' + o.id + '\',\'pendente\')">Pendente</button>'
        + '<button class="btn btn-sm" style="color:var(--color-text-muted);border-color:rgba(255,255,255,.1)" onclick="event.stopPropagation();orcSetStatus(\'' + o.id + '\',\'enviado\')">Enviado</button>'
        + '<button class="btn btn-sm" style="color:#8fc6ab;border-color:rgba(255,255,255,0.15)" onclick="event.stopPropagation();orcSetStatus(\'' + o.id + '\',\'aceito\')">✓</button>'
        + '<button class="btn btn-sm btn-duplic" onclick="event.stopPropagation();orcCarregar(\'' + o.id + '\')">Editar</button>'
        + '<button class="btn btn-sm" onclick="event.stopPropagation();orcDuplicar(\'' + o.id + '\')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#adadb0;font-size:.68rem;padding:4px 8px">Duplicar</button>'
        + btnOS
        + btnPagar
        + '<button class="btn btn-sm" style="color:#98989b;border-color:rgba(255,255,255,0.15)" onclick="event.stopPropagation();orcGerarLinkAprovacao(\'' + o.id + '\')" title="Link aprovação">Link</button>'
        + '<button class="btn btn-del btn-sm" onclick="event.stopPropagation();orcExcluirSalvo(\'' + o.id + '\')">✕</button>'
        + '</div>'
        + '</div>'
        + '</div>';
      return cardHtml;
    }).join('');

    return '<div style="margin-bottom:22px">'
      + '<div class="orc-grupo-data-label">' + dLabel + ' &nbsp;·&nbsp; ' + itens.length + ' orçamento(s) &nbsp;·&nbsp; <span style="color:#8fc6ab">' + fmtN(totalDia) + '</span></div>'
      + '<div class="orc-cards-grid">' + cardsHtml + '</div>'
      + '</div>';
  }).join('');

  return filtroHtml
    + '<div style="background:rgba(42,42,45,.6);border:1px solid var(--color-border);border-radius:12px;padding:16px 20px;margin-bottom:18px">'
    + '<div style="font-size:.95rem;letter-spacing:.5px;color:var(--color-primary-hover);margin-bottom:14px;font-weight:700">Orçamentos Salvos' + (orcFiltroMes ? ' — ' + mesesNome[parseInt(orcFiltroMes)-1] : '') + '</div>'
    + grupoHtml
    + '</div>';
}

// RENDER ORÇAMENTO
// ═══════════════════════════════════════════
function renderOrcamento() {
  const main = document.getElementById('mainContent');

  // MODO LISTA — tela principal de orçamentos
  if (!orcModoFormulario) {
    main.innerHTML = '<div class="toolbar">'
      + '<span style="font-family:var(--font-titulo);font-size:1.35rem;letter-spacing:.5px;color:var(--verde)">Orçamentos</span>'
      + '<div class="toolbar-right">'
      + '<button class="btn btn-sm" onclick="orcViewMode=\'kanban\';renderOrcamento()" style="background:' + (orcViewMode==='kanban'?'rgba(255,255,255,0.1)':'rgba(255,255,255,.06)') + ';border-color:' + (orcViewMode==='kanban'?'rgba(92,171,132,.5)':'var(--color-border)') + ';color:' + (orcViewMode==='kanban'?'#5cab84':'var(--color-text-muted)') + '">Kanban</button>'
      + '<button class="btn btn-sm" onclick="orcViewMode=\'lista\';renderOrcamento()" style="background:' + (orcViewMode==='lista'?'rgba(255,255,255,0.1)':'rgba(255,255,255,.06)') + ';border-color:' + (orcViewMode==='lista'?'rgba(92,171,132,.5)':'var(--color-border)') + ';color:' + (orcViewMode==='lista'?'#5cab84':'var(--color-text-muted)') + '">Lista</button>'
      + '<button class="btn btn-add" onclick="orcNovoOrcamento()">+ Novo Orçamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>'
      + '</div></div>'
      + (orcViewMode === 'kanban' ? renderOrcamentosKanban() : renderOrcamentosListaHTML());
    return;
  }

  const calc = orcCalc();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const itensRows = orcAtual.itens.map((it, i) => {
    const sub = (parseFloat(it.qtd)||0) * (parseFloat(it.vunit)||0);
    const isMO = it.cat === 'Mão de Obra';
    return `<tr style="${isMO?'background:rgba(255,255,255,0.025);border-left:2px solid rgba(255,255,255,0.15)':''}">
      <td data-label="Descrição"><input type="text" value="${(it.desc||'').replace(/"/g,'&quot;')}" placeholder="Ex: Pastilha de freio..." oninput="orcAtual.itens[${i}].desc=this.value" onblur="salvarDados()"/></td>
      <td data-label="Cat.">
        <select style="max-width:120px;font-size:.75rem" onchange="orcAtual.itens[${i}].cat=this.value;renderOrcamento()">
          ${['Peça','Mão de Obra','Serviço','Outros'].map(c=>`<option value="${c}"${(it.cat||'Peça')===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </td>
      <td class="col-qtd" data-label="Qtd"><input type="number" class="valor" value="${it.qtd||''}" placeholder="1" min="0.01" step="0.01" oninput="orcAtual.itens[${i}].qtd=this.value;orcAtualizarSubtotais()"/></td>
      <td class="col-vunit" data-label="V. Unit R$"><input type="number" class="valor" value="${it.vunit||''}" placeholder="0,00" min="0" step="0.01" oninput="orcAtual.itens[${i}].vunit=this.value;orcAtualizarSubtotais()"/></td>
      <td class="col-desc-orc" data-label="Obs"><input type="text" value="${(it.obs||'').replace(/"/g,'&quot;')}" placeholder="Obs..." oninput="orcAtual.itens[${i}].obs=this.value" style="font-size:.78rem;color:var(--color-text-muted)"/></td>
      <td class="col-subtot subtotal-cel" data-label="Subtotal" id="orc-sub-${i}">${fmtN(sub)}</td>
      <td class="td-del"><button class="btn btn-del" onclick="orcRemItem(${i})">✕</button></td>
    </tr>`;
  }).join('');

  const statusAtual = orcAtual.status || 'pendente';
  const diasCriado = orcDiasDesde(orcAtual._criadoEm);
  const vencido = orcAtual._criadoEm && statusAtual !== 'aceito' && diasCriado > 15;
  const validadeExpirada = orcAtual.validade && orcAtual.validade < hojeISO() && statusAtual !== 'aceito';

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter',sans-serif;font-size:1.35rem;letter-spacing:.5px;color:var(--verde)">${orcAtual._id ? 'Editar Orçamento' : 'Novo Orçamento'}</span>
      <button class="btn-voltar" onclick="orcModoFormulario=false;renderOrcamento()" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#c3c3c6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
      ${orcAtual._id ? orcStatusBadge(orcAtual) : ''}
      ${validadeExpirada ? '<span style="background:rgba(255,255,255,0.075);border:1px solid rgba(255,255,255,0.2);color:#eab7b7;padding:2px 10px;border-radius:10px;font-size:.72rem">Validade expirada em ' + new Date(orcAtual.validade+'T12:00:00').toLocaleDateString('pt-BR') + '</span>' : (orcAtual.validade ? '<span style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:#5cab84;padding:2px 10px;border-radius:10px;font-size:.72rem">✓ Válido até ' + new Date(orcAtual.validade+'T12:00:00').toLocaleDateString('pt-BR') + '</span>' : '')}
      <div class="toolbar-right">
        <span class="orc-pdf-hint" id="orc-pdf-hint">Clique em um orçamento da lista para selecionar</span>
        <button class="btn btn-add verde" onclick="orcNovoOrcamento()">Novo Orçamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
        <button class="btn btn-duplic" onclick="orcSalvar()">Salvar</button>
        ${orcAtual._id ? `<button class="btn" style="background:rgba(255,255,255,0.075);border:1px solid rgba(255,255,255,0.2);color:#c2c2c5" onclick="orcAtribuirMecanico('${orcAtual._id}')">Atribuir Mecânico</button>` : ''}
        <button class="btn btn-pdf" onclick="${orcAtual._id ? 'orcPDFDireto(orcAtual)' : 'orcPDFSelecionado()'}" ${orcAtual._id ? '' : 'id="btn-pdf-lista" style="opacity:.5;cursor:not-allowed" disabled'}><span class="pdf-star pdf-star-1"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-2"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-3"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-4"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-5"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-6"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span>Gerar PDF</button>
        <button class="btn" style="background:linear-gradient(135deg,#3f7a5d,#33624b);color:white;padding:9px 18px;font-size:.88rem" onclick="orcWhatsApp()">WhatsApp</button>
      </div>
    </div>

    <div class="orc-layout">
      <!-- COLUNA PRINCIPAL -->
      <div class="orc-main-col">

        <!-- INFO CLIENTE -->
        <div class="orc-header-info" style="grid-template-columns:1fr 1fr 1fr;gap:14px">
          <div class="orc-field" style="position:relative">
            <label>Cliente</label>
            <input type="text" id="orc-cliente-input" value="${(orcAtual.cliente||'').replace(/"/g,'&quot;')}" placeholder="Nome do cliente..."
              oninput="orcAtual.cliente=this.value;orcClienteAutoComplete(this.value)"
              onblur="setTimeout(()=>{const d=document.getElementById('orc-cli-drop');if(d)d.remove();},200)"/>
            <div id="orc-cli-drop" style="display:none"></div>
          </div>
          <div class="orc-field">
            <label>Telefone</label>
            <input type="text" value="${(orcAtual.telefone||'').replace(/"/g,'&quot;')}" placeholder="(11) 99999-9999..." oninput="orcAtual.telefone=limparTel(this.value)"/>
          </div>
          <div class="orc-field">
            <label>Veículo / Modelo</label>
            <input type="text" value="${(orcAtual.veiculo||'').replace(/"/g,'&quot;')}" placeholder="Ex: Honda Titan 160 2022..." oninput="orcAtual.veiculo=this.value"/>
          </div>
          <div class="orc-field">
            <label>Placa</label>
            <input type="text" value="${(orcAtual.placa||'').replace(/"/g,'&quot;')}" placeholder="Ex: ABC-1234..." oninput="orcAtual.placa=this.value.toUpperCase();this.value=orcAtual.placa" style="text-transform:uppercase"/>
          </div>
          <div class="orc-field">
            <label>KM Entrada</label>
            <input type="number" class="valor" value="${orcAtual.km||''}" placeholder="Ex: 12500" min="0" step="1" oninput="orcAtual.km=this.value"/>
          </div>
          <div class="orc-field">
            <label>Data</label>
            <input type="date" value="${orcAtual.data||''}" oninput="orcAtual.data=this.value"/>
          </div>
          <div class="orc-field" style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,.06);padding-top:12px;margin-top:2px">
            <label>Válido até</label>
            <div style="display:flex;align-items:center;gap:10px">
              <input type="date" value="${orcAtual.validade||''}" oninput="orcAtual.validade=this.value" style="max-width:180px;${orcAtual.validade && orcAtual.validade < hojeISO() ? 'border-color:rgba(234,183,183,.5);color:#eab7b7' : ''}"/>
              ${orcAtual.validade && orcAtual.validade < hojeISO() ? '<span style="font-size:.7rem;color:#eab7b7">Validade expirada</span>' : (orcAtual.validade ? '<span style="font-size:.7rem;color:#8fc6ab">✓ Válido</span>' : '<span style="font-size:.7rem;color:var(--color-text-muted)">Preenchido automaticamente ao criar</span>')}
            </div>
          </div>
        </div>

        <!-- CARDS TOTAIS -->
        <div class="orc-totais" style="grid-template-columns:repeat(3,1fr)">
          <div class="orc-card pecas">
            <div class="orc-card-label">Subtotal Itens</div>
            <div class="orc-card-valor" id="orc-c-pecas">${fmtN(calc.totalItens)}</div>
          </div>
          <div class="orc-card desc">
            <div class="orc-card-label">Desconto${calc.descFidelidadeNum > 0 ? ' + Fidelidade' : ''}</div>
            <div class="orc-card-valor" id="orc-c-desc">${fmtN(calc.descValorNum + calc.descFidelidadeNum)}</div>
          </div>
          <div class="orc-card total">
            <div class="orc-card-label">Total Final</div>
            <div class="orc-card-valor" id="orc-c-total">${fmtN(calc.total)}</div>
          </div>
        </div>

        <!-- LISTA DE ITENS (peças + mão de obra juntos) -->
        <div class="orc-lista">
          <div class="orc-lista-header">
            <div class="orc-lista-titulo">Itens do Orçamento</div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-add btn-sm warning" onclick="orcAddItem()">+ Nova Peça<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
              <button class="btn btn-add btn-sm" onclick="orcAddMaoDeObra()">+ Mão de Obra<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
              <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:4px 10px">
                <span style="font-size:.72rem;color:var(--color-text-muted);white-space:nowrap">Desc:</span>
                <select style="font-size:.72rem;padding:2px 4px;max-width:90px" onchange="orcAtual.descTipo=this.value;orcAtualizarTotais()">
                  <option value="percentual" ${orcAtual.descTipo==='percentual'?'selected':''}>%</option>
                  <option value="fixo" ${orcAtual.descTipo==='fixo'?'selected':''}>R$</option>
                </select>
                <input type="number" style="width:70px;font-size:.78rem;padding:3px 6px" value="${orcAtual.descValor||''}" placeholder="0" min="0" step="0.01" oninput="orcAtual.descValor=this.value;orcAtualizarTotais()"/>
                ${calc.descValorNum > 0 ? '<span style="font-size:.68rem;color:#c2c2c5;white-space:nowrap">-' + fmtN(calc.descValorNum) + '</span>' : ''}
                ${calc.descFidelidadeNum > 0 ? '<span style="font-size:.68rem;color:#5cab84;white-space:nowrap">-' + fmtN(calc.descFidelidadeNum) + '</span>' : ''}
              </div>
            </div>
          </div>
          <div class="orc-lista-body">
            <table class="tabela-mobile">
              <thead><tr><th>Descrição</th><th>Cat.</th><th class="col-qtd">Qtd</th><th class="col-vunit">V. Unit R$</th><th class="col-desc-orc">Obs</th><th class="col-subtot">Subtotal</th><th></th></tr></thead>
              <tbody id="orc-tbody">${itensRows}</tbody>
              <tfoot><tr class="total-row"><td colspan="5" style="color:var(--color-text-muted);font-size:.72rem;letter-spacing:1px">SUBTOTAL</td><td colspan="2" id="orc-total-pecas" style="color:#8fc6ab;font-family:'JetBrains Mono',monospace;font-weight:700">${fmtN(calc.totalItens)}</td></tr></tfoot>
            </table>
            ${orcAtual.itens.length===0 ? '<div class="orc-vazio">Clique em uma peça do catálogo, "+ Item" ou "+ Mão de Obra" para começar</div>' : ''}
          </div>
        </div>

        <!-- OBS -->
        <div class="obs-mes-wrap" style="margin-bottom:14px">
          <div class="obs-mes-label">Observações do Orçamento</div>
          <textarea class="obs-textarea" placeholder="Observações adicionais..." oninput="orcAtual.obs=this.value">${orcAtual.obs||''}</textarea>
        </div>

        <!-- AUTORIZAÇÃO RODAGEM -->
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:center;gap:12px">
          <label class="neon-checkbox dourado" style="flex-shrink:0">
            <input type="checkbox" id="chk-rodagem" ${orcAtual.autorizaRodagem?'checked':''} onchange="orcAtual.autorizaRodagem=this.checked"/>
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
          <label for="chk-rodagem" style="cursor:pointer;font-size:.85rem;color:var(--dourado);font-weight:600;letter-spacing:.5px">Cliente autorizou teste de rodagem do veículo pelo mecânico</label>
        </div>

      </div><!-- /orc-main-col -->


    </div><!-- /orc-layout -->
  `;
  // Restaurar estado do botão PDF após rerender do DOM
  setTimeout(() => orcAtualizarBotaoPDF(), 0);
}


function orcAtualizarSubtotais() {
  const calc = orcCalc();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  orcAtual.itens.forEach((it, i) => {
    const sub = (parseFloat(it.qtd)||0) * (parseFloat(it.vunit)||0);
    const el = document.getElementById('orc-sub-'+i);
    if (el) el.textContent = fmtN(sub);
  });
  const tp = document.getElementById('orc-total-pecas');
  if (tp) tp.textContent = fmtN(calc.totalItens);
  orcAtualizarTotais();
}

function orcAtualizarTotais() {
  const calc = orcCalc();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('orc-c-pecas', fmtN(calc.totalItens));
  s('orc-c-desc', fmtN(calc.descValorNum));
  s('orc-c-total', fmtN(calc.total));
  s('orc-desc-preview', '= '+fmtN(calc.descValorNum));
  s('orc-total-pecas', fmtN(calc.totalItens));
}


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
  drop.style.cssText = 'display:block;position:absolute;top:100%;left:0;right:0;background:#242427;border:1px solid var(--color-border);border-radius:10px;z-index:200;overflow:hidden;margin-top:3px;box-shadow:0 8px 24px rgba(0,0,0,.4)';
  drop.innerHTML = sugs.map(c =>
    `<div onclick="orcAtribuirCliente('${c.id}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05)"
      onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
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
