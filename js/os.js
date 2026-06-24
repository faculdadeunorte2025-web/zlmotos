function renderOS() {
  const main = document.getElementById('mainContent');
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtD = d => { if(!d) return '—'; const dt = new Date(d+'T12:00:00'); return dt.toLocaleDateString('pt-BR'); };

  if (osAberta) {
    const os = ordens.find(o => o.id === osAberta);
    if (!os) { osAberta = null; renderOS(); return; }
    renderOSDetalhe(os);
    return;
  }

  osSolicitarPermissaoNotificacao();

  if (typeof window.osViewMode === 'undefined') window.osViewMode = 'kanban';

  // RF10 — alertas 7 dias
  const paradas7 = ordens.filter(o => {
    if (o.status !== 'aberta' && o.status !== 'andamento') return false;
    const entrada = o.dataEntrada || (o.criadoEm ? o.criadoEm.slice(0,10) : null);
    if (!entrada) return false;
    return Math.floor((new Date() - new Date(entrada+'T12:00:00')) / 86400000) >= 7;
  });
  const urgentesAtivos = ordens.filter(o => o.urgente && (o.status==='aberta'||o.status==='andamento'));

  const alertaBanner = (paradas7.length > 0 || urgentesAtivos.length > 0) ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      ${paradas7.length > 0 ? `<div style="flex:1;min-width:200px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);border-radius:10px;padding:10px 14px;font-size:.8rem;color:#fbbf24">
        ⏸️ <b>${paradas7.length} OS</b> parada(s) há mais de 7 dias sem atualização
      </div>` : ''}
      ${urgentesAtivos.length > 0 ? `<div style="flex:1;min-width:200px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:10px 14px;font-size:.8rem;color:#fca5a5">
        🔴 <b>${urgentesAtivos.length} OS urgente(s)</b> aguardando atenção
      </div>` : ''}
    </div>` : '';

  // RF07/RF08 — barra de busca e filtros rápidos
  const filtroBar = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      <div style="position:relative;flex:1;min-width:180px">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--color-text-muted);font-size:.85rem">🔍</span>
        <input type="text" placeholder="Buscar por cliente, placa, veículo ou nº OS..." value="${osBuscaTermo.replace(/"/g,'&quot;')}"
          oninput="osBuscaTermo=this.value;renderOS()"
          style="width:100%;padding:8px 10px 8px 32px;background:rgba(255,255,255,.06);border:1px solid var(--color-border);border-radius:10px;color:#fff;font-size:.85rem;outline:none;box-sizing:border-box"/>
        ${osBuscaTermo ? `<button onclick="osBuscaTermo='';renderOS()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--color-text-muted);cursor:pointer;font-size:.9rem">✕</button>` : ''}
      </div>
      <button onclick="osFiltroUrgente=!osFiltroUrgente;renderOS()" style="padding:7px 12px;border-radius:8px;font-size:.78rem;cursor:pointer;border:1px solid ${osFiltroUrgente?'rgba(239,68,68,.5)':'rgba(255,255,255,.1)'};background:${osFiltroUrgente?'rgba(239,68,68,.15)':'rgba(255,255,255,.04)'};color:${osFiltroUrgente?'#fca5a5':'var(--color-text-muted)'}">🔴 Urgente</button>
      <button onclick="osFiltroAtrasadas=!osFiltroAtrasadas;renderOS()" style="padding:7px 12px;border-radius:8px;font-size:.78rem;cursor:pointer;border:1px solid ${osFiltroAtrasadas?'rgba(251,191,36,.5)':'rgba(255,255,255,.1)'};background:${osFiltroAtrasadas?'rgba(251,191,36,.12)':'rgba(255,255,255,.04)'};color:${osFiltroAtrasadas?'#fbbf24':'var(--color-text-muted)'}">⏸️ +7 dias</button>
      <select onchange="osFiltroStatus=this.value;renderOS()" style="padding:7px 10px;border-radius:8px;font-size:.78rem;background:rgba(255,255,255,.06);border:1px solid ${osFiltroStatus?'rgba(167,139,250,.5)':'rgba(255,255,255,.1)'};color:${osFiltroStatus?'#a78bfa':'var(--color-text-muted)'}">
        <option value="">Todos status</option>
        <option value="aberta" ${osFiltroStatus==='aberta'?'selected':''}>🔵 Em Espera</option>
        <option value="andamento" ${osFiltroStatus==='andamento'?'selected':''}>⚙️ Em Andamento</option>
        <option value="concluida" ${osFiltroStatus==='concluida'?'selected':''}>✅ Finalização</option>
        <option value="entregue" ${osFiltroStatus==='entregue'?'selected':''}>🏁 Pronta</option>
      </select>
      ${mecanicosCadastrados.length > 0 ? `<select onchange="osFiltroMecanico=this.value;renderOS()" style="padding:7px 10px;border-radius:8px;font-size:.78rem;background:rgba(255,255,255,.06);border:1px solid ${osFiltroMecanico?'rgba(52,211,153,.5)':'rgba(255,255,255,.1)'};color:${osFiltroMecanico?'#34d399':'var(--color-text-muted)'}">
        <option value="">👨‍🔧 Todos mecânicos</option>
        ${mecanicosCadastrados.map(m=>`<option value="${mecNomeStr(m)}" ${osFiltroMecanico===mecNomeStr(m)?'selected':''}>${mecNomeStr(m)}</option>`).join('')}
      </select>` : ''}
      ${(osBuscaTermo||osFiltroUrgente||osFiltroAtrasadas||osFiltroStatus||osFiltroMecanico) ? `<button onclick="osBuscaTermo='';osFiltroUrgente=false;osFiltroAtrasadas=false;osFiltroStatus='';osFiltroMecanico='';renderOS()" style="padding:7px 10px;border-radius:8px;font-size:.75rem;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:transparent;color:var(--color-text-muted)">✕ Limpar</button>` : ''}
    </div>`;

  const osExibidas = osAplicarFiltros(ordens);
  const totalFiltrado = osExibidas.length !== ordens.length ? ` <span style="font-size:.72rem;color:var(--color-text-muted)">(${osExibidas.length} de ${ordens.length})</span>` : `<span style="font-size:.72rem;color:var(--color-text-muted)">${ordens.length} OS(s)</span>`;

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#a78bfa">🔧 Ordens de Serviço ${totalFiltrado}</span>
      <div class="toolbar-right">
        <button class="btn btn-sm" onclick="window.osViewMode='kanban';renderOS()" style="background:${window.osViewMode==='kanban'?'rgba(167,139,250,.25)':'rgba(255,255,255,.06)'};border-color:${window.osViewMode==='kanban'?'rgba(167,139,250,.5)':'var(--color-border)'}">⬛ Kanban</button>
        <button class="btn btn-sm" onclick="window.osViewMode='lista';renderOS()" style="background:${window.osViewMode==='lista'?'rgba(167,139,250,.25)':'rgba(255,255,255,.06)'};border-color:${window.osViewMode==='lista'?'rgba(167,139,250,.5)':'var(--color-border)'}">☰ Lista</button>
      </div>
    </div>
    ${alertaBanner}
    ${filtroBar}
    ${window.osViewMode === 'kanban' ? renderOSKanban(osExibidas) : renderOSListaHTML(fmtN, osExibidas)}
  `;
}

function renderOSKanban(listaFiltrada) {
  const lista = listaFiltrada || ordens;
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const colunas = [
    { key: 'aberta',    icon: '🔵', titulo: 'Em Espera',    cor: '#60a5fa', bg: 'rgba(96,165,250,.08)',   borda: 'rgba(96,165,250,.25)' },
    { key: 'andamento', icon: '⚙️', titulo: 'Em Andamento', cor: '#fbbf24', bg: 'rgba(251,191,36,.08)',   borda: 'rgba(251,191,36,.25)' },
    { key: 'concluida', icon: '✅', titulo: 'Finalização',  cor: '#34d399', bg: 'rgba(52,211,153,.08)',   borda: 'rgba(52,211,153,.25)' },
    { key: 'entregue',  icon: '🏁', titulo: 'Pronta!',      cor: '#a78bfa', bg: 'rgba(167,139,250,.08)',  borda: 'rgba(167,139,250,.25)' },
  ];

  // Estado de grupos recolhidos para coluna Pronta
  if (!window.osGruposProntaAbertos) window.osGruposProntaAbertos = {};

  const colunasHTML = colunas.map(col => {
    const itens = lista.filter(o => (o.status || 'aberta') === col.key);
    const total = itens.reduce((s, o) => s + parseFloat(o.total||0), 0);

    // RF02 — contador dinâmico (sempre atualizado pelo listener)
    const contador = `<span style="font-size:.72rem;background:${col.borda};color:${col.cor};border-radius:999px;padding:2px 10px;font-weight:700">${itens.length}</span>`;

    let cardsHTML;

    if (col.key === 'entregue') {
      if (itens.length === 0) {
        cardsHTML = '<div style="text-align:center;color:rgba(255,255,255,.2);font-size:.78rem;padding:24px 0">Nenhuma OS</div>';
      } else {
        const grupos = {};
        itens.forEach(os => { const d = os.data||'sem-data'; if (!grupos[d]) grupos[d]=[]; grupos[d].push(os); });
        const diasOrdenados = Object.keys(grupos).sort((a,b) => b.localeCompare(a));
        cardsHTML = diasOrdenados.map(dia => {
          const ossDia = grupos[dia];
          const grpId = 'pronta-grp-' + dia.replace(/-/g,'');
          const aberto = window.osGruposProntaAbertos[grpId] === true;
          const fmtDia = dia === 'sem-data' ? 'Sem data' : new Date(dia+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'});
          const totalDia = ossDia.reduce((s,o) => s+parseFloat(o.total||0),0);
          const cards = ossDia.map(os => {
            const urgente = os.urgente;
            const tempo = typeof osTempoAtual==='function'&&osTempoAtual(os)>0 ? '<span style="font-size:.65rem;color:#a78bfa;background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.3);border-radius:4px;padding:1px 5px">⏱ '+osFmtTempo(osTempoAtual(os))+'</span>' : '';
            const garantia = typeof osGarantiaBadge==='function' ? osGarantiaBadge(os) : '';
            return '<div class="os-flip-card' + (urgente?' urgente':'') + '" draggable="true" ondragstart="osKanbanDragStart("'+os.id+'",event)" ondragend="osKanbanDragEnd(event)">'
            + '<div class="os-flip-content">'
            + '<div class="os-flip-front">'
            + '<div style="display:flex;align-items:center;justify-content:space-between">'
            + '<span style="font-size:.62rem;color:'+col.cor+';letter-spacing:2px;font-weight:700">OS '+osNumeroFormatado(os.numero)+'</span>'
            + (urgente?'<span style="font-size:.58rem;color:#fca5a5">🔴</span>':'')
            + '</div>'
            + '<div style="font-size:.85rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(os.cliente||'—')+'</div>'
            + '<div style="font-size:.72rem;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(os.veiculo||'—')+(os.placa?' · '+os.placa:'')+'</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:4px">'
            + '<span style="font-size:.78rem;color:#2BE08C;font-weight:700">'+fmtN(os.total||0)+'</span>'
            + '</div>'
            + '</div>'
            + '<div class="os-flip-back">'
            + '<div class="os-flip-circle c1"></div><div class="os-flip-circle c2"></div><div class="os-flip-circle c3"></div>'
            + '<div class="os-flip-back-content">'
            + '<div style="font-size:.62rem;color:rgba(255,255,255,.45);letter-spacing:.08em;text-transform:uppercase">OS '+osNumeroFormatado(os.numero)+'</div>'
            + '<div style="font-size:.85rem;font-weight:700;color:#fff">'+(os.cliente||'—')+'</div>'
            + '<div style="font-size:.72rem;color:rgba(255,255,255,.45)">'+(os.veiculo||'—')+(os.placa?' · '+os.placa:'')+'</div>'
            + '<div style="display:flex;gap:4px;margin-top:2px">'+tempo+garantia+'</div>'
            + '<button onclick="event.stopPropagation();osAberta=\''+os.id+'\';renderOS()" style="margin-top:6px;width:100%;padding:6px;background:rgba(167,139,250,.2);border:1px solid rgba(167,139,250,.5);border-radius:6px;color:#a78bfa;font-size:.72rem;font-weight:600;cursor:pointer">📋 Abrir OS</button>'
            + '</div></div>'
            + '</div></div>';
          }).join('');
          return `<div style="margin-bottom:6px">
            <div onclick="window.osGruposProntaAbertos['${grpId}']=!window.osGruposProntaAbertos['${grpId}'];renderOS()" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:7px;background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.15);margin-bottom:3px">
              <span style="font-size:.72rem;color:#a78bfa;font-weight:600">${fmtDia}</span>
              <span style="font-size:.65rem;color:var(--color-text-muted)">${ossDia.length} OS · ${fmtN(totalDia)} <b>${aberto?'▼':'▶'}</b></span>
            </div>
            <div style="display:${aberto?'block':'none'}">${cards}</div>
          </div>`;

        }).join('');
      }
    } else {
      cardsHTML = itens.length === 0
        ? '<div style="text-align:center;color:rgba(255,255,255,.2);font-size:.78rem;padding:24px 0">Nenhuma OS</div>'
        : itens.map(os => {
            const urgente = os.urgente;
            const tempo = typeof osTempoAtual==='function'&&osTempoAtual(os)>0 ? '<span style="font-size:.65rem;color:#a78bfa;background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.3);border-radius:4px;padding:1px 5px">⏱ '+osFmtTempo(osTempoAtual(os))+'</span>' : '';
            const garantia = typeof osGarantiaBadge==='function' ? osGarantiaBadge(os) : '';
            return '<div class="os-flip-card' + (urgente?' urgente':'') + '" draggable="true" ondragstart="osKanbanDragStart("'+os.id+'",event)" ondragend="osKanbanDragEnd(event)">'
            + '<div class="os-flip-content">'
            + '<div class="os-flip-front">'
            + '<div style="display:flex;align-items:center;justify-content:space-between">'
            + '<span style="font-size:.62rem;color:'+col.cor+';letter-spacing:2px;font-weight:700">OS '+osNumeroFormatado(os.numero)+'</span>'
            + '<span style="font-size:.62rem;color:rgba(255,255,255,.4)">'+(os.data?new Date(os.data+'T12:00:00').toLocaleDateString('pt-BR'):'—')+'</span>'
            + '</div>'
            + '<div style="font-size:.88rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(os.cliente||'—')+'</div>'
            + '<div style="font-size:.72rem;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(os.veiculo||'—')+(os.placa?' · '+os.placa:'')+'</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:3px">'
            + '<span style="font-size:.82rem;color:#2BE08C;font-weight:700">'+fmtN(os.total||0)+'</span>'
            + (urgente?'<span style="font-size:.58rem;color:#fca5a5">🔴 URGENTE</span>':'')
            + '</div>'
            + '</div>'
            + '<div class="os-flip-back">'
            + '<div class="os-flip-circle c1"></div><div class="os-flip-circle c2"></div><div class="os-flip-circle c3"></div>'
            + '<div class="os-flip-back-content">'
            + '<div style="font-size:.62rem;color:rgba(255,255,255,.45);letter-spacing:.08em;text-transform:uppercase">OS '+osNumeroFormatado(os.numero)+'</div>'
            + '<div style="font-size:.85rem;font-weight:700;color:#fff">'+(os.cliente||'—')+'</div>'
            + '<div style="font-size:.72rem;color:rgba(255,255,255,.45)">'+(os.veiculo||'—')+(os.placa?' · '+os.placa:'')+'</div>'
            + '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">'+tempo+garantia+osAlertaBadge(os)+'</div>'
            + '<button onclick="event.stopPropagation();osAberta=\''+os.id+'\';renderOS()" style="margin-top:6px;width:100%;padding:6px;background:rgba(200,16,46,.2);border:1px solid rgba(200,16,46,.5);border-radius:6px;color:#E8192E;font-size:.72rem;font-weight:600;cursor:pointer">📋 Abrir OS</button>'
            + '</div></div>'
            + '</div></div>';
          }).join('');
    }

    return `<div class="os-kanban-col" data-status="${col.key}"
      ondragover="osKanbanDragOver(event)"
      ondragleave="osKanbanDragLeave(event)"
      ondrop="osKanbanDrop('${col.key}',event)"
      style="flex:1;min-width:220px;max-width:320px;background:${col.bg};border:1px solid ${col.borda};border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:0;transition:border-color .15s">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid ${col.borda}">
        <div style="font-family:'Inter';font-size:1rem;letter-spacing:3px;color:${col.cor}">${col.icon} ${col.titulo}</div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          ${contador}
          ${itens.length > 0 ? '<span style="font-size:.62rem;color:var(--color-text-muted)">' + fmtN(total) + '</span>' : ''}
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;max-height:calc(100vh - 220px)">${cardsHTML}</div>
      <button onclick="sbIr(13)" style="margin-top:10px;width:100%;background:transparent;border:1px dashed ${col.borda};color:${col.cor};border-radius:8px;padding:8px;font-size:.78rem;cursor:pointer">+ Criar via Orçamento</button>
    </div>`;
  }).join('');

  return `<div style="display:flex;gap:14px;align-items:flex-start;overflow-x:auto;padding-bottom:8px">${colunasHTML}</div>`;
}

function osRenderChecklist(os) {
  const cl = (Array.isArray(os.checklist) && os.checklist.length > 0)
    ? os.checklist
    : (os.itens || []).map(function(it, i) { return { id: i, desc: it.desc || '—', cat: it.cat || '', feito: false }; });
  if (!cl.length) return '';
  const total = cl.length;
  const feitos = cl.filter(function(c) { return c.feito; }).length;
  const pct = Math.round((feitos / total) * 100);
  const barColor = pct === 100 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#60a5fa';
  const itensHtml = cl.map(function(c) {
    const bordaC = c.feito ? 'rgba(52,211,153,.35)' : 'var(--color-border)';
    const bgC    = c.feito ? 'rgba(52,211,153,.08)' : 'rgba(255,255,255,.02)';
    const bordaBox = c.feito ? '#34d399' : 'rgba(255,255,255,.2)';
    const bgBox  = c.feito ? '#34d399' : 'transparent';
    const check  = c.feito ? '<span style="color:#0a0a0b;font-size:.75rem;font-weight:900">&#10003;</span>' : '';
    const txtColor = c.feito ? 'rgba(255,255,255,.4)' : 'var(--texto)';
    const txtDec   = c.feito ? 'line-through' : 'none';
    const catBadge = c.cat
      ? '<span style="font-size:.62rem;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);color:var(--color-primary-hover);padding:1px 6px;border-radius:4px">' + c.cat + '</span>'
      : '';
    return '<div onclick="osToggleChecklist(\'' + os.id + '\',' + c.id + ')" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;border:1px solid ' + bordaC + ';background:' + bgC + '">'
      + '<div style="width:20px;height:20px;border-radius:5px;border:2px solid ' + bordaBox + ';background:' + bgBox + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' + check + '</div>'
      + '<span style="flex:1;font-size:.85rem;color:' + txtColor + ';text-decoration:' + txtDec + '">' + c.desc + '</span>'
      + catBadge
      + '</div>';
  }).join('');
  return '<div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:12px;padding:14px 18px;margin-bottom:16px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
    + '<div style="font-family:\'Inter\';font-size:.85rem;letter-spacing:3px;color:#a78bfa">&#10003; CHECKLIST DE EXECUÇÃO</div>'
    + '<div style="font-size:.8rem;color:' + barColor + '">' + feitos + '/' + total + ' concluídos</div>'
    + '</div>'
    + '<div style="background:rgba(255,255,255,.07);border-radius:999px;height:6px;margin-bottom:14px;overflow:hidden">'
    + '<div style="width:' + pct + '%;height:100%;background:' + barColor + ';border-radius:999px"></div>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:6px">' + itensHtml + '</div>'
    + '</div>';
}

function renderOSDetalhe(os) {
  const main = document.getElementById('mainContent');
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const statusOpts = [
    {v:'aberta', l:'🔵 Em Espera'},
    {v:'andamento', l:'⚙️ Em Andamento'},
    {v:'concluida', l:'✅ Finalização'},
    {v:'entregue', l:'🏁 Pronta!'},
    {v:'cancelada', l:'❌ Cancelada'}
  ];

  main.innerHTML = `
    <div class="toolbar">
      <button class="btn-voltar" onclick="osAberta=null;renderOS()" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
      <span style="font-family:'Inter';font-size:1.2rem;letter-spacing:3px;color:#a78bfa">${osNumeroFormatado(os.numero)}</span>
      ${osStatusBadge(os.status)}
      ${os.urgente ? '<span style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5;padding:3px 10px;border-radius:10px;font-size:.72rem;font-weight:700">🔴 URGENTE</span>' : ''}
      <button onclick="osSalvarCampo('${os.id}','urgente',${!os.urgente});renderOS()" style="background:${os.urgente?'rgba(239,68,68,.15)':'rgba(255,255,255,.04)'};border:1px solid ${os.urgente?'rgba(239,68,68,.4)':'rgba(255,255,255,.1)'};color:${os.urgente?'#fca5a5':'var(--color-text-muted)'};border-radius:8px;padding:4px 12px;font-size:.72rem;cursor:pointer" title="Marcar como urgente">${os.urgente?'🔴 Remover Urgência':'🔴 Marcar Urgente'}</button>
      ${osEstaAtrasada(os) ? '<span style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5;padding:3px 10px;border-radius:10px;font-size:.72rem">🔴 ATRASADA — Previsão era ' + new Date(os.previsaoEntrega+'T12:00:00').toLocaleDateString('pt-BR') + '</span>' : ''}
      ${osEstaParada(os, 4) ? '<span style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fbbf24;padding:3px 10px;border-radius:10px;font-size:.72rem">⏸️ OS PARADA — Em andamento há mais de 4 dias sem atualização</span>' : ''}
      <div class="toolbar-right">
        <button class="btn" style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:9px 18px;font-size:.88rem" onclick="osWhatsApp('${os.id}')">📲 WhatsApp</button>
      </div>
    </div>

    <!-- INFO PRINCIPAL -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="orc-field">
        <label>👤 Cliente</label>
        <input type="text" value="${(os.cliente||'').replace(/"/g,'&quot;')}" placeholder="Nome..." oninput="osSalvarCampo('${os.id}','cliente',this.value);clienteAutoCompleteOS('${os.id}','veiculo')"/>
      </div>
      <div class="orc-field">
        <label>🪪 CPF / CNPJ</label>
        <input type="text" value="${(os.cpfcnpj||'').replace(/"/g,'&quot;')}" placeholder="000.000.000-00" maxlength="18" oninput="osSalvarCampo('${os.id}','cpfcnpj',this.value)"/>
      </div>
      <div class="orc-field">
        <label>📞 Telefone</label>
        <input type="text" value="${(os.telefone||'').replace(/"/g,'&quot;')}" placeholder="(11) 99999-9999" oninput="osSalvarCampo('${os.id}','telefone',this.value)"/>
      </div>
      <div class="orc-field">
        <label>🏍️ Veículo</label>
        <input type="text" value="${(os.veiculo||'').replace(/"/g,'&quot;')}" placeholder="Modelo..." oninput="osSalvarCampo('${os.id}','veiculo',this.value)"/>
        <div id="os-veiculo-sugestoes-${os.id}" style="margin-top:4px"></div>
      </div>
      <div class="orc-field">
        <label>🔖 Placa</label>
        <input type="text" value="${(os.placa||'').replace(/"/g,'&quot;')}" placeholder="Ex: ABC-1234..." oninput="osSalvarCampo('${os.id}','placa',this.value.toUpperCase());this.value=this.value.toUpperCase()" style="text-transform:uppercase"/>
      </div>
      <div class="orc-field">
        <label>📏 KM Entrada</label>
        <input type="number" class="valor" value="${os.km||''}" placeholder="Ex: 12500" min="0" step="1" oninput="osSalvarCampo('${os.id}','km',this.value)"/>
      </div>
      <div class="orc-field">
        <label>👨‍🔧 Mecânico</label>
        <input type="text" value="${(os.mecanico||'').replace(/"/g,'&quot;')}" placeholder="Nome do mecânico..." 
          oninput="osSalvarCampo('${os.id}','mecanico',this.value);mecAutoCompleteOS('${os.id}',this)"/>
        <div id="mec-drop-${os.id}" style="background:#1a1a2e;border:1px solid var(--color-border);border-radius:8px;overflow:hidden;margin-top:3px"></div>
      </div>
      <div class="orc-field">
        <label>🔧 Tipo de Serviço</label>
        <select onchange="osSalvarCampo('${os.id}','tipoServico',this.value)">
          ${['Revisão geral','Troca de óleo','Freios','Pneus','Elétrica','Funilaria','Suspensão','Carburador','Corrente','Motor','Outros'].map(t => '<option value="' + t + '"' + ((os.tipoServico||'Outros')===t?' selected':'') + '>' + t + '</option>').join('')}
        </select>
      </div>
      <div class="orc-field">
        <label>📅 Entrada</label>
        <input type="date" value="${os.dataEntrada||''}" oninput="osSalvarCampo('${os.id}','dataEntrada',this.value)"/>
      </div>
      <div class="orc-field">
        <label>🏁 Previsão Entrega</label>
        <input type="date" value="${os.previsaoEntrega||''}" oninput="osSalvarCampo('${os.id}','previsaoEntrega',this.value)"/>
      </div>
    </div>

    <!-- STATUS -->
    <div class="toolbar" style="margin-bottom:16px">
      <div class="toolbar-title">⚡ Status da OS</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${statusOpts.map(s => {
          const ativo = os.status === s.v;
          const cores = {
            'espera':    { bg:'rgba(245,213,71,0.12)',  border:'rgba(245,213,71,0.4)',  color:'#F5D547' },
            'andamento': { bg:'rgba(200,16,46,0.12)',  border:'rgba(200,16,46,0.5)',  color:'#E8192E' },
            'concluido': { bg:'rgba(43,224,140,0.12)',  border:'rgba(43,224,140,0.4)',  color:'#2BE08C' },
            'entregue':  { bg:'rgba(61,215,229,0.12)',  border:'rgba(61,215,229,0.4)',  color:'#3DD7E5' },
          };
          const c = cores[s.v] || { bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.1)', color:'#9a9aaa' };
          const style = ativo
            ? 'background:'+c.bg+';border:1px solid '+c.border+';color:'+c.color+';font-weight:700;box-shadow:0 0 10px '+c.border
            : 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:#6b6b75';
          return '<button class="btn btn-sm" style="'+style+';transition:all .2s" onclick="osSetStatus(\''+os.id+'\',\''+s.v+'\')">'+s.l+'</button>';
        }).join('')}
        <div class="toolbar-sep"></div>
        ${os.status !== 'cancelada' ? '<button class="btn btn-sm btn-del" onclick="osCancelar(\''+os.id+'\')">❌ Cancelar OS</button>' : '<span class="badge badge-danger"><span class="badge-dot static"></span>OS Cancelada</span>'}
      </div>
    </div>

    <!-- TEMPO DE SERVIÇO -->
    ${(function(){
      const ms = osTempoAtual(os);
      const emAndamento = os.status === 'andamento';
      const temTempo = ms > 0;
      if (!temTempo && !emAndamento) return '';
      return '<div style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.25);border-radius:12px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px">'
        + '<span style="font-size:1.4rem">' + (emAndamento ? '⏱️' : '✅') + '</span>'
        + '<div>'
        + '<div style="font-size:.7rem;letter-spacing:2px;color:#a78bfa;font-weight:700">' + (emAndamento ? 'EM SERVIÇO' : 'TEMPO DE SERVIÇO') + '</div>'
        + '<div style="font-family:monospace;font-size:1.1rem;color:var(--color-text-primary)">' + osFmtTempo(ms) + (emAndamento ? ' <span style="font-size:.65rem;color:#a78bfa;animation:pulse 1s infinite">● AO VIVO</span>' : '') + '</div>'
        + (os.tempoServico && os.tempoServico.inicio ? '<div style="font-size:.7rem;color:var(--color-text-muted)">Iniciado: ' + new Date(os.tempoServico.inicio).toLocaleString("pt-BR") + '</div>' : '')
        + '</div>'
        + '</div>';
    })()}

    <!-- ITENS -->
    <div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:12px;padding:14px 18px;margin-bottom:16px">
      <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#a78bfa;margin-bottom:10px">🔩 ITENS / SERVIÇOS</div>
      <table style="width:100%;font-size:.82rem">
        <thead><tr style="background:rgba(26,58,107,.6)">
          <th style="padding:6px 8px;text-align:left;font-size:.62rem;color:var(--color-text-muted)">Descrição</th>
          <th style="padding:6px 8px;text-align:right;font-size:.62rem;color:var(--color-text-muted)">Qtd</th>
          <th style="padding:6px 8px;text-align:right;font-size:.62rem;color:var(--color-text-muted)">V.Unit</th>
          <th style="padding:6px 8px;text-align:right;font-size:.62rem;color:var(--color-text-muted)">Subtotal</th>
        </tr></thead>
        <tbody>
          ${os.itens.map((it, i) => {
            const sub = (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
            const bgRow = i%2===0 ? '' : 'background:rgba(255,255,255,.02)';
            const obsHtml = it.obs ? '<span style="font-size:.72rem;color:var(--color-text-muted)"> — ' + it.obs + '</span>' : '';
            return '<tr style="' + bgRow + '">'
              + '<td style="padding:6px 8px">' + (it.desc||'—') + ' ' + obsHtml
              + '<div style="display:inline-block;margin-left:6px"><span style="font-size:.65rem;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);color:var(--color-primary-hover);padding:1px 5px;border-radius:4px">' + (it.cat||'') + '</span></div></td>'
              + '<td style="padding:6px 8px;text-align:right;font-family:\'JetBrains Mono\'">' + (it.qtd||1) + '</td>'
              + '<td style="padding:6px 8px;text-align:right;color:var(--color-text-muted)">R$ ' + parseFloat(it.vunit||0).toLocaleString('pt-BR',{minimumFractionDigits:2}) + '</td>'
              + '<td style="padding:6px 8px;text-align:right;color:#6ee7b7">R$ ' + sub.toLocaleString('pt-BR',{minimumFractionDigits:2}) + '</td>'
              + '</tr>';
          }).join('')}
        </tbody>
      </table>
      <div style="text-align:right;margin-top:10px;font-family:'JetBrains Mono';font-size:1rem;color:#34d399;font-weight:700">
        TOTAL: R$ ${osCalcTotal(os).toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </div>
    </div>

    <!-- CHECKLIST DE EXECUÇÃO -->
    ${osRenderChecklist(os)}

    <!-- I02 — PEÇAS DO ESTOQUE NA OS -->
    <div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:14px;padding:16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#fbbf24">📦 PEÇAS UTILIZADAS</div>
        <button onclick="osToggleCatalogoEstoque('${os.id}')" style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fbbf24;border-radius:8px;padding:5px 12px;font-size:.75rem;cursor:pointer">+ Adicionar do Estoque</button>
      </div>
      <div id="os-cat-estoque-${os.id}" style="display:none;margin-bottom:10px">
        <input type="text" id="os-cat-busca-${os.id}" placeholder="🔍 Buscar peça..." oninput="osRenderCatEstoque('${os.id}',this.value)"
          style="width:100%;background:rgba(255,255,255,.06);border:1px solid var(--color-border);border-radius:8px;color:#fff;padding:7px 12px;font-size:.82rem;outline:none;margin-bottom:8px"/>
        <div id="os-cat-lista-${os.id}" style="max-height:180px;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${estoque.filter(p=>(parseFloat(p.qtd)||0)>0).map(p=>`
            <div onclick="osAddPecaEstoque('${os.id}','${p.nome.replace(/'/g,"\\'")}')" 
              style="padding:7px 10px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);font-size:.75rem"
              onmouseover="this.style.background='rgba(251,191,36,.1)'" onmouseout="this.style.background='rgba(255,255,255,.04)'">
              <div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nome}</div>
              <div style="color:var(--color-text-muted);font-size:.68rem">R$ ${parseFloat(p.venda||0).toFixed(2)} · ${p.qtd} em estoque</div>
            </div>`).join('')}
        </div>
      </div>
      <div id="os-pecas-lista-${os.id}">
        ${(function(){
          const pecasOS = (os.itens||[]).filter(it=>it._estoqueNome||it.cat==='Peça');
          if(!pecasOS.length) return '<div style="color:var(--color-text-muted);font-size:.78rem;text-align:center;padding:12px 0">Nenhuma peça adicionada</div>';
          return pecasOS.map((it,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.15);margin-bottom:5px">
            <div style="flex:1;font-size:.82rem;font-weight:700">${it.desc||it._estoqueNome}</div>
            <div style="font-size:.75rem;color:var(--color-text-muted)">${it.qtd}x R$ ${parseFloat(it.vunit||0).toFixed(2)}</div>
            <div style="font-size:.82rem;color:#fbbf24;font-weight:700">R$ ${((it.qtd||1)*(it.vunit||0)).toFixed(2)}</div>
          </div>`).join('');
        })()}
      </div>
    </div>

    <!-- FOTOS DA MOTO -->
    <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:18px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:var(--dourado)">📸 FOTOS DA MOTO</div>
        <label style="cursor:pointer;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);color:var(--dourado);padding:6px 14px;border-radius:8px;font-size:.8rem;font-weight:700">
          + Adicionar Foto
          <input type="file" accept="image/*" multiple style="display:none" onchange="osAdicionarFotos('${os.id}',this)"/>
        </label>
      </div>
      <div id="fotos-grid-${os.id}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">
        ${(function(){
          const fotos = os.fotos || [];
          if (!fotos.length) return '<div style="color:var(--color-text-muted);font-size:.8rem;grid-column:1/-1;text-align:center;padding:20px 0">Nenhuma foto adicionada ainda</div>';
          return fotos.map(function(f,idx){
            return '<div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--color-border)">'
              + '<img src="' + f.data + '" style="width:100%;height:100px;object-fit:cover;display:block" onclick="osVerFoto(' + JSON.stringify(f.data) + ',' + JSON.stringify(f.nome||'Foto') + ')"/>'
              + '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);font-size:.62rem;color:#fff;padding:3px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (f.tipo||'') + '</div>'
              + '<button onclick="osRemoverFoto(' + JSON.stringify(os.id) + ',' + idx + ')" style="position:absolute;top:4px;right:4px;background:rgba(239,68,68,.8);border:none;color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:.7rem;line-height:20px;text-align:center">✕</button>'
              + '</div>';
          }).join('');
        })()}
      </div>
    </div>

    <!-- DEFEITO CLIENTE vs DIAGNÓSTICO -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div class="orc-field">
        <label>🗣️ Defeito Relatado pelo Cliente</label>
        <textarea rows="3" style="width:100%;resize:vertical;border-color:rgba(251,191,36,.3)" placeholder="Ex: Moto não liga, barulho no motor ao acelerar..." oninput="osSalvarCampo('${os.id}','defeitoCliente',this.value)">${os.defeitoCliente||''}</textarea>
      </div>
      <div class="orc-field">
        <label>🔍 Diagnóstico do Mecânico</label>
        <textarea rows="3" style="width:100%;resize:vertical;border-color:rgba(96,165,250,.3)" placeholder="Ex: Bateria descarregada, correia do alternador desgastada..." oninput="osSalvarCampo('${os.id}','diagnostico',this.value)">${os.diagnostico||''}</textarea>
      </div>
    </div>

    <!-- OBS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="orc-field">
        <label>📝 Observações Internas (mecânico)</label>
        <textarea rows="3" style="width:100%;resize:vertical" placeholder="Anotações técnicas, peças adicionais encontradas..." oninput="osSalvarCampo('${os.id}','obsInternas',this.value)">${os.obsInternas||''}</textarea>
      </div>
      <div class="orc-field">
        <label>💬 Observações para o Cliente</label>
        <textarea rows="3" style="width:100%;resize:vertical" placeholder="Recomendações, próxima revisão..." oninput="osSalvarCampo('${os.id}','obsCliente',this.value)">${os.obsCliente||''}</textarea>
      </div>
    </div>

    <!-- GARANTIA -->
    ${osGarantiaHTML(os)}

    <!-- BOTÃO PDF DA OS -->
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn" onclick="osImprimirEtiqueta('${os.id}')" style="background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.4);color:#a78bfa;padding:11px 20px;font-size:.95rem">🏷️ Imprimir Etiqueta</button>
      <button class="btn btn-pdf" onclick="osPDF('${os.id}')"><span class="pdf-star pdf-star-1"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-2"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-3"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-4"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-5"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-6"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span>🖨️ Gerar PDF desta OS</button>
    </div>

    <!-- HISTÓRICO DE ALTERAÇÕES -->
    ${(function(){
      if (!os.historico || os.historico.length === 0) return '';
      const CAMPOS_LABEL = { status:'Status', cliente:'Cliente', veiculo:'Veículo', placa:'Placa', mecanico:'Mecânico', previsaoEntrega:'Previsão', tipoServico:'Tipo', total:'Total' };
      const STATUS_LABEL = { aberta:'Em Espera', andamento:'Em Andamento', concluida:'Finalização', entregue:'Pronta!', cancelada:'Cancelada' };
      const itens = [...os.historico].reverse().slice(0,10).map(h => {
        const fmtData = new Date(h.data).toLocaleDateString('pt-BR') + ' ' + new Date(h.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        const campo = CAMPOS_LABEL[h.campo] || h.campo;
        const de = STATUS_LABEL[h.de] || h.de || '—';
        const para = STATUS_LABEL[h.para] || h.para || '—';
        return '<div style="display:flex;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.75rem">'
          + '<span style="color:var(--color-text-muted);min-width:110px;flex-shrink:0">' + fmtData + '</span>'
          + '<span style="color:#60a5fa;min-width:80px;flex-shrink:0">' + campo + '</span>'
          + '<span style="color:var(--color-text-muted)">' + de + '</span>'
          + '<span style="color:var(--color-text-muted)">→</span>'
          + '<span style="color:var(--color-text-primary);font-weight:600">' + para + '</span>'
          + '</div>';
      }).join('');
      return '<div style="background:rgba(13,35,71,.5);border:1px solid var(--color-border);border-radius:12px;padding:14px 18px;margin-bottom:16px">'
        + '<div style="font-family:\'Inter\';font-size:.8rem;letter-spacing:2px;color:#60a5fa;margin-bottom:10px">📋 HISTÓRICO DE ALTERAÇÕES</div>'
        + itens
        + '</div>';
    })()}

    <!-- FLUXO DE FECHAMENTO — aparece quando OS está Entregue -->
    ${os.status === 'entregue' ? osFluxoFechamento(os.id) : ''}
  `;
}

// ── GARANTIA ──────────────────────────────────────────────────────
const GARANTIA_TIPOS = [
  { id: 'servico',  label: 'Servico geral',   dias: 90, base: 'CDC Art. 26 - 90 dias' },
  { id: 'peca',     label: 'Peca / Produto',  dias: 90, base: 'CDC Art. 26 - 90 dias' },
  { id: 'motor',    label: 'Motor / Cambio',  dias: 90, base: 'CDC Art. 26 - 90 dias' },
  { id: 'eletrica', label: 'Eletrica',        dias: 90, base: 'CDC Art. 26 - 90 dias' },
  { id: 'custom',   label: 'Personalizado',   dias: 0,  base: 'Definido pela oficina' }
];

function osGarantiaBadge(os) {
  const g = os.garantia || {};
  if (!g.ativa || !g.dataInicio) return '';
  const tipo = GARANTIA_TIPOS.find(function(t){return t.id===g.tipo;}) || GARANTIA_TIPOS[0];
  const dias = g.tipo === 'custom' ? (parseInt(g.diasCustom)||90) : tipo.dias;
  const inicio = new Date(g.dataInicio + 'T12:00:00');
  const venc = new Date(inicio);
  venc.setDate(venc.getDate() + dias);
  const hoje = new Date(); hoje.setHours(12,0,0,0);
  const diff = Math.ceil((venc - hoje) / (1000*60*60*24));
  if (diff > 0) {
    return ' <span style="font-size:.65rem;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.4);color:#34d399;border-radius:4px;padding:1px 5px">🛡️ ' + diff + 'd</span>';
  } else {
    return ' <span style="font-size:.65rem;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;border-radius:4px;padding:1px 5px">🛡️ Vencida</span>';
  }
}

function osGarantiaHTML(os) {
  const g = os.garantia || {};
  const ativa = !!g.ativa;
  const tipo = GARANTIA_TIPOS.find(function(t){return t.id===g.tipo;}) || GARANTIA_TIPOS[0];
  const dias = g.tipo === 'custom' ? (parseInt(g.diasCustom)||90) : tipo.dias;
  const osId = os.id;

  var badgeHtml = '';
  if (ativa && g.dataInicio) {
    const inicio = new Date(g.dataInicio + 'T12:00:00');
    const venc = new Date(inicio);
    venc.setDate(venc.getDate() + dias);
    const hoje = new Date(); hoje.setHours(12,0,0,0);
    const diff = Math.ceil((venc - hoje) / (1000*60*60*24));
    const vencStr = venc.toLocaleDateString('pt-BR');
    if (diff > 0) {
      badgeHtml = '<div style="margin-top:12px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.35);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px">'
        + '<span style="font-size:1.3rem">🟢</span>'
        + '<div><div style="font-weight:700;color:#34d399;font-size:.88rem">GARANTIA ATIVA</div>'
        + '<div style="font-size:.78rem;color:var(--color-text-muted)">Vence em ' + vencStr + ' &mdash; faltam <b style="color:#34d399">' + diff + ' dia(s)</b></div>'
        + '<div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">' + tipo.base + '</div></div></div>';
    } else {
      badgeHtml = '<div style="margin-top:12px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px">'
        + '<span style="font-size:1.3rem">🔴</span>'
        + '<div><div style="font-weight:700;color:#f87171;font-size:.88rem">GARANTIA VENCIDA</div>'
        + '<div style="font-size:.78rem;color:var(--color-text-muted)">Venceu em ' + vencStr + ' &mdash; h&aacute; <b style="color:#f87171">' + Math.abs(diff) + ' dia(s)</b></div>'
        + '<div style="font-size:.7rem;color:var(--color-text-muted);margin-top:2px">' + tipo.base + '</div></div></div>';
    }
  }

  var tiposOpts = GARANTIA_TIPOS.map(function(t){
    return '<option value="' + t.id + '"' + (g.tipo===t.id?' selected':'') + '>' + t.label + ' (' + (t.dias||'?') + ' dias)</option>';
  }).join('');

  var result = '<div style="background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.03));border:1px solid rgba(245,158,11,.3);border-radius:14px;padding:18px 20px;margin-bottom:16px">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (ativa?'12':'0') + 'px">'
    + neonChk('data-osid="' + osId + '" ' + (ativa?'checked':'') + ' onchange="osToggleGarantia(this.dataset.osid,this.checked)"', 'dourado')
    + '<span style="font-weight:700;font-size:.92rem;color:var(--dourado);cursor:pointer;letter-spacing:1px">🛡️ SERVIÇO COM GARANTIA (CDC)</span>'
    + '</div>';

  if (ativa) {
    result += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
      + '<div class="orc-field"><label>Tipo de garantia</label>'
      + '<select data-osid="' + osId + '" onchange="osSalvarGarantia(this.dataset.osid,&quot;tipo&quot;,this.value)">' + tiposOpts + '</select></div>'
      + '<div class="orc-field" id="gar-custom-' + osId + '" style="' + (g.tipo==='custom'?'':'display:none') + '">'
      + '<label>Prazo (dias)</label>'
      + '<input type="number" data-osid="' + osId + '" value="' + (g.diasCustom||90) + '" min="1" max="3650" oninput="osSalvarGarantia(this.dataset.osid,&quot;diasCustom&quot;,this.value)"/></div>'
      + '<div class="orc-field"><label>Data início da garantia</label>'
      + '<input type="date" data-osid="' + osId + '" value="' + (g.dataInicio||'') + '" oninput="osSalvarGarantia(this.dataset.osid,&quot;dataInicio&quot;,this.value)"/></div>'
      + '<div class="orc-field"><label>Base legal</label>'
      + '<input type="text" value="' + tipo.base + '" readonly style="opacity:.6"/></div>'
      + '</div>'
      + badgeHtml;
  }

  result += '</div>';
  return result;
}
function osAdicionarFotos(osId, input) {
  const os = ordens.find(o => o.id === osId);
  if (!os || !input.files.length) return;
  if (!os.fotos) os.fotos = [];

  const tipos = ['Entrada', 'Durante', 'Saída', 'Detalhe'];
  const promises = Array.from(input.files).map(function(file) {
    return new Promise(function(resolve) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const tipoIdx = os.fotos.length % tipos.length;
        os.fotos.push({
          data: e.target.result,
          nome: file.name,
          tipo: tipos[tipoIdx],
          data_hora: new Date().toISOString()
        });
        resolve();
      };
      reader.readAsDataURL(file);
    });
  });

  Promise.all(promises).then(function() {
    salvarOS();
    renderOS();
    mostrarToast('✓ ' + input.files.length + ' foto(s) adicionada(s)!');
  });
  input.value = '';
}

function osRemoverFoto(osId, idx) {
  const os = ordens.find(o => o.id === osId);
  if (!os || !os.fotos) return;
  confirmarExclusao('esta foto', function() {
    os.fotos.splice(idx, 1);
    salvarOS();
    renderOS();
    mostrarToast('✓ Foto removida');
  });
}

function osVerFoto(dataUrl, nome) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px';
  overlay.onclick = function() { overlay.remove(); };
  overlay.innerHTML = '<img src="' + dataUrl + '" style="max-width:90vw;max-height:80vh;border-radius:10px;object-fit:contain"/>'
    + '<div style="color:#fff;font-size:.85rem">' + nome + ' — Clique para fechar</div>';
  document.body.appendChild(overlay);
}

function osToggleGarantia(id, ativa) {
  const os = ordens.find(function(o){return o.id===id;});
  if (!os) return;
  if (!os.garantia) os.garantia = {};
  os.garantia.ativa = ativa;
  if (ativa && !os.garantia.tipo) os.garantia.tipo = 'servico';
  if (ativa && !os.garantia.dataInicio) {
    os.garantia.dataInicio = os.dataEntrada || new Date().toISOString().split('T')[0];
  }
  salvarOS();
  renderOS();
}

function osSalvarGarantia(id, campo, valor) {
  const os = ordens.find(function(o){return o.id===id;});
  if (!os) return;
  if (!os.garantia) os.garantia = {};
  os.garantia[campo] = valor;
  if (campo === 'tipo') {
    const wrap = document.getElementById('gar-custom-' + id);
    if (wrap) wrap.style.display = valor === 'custom' ? '' : 'none';
  }
  salvarOS();
}
// ─────────────────────────────────────────────────────────────────

function osFluxoFechamento(osId) {
  const os = ordens.find(o => o.id === osId);
  if (!os) return '';

  // Inicializar checklist marcado na OS
  if (!os.checklistMarcado) os.checklistMarcado = {};

  const todosCheck = checklistEntrega.length > 0 && checklistEntrega.every((_, i) => os.checklistMarcado[i]);

  const itensCheck = checklistEntrega.length === 0
    ? '<div style="font-size:.75rem;color:var(--color-text-muted)">Nenhum item configurado. Vá em ⚙️ Configurações para adicionar itens ao checklist.</div>'
    : checklistEntrega.map((item, i) => {
        const marcado = !!os.checklistMarcado[i];
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          + neonChk('id="chk-' + osId + '-' + i + '"' + (marcado ? ' checked' : '') + ' onchange="osChecklistMarcar(\'' + osId + '\',' + i + ',this.checked)"')
          + '<label for="chk-' + osId + '-' + i + '" style="cursor:pointer;font-size:.82rem;color:' + (marcado ? '#34d399' : 'var(--texto)') + ';' + (marcado ? 'text-decoration:line-through;opacity:.7' : '') + '">' + item + '</label>'
          + '</div>';
      }).join('');

  var btnNFS = '<button class="btn" style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);color:var(--dourado);padding:10px 18px;font-size:.85rem" onclick="window.open(&quot;https://sjrp.giss.com.br/#&quot;,&quot;_blank&quot;)">🧾 Emitir NFS-e</button>';

  return '<div style="background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(16,185,129,.05));border:1px solid rgba(16,185,129,.3);border-radius:14px;padding:20px 24px;margin-bottom:24px">'
    + '<div style="font-size:.95rem;letter-spacing:3px;color:#34d399;margin-bottom:6px;font-weight:700">🏁 FECHAMENTO DA OS</div>'

    + '<div style="background:rgba(13,35,71,.6);border:1px solid rgba(52,211,153,.2);border-radius:10px;padding:14px 16px;margin-bottom:14px">'
    + '<div style="font-family:\'Inter\';font-size:.8rem;letter-spacing:2px;color:#34d399;margin-bottom:10px">✅ CHECKLIST DE ENTREGA '
    + (checklistEntrega.length > 0 ? '(' + Object.values(os.checklistMarcado||{}).filter(Boolean).length + '/' + checklistEntrega.length + ')' : '') + '</div>'
    + itensCheck
    + (checklistEntrega.length > 0 && !todosCheck ? '<div style="margin-top:10px;font-size:.72rem;color:#fbbf24;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:6px;padding:6px 10px">⚠️ Conclua todos os itens antes de fechar a OS</div>' : '')
    + (todosCheck ? '<div style="margin-top:10px;font-size:.72rem;color:#34d399;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:6px;padding:6px 10px">✅ Todos os itens verificados!</div>' : '')
    + '</div>'

    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + btnNFS
    + '</div></div>';
}

async function osChecklistMarcar(osId, idx, marcado) {
  const os = ordens.find(o => o.id === osId);
  if (!os) return;
  if (!os.checklistMarcado) os.checklistMarcado = {};
  os.checklistMarcado[idx] = marcado;
  await salvarOS();
  renderOS();
}



function osImprimirEtiqueta(id) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;
  const fmtD = d => d ? new Date(d+'T12:00:00').toLocaleDateString('pt-BR') : '—';
  const ST = { aberta:'EM ESPERA', andamento:'EM ANDAMENTO', concluida:'FINALIZAÇÃO', entregue:'PRONTA!', cancelada:'CANCELADA' };

  const win = window.open('', '_blank', 'width=400,height=320');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>ZL Motos v5.1.0</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; background:#fff; display:flex; justify-content:center; align-items:center; min-height:100vh; }
    .etiqueta { border:2px solid #1a3a6b; border-radius:10px; padding:14px 16px; width:320px; background:#fff; }
    .topo { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1a3a6b; padding-bottom:8px; margin-bottom:10px; }
    .empresa { font-size:13px; font-weight:900; color:#1a3a6b; letter-spacing:1px; }
    .numero { font-size:18px; font-weight:900; color:#7c3aed; font-family:monospace; }
    .linha { display:flex; gap:6px; align-items:baseline; margin-bottom:5px; }
    .label { font-size:9px; color:#666; text-transform:uppercase; letter-spacing:1px; min-width:60px; }
    .valor { font-size:12px; font-weight:700; color:#111; }
    .status { display:inline-block; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:900; letter-spacing:1px;
      background:${os.status==='entregue'?'#7c3aed':os.status==='concluida'?'#059669':os.status==='andamento'?'#d97706':'#2563eb'};
      color:white; margin-top:8px; }
    .rodape { font-size:9px; color:#999; text-align:center; margin-top:10px; border-top:1px solid #eee; padding-top:6px; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  </style></head><body>
  <div class="etiqueta">
    <div class="topo">
      <div class="empresa">🔧 ZL MOTOS</div>
      <div class="numero">${osNumeroFormatado(os.numero)}</div>
    </div>
    <div class="linha"><span class="label">Cliente</span><span class="valor">${os.cliente||'—'}</span></div>
    <div class="linha"><span class="label">Placa</span><span class="valor">${os.placa||'—'}</span></div>
    <div class="linha"><span class="label">Veículo</span><span class="valor">${os.veiculo||'—'}</span></div>
    <div class="linha"><span class="label">Entrada</span><span class="valor">${fmtD(os.data)}</span></div>
    <div class="linha"><span class="label">Mecânico</span><span class="valor">${os.mecanico||'—'}</span></div>
    <div><span class="status">${ST[os.status]||os.status}</span></div>
    <div class="rodape">O. G. L. Junior Moto Peça · (17) 3213-2229</div>
  </div>
  <script>window.onload=function(){window.print();}<\/script>
  </body></html>`);
  win.document.close();
}


