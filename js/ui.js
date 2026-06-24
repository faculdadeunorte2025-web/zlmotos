function renderAll() {
  renderTabs();
  // C12 — atualizar bottom nav mobile
  ['dash','os','orc','cli','est'].forEach(id => {
    const el = document.getElementById('bn-'+id);
    if (el) el.classList.remove('ativo');
  });
  const bnMap = {18:'dash',15:'os',13:'orc',20:'cli',14:'est'};
  const bnEl = document.getElementById('bn-'+(bnMap[abaAtiva]||''));
  if (bnEl) bnEl.classList.add('ativo');
  if (abaAtiva===12) renderAnual();
  else if (abaAtiva===13) renderOrcamento();
  else if (abaAtiva===14) renderEstoque();
  else if (abaAtiva===15) renderOS();
  else if (abaAtiva===16) renderConfiguracoes();
  else if (abaAtiva===17) renderAgendamentos();
  else if (abaAtiva===18) renderDashboard();
  else if (abaAtiva===20) renderClientes();
  else if (abaAtiva===21) renderContador();
  else if (abaAtiva===22) renderFilaMotos();
  else if (abaAtiva===23) renderAreaMecanico();
  else if (abaAtiva===99) renderBuscaGlobal();
  else renderMes(abaAtiva);
}


// ═══════════════════════════════════════════
// BUSCA GLOBAL
// ═══════════════════════════════════════════
let _buscaGlobalTermo = '';

