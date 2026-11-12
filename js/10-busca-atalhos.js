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
          tipo: 'Orçamento', icon: '',
          titulo: (orc.cliente||'Sem nome') + (orc.veiculo ? ' — ' + orc.veiculo : ''),
          sub: (orc.placa ? 'Placa: ' + orc.placa + ' · ' : '') + (orc.data ? new Date(orc.data+'T12:00:00').toLocaleDateString('pt-BR') : ''),
          badge: orc.status||'pendente',
          badgeCor: (orc.status||'pendente')==='aprovado'?'#5cab84':(orc.status)==='recusado'?'#eab7b7':'#d4d4d8',
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
          tipo: 'Cliente', icon: '',
          titulo: c.nome||'—',
          sub: [(c.telefone||''), (c.veiculo||''), (c.placa||'')].filter(Boolean).join(' · '),
          badge: '', badgeCor: '',
          valor: '',
          acao: () => { sbIr(20); }
        });
      }
    });

    // ── FINANCEIRO (entradas e saídas) ──
    for (let m = 0; m < 12; m++) {
      if (!dados[m]) continue;
      const mesNome = MESES[m];
      (dados[m].entradas||[]).forEach(e => {
        if (!e.desc) return;
        if ((e.desc||'').toLowerCase().includes(q) || (e.formaPgto||'').toLowerCase().includes(q)) {
          resultados.push({
            tipo: 'Financeiro', icon: '',
            titulo: e.desc,
            sub: mesNome + (e.data ? ' · ' + new Date(e.data+'T12:00:00').toLocaleDateString('pt-BR') : '') + (e.formaPgto ? ' · ' + e.formaPgto : ''),
            badge: '↑ Entrada',
            badgeCor: '#5cab84',
            valor: e.valor ? fmt(e.valor) : '',
            acao: () => { sbIrMes(m); }
          });
        }
      });
      (dados[m].variaveis||[]).forEach(v => {
        if (!v.desc) return;
        if ((v.desc||'').toLowerCase().includes(q) || (v.cat||'').toLowerCase().includes(q) || (v.formaPgto||'').toLowerCase().includes(q)) {
          resultados.push({
            tipo: 'Financeiro', icon: '',
            titulo: v.desc,
            sub: mesNome + (v.data ? ' · ' + new Date(v.data+'T12:00:00').toLocaleDateString('pt-BR') : '') + (v.cat ? ' · ' + v.cat : '') + (v.formaPgto ? ' · ' + v.formaPgto : ''),
            badge: '↓ Saída',
            badgeCor: '#eab7b7',
            valor: v.valor ? fmt(v.valor) : '',
            acao: () => { sbIrMes(m); }
          });
        }
      });
    }

    // ── CONTAS A PAGAR ──
    (contasPagar||[]).forEach(c => {
      if (!c.nome) return;
      if ((c.nome||'').toLowerCase().includes(q) || (c.categoria||'').toLowerCase().includes(q)) {
        resultados.push({
          tipo: 'Conta', icon: '',
          titulo: c.nome,
          sub: (c.vencimento ? 'Vence: ' + new Date(c.vencimento+'T12:00:00').toLocaleDateString('pt-BR') : '') + (c.categoria ? ' · ' + c.categoria : '') + (c.recorrencia !== 'unica' ? ' · ' + c.recorrencia : ''),
          badge: c.status === 'pago' ? 'pago' : 'pendente',
          badgeCor: c.status === 'pago' ? '#5cab84' : '#d4d4d8',
          valor: c.valor ? fmt(c.valor) : '',
          acao: () => { sbIr(24); }
        });
      }
    });
  }

  // ── HTML ──────────────────────────────────────────────
  const grupos = ['Orçamento','Cliente','Financeiro','Conta'];
  const iconeGrupo = { OS:'', 'Orçamento':'', Cliente:'', Agendamento:'', Estoque:'', Financeiro:'', Conta:'' };

  let listaHTML = '';
  if (q.length < 2) {
    listaHTML = '<div style="text-align:center;padding:48px 0;color:var(--color-text-muted)">'
      + '<div style="font-size:2.5rem;margin-bottom:12px"></div>'
      + '<div style="font-size:.9rem">Digite pelo menos 2 caracteres para buscar</div>'
      + '<div style="font-size:.75rem;margin-top:8px;opacity:.6">Busca em Orçamentos, Clientes, Financeiro e Contas a Pagar</div>'
      + '</div>';
  } else if (resultados.length === 0) {
    listaHTML = '<div style="text-align:center;padding:48px 0;color:var(--color-text-muted)">'
      + '<div style="font-size:2.5rem;margin-bottom:12px"></div>'
      + '<div style="font-size:.9rem">Nenhum resultado para <b style="color:var(--color-text-primary)">"' + _buscaGlobalTermo + '"</b></div>'
      + '</div>';
  } else {
    grupos.forEach(grupo => {
      const itens = resultados.filter(r => r.tipo === grupo);
      if (!itens.length) return;
      listaHTML += '<div style="font-size:.65rem;letter-spacing:1px;color:var(--color-text-muted);margin:16px 0 8px;font-weight:700">'
        + iconeGrupo[grupo] + ' ' + grupo.toUpperCase() + 'S (' + itens.length + ')</div>';
      itens.forEach((r, idx) => {
        listaHTML += '<div onclick="(_buscaAcoes[' + resultados.indexOf(r) + '])()" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:#121215;margin-bottom:6px;transition:all .15s" onmouseover="this.style.background=\'rgba(255,255,255,.05)\';this.style.borderColor=\'rgba(255,255,255,.12)\'" onmouseout="this.style.background=\'#121215\';this.style.borderColor=\'rgba(255,255,255,.06)\'">'
          + '<div style="font-size:1.2rem;flex-shrink:0">' + r.icon + '</div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:.85rem;font-weight:600;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + r.titulo + '</div>'
          + '<div style="font-size:.72rem;color:var(--color-text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + r.sub + '</div>'
          + '</div>'
          + (r.badge ? '<span style="font-size:.65rem;background:' + r.badgeCor + '22;border:1px solid ' + r.badgeCor + '55;color:' + r.badgeCor + ';border-radius:6px;padding:2px 8px;white-space:nowrap;flex-shrink:0">' + r.badge + '</span>' : '')
          + (r.valor ? '<span style="font-size:.8rem;font-weight:700;color:#5cab84;font-family:\'JetBrains Mono\',monospace;flex-shrink:0">' + r.valor + '</span>' : '')
          + '<span style="color:var(--color-text-muted);font-size:.75rem;flex-shrink:0">→</span>'
          + '</div>';
      });
    });
  }

  // Guarda ações indexadas para evitar problema com onclick inline e closures
  window._buscaAcoes = resultados.map(r => r.acao);

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-size:1.1rem;font-weight:700;letter-spacing:1px;color:var(--color-text-primary)">Busca Global</span>
      <div class="toolbar-right">
        <span style="font-size:.72rem;color:var(--color-text-muted)">${resultados.length > 0 ? resultados.length + ' resultado(s)' : ''}</span>
      </div>
    </div>

    <!-- Campo de busca -->
    <div style="position:relative;margin-bottom:20px">
      <div style="position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:1.1rem;pointer-events:none"></div>
      <input id="busca-global-input"
        type="text"
        value="${_buscaGlobalTermo.replace(/"/g,'&quot;')}"
        placeholder="Buscar por nome, placa, número de OS, veículo..."
        oninput="_buscaGlobalTermo=this.value;renderBuscaGlobal(true)"
        style="width:100%;background:#1a1a1d;border:1px solid rgba(255,255,255,0.15);color:var(--color-text-primary);
          border-radius:14px;padding:14px 16px 14px 46px;font-size:1rem;
          outline:none;transition:border-color .2s;box-shadow:0 0 0 0 rgba(255,255,255,0)"
        onfocus="this.style.borderColor='#e4e4e7';this.style.boxShadow='0 0 0 3px rgba(255,255,255,0.06)'"
        onblur="this.style.borderColor='rgba(255,255,255,0.15)';this.style.boxShadow='none'"
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
  if (e.key === 'c' || e.key === 'C') { sbIr(20); renderAll(); return; } // Clientes
  if (e.key === 'r' || e.key === 'R') { sbIr(13); renderAll(); return; } // Orçamentos
  if (e.key === 's' || e.key === 'S') { sbIr(12); renderAll(); return; } // Resumo anual
  if (e.key === '?' || e.key === '/') { mostrarAtalhos(); return; } // Cheatsheet
  // Mês anterior/próximo quando estiver em aba financeira
  if (e.key === 'ArrowLeft' && abaAtiva >= 0 && abaAtiva <= 11) {
    const selMes = document.getElementById('mesGlobal');
    if (selMes && parseInt(selMes.value) > 0) { selMes.value = parseInt(selMes.value) - 1; selMes.dispatchEvent(new Event('change')); }
    return;
  }
  if (e.key === 'ArrowRight' && abaAtiva >= 0 && abaAtiva <= 11) {
    const selMes = document.getElementById('mesGlobal');
    if (selMes && parseInt(selMes.value) < 11) { selMes.value = parseInt(selMes.value) + 1; selMes.dispatchEvent(new Event('change')); }
    return;
  }
  // Novo lançamento rápido (+ ou =)
  if ((e.key === '+' || e.key === '=') && abaAtiva >= 0 && abaAtiva <= 11) {
    const mesIdx = abaAtiva;
    if (typeof addLancamentoUnificado === 'function') addLancamentoUnificado(mesIdx);
    return;
  }
});