function osWhatsApp(id) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const statusTxt = {aberta:'Em aberto',andamento:'Em andamento',concluida:'Concluída',entregue:'Entregue',cancelada:'Cancelada'};
  let txt = `🔧 *ORDEM DE SERVIÇO — ZL MOTOS*\n`;
  txt += `*${osNumeroFormatado(os.numero)}*\n\n`;
  txt += `👤 *Cliente:* ${os.cliente||'—'}\n`;
  txt += `🏍️ *Veículo:* ${os.veiculo||'—'}\n`;
  txt += `📋 *Status:* ${statusTxt[os.status]||os.status}\n\n`;
  txt += `🔩 *Serviços/Peças:*\n`;
  os.itens.forEach(it => {
    const sub = (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
    txt += `• ${it.desc} (${it.qtd}x) — R$ ${sub.toLocaleString('pt-BR',{minimumFractionDigits:2})}\n`;
  });
  txt += `\n💰 *Total: ${fmtN(osCalcTotal(os))}*\n`;
  if (os.obsCliente) txt += `\n📝 *Obs:* ${os.obsCliente}\n`;
  txt += `\n_ZL MOTOS — Obrigado pela preferência!_`;
  const tel = (os.telefone||'').replace(/\D/g,'');
  const url = tel ? `https://wa.me/55${tel}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`;
  window.open(url, '_blank');
}