function abrirBuscaGlobal() {
  abaAtiva = 99;
  _buscaGlobalTermo = '';
  renderAll();
  setTimeout(() => {
    const inp = document.getElementById('busca-global-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 60);
  if (window.innerWidth <= 900) fecharSidebar();
}

function executarBuscaGlobal() {
  const inp = document.getElementById('busca-global-input');
  if (inp) _buscaGlobalTermo = inp.value;
  renderBuscaGlobal(true);
}

function renderBuscaGlobal(manterFoco) {
  const main = document.getElementById('mainContent');
  const q = (_buscaGlobalTermo || '').toLowerCase().trim();
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  let resultados = [];

  if (q.length >= 2) {
    // ── OS ──
    ordens.forEach(os => {
      const campos = [
        osNumeroFormatado(os.numero),
        os.cliente, os.veiculo, os.placa,
        os.tipoServico, os.obs, os.status
      ].map(c => (c||'').toLowerCase()).join(' ');
      if (campos.includes(q)) {
        resultados.push({
          tipo: 'OS', icon: '🔧',
          titulo: 'OS ' + osNumeroFormatado(os.numero) + ' — ' + (os.cliente||'—'),
          sub: (os.veiculo||'') + (os.placa ? ' · ' + os.placa : '') + ' · ' + (os.tipoServico||'—'),
          badge: os.status,
          badgeCor: os.status==='concluida'?'#34d399':os.status==='andamento'?'#fbbf24':'#60a5fa',
          valor: os.total ? fmt(os.total) : '',
          acao: () => { osAberta = os.id; sbIr(15); }
        });
      }
    });

    // ── ORÇAMENTOS ──
    orcamentos.forEach(orc => {
      const campos = [
        orc.cliente, orc.veiculo, orc.placa,
        orc.telefone, orc.obs,
        ...(orc.itens||[]).map(it => it.desc||'')
      ].map(c => (c||'').toLowerCase()).join(' ');
      if (campos.includes(q)) {
        const calc = (() => {
          const total = (orc.itens||[]).reduce((s,it)=>s+(parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0),0);
          return total;
        })();
        resultados.push({
          tipo: 'Orçamento', icon: '📋',
          titulo: (orc.cliente||'Sem nome') + (orc.veiculo ? ' — ' + orc.veiculo : ''),
          sub: (orc.placa ? 'Placa: ' + orc.placa + ' · ' : '') + (orc.data ? new Date(orc.data+'T12:00:00').toLocaleDateString('pt-BR') : ''),
          badge: orc.status||'pendente',
          badgeCor: (orc.status||'pendente')==='aprovado'?'#34d399':(orc.status)==='recusado'?'#fca5a5':'#fbbf24',
          valor: calc ? fmt(calc) : '',
          acao: () => {
            orcAtual = Object.assign({}, orc);
            orcModoFormulario = true;
            sbIr(13);
          }
        });
      }
    });

    // ── CLIENTES ──
    (clientesCadastradosManuais||[]).forEach(c => {
      const campos = [c.nome, c.telefone, c.veiculo, c.placa, c.email, c.obs]
        .map(x=>(x||'').toLowerCase()).join(' ');
      if (campos.includes(q)) {
        resultados.push({
          tipo: 'Cliente', icon: '👤',
          titulo: c.nome||'—',
          sub: [(c.telefone||''), (c.veiculo||''), (c.placa||'')].filter(Boolean).join(' · '),
          badge: '', badgeCor: '',
          valor: '',
          acao: () => { sbIr(20); }
        });
      }
    });

    // ── AGENDAMENTOS ──
    agendamentos.forEach(ag => {
      const campos = [ag.cliente, ag.veiculo, ag.placa, ag.tipo, ag.obs, ag.telefone]
        .map(x=>(x||'').toLowerCase()).join(' ');
      if (campos.includes(q)) {
        const s = AG_STATUS[ag.status] || AG_STATUS['agendado'];
        resultados.push({
          tipo: 'Agendamento', icon: '📅',
          titulo: (ag.cliente||'Sem nome') + ' — ' + (ag.tipo||'—'),
          sub: (ag.data ? new Date(ag.data+'T12:00:00').toLocaleDateString('pt-BR') : '—') + (ag.hora ? ' às ' + ag.hora : '') + (ag.veiculo ? ' · ' + ag.veiculo : ''),
          badge: s.txt, badgeCor: s.cor,
          valor: '',
          acao: () => { agModalAberto = ag.id; sbIr(17); }
        });
      }
    });

    // ── ESTOQUE ──
    (typeof estoque !== 'undefined' ? estoque : []).forEach((p, i) => {
      const campos = [p.nome, p.categoria, p.obs]
        .map(x=>(x||'').toLowerCase()).join(' ');
      if (campos.includes(q)) {
        const qtd = parseFloat(p.qtd)||0;
        const critico = qtd === 0 || (qtd <= (parseFloat(p.minimo)||0) && (parseFloat(p.minimo)||0)>0);
        resultados.push({
          tipo: 'Estoque', icon: '📦',
          titulo: p.nome||'—',
          sub: 'Qtd: ' + qtd + (p.categoria ? ' · ' + p.categoria : '') + (p.venda ? ' · Venda: ' + fmt(p.venda) : ''),
          badge: critico ? 'crítico' : 'ok',
          badgeCor: critico ? '#fca5a5' : '#34d399',
          valor: p.custo ? fmt(p.custo) : '',
          acao: () => { sbIr(14); }
        });
      }
    });
  }

  // ── HTML ──────────────────────────────────────────────
  const grupos = ['OS','Orçamento','Cliente','Agendamento','Estoque'];
  const iconeGrupo = { OS:'🔧', 'Orçamento':'📋', Cliente:'👤', Agendamento:'📅', Estoque:'📦' };

  let listaHTML = '';
  if (q.length < 2) {
    listaHTML = '<div style="text-align:center;padding:48px 0;color:var(--color-text-muted)">'
      + '<div style="font-size:2.5rem;margin-bottom:12px">🔍</div>'
      + '<div style="font-size:.9rem">Digite pelo menos 2 caracteres para buscar</div>'
      + '<div style="font-size:.75rem;margin-top:8px;opacity:.6">Busca em OS, Orçamentos, Clientes, Agendamentos e Estoque</div>'
      + '</div>';
  } else if (resultados.length === 0) {
    listaHTML = '<div style="text-align:center;padding:48px 0;color:var(--color-text-muted)">'
      + '<div style="font-size:2.5rem;margin-bottom:12px">😶</div>'
      + '<div style="font-size:.9rem">Nenhum resultado para <b style="color:var(--color-text-primary)">"' + _buscaGlobalTermo + '"</b></div>'
      + '</div>';
  } else {
    grupos.forEach(grupo => {
      const itens = resultados.filter(r => r.tipo === grupo);
      if (!itens.length) return;
      listaHTML += '<div style="font-size:.65rem;letter-spacing:2px;color:var(--color-text-muted);margin:16px 0 8px;font-weight:700">'
        + iconeGrupo[grupo] + ' ' + grupo.toUpperCase() + 'S (' + itens.length + ')</div>';
      itens.forEach((r, idx) => {
        listaHTML += '<div onclick="(_buscaAcoes[' + resultados.indexOf(r) + '])()" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:#111114;margin-bottom:6px;transition:all .15s" onmouseover="this.style.background=\'rgba(255,255,255,.05)\';this.style.borderColor=\'rgba(255,255,255,.12)\'" onmouseout="this.style.background=\'#111114\';this.style.borderColor=\'rgba(255,255,255,.06)\'">'
          + '<div style="font-size:1.2rem;flex-shrink:0">' + r.icon + '</div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:.85rem;font-weight:600;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + r.titulo + '</div>'
          + '<div style="font-size:.72rem;color:var(--color-text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + r.sub + '</div>'
          + '</div>'
          + (r.badge ? '<span style="font-size:.65rem;background:' + r.badgeCor + '22;border:1px solid ' + r.badgeCor + '55;color:' + r.badgeCor + ';border-radius:6px;padding:2px 8px;white-space:nowrap;flex-shrink:0">' + r.badge + '</span>' : '')
          + (r.valor ? '<span style="font-size:.8rem;font-weight:700;color:#34d399;font-family:\'JetBrains Mono\',monospace;flex-shrink:0">' + r.valor + '</span>' : '')
          + '<span style="color:var(--color-text-muted);font-size:.75rem;flex-shrink:0">→</span>'
          + '</div>';
      });
    });
  }

  // Guarda ações indexadas para evitar problema com onclick inline e closures
  window._buscaAcoes = resultados.map(r => r.acao);

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-size:1.1rem;font-weight:700;letter-spacing:2px;color:var(--color-text-primary)">🔍 Busca Global</span>
      <div class="toolbar-right">
        <span style="font-size:.72rem;color:var(--color-text-muted)">${resultados.length > 0 ? resultados.length + ' resultado(s)' : ''}</span>
      </div>
    </div>

    <!-- Campo de busca -->
    <div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:1.1rem;pointer-events:none">🔍</div>
      <input id="busca-global-input"
        type="text"
        value="${_buscaGlobalTermo.replace(/"/g,'&quot;')}"
        placeholder="Buscar por nome, placa, número de OS, veículo..."
        oninput="_buscaGlobalTermo=this.value;renderBuscaGlobal(true)"
        style="width:100%;background:#18181c;border:1px solid rgba(200,16,46,0.3);color:var(--color-text-primary);
          border-radius:14px;padding:14px 16px 14px 46px;font-size:1rem;
          outline:none;transition:border-color .2s;box-shadow:0 0 0 0 rgba(200,16,46,0)"
        onfocus="this.style.borderColor='rgba(200,16,46,0.6)';this.style.boxShadow='0 0 0 3px rgba(200,16,46,0.12)'"
        onblur="this.style.borderColor='rgba(200,16,46,0.3)';this.style.boxShadow='none'"
      />
      ${_buscaGlobalTermo ? '<button onclick="_buscaGlobalTermo=\'\';renderBuscaGlobal(true)" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--color-text-muted);font-size:1.1rem;cursor:pointer;padding:4px">✕</button>' : ''}
    </div>

    <!-- Resultados -->
    <div>${listaHTML}</div>
  `;

  if (manterFoco) {
    const inp = document.getElementById('busca-global-input');
    if (inp) { const len = inp.value.length; inp.setSelectionRange(len,len); inp.focus(); }
  }
}

// ── I14 — Atalhos de teclado expandidos ─────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const digitando = ['INPUT','TEXTAREA','SELECT'].includes(tag);

  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); abrirBuscaGlobal(); return; }
  if (e.key === 'Escape') {
    if (abaAtiva === 99) sbIr(18);
    document.querySelectorAll('.confirm-overlay,.modal-overlay,[id$="-modal"]').forEach(el => el.remove());
    return;
  }
  if (digitando) return; // não capturar atalhos enquanto digita

  // Navegação por número
  const navMap = {'1':18,'2':15,'3':13,'4':14,'5':20,'6':17,'7':21};
  if (navMap[e.key] && !e.ctrlKey && !e.metaKey) { sbIr(parseInt(navMap[e.key])); renderAll(); return; }

  // Atalhos de ação
  if (e.key === 'n' || e.key === 'N') { // Nova OS / Novo item
    if (abaAtiva===13) { orcNovoOrcamento(); return; }
    if (abaAtiva===20) { clienteAbrirModal(); return; }
  }
  if (e.key === 'f' || e.key === 'F') { abrirBuscaGlobal(); return; }
  if (e.key === 'd' || e.key === 'D') { sbIr(18); renderAll(); return; } // Dashboard
  if (e.key === 'o' || e.key === 'O') { sbIr(15); renderAll(); return; } // OS
  if (e.key === 'c' || e.key === 'C') { sbIr(20); renderAll(); return; } // Clientes
  if (e.key === 'e' || e.key === 'E') { sbIr(14); renderAll(); return; } // Estoque
  if (e.key === 'a' || e.key === 'A') { sbIr(17); renderAll(); return; } // Agenda
});

// ═══════════════════════════════════════════
// CONTADOR — Relatório para contador
// ═══════════════════════════════════════════
let contadorAba = 'resumo';
let contadorMesInicio = 0;
let contadorMesFim = 11;

function renderContador() {
  const main = document.getElementById('mainContent');
  const ano = document.getElementById('anoGlobal') ? document.getElementById('anoGlobal').value : '2025';
  const MESES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function calcPeriodo(ini, fim) {
    let totalEntradas=0, totalFixos=0, totalVar=0, totalSaidas=0;
    let formaPgto = {'Dinheiro':0,'PIX':0,'Crédito':0,'Débito':0,'Não informado':0};
    let entradasDetalhe=[], saidasFixasDetalhe={}, saidasVarDetalhe={}, porMes=[];
    for (let m=ini; m<=fim; m++) {
      const c = calcularMes(m);
      const mes = dados[m] || {fixos:[],variaveis:[],entradas:[]};
      totalEntradas+=c.totalBruto; totalFixos+=c.totalFixos; totalVar+=c.totalVar; totalSaidas+=c.totalSaidas;
      porMes.push({mes:MESES_FULL[m],...c});
      (mes.entradas||[]).forEach(e => {
        const fp = e.formaPgto||'Não informado';
        if(formaPgto[fp]===undefined) formaPgto[fp]=0;
        formaPgto[fp]+=num(e.valor);
        entradasDetalhe.push({mes:MESES_NOMES[m],desc:e.desc||'—',valor:num(e.valor),forma:fp,data:e.data||''});
      });
      (mes.fixos||[]).forEach(f => {
        if(!num(f.valor)) return;
        if(!saidasFixasDetalhe[f.nome]) saidasFixasDetalhe[f.nome]=0;
        saidasFixasDetalhe[f.nome]+=num(f.valor);
      });
      (mes.variaveis||[]).forEach(v => {
        if(!num(v.valor)) return;
        const cat=v.categoria||v.cat||'Outros';
        if(!saidasVarDetalhe[cat]) saidasVarDetalhe[cat]=0;
        saidasVarDetalhe[cat]+=num(v.valor);
      });
    }
    return {totalEntradas,totalFixos,totalVar,totalSaidas,totalLiquido:totalEntradas-totalSaidas,
            formaPgto,entradasDetalhe,saidasFixasDetalhe,saidasVarDetalhe,porMes};
  }

  function calcOS() {
    const osData = (typeof ordens!=='undefined' ? ordens : []);
    let totalOS=0, totalPecas=0, totalServicos=0, osLista=[];
    osData.filter(o=>o.status==='concluida'||o.status==='entregue').forEach(o => {
      const total=osCalcTotal(o); let pecas=0,servicos=0;
      (o.itens||[]).forEach(it => {
        const v=(num(it.qtd)||1)*num(it.vunit);
        if(it.cat==='Peça'||it._estoqueNome) pecas+=v; else servicos+=v;
      });
      totalOS+=total; totalPecas+=pecas; totalServicos+=servicos;
      osLista.push({id:o.id,cliente:o.cliente||'—',total,pecas,servicos,mecanico:(o.mecanicos||[]).join(', ')||'—'});
    });
    return {totalOS,totalPecas,totalServicos,osLista};
  }

  const p = calcPeriodo(contadorMesInicio, contadorMesFim);
  const os = calcOS();
  const periodoStr = contadorMesInicio===contadorMesFim
    ? MESES_FULL[contadorMesInicio]+'/'+ano
    : MESES_NOMES[contadorMesInicio]+' – '+MESES_NOMES[contadorMesFim]+'/'+ano;

  function seletorPeriodo() {
    let h='<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:18px">';
    h+='<span style="font-size:.78rem;color:var(--color-text-muted);letter-spacing:1px">PERÍODO:</span>';
    [['Jan a Jun',0,5],['Jul a Dez',6,11],['Ano completo',0,11]].forEach(([label,ini,fim])=>{
      const at=contadorMesInicio===ini&&contadorMesFim===fim;
      h+=`<button onclick="contadorMesInicio=${ini};contadorMesFim=${fim};renderContador()" style="padding:4px 12px;border-radius:6px;border:1px solid ${at?'var(--color-primary)':'var(--color-border)'};background:${at?'rgba(59,130,246,.15)':'transparent'};color:${at?'var(--color-primary-hover)':'var(--color-text-muted)'};font-size:.72rem;cursor:pointer">${label}</button>`;
    });
    h+='<span style="font-size:.78rem;color:var(--color-text-muted);margin-left:4px">ou:</span>';
    h+='<select onchange="contadorMesInicio=parseInt(this.value);if(contadorMesInicio>contadorMesFim)contadorMesFim=contadorMesInicio;renderContador()" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:6px;padding:4px 8px;font-size:.72rem">';
    for(let i=0;i<12;i++) h+=`<option value="${i}" ${contadorMesInicio===i?'selected':''}>${MESES_NOMES[i]}</option>`;
    h+='</select><span style="color:var(--color-text-muted);font-size:.8rem">até</span>';
    h+='<select onchange="contadorMesFim=parseInt(this.value);if(contadorMesFim<contadorMesInicio)contadorMesInicio=contadorMesFim;renderContador()" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:6px;padding:4px 8px;font-size:.72rem">';
    for(let i=0;i<12;i++) h+=`<option value="${i}" ${contadorMesFim===i?'selected':''}>${MESES_NOMES[i]}</option>`;
    h+='</select></div>'; return h;
  }

  function subabas() {
    const tabs=[['resumo','📊 Resumo'],['entradas','💰 Entradas'],['saidas','📉 Saídas'],['servicos','🔧 Serviços']];
    let h='<div style="display:flex;gap:0;border-bottom:1px solid var(--color-border);margin-bottom:20px">';
    tabs.forEach(([id,label])=>{
      const at=contadorAba===id;
      h+=`<button onclick="contadorAba='${id}';renderContador()" style="padding:10px 18px;border:none;border-bottom:2px solid ${at?'var(--color-primary)':'transparent'};background:transparent;color:${at?'var(--color-primary-hover)':'var(--color-text-muted)'};font-size:.82rem;font-weight:${at?'600':'400'};cursor:pointer;transition:all .15s">${label}</button>`;
    });
    h+='</div>'; return h;
  }

  function card(label,valor,cor,sub) {
    return `<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:16px 20px;flex:1;min-width:150px">
      <div style="font-size:.72rem;color:var(--color-text-muted);letter-spacing:2px;margin-bottom:6px">${label}</div>
      <div style="font-size:1.4rem;font-weight:700;color:${cor};font-family:'JetBrains Mono',monospace">${fmt(valor)}</div>
      ${sub?`<div style="font-size:.72rem;color:var(--color-text-muted);margin-top:4px">${sub}</div>`:''}
    </div>`;
  }

  function tr(cols,header) {
    const s=header?'background:rgba(255,255,255,.04);font-size:.72rem;letter-spacing:1px;color:var(--color-text-muted)':'border-bottom:1px solid rgba(255,255,255,.04);font-size:.82rem';
    return `<tr style="${s}">${cols.map((c,i)=>`<td style="padding:8px 12px;${i>0?'text-align:right':''}">${c}</td>`).join('')}</tr>`;
  }

  function abaResumo() {
    const lc=p.totalLiquido>=0?'var(--verde)':'var(--vermelho)';
    let h=`<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px">
      ${card('TOTAL ENTRADAS',p.totalEntradas,'var(--verde)','Receitas do período')}
      ${card('TOTAL SAÍDAS',p.totalSaidas,'#f87171',`Fixas: ${fmt(p.totalFixos)} | Var: ${fmt(p.totalVar)}`)}
      ${card('RESULTADO LÍQUIDO',p.totalLiquido,lc,p.totalLiquido>=0?'Lucro':'Prejuízo')}
    </div>`;
    h+=`<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden;margin-bottom:20px">
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);font-size:.78rem;letter-spacing:3px;color:var(--dourado,#f59e0b)">DRE SIMPLIFICADO — ${periodoStr.toUpperCase()}</div>
      <table style="width:100%;border-collapse:collapse">
        ${tr(['RECEITAS (ENTRADAS)',''],true)}
        ${tr(['Entradas registradas',fmt(p.totalEntradas)])}`;
    Object.entries(p.formaPgto).forEach(([f,v])=>{if(v>0)h+=tr([`  └ ${f}`,fmt(v)]);});
    h+=`${tr(['DESPESAS (SAÍDAS)',''],true)}${tr(['Despesas Fixas',fmt(p.totalFixos)])}`;
    Object.entries(p.saidasFixasDetalhe).forEach(([n,v])=>{if(v>0)h+=tr([`  └ ${n}`,fmt(v)]);});
    h+=`${tr(['Despesas Variáveis',fmt(p.totalVar)])}`;
    Object.entries(p.saidasVarDetalhe).forEach(([c,v])=>{if(v>0)h+=tr([`  └ ${c}`,fmt(v)]);});
    h+=`<tr style="background:rgba(255,255,255,.06);font-weight:700;font-size:.9rem">
        <td style="padding:12px 20px">RESULTADO LÍQUIDO</td>
        <td style="padding:12px 20px;text-align:right;color:${lc}">${fmt(p.totalLiquido)}</td>
      </tr></table></div>`;
    h+=`<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);font-size:.78rem;letter-spacing:2px;color:var(--color-text-muted)">RECEBIMENTOS POR FORMA DE PAGAMENTO</div>
      <table style="width:100%;border-collapse:collapse">${tr(['Forma','Total','% do Total'],true)}`;
    const icons={'Dinheiro':'💵','PIX':'📱','Crédito':'💳','Débito':'💳','Não informado':'❓'};
    Object.entries(p.formaPgto).forEach(([f,v])=>{
      if(v>0){const pct=p.totalEntradas>0?((v/p.totalEntradas)*100).toFixed(1)+'%':'—';
        h+=`<tr style="border-bottom:1px solid rgba(255,255,255,.04)"><td style="padding:8px 12px">${icons[f]||'💰'} ${f}</td><td style="padding:8px 12px;text-align:right;color:var(--verde)">${fmt(v)}</td><td style="padding:8px 12px;text-align:right;color:var(--color-text-muted)">${pct}</td></tr>`;}
    });
    h+=`</table></div>`; return h;
  }

  function abaEntradas() {
    let h=`<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);font-size:.78rem;letter-spacing:2px;color:var(--color-text-muted)">ENTRADAS DETALHADAS — ${periodoStr.toUpperCase()}</div>
      <table style="width:100%;border-collapse:collapse">${tr(['Mês','Descrição','Forma','Valor'],true)}`;
    const icons={'Dinheiro':'💵','PIX':'📱','Crédito':'💳','Débito':'💳','Não informado':'❓'};
    p.entradasDetalhe.forEach(e=>{
      h+=`<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
        <td style="padding:7px 12px;font-size:.75rem;color:var(--color-text-muted)">${e.mes}</td>
        <td style="padding:7px 12px">${e.desc}</td>
        <td style="padding:7px 12px;font-size:.75rem">${icons[e.forma]||'💰'} ${e.forma}</td>
        <td style="padding:7px 12px;text-align:right;color:var(--verde);font-family:'JetBrains Mono',monospace">${fmt(e.valor)}</td></tr>`;
    });
    if(!p.entradasDetalhe.length) h+=`<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--color-text-muted)">Nenhuma entrada registrada neste período</td></tr>`;
    h+=`<tr style="background:rgba(255,255,255,.05);font-weight:700"><td colspan="3" style="padding:10px 12px">TOTAL</td><td style="padding:10px 12px;text-align:right;color:var(--verde);font-family:'JetBrains Mono',monospace">${fmt(p.totalEntradas)}</td></tr></table></div>`;
    h+=`<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden;margin-top:16px">
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);font-size:.78rem;letter-spacing:2px;color:var(--color-text-muted)">ENTRADAS POR MÊS</div>
      <table style="width:100%;border-collapse:collapse">${tr(['Mês','Entradas','Saídas','Líquido'],true)}`;
    p.porMes.forEach(m=>{const cor=m.totalLiquido>=0?'var(--verde)':'var(--vermelho)';
      h+=`<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
        <td style="padding:7px 12px">${m.mes}</td>
        <td style="padding:7px 12px;text-align:right;color:var(--verde)">${fmt(m.totalBruto)}</td>
        <td style="padding:7px 12px;text-align:right;color:#f87171">${fmt(m.totalSaidas)}</td>
        <td style="padding:7px 12px;text-align:right;color:${cor};font-weight:600">${fmt(m.totalLiquido)}</td></tr>`;
    });
    h+=`</table></div>`; return h;
  }

  function abaSaidas() {
    let h=`<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      ${card('DESPESAS FIXAS',p.totalFixos,'#f87171',Object.keys(p.saidasFixasDetalhe).length+' categorias')}
      ${card('DESPESAS VARIÁVEIS',p.totalVar,'#fb923c',Object.keys(p.saidasVarDetalhe).length+' categorias')}
      ${card('TOTAL DESPESAS',p.totalSaidas,'#f87171','')}
    </div>`;
    h+=`<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden;margin-bottom:16px">
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);font-size:.78rem;letter-spacing:2px;color:var(--color-text-muted)">DESPESAS FIXAS</div>
      <table style="width:100%;border-collapse:collapse">${tr(['Categoria','Total','% das Despesas'],true)}`;
    Object.entries(p.saidasFixasDetalhe).sort((a,b)=>b[1]-a[1]).forEach(([n,v])=>{
      const pct=p.totalSaidas>0?((v/p.totalSaidas)*100).toFixed(1)+'%':'—';
      h+=tr([n,`<span style="color:#f87171">${fmt(v)}</span>`,pct]);
    });
    if(!Object.keys(p.saidasFixasDetalhe).length) h+=`<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--color-text-muted)">Nenhuma despesa fixa registrada</td></tr>`;
    h+=`<tr style="background:rgba(255,255,255,.05);font-weight:700"><td style="padding:10px 12px">TOTAL FIXAS</td><td style="padding:10px 12px;text-align:right;color:#f87171">${fmt(p.totalFixos)}</td><td></td></tr></table></div>`;
    h+=`<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);font-size:.78rem;letter-spacing:2px;color:var(--color-text-muted)">DESPESAS VARIÁVEIS</div>
      <table style="width:100%;border-collapse:collapse">${tr(['Categoria','Total','% das Despesas'],true)}`;
    Object.entries(p.saidasVarDetalhe).sort((a,b)=>b[1]-a[1]).forEach(([c,v])=>{
      const pct=p.totalSaidas>0?((v/p.totalSaidas)*100).toFixed(1)+'%':'—';
      h+=tr([c,`<span style="color:#fb923c">${fmt(v)}</span>`,pct]);
    });
    if(!Object.keys(p.saidasVarDetalhe).length) h+=`<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--color-text-muted)">Nenhuma despesa variável registrada</td></tr>`;
    h+=`<tr style="background:rgba(255,255,255,.05);font-weight:700"><td style="padding:10px 12px">TOTAL VARIÁVEIS</td><td style="padding:10px 12px;text-align:right;color:#fb923c">${fmt(p.totalVar)}</td><td></td></tr></table></div>`;
    return h;
  }

  function abaServicos() {
    let h=`<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      ${card('FATURAMENTO OS',os.totalOS,'var(--color-primary-hover)',os.osLista.length+' OS concluídas')}
      ${card('SERVIÇOS (M.O.)',os.totalServicos,'#a78bfa','')}
      ${card('PEÇAS',os.totalPecas,'#34d399','')}
    </div>`;
    h+=`<div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden">
      <div style="padding:14px 20px;border-bottom:1px solid var(--color-border);font-size:.78rem;letter-spacing:2px;color:var(--color-text-muted)">ORDENS DE SERVIÇO CONCLUÍDAS</div>
      <table style="width:100%;border-collapse:collapse">${tr(['OS','Cliente','Mecânico','Peças','M.O.','Total'],true)}`;
    os.osLista.forEach(o=>{
      h+=`<tr style="border-bottom:1px solid rgba(255,255,255,.04)">
        <td style="padding:7px 12px;font-size:.72rem;color:var(--color-text-muted)">#${(o.id||'').slice(-4)}</td>
        <td style="padding:7px 12px">${o.cliente}</td>
        <td style="padding:7px 12px;font-size:.75rem;color:var(--color-text-muted)">${o.mecanico}</td>
        <td style="padding:7px 12px;text-align:right;color:#34d399;font-size:.78rem">${fmt(o.pecas)}</td>
        <td style="padding:7px 12px;text-align:right;color:#a78bfa;font-size:.78rem">${fmt(o.servicos)}</td>
        <td style="padding:7px 12px;text-align:right;color:var(--color-primary-hover);font-family:'JetBrains Mono',monospace;font-weight:600">${fmt(o.total)}</td></tr>`;
    });
    if(!os.osLista.length) h+=`<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--color-text-muted)">Nenhuma OS concluída encontrada</td></tr>`;
    h+=`<tr style="background:rgba(255,255,255,.05);font-weight:700">
      <td colspan="3" style="padding:10px 12px">TOTAL</td>
      <td style="padding:10px 12px;text-align:right;color:#34d399">${fmt(os.totalPecas)}</td>
      <td style="padding:10px 12px;text-align:right;color:#a78bfa">${fmt(os.totalServicos)}</td>
      <td style="padding:10px 12px;text-align:right;color:var(--color-primary-hover)">${fmt(os.totalOS)}</td>
    </tr></table></div>`; return h;
  }

  let body='';
  if(contadorAba==='resumo')   body=abaResumo();
  if(contadorAba==='entradas') body=abaEntradas();
  if(contadorAba==='saidas')   body=abaSaidas();
  if(contadorAba==='servicos') body=abaServicos();

  main.innerHTML=`
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.2rem;letter-spacing:3px;color:var(--color-text-primary)">📑 CONTADOR</span>
      <div class="toolbar-right">
        <button onclick="gerarPDFContador()" class="btn btn-sm" style="background:rgba(200,16,46,.15);border:1px solid rgba(200,16,46,.4);color:#fca5a5">📄 Gerar PDF para Contador</button>
      </div>
    </div>
    <div style="padding:0 4px">
      <div style="margin-bottom:14px">
        <div style="font-size:.9rem;font-weight:600;color:var(--color-text-primary)">${empresa.nomeFantasia||empresa.razaoSocial||'ZL Motos'}</div>
        <div style="font-size:.75rem;color:var(--color-text-muted)">${empresa.cnpj||''}${empresa.cnpj&&empresa.cidade?' · ':''}${empresa.cidade||''}</div>
      </div>
      ${seletorPeriodo()}
      ${subabas()}
      ${body}
    </div>`;
}