function mostrarAtalhos() {
  const existing = document.getElementById('modal-atalhos');
  if (existing) { existing.remove(); return; }
  const el = document.createElement('div');
  el.id = 'modal-atalhos';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  el.onclick = () => el.remove();
  const grupos = [
    { titulo: 'Navegação', itens: [
      ['D', 'Dashboard'],
      ['R', 'Orçamentos'],
      ['C', 'Clientes'],
      ['S', 'Resumo Anual'],
    ]},
    { titulo: 'Ações', itens: [
      ['N', 'Novo item (contexto)'],
      ['F  /  Ctrl+K', 'Busca global'],
      ['+', 'Novo lançamento (mês)'],
      ['← →', 'Mês anterior / próximo'],
      ['Esc', 'Fechar modal'],
      ['? / /', 'Este painel'],
    ]},
    { titulo: 'Campos', itens: [
      ['Enter', 'Próximo campo'],
      ['Tab', 'Próximo campo'],
    ]},
  ];
  el.innerHTML = '<div onclick="event.stopPropagation()" style="background:var(--color-surface);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;max-width:480px;width:100%">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    + '<div style="font-size:.9rem;font-weight:700;letter-spacing:1px">ATALHOS DE TECLADO</div>'
    + '<button onclick="document.getElementById(&quot;modal-atalhos&quot;).remove()" style="background:transparent;border:none;color:var(--color-text-muted);font-size:1.2rem;cursor:pointer">&#x2715;</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
    + grupos.map(g => '<div>'
        + '<div style="font-size:.65rem;letter-spacing:1px;color:var(--color-text-muted);margin-bottom:8px;font-weight:600">' + g.titulo.toUpperCase() + '</div>'
        + g.itens.map(([key, desc]) => '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
          + '<kbd style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:5px;padding:2px 8px;font-size:.72rem;font-family:monospace;color:var(--color-text-primary)">' + key + '</kbd>'
          + '<span style="font-size:.75rem;color:var(--color-text-muted)">' + desc + '</span>'
          + '</div>').join('')
      + '</div>').join('')
    + '</div>'
    + '<div style="margin-top:14px;font-size:.68rem;color:var(--color-text-muted);text-align:center">Pressione ? ou / para abrir/fechar</div>'
    + '</div>';
  document.body.appendChild(el);
}

// ═══════════════════════════════════════════