function osPDF(id) {
  const os = ordens.find(o => o.id === id);
  if (!os) return;

  let jsPDF;
  try {
    jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF
          : (typeof jspdf !== 'undefined' && jspdf.jsPDF) ? jspdf.jsPDF
          : window.jsPDF || null;
  } catch(e) { jsPDF = null; }
  if (!jsPDF) { mostrarErro('Erro: jsPDF não carregado. Verifique sua conexão.'); return; }

  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210; let y = 0;
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtD = d => { if(!d) return '—'; try{ return new Date(d+'T12:00:00').toLocaleDateString('pt-BR'); }catch(e){return d;} };
  const statusTxt = {aberta:'EM ESPERA',andamento:'EM ANDAMENTO',concluida:'FINALIZAÇÃO',entregue:'PRONTA!',cancelada:'CANCELADA'};

  // ── HEADER com dados da empresa ──
  doc.setFillColor(10,22,40);
  doc.rect(0,0,W,40,'F');
  doc.setTextColor(167,139,250); doc.setFontSize(20); doc.setFont('helvetica','bold');
  doc.text((empresa.nomeFantasia||empresa.razaoSocial||'ZL MOTOS').toUpperCase(),W/2,12,{align:'center'});
  doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
  const endEmpOS = [empresa.endereco, empresa.bairro, empresa.cidade&&empresa.estado?empresa.cidade+' — '+empresa.estado:''].filter(Boolean).join(' | ');
  const contEmpOS = [empresa.telefone, empresa.cnpj?'CNPJ: '+empresa.cnpj:''].filter(Boolean).join(' | ');
  doc.text(endEmpOS, W/2, 19, {align:'center', maxWidth:180});
  doc.text(contEmpOS, W/2, 24, {align:'center', maxWidth:180});
  doc.setFontSize(8); doc.setTextColor(167,139,250);
  doc.text('ORDEM DE SERVIÇO',W/2,30,{align:'center'});
  doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
  doc.text(osNumeroFormatado(os.numero),W/2,37,{align:'center'});
  y = 50;

  // ── STATUS BADGE ──
  const sColor = {aberta:[96,165,250],andamento:[251,191,36],concluida:[52,211,153],entregue:[167,139,250],cancelada:[248,113,113]};
  const sc = sColor[os.status] || [96,165,250];
  doc.setFillColor(sc[0],sc[1],sc[2]);
  doc.roundedRect(W/2-25,y-6,50,8,2,2,'F');
  doc.setTextColor(10,22,40); doc.setFontSize(7); doc.setFont('helvetica','bold');
  doc.text((statusTxt[os.status]||'').toUpperCase(), W/2, y-1, {align:'center'});
  y += 8;

  // ── INFO CLIENTE ──
  doc.setFillColor(13,35,71); doc.roundedRect(14,y,55,22,3,3,'F');
  doc.roundedRect(75,y,65,22,3,3,'F');
  doc.roundedRect(146,y,50,22,3,3,'F');
  doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
  doc.text('CLIENTE',20,y+6); doc.text('VEÍCULO / MODELO',81,y+6); doc.text('TELEFONE',152,y+6);
  doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(240,246,255);
  doc.text(os.cliente||'—',20,y+14,{maxWidth:44});
  doc.text(os.veiculo||'—',81,y+14,{maxWidth:54});
  doc.text(os.telefone||'—',152,y+14,{maxWidth:40});
  y += 32;

  // ── PLACA / KM ──
  doc.setFillColor(13,35,71); doc.roundedRect(14,y,90,14,2,2,'F');
  doc.roundedRect(110,y,86,14,2,2,'F');
  doc.setFontSize(6.5); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
  doc.text('PLACA',20,y+5); doc.text('KM ENTRADA',116,y+5);
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(240,246,255);
  doc.text(os.placa||'—',20,y+11,{maxWidth:80});
  doc.text(os.km ? String(os.km)+' km' : '—',116,y+11,{maxWidth:76});
  y += 24;

  // ── DATAS / MECÂNICO / TEMPO ──
  const tempoMs = osTempoAtual(os);
  const tempoStr = tempoMs > 0 ? osFmtTempo(tempoMs) : '—';
  doc.setFillColor(20,40,80); doc.roundedRect(14,y,44,14,2,2,'F');
  doc.roundedRect(64,y,44,14,2,2,'F');
  doc.roundedRect(114,y,44,14,2,2,'F');
  doc.roundedRect(164,y,32,14,2,2,'F');
  doc.setFontSize(6.5); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
  doc.text('ENTRADA',20,y+5); doc.text('PREVISÃO',70,y+5); doc.text('MECÂNICO',120,y+5); doc.text('TEMPO',170,y+5);
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(240,246,255);
  doc.text(fmtD(os.dataEntrada),20,y+11);
  doc.text(fmtD(os.previsaoEntrega),70,y+11);
  doc.text(os.mecanico||'—',120,y+11,{maxWidth:40});
  doc.text(tempoStr,170,y+11,{maxWidth:28});
  y += 24;

  // ── TABELA ITENS ──
  doc.setFillColor(26,58,107); doc.rect(14,y,182,8,'F');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('DESCRIÇÃO',16,y+5.5);
  doc.text('CAT.',100,y+5.5);
  doc.text('QTD',122,y+5.5,{align:'right'});
  doc.text('V. UNIT.',155,y+5.5,{align:'right'});
  doc.text('SUBTOTAL',196,y+5.5,{align:'right'});
  y += 11;

  doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  os.itens.forEach((it, i) => {
    if (y > 220) { doc.addPage(); y = 20; }
    const sub = (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
    if (i%2===0) { doc.setFillColor(13,35,71); doc.rect(14,y-3,182,7,'F'); }
    doc.setTextColor(i%2===0?200:180, i%2===0?220:200, i%2===0?255:240);
    doc.text(it.desc||'—',16,y+1,{maxWidth:80});
    doc.setFontSize(7); doc.setTextColor(148,163,184);
    doc.text(it.cat||'',100,y+1);
    doc.setFontSize(8.5); doc.setTextColor(i%2===0?200:180, i%2===0?220:200, i%2===0?255:240);
    doc.text(String(it.qtd||1),122,y+1,{align:'right'});
    doc.text('R$ '+parseFloat(it.vunit||0).toLocaleString('pt-BR',{minimumFractionDigits:2}),155,y+1,{align:'right'});
    doc.setTextColor(134,239,172);
    doc.text('R$ '+sub.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),196,y+1,{align:'right'});
    if (it.obs) {
      y += 6;
      doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
      doc.text('  '+it.obs,16,y+1,{maxWidth:180});
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    }
    y += 8;
    doc.setDrawColor(20,40,80); doc.line(14,y-2,196,y-2);
  });

  // ── TOTAL ──
  // Recalcula o total direto dos itens para garantir valor correto
  const totalCalculado = osCalcTotal(os);
  y += 4;
  doc.setFillColor(16,58,40); doc.roundedRect(130,y-4,66,12,2,2,'F');
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(52,211,153);
  doc.text('TOTAL:',134,y+4);
  doc.text('R$ '+totalCalculado.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),196,y+4,{align:'right'});
  y += 16;

  // ── OBS INTERNAS ──
  if (os.obsInternas) {
    if (y>240){doc.addPage();y=20;}
    doc.setFillColor(13,35,71); doc.roundedRect(14,y,182,6+(doc.splitTextToSize(os.obsInternas,170).length*4.5),2,2,'F');
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(148,163,184);
    doc.text('📋 OBSERVAÇÕES TÉCNICAS (INTERNO):',16,y+5);
    y += 9;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(200,220,255);
    const obsLines = doc.splitTextToSize(os.obsInternas,178);
    doc.text(obsLines,16,y);
    y += obsLines.length*4.5+8;
  }

  // ── OBS CLIENTE ──
  if (os.obsCliente) {
    if (y>240){doc.addPage();y=20;}
    doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(148,163,184);
    doc.text('💬 OBSERVAÇÕES AO CLIENTE:',16,y+2);
    y += 7;
    doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(180,200,240);
    const obsC = doc.splitTextToSize(os.obsCliente,178);
    doc.text(obsC,16,y);
    y += obsC.length*4.5+8;
  }

  // ── ASSINATURAS ──
  if (y>250){doc.addPage();y=20;}
  doc.setDrawColor(40,70,120); doc.line(14,y,196,y);
  y += 10;
  doc.setLineWidth(0.3); doc.setDrawColor(60,90,120);
  doc.line(14,y,90,y);
  doc.line(110,y,196,y);
  doc.setFontSize(6.5); doc.setTextColor(100,120,150); doc.setFont('helvetica','normal');
  doc.text('Assinatura do Cliente',14,y+5);
  doc.text('Assinatura do Responsável / Mecânico',110,y+5);

  // ── RODAPÉ ──
  doc.setFontSize(7); doc.setTextColor(60,90,130);
  // Bloco de garantia no PDF
  if (os.garantia && os.garantia.ativa && os.garantia.dataInicio) {
    if (y > 240) { doc.addPage(); y = 20; }
    const gTipo = GARANTIA_TIPOS.find(function(t){return t.id===os.garantia.tipo;}) || GARANTIA_TIPOS[0];
    const gDias = os.garantia.tipo === 'custom' ? (parseInt(os.garantia.diasCustom)||90) : gTipo.dias;
    const gInicio = new Date(os.garantia.dataInicio + 'T12:00:00');
    const gVenc = new Date(gInicio); gVenc.setDate(gVenc.getDate() + gDias);
    const gVencStr = gVenc.toLocaleDateString('pt-BR');
    const gInicioStr = gInicio.toLocaleDateString('pt-BR');
    const hoje = new Date(); hoje.setHours(12,0,0,0);
    const diff = Math.ceil((gVenc - hoje) / (1000*60*60*24));
    const ativa = diff > 0;
    doc.setFillColor(ativa ? 16 : 239, ativa ? 185 : 68, ativa ? 129 : 68, 0.15);
    doc.setFillColor(ativa ? 16 : 185, ativa ? 185 : 28, ativa ? 129 : 28);
    // Fundo do bloco
    doc.setFillColor(ativa ? 13 : 60, ativa ? 60 : 15, ativa ? 50 : 15);
    doc.roundedRect(14, y, 182, 18, 3, 3, 'F');
    doc.setDrawColor(ativa ? 52 : 239, ativa ? 211 : 68, ativa ? 153 : 68);
    doc.roundedRect(14, y, 182, 18, 3, 3, 'S');
    doc.setFontSize(7.5); doc.setFont('helvetica','bold');
    doc.setTextColor(ativa ? 52 : 248, ativa ? 211 : 113, ativa ? 153 : 113);
    doc.text((ativa ? '🛡️ GARANTIA ATIVA' : '🛡️ GARANTIA VENCIDA'), 20, y+7);
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(180,200,220);
    doc.text(gTipo.label + ' — ' + gDias + ' dias (' + gTipo.base + ')', 20, y+13);
    doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.setTextColor(ativa ? 52 : 248, ativa ? 211 : 113, ativa ? 153 : 113);
    doc.text('Início: ' + gInicioStr + '  |  Vence: ' + gVencStr + (ativa ? '  |  Faltam: ' + diff + ' dias' : '  |  Vencida há: ' + Math.abs(diff) + ' dias'), 110, y+10, {align:'right', maxWidth:96});
    y += 26;
  }

  doc.text((empresa.nomeFantasia||'ZL MOTOS')+' — '+osNumeroFormatado(os.numero)+' — Gerada em '+new Date().toLocaleDateString('pt-BR'),W/2,297,{align:'center'});

  const nomeArq = `ZL_MOTOS_${osNumeroFormatado(os.numero)}_${(os.cliente||'cliente').replace(/\s+/g,'_')}.pdf`;
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArq;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch(e) {
    try { doc.save(nomeArq); } catch(e2) { mostrarErro('Erro ao gerar PDF da OS.'); }
  }
}