function gerarPDFContador() {
  // Localizar jsPDF
  let jsPDF;
  try {
    jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF
          : (typeof jspdf !== 'undefined' && jspdf.jsPDF) ? jspdf.jsPDF
          : window.jsPDF || null;
  } catch(e) { jsPDF = null; }
  if (!jsPDF) { mostrarErro('jsPDF não carregado. Verifique sua conexão.'); return; }

  const ano = document.getElementById('anoGlobal') ? document.getElementById('anoGlobal').value : new Date().getFullYear();
  const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MESES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtS = v => parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const nomeEmp = empresa.nomeFantasia || empresa.razaoSocial || 'ZL Motos';
  const periodoStr = contadorMesInicio === contadorMesFim
    ? MESES_FULL[contadorMesInicio] + '/' + ano
    : MESES_NOMES[contadorMesInicio] + ' a ' + MESES_NOMES[contadorMesFim] + '/' + ano;

  // Recalcular dados
  let totalEntradas=0, totalFixos=0, totalVar=0, totalSaidas=0;
  let formaPgto = {};
  let entradasDetalhe=[], saidasFixasDetalhe={}, saidasVarDetalhe={}, porMes=[];
  for (let m = contadorMesInicio; m <= contadorMesFim; m++) {
    const c = calcularMes(m);
    const mes = dados[m] || {fixos:[],variaveis:[],entradas:[]};
    totalEntradas+=c.totalBruto; totalFixos+=c.totalFixos; totalVar+=c.totalVar; totalSaidas+=c.totalSaidas;
    porMes.push({mes:MESES_FULL[m],...c});
    (mes.entradas||[]).forEach(e => {
      const fp = e.formaPgto||'Não informado';
      if(!formaPgto[fp]) formaPgto[fp]=0;
      formaPgto[fp]+=num(e.valor);
      entradasDetalhe.push({mes:MESES_NOMES[m],desc:e.desc||'—',valor:num(e.valor),forma:fp,data:e.data||''});
    });
    (mes.fixos||[]).forEach(f => {
      if(!num(f.valor)) return;
      if(!saidasFixasDetalhe[f.nome]) saidasFixasDetalhe[f.nome]=0;
      saidasFixasDetalhe[f.nome]+=num(f.valor);
    });
    (mes.variaveis||[]).forEach(v => {
      if(!num(v.valor)) return;
      const cat=v.categoria||v.cat||'Outros';
      if(!saidasVarDetalhe[cat]) saidasVarDetalhe[cat]=0;
      saidasVarDetalhe[cat]+=num(v.valor);
    });
  }
  const totalLiquido = totalEntradas - totalSaidas;

  // OS
  let totalOS=0, totalPecas=0, totalServicos=0, osLista=[];
  (typeof ordens!=='undefined'?ordens:[]).filter(o=>o.status==='concluida'||o.status==='entregue').forEach(o => {
    const total=osCalcTotal(o); let pecas=0,servicos=0;
    (o.itens||[]).forEach(it => {
      const v=(num(it.qtd)||1)*num(it.vunit);
      if(it.cat==='Peça'||it._estoqueNome) pecas+=v; else servicos+=v;
    });
    totalOS+=total; totalPecas+=pecas; totalServicos+=servicos;
    osLista.push({numero:osNumeroFormatado(o.numero),cliente:o.cliente||'—',total,pecas,servicos,mecanico:(o.mecanicos||[]).join(', ')||'—'});
  });

  // ── MONTAR PDF ──────────────────────────────────────────
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210;
  let y = 0;
  const ML = 14, MR = 196, CW = MR - ML;

  function novaPagina() {
    doc.addPage();
    y = 20;
    rodape();
  }

  function checkY(needed) { if (y + needed > 272) novaPagina(); }

  let paginaAtual = 1;
  function rodape() {
    doc.setFontSize(7); doc.setTextColor(160,160,160); doc.setFont('helvetica','normal');
    doc.text('ZL Motos — Relatório para Contador — ' + periodoStr, ML, 289);
    doc.text('Emitido em ' + new Date().toLocaleDateString('pt-BR') + ' · Pág. ' + paginaAtual, MR, 289, {align:'right'});
    paginaAtual++;
  }

  function secaoTitulo(txt, cor) {
    checkY(10);
    cor = cor || [10, 22, 40];
    doc.setFillColor(...cor);
    doc.rect(ML, y, CW, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text(txt.toUpperCase(), ML+4, y+5.5);
    y += 10;
  }

  function linhaTabela(cols, widths, opcoes) {
    checkY(7);
    opcoes = opcoes || {};
    const isHeader = opcoes.header;
    const bgColor  = opcoes.bg;
    const altura   = opcoes.altura || 7;

    if (bgColor) { doc.setFillColor(...bgColor); doc.rect(ML, y, CW, altura, 'F'); }
    else if (isHeader) { doc.setFillColor(240,240,240); doc.rect(ML, y, CW, altura, 'F'); }

    doc.setDrawColor(230,230,230);
    doc.line(ML, y + altura, MR, y + altura);

    let x = ML;
    cols.forEach((txt, i) => {
      const w = widths[i];
      const align = opcoes.aligns && opcoes.aligns[i] ? opcoes.aligns[i] : 'left';
      doc.setFontSize(isHeader ? 7 : 8);
      doc.setFont('helvetica', isHeader ? 'bold' : (opcoes.bold ? 'bold' : 'normal'));
      doc.setTextColor(isHeader ? 80 : (opcoes.cor ? opcoes.cor[i] || 30 : 30));
      const tx = align === 'right' ? x + w - 2 : x + 2;
      doc.text(String(txt||'—'), tx, y + altura - 2, {align});
      x += w;
    });
    y += altura;
  }

  // ── CAPA / CABEÇALHO ──────────────────────────────────
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, W, 42, 'F');

  doc.setFontSize(20); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text(nomeEmp.toUpperCase(), W/2, 14, {align:'center'});

  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(180,200,230);
  const infoEmp = [empresa.cnpj?'CNPJ: '+empresa.cnpj:'', empresa.endereco||'', empresa.cidade&&empresa.estado?empresa.cidade+' — '+empresa.estado:''].filter(Boolean).join('  ·  ');
  if (infoEmp) doc.text(infoEmp, W/2, 21, {align:'center', maxWidth:180});

  doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(96,165,250);
  doc.text('RELATÓRIO PARA CONTADOR', W/2, 30, {align:'center'});

  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(150,200,255);
  doc.text('Período: ' + periodoStr + '  ·  Emitido em: ' + new Date().toLocaleDateString('pt-BR') + ' às ' + new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}), W/2, 37, {align:'center'});

  y = 50;
  rodape();

  // ── 1. RESUMO EXECUTIVO ───────────────────────────────
  secaoTitulo('1. Resumo Executivo', [10,22,40]);

  const lcor = totalLiquido >= 0 ? [22,163,74] : [220,38,38];
  const resumoCards = [
    ['RECEITAS TOTAIS', fmt(totalEntradas), [22,163,74]],
    ['DESPESAS TOTAIS', fmt(totalSaidas), [220,38,38]],
    ['RESULTADO LÍQUIDO', fmt(totalLiquido), lcor],
  ];
  const cw3 = CW / 3;
  resumoCards.forEach(([label, valor, cor], i) => {
    const cx = ML + i * cw3;
    doc.setFillColor(248,248,248); doc.roundedRect(cx+1, y, cw3-2, 20, 2, 2, 'F');
    doc.setDrawColor(...cor); doc.setLineWidth(0.5); doc.roundedRect(cx+1, y, cw3-2, 20, 2, 2, 'S'); doc.setLineWidth(0.2);
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(100,100,100);
    doc.text(label, cx + cw3/2, y+7, {align:'center'});
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...cor);
    doc.text(valor, cx + cw3/2, y+16, {align:'center'});
  });
  y += 24;

  // ── 2. DRE SIMPLIFICADO ───────────────────────────────
  checkY(12);
  secaoTitulo('2. DRE — Demonstrativo de Resultado', [26,58,107]);

  linhaTabela(['DESCRIÇÃO','VALOR'], [CW*0.7, CW*0.3], {header:true, aligns:['left','right']});
  linhaTabela(['(+) RECEITAS BRUTAS', fmt(totalEntradas)], [CW*0.7,CW*0.3], {bold:true, aligns:['left','right'], cor:[30,30,30]});
  Object.entries(formaPgto).forEach(([f,v]) => {
    if(v>0) linhaTabela(['    └ ' + f, fmt(v)], [CW*0.7,CW*0.3], {aligns:['left','right'], cor:[100,100,100]});
  });
  linhaTabela(['(-) DESPESAS FIXAS', fmt(totalFixos)], [CW*0.7,CW*0.3], {bold:true, aligns:['left','right'], cor:[30,30,30]});
  Object.entries(saidasFixasDetalhe).forEach(([n,v]) => {
    if(v>0) linhaTabela(['    └ ' + n, fmt(v)], [CW*0.7,CW*0.3], {aligns:['left','right'], cor:[100,100,100]});
  });
  linhaTabela(['(-) DESPESAS VARIÁVEIS', fmt(totalVar)], [CW*0.7,CW*0.3], {bold:true, aligns:['left','right'], cor:[30,30,30]});
  Object.entries(saidasVarDetalhe).forEach(([c,v]) => {
    if(v>0) linhaTabela(['    └ ' + c, fmt(v)], [CW*0.7,CW*0.3], {aligns:['left','right'], cor:[100,100,100]});
  });
  checkY(10);
  doc.setFillColor(...(totalLiquido>=0?[220,252,231]:[254,226,226]));
  doc.rect(ML, y, CW, 9, 'F');
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(...lcor);
  doc.text('(=) RESULTADO LÍQUIDO', ML+4, y+6);
  doc.text(fmt(totalLiquido), MR-2, y+6, {align:'right'});
  y += 13;

  // ── 3. FORMAS DE PAGAMENTO ────────────────────────────
  checkY(14);
  secaoTitulo('3. Recebimentos por Forma de Pagamento', [26,58,107]);
  linhaTabela(['FORMA','TOTAL','% DA RECEITA'], [CW*0.4,CW*0.35,CW*0.25], {header:true, aligns:['left','right','right']});
  Object.entries(formaPgto).forEach(([f,v]) => {
    if (!v) return;
    const pct = totalEntradas > 0 ? ((v/totalEntradas)*100).toFixed(1)+'%' : '—';
    linhaTabela([f, fmt(v), pct], [CW*0.4,CW*0.35,CW*0.25], {aligns:['left','right','right']});
  });
  linhaTabela(['TOTAL', fmt(totalEntradas), '100%'], [CW*0.4,CW*0.35,CW*0.25], {bold:true, aligns:['left','right','right'], bg:[240,240,240]});
  y += 4;

  // ── 4. RESULTADO POR MÊS ─────────────────────────────
  checkY(14);
  secaoTitulo('4. Resultado Mensal', [26,58,107]);
  linhaTabela(['MÊS','ENTRADAS','SAÍDAS','RESULTADO'], [CW*0.28,CW*0.24,CW*0.24,CW*0.24], {header:true, aligns:['left','right','right','right']});
  porMes.forEach(m => {
    const cor = m.totalLiquido>=0 ? [22,163,74] : [220,38,38];
    linhaTabela([m.mes, fmtS(m.totalBruto), fmtS(m.totalSaidas), fmtS(m.totalLiquido)],
      [CW*0.28,CW*0.24,CW*0.24,CW*0.24],
      {aligns:['left','right','right','right'], cor:[30,30,30,cor[0]===22?34:220]});
  });
  linhaTabela(['TOTAL', fmtS(totalEntradas), fmtS(totalSaidas), fmtS(totalLiquido)],
    [CW*0.28,CW*0.24,CW*0.24,CW*0.24],
    {bold:true, aligns:['left','right','right','right'], bg:[240,240,240]});
  y += 4;

  // ── 5. ENTRADAS DETALHADAS ────────────────────────────
  if (entradasDetalhe.length) {
    checkY(14);
    secaoTitulo('5. Entradas Detalhadas', [26,58,107]);
    linhaTabela(['MÊS','DESCRIÇÃO','FORMA','VALOR'], [CW*0.12,CW*0.48,CW*0.2,CW*0.2], {header:true, aligns:['left','left','left','right']});
    entradasDetalhe.forEach(e => {
      checkY(7);
      linhaTabela([e.mes, e.desc, e.forma, fmtS(e.valor)], [CW*0.12,CW*0.48,CW*0.2,CW*0.2], {aligns:['left','left','left','right']});
    });
    linhaTabela(['','TOTAL','', fmtS(totalEntradas)], [CW*0.12,CW*0.48,CW*0.2,CW*0.2], {bold:true, aligns:['left','left','left','right'], bg:[240,240,240]});
    y += 4;
  }

  // ── 6. DESPESAS DETALHADAS ────────────────────────────
  checkY(14);
  secaoTitulo('6. Despesas Fixas por Categoria', [26,58,107]);
  linhaTabela(['CATEGORIA','TOTAL','% DESPESAS'], [CW*0.55,CW*0.25,CW*0.2], {header:true, aligns:['left','right','right']});
  Object.entries(saidasFixasDetalhe).sort((a,b)=>b[1]-a[1]).forEach(([n,v]) => {
    const pct = totalSaidas>0 ? ((v/totalSaidas)*100).toFixed(1)+'%' : '—';
    linhaTabela([n, fmtS(v), pct], [CW*0.55,CW*0.25,CW*0.2], {aligns:['left','right','right']});
  });
  if (!Object.keys(saidasFixasDetalhe).length) { doc.setFontSize(8); doc.setTextColor(150,150,150); doc.text('Nenhuma despesa fixa registrada', ML+4, y+5); y+=8; }
  else { linhaTabela(['TOTAL FIXAS', fmtS(totalFixos), ''], [CW*0.55,CW*0.25,CW*0.2], {bold:true, aligns:['left','right','right'], bg:[240,240,240]}); y+=4; }

  checkY(14);
  secaoTitulo('7. Despesas Variáveis por Categoria', [26,58,107]);
  linhaTabela(['CATEGORIA','TOTAL','% DESPESAS'], [CW*0.55,CW*0.25,CW*0.2], {header:true, aligns:['left','right','right']});
  Object.entries(saidasVarDetalhe).sort((a,b)=>b[1]-a[1]).forEach(([c,v]) => {
    const pct = totalSaidas>0 ? ((v/totalSaidas)*100).toFixed(1)+'%' : '—';
    linhaTabela([c, fmtS(v), pct], [CW*0.55,CW*0.25,CW*0.2], {aligns:['left','right','right']});
  });
  if (!Object.keys(saidasVarDetalhe).length) { doc.setFontSize(8); doc.setTextColor(150,150,150); doc.text('Nenhuma despesa variável registrada', ML+4, y+5); y+=8; }
  else { linhaTabela(['TOTAL VARIÁVEIS', fmtS(totalVar), ''], [CW*0.55,CW*0.25,CW*0.2], {bold:true, aligns:['left','right','right'], bg:[240,240,240]}); y+=4; }

  // ── 8. ORDENS DE SERVIÇO ──────────────────────────────
  if (osLista.length) {
    checkY(14);
    secaoTitulo('8. Ordens de Serviço Concluídas', [26,58,107]);
    linhaTabela(['OS','CLIENTE','MECÂNICO','PEÇAS','M.O.','TOTAL'],
      [CW*0.1,CW*0.28,CW*0.18,CW*0.15,CW*0.15,CW*0.14],
      {header:true, aligns:['left','left','left','right','right','right']});
    osLista.forEach(o => {
      checkY(7);
      linhaTabela([o.numero, o.cliente, o.mecanico, fmtS(o.pecas), fmtS(o.servicos), fmtS(o.total)],
        [CW*0.1,CW*0.28,CW*0.18,CW*0.15,CW*0.15,CW*0.14],
        {aligns:['left','left','left','right','right','right']});
    });
    checkY(9);
    doc.setFillColor(240,240,240); doc.rect(ML, y, CW, 9, 'F');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(30,30,30);
    doc.text('TOTAL OS (' + osLista.length + ')', ML+4, y+6);
    doc.text(fmtS(totalPecas), ML + CW*0.56 + CW*0.15 - 2, y+6, {align:'right'});
    doc.text(fmtS(totalServicos), ML + CW*0.56 + CW*0.30 - 2, y+6, {align:'right'});
    doc.text(fmtS(totalOS), MR-2, y+6, {align:'right'});
    y += 13;
  }

  // ── ASSINATURA ────────────────────────────────────────
  checkY(30);
  y += 10;
  doc.setDrawColor(180,180,180); doc.setLineWidth(0.3);
  doc.line(ML, y, ML+70, y);
  doc.line(MR-70, y, MR, y);
  doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(130,130,130);
  doc.text(nomeEmp, ML+35, y+5, {align:'center'});
  doc.text('Contador / Responsável', MR-35, y+5, {align:'center'});

  // Salvar
  const nomeArq = 'ZLMotos_Contador_' + periodoStr.replace(/\s/g,'_').replace(/[\/]/g,'-') + '.pdf';
  doc.save(nomeArq);
  mostrarToast('✓ PDF gerado: ' + nomeArq);
}


