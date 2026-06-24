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
  if (calc.vazio) alertas += `<div class="alerta-mes">⚠️ Nenhum lançamento registrado neste mês.</div>`;
  if (!calc.vazio && calc.totalLiquido < 0) alertas += `<div class="alerta-liquido-neg">🔴 Atenção: Lucro Líquido negativo — as saídas superam as entradas em ${fmt(Math.abs(calc.totalLiquido))}.</div>`;
  // Alerta de despesas acima do normal (compara com média dos 3 meses anteriores)
  if (!calc.vazio && m >= 1) {
    const mesesAnt = [m-1, m-2, m-3].filter(i => i >= 0);
    const mediaSaidas = mesesAnt.reduce((s,i) => s + calcularMes(i).totalSaidas, 0) / (mesesAnt.length || 1);
    if (mediaSaidas > 0 && calc.totalSaidas > mediaSaidas * 1.2) {
      const pctAcima = Math.round(((calc.totalSaidas / mediaSaidas) - 1) * 100);
      alertas += `<div class="alerta-liquido-neg">🔺 Despesas ${pctAcima}% acima da média dos últimos meses (média: ${fmt(mediaSaidas)}).</div>`;
    }
  }
  // Alerta de estoque baixo
  const itensBaixoEstoque = estoque.filter(p => (parseFloat(p.qtd)||0) <= (parseFloat(p.minimo)||0) && (parseFloat(p.minimo)||0) > 0);
  if (itensBaixoEstoque.length > 0) {
    alertas += `<div class="alerta-mes" style="background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3);color:#fbbf24">⚠️ ${itensBaixoEstoque.length} item(s) com estoque baixo: ${itensBaixoEstoque.slice(0,3).map(p=>p.nome).join(', ')}${itensBaixoEstoque.length>3?'...':''}. <span style="cursor:pointer;text-decoration:underline" onclick="abaAtiva=14;renderAll()">Ver estoque</span></div>`;
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
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:var(--color-primary-hover)">${MESES[m]}</span>
      ${tendBadge}
      <div class="toolbar-right">
        <span class="save-status" id="saveStatus">✓ SALVO</span>
        <button class="btn btn-duplic" onclick="duplicarFixosMesAnterior(${m})">📋 Copiar Fixos Mês Ant.</button>
        <button class="btn btn-export" onclick="exportarCSV(${m})">📥 CSV</button>
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
      const corB = diffBruto >= 0 ? '#34d399' : '#fca5a5';
      const corL = diffLiq >= 0 ? '#34d399' : '#fca5a5';
      const seta = v => v >= 0 ? '▲' : '▼';
      return '<div style="background:rgba(13,35,71,.5);border:1px solid var(--color-border);border-radius:10px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
        + '<span style="font-size:.7rem;color:var(--color-text-muted);letter-spacing:1px">📊 VS ' + mesNome.toUpperCase() + '/' + anoAnterior + ':</span>'
        + '<span style="font-size:.78rem;color:' + corB + '">' + seta(diffBruto) + ' Entradas: ' + fmt(calcAnt.totalBruto) + (pctBruto?' ('+pctBruto+'%)':'') + '</span>'
        + '<span style="font-size:.78rem;color:' + corL + '">' + seta(diffLiq) + ' Lucro: ' + fmt(calcAnt.totalLiquido) + (pctLiq?' ('+pctLiq+'%)':'') + '</span>'
        + '</div>';
    })()}

    <div class="resumo-cards">
      <div class="card saidas">
        <div class="card-label">Total de Saídas</div>
        <div class="card-valor" id="card-saidas">${fmt(calc.totalSaidas)}</div>
        <div class="card-sub">Fixas: ${fmt(calc.totalFixos)} | Var: ${fmt(calc.totalVar)}</div>
        <div class="card-icon">📤</div>
      </div>
      <div class="card bruto">
        <div class="card-label">Lucro Bruto (Entradas)</div>
        <div class="card-valor" id="card-bruto">${fmt(calc.totalBruto)}</div>
        <div class="card-icon">💰</div>
      </div>
      <div class="card liquido">
        <div class="card-label">Lucro Líquido</div>
        <div class="card-valor" id="card-liquido" style="color:${calc.totalLiquido>=0?'var(--verde)':'var(--vermelho)'}">${fmt(calc.totalLiquido)}</div>
        <div class="card-icon">📊</div>
      </div>
    </div>

    <!-- OBSERVAÇÕES DO MÊS -->
    <div class="obs-mes-wrap">
      <div class="obs-mes-label">📝 Observações do Mês</div>
      <textarea class="obs-textarea" placeholder="Anotações, lembretes, observações do mês..." oninput="dados[${m}].obs=this.value;salvarDados()">${mes.obs||''}</textarea>
    </div>

    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-add" onclick="addLancamentoUnificado(${m})" style="background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.4);color:#60a5fa;font-size:.88rem;padding:9px 18px">
        + Novo Lançamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
      </button>
    </div>
    <div class="secoes" style="display:flex;flex-direction:column;gap:14px">

      <!-- EXTRATO UNIFICADO -->
      <div class="secao" style="grid-column:1/-1">
        <div class="secao-header">
          <div class="secao-titulo" style="color:#60a5fa">📋 Extrato do Mês</div>
          <div class="secao-header-btns">
            <button class="btn btn-ordenar btn-sm" onclick="ordenarSalvar(${m},'entradas');ordenarSalvar(${m},'variaveis')">↕ Data</button>
          </div>
        </div>
        <div class="secao-body">
          ${(function(){
            // Juntar entradas e saídas variáveis com tipo
            const todasEntradas = (mes.entradas||[]).map(function(e){ const o={}; for(var k in e) o[k]=e[k]; o._tipo='entrada'; return o; });
            const todasSaidas   = (mes.variaveis||[]).map(function(v){ const o={}; for(var k in v) o[k]=v[k]; o._tipo='saida'; return o; });
            const todos = todasEntradas.concat(todasSaidas).sort(function(a,b){
              const da = (a.data||'9999')+(a.hora||'00:00');
              const db = (b.data||'9999')+(b.hora||'00:00');
              return db.localeCompare(da); // mais recente primeiro
            });

            if (!todos.length) return '<div class="orc-vazio">Nenhum lançamento registrado.</div>';

            // Agrupar por data
            const grupos = {};
            todos.forEach(function(l) {
              const d = l.data || 'sem-data';
              if (!grupos[d]) grupos[d] = [];
              grupos[d].push(l);
            });

            const datas = Object.keys(grupos).sort().reverse();

            return datas.map(function(d) {
              const itens = grupos[d];
              const totalE = itens.filter(function(l){return l._tipo==='entrada';}).reduce(function(s,l){return s+num(l.valor);},0);
              const totalS = itens.filter(function(l){return l._tipo==='saida';}).reduce(function(s,l){return s+num(l.valor);},0);
              const saldo = totalE - totalS;
              const grpId = 'grp-ext-' + m + '-' + (d||'sd').replace(/-/g,'');

              return '<div style="margin-bottom:8px">'
                + '<div onclick="toggleGrupo(&quot;' + grpId + '&quot;)" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;cursor:pointer">'
                + '<div style="display:flex;align-items:center;gap:10px">'
                + '<span style="font-size:.8rem;font-weight:700">' + fmtDataGrupo(d) + '</span>'
                + '<span style="font-size:.65rem;color:var(--color-text-muted)">' + itens.length + ' lançamento(s)</span>'
                + '</div>'
                + '<div style="display:flex;align-items:center;gap:14px">'
                + '<span style="font-size:.7rem;color:#34d399">↑ ' + fmt(totalE) + '</span>'
                + '<span style="font-size:.7rem;color:#fca5a5">↓ ' + fmt(totalS) + '</span>'
                + '<span style="font-size:.72rem;font-weight:700;color:' + (saldo>=0?'#34d399':'#fca5a5') + '">' + (saldo>=0?'+':'') + fmt(saldo) + '</span>'
                + '<span id="arr-' + grpId + '" style="color:var(--color-text-muted);font-size:.7rem">▶</span>'
                + '</div>'
                + '</div>'
                + '<div id="' + grpId + '" style="display:none;margin-top:4px">'
                + '<div style="display:flex;flex-direction:column;gap:4px">'
                + itens.map(function(l) {
                    const isE = l._tipo === 'entrada';
                    const cor = isE ? '#34d399' : '#fca5a5';
                    const bg  = isE ? 'rgba(16,185,129,.06)' : 'rgba(248,113,113,.06)';
                    const borda = isE ? 'rgba(16,185,129,.15)' : 'rgba(248,113,113,.15)';
                    const i = isE ? mes.entradas.indexOf(l) : mes.variaveis.indexOf(l);
                    const descConf = (l.desc||'sem descrição').replace(/'/g,'&#39;');
                    const fnExcluir = isE ? 'removeEntrada('+m+','+i+')' : 'removeVariavel('+m+','+i+')';

                    return '<div style="background:'+bg+';border:1px solid '+borda+';border-radius:8px;padding:8px 10px">'
                      // linha 1: badge + data + hora + checkbox(saida) + excluir
                      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
                      + '<span style="font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:4px;background:'+cor+'22;color:'+cor+';border:1px solid '+cor+'44;white-space:nowrap">'+(isE?'↑ ENTRADA':'↓ SAÍDA')+'</span>'
                      + '<input type="date" value="'+(l.data||'')+'" style="font-size:.72rem;padding:3px 6px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].'+(isE?'entradas':'variaveis')+'['+i+'].data=this.value;recalcular('+m+')"/>'
                      + '<input type="time" value="'+(l.hora||'')+'" style="font-size:.72rem;padding:3px 6px;width:86px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].'+(isE?'entradas':'variaveis')+'['+i+'].hora=this.value;recalcular('+m+')"/>'
                      + (!isE ? neonChk((l.pago?'checked ':'')+'onchange="dados['+m+'].variaveis['+i+'].pago=this.checked;recalcular('+m+')"') : '')
                      + '<button class="btn btn-del btn-sm" onclick="confirmarExclusao(\''+descConf+'\',()=>'+fnExcluir+')" style="margin-left:auto">✕</button>'
                      + '</div>'
                      // linha 2: descrição + valor + categoria/forma
                      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">'
                      + '<input type="text" value="'+(l.desc||'').replace(/"/g,'&quot;')+'" placeholder="Descrição..." style="flex:1;font-size:.8rem;padding:4px 8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" oninput="dados['+m+'].'+(isE?'entradas':'variaveis')+'['+i+'].desc=this.value"/>'
                      + '<input type="number" class="valor" value="'+(l.valor||'')+'" placeholder="0,00" min="0" step="0.01" style="width:90px;font-size:.82rem;font-weight:700;color:'+cor+';padding:4px 8px;background:var(--color-surface);border:1px solid '+cor+'33;border-radius:6px" oninput="dados['+m+'].'+(isE?'entradas':'variaveis')+'['+i+'].valor=this.value;recalcular('+m+')"/>'
                      + '</div>'
                      // linha 3: select de categoria ou forma de pagamento
                      + (isE
                        ? '<select style="width:100%;font-size:.75rem;padding:4px 8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)" onchange="dados['+m+'].entradas['+i+'].formaPgto=this.value;recalcular('+m+')">'
                          + '<option value=""'+(!l.formaPgto?' selected':'')+'>— Forma de pagamento —</option>'
                          + '<option value="Dinheiro"'+(l.formaPgto==='Dinheiro'?' selected':'')+'>💵 Dinheiro</option>'
                          + '<option value="PIX"'+(l.formaPgto==='PIX'?' selected':'')+'>📱 PIX</option>'
                          + '<option value="Crédito"'+(l.formaPgto==='Crédito'?' selected':'')+'>💳 Crédito</option>'
                          + '<option value="Débito"'+(l.formaPgto==='Débito'?' selected':'')+'>💳 Débito</option>'
                          + '</select>'
                        : '<select onchange="dados['+m+'].variaveis['+i+'].cat=this.value;recalcular('+m+')" style="width:100%;font-size:.75rem;padding:4px 8px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary)">'
                          + CATEGORIAS.map(function(c){return '<option value="'+c+'"'+(l.cat===c?' selected':'')+'>'+c+'</option>';}).join('')
                          + '</select>')
                      + '</div>';
                  }).join('')
                + '</div></div></div>';
            }).join('')
            + '<div style="display:flex;justify-content:space-between;padding:10px 4px;border-top:1px solid rgba(255,255,255,.06);margin-top:4px">'
            + '<span style="font-size:.72rem;letter-spacing:2px;color:var(--color-text-muted)">TOTAL ENTRADAS <span style="color:#34d399">' + fmt(calc.totalBruto) + '</span></span>'
            + '<span style="font-size:.72rem;letter-spacing:2px;color:var(--color-text-muted)">TOTAL SAÍDAS <span style="color:#fca5a5">' + fmt(calc.totalVar) + '</span></span>'
            + '<span style="font-size:.72rem;letter-spacing:2px;color:var(--color-text-muted)">RESULTADO <span style="color:' + (calc.totalLiquido>=0?'#34d399':'#fca5a5') + ';font-weight:700">' + fmt(calc.totalLiquido) + '</span></span>'
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
          <button onclick="categoriaAdicionar(document.getElementById('nova-cat-input').value);document.getElementById('nova-cat-input').value=''" style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);color:#34d399;border-radius:8px;padding:5px 10px;font-size:.75rem;cursor:pointer;font-weight:700">+ Add</button>
        </div>
      </div>

      <!-- SAÍDAS FIXAS -->
      <div class="secao" style="grid-column:1/-1">
        <div class="secao-header">
          <div class="secao-titulo saidas-fixas">🔒 Saídas Fixas</div>
          <div class="secao-header-btns">
            <button class="btn btn-ordenar btn-sm" onclick="ordenarSalvar(${m},'fixos')">↕ Data</button>
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
                  + '<div onclick="toggleGrupo(&quot;' + grpId + '&quot;)" style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:8px;cursor:pointer">'
                  + '<span style="font-size:.78rem;font-weight:700;color:#fca5a5">' + fmtDataGrupo(d) + '</span>'
                  + '<span style="font-size:.75rem;color:var(--color-text-muted)">' + itens.length + ' item(s) &nbsp;|&nbsp; <b style="color:#fca5a5">' + fmt(totalDia) + '</b> &nbsp;<span id="arr-' + grpId + '">▶</span></span>'
                  + '</div>'
                  + '<div id="' + grpId + '" style="display:none">'
                  + '<table class="tabela-mobile" style="margin-top:4px"><thead><tr><th class="col-data">Data</th><th>Hora</th><th>Descrição</th><th>Valor (R$)</th><th>Pago</th><th></th></tr></thead><tbody>'
                  + itens.map(function(f) {
                      var i = mes.fixos.indexOf(f);
                      var nomeConf = (f.nome||'este item').replace(/'/g,'&#39;');
                      return '<tr style="opacity:' + (pago?'.5':'.9') + '">'
                        + '<td class="col-data"><input type="date" value="' + (f.data||'') + '" oninput="dados[' + m + '].fixos[' + i + '].data=this.value;recalcular(' + m + ')"/></td>'
                        + '<td style="min-width:90px"><input type="time" value="' + (f.hora||'') + '" style="font-size:.75rem;padding:4px 6px;width:90px" oninput="dados[' + m + '].fixos[' + i + '].hora=this.value;recalcular(' + m + ')"/></td>'
                        + '<td><input type="text" class="descricao-fixed" value="' + (f.nome||'').replace(/"/g,'&quot;') + '" oninput="dados[' + m + '].fixos[' + i + '].nome=this.value;recalcular(' + m + ')"/></td>'
                        + '<td><input type="number" class="valor valor-vermelho" value="' + (f.valor||'') + '" placeholder="0,00" min="0" step="0.01" oninput="dados[' + m + '].fixos[' + i + '].valor=this.value;recalcular(' + m + ')"/></td>'
                        + '<td style="text-align:center">' + neonChk((f.pago?'checked ':'') + 'onchange="dados[' + m + '].fixos[' + i + '].pago=this.checked;recalcular(' + m + ')"') + '</td>'
                        + '<td class="td-del"><button class="btn btn-del btn-sm" onclick="confirmarExclusao(\'' + nomeConf + '\',()=>removeFixo(' + m + ',' + i + '))">✕</button></td>'
                        + '</tr>';
                    }).join('')
                  + '</tbody></table></div></div>';
              }).join('');
            }
            return '<div style="font-size:.72rem;letter-spacing:2px;color:#fca5a5;margin-bottom:6px;font-weight:700">⏳ A PAGAR</div>'
              + renderGrupoFixo(aPagar, false)
              + '<div style="font-size:.72rem;letter-spacing:2px;color:#34d399;margin:10px 0 6px;font-weight:700">✅ PAGAS</div>'
              + renderGrupoFixo(pagas, true)
              + '<div style="text-align:right;padding:8px 4px;font-size:.72rem;letter-spacing:2px;color:var(--color-text-muted)">TOTAL PAGO <span style="color:#fca5a5" id="total-fixos">' + fmt(calc.totalFixos) + '</span></div>';
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