// ══════════════════════════════════════════════════════
// COMPROVANTE DE PRESTAÇÃO DE SERVIÇOS
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// DASHBOARD INICIAL
// ══════════════════════════════════════════════════════

function calcularRankingClientes() {
  const mapa = {};
  ordens.filter(o => o.status === 'concluida' || o.status === 'entregue').forEach(os => {
    const nome = (os.cliente||'').trim();
    if (!nome) return;
    if (!mapa[nome]) mapa[nome] = { cliente: nome, total: 0, count: 0 };
    mapa[nome].total += parseFloat(osCalcTotal(os)) || 0;
    mapa[nome].count++;
  });
  return Object.values(mapa).sort((a,b) => b.total - a.total);
}

function renderRankingClientes() {
  const main = document.getElementById('mainContent');
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const ranking = calcularRankingClientes();

  const rows = ranking.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:24px">Nenhuma OS concluída/entregue ainda</td></tr>'
    : ranking.map((c, i) => {
        const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1) + 'º';
        return '<tr>'
          + '<td style="text-align:center;font-size:1rem">' + medalha + '</td>'
          + '<td style="font-weight:600;color:var(--color-text-primary)">' + c.cliente + '</td>'
          + '<td style="text-align:center;color:var(--color-text-muted)">' + c.count + ' OS</td>'
          + '<td style="text-align:right;color:#34d399;font-weight:700;font-family:\'JetBrains Mono\',monospace">' + fmt(c.total) + '</td>'
          + '</tr>';
      }).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#34d399">🏆 Ranking de Clientes</span>
      <div class="toolbar-right">
        <button class="btn-voltar" onclick="sbIr(18)" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
      </div>
    </div>
    <div style="background:rgba(13,35,71,.6);border:1px solid rgba(52,211,153,.2);border-radius:14px;padding:20px">
      <div style="font-size:.72rem;color:var(--color-text-muted);margin-bottom:14px">Baseado em OS concluídas e entregues. ${ranking.length} cliente(s) encontrado(s).</div>
      <div style="overflow-x:auto">
        <table class="tabela-mobile">
          <thead><tr><th style="width:50px">#</th><th>Cliente</th><th style="text-align:center">OS</th><th style="text-align:right">Total Gasto</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}