// ═══════════════════════════════════════════
// FILA DE MOTOS
// ═══════════════════════════════════════════
let filaMotos = {
  pesada: [],
  mecanica: [],
  box: [],
  espera: [],
  mortas: []
};
let filaModalAberto = null;
let filaDragId = null;
let filaDragLista = null;

// Cada lista salva em documento separado no Firebase
const FILA_LISTAS = ['pesada','mecanica','box','espera','mortas'];

async function salvarFilaLista(lista) {
  try {
    if (window._firestoreSetDoc && window._userDoc) {
      const ref = window._userDoc('fila_' + lista);
      await window._firestoreSetDoc(ref, {
        motos: filaMotos[lista],
        atualizadoEm: new Date().toISOString()
      });
    }
  } catch(e) { console.warn('Erro ao salvar fila ' + lista + ':', e); }
}

async function salvarFilaMotos(lista) {
  // Se passar lista específica, salva só ela. Senão salva todas.
  if (lista) {
    await salvarFilaLista(lista);
  } else {
    await Promise.all(FILA_LISTAS.map(l => salvarFilaLista(l)));
  }
}

async function carregarFilaMotos() {
  try {
    if (window._firestoreGetDoc && window._userDoc) {
      await Promise.all(FILA_LISTAS.map(async lista => {
        try {
          const ref = window._userDoc('fila_' + lista);
          const snap = await window._firestoreGetDoc(ref);
          if (snap && snap.exists && snap.exists()) {
            const d = snap.data();
            if (d && d.motos) filaMotos[lista] = d.motos;
          }
        } catch(e) { console.warn('Erro ao carregar fila ' + lista + ':', e); }
      }));
    }
  } catch(e) { console.warn('Erro ao carregar filas:', e); }
}

