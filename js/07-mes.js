// RENDER MÊS
// ═══════════════════════════════════════════
function renderMes(m) {
  const mes  = dados[m];
  const calc = calcularMes(m);
  const tend = tendencia(m);
  const main = document.getElementById('mainContent');

  // Tendência badge
  let tendBadge = '';
  if (tend) {
    if (tend.up) tendBadge = `<span class="tendencia-badge tend-up">▲ ${tend.pct}% vs mês ant.</span>`;
    else         tendBadge = `<span class="tendencia-badge tend-down">▼ ${Math.abs(tend.pct)}% vs mês ant.</span>`;
  }

  // Alertas
  let alertas = '';
  if (calc.vazio) alertas += `<div class="alerta-mes">Nenhum lançamento registrado neste mês.</div>`;
  if (!calc.vazio && calc.totalLiquido < 0) alertas += `<div class="alerta-liquido-neg">Atenção: Lucro Líquido negativo — as saídas superam as entradas em ${fmt(Math.abs(calc.totalLiquido))}.</div>`;
  // Alerta de despesas acima do normal (compara com média dos 3 meses anteriores)
  if (!calc.vazio && m >= 1) {
    const mesesAnt = [m-1, m-2, m-3].filter(i => i >= 0);
    const mediaSaidas = mesesAnt.reduce((s,i) => s + calcularMes(i).totalSaidas, 0) / (mesesAnt.length || 1);
    if (mediaSaidas > 0 && calc.totalSaidas > mediaSaidas * 1.2) {
      const pctAcima = Math.round(((calc.totalSaidas / mediaSaidas) - 1) * 100);
      alertas += `<div class="alerta-liquido-neg">Despesas ${pctAcima}% acima da média dos últimos meses (média: ${fmt(mediaSaidas)}).</div>`;
    }
  }

  // Filtro variáveis
  const varFiltradas = filtroCategoria === 'Todos'
    ? mes.variaveis
    : mes.variaveis.filter(v => v.cat === filtroCategoria);

  // Ordenar por data (se tiver)
  // Helper para agrupar lançamentos por data
  const agruparPorData = (arr) => {
    const grupos = {};
    arr.forEach(item => {
      const d = item.data || '';
      if (!grupos[d]) grupos[d] = [];
      grupos[d].push(item);
    });
    return grupos;
  };

  const fmtDataGrupo = d => {
    if (!d) return 'Sem data';
    try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {weekday:'short', day:'2-digit', month:'2-digit', year:'numeric'}); }
    catch(e) { return d; }
  };

  const ordenarPorData = arr => [...arr].sort((a,b) => {
    if (!a.data && !b.data) return 0;
    if (!a.data) return 1; if (!b.data) return -1;
    return b.data.localeCompare(a.data); // decrescente: mais recente em cima
  });

  const entradasOrd = ordenarPorData(mes.entradas);
  const fixosOrd    = ordenarPorData(mes.fixos);
  const varOrdenadas = ordenarPorData(varFiltradas);

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter',sans-serif;font-size:1.35rem;letter-spacing:.5px;color:var(--color-primary-hover)">${MESES[m]}</span>
      ${tendBadge}
      <div class="toolbar-right">
        <span class="save-status" id="saveStatus">✓ SALVO</span>
        <button class="btn btn-duplic" onclick="duplicarFixosMesAnterior(${m})">Copiar Fixos Mês Ant.</button>
        <button class="btn btn-export" onclick="exportarCSV(${m})">CSV</button>
      </div>
    </div>

    ${alertas}

    ${(function(){
      // Comparativo com mesmo mês do ano anterior
      const anoAtualNum = parseInt(document.getElementById('anoGlobal') ? document.getElementById('anoGlobal').value : new Date().getFullYear());
      const anoAnterior = anoAtualNum - 1;
      const mesNome = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][m];
      const dadosAnt = (typeof dadosTodos !== 'undefined' && dadosTodos[anoAnterior]) ? dadosTodos[anoAnterior][m] : null;
      if (!dadosAnt) return '';
      const calcAnt = calcularMesComDados(m, dadosAnt);
      const diffBruto = calc.totalBruto - calcAnt.totalBruto;
      const diffLiq = calc.totalLiquido - calcAnt.totalLiquido;
      const pctBruto = calcAnt.totalBruto > 0 ? ((diffBruto/calcAnt.totalBruto)*100).toFixed(1) : null;
      const pctLiq = calcAnt.totalBruto > 0 ? ((diffLiq/calcAnt.totalBruto)*100).toFixed(1) : null;
      const corB = diffBruto >= 0 ? '#5cab84' : '#eab7b7';
      const corL = diffLiq >= 0 ? '#5cab84' : '#eab7b7';
      const seta = v => v >= 0 ? '▲' : '▼';
      return '<div style="background:rgba(42,42,45,.5);border:1px solid var(--color-border);border-radius:10px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
        + '<span style="font-size:.7rem;color:var(--color-text-muted);letter-spacing:1px">VS ' + mesNome.toUpperCase() + '/' + anoAnterior + ':</span>'
        + '<span style="font-size:.78rem;color:' + corB + '">' + seta(diffBruto) + ' Entradas: ' + fmt(calcAnt.totalBruto) + (pctBruto?' ('+pctBruto+'%)':'') + '</span>'
        + '<span style="font-size:.78rem;color:' + corL + '">' + seta(diffLiq) + ' Lucro: ' + fmt(calcAnt.totalLiquido) + (pctLiq?' ('+pctLiq+'%)':'') + '</span>'
        + '</div>';
    })()}

    <div class="resumo-cards">
      <div class="card saidas">
        <div class="card-label">Total de Saídas</div>
        <div class="card-valor" id="card-saidas">${fmt(calc.totalSaidas)}</div>
        <div class="card-sub">Fixas: ${fmt(calc.totalFixos)} | Var: ${fmt(calc.totalVar)}</div>
        <div class="card-icon"></div>
      </div>
      <div class="card bruto">
        <div class="card-label">Lucro Bruto (Entradas)</div>
        <div class="card-valor" id="card-bruto">${fmt(calc.totalBruto)}</div>
        <div class="card-icon"></div>
      </div>
      <div class="card liquido">
        <div class="card-label">Lucro Líquido</div>
        <div class="card-valor" id="card-liquido" style="color:${calc.totalLiquido>=0?'var(--verde)':'var(--vermelho)'}">${fmt(calc.totalLiquido)}</div>
        <div class="card-icon"></div>
      </div>
    </div>

    <!-- OBSERVAÇÕES DO MÊS -->
    <div class="obs-mes-wrap">
      <div class="obs-mes-label">Observações do Mês</div>
      <textarea class="obs-textarea" placeholder="Anotações, lembretes, observações do mês..." oninput="dados[${m}].obs=this.value;salvarDados()">${mes.obs||''}</textarea>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-add" onclick="addLancamentoUnificado(${m})" style="background:rgba(255,255,255,0.075);border:1px solid rgba(255,255,255,0.2);color:#adadb0;font-size:.88rem;padding:9px 18px">
        + Novo Lançamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
      </button>
    </div>
    <div class="secoes" style="display:flex;flex-direction:column;gap:14px">

      <!-- EXTRATO UNIFICADO -->
      <div class="secao" style="grid-column:1/-1">
        <div class="secao-header">
          <div class="secao-titulo" style="color:#adadb0">Extrato do Mês</div>
          <div class="secao-header-btns">
            <button class="btn btn-ordenar btn-sm" onclick="ordenarSalvar(${m},'entradas');ordenarSalvar(${m},'variaveis')">Data</button>
          </div>
        </div>
        <div class="secao-body">
          ${(function(){
            // Juntar entradas e saídas variáveis com tipo
            const todasEntradas = (mes.entradas||[]).map(function(e,idx){ const o={}; for(var k in e) o[k]=e[k]; o._tipo='entrada'; o._idx=idx; return o; });
            const todasSaidas   = (mes.variaveis||[]).map(function(v,idx){ const o={}; for(var k in v) o[k]=v[k]; o._tipo='saida'; o._idx=idx; return o; });
            const todasFixas    = (mes.fixos||[]).map(function(f,idx){ const o={}; for(var k in f) o[k]=f[k]; o._tipo='saida'; o._origem='fixo'; o._idx=idx; if(o.desc===undefined) o.desc=o.nome; return o; });
            let todos = todasEntradas.concat(todasSaidas).concat(todasFixas);
            if (filtroFormaPgto !== 'Todos') todos = todos.filter(function(l){ return l.formaPgto === filtroFormaPgto; });
            todos = todos.sort(function(a,b){
              const da = (a.data||'9999')+(a.hora||'00:00');
              const db = (b.data||'9999')+(b.hora||'00:00');
              return db.localeCompare(da); // mais recente primeiro
            });

            if (!todos.length) return '<div class="orc-vazio">Nenhum lançamento registrado.</div>';

            // Separar não pagos (ficam no topo)
            // Agrupar por data
            const grupos = {};
            todos.forEach(function(l) {
              const d = l.data || 'sem-data';
              if (!grupos[d]) grupos[d] = [];
              grupos[d].push(l);
            });

            const datas = Object.keys(grupos).sort().reverse();
            const pagAtual = extratoPaginas[m] || 1;
            const datasVisiveis = datas.slice(0, pagAtual * EXTRATO_PAGE);
            const temMais = datas.length > datasVisiveis.length;

            return datasVisiveis.map(function(d) {

              const itens = grupos[d];
              const totalE = itens.filter(function(l){return l._tipo==='entrada';}).reduce(function(s,l){return s+num(l.valor)+num(l.valor2);},0);
              const totalS = itens.filter(function(l){return l._tipo==='saida';}).reduce(function(s,l){return s+num(l.valor)+num(l.valor2);},0);
              const saldo = totalE - totalS;
              const grpId = 'grp-ext-' + m + '-' + (d||'sd').replace(/-/g,'');

              return '<div style="margin-bottom:8px">'
                + '<div onclick="toggleGrupo(&quot;' + grpId + '&quot;)" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;cursor:pointer">'
                + '<div style="display:flex;align-items:center;gap:10px">'
                + '<span style="font-size:.8rem;font-weight:700">' + fmtDataGrupo(d) + '</span>'
                + '<span style="font-size:.65rem;color:var(--color-text-muted)">' + itens.length + ' lançamento(s)</span>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:14px">'
                + '<span style="font-size:.7rem;color:#5cab84">↑ ' + fmt(totalE) + '</span>'
                + '<span style="font-size:.7rem;color:#eab7b7">↓ ' + fmt(totalS) + '</span>'
                + '<span style="font-size:.72rem;font-weight:700;color:' + (saldo>=0?'#5cab84':'#eab7b7') + '">' + (saldo>=0?'+':'') + fmt(saldo) + '</span>'
                + '<span id="arr-' + grpId + '" style="color:var(--color-text-muted);font-size:.7rem">▶</span>'
                + '</div>'
                + '</div>'
                + '<div id="' + grpId + '" style="display:none;margin-top:4px">'
                + '<div style="display:flex;flex-direction:column;gap:4px">'
                + itens.map(function(l) {
                    const isE = l._tipo === 'entrada';
                    const isFixa = l._origem === 'fixo';
                    const cor = isE ? '#5cab84' : '#eab7b7';
                    const bg  = isE ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.03)';
                    const borda = isE ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.075)';
                    const i = l._idx !== undefined ? l._idx : (isE ? mes.entradas.indexOf(l) : mes.variaveis.indexOf(l));
                    const arrNome = isE ? 'entradas' : (isFixa ? 'fixos' : 'variaveis');
                    const campoDesc = isFixa ? 'nome' : 'desc';
                    const descConf = (l.desc||l.nome||'sem descrição').replace(/'/g,'&#39;');
                    const fnExcluir = isE ? 'removeEntrada('+m+','+i+')' : (isFixa ? 'removeFixo('+m+','+i+')' : 'removeVariavel('+m+','+i+')');

                    return '<div style="background:'+bg+';border:1px solid '+borda+';border-radius:8px;padding:8px 10px">'
                      // linha 1: badge + data + hora + checkbox(saida) + excluir
                      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
                      + '<span style="font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:4px;background:'+cor+'22;color:'+cor+';border:1px solid '+cor+'44;white-space:nowrap">'+(isE?'↑ ENTRADA':(isFixa?'SAÍDA FIXA':'↓ SAÍDA'))+'</span>'
                      + '<input type="date" value="'+(l.data||'')+'" style="font-size:.72rem;padding:3px 6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].'+arrNome+'['+i+'].data=this.value;recalcular('+m+')" onblur="salvarDados()"/>'
                      + '<input type="time" value="'+(l.hora||'')+'" style="font-size:.72rem;padding:3px 6px;width:86px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].'+arrNome+'['+i+'].hora=this.value;recalcular('+m+')" onblur="salvarDados()"/>'

                      + '<button class="btn btn-del btn-sm" onclick="confirmarExclusao(\''+descConf+'\',()=>'+fnExcluir+')" style="margin-left:auto">✕</button>'
                      + '</div>'
                      // linha 2: descrição + valor + categoria/forma
                      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">'
                      + '<input type="text" value="'+(l[campoDesc]||'').replace(/"/g,'&quot;')+'" placeholder="Descrição..." style="flex:1;font-size:.8rem;padding:4px 8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].'+arrNome+'['+i+'].'+campoDesc+'=this.value" onblur="salvarDados()"/>'
                      + '<input type="number" class="valor" value="'+(l.valor||'')+'" placeholder="0,00" min="0" step="0.01" style="width:90px;font-size:.82rem;font-weight:700;color:'+cor+';padding:4px 8px;background:var(--color-surface);border:1px solid '+cor+'33;border-radius:6px" oninput="dados['+m+'].'+arrNome+'['+i+'].valor=this.value;recalcular('+m+')" onblur="salvarDados()"/>'
                      + '</div>'
                      // linha 3: select de categoria ou forma de pagamento (não se aplica a fixas)
                      + (isE
                        ? '<select style="width:100%;font-size:.75rem;padding:4px 8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" onchange="dados['+m+'].entradas['+i+'].formaPgto=this.value;recalcular('+m+');salvarDados()">'
                          + '<option value=""'+(!l.formaPgto?' selected':'')+'>— Forma de pagamento —</option>'
                          + '<option value="Dinheiro"'+(l.formaPgto==='Dinheiro'?' selected':'')+'>Dinheiro</option>'
                          + '<option value="PIX"'+(l.formaPgto==='PIX'?' selected':'')+'>PIX</option>'
                          + '<option value="Crédito"'+(l.formaPgto==='Crédito'?' selected':'')+'>Crédito</option>'
                          + '<option value="Débito"'+(l.formaPgto==='Débito'?' selected':'')+'>Débito</option>'
                          + '</select>'
                          + (l.valor2!==undefined
                            ? '<div style="display:flex;align-items:center;gap:4px;margin-top:4px">'
                              + '<select onchange="dados['+m+'].entradas['+i+'].formaPgto2=this.value;salvarDados()" style="flex:1;font-size:.72rem;padding:4px 6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)">'
                              + '<option value=""'+(!l.formaPgto2?' selected':'')+'>— 2ª forma —</option>'
                              + '<option value="Dinheiro"'+(l.formaPgto2==='Dinheiro'?' selected':'')+'>Dinheiro</option>'
                              + '<option value="PIX"'+(l.formaPgto2==='PIX'?' selected':'')+'>PIX</option>'
                              + '<option value="Crédito"'+(l.formaPgto2==='Crédito'?' selected':'')+'>Crédito</option>'
                              + '<option value="Débito"'+(l.formaPgto2==='Débito'?' selected':'')+'>Débito</option>'
                              + '</select>'
                              + '<input type="number" value="'+(l.valor2||'')+'" placeholder="0,00" min="0" step="0.01" title="Valor pago na 2ª forma" style="width:70px;font-size:.72rem;padding:4px 6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].entradas['+i+'].valor2=this.value;recalcular('+m+')" onblur="salvarDados()"/>'
                              + '<span onclick="delete dados['+m+'].entradas['+i+'].valor2;delete dados['+m+'].entradas['+i+'].formaPgto2;recalcular('+m+');salvarDados();renderAll()" style="cursor:pointer;color:var(--color-text-muted);font-size:.7rem" title="Remover divisão">✕</span>'
                              + '</div>'
                            : '<div onclick="dados['+m+'].entradas['+i+'].valor2=\'\';dados['+m+'].entradas['+i+'].formaPgto2=\'\';renderAll()" style="cursor:pointer;font-size:.68rem;color:var(--color-text-muted);margin-top:4px">Dividir em 2 formas de pagamento</div>')
                        : (isFixa
                          ? '<label style="display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--color-text-muted)">'
                            + neonChk((l.pago?'checked ':'') + 'onchange="dados['+m+'].fixos['+i+'].pago=this.checked;recalcular('+m+');salvarDados()"')
                            + ' Paga</label>'
                          : '<select onchange="dados['+m+'].variaveis['+i+'].cat=this.value;recalcular('+m+');salvarDados()" style="width:100%;font-size:.75rem;padding:4px 8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)">'
                          + CATEGORIAS.map(function(c){return '<option value="'+c+'"'+(l.cat===c?' selected':'')+'>'+c+'</option>';}).join('')
                          + '</select>'
                          + '<select onchange="dados['+m+'].variaveis['+i+'].formaPgto=this.value;recalcular('+m+');salvarDados()" style="width:100%;font-size:.75rem;padding:4px 8px;margin-top:4px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)">'
                          + '<option value=""'+(!l.formaPgto?' selected':'')+'>— Forma de pagamento —</option>'
                          + '<option value="Dinheiro"'+(l.formaPgto==='Dinheiro'?' selected':'')+'>Dinheiro</option>'
                          + '<option value="PIX"'+(l.formaPgto==='PIX'?' selected':'')+'>PIX</option>'
                          + '<option value="Crédito"'+(l.formaPgto==='Crédito'?' selected':'')+'>Crédito</option>'
                          + '<option value="Débito"'+(l.formaPgto==='Débito'?' selected':'')+'>Débito</option>'
                          + '</select>'
                          + (l.valor2!==undefined
                            ? '<div style="display:flex;align-items:center;gap:4px;margin-top:4px">'
                              + '<select onchange="dados['+m+'].variaveis['+i+'].formaPgto2=this.value;salvarDados()" style="flex:1;font-size:.72rem;padding:4px 6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)">'
                              + '<option value=""'+(!l.formaPgto2?' selected':'')+'>— 2ª forma —</option>'
                              + '<option value="Dinheiro"'+(l.formaPgto2==='Dinheiro'?' selected':'')+'>Dinheiro</option>'
                              + '<option value="PIX"'+(l.formaPgto2==='PIX'?' selected':'')+'>PIX</option>'
                              + '<option value="Crédito"'+(l.formaPgto2==='Crédito'?' selected':'')+'>Crédito</option>'
                              + '<option value="Débito"'+(l.formaPgto2==='Débito'?' selected':'')+'>Débito</option>'
                              + '</select>'
                              + '<input type="number" value="'+(l.valor2||'')+'" placeholder="0,00" min="0" step="0.01" title="Valor pago na 2ª forma" style="width:70px;font-size:.72rem;padding:4px 6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].variaveis['+i+'].valor2=this.value;recalcular('+m+')" onblur="salvarDados()"/>'
                              + '<span onclick="delete dados['+m+'].variaveis['+i+'].valor2;delete dados['+m+'].variaveis['+i+'].formaPgto2;recalcular('+m+');salvarDados();renderAll()" style="cursor:pointer;color:var(--color-text-muted);font-size:.7rem" title="Remover divisão">✕</span>'
                              + '</div>'
                            : '<div onclick="dados['+m+'].variaveis['+i+'].valor2=\'\';dados['+m+'].variaveis['+i+'].formaPgto2=\'\';renderAll()" style="cursor:pointer;font-size:.68rem;color:var(--color-text-muted);margin-top:4px">Dividir em 2 formas de pagamento</div>')))
                      + '</div>';
                  }).join('')
                + '</div></div></div>';
            }).join('')
            + (temMais ? '<div style="text-align:center;padding:10px 0">'
              + '<button onclick="extratoPaginas[' + m + ']=' + (pagAtual+1) + ';renderAll()" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:8px;padding:7px 20px;font-size:.75rem;cursor:pointer">Ver mais (' + (datas.length - datasVisiveis.length) + ' dia(s) restante(s))</button>'
              + '</div>' : '')
            + '<div style="display:flex;justify-content:space-between;padding:10px 4px;border-top:1px solid rgba(255,255,255,.06);margin-top:4px">'
            + '<span style="font-size:.72rem;letter-spacing:1px;color:var(--color-text-muted)">TOTAL ENTRADAS <span id="extrato-total-entradas-' + m + '" style="color:#5cab84">' + fmt(calc.totalBruto) + '</span></span>'
            + '<span style="font-size:.72rem;letter-spacing:1px;color:var(--color-text-muted)">TOTAL SAÍDAS <span id="extrato-total-saidas-' + m + '" style="color:#eab7b7">' + fmt(calc.totalSaidas) + '</span></span>'
            + '<span style="font-size:.72rem;letter-spacing:1px;color:var(--color-text-muted)">RESULTADO <span id="extrato-resultado-' + m + '" style="color:' + (calc.totalLiquido>=0?'#5cab84':'#eab7b7') + ';font-weight:700">' + fmt(calc.totalLiquido) + '</span></span>'
            + '</div>';
          })()}
        </div>
      </div>

      <!-- FILTRO CATEGORIAS (saídas variáveis) -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 2px">
        ${['Todos',...CATEGORIAS].map(function(c){
          var btnClass = 'filtro-btn' + (filtroCategoria===c?' ativo':'');
          var excBtn = c!=='Todos' ? '<span onclick="event.stopPropagation();categoriaExcluir(&quot;' + c + '&quot;)" style="font-size:.58rem;color:rgba(255,255,255,.3);cursor:pointer;margin-left:3px" title="Remover">✕</span>' : '';
          return '<button class="' + btnClass + '" onclick="filtroCategoria=&quot;' + c + '&quot;;renderAll()" style="display:inline-flex;align-items:center;gap:2px">' + c + excBtn + '</button>';
        }).join('')}
        <div style="display:inline-flex;gap:4px;align-items:center">
          <input id="nova-cat-input" type="text" placeholder="Nova categoria..." maxlength="30"
            onkeydown="if(event.key==='Enter'){categoriaAdicionar(this.value);this.value='';}"
            style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;padding:5px 10px;font-size:.75rem;outline:none;width:120px"/>
          <button onclick="categoriaAdicionar(document.getElementById('nova-cat-input').value);document.getElementById('nova-cat-input').value=''" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#5cab84;border-radius:8px;padding:5px 10px;font-size:.75rem;cursor:pointer;font-weight:700">+ Add</button>
        </div>
      </div>

      <!-- FILTRO FORMA DE PAGAMENTO -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:0 2px;margin-top:6px">
        <span style="font-size:.68rem;color:var(--color-text-muted);letter-spacing:1px">FORMA PGTO:</span>
        ${['Todos','Dinheiro','PIX','Crédito','Débito'].map(function(fp){
          var ativo = filtroFormaPgto===fp;
          return '<button onclick="filtroFormaPgto=&quot;' + fp + '&quot;;renderAll()" style="font-size:.7rem;padding:4px 10px;border-radius:6px;cursor:pointer;background:' + (ativo?'rgba(255,255,255,0.075)':'rgba(255,255,255,.04)') + ';border:1px solid ' + (ativo?'rgba(255,255,255,0.2)':'rgba(255,255,255,.08)') + ';color:' + (ativo?'#adadb0':'var(--color-text-muted)') + '">' + fp + '</button>';
        }).join('')}
      </div>

      <!-- SAÍDAS FIXAS -->
      <div class="secao" style="grid-column:1/-1">
        <div class="secao-header">
          <div class="secao-titulo saidas-fixas">Saídas Fixas</div>
          <div class="secao-header-btns">
            <button class="btn btn-ordenar btn-sm" onclick="ordenarSalvar(${m},'fixos')">Data</button>
            <button class="btn btn-add" onclick="addFixo(${m})">+ Adicionar<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
          </div>
        </div>
        <div class="secao-body">
          ${(function(){
            var aPagar = fixosOrd.filter(function(f){return !f.pago;});
            var pagas  = fixosOrd.filter(function(f){return f.pago;});
            function renderGrupoFixo(arr, pago) {
              var grupos = agruparPorData(arr);
              var datas  = Object.keys(grupos).sort().reverse();
              if (!datas.length) return '<div style="color:var(--color-text-muted);font-size:.78rem;padding:8px 0">Nenhum lançamento.</div>';
              return datas.map(function(d) {
                var itens = grupos[d];
                var totalDia = itens.reduce(function(s,f){return s+(parseFloat(f.valor)||0);},0);
                var grpId = 'grp-fix-' + m + '-' + (pago?'p':'a') + '-' + (d||'sd').replace(/-/g,'');
                return '<div style="margin-bottom:6px">'
                  + '<div onclick="toggleGrupo(&quot;' + grpId + '&quot;)" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer">'
                  + '<span style="font-size:.78rem;font-weight:700;color:#eab7b7">' + fmtDataGrupo(d) + '</span>'
                  + '<span style="font-size:.75rem;color:var(--color-text-muted)">' + itens.length + ' item(s) &nbsp;|&nbsp; <b style="color:#eab7b7">' + fmt(totalDia) + '</b> &nbsp;<span id="arr-' + grpId + '">▶</span></span>'
                  + '</div>'
                  + '<div id="' + grpId + '" style="display:none">'
                  + '<table class="tabela-mobile" style="margin-top:4px"><thead><tr><th class="col-data">Data</th><th>Hora</th><th>Descrição</th><th>Valor (R$)</th><th>Pago</th><th></th></tr></thead><tbody>'
                  + itens.map(function(f) {
                      var i = mes.fixos.indexOf(f);
                      var nomeConf = (f.nome||'este item').replace(/'/g,'&#39;');
                      return '<tr style="opacity:' + (pago?'.5':'.9') + '">'
                        + '<td class="col-data"><input type="date" value="' + (f.data||'') + '" oninput="dados[' + m + '].fixos[' + i + '].data=this.value;recalcular(' + m + ')" onblur="salvarDados()"/></td>'
                        + '<td style="min-width:90px"><input type="time" value="' + (f.hora||'') + '" style="font-size:.75rem;padding:4px 6px;width:90px" oninput="dados[' + m + '].fixos[' + i + '].hora=this.value;recalcular(' + m + ')" onblur="salvarDados()"/></td>'
                        + '<td><input type="text" class="descricao-fixed" value="' + (f.nome||'').replace(/"/g,'&quot;') + '" oninput="dados[' + m + '].fixos[' + i + '].nome=this.value;recalcular(' + m + ')"/></td>'
                        + '<td><input type="number" class="valor valor-vermelho" value="' + (f.valor||'') + '" placeholder="0,00" min="0" step="0.01" oninput="dados[' + m + '].fixos[' + i + '].valor=this.value;recalcular(' + m + ')" onblur="salvarDados()"/></td>'
                        + '<td style="text-align:center">' + neonChk((f.pago?'checked ':'') + 'onchange="dados[' + m + '].fixos[' + i + '].pago=this.checked;recalcular(' + m + ');salvarDados()"') + '</td>'
                        + '<td class="td-del"><button class="btn btn-del btn-sm" onclick="confirmarExclusao(\'' + nomeConf + '\',()=>removeFixo(' + m + ',' + i + '))">✕</button></td>'
                        + '</tr>';
                    }).join('')
                  + '</tbody></table></div></div>';
              }).join('');
            }
            return '<div style="font-size:.72rem;letter-spacing:1px;color:#eab7b7;margin-bottom:6px;font-weight:700">A PAGAR</div>'
              + renderGrupoFixo(aPagar, false)
              + '<div style="font-size:.72rem;letter-spacing:1px;color:#5cab84;margin:10px 0 6px;font-weight:700">PAGAS</div>'
              + renderGrupoFixo(pagas, true)
              + '<div style="text-align:right;padding:8px 4px;font-size:.72rem;letter-spacing:1px;color:var(--color-text-muted)">TOTAL FIXAS <span style="color:#eab7b7" id="total-fixos">' + fmt(calc.totalFixos) + '</span></div>';
          })()}
        </div>
      </div>

    </div>
  `;
}

// ═══════════════════════════════════════════
// RECALCULAR (sem re-render)
// ═══════════════════════════════════════════
function recalcular(m) {
  const calc = calcularMes(m);
  const s = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('card-saidas',fmt(calc.totalSaidas));
  s('card-bruto',fmt(calc.totalBruto));
  s('card-liquido',fmt(calc.totalLiquido));
  s('total-entradas',fmt(calc.totalBruto));
  s('total-fixos',fmt(calc.totalFixos));
  s('total-variaveis',fmt(calc.totalVar));
  s('extrato-total-entradas-'+m, fmt(calc.totalBruto));
  s('extrato-total-saidas-'+m, fmt(calc.totalSaidas));
  const resEl = document.getElementById('extrato-resultado-'+m);
  if (resEl) {
    resEl.textContent = fmt(calc.totalLiquido);
    resEl.style.color = calc.totalLiquido>=0?'#5cab84':'#eab7b7';
  }
  const liq = document.getElementById('card-liquido');
  if (liq) {
    liq.style.color = calc.totalLiquido>=0?'var(--verde)':'var(--vermelho)';
    liq.classList.toggle('card-liquido-pos', calc.totalLiquido >= 0);
    liq.classList.toggle('card-liquido-neg', calc.totalLiquido < 0);
  }
  salvarDados();
}

// ═══════════════════════════════════════════
// QUALIDADE DE VIDA — Enter navega campos / formato valor
// ═══════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const tag = e.target.tagName;
  if (tag !== 'INPUT' && tag !== 'SELECT') return;
  e.preventDefault();
  // Pega todos os inputs/selects editáveis da tabela
  const todos = Array.from(document.querySelectorAll(
    'input[type="text"], input[type="number"], input[type="date"], select'
  )).filter(el => !el.disabled && !el.readOnly && el.offsetParent !== null);
  const idx = todos.indexOf(e.target);
  if (idx >= 0 && idx < todos.length - 1) {
    todos[idx + 1].focus();
    if (todos[idx + 1].select) todos[idx + 1].select();
  }
});

// Formata valor ao sair do campo (blur)
document.addEventListener('blur', function(e) {
  if (!e.target || !e.target.classList) return;
  if (!e.target.classList.contains('valor')) return;
  const v = parseFloat(e.target.value);
  if (!isNaN(v) && v > 0) {
    e.target.value = v.toFixed(2);
  }
}, true);
function hojeISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return yyyy + '-' + mm + '-' + dd;
}

// Data padrão para um lançamento novo no mês m (do ano aberto):
// hoje, se for o mês/ano atual; senão o dia 1º daquele mês.
// CORREÇÃO: antes, ao lançar em outro mês, a data ficava como "hoje" (mês errado).
function dataPadraoDoMes(m) {
  const ano = parseInt(document.getElementById('anoGlobal').value) || new Date().getFullYear();
  const h = new Date();
  if (h.getFullYear() === ano && h.getMonth() === m) return hojeISO();
  return ano + '-' + String(m + 1).padStart(2, '0') + '-01';
}

function removeEntrada(m,i){
  const e = dados[m].entradas[i];
  window._registrarLog('ENTRADA_REMOVIDA', { mes: m, descricao: e.desc || '—', valor: e.valor, data: e.data });
  dados[m].entradas.splice(i,1); salvarDados(); renderAll();
}

function toggleGrupo(id) {
  const el = document.getElementById(id);
  const arr = document.getElementById('arr-' + id);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = '';
    if (arr) arr.textContent = '▼';
  } else {
    el.style.display = 'none';
    if (arr) arr.textContent = '▶';
  }
}

function addLancamentoUnificado(m) {
  const hoje = dataPadraoDoMes(m);
  const agora = new Date();
  const hora = agora.getHours().toString().padStart(2,'0')+':'+agora.getMinutes().toString().padStart(2,'0');
  const modal = document.createElement('div');
  modal.id='lancamento-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
  const catOpts=CATEGORIAS.map(c=>`<option value="${c}">${c}</option>`).join('');
  modal.innerHTML=`<div onclick="event.stopPropagation()" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:24px;width:100%;max-width:440px">
    <div style="font-family:'Inter',sans-serif;font-size:.9rem;letter-spacing:.5px;color:#adadb0;margin-bottom:16px">NOVO LANÇAMENTO</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button id="lnc-btn-e" onclick="lncSetTipo('entrada')"
        style="flex:1;padding:10px;border-radius:10px;font-weight:700;cursor:pointer;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#5cab84;font-size:.9rem">↑ Entrada</button>
      <button id="lnc-btn-sv" onclick="lncSetTipo('saida_var')"
        style="flex:1;padding:10px;border-radius:10px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);font-size:.9rem">↓ Saída</button>
      <button id="lnc-btn-sf" onclick="lncSetTipo('saida_fix')"
        style="flex:1;padding:10px;border-radius:10px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);font-size:.9rem">Fixa</button>
    </div>
    <input type="hidden" id="lnc-tipo" value="entrada"/>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="orc-field"><label>Descrição *</label><input id="lnc-desc" type="text" placeholder="Ex: Pagamento de serviço, Compra de peça..." autofocus/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="orc-field"><label>Valor (R$) *</label><input id="lnc-valor" type="number" min="0" step="0.01" placeholder="0,00"/></div>
        <div class="orc-field" id="lnc-campo-extra">
          <label>Forma de Pagamento</label>
          <select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%">
            <option value="">—</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="Crédito">Crédito</option>
            <option value="Débito">Débito</option>
          </select>
        </div>
        <div class="orc-field"><label>Data</label><input id="lnc-data" type="date" value="${hoje}"/></div>
        <div class="orc-field"><label>Hora</label><input id="lnc-hora" type="time" value="${hora}"/></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button onclick="document.getElementById('lancamento-modal').remove()" style="flex:1;padding:10px;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;cursor:pointer">Cancelar</button>
      <button id="lnc-btn-salvar" onclick="confirmarLancamentoUnificado(${m})" style="flex:2;padding:10px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#5cab84;border-radius:8px;cursor:pointer;font-weight:700">✓ Salvar Entrada</button>
    </div>
  </div>`;
  modal.onclick=()=>modal.remove();
  document.body.appendChild(modal);
  setTimeout(()=>document.getElementById('lnc-desc')?.focus(),50);
}

function lncSetTipo(tipo) {
  document.getElementById('lnc-tipo').value = tipo;
  const btnE = document.getElementById('lnc-btn-e');
  const btnSV = document.getElementById('lnc-btn-sv');
  const btnSF = document.getElementById('lnc-btn-sf');
  const campoExtra = document.getElementById('lnc-campo-extra');
  const extraVal = document.getElementById('lnc-extra-val');
  const btnSalvar = document.getElementById('lnc-btn-salvar');
  // Reset todos
  [btnE, btnSV, btnSF].forEach(b => { b.style.background='rgba(255,255,255,.04)'; b.style.border='1px solid rgba(255,255,255,.1)'; b.style.color='var(--color-text-muted)'; });
  if (tipo === 'entrada') {
    btnE.style.background='rgba(255,255,255,0.1)'; btnE.style.border='1px solid rgba(255,255,255,0.2)'; btnE.style.color='#5cab84';
    campoExtra.innerHTML = '<label>Forma de Pagamento</label><select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%"><option value="">—</option><option value="Dinheiro">Dinheiro</option><option value="PIX">PIX</option><option value="Crédito">Crédito</option><option value="Débito">Débito</option></select>';
    btnSalvar.textContent = '✓ Salvar Entrada'; btnSalvar.style.background='rgba(255,255,255,0.1)'; btnSalvar.style.border='1px solid rgba(255,255,255,0.2)'; btnSalvar.style.color='#5cab84';
  } else if (tipo === 'saida_var') {
    btnSV.style.background='rgba(255,255,255,0.1)'; btnSV.style.border='1px solid rgba(255,255,255,0.2)'; btnSV.style.color='#eab7b7';
    const catOpts = CATEGORIAS.map(c=>`<option value="${c}">${c}</option>`).join('');
    campoExtra.innerHTML = '<label>Categoria</label><select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%">' + catOpts + '</select>';
    btnSalvar.textContent = '✓ Salvar Saída'; btnSalvar.style.background='rgba(255,255,255,0.1)'; btnSalvar.style.border='1px solid rgba(255,255,255,0.2)'; btnSalvar.style.color='#eab7b7';
  } else {
    btnSF.style.background='rgba(255,255,255,0.075)'; btnSF.style.border='1px solid rgba(255,255,255,0.15)'; btnSF.style.color='#eab7b7';
    campoExtra.innerHTML = '<label>— Extra</label><select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%"><option value="">—</option></select>';
    btnSalvar.textContent = '✓ Salvar Fixa'; btnSalvar.style.background='rgba(255,255,255,0.075)'; btnSalvar.style.border='1px solid rgba(255,255,255,0.15)'; btnSalvar.style.color='#eab7b7';
  }
}

function confirmarLancamentoUnificado(m) {
  const tipo  = document.getElementById('lnc-tipo')?.value||'entrada';
  const desc  = (document.getElementById('lnc-desc')?.value||'').trim();
  const valor = document.getElementById('lnc-valor')?.value||'';
  const extra = document.getElementById('lnc-extra-val')?.value||'';
  const data  = document.getElementById('lnc-data')?.value||hojeISO();
  const hora  = document.getElementById('lnc-hora')?.value||'';
  if(!desc){mostrarToast('Informe a descrição');return;}
  if(!valor||parseFloat(valor)<=0){mostrarToast('Informe um valor válido');return;}
  // CORREÇÃO: o lançamento ia para o mês da aba aberta, mesmo com data de outro mês.
  const _anoAberto = parseInt(document.getElementById('anoGlobal').value) || new Date().getFullYear();
  const _p = /^(\d{4})-(\d{2})-\d{2}$/.exec(data);
  if (_p) {
    const _ano = parseInt(_p[1]), _mes = parseInt(_p[2]) - 1;
    if (_ano !== _anoAberto) { mostrarErro('Essa data é de ' + _ano + '. Troque o ano lá em cima para ' + _ano + ' antes de lançar.'); return; }
    if (_mes !== m && _mes >= 0 && _mes <= 11) { m = _mes; setTimeout(() => mostrarToast('Lançado em ' + MESES[m] + ' (mês da data)'), 2600); }
  }
  if(tipo==='entrada'){
    dados[m].entradas.push({data,hora,desc,valor,formaPgto:extra,_id:_gerarId('e')});
    window._registrarLog('ENTRADA_ADICIONADA',{mes:m,desc,valor,data});
  } else if(tipo==='saida_var'){
    dados[m].variaveis.push({data,hora,desc,valor,cat:extra||'Outros',pago:false,_id:_gerarId('v')});
    window._registrarLog('SAIDA_ADICIONADA',{mes:m,desc,valor,data});
  } else {
    if(!dados[m].fixos) dados[m].fixos=[];
    dados[m].fixos.push({data,hora,nome:desc,valor,pago:false,_id:_gerarId('f')});
    window._registrarLog('FIXO_ADICIONADO',{mes:m,nome:desc,valor,data});
  }
  salvarDados();
  document.getElementById('lancamento-modal')?.remove();
  renderAll();
  // Abrir o grupo do dia após render
  setTimeout(()=>{
    let grpId;
    if(tipo==='entrada') grpId='grp-ent-'+m+'-'+data.replace(/-/g,'');
    else if(tipo==='saida_var') grpId='grp-var-'+m+'-a-'+data.replace(/-/g,'');
    else grpId='grp-fix-'+m+'-a-'+data.replace(/-/g,'');
    const grp=document.getElementById(grpId);
    if(grp && grp.style.display==='none'){grp.style.display='';const arr=document.getElementById('arr-'+grpId);if(arr)arr.textContent='▼';}
  },80);
  mostrarToast('✓ Lançamento salvo!');
}

function addEntrada(m) {
  const hoje = dataPadraoDoMes(m);
  const agora = new Date();
  const hora = agora.getHours().toString().padStart(2,'0') + ':' + agora.getMinutes().toString().padStart(2,'0');
  dados[m].entradas.push({data: hoje, hora: hora, desc:'', valor:'', formaPgto:'', _id:_gerarId('e')});
  window._registrarLog('ENTRADA_ADICIONADA', { mes: m, data: hoje });
  salvarDados();
  renderAll();
  recalcular(m);
  // Abre o grupo do dia de hoje e foca na nova linha
  setTimeout(() => {
    const grpId = 'grp-ext-' + m + '-' + hoje.replace(/-/g,'');
    const grp = document.getElementById(grpId);
    if (grp && grp.style.display === 'none') {
      grp.style.display = '';
      const arr = document.getElementById('arr-' + grpId);
      if (arr) arr.textContent = '▼';
    }
    if (grp) {
      const rows = grp.querySelectorAll('tr');
      const last = rows[rows.length - 1];
      if (last) { const inp = last.querySelector('input[type="text"]'); if (inp) inp.focus(); }
    }
  }, 60);
}


function addVariavel(m) {
  const hoje = dataPadraoDoMes(m);
  const agora = new Date();
  const hora = agora.getHours().toString().padStart(2,'0') + ':' + agora.getMinutes().toString().padStart(2,'0');
  dados[m].variaveis.push({data: hoje, hora: hora, desc:'', cat:'Outros', valor:'', formaPgto:'', _id:_gerarId('v')});
  window._registrarLog('SAIDA_ADICIONADA', { mes: m, data: hoje });
  salvarDados();
  renderAll();
  recalcular(m);
  // Abre o grupo do dia de hoje e foca na nova linha
  setTimeout(() => {
    // Grupo pode ser "a pagar" (não pago)
    const grpId = 'grp-ext-' + m + '-' + hoje.replace(/-/g,'');
    const grp = document.getElementById(grpId);
    if (grp && grp.style.display === 'none') {
      grp.style.display = '';
      const arr = document.getElementById('arr-' + grpId);
      if (arr) arr.textContent = '▼';
    }
    if (grp) {
      const rows = grp.querySelectorAll('tr');
      const last = rows[rows.length - 1];
      if (last) { const inp = last.querySelector('input[type="text"]'); if (inp) inp.focus(); }
    }
  }, 60);
}
function addFixo(m) {
  const hoje = dataPadraoDoMes(m);
  if (!dados[m].fixos) dados[m].fixos = [];
  dados[m].fixos.unshift({data: hoje, nome:'', valor:'', pago: false, _id:_gerarId('f')});
  window._registrarLog('FIXO_ADICIONADO', { mes: m, data: hoje });
  salvarDados();
  renderAll();
  setTimeout(() => {
    const grpId = 'grp-fix-' + m + '-a-' + hoje.replace(/-/g,'');
    const grp = document.getElementById(grpId);
    if (grp && grp.style.display === 'none') {
      grp.style.display = '';
      const arr = document.getElementById('arr-' + grpId);
      if (arr) arr.textContent = '▼';
    }
    if (grp) {
      const inp = grp.querySelector('input[type="text"]');
      if (inp) inp.focus();
    }
  }, 60);
}

function removeFixo(m, i) {
  dados[m].fixos.splice(i, 1);
  window._registrarLog('FIXO_REMOVIDO', { mes: m });
  salvarDados();
  renderAll();
}


function removeVariavel(m,i){
  const v = dados[m].variaveis[i];
  window._registrarLog('SAIDA_REMOVIDA', { mes: m, descricao: v.desc || '—', valor: v.valor, categoria: v.cat, data: v.data });
  dados[m].variaveis.splice(i,1); salvarDados(); renderAll();
}

function ordenarSalvar(m, campo) {
  dados[m][campo].sort((a,b) => {
    const da = (a.data||'')+(a.hora?'T'+a.hora:'T00:00');
    const db = (b.data||'')+(b.hora?'T'+b.hora:'T00:00');
    if(!a.data&&!b.data) return 0;
    if(!a.data) return 1;
    if(!b.data) return -1;
    return da.localeCompare(db);
  });
  salvarDados(); renderAll();
  mostrarToast('✓ Ordenado por data e horário');
}

function duplicarFixosMesAnterior(m) {
  if (m === 0) { mostrarToast('Janeiro não possui mês anterior.'); return; }
  const ant = dados[m-1].fixos;
  dados[m].fixos = ant.map(f => ({ ...f, data:'' }));
  salvarDados(); renderAll();
  mostrarToast('✓ Saídas fixas copiadas de ' + MESES[m-1]);
}

// ═══════════════════════════════════════════