function renderDashboard() {

  const main = document.getElementById('mainContent');
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtK = v => { v = parseFloat(v)||0; return v >= 1000 ? 'R$' + (v/1000).toFixed(1) + 'k' : 'R$' + v.toFixed(0); };
  const hoje = hojeISO();
  const mesAtual = new Date().getMonth();
  const anoAtual = parseInt((document.getElementById('anoGlobal') ? document.getElementById('anoGlobal').value : new Date().getFullYear()) || new Date().getFullYear());
  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Dados financeiros do mês atual
  const calc = calcularMes(mesAtual);

  // OS
  const osAbertas = ordens.filter(o => o.status === 'aberta').length;
  const osAndamento = ordens.filter(o => o.status === 'andamento').length;
  const osConcluidas = ordens.filter(o => o.status === 'concluida').length;
  const osParadas = ordens.filter(os => osEstaParada(os, 4));
  const osAtrasadas = ordens.filter(os => osEstaAtrasada(os));

  // Agendamentos de hoje
  const agHoje = agendamentos.filter(a => a.data === hoje).sort((a,b) => (a.hora||'').localeCompare(b.hora||''));

  // Estoque crítico
  const estCritico = typeof estoque !== 'undefined' ? estoque.filter(p => (parseFloat(p.qtd)||0) === 0 || ((parseFloat(p.qtd)||0) <= (parseFloat(p.minimo)||0) && (parseFloat(p.minimo)||0) > 0)) : [];

  // Orçamentos pendentes
  const orcPendentes = orcamentos.filter(o => (o.status||'pendente') === 'pendente').length;

  // Ranking top 3
  const ranking = calcularRankingClientes().slice(0,3);

  // ── GRÁFICO 6 MESES ──────────────────────────────────────
  // Pega os últimos 6 meses (incluindo o atual)
  const graf6 = [];
  for (let i = 5; i >= 0; i--) {
    let m = mesAtual - i;
    if (m < 0) m += 12;
    const c = calcularMes(m);
    graf6.push({ mes: MESES_ABREV[m], bruto: c.totalBruto, saidas: c.totalSaidas, liquido: c.totalLiquido, idx: m });
  }
  const maxValGraf = Math.max(...graf6.map(g => Math.max(g.bruto, g.saidas)), 1);

  // SVG inline — barras duplas (entradas + saídas) + linha de lucro
  const SVG_W = 560, SVG_H = 160, PAD_L = 48, PAD_R = 12, PAD_T = 12, PAD_B = 32;
  const grafW = SVG_W - PAD_L - PAD_R;
  const grafH = SVG_H - PAD_T - PAD_B;
  const barW = Math.floor(grafW / graf6.length);
  const barPad = 6;
  const barW2 = Math.floor((barW - barPad * 3) / 2);

  function yPos(v) { return PAD_T + grafH - (v / maxValGraf) * grafH; }

  // Barras
  let barrasHTML = '';
  graf6.forEach((g, i) => {
    const x = PAD_L + i * barW + barPad;
    const hBruto  = Math.max(2, (g.bruto  / maxValGraf) * grafH);
    const hSaidas = Math.max(2, (g.saidas / maxValGraf) * grafH);
    const isAtual = (i === 5);
    const opBruto  = isAtual ? '1' : '0.65';
    const opSaidas = isAtual ? '1' : '0.55';

    // barra entradas
    barrasHTML += `<rect x="${x}" y="${(PAD_T + grafH - hBruto).toFixed(1)}" width="${barW2}" height="${hBruto.toFixed(1)}"
      rx="3" fill="#34d399" opacity="${opBruto}" style="cursor:pointer" onclick="sbIr(${g.idx})"
      title="${g.mes}: Entradas ${fmt(g.bruto)}"><title>${g.mes} — Entradas: ${fmt(g.bruto)}</title></rect>`;

    // barra saídas
    barrasHTML += `<rect x="${x + barW2 + barPad}" y="${(PAD_T + grafH - hSaidas).toFixed(1)}" width="${barW2}" height="${hSaidas.toFixed(1)}"
      rx="3" fill="#fca5a5" opacity="${opSaidas}" style="cursor:pointer" onclick="sbIr(${g.idx})"
      title="${g.mes}: Saídas ${fmt(g.saidas)}"><title>${g.mes} — Saídas: ${fmt(g.saidas)}</title></rect>`;

    // label do mês
    barrasHTML += `<text x="${(x + barW2 + barPad/2).toFixed(1)}" y="${SVG_H - 8}" text-anchor="middle"
      font-size="9" fill="${isAtual ? '#facc15' : 'rgba(255,255,255,0.35)'}" font-family="Inter,sans-serif">${g.mes}</text>`;
  });

  // Linha de lucro líquido
  const pontosLinha = graf6.map((g, i) => {
    const x = PAD_L + i * barW + barPad + barW2 + barPad/2;
    const y = yPos(Math.max(0, g.liquido));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const circulosLinha = graf6.map((g, i) => {
    const x = PAD_L + i * barW + barPad + barW2 + barPad/2;
    const y = yPos(Math.max(0, g.liquido));
    const cor = g.liquido >= 0 ? '#a78bfa' : '#fca5a5';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${cor}" stroke="#0a0a0b" stroke-width="1.5" style="cursor:pointer" onclick="sbIr(${g.idx})"><title>${g.mes} — Lucro: ${fmt(g.liquido)}</title></circle>`;
  }).join('');

  // Linhas de grade horizontais (3)
  let gradeHTML = '';
  [0.25, 0.5, 0.75, 1].forEach(p => {
    const y = (PAD_T + grafH - p * grafH).toFixed(1);
    gradeHTML += `<line x1="${PAD_L}" y1="${y}" x2="${SVG_W - PAD_R}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    gradeHTML += `<text x="${PAD_L - 4}" y="${parseFloat(y)+3}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.25)" font-family="Inter,sans-serif">${fmtK(maxValGraf * p)}</text>`;
  });

  const graficoSVG = `
  <svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
    <!-- grade -->
    ${gradeHTML}
    <!-- linha zero -->
    <line x1="${PAD_L}" y1="${PAD_T + grafH}" x2="${SVG_W - PAD_R}" y2="${PAD_T + grafH}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <!-- barras -->
    ${barrasHTML}
    <!-- linha lucro -->
    <polyline points="${pontosLinha}" fill="none" stroke="#a78bfa" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.8"/>
    <!-- pontos lucro -->
    ${circulosLinha}
  </svg>`;

  // ── LEGENDA TOTAIS ANO ────────────────────────────────────
  const totalEntAno = graf6.reduce((s,g) => s + g.bruto, 0);
  const totalSaiAno = graf6.reduce((s,g) => s + g.saidas, 0);
  const totalLiqAno = totalEntAno - totalSaiAno;

  // ── C11 — FATURAMENTO POR ORIGEM ──────────────────────────
  const mesInicio = new Date(anoAtual, mesAtual, 1);
  const mesFim    = new Date(anoAtual, mesAtual+1, 0);
  const dentroDoMes = d => { if(!d) return false; const dt=new Date(d.length===10?d+'T12:00:00':d); return dt>=mesInicio&&dt<=mesFim; };
  const fatOS    = ordens.filter(o=>(o.status==='concluida'||o.status==='entregue')&&dentroDoMes(o.dataEntrada||o.criadoEm)).reduce((s,o)=>s+(parseFloat(osCalcTotal(o))||0),0);
  const fatVenda = vendaHistorico.filter(v=>dentroDoMes(v.data)).reduce((s,v)=>s+(parseFloat(v.total)||0),0);
  const fatOrc   = orcamentos.filter(o=>(o.status==='aceito'||o.status==='aprovado')&&o.pago&&dentroDoMes(o.criadoEm||o.data)).reduce((s,o)=>s+(parseFloat(o.calc&&o.calc.total||o.total)||0),0);
  const fatTotal = fatOS+fatVenda+fatOrc||1;
  const pctOS=Math.round((fatOS/fatTotal)*100), pctV=Math.round((fatVenda/fatTotal)*100), pctO=Math.round((fatOrc/fatTotal)*100);
  const origemHTML = `
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px 20px;margin-bottom:16px">
      <div style="font-size:.72rem;letter-spacing:2px;color:var(--color-text-muted);margin-bottom:12px">FATURAMENTO POR ORIGEM · ${MESES_PT[mesAtual].toUpperCase()}</div>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div style="flex:1;text-align:center;background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.15);border-radius:10px;padding:10px">
          <div style="font-size:.65rem;color:var(--color-text-muted);margin-bottom:4px">🔧 OS Concluídas</div>
          <div style="font-size:.95rem;font-weight:700;color:#60a5fa">${fmt(fatOS)}</div>
          <div style="font-size:.65rem;color:var(--color-text-muted)">${pctOS}%</div>
        </div>
        <div style="flex:1;text-align:center;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.15);border-radius:10px;padding:10px">
          <div style="font-size:.65rem;color:var(--color-text-muted);margin-bottom:4px">🛒 Vendas Balcão</div>
          <div style="font-size:.95rem;font-weight:700;color:#fbbf24">${fmt(fatVenda)}</div>
          <div style="font-size:.65rem;color:var(--color-text-muted)">${pctV}%</div>
        </div>
        <div style="flex:1;text-align:center;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.15);border-radius:10px;padding:10px">
          <div style="font-size:.65rem;color:var(--color-text-muted);margin-bottom:4px">📋 Orçamentos</div>
          <div style="font-size:.95rem;font-weight:700;color:#34d399">${fmt(fatOrc)}</div>
          <div style="font-size:.65rem;color:var(--color-text-muted)">${pctO}%</div>
        </div>
      </div>
      <div style="height:8px;background:rgba(255,255,255,.06);border-radius:999px;overflow:hidden;display:flex">
        <div style="width:${pctOS}%;background:#60a5fa;transition:width .5s"></div>
        <div style="width:${pctV}%;background:#fbbf24;transition:width .5s"></div>
        <div style="width:${pctO}%;background:#34d399;transition:width .5s"></div>
      </div>
    </div>`;
  const cards = [
    { icon:'💰', label:'Entradas ' + MESES_PT[mesAtual], valor: fmt(calc.totalBruto), cor:'#34d399', bg:'rgba(52,211,153,.08)', borda:'rgba(52,211,153,.2)', onclick:'sbIr(' + mesAtual + ')' },
    { icon:'💸', label:'Saídas ' + MESES_PT[mesAtual], valor: fmt(calc.totalSaidas), cor:'#fca5a5', bg:'rgba(252,165,165,.08)', borda:'rgba(252,165,165,.2)', onclick:'sbIr(' + mesAtual + ')' },
    { icon:'💎', label:'Lucro ' + MESES_PT[mesAtual], valor: fmt(calc.totalLiquido), cor: calc.totalLiquido >= 0 ? '#a78bfa' : '#fca5a5', bg:'rgba(167,139,250,.08)', borda:'rgba(167,139,250,.2)', onclick:'sbIr(' + mesAtual + ')' },
    { icon:'🔧', label:'OS em Aberto', valor: (osAbertas + osAndamento) + ' OS', cor:'#60a5fa', bg:'rgba(96,165,250,.08)', borda:'rgba(96,165,250,.2)', onclick:'sbIr(15)' },
    { icon:'📋', label:'Orçamentos Pendentes', valor: orcPendentes + ' aguardando', cor:'#fbbf24', bg:'rgba(251,191,36,.08)', borda:'rgba(251,191,36,.2)', onclick:'sbIr(13)' },
    { icon:'📦', label:'Estoque Crítico', valor: estCritico.length + ' item(s)', cor: estCritico.length > 0 ? '#fca5a5' : '#34d399', bg: estCritico.length > 0 ? 'rgba(252,165,165,.08)' : 'rgba(52,211,153,.08)', borda: estCritico.length > 0 ? 'rgba(252,165,165,.2)' : 'rgba(52,211,153,.2)', onclick:'sbIr(14)' },
  ];

  const cardsHTML = cards.map(c =>
    '<div onclick="' + c.onclick + '" style="cursor:pointer;position:relative;overflow:hidden;background:#1a1b22;border:1px solid ' + c.borda + ';border-radius:14px;padding:18px 20px;transition:transform .25s cubic-bezier(.23,1,.32,1),box-shadow .25s,border-color .2s;box-shadow:0 4px 16px rgba(0,0,0,.4)"'
    + ' onmouseover="this.style.transform=\'translateY(-3px) scale(1.02)\';this.style.boxShadow=\'0 8px 28px rgba(0,0,0,.5),0 0 0 1px '+c.borda+'\';this.querySelector(\'span.dash-grid\').style.opacity=\'1\'"'
    + ' onmouseout="this.style.transform=\'\';this.style.boxShadow=\'0 4px 16px rgba(0,0,0,.4)\';this.querySelector(\'span.dash-grid\').style.opacity=\'0\'">'
    + '<span class="dash-grid" style="position:absolute;inset:0;background-image:linear-gradient('+c.borda+' 1px,transparent 1px),linear-gradient(90deg,'+c.borda+' 1px,transparent 1px);background-size:1.5em 1.5em;opacity:0;pointer-events:none;transition:opacity .3s;animation:ag-grid-scroll 20s linear infinite"></span>'
    + '<div style="position:relative;z-index:1;font-size:.72rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:6px">' + c.icon + ' ' + c.label + '</div>'
    + '<div style="position:relative;z-index:1;font-size:1.3rem;font-weight:700;color:' + c.cor + ';font-family:\'JetBrains Mono\',monospace">' + c.valor + '</div>'
    + '</div>'
  ).join('');

  // Agendamentos de hoje
  const agHTML = agHoje.length === 0
    ? '<div style="text-align:center;color:var(--color-text-muted);font-size:.78rem;padding:16px 0">Nenhum agendamento hoje</div>'
    : agHoje.map(a => {
        const s = AG_STATUS[a.status] || AG_STATUS['agendado'];
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          + '<span style="font-size:.75rem;color:var(--color-text-muted);min-width:36px">' + (a.hora||'—') + '</span>'
          + '<span style="font-size:.85rem;color:var(--texto);flex:1">' + (a.cliente||'—') + '</span>'
          + '<span style="font-size:.68rem;color:' + s.cor + '">' + s.icon + ' ' + s.txt + '</span>'
          + '</div>';
      }).join('');

  // Ranking top 3
  const rankingHTML = ranking.length === 0
    ? '<div style="text-align:center;color:var(--color-text-muted);font-size:.78rem;padding:16px 0">Nenhuma OS concluída</div>'
    : ranking.map((c, i) => {
        const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          + '<span style="font-size:1rem">' + medalha + '</span>'
          + '<span style="font-size:.85rem;color:var(--texto);flex:1">' + c.cliente + '</span>'
          + '<span style="font-size:.82rem;color:#34d399;font-weight:700;font-family:\'JetBrains Mono\',monospace">' + fmt(c.total) + '</span>'
          + '</div>';
      }).join('');

  // OS kanban resumido
  const kanbanResumoHTML = [
    { label:'Em Espera', count: osAbertas, cor:'#60a5fa' },
    { label:'Andamento', count: osAndamento, cor:'#fbbf24' },
    { label:'Concluídas', count: osConcluidas, cor:'#34d399' },
  ].map(k =>
    '<div style="flex:1;text-align:center;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px 8px">'
    + '<div style="font-size:1.6rem;font-weight:900;color:' + k.cor + ';font-family:\'JetBrains Mono\',monospace">' + k.count + '</div>'
    + '<div style="font-size:.65rem;color:var(--color-text-muted);margin-top:4px">' + k.label + '</div>'
    + '</div>'
  ).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#facc15">🏠 Dashboard</span>
      <div class="toolbar-right">
        <span style="font-size:.75rem;color:var(--color-text-muted)">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span>
      </div>
    </div>

    <!-- META MENSAL C09 -->
    ${metaMensal > 0 ? (() => {
      const pct = Math.min(100, Math.round((calc.totalBruto / metaMensal) * 100));
      const corMeta = pct >= 100 ? '#34d399' : pct >= 80 ? '#fbbf24' : '#f87171';
      const fmt2 = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
      return `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:16px;cursor:pointer" onclick="sbIr(${mesAtual})">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
            <span style="font-size:.72rem;color:var(--color-text-muted);letter-spacing:1px">🎯 META ${MESES_PT[mesAtual].toUpperCase()}</span>
            <span style="font-size:.82rem;font-weight:700;color:${corMeta}">${pct}% — ${fmt2(calc.totalBruto)} de ${fmt2(metaMensal)}</span>
          </div>
          <div style="height:8px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${corMeta};border-radius:999px;transition:width .5s"></div>
          </div>
        </div>
        <div style="font-size:1.4rem;font-weight:700;color:${corMeta}">${pct >= 100 ? '🏆' : pct >= 80 ? '🔥' : '📈'}</div>
      </div>`;
    })() : `<div style="background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.08);border-radius:14px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="dashDefinirMeta()">
      <span style="font-size:.82rem;color:var(--color-text-muted)">🎯 Definir meta mensal de faturamento</span>
      <button style="margin-left:auto;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);color:#34d399;border-radius:8px;padding:5px 14px;font-size:.78rem;cursor:pointer">+ Definir</button>
    </div>`}

    <!-- ALERTAS ACIONÁVEIS C06 -->
    ${(() => {
      const alertasAtivos = [];
      // OS atrasadas
      if (osAtrasadas.length > 0) alertasAtivos.push({
        cor:'#f87171', bg:'rgba(248,113,113,.08)', borda:'rgba(248,113,113,.25)',
        icon:'🔴', txt: `<b>${osAtrasadas.length} OS atrasada${osAtrasadas.length>1?'s':''}</b> — prazo vencido: ${osAtrasadas.slice(0,2).map(o=>o.cliente||'—').join(', ')}${osAtrasadas.length>2?'...':''}`,
        acao: `abaAtiva=15;renderAll()`
      });
      // OS paradas 4+ dias
      if (osParadas.length > 0) alertasAtivos.push({
        cor:'#fbbf24', bg:'rgba(251,191,36,.08)', borda:'rgba(251,191,36,.25)',
        icon:'⏸️', txt: `<b>${osParadas.length} OS parada${osParadas.length>1?'s':''}</b> sem atualização há +4 dias`,
        acao: `abaAtiva=15;renderAll()`
      });
      // Orçamentos pendentes há +3 dias
      const orcParados = orcamentos.filter(o => {
        if ((o.status||'pendente') !== 'pendente') return false;
        const d = o.criadoEm||o.data;
        if (!d) return false;
        return Math.floor((new Date()-new Date(d))/(86400000)) >= 3;
      });
      if (orcParados.length > 0) alertasAtivos.push({
        cor:'#a78bfa', bg:'rgba(167,139,250,.08)', borda:'rgba(167,139,250,.25)',
        icon:'📋', txt: `<b>${orcParados.length} orçamento${orcParados.length>1?'s':''}</b> pendente${orcParados.length>1?'s':''} há +3 dias sem resposta`,
        acao: `orcViewMode='kanban';abaAtiva=13;renderAll()`
      });
      // Estoque zerado
      if (estCritico.length > 0) alertasAtivos.push({
        cor:'#fb923c', bg:'rgba(251,146,60,.08)', borda:'rgba(251,146,60,.25)',
        icon:'📦', txt: `<b>${estCritico.length} item${estCritico.length>1?'s':''}</b> com estoque crítico: ${estCritico.slice(0,2).map(p=>p.nome).join(', ')}${estCritico.length>2?'...':''}`,
        acao: `abaAtiva=14;renderAll()`
      });
      // Aniversariantes da semana C08
      const hoje2 = new Date(); const fimSemana = new Date(hoje2); fimSemana.setDate(hoje2.getDate()+7);
      const aniversariantes = (clientesCadastradosManuais||[]).filter(c => {
        if (!c.nascimento) return false;
        const nasc = new Date(c.nascimento+'T12:00:00');
        const esteAno = new Date(hoje2.getFullYear(), nasc.getMonth(), nasc.getDate());
        return esteAno >= hoje2 && esteAno <= fimSemana;
      });
      if (aniversariantes.length > 0) alertasAtivos.push({
        cor:'#f472b6', bg:'rgba(244,114,182,.08)', borda:'rgba(244,114,182,.25)',
        icon:'🎂', txt: `<b>${aniversariantes.length} aniversariante${aniversariantes.length>1?'s':''}</b> esta semana: ${aniversariantes.slice(0,2).map(c=>c.nome.split(' ')[0]).join(', ')}`,
        acao: `abaAtiva=20;renderAll()`
      });
      if (!alertasAtivos.length) return '';
      return `<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">` +
        alertasAtivos.map(a =>
          `<div onclick="${a.acao}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${a.bg};border:1px solid ${a.borda};border-radius:10px;cursor:pointer;transition:opacity .15s" onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
            <span style="font-size:1rem">${a.icon}</span>
            <span style="font-size:.82rem;color:var(--color-text-primary);flex:1">${a.txt}</span>
            <span style="font-size:.72rem;color:${a.cor};font-weight:700">Ver →</span>
          </div>`
        ).join('') + `</div>`;
    })()}

    <!-- CARDS RESUMO -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
      ${cardsHTML}
    </div>

    <!-- FATURAMENTO POR ORIGEM C11 -->
    ${origemHTML}

    <!-- GRÁFICO FATURAMENTO 6 MESES -->
    <div style="background:#111114;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px 20px;margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:.72rem;letter-spacing:2px;color:var(--color-text-muted);margin-bottom:2px">VISÃO GERAL · ÚLTIMOS 6 MESES · ${anoAtual}</div>
          <div style="font-size:.82rem;font-weight:600;color:var(--color-text-primary)">Faturamento mensal</div>
        </div>
        <!-- legenda + totais acumulados -->
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:#34d399"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#34d399"></span> Entradas</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:#fca5a5"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fca5a5"></span> Saídas</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:#a78bfa"><span style="display:inline-block;width:10px;height:6px;border-radius:1px;background:none;border-top:2px dashed #a78bfa"></span> Lucro</div>
        </div>
      </div>

      <!-- SVG gráfico -->
      <div style="overflow-x:auto">
        ${graficoSVG}
      </div>

      <!-- Totais acumulados dos 6 meses -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)">
        <div style="text-align:center">
          <div style="font-size:.65rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:3px">ENTRADAS ACUM.</div>
          <div style="font-size:1rem;font-weight:700;color:#34d399;font-family:'JetBrains Mono',monospace">${fmt(totalEntAno)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.65rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:3px">SAÍDAS ACUM.</div>
          <div style="font-size:1rem;font-weight:700;color:#fca5a5;font-family:'JetBrains Mono',monospace">${fmt(totalSaiAno)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.65rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:3px">LUCRO ACUM.</div>
          <div style="font-size:1rem;font-weight:700;color:${totalLiqAno >= 0 ? '#a78bfa' : '#fca5a5'};font-family:'JetBrains Mono',monospace">${fmt(totalLiqAno)}</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">

      <!-- AGENDAMENTOS HOJE -->
      <div style="background:rgba(13,35,71,.6);border:1px solid rgba(244,114,182,.2);border-radius:14px;padding:16px 18px">
        <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#f472b6;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
          📅 HOJE <span style="font-size:.7rem;background:rgba(244,114,182,.15);color:#f472b6;border-radius:99px;padding:1px 8px">${agHoje.length}</span>
        </div>
        ${agHTML}
        <button onclick="sbIr(17)" style="margin-top:10px;width:100%;background:transparent;border:1px dashed rgba(244,114,182,.3);color:#f472b6;border-radius:8px;padding:6px;font-size:.72rem;cursor:pointer">Ver todos →</button>
      </div>

      <!-- STATUS DAS OS -->
      <div style="background:rgba(13,35,71,.6);border:1px solid rgba(96,165,250,.2);border-radius:14px;padding:16px 18px">
        <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#60a5fa;margin-bottom:12px">🔧 STATUS DAS OS</div>
        <div style="display:flex;gap:8px;margin-bottom:14px">${kanbanResumoHTML}</div>
        ${estCritico.length > 0 ? '<div style="background:rgba(252,165,165,.08);border:1px solid rgba(252,165,165,.2);border-radius:8px;padding:8px 12px;font-size:.72rem;color:#fca5a5">⚠️ ' + estCritico.length + ' item(s) com estoque crítico</div>' : '<div style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:8px;padding:8px 12px;font-size:.72rem;color:#34d399">✓ Estoque sem alertas</div>'}
        ${osParadas.length > 0 ? '<div style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:8px;padding:8px 12px;font-size:.72rem;color:#fbbf24;margin-top:6px" onclick="sbIr(15)">⏸️ ' + osParadas.length + ' OS parada(s) há mais de 4 dias</div>' : ''}
        ${osAtrasadas.length > 0 ? '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:8px 12px;font-size:.72rem;color:#fca5a5;margin-top:6px" onclick="sbIr(15)">🔴 ' + osAtrasadas.length + ' OS atrasada(s)</div>' : ''}
        <button onclick="sbIr(15)" style="margin-top:10px;width:100%;background:transparent;border:1px dashed rgba(96,165,250,.3);color:#60a5fa;border-radius:8px;padding:6px;font-size:.72rem;cursor:pointer">Ver OS →</button>
      </div>

      <!-- RANKING CLIENTES -->
      <div style="background:rgba(13,35,71,.6);border:1px solid rgba(52,211,153,.2);border-radius:14px;padding:16px 18px">
        <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#34d399;margin-bottom:12px">🏆 TOP CLIENTES</div>
        ${rankingHTML}
        <button onclick="renderRankingClientes()" style="margin-top:10px;width:100%;background:transparent;border:1px dashed rgba(52,211,153,.3);color:#34d399;border-radius:8px;padding:6px;font-size:.72rem;cursor:pointer">Ver ranking completo →</button>
      </div>

    </div>

    <!-- ACESSO RÁPIDO AOS RELATÓRIOS -->
    <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
      <button onclick="renderRelatorioTempoMedio()" style="background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);color:#60a5fa;border-radius:8px;padding:8px 16px;font-size:.75rem;cursor:pointer">⏱️ Tempo Médio por Serviço</button>
      <button onclick="renderRelatorioGarantias()" style="background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.2);color:#a78bfa;border-radius:8px;padding:8px 16px;font-size:.75rem;cursor:pointer">🛡️ Garantias Próximas do Vencimento</button>
      <button onclick="renderRankingClientes()" style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);color:#34d399;border-radius:8px;padding:8px 16px;font-size:.75rem;cursor:pointer">🏆 Ranking de Clientes</button>
      <button onclick="renderFechamentoCaixa()" style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);color:#fbbf24;border-radius:8px;padding:8px 16px;font-size:.75rem;cursor:pointer">🏦 Fechamento de Caixa</button>
      <button onclick="renderRelatorioReposicao()" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#fca5a5;border-radius:8px;padding:8px 16px;font-size:.75rem;cursor:pointer">🔄 Ponto de Reposição</button>
    </div>
  `;
}

// ══════════════════════════════════════════════════════
// RELATÓRIO: TEMPO MÉDIO POR TIPO DE SERVIÇO
// ══════════════════════════════════════════════════════

function renderRelatorioTempoMedio() {
  const main = document.getElementById('mainContent');

  // Calcular tempo médio por tipo de serviço
  const mapa = {};
  ordens.filter(o => o.tempoServico && o.tempoServico.totalMs > 0).forEach(os => {
    const tipo = os.tipoServico || 'Não informado';
    if (!mapa[tipo]) mapa[tipo] = { tipo, totalMs: 0, count: 0 };
    mapa[tipo].totalMs += osTempoAtual(os);
    mapa[tipo].count++;
  });

  const lista = Object.values(mapa).sort((a,b) => b.count - a.count);
  const maxMs = lista.reduce((max, t) => Math.max(max, t.totalMs/t.count), 1);

  const rows = lista.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:var(--color-text-muted);padding:24px">Nenhuma OS com tempo registrado ainda</td></tr>'
    : lista.map(t => {
        const media = t.totalMs / t.count;
        const pct = Math.round((media / maxMs) * 100);
        return '<tr>'
          + '<td style="font-weight:600;color:var(--color-text-primary)">' + t.tipo + '</td>'
          + '<td style="text-align:center;color:var(--color-text-muted)">' + t.count + ' OS</td>'
          + '<td style="font-family:\'JetBrains Mono\',monospace;color:#60a5fa;font-weight:700">' + osFmtTempo(media) + '</td>'
          + '<td style="min-width:120px"><div style="background:rgba(96,165,250,.1);border-radius:4px;overflow:hidden;height:8px"><div style="background:#60a5fa;height:100%;width:' + pct + '%"></div></div></td>'
          + '</tr>';
      }).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#60a5fa">⏱️ Tempo Médio por Serviço</span>
      <div class="toolbar-right">
        <button class="btn-voltar" onclick="sbIr(18)" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
        <button class="btn btn-sm" style="color:#a78bfa;border-color:rgba(167,139,250,.3)" onclick="renderRelatorioGarantias()">🛡️ Ver Garantias →</button>
      </div>
    </div>
    <div style="background:rgba(13,35,71,.6);border:1px solid rgba(96,165,250,.2);border-radius:14px;padding:20px">
      <div style="font-size:.72rem;color:var(--color-text-muted);margin-bottom:14px">Baseado em OS com cronômetro ativo. ${lista.length} tipo(s) de serviço registrado(s).</div>
      <div style="overflow-x:auto">
        <table class="tabela-mobile">
          <thead><tr><th>Tipo de Serviço</th><th style="text-align:center">Qtd OS</th><th>Tempo Médio</th><th>Proporção</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════
// RELATÓRIO: GARANTIAS PRÓXIMAS DO VENCIMENTO
// ══════════════════════════════════════════════════════

function renderRelatorioGarantias() {
  const main = document.getElementById('mainContent');
  const hoje = new Date(); hoje.setHours(12,0,0,0);

  const comGarantia = ordens.filter(o => o.garantia && o.garantia.ativa && o.garantia.dataInicio).map(os => {
    const g = os.garantia;
    const tipo = GARANTIA_TIPOS.find(t => t.id === g.tipo) || GARANTIA_TIPOS[0];
    const dias = g.tipo === 'custom' ? (parseInt(g.diasCustom)||90) : tipo.dias;
    const inicio = new Date(g.dataInicio + 'T12:00:00');
    const venc = new Date(inicio); venc.setDate(venc.getDate() + dias);
    const diff = Math.ceil((venc - hoje) / (1000*60*60*24));
    return { os, venc, diff, diasTotal: dias };
  }).sort((a,b) => a.diff - b.diff);

  const ativas = comGarantia.filter(g => g.diff > 0);
  const vencidas = comGarantia.filter(g => g.diff <= 0);
  const proximas = ativas.filter(g => g.diff <= 30);

  const renderRow = ({ os, venc, diff }) => {
    const cor = diff <= 0 ? '#fca5a5' : diff <= 7 ? '#fbbf24' : diff <= 30 ? '#60a5fa' : '#34d399';
    const label = diff <= 0 ? '⛔ Vencida' : diff <= 7 ? '⚠️ ' + diff + ' dias' : '✓ ' + diff + ' dias';
    return '<tr onclick="osAberta=\'' + os.id + '\';renderOS()" style="cursor:pointer">'
      + '<td style="font-weight:600;color:var(--color-text-primary)">' + osNumeroFormatado(os.numero) + '</td>'
      + '<td>' + (os.cliente||'—') + '</td>'
      + '<td>' + (os.veiculo||'—') + (os.placa?' · '+os.placa:'') + '</td>'
      + '<td>' + venc.toLocaleDateString('pt-BR') + '</td>'
      + '<td><span style="font-size:.75rem;color:' + cor + ';font-weight:700">' + label + '</span></td>'
      + '</tr>';
  };

  const rowsProximas = proximas.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:16px">Nenhuma garantia vencendo nos próximos 30 dias</td></tr>'
    : proximas.map(renderRow).join('');

  const rowsVencidas = vencidas.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:16px">Nenhuma garantia vencida</td></tr>'
    : vencidas.map(renderRow).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#a78bfa">🛡️ Relatório de Garantias</span>
      <div class="toolbar-right">
        <button class="btn-voltar" onclick="sbIr(18)" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
        <button class="btn btn-sm" style="color:#60a5fa;border-color:rgba(96,165,250,.3)" onclick="renderRelatorioTempoMedio()">⏱️ Ver Tempo Médio →</button>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:140px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.6rem;font-weight:900;color:#fbbf24">${proximas.length}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted)">Vencendo em 30 dias</div>
      </div>
      <div style="flex:1;min-width:140px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.6rem;font-weight:900;color:#34d399">${ativas.length}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted)">Ativas</div>
      </div>
      <div style="flex:1;min-width:140px;background:rgba(252,165,165,.08);border:1px solid rgba(252,165,165,.2);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.6rem;font-weight:900;color:#fca5a5">${vencidas.length}</div>
        <div style="font-size:.7rem;color:var(--color-text-muted)">Vencidas</div>
      </div>
    </div>

    <div style="background:rgba(13,35,71,.6);border:1px solid rgba(251,191,36,.2);border-radius:14px;padding:16px 20px;margin-bottom:16px">
      <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#fbbf24;margin-bottom:12px">⚠️ VENCENDO EM ATÉ 30 DIAS</div>
      <div style="overflow-x:auto">
        <table class="tabela-mobile">
          <thead><tr><th>OS</th><th>Cliente</th><th>Veículo</th><th>Vencimento</th><th>Status</th></tr></thead>
          <tbody>${rowsProximas}</tbody>
        </table>
      </div>
    </div>

    <div style="background:rgba(13,35,71,.6);border:1px solid rgba(252,165,165,.2);border-radius:14px;padding:16px 20px">
      <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#fca5a5;margin-bottom:12px">⛔ GARANTIAS VENCIDAS</div>
      <div style="overflow-x:auto">
        <table class="tabela-mobile">
          <thead><tr><th>OS</th><th>Cliente</th><th>Veículo</th><th>Vencimento</th><th>Status</th></tr></thead>
          <tbody>${rowsVencidas}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════
// INVENTÁRIO PERIÓDICO
// ══════════════════════════════════════════════════════

function renderInventario() {
  const main = document.getElementById('mainContent');
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Inicializar contagem física se não existir
  estoque.forEach(p => { if (p.contagem === undefined) p.contagem = ''; });

  const rows = estoque.map((p, i) => {
    const qtdSistema = parseFloat(p.qtd)||0;
    const qtdFisica = p.contagem !== '' ? parseFloat(p.contagem)||0 : null;
    const diff = qtdFisica !== null ? qtdFisica - qtdSistema : null;
    const diffColor = diff === null ? '' : diff === 0 ? '#34d399' : diff > 0 ? '#60a5fa' : '#fca5a5';
    const diffLabel = diff === null ? '—' : diff === 0 ? '✓ OK' : (diff > 0 ? '+' : '') + diff;

    return `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
      <td style="padding:8px 10px;font-weight:600">${p.nome}</td>
      <td style="padding:8px 10px;text-align:center;font-family:'JetBrains Mono',monospace;color:var(--color-primary-hover)">${qtdSistema}</td>
      <td style="padding:8px 10px;text-align:center">
        <input type="number" min="0" step="1" value="${p.contagem!==''?p.contagem:''}" placeholder="—"
          style="width:70px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:.9rem"
          oninput="estoque[${i}].contagem=this.value;document.getElementById('inv-diff-${i}').textContent=(this.value!==''?(parseFloat(this.value)-${qtdSistema}>0?'+':'')+(parseFloat(this.value)-${qtdSistema}):'—');document.getElementById('inv-diff-${i}').style.color=(this.value===''?'var(--color-text-muted)':parseFloat(this.value)===${qtdSistema}?'#34d399':parseFloat(this.value)>${qtdSistema}?'#60a5fa':'#fca5a5')"/>
      </td>
      <td id="inv-diff-${i}" style="padding:8px 10px;text-align:center;font-weight:700;font-family:'JetBrains Mono',monospace;color:${diffColor}">${diffLabel}</td>
      <td style="padding:8px 10px;text-align:center">
        ${qtdFisica !== null && diff !== 0 ? `<button class="btn btn-sm" style="font-size:.68rem" onclick="estoque[${i}].qtd=${qtdFisica};estoque[${i}].contagem='';estSalvar();renderInventario();mostrarToast('✓ Ajustado!')">Ajustar</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  const pendentes = estoque.filter(p => p.contagem !== '' && parseFloat(p.contagem) !== parseFloat(p.qtd)).length;

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#fbbf24">📋 Inventário Físico</span>
      <div class="toolbar-right">
        <button class="btn-voltar" onclick="sbIr(14)" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
        ${pendentes > 0 ? `<button class="btn btn-sm" style="color:#34d399;border-color:rgba(52,211,153,.3)" onclick="estoque.forEach((p,i)=>{if(p.contagem!==''&&parseFloat(p.contagem)!==parseFloat(p.qtd)){p.qtd=parseFloat(p.contagem)||0;p.contagem='';}});estSalvar();renderInventario();mostrarToast('✓ '+${pendentes}+' ajuste(s) aplicados!')">✓ Aplicar todos (${pendentes})</button>` : ''}
      </div>
    </div>

    <div style="background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.15);border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:.78rem;color:var(--color-text-muted)">
      📋 Digite a quantidade física contada para cada peça. A diferença é calculada automaticamente. Clique em <b style="color:#fbbf24">Ajustar</b> para corrigir item por item, ou <b style="color:#34d399">Aplicar todos</b> para corrigir tudo de uma vez.
    </div>

    <div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:12px;overflow:hidden">
      <div class="tabela-wrap"><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.84rem">
          <thead><tr style="background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.08)">
            <th style="padding:10px 10px;text-align:left;font-size:.65rem;letter-spacing:2px;color:var(--color-text-muted)">PEÇA</th>
            <th style="padding:10px 10px;text-align:center;font-size:.65rem;letter-spacing:2px;color:var(--color-text-muted)">SISTEMA</th>
            <th style="padding:10px 10px;text-align:center;font-size:.65rem;letter-spacing:2px;color:var(--color-text-muted)">CONTAGEM FÍSICA</th>
            <th style="padding:10px 10px;text-align:center;font-size:.65rem;letter-spacing:2px;color:var(--color-text-muted)">DIFERENÇA</th>
            <th style="padding:10px 10px;text-align:center;font-size:.65rem;letter-spacing:2px;color:var(--color-text-muted)">AÇÃO</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════
// RESERVA DE PEÇA PARA OS
// ══════════════════════════════════════════════════════

function estReservarParaOS(pecaIdx) {
  const p = estoque[pecaIdx];
  if (!p) return;
  const qtdDisp = (parseFloat(p.qtd)||0) - (parseFloat(p.reservado)||0);
  if (qtdDisp <= 0) { mostrarErro('Sem quantidade disponível para reserva'); return; }

  const osAbertas = ordens.filter(o => o.status === 'aberta' || o.status === 'andamento');
  if (osAbertas.length === 0) { mostrarErro('Nenhuma OS aberta ou em andamento'); return; }

  const overlay = document.createElement('div');
  overlay.className = 'est-mov-overlay';
  overlay.id = 'est-reserva-overlay';
  overlay.innerHTML = `
    <div class="est-mov-box" style="width:420px">
      <div class="est-mov-titulo" style="color:#a78bfa">🔒 Reservar Peça para OS</div>
      <div style="font-size:.88rem;color:var(--color-text-primary);margin-bottom:6px;font-weight:600">${p.nome}</div>
      <div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:16px">Disponível: <b style="color:#60a5fa">${qtdDisp}</b> unidade(s)</div>
      <div class="est-mov-campo">
        <label>Ordem de Serviço</label>
        <select id="reserva-os-select">
          <option value="">Selecione uma OS...</option>
          ${osAbertas.map(os => `<option value="${os.id}">OS ${osNumeroFormatado(os.numero)} — ${os.cliente||'Sem nome'} (${os.veiculo||'—'})</option>`).join('')}
        </select>
      </div>
      <div class="est-mov-campo">
        <label>Quantidade a reservar</label>
        <input type="number" id="reserva-qtd" min="1" max="${qtdDisp}" step="1" value="1" style="font-family:'JetBrains Mono',monospace;color:#a78bfa"/>
      </div>
      <div class="modal-btns">
        <button class="btn-modal-cancel" onclick="document.getElementById('est-reserva-overlay').remove()">Cancelar</button>
        <button class="btn-modal-ok" onclick="estConfirmarReserva(${pecaIdx})">🔒 Reservar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function estConfirmarReserva(pecaIdx) {
  const osId = document.getElementById('reserva-os-select').value;
  const qtd = parseFloat(document.getElementById('reserva-qtd').value)||0;
  if (!osId) { mostrarErro('Selecione uma OS'); return; }
  if (qtd <= 0) { mostrarErro('Informe a quantidade'); return; }

  const p = estoque[pecaIdx];
  const qtdDisp = (parseFloat(p.qtd)||0) - (parseFloat(p.reservado)||0);
  if (qtd > qtdDisp) { mostrarErro('Quantidade maior que o disponível'); return; }

  const os = ordens.find(o => o.id === osId);
  if (!os) return;

  // Adicionar reserva na peça
  if (!p.reservas) p.reservas = [];
  p.reservas.push({ osId, osNum: os.numero, cliente: os.cliente||'—', qtd, data: hojeISO() });
  p.reservado = (parseFloat(p.reservado)||0) + qtd;

  // Adicionar peça na OS como item
  if (!os.itens) os.itens = [];
  os.itens.push({ desc: p.nome, cat: 'Peça', qtd: String(qtd), vunit: p.venda||'', obs: '🔒 Reservado do estoque' });
  os.total = osCalcTotal(os);

  await estSalvar();
  await salvarOS();
  document.getElementById('est-reserva-overlay').remove();
  mostrarToast(`✓ ${qtd}x "${p.nome}" reservado para OS ${osNumeroFormatado(os.numero)}`);
  renderEstoque();
}

// ══════════════════════════════════════════════════════
// FECHAMENTO DE CAIXA DIÁRIO
// ══════════════════════════════════════════════════════

function renderFechamentoCaixa() {
  const main = document.getElementById('mainContent');
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const hoje = hojeISO();
  const mesAtual = new Date().getMonth();
  const mes = dados[mesAtual];

  // Entradas do dia por forma de pagamento
  const entradasHoje = (mes.entradas||[]).filter(e => e.data === hoje);
  const saidasHoje = [...(mes.fixos||[]), ...(mes.variaveis||[])].filter(s => s.data === hoje);

  const totalEntradas = entradasHoje.reduce((s,e) => s + (parseFloat(e.valor)||0), 0);
  const totalSaidas = saidasHoje.reduce((s,e) => s + (parseFloat(e.valor)||0), 0);
  const saldo = totalEntradas - totalSaidas;

  // Agrupar por forma de pagamento
  const porForma = {};
  entradasHoje.forEach(e => {
    const forma = e.formaPgto || 'Não informado';
    if (!porForma[forma]) porForma[forma] = { total: 0, count: 0 };
    porForma[forma].total += parseFloat(e.valor)||0;
    porForma[forma].count++;
  });

  const FORMA_ICON = { 'Dinheiro':'💵', 'PIX':'📱', 'Crédito':'💳', 'Débito':'💳', 'Não informado':'❓' };

  const formasHTML = Object.entries(porForma).map(([forma, dados]) =>
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
    + '<span style="font-size:.82rem">' + (FORMA_ICON[forma]||'💰') + ' ' + forma + ' <span style="color:var(--color-text-muted);font-size:.7rem">(' + dados.count + ')</span></span>'
    + '<span style="font-size:.88rem;font-weight:700;color:#34d399;font-family:\'JetBrains Mono\',monospace">' + fmt(dados.total) + '</span>'
    + '</div>'
  ).join('') || '<div style="color:var(--color-text-muted);font-size:.78rem;text-align:center;padding:12px">Nenhuma entrada hoje</div>';

  const entradasRows = entradasHoje.map(e =>
    '<tr><td>' + (e.desc||'—') + '</td><td style="color:var(--color-text-muted);font-size:.72rem">' + (e.formaPgto||'—') + '</td><td style="color:#34d399;font-weight:700">' + fmt(e.valor||0) + '</td></tr>'
  ).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Nenhuma entrada</td></tr>';

  const saidasRows = saidasHoje.map(s =>
    '<tr><td>' + (s.desc||s.nome||'—') + '</td><td style="color:var(--color-text-muted);font-size:.72rem">' + (s.cat||'Fixo') + '</td><td style="color:#fca5a5;font-weight:700">' + fmt(s.valor||0) + '</td></tr>'
  ).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted)">Nenhuma saída</td></tr>';

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#fbbf24">🏦 Fechamento de Caixa</span>
      <div class="toolbar-right">
        <span style="font-size:.78rem;color:var(--color-text-muted)">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span>
        <button class="btn-voltar" onclick="sbIr(18)" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
      </div>
    </div>

    <!-- RESUMO DO DIA -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:12px;padding:16px 20px;text-align:center">
        <div style="font-size:.7rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:6px">💰 ENTRADAS HOJE</div>
        <div style="font-size:1.3rem;font-weight:700;color:#34d399;font-family:'JetBrains Mono',monospace">${fmt(totalEntradas)}</div>
      </div>
      <div style="background:rgba(252,165,165,.08);border:1px solid rgba(252,165,165,.2);border-radius:12px;padding:16px 20px;text-align:center">
        <div style="font-size:.7rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:6px">💸 SAÍDAS HOJE</div>
        <div style="font-size:1.3rem;font-weight:700;color:#fca5a5;font-family:'JetBrains Mono',monospace">${fmt(totalSaidas)}</div>
      </div>
      <div style="background:${saldo>=0?'rgba(167,139,250,.08)':'rgba(239,68,68,.08)'};border:1px solid ${saldo>=0?'rgba(167,139,250,.2)':'rgba(239,68,68,.2)'};border-radius:12px;padding:16px 20px;text-align:center">
        <div style="font-size:.7rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:6px">📊 SALDO DO DIA</div>
        <div style="font-size:1.3rem;font-weight:700;color:${saldo>=0?'#a78bfa':'#fca5a5'};font-family:'JetBrains Mono',monospace">${fmt(saldo)}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

      <!-- POR FORMA DE PAGAMENTO -->
      <div style="background:rgba(13,35,71,.6);border:1px solid rgba(251,191,36,.2);border-radius:14px;padding:16px 20px">
        <div style="font-family:'Inter';font-size:.85rem;letter-spacing:3px;color:#fbbf24;margin-bottom:12px">💳 POR FORMA DE PAGAMENTO</div>
        ${formasHTML}
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.78rem;color:var(--color-text-muted)">Total</span>
          <span style="font-size:1rem;font-weight:700;color:#34d399;font-family:'JetBrains Mono',monospace">${fmt(totalEntradas)}</span>
        </div>
      </div>

      <!-- DETALHES -->
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="background:rgba(13,35,71,.5);border:1px solid rgba(52,211,153,.15);border-radius:12px;padding:14px 16px">
          <div style="font-family:'Inter';font-size:.8rem;letter-spacing:2px;color:#34d399;margin-bottom:8px">↑ ENTRADAS</div>
          <table class="tabela-mobile" style="font-size:.78rem">
            <thead><tr><th>Descrição</th><th>Forma</th><th>Valor</th></tr></thead>
            <tbody>${entradasRows}</tbody>
          </table>
        </div>
        <div style="background:rgba(13,35,71,.5);border:1px solid rgba(252,165,165,.15);border-radius:12px;padding:14px 16px">
          <div style="font-family:'Inter';font-size:.8rem;letter-spacing:2px;color:#fca5a5;margin-bottom:8px">↓ SAÍDAS</div>
          <table class="tabela-mobile" style="font-size:.78rem">
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
            <tbody>${saidasRows}</tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// ══════════════════════════════════════════════════════
// APROVAÇÃO DE ORÇAMENTO VIA LINK
// ══════════════════════════════════════════════════════

function orcGerarLinkAprovacao(orcId) {
  const orc = orcamentos.find(o => o.id === orcId);
  if (!orc) return;
  // Link para o portal do cliente com parâmetro de aprovação
  const base = 'https://faculdadeunorte2025-web.github.io/ZLMOTOS-CLIENTES/';
  const link = base + '?aprovar=' + orcId + '&uid=' + (window._auth && window._auth.currentUser ? window._auth.currentUser.uid : '');
  navigator.clipboard.writeText(link).then(() => {
    mostrarToast('✓ Link copiado! Envie para o cliente aprovar.');
  }).catch(() => {
    prompt('Copie o link de aprovação:', link);
  });
}

async function orcProcessarAprovacao(orcId, decisao) {
  // Chamado pelo portal do cliente via parâmetro URL
  const orc = orcamentos.find(o => o.id === orcId);
  if (!orc) return;
  orc.status = decisao; // 'aceito' ou 'reprovado'
  orc.decisaoEm = new Date().toISOString();
  await salvarOrcamentos();
}

function orcVerificarAprovacaoURL() {
  const params = new URLSearchParams(window.location.search);
  const aprovar = params.get('aprovar');
  const decisao = params.get('decisao');
  if (aprovar && decisao) {
    orcProcessarAprovacao(aprovar, decisao).then(() => {
      mostrarToast(decisao === 'aceito' ? '✓ Orçamento aprovado pelo cliente!' : '✕ Orçamento recusado pelo cliente');
    });
  }
}

// ══════════════════════════════════════════════════════
// CLIENTES
// ══════════════════════════════════════════════════════

let clientesCadastradosManuais = [];
let clienteDetalhe = null; // id do cliente em detalhe
let clienteModalAberto = false;
let clienteEditandoId = null;

// ── Pontuação fidelidade ──────────────────────────────
const PONTOS_POR_OS = 10;
function fidelidadeCalcularPontos(nome) {
  return ordens.filter(o =>
    (o.status==='concluida'||o.status==='entregue') &&
    (o.cliente||'').toLowerCase().trim() === nome.toLowerCase().trim()
  ).length * PONTOS_POR_OS;
}
function fidelidadeBadge(pontos) {
  if (pontos >= 500) return { label:'Diamante', cor:'#67e8f9', icon:'💎', next: null,     prox: 0,   beneficio:'15% de desconto em peças' };
  if (pontos >= 200) return { label:'Platinum',  cor:'#e2e8f0', icon:'🏆', next: 500,    prox: 500-pontos, beneficio:'10% de desconto em peças' };
  if (pontos >= 100) return { label:'Ouro',      cor:'#fbbf24', icon:'⭐', next: 200,    prox: 200-pontos, beneficio:'5% de desconto em serviços' };
  if (pontos >= 50)  return { label:'Prata',     cor:'#94a3b8', icon:'🥈', next: 100,    prox: 100-pontos, beneficio:'Prioridade no agendamento' };
  return               { label:'Bronze',     cor:'#b87333', icon:'🥉', next: 50,     prox: 50-pontos,  beneficio:'Acesso ao programa de fidelidade' };
}
function fidelidadeBadgeHTML(pontos) {
  const b = fidelidadeBadge(pontos);
  return `<span style="font-size:.65rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:1px 6px;color:${b.cor}">${b.icon} ${b.label} · ${pontos}pts</span>`;
}
function fidelidadeProgressoHTML(pontos) {
  const b = fidelidadeBadge(pontos);
  if (!b.next) return `<div style="font-size:.72rem;color:${b.cor};text-align:center">${b.icon} Nível máximo! ${b.beneficio}</div>`;
  const pct = Math.min(100, Math.round(((pontos-(b.next-b.prox-b.prox))/b.prox)*100));
  const pctReal = Math.round((pontos / b.next) * 100);
  return `<div style="font-size:.68rem;color:var(--color-text-muted);margin-bottom:4px">${b.icon} ${b.label} · <b style="color:${b.cor}">${pontos} pts</b> · Faltam <b>${b.prox}</b> pts para ${fidelidadeBadge(b.next).label}</div>
    <div style="height:5px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden">
      <div style="height:100%;width:${Math.min(100,pctReal)}%;background:${b.cor};border-radius:999px"></div>
    </div>
    <div style="font-size:.62rem;color:var(--color-text-muted);margin-top:2px">${b.beneficio}</div>`;
}

// ── Carregar / Salvar ────────────────────────────────
async function carregarClientesManuais() {
  try {
    if (window._firestoreGetDocs && window._userCollection) {
      const col  = window._userCollection('clientes');
      const snap = await window._firestoreGetDocs(col);
      if (!snap.empty) {
        clientesCadastradosManuais = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return;
      }
      // Migração legado
      try {
        const ref  = window._userDoc('clientes_manuais');
        const sn2  = await window._firestoreGetDoc(ref);
        if (sn2 && sn2.exists && sn2.exists()) {
          const lista = sn2.data().lista || [];
          clientesCadastradosManuais = lista;
          for (const cli of lista) {
            const docRef = window._userCollectionDoc('clientes', cli.id || ('cli_'+Date.now()+Math.random()));
            await window._firestoreSetDoc(docRef, cli);
          }
        }
      } catch(e2) {}
    }
  } catch(e) { console.warn('Erro ao carregar clientes:', e); }
}

async function salvarCliente(cli) {
  try {
    if (window._firestoreSetDoc && window._userCollectionDoc) {
      const ref = window._userCollectionDoc('clientes', cli.id);
      await window._firestoreSetDoc(ref, cli);
    }
  } catch(e) { console.warn('Erro ao salvar cliente:', e); }
}

async function deletarCliente(id) {
  try {
    if (window._firestoreDeleteDoc && window._userCollectionDoc) {
      const ref = window._userCollectionDoc('clientes', id);
      await window._firestoreDeleteDoc(ref);
    }
  } catch(e) { console.warn('Erro ao deletar cliente:', e); }
}

// ── Modal de cadastro / edição ───────────────────────
function clienteAbrirModal(id) {
  clienteEditandoId = id || null;
  clienteModalAberto = true;
  renderClientes();
}

function clienteFecharModal() {
  clienteModalAberto = false;
  clienteEditandoId = null;
  renderClientes();
}

async function clienteSalvarModal() {
  const nome       = (document.getElementById('cli-nome')?.value      || '').trim();
  const tel        = (document.getElementById('cli-tel')?.value       || '').trim();
  const cpf        = (document.getElementById('cli-cpf')?.value       || '').trim();
  const veic       = (document.getElementById('cli-veic')?.value      || '').trim();
  const placa      = (document.getElementById('cli-placa')?.value     || '').trim().toUpperCase();
  const email      = (document.getElementById('cli-email')?.value     || '').trim();
  const obs        = (document.getElementById('cli-obs')?.value       || '').trim();
  const endereco   = (document.getElementById('cli-endereco')?.value  || '').trim();
  const nascimento = (document.getElementById('cli-nasc')?.value      || '').trim();

  if (!nome) { mostrarToast('Informe o nome do cliente'); return; }

  if (clienteEditandoId) {
    const idx = clientesCadastradosManuais.findIndex(c => c.id === clienteEditandoId);
    if (idx >= 0) {
      clientesCadastradosManuais[idx] = { ...clientesCadastradosManuais[idx], nome, tel, cpf, veic, placa, email, obs, endereco, nascimento };
      await salvarCliente(clientesCadastradosManuais[idx]);
      mostrarToast('✓ Cliente atualizado');
    }
  } else {
    const existe = clientesCadastradosManuais.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    if (existe) { mostrarToast('Cliente já cadastrado'); return; }
    const id  = 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
    const cli = { id, nome, tel, cpf, veic, placa, email, obs, endereco, nascimento, criadoEm: new Date().toISOString() };
    clientesCadastradosManuais.push(cli);
    await salvarCliente(cli);
    mostrarToast('✓ Cliente cadastrado');
  }

  clienteFecharModal();
}

async function clienteExcluirSemId(nome) {
  confirmarExclusao('o cliente "' + nome + '"', async () => {
    // Cadastra rapidamente e já exclui
    const id = 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
    const cli = { id, nome, tel:'', cpf:'', veic:'', placa:'', email:'', obs:'', criadoEm: new Date().toISOString(), excluido: true };
    clientesCadastradosManuais.push(cli);
    await salvarCliente(cli);
    await deletarCliente(id);
    clientesCadastradosManuais = clientesCadastradosManuais.filter(c => c.id !== id);
    mostrarToast('✓ Cliente removido');
    renderClientes();
  });
}

async function clienteExcluir(id) {
  confirmarExclusao('este cliente', async () => {
    clientesCadastradosManuais = clientesCadastradosManuais.filter(c => c.id !== id);
    await deletarCliente(id);
    if (clienteDetalhe === id) clienteDetalhe = null;
    mostrarToast('✓ Cliente removido');
    renderClientes();
  });
}

// ── Modal HTML ───────────────────────────────────────
function clienteModalHTML() {
  const cli = clienteEditandoId ? clientesCadastradosManuais.find(c => c.id === clienteEditandoId) : null;
  const titulo = cli ? '✏️ Editar Cliente' : '+ Novo Cliente';

  return `<div onclick="if(event.target===this)clienteFecharModal()"
    style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px">
    <div onclick="event.stopPropagation()" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div style="font-size:.9rem;font-weight:700;color:var(--color-text-primary)">${titulo}</div>
        <button onclick="clienteFecharModal()" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="orc-field"><label>👤 Nome *</label>
          <input id="cli-nome" type="text" placeholder="Nome completo" value="${cli?.nome||''}" style="text-transform:capitalize"/>
        </div>
        <div style="display:flex;gap:10px">
          <div class="orc-field" style="flex:1"><label>📞 Telefone</label>
            <input id="cli-tel" type="text" placeholder="(17) 99999-9999" value="${cli?.tel||''}"/>
          </div>
          <div class="orc-field" style="flex:1"><label>🪪 CPF/CNPJ</label>
            <input id="cli-cpf" type="text" placeholder="000.000.000-00" value="${cli?.cpf||''}"/>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <div class="orc-field" style="flex:1"><label>🏍️ Veículo</label>
            <input id="cli-veic" type="text" placeholder="Ex: Honda CG 160" value="${cli?.veic||''}"/>
          </div>
          <div class="orc-field" style="width:130px"><label>🔖 Placa</label>
            <input id="cli-placa" type="text" placeholder="ABC-1234" maxlength="8" value="${cli?.placa||''}" style="text-transform:uppercase;font-family:'JetBrains Mono',monospace"/>
          </div>
        </div>
        <div class="orc-field"><label>✉️ E-mail</label>
          <input id="cli-email" type="email" placeholder="email@exemplo.com" value="${cli?.email||''}"/>
        </div>
        <div class="orc-field"><label>🎂 Data de Nascimento</label>
          <input id="cli-nasc" type="date" value="${cli?.nascimento||''}"/>
        </div>
        <div class="orc-field"><label>📍 Endereço</label>
          <input id="cli-endereco" type="text" placeholder="Rua, número, bairro, cidade..." value="${cli?.endereco||''}"/>
        </div>
        <div class="orc-field"><label>📝 Observações</label>
          <textarea id="cli-obs" placeholder="Anotações sobre o cliente..." style="height:60px;resize:vertical">${cli?.obs||''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button onclick="clienteFecharModal()" style="flex:1;padding:10px;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;cursor:pointer;font-size:.85rem">Cancelar</button>
        <button onclick="clienteSalvarModal()" style="flex:2;padding:10px;background:var(--color-primary);border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700">💾 Salvar</button>
      </div>
    </div>
  </div>`;
}

// ── Render principal ─────────────────────────────────