function filaAdicionarMoto(lista) {
  const modelo = document.getElementById('fila-modelo').value.trim();
  const placa   = document.getElementById('fila-placa').value.trim().toUpperCase();
  const ano     = document.getElementById('fila-ano').value.trim();
  const cor     = document.getElementById('fila-cor').value.trim();
  const obs     = document.getElementById('fila-obs').value.trim();

  if (!modelo) { mostrarToast('Informe o modelo da moto'); return; }

  filaMotos[lista].push({
    id: 'fm' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    modelo: modelo.replace(/'/g,'’').replace(/"/g,'“'),
    placa,
    ano,
    cor: cor.replace(/'/g,'’'),
    obs: obs.replace(/'/g,'’').replace(/"/g,'“'),
    entradaEm: new Date().toISOString()
  });

  salvarFilaMotos(lista);
  filaModalAberto = null;
  renderFilaMotos();
  mostrarToast('✓ Moto adicionada à fila');
}

function filaRemoverMoto(lista, id) {
  if (!confirm('Remover esta moto da fila? (Faça o orçamento antes se necessário)')) return;
  filaMotos[lista] = filaMotos[lista].filter(m => m.id !== id);
  salvarFilaMotos(lista);
  renderFilaMotos();
  mostrarToast('✓ Moto removida da fila');
}

function filaMoverMoto(lista, id, dir) {
  const arr = filaMotos[lista];
  const idx = arr.findIndex(m => m.id === id);
  if (idx < 0) return;
  const novoIdx = idx + dir;
  if (novoIdx < 0 || novoIdx >= arr.length) return;
  const tmp = arr[idx];
  arr[idx] = arr[novoIdx];
  arr[novoIdx] = tmp;
  salvarFilaMotos(lista);
  renderFilaMotos();
}

function renderFilaMotos() {
  const main = document.getElementById('mainContent');

  const listas = [
    { id: 'pesada',   label: 'Mecânica Pesada', icon: '🔩', cor: '#f87171', bg: 'rgba(248,113,113,.08)', borda: 'rgba(248,113,113,.25)' },
    { id: 'mecanica', label: 'Mecânica',         icon: '🔧', cor: '#fbbf24', bg: 'rgba(251,191,36,.08)',  borda: 'rgba(251,191,36,.25)'  },
    { id: 'box',      label: 'Box Rápido',        icon: '⚡', cor: '#34d399', bg: 'rgba(52,211,153,.08)',  borda: 'rgba(52,211,153,.25)'  },
    { id: 'espera',   label: 'Lista de Espera',   icon: '⏳', cor: '#818cf8', bg: 'rgba(129,140,248,.08)', borda: 'rgba(129,140,248,.25)' },
    { id: 'mortas',   label: 'Motos Mortas',      icon: '💀', cor: '#94a3b8', bg: 'rgba(148,163,184,.08)', borda: 'rgba(148,163,184,.2)'  },
  ];

  function renderLista(lst) {
    const motos = filaMotos[lst.id] || [];

    // Derivar variáveis CSS de cor para o grid animado
    const corGrid = lst.cor.replace(')', ',.1)').replace('rgb(','rgba(').replace('#f87171','rgba(248,113,113,').replace('#fbbf24','rgba(251,191,36,').replace('#34d399','rgba(52,211,153,').replace('#818cf8','rgba(129,140,248,').replace('#94a3b8','rgba(148,163,184,');

    let h = `<div
      id="fila-col-${lst.id}"
      ondragover="event.preventDefault();filaDragOver('${lst.id}',event)"
      ondragleave="filaDragLeave('${lst.id}')"
      ondrop="filaDrop('${lst.id}')"
      style="flex:1;min-width:240px;max-width:340px;transition:background .15s;border-radius:14px;padding:4px">`;

    // Header
    h += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:0 2px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:1.05rem">${lst.icon}</span>
        <span style="font-size:.78rem;font-weight:700;color:${lst.cor};letter-spacing:1px">${lst.label.toUpperCase()}</span>
        <span style="background:${lst.bg};border:1px solid ${lst.borda};color:${lst.cor};font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:20px">${motos.length}</span>
      </div>
      <button onclick="filaModalAberto='${lst.id}';renderFilaMotos()" style="background:${lst.bg};border:1px solid ${lst.borda};color:${lst.cor};border-radius:7px;padding:4px 10px;font-size:.68rem;font-weight:600;cursor:pointer">+ Add</button>
    </div>`;

    // Drop zone vazia
    if (motos.length === 0) {
      h += `<div id="fila-empty-${lst.id}" class="fila-col-empty" style="--fila-cor-borda:${lst.borda};--fila-cor-grid:${lst.bg}">
        Arraste uma moto aqui
      </div>`;
    } else {
      motos.forEach((m, i) => {
        const num = String(i + 1).padStart(3, '0');
        const isFirst = i === 0 && lst.id !== 'mortas' && lst.id !== 'espera';
        h += `<div
          id="fila-card-${m.id}"
          draggable="true"
          ondragstart="filaDragStart('${lst.id}','${m.id}',event)"
          ondragend="filaDragEnd(event)"
          class="fila-card${isFirst ? ' primeiro' : ''}"
          style="--fila-cor-borda:${lst.borda};--fila-cor-bg:${lst.bg};--fila-cor-glow:${lst.bg};--fila-cor-grid:${lst.bg}">
          <div class="fila-num-badge" style="background:${isFirst ? lst.cor : 'var(--color-elevated)'};color:${isFirst ? '#000' : 'var(--color-text-muted)'}">#${num}${isFirst ? ' • PRÓXIMA' : ''}</div>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;position:relative;z-index:1">
            <div style="flex:1;min-width:0">
              <div style="font-size:.88rem;font-weight:700;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.modelo}</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">
                ${m.placa ? `<span style="background:rgba(255,255,255,.06);border:1px solid ${lst.borda};border-radius:4px;padding:1px 6px;font-size:.65rem;font-family:'JetBrains Mono',monospace;color:${lst.cor}">${m.placa}</span>` : ''}
                ${m.ano   ? `<span style="font-size:.68rem;color:var(--color-text-muted)">${m.ano}</span>` : ''}
                ${m.cor   ? `<span style="font-size:.68rem;color:var(--color-text-muted)">• ${m.cor}</span>` : ''}
              </div>
              ${m.obs ? `<div style="margin-top:5px;font-size:.7rem;color:${lst.cor};background:${lst.bg};border-radius:5px;padding:2px 7px;display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;position:relative;z-index:1">${m.obs}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end;flex-shrink:0">
              <button onclick="filaRemoverMoto('${lst.id}','${m.id}')" title="Remover" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#fca5a5;border-radius:6px;padding:3px 8px;font-size:.65rem;cursor:pointer">✕</button>
              <div style="display:flex;gap:2px">
                ${i > 0 ? `<button onclick="filaMoverMoto('${lst.id}','${m.id}',-1)" style="background:transparent;border:1px solid ${lst.borda};color:${lst.cor};border-radius:4px;width:20px;height:20px;cursor:pointer;font-size:.6rem;display:flex;align-items:center;justify-content:center">▲</button>` : '<div style="width:20px"></div>'}
                ${i < motos.length-1 ? `<button onclick="filaMoverMoto('${lst.id}','${m.id}',1)" style="background:transparent;border:1px solid ${lst.borda};color:${lst.cor};border-radius:4px;width:20px;height:20px;cursor:pointer;font-size:.6rem;display:flex;align-items:center;justify-content:center">▼</button>` : ''}
              </div>
            </div>
          </div>
        </div>`;
      });
    }

    h += `</div>`;
    return h;
  }

  function renderModal(listaId) {
    const lst = listas.find(l => l.id === listaId);
    if (!lst) return '';
    return `<div onclick="if(event.target===this){filaModalAberto=null;renderFilaMotos()}" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px">
      <div onclick="event.stopPropagation()" style="background:var(--color-surface);border:1px solid ${lst.borda};border-radius:16px;padding:24px;width:100%;max-width:420px">
        <div style="font-size:.82rem;font-weight:700;color:${lst.cor};letter-spacing:2px;margin-bottom:18px">${lst.icon} ADICIONAR — ${lst.label.toUpperCase()}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:4px">MODELO *</div>
            <input id="fila-modelo" type="text" placeholder="Ex: Honda CG 160 Fan" style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:9px 12px;font-size:.88rem"/>
          </div>
          <div style="display:flex;gap:10px">
            <div style="flex:1">
              <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:4px">PLACA</div>
              <input id="fila-placa" type="text" placeholder="ABC-1234" maxlength="8" style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:9px 12px;font-size:.88rem;text-transform:uppercase;font-family:'JetBrains Mono',monospace"/>
            </div>
            <div style="width:88px">
              <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:4px">ANO</div>
              <input id="fila-ano" type="text" placeholder="2023" maxlength="4" style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:9px 12px;font-size:.88rem"/>
            </div>
          </div>
          <div>
            <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:4px">COR</div>
            <input id="fila-cor" type="text" placeholder="Ex: Vermelha" style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:9px 12px;font-size:.88rem"/>
          </div>
          <div>
            <div style="font-size:.7rem;color:var(--color-text-muted);margin-bottom:4px">OBSERVAÇÃO</div>
            <input id="fila-obs" type="text" placeholder="Ex: Elétrica, Restauração..." style="width:100%;background:var(--color-bg);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:9px 12px;font-size:.88rem"/>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button onclick="filaModalAberto=null;renderFilaMotos()" style="flex:1;padding:10px;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;cursor:pointer;font-size:.85rem">Cancelar</button>
          <button onclick="filaAdicionarMoto('${lst.id}')" style="flex:2;padding:10px;background:${lst.cor};border:none;color:#000;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700">Adicionar à Fila</button>
        </div>
      </div>
    </div>`;
  }

  // Renderiza conteúdo principal SEM modal
  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.2rem;letter-spacing:3px;color:var(--color-text-primary)">🏍️ FILA DE MOTOS</span>
    </div>
    <div style="padding:0 4px">
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
        ${listas.map(l => renderLista(l)).join('')}
      </div>
      <div style="margin-top:16px;font-size:.7rem;color:var(--color-text-muted);text-align:center;opacity:.5">💡 Arraste os cards entre as colunas para mover uma moto</div>
    </div>
  `;

  // Modal renderizado num container separado no body — evita quebra por HTML grande
  let modalContainer = document.getElementById('fila-modal-container');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'fila-modal-container';
    document.body.appendChild(modalContainer);
  }
  modalContainer.innerHTML = filaModalAberto ? renderModal(filaModalAberto) : '';

  if (filaModalAberto) {
    setTimeout(() => { const el = document.getElementById('fila-modelo'); if (el) el.focus(); }, 50);
  }
}

// ── Drag & Drop ──
function filaDragStart(lista, id, event) {
  filaDragId = id;
  filaDragLista = lista;
  event.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const el = document.getElementById('fila-card-' + id);
    if (el) { el.style.opacity = '0.35'; el.style.transform = 'scale(.97)'; }
  }, 0);
}

function filaDragEnd(event) {
  if (filaDragId) {
    const el = document.getElementById('fila-card-' + filaDragId);
    if (el) { el.style.opacity = '1'; el.style.transform = ''; }
  }
  // Clear highlights
  document.querySelectorAll('[id^="fila-col-"]').forEach(col => {
    col.style.background = '';
    col.style.outline = '';
  });
}

function filaDragOver(listaDestino, event) {
  event.preventDefault();
  const col = document.getElementById('fila-col-' + listaDestino);
  if (col && listaDestino !== filaDragLista) {
    col.style.background = 'rgba(255,255,255,.04)';
    col.style.outline = '2px dashed rgba(255,255,255,.15)';
    col.style.outlineOffset = '-4px';
  }
}

function filaDragLeave(listaDestino) {
  const col = document.getElementById('fila-col-' + listaDestino);
  if (col) { col.style.background = ''; col.style.outline = ''; }
}

function filaDrop(listaDestino) {
  if (!filaDragId || !filaDragLista || listaDestino === filaDragLista) {
    filaDragId = null; filaDragLista = null; return;
  }
  // Find moto in origin
  const idx = filaMotos[filaDragLista].findIndex(m => m.id === filaDragId);
  if (idx < 0) { filaDragId = null; filaDragLista = null; return; }

  const listaOrigem = filaDragLista;
  const moto = filaMotos[filaDragLista].splice(idx, 1)[0];
  filaMotos[listaDestino].push(moto);

  filaDragId = null;
  filaDragLista = null;

  salvarFilaMotos(listaOrigem);
  salvarFilaMotos(listaDestino);
  renderFilaMotos();
  mostrarToast('✓ Moto movida para ' + listaDestino.charAt(0).toUpperCase() + listaDestino.slice(1));
}


// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// ORÇAMENTO — temporário, sem salvar
// ═══════════════════════════════════════════
// ── CONFIGURAÇÕES DA EMPRESA ──
let checklistEntrega = [
  'Documentos da moto devolvidos',
  'Chave entregue ao cliente',
  'Pagamento efetuado',
  'Cliente informado sobre a garantia',
  'Moto testada antes da entrega'
];

let empresa = {
  razaoSocial: 'O. G. L. Junior Moto Peça',
  nomeFantasia: 'ZL Motos',
  cnpj: '39.592.122/0001-50',
  endereco: 'R. Antonio Pedro Ferracini, 135',
  bairro: 'Vila São Judas Tadeu',
  cidade: 'São José do Rio Preto',
  estado: 'SP',
  cep: '15.075-310',
  telefone: '(17) 3213-2229',
  email: '',
  logo: ''
};