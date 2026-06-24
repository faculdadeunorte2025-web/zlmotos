function hojeISO() {
  return new Date().toISOString().split('T')[0];
}

function addEntradaDoEstoque(m) {
  if (!estoque.length) { mostrarErro('Nenhum item no estoque cadastrado.'); return; }
  // Monta modal de seleção
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-entrada-estoque';
  const itensHtml = estoque.map((p, idx) => {
    const qtd = parseFloat(p.qtd)||0;
    const semEstoque = qtd <= 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:rgba(13,35,71,.5);margin-bottom:6px;opacity:${semEstoque?'.4':'1'}">
      <div style="flex:1">
        <div style="font-weight:700;font-size:.88rem">${p.nome}</div>
        <div style="font-size:.72rem;color:var(--color-text-muted)">Qtd: ${qtd} | Venda: R$ ${parseFloat(p.venda||0).toFixed(2)}</div>
      </div>
      <input type="number" id="est-sel-qtd-${idx}" value="1" min="0.01" max="${qtd}" step="0.01" style="width:60px;background:rgba(10,10,11,.8);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary);padding:4px 6px;font-size:.82rem" ${semEstoque?'disabled':''}/>
      <button class="btn btn-sm" style="background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#34d399" ${semEstoque?'disabled':''} onclick="confirmarEntradaEstoque(${m},${idx})">+ Usar</button>
    </div>`;
  }).join('');
  overlay.innerHTML = `
    <div class="modal" style="width:480px;max-height:80vh;overflow-y:auto">
      <div class="modal-titulo">📦 Usar item do Estoque como Entrada</div>
      <div style="margin:16px 0">${itensHtml}</div>
      <button class="btn" style="width:100%;margin-top:8px" onclick="fecharModal('modal-entrada-estoque')">Fechar</button>
    </div>`;
  document.body.appendChild(overlay);
}

function confirmarEntradaEstoque(m, estoqueIdx) {
  const p = estoque[estoqueIdx];
  if (!p) return;
  const qtdInput = document.getElementById('est-sel-qtd-' + estoqueIdx);
  const qtdUsar = parseFloat(qtdInput?.value) || 1;
  const qtdAtual = parseFloat(p.qtd) || 0;
  if (qtdUsar <= 0) { mostrarErro('Quantidade inválida'); return; }
  if (qtdUsar > qtdAtual) { mostrarErro('Quantidade maior que o estoque disponível (' + qtdAtual + ')'); return; }
  const valorTotal = (parseFloat(p.venda)||0) * qtdUsar;
  // Adiciona entrada vinculada ao estoque
  dados[m].entradas.push({
    data: hojeISO(),
    desc: p.nome + (qtdUsar !== 1 ? ' (x' + qtdUsar + ')' : ''),
    valor: valorTotal.toFixed(2),
    _estoqueNome: p.nome,
    _estoqueQtd: qtdUsar
  });
  // Dá baixa no estoque
  estoque[estoqueIdx].qtd = Math.max(0, qtdAtual - qtdUsar);
  salvarDados();
  estSalvar();
  fecharModal('modal-entrada-estoque');
  mostrarToast('✓ Entrada registrada e estoque atualizado!');
  renderAll();
}

function removeEntrada(m,i){
  const e = dados[m].entradas[i];
  // Se entrada veio do estoque, devolve a quantidade
  if (e._estoqueNome && e._estoqueQtd) {
    const idx = estoque.findIndex(p => p.nome.toLowerCase() === e._estoqueNome.toLowerCase());
    if (idx >= 0) {
      estoque[idx].qtd = (parseFloat(estoque[idx].qtd)||0) + parseFloat(e._estoqueQtd);
      estSalvar();
      mostrarToast('✓ Estoque restaurado: ' + e._estoqueQtd + 'x ' + e._estoqueNome);
    }
  }
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
  const hoje = hojeISO();
  const agora = new Date();
  const hora = agora.getHours().toString().padStart(2,'0')+':'+agora.getMinutes().toString().padStart(2,'0');
  const modal = document.createElement('div');
  modal.id='lancamento-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
  const catOpts=CATEGORIAS.map(c=>`<option value="${c}">${c}</option>`).join('');
  modal.innerHTML=`<div onclick="event.stopPropagation()" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:24px;width:100%;max-width:440px">
    <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#60a5fa;margin-bottom:16px">📋 NOVO LANÇAMENTO</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button id="lnc-btn-e" onclick="lncSetTipo('entrada')"
        style="flex:1;padding:10px;border-radius:10px;font-weight:700;cursor:pointer;background:rgba(52,211,153,.2);border:1px solid rgba(52,211,153,.4);color:#34d399;font-size:.9rem">↑ Entrada</button>
      <button id="lnc-btn-sv" onclick="lncSetTipo('saida_var')"
        style="flex:1;padding:10px;border-radius:10px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);font-size:.9rem">↓ Saída</button>
      <button id="lnc-btn-sf" onclick="lncSetTipo('saida_fix')"
        style="flex:1;padding:10px;border-radius:10px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);font-size:.9rem">🔒 Fixa</button>
    </div>
    <input type="hidden" id="lnc-tipo" value="entrada"/>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="orc-field"><label>📝 Descrição *</label><input id="lnc-desc" type="text" placeholder="Ex: Pagamento de serviço, Compra de peça..." autofocus/></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="orc-field"><label>💰 Valor (R$) *</label><input id="lnc-valor" type="number" min="0" step="0.01" placeholder="0,00"/></div>
        <div class="orc-field" id="lnc-campo-extra">
          <label>💳 Forma de Pagamento</label>
          <select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%">
            <option value="">—</option>
            <option value="Dinheiro">💵 Dinheiro</option>
            <option value="PIX">📱 PIX</option>
            <option value="Crédito">💳 Crédito</option>
            <option value="Débito">💳 Débito</option>
          </select>
        </div>
        <div class="orc-field"><label>📅 Data</label><input id="lnc-data" type="date" value="${hoje}"/></div>
        <div class="orc-field"><label>🕐 Hora</label><input id="lnc-hora" type="time" value="${hora}"/></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button onclick="document.getElementById('lancamento-modal').remove()" style="flex:1;padding:10px;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;cursor:pointer">Cancelar</button>
      <button id="lnc-btn-salvar" onclick="confirmarLancamentoUnificado(${m})" style="flex:2;padding:10px;background:rgba(52,211,153,.2);border:1px solid rgba(52,211,153,.4);color:#34d399;border-radius:8px;cursor:pointer;font-weight:700">✓ Salvar Entrada</button>
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
    btnE.style.background='rgba(52,211,153,.2)'; btnE.style.border='1px solid rgba(52,211,153,.4)'; btnE.style.color='#34d399';
    campoExtra.innerHTML = '<label>💳 Forma de Pagamento</label><select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%"><option value="">—</option><option value="Dinheiro">💵 Dinheiro</option><option value="PIX">📱 PIX</option><option value="Crédito">💳 Crédito</option><option value="Débito">💳 Débito</option></select>';
    btnSalvar.textContent = '✓ Salvar Entrada'; btnSalvar.style.background='rgba(52,211,153,.2)'; btnSalvar.style.border='1px solid rgba(52,211,153,.4)'; btnSalvar.style.color='#34d399';
  } else if (tipo === 'saida_var') {
    btnSV.style.background='rgba(248,113,113,.2)'; btnSV.style.border='1px solid rgba(248,113,113,.4)'; btnSV.style.color='#fca5a5';
    const catOpts = CATEGORIAS.map(c=>`<option value="${c}">${c}</option>`).join('');
    campoExtra.innerHTML = '<label>🏷️ Categoria</label><select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%">' + catOpts + '</select>';
    btnSalvar.textContent = '✓ Salvar Saída'; btnSalvar.style.background='rgba(248,113,113,.2)'; btnSalvar.style.border='1px solid rgba(248,113,113,.4)'; btnSalvar.style.color='#fca5a5';
  } else {
    btnSF.style.background='rgba(248,113,113,.15)'; btnSF.style.border='1px solid rgba(248,113,113,.3)'; btnSF.style.color='#fca5a5';
    campoExtra.innerHTML = '<label>— Extra</label><select id="lnc-extra-val" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:8px 10px;width:100%"><option value="">—</option></select>';
    btnSalvar.textContent = '✓ Salvar Fixa'; btnSalvar.style.background='rgba(248,113,113,.15)'; btnSalvar.style.border='1px solid rgba(248,113,113,.3)'; btnSalvar.style.color='#fca5a5';
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
  if(tipo==='entrada'){
    dados[m].entradas.push({data,hora,desc,valor,formaPgto:extra});
    window._registrarLog('ENTRADA_ADICIONADA',{mes:m,desc,valor,data});
  } else if(tipo==='saida_var'){
    dados[m].variaveis.push({data,hora,desc,valor,cat:extra||'Outros',pago:false});
    window._registrarLog('SAIDA_ADICIONADA',{mes:m,desc,valor,data});
  } else {
    if(!dados[m].fixos) dados[m].fixos=[];
    dados[m].fixos.push({data,hora,nome:desc,valor,pago:false});
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
  const hoje = hojeISO();
  const agora = new Date();
  const hora = agora.getHours().toString().padStart(2,'0') + ':' + agora.getMinutes().toString().padStart(2,'0');
  dados[m].entradas.push({data: hoje, hora: hora, desc:'', valor:''});
  window._registrarLog('ENTRADA_ADICIONADA', { mes: m, data: hoje });
  salvarDados();
  renderAll();
  // Abre o grupo do dia de hoje e foca na nova linha
  setTimeout(() => {
    const grpId = 'grp-ent-' + m + '-' + hoje.replace(/-/g,'');
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
  const hoje = hojeISO();
  const agora = new Date();
  const hora = agora.getHours().toString().padStart(2,'0') + ':' + agora.getMinutes().toString().padStart(2,'0');
  dados[m].variaveis.push({data: hoje, hora: hora, desc:'', cat:'Outros', valor:''});
  window._registrarLog('SAIDA_ADICIONADA', { mes: m, data: hoje });
  salvarDados();
  renderAll();
  // Abre o grupo do dia de hoje e foca na nova linha
  setTimeout(() => {
    // Grupo pode ser "a pagar" (não pago)
    const grpId = 'grp-var-' + m + '-a-' + hoje.replace(/-/g,'');
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
  const hoje = hojeISO();
  if (!dados[m].fixos) dados[m].fixos = [];
  dados[m].fixos.unshift({data: hoje, nome:'', valor:'', pago: false});
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
// ABA ANUAL
// ═══════════════════════════════════════════
function renderAnual() {
  let totalSaidasAno=0, totalBrutoAno=0;
  const linhas = MESES.map((mes,m) => {
    const c = calcularMes(m);
    totalSaidasAno += c.totalSaidas;
    totalBrutoAno  += c.totalBruto;
    return { mes, ...c };
  });
  const totalLiquidoAno = totalBrutoAno - totalSaidasAno;

  // Dados gráfico
  const maxVal = Math.max(...linhas.map(l => Math.max(l.totalBruto, l.totalSaidas)), 1);
  const barH = (v) => Math.max(Math.round((Math.abs(v)/maxVal)*130), v!==0?3:0);

  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:var(--dourado)">★ Resumo Anual</span>
      <div class="toolbar-right">
        <button class="btn btn-export" onclick="exportarCSVAnual()">📥 CSV Anual</button>
      </div>
    </div>

    <div class="anual-grid">
      <div class="anual-card saidas"><div class="ac-label">Total Saídas no Ano</div><div class="ac-valor">${fmt(totalSaidasAno)}</div></div>
      <div class="anual-card bruto"><div class="ac-label">Lucro Bruto no Ano</div><div class="ac-valor">${fmt(totalBrutoAno)}</div></div>
      <div class="anual-card liquido"><div class="ac-label">Lucro Líquido no Ano</div><div class="ac-valor" style="color:${totalLiquidoAno>=0?'var(--verde)':'var(--vermelho)'}">${fmt(totalLiquidoAno)}</div></div>
    </div>

    <!-- GRÁFICO MELHORADO -->
    <div class="chart-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
        <div class="chart-title" style="margin-bottom:0">&#128202; Evolução Mensal</div>
        <div style="display:flex;gap:6px">
          <button class="filtro-btn${chartTipo==='barras'?' ativo':''}" onclick="chartTipo=&quot;barras&quot;;renderAnual()" style="font-size:.7rem;padding:3px 10px">&#128202; Barras</button>
          <button class="filtro-btn${chartTipo==='linha'?' ativo':''}" onclick="chartTipo=&quot;linha&quot;;renderAnual()" style="font-size:.7rem;padding:3px 10px">&#128200; Linha</button>
        </div>
      </div>
      ${(function(){
        if (chartTipo === 'linha') {
          var W=600,H=180,PAD=45;
          var allV = linhas.reduce(function(a,l){return a.concat([l.totalBruto,l.totalSaidas,l.totalLiquido]);}, []);
          var minV = Math.min.apply(null, allV.concat([0]));
          var maxV = Math.max.apply(null, allV.concat([1]));
          var range = maxV - minV || 1;
          var xStep = (W - PAD*2) / 11;
          var yPos = function(v){ return H - PAD - ((v - minV) / range) * (H - PAD*2); };
          var makePath = function(arr, color) {
            var d = arr.map(function(v,i){ return (i===0?'M':'L')+(PAD+i*xStep).toFixed(1)+' '+yPos(v).toFixed(1); }).join(' ');
            return '<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
          };
          var makeDots = function(arr, color) {
            return arr.map(function(v,i){
              return '<circle cx="'+(PAD+i*xStep).toFixed(1)+'" cy="'+yPos(v).toFixed(1)+'" r="4" fill="'+color+'" stroke="#0a0a0b" stroke-width="1.5"><title>ZL Motos v5.1.0</title></circle>';
            }).join('');
          };
          var labels = linhas.map(function(l,i){
            return '<text x="'+(PAD+i*xStep).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="9" fill="#64748b">'+l.mes.substring(0,3)+'</text>';
          }).join('');
          var zeroY = yPos(0).toFixed(1);
          var entradas = linhas.map(function(l){return l.totalBruto;});
          var saidas = linhas.map(function(l){return l.totalSaidas;});
          var liquidos = linhas.map(function(l){return l.totalLiquido;});
          return '<div style="overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:360px;height:'+H+'px">'
            + '<line x1="'+PAD+'" y1="'+zeroY+'" x2="'+(W-PAD)+'" y2="'+zeroY+'" stroke="rgba(255,255,255,.1)" stroke-dasharray="4"/>'
            + makePath(entradas,'#60a5fa') + makePath(saidas,'#f87171') + makePath(liquidos,'#34d399')
            + makeDots(entradas,'#60a5fa') + makeDots(saidas,'#f87171') + makeDots(liquidos,'#34d399')
            + labels + '</svg></div>';
        } else {
          var maxV2 = Math.max.apply(null, linhas.map(function(l){return Math.max(l.totalBruto,l.totalSaidas,Math.abs(l.totalLiquido));}));
          maxV2 = maxV2 || 1;
          var bH = function(v){ return Math.max(Math.round((Math.abs(v)/maxV2)*120), v!==0?3:0); };
          return '<div style="overflow-x:auto"><div class="chart-bars">'
            + linhas.map(function(l,i){
                var tip = MESES[i]+': Ent '+fmt(l.totalBruto)+' | Saí '+fmt(l.totalSaidas)+' | Líq '+fmt(l.totalLiquido);
                return '<div class="chart-col" title="'+tip+'">'
                  + '<div style="font-size:.58rem;color:'+(l.totalLiquido>=0?'#34d399':'#f87171')+';text-align:center;min-height:13px">'+(l.vazio?'':fmt(l.totalLiquido).replace('R$ ',''))+'</div>'
                  + '<div class="chart-bars-inner">'
                  + '<div class="bar bar-entrada" style="height:'+bH(l.totalBruto)+'px" title="Entradas: '+fmt(l.totalBruto)+'"></div>'
                  + '<div class="bar bar-saida" style="height:'+bH(l.totalSaidas)+'px" title="Saídas: '+fmt(l.totalSaidas)+'"></div>'
                  + '<div class="bar bar-liquido" style="height:'+bH(l.totalLiquido)+'px;background:'+(l.totalLiquido<0?'linear-gradient(to top,#b91c1c,#ef4444)':'linear-gradient(to top,#059669,#34d399)')+'" title="Líquido: '+fmt(l.totalLiquido)+'"></div>'
                  + '</div>'
                  + '<div class="chart-col-label">'+l.mes.substring(0,3)+'</div>'
                  + '</div>';
              }).join('')
            + '</div></div>';
        }
      })()}
      <div class="chart-legend">
        <div class="leg-item"><div class="leg-dot" style="background:var(--color-primary-hover)"></div>Entradas</div>
        <div class="leg-item"><div class="leg-dot" style="background:var(--vermelho)"></div>Saídas</div>
        <div class="leg-item"><div class="leg-dot" style="background:var(--verde)"></div>Lucro Líquido</div>
      </div>
    </div>

    <div class="anual-table-wrap tabela-wrap">
      <table>
        <thead><tr><th>Mês</th><th>Total Saídas</th><th>Lucro Bruto</th><th>Lucro Líquido</th><th>Status</th></tr></thead>
        <tbody>
          ${linhas.map(l => '<tr>'
            + '<td>' + l.mes + (l.vazio?'<span class="mes-vazio-dot" title="Sem lançamentos"></span>':'') + '</td>'
            + '<td class="val-saida">' + fmt(l.totalSaidas) + '</td>'
            + '<td class="val-bruto">' + fmt(l.totalBruto) + '</td>'
            + '<td class="val-liquido ' + (l.totalLiquido>=0?'val-positivo':'val-negativo') + '">' + fmt(l.totalLiquido) + '</td>'
            + '<td><span style="font-size:.72rem;letter-spacing:1px;color:' + (l.vazio?'var(--color-text-muted)':l.totalLiquido>=0?'var(--verde)':'var(--vermelho)') + '">' + (l.vazio?'—':l.totalLiquido>=0?'✓ OK':'⚠ NEG') + '</span></td>'
            + '</tr>').join('')}
        </tbody>
        <tfoot>
          <tr class="anual-totais-row">
            <td>TOTAL ANUAL</td>
            <td class="val-saida">${fmt(totalSaidasAno)}</td>
            <td class="val-bruto">${fmt(totalBrutoAno)}</td>
            <td class="val-liquido ${totalLiquidoAno>=0?'val-positivo':'val-negativo'}">${fmt(totalLiquidoAno)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- META DE FATURAMENTO -->
    <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:20px 24px;margin-top:16px">
      <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:var(--dourado);margin-bottom:14px">🎯 META DE FATURAMENTO ANUAL</div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
        <div style="flex:1;min-width:200px">
          <label style="font-size:.7rem;color:var(--color-text-muted);letter-spacing:2px">META (R$)</label>
          <input type="number" id="meta-anual-input" value="${localStorage.getItem('zlmotos_meta_anual_'+document.getElementById('anoGlobal').value)||''}" placeholder="Ex: 50000" min="0" step="100"
            style="width:100%;background:rgba(10,10,11,.8);border:1px solid var(--color-border);border-radius:8px;color:var(--color-text-primary);font-family:'JetBrains Mono';font-size:1rem;padding:8px 12px;margin-top:4px"
            oninput="localStorage.setItem('zlmotos_meta_anual_'+document.getElementById('anoGlobal').value,this.value);renderAnual()"/>
        </div>
        <div style="flex:2;min-width:200px">
          ${(() => {
            const metaVal = parseFloat(localStorage.getItem('zlmotos_meta_anual_'+document.getElementById('anoGlobal').value)||0);
            if (!metaVal) return '<div style="color:var(--color-text-muted);font-size:.8rem">Defina uma meta para acompanhar o progresso.</div>';
            const pct = Math.min(100, Math.round((totalBrutoAno/metaVal)*100));
            const cor = pct >= 100 ? '#34d399' : pct >= 70 ? '#fbbf24' : '#f87171';
            return '<div><div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px"><span style="color:'+cor+'">'+pct+'% atingido</span><span style="color:var(--color-text-muted)">'+fmt(totalBrutoAno)+' / '+fmt(metaVal)+'</span></div>'
              + '<div style="background:rgba(255,255,255,.08);border-radius:20px;height:14px;overflow:hidden"><div style="height:100%;border-radius:20px;background:linear-gradient(90deg,'+cor+','+cor+'99);width:'+pct+'%;transition:width .5s"></div></div>'
              + (pct >= 100 ? '<div style="color:#34d399;font-size:.75rem;margin-top:6px">🎉 Meta atingida!</div>' : '<div style="color:var(--color-text-muted);font-size:.72rem;margin-top:6px">Faltam '+fmt(metaVal-totalBrutoAno)+' para atingir a meta.</div>')
              + '</div>';
          })()}
        </div>
      </div>
    </div>

    <!-- RANKINGS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">

      <!-- RANKING SERVIÇOS -->
      <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:20px 24px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#a78bfa;margin-bottom:14px">🏆 TOP SERVIÇOS</div>
        ${(() => {
          const contador = {};
          ordens.forEach(os => {
            (os.itens||[]).forEach(it => {
              if (!it.desc) return;
              const k = it.desc.trim();
              if (!contador[k]) contador[k] = { qtd: 0, total: 0 };
              contador[k].qtd += parseFloat(it.qtd)||1;
              contador[k].total += (parseFloat(it.qtd)||1)*(parseFloat(it.vunit)||0);
            });
          });
          const sorted = Object.entries(contador).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,5);
          if (!sorted.length) return '<div style="color:var(--color-text-muted);font-size:.8rem">Nenhuma OS registrada ainda.</div>';
          return sorted.map(([nome,v],i) =>
            '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
            + '<span style="font-family:\'Inter\';font-size:1.1rem;color:'+(i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#d97706':'var(--color-text-muted)')+'">'+String(i+1)+'º</span>'
            + '<div style="flex:1"><div style="font-size:.82rem;font-weight:600">'+nome+'</div><div style="font-size:.7rem;color:var(--color-text-muted)">'+v.qtd+'x — '+fmt(v.total)+'</div></div>'
            + '</div>'
          ).join('');
        })()}
      </div>

      <!-- RANKING PEÇAS -->
      <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:20px 24px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#f97316;margin-bottom:14px">📦 TOP PEÇAS USADAS</div>
        ${(() => {
          const contador = {};
          ordens.forEach(os => {
            (os.itens||[]).filter(it => it.cat === 'Peça' || it._estoqueNome).forEach(it => {
              const k = (it._estoqueNome || it.desc||'').trim();
              if (!k) return;
              if (!contador[k]) contador[k] = { qtd: 0, total: 0 };
              contador[k].qtd += parseFloat(it.qtd)||1;
              contador[k].total += (parseFloat(it.qtd)||1)*(parseFloat(it.vunit)||0);
            });
          });
          const sorted = Object.entries(contador).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,5);
          if (!sorted.length) return '<div style="color:var(--color-text-muted);font-size:.8rem">Nenhuma peça registrada nas OS ainda.</div>';
          return sorted.map(([nome,v],i) =>
            '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
            + '<span style="font-family:\'Inter\';font-size:1.1rem;color:'+(i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#d97706':'var(--color-text-muted)')+'">'+String(i+1)+'º</span>'
            + '<div style="flex:1"><div style="font-size:.82rem;font-weight:600">'+nome+'</div><div style="font-size:.7rem;color:var(--color-text-muted)">'+v.qtd+'x — '+fmt(v.total)+'</div></div>'
            + '</div>'
          ).join('');
        })()}
      </div>

    </div>

    <!-- METAS DOS MECÂNICOS -->
    <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:20px 24px;margin-top:16px">
      <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#f97316;margin-bottom:16px">👨‍🔧 METAS DOS MECÂNICOS</div>
      ${(function(){
        var mecsMap = {};
        ordens.forEach(function(os) {
          var mec = (os.mecanico||'').trim() || 'Sem mecânico';
          if (!mecsMap[mec]) mecsMap[mec] = { total: 0, concluidas: 0, faturamento: 0 };
          mecsMap[mec].total++;
          if (os.status === 'concluida' || os.status === 'entregue') {
            mecsMap[mec].concluidas++;
            mecsMap[mec].faturamento += parseFloat(os.total)||0;
          }
        });
        var mecs = Object.entries(mecsMap).sort(function(a,b){ return b[1].concluidas - a[1].concluidas; });
        if (!mecs.length) return '<div style="color:var(--color-text-muted);font-size:.82rem">Nenhuma OS cadastrada ainda.</div>';
        var anoAtualEl = document.getElementById('anoGlobal');
        var anoVal = anoAtualEl ? anoAtualEl.value : '2025';
        var metaMec = parseFloat(localStorage.getItem('zlmotos_meta_mec_' + anoVal)||0);
        var html = '<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
          + '<span style="font-size:.75rem;color:var(--color-text-muted)">Meta mensal de OS concluídas por mecânico:</span>'
          + '<input type="number" value="' + (metaMec||'') + '" placeholder="Ex: 20" min="0" data-ano="' + anoVal + '" style="width:80px;background:rgba(10,10,11,.8);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-primary);padding:5px 8px;font-size:.85rem" oninput="localStorage.setItem(&quot;zlmotos_meta_mec_&quot;+this.dataset.ano,this.value);renderAnual()"/>'
          + '</div>';
        mecs.forEach(function(entry, idx) {
          var nome = entry[0]; var d = entry[1];
          var pct = metaMec > 0 ? Math.min(100, Math.round((d.concluidas/metaMec)*100)) : 0;
          var cor = pct >= 100 ? '#34d399' : pct >= 70 ? '#fbbf24' : '#f87171';
          var medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👨\u200d🔧';
          html += '<div style="padding:12px 14px;background:rgba(255,255,255,.04);border-radius:10px;margin-bottom:8px">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
            + '<span style="font-weight:700;font-size:.9rem">' + medal + ' ' + nome + '</span>'
            + '<span style="font-size:.78rem;color:var(--color-text-muted)">' + d.concluidas + ' OS concluídas / ' + d.total + ' total &nbsp;|&nbsp; ' + fmt(d.faturamento) + '</span>'
            + '</div>'
            + (metaMec > 0 ? '<div style="background:rgba(255,255,255,.08);border-radius:20px;height:8px;overflow:hidden"><div style="height:100%;border-radius:20px;background:' + cor + ';width:' + pct + '%"></div></div>'
              + '<div style="font-size:.68rem;color:' + cor + ';margin-top:3px">' + pct + '% da meta' + (pct>=100?' 🎉':'') + '</div>' : '')
            + '</div>';
        });
        return html;
      })()}
    </div>

  `;
}

// ═══════════════════════════════════════════
// EXPORTAR CSV
// ═══════════════════════════════════════════
function exportarCSV(m) {
  const mes=dados[m]; const calc=calcularMes(m);
  const ano=document.getElementById('anoGlobal').value;
  let csv=`ZL MOTOS - ${MESES[m]} ${ano}\n\n`;
  csv+=`ENTRADAS\nData,Descrição,Valor\n`;
  mes.entradas.forEach(e=>{csv+=`"${e.data||''}","${e.desc||''}",${e.valor||0}\n`;});
  csv+=`,,Total Bruto,${calc.totalBruto}\n\nSAÍDAS FIXAS\nData,Descrição,Valor\n`;
  mes.fixos.forEach(f=>{csv+=`"${f.data||''}","${f.nome}",${f.valor||0}\n`;});
  csv+=`\nSAÍDAS VARIÁVEIS\nData,Descrição,Categoria,Valor\n`;
  mes.variaveis.forEach(v=>{csv+=`"${v.data||''}","${v.desc||''}","${v.cat||''}",${v.valor||0}\n`;});
  csv+=`\nRESUMO\nTotal Saídas,${calc.totalSaidas}\nLucro Bruto,${calc.totalBruto}\nLucro Líquido,${calc.totalLiquido}\n`;
  if (mes.obs) csv += `\nOBSERVAÇÕES\n"${mes.obs}"\n`;
  baixarArquivo(csv,`ZL_MOTOS_${MESES[m]}_${ano}.csv`,'text/csv');
}
function exportarCSVAnual() {
  const ano=document.getElementById('anoGlobal').value;
  let csv=`ZL MOTOS - Resumo Anual ${ano}\n\nMês,Total Saídas,Lucro Bruto,Lucro Líquido\n`;
  let ts=0,tb=0;
  MESES.forEach((mes,m)=>{ const c=calcularMes(m); ts+=c.totalSaidas; tb+=c.totalBruto; csv+=`${mes},${c.totalSaidas},${c.totalBruto},${c.totalLiquido}\n`; });
  csv+=`TOTAL,${ts},${tb},${tb-ts}\n`;
  baixarArquivo(csv,`ZL_MOTOS_Anual_${ano}.csv`,'text/csv');
}
function baixarArquivo(conteudo,nome,tipo) {
  const blob=new Blob(['\uFEFF'+conteudo],{type:tipo});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=nome; a.click(); URL.revokeObjectURL(url);
}



// ═══════════════════════════════════════════
// RENDER ALL
// ═══════════════════════════════════════════
// ── RENDER CONFIGURAÇÕES ──

// ═══════════════════════════════════════════
// MIGRAÇÃO DE DADOS ENTRE ANOS
// ═══════════════════════════════════════════
async function migrarAnoParaAno(anoOrigem, anoDestino) {
  if (!confirm(`⚠️ ATENÇÃO!\n\nIsso vai:\n1. APAGAR todos os dados de ${anoDestino}\n2. Copiar todos os dados de ${anoOrigem} para ${anoDestino}\n\nEssa ação não pode ser desfeita.\n\nDeseja continuar?`)) return;

  mostrarToast('⏳ Migrando dados...');

  try {
    // Carregar dados do ano origem
    const refOrigem = window._userDoc('zlmotos_' + anoOrigem);
    const snapOrigem = await window._firestoreGetDoc(refOrigem);
    if (!snapOrigem.exists()) {
      mostrarErro('Nenhum dado encontrado em ' + anoOrigem);
      return;
    }
    const dadosOrigem = snapOrigem.data().dados;
    if (!dadosOrigem) {
      mostrarErro('Dados de ' + anoOrigem + ' estão vazios');
      return;
    }

    // Salvar no ano destino (sobrescreve)
    const refDestino = window._userDoc('zlmotos_' + anoDestino);
    await window._firestoreSetDoc(refDestino, {
      dados: dadosOrigem,
      atualizadoEm: new Date().toISOString(),
      migradoDe: anoOrigem,
      migradoEm: new Date().toISOString()
    });

    // Atualiza o ano no header e recarrega
    document.getElementById('anoGlobal').value = anoDestino;
    dados = dadosOrigem;
    mostrarToast('✓ Dados de ' + anoOrigem + ' migrados para ' + anoDestino + ' com sucesso!');
    renderAll();
    setTimeout(sinoAtualizar, 800);

  } catch(e) {
    console.error('Erro na migração:', e);
    mostrarErro('Erro ao migrar dados: ' + e.message);
  }
}

function renderConfiguracoes() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.2rem;letter-spacing:3px;color:#94a3b8">⚙️ CONFIGURAÇÕES DA EMPRESA</span>
    </div>
    <div style="max-width:700px;margin:0 auto">

      <!-- MIGRAÇÃO DE DADOS -->
      <div style="background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.2);border-radius:14px;padding:20px 24px;margin-bottom:16px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#f87171;margin-bottom:12px">🔄 MIGRAÇÃO DE DADOS</div>
        <div style="font-size:.82rem;color:var(--color-text-muted);margin-bottom:14px">Copia todos os dados de um ano para outro. O ano de destino será <b style="color:#f87171">completamente substituído</b>.</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:.75rem;color:var(--color-text-muted)">De:</label>
            <select id="migrar-origem" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:6px 10px;font-size:.82rem">
              ${[2023,2024,2025,2026,2027].map(a => '<option value="'+a+'"'+(a===2025?' selected':'')+'>'+a+'</option>').join('')}
            </select>
          </div>
          <div style="font-size:.9rem;color:var(--color-text-muted)">→</div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:.75rem;color:var(--color-text-muted)">Para:</label>
            <select id="migrar-destino" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:6px 10px;font-size:.82rem">
              ${[2023,2024,2025,2026,2027].map(a => '<option value="'+a+'"'+(a===2026?' selected':'')+'>'+a+'</option>').join('')}
            </select>
          </div>
          <button onclick="const o=document.getElementById('migrar-origem').value;const d=document.getElementById('migrar-destino').value;if(o===d){mostrarErro('Origem e destino não podem ser iguais');return;}migrarAnoParaAno(o,d)"
            style="padding:8px 18px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5;border-radius:8px;cursor:pointer;font-size:.82rem;font-weight:600">
            ⚠️ Migrar Dados
          </button>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:24px;margin-bottom:16px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#34d399;margin-bottom:16px">🎯 META MENSAL</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="orc-field" style="flex:1;margin:0">
            <label>Meta de faturamento mensal (R$)</label>
            <input type="number" min="0" step="100" value="${metaMensal||''}" placeholder="Ex: 15000" id="cfg-meta-mensal"
              oninput="metaMensal=parseFloat(this.value)||0;dashSalvarMeta()"
              style="font-size:1rem"/>
          </div>
          <div style="text-align:center;min-width:80px">
            ${metaMensal > 0 ? `<div style="font-size:.72rem;color:var(--color-text-muted)">Este mês</div><div style="font-size:1.1rem;font-weight:700;color:${Math.round((calcularMes(new Date().getMonth()).totalBruto/metaMensal)*100) >= 100 ? '#34d399' : '#fbbf24'}">${Math.min(100,Math.round((calcularMes(new Date().getMonth()).totalBruto/metaMensal)*100))}%</div>` : ''}
          </div>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:24px;margin-bottom:16px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#a78bfa;margin-bottom:16px">👨‍🔧 MECÂNICOS E COMISSÕES</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          ${mecanicosCadastrados.length === 0 ? '<span style="color:var(--color-text-muted);font-size:.82rem">Nenhum mecânico cadastrado</span>' :
            mecanicosCadastrados.map((m,i) => {
              const nome = typeof m === 'string' ? m : m.nome;
              const comissao = typeof m === 'object' ? (m.comissao||0) : 0;
              return `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);border-radius:8px;padding:6px 12px">
                <span style="font-size:.85rem">👨‍🔧 ${nome}</span>
                <input type="number" min="0" max="100" value="${comissao}" placeholder="%" title="Comissão %"
                  oninput="mecAtualizarComissao(${i},this.value)"
                  style="width:48px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#fff;padding:3px 6px;font-size:.75rem;text-align:center"/>
                <span style="font-size:.65rem;color:var(--color-text-muted)">%</span>
                <button onclick="mecRemover('${nome}')" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:.9rem;padding:0;line-height:1">✕</button>
              </div>`;
            }).join('')}
        </div>
        <div style="font-size:.72rem;color:var(--color-text-muted);margin-bottom:10px">Defina o % de comissão de cada mecânico sobre o valor das OS concluídas</div>
        <div style="display:flex;gap:8px">
          <input id="cfg-mec-novo" type="text" placeholder="Nome do mecânico..." maxlength="40"
            onkeydown="if(event.key==='Enter'){mecAdicionar(this.value);this.value='';}"
            style="flex:1;background:rgba(255,255,255,.06);border:1px solid var(--color-border);border-radius:8px;color:#fff;padding:8px 12px;font-size:.85rem;outline:none"/>
          <button onclick="mecAdicionar(document.getElementById('cfg-mec-novo').value);document.getElementById('cfg-mec-novo').value=''"
            style="background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.4);color:#a78bfa;border-radius:8px;padding:8px 16px;font-size:.82rem;cursor:pointer;font-weight:700">+ Adicionar</button>
        </div>
      </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="orc-field" style="grid-column:1/-1">
            <label>🏢 Razão Social</label>
            <input type="text" value="${empresa.razaoSocial||''}" placeholder="Razão Social..." oninput="empresa.razaoSocial=this.value"/>
          </div>
          <div class="orc-field">
            <label>✨ Nome Fantasia</label>
            <input type="text" value="${empresa.nomeFantasia||''}" placeholder="Nome Fantasia..." oninput="empresa.nomeFantasia=this.value"/>
          </div>
          <div class="orc-field">
            <label>📄 CNPJ</label>
            <input type="text" value="${empresa.cnpj||''}" placeholder="00.000.000/0000-00" oninput="empresa.cnpj=this.value"/>
          </div>
          <div class="orc-field" style="grid-column:1/-1">
            <label>📍 Endereço</label>
            <input type="text" value="${empresa.endereco||''}" placeholder="Rua, número..." oninput="empresa.endereco=this.value"/>
          </div>
          <div class="orc-field">
            <label>🏘️ Bairro</label>
            <input type="text" value="${empresa.bairro||''}" placeholder="Bairro..." oninput="empresa.bairro=this.value"/>
          </div>
          <div class="orc-field">
            <label>🏙️ Cidade</label>
            <input type="text" value="${empresa.cidade||''}" placeholder="Cidade..." oninput="empresa.cidade=this.value"/>
          </div>
          <div class="orc-field">
            <label>🗺️ Estado</label>
            <input type="text" value="${empresa.estado||''}" placeholder="SP" maxlength="2" oninput="empresa.estado=this.value.toUpperCase();this.value=empresa.estado" style="text-transform:uppercase"/>
          </div>
          <div class="orc-field">
            <label>📮 CEP</label>
            <input type="text" value="${empresa.cep||''}" placeholder="00.000-000" oninput="empresa.cep=this.value"/>
          </div>
          <div class="orc-field">
            <label>📞 Telefone</label>
            <input type="text" value="${empresa.telefone||''}" placeholder="(17) 99999-9999" oninput="empresa.telefone=this.value"/>
          </div>
          <div class="orc-field">
            <label>📧 E-mail</label>
            <input type="email" value="${empresa.email||''}" placeholder="email@empresa.com" oninput="empresa.email=this.value"/>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
          <div class="orc-field">
            <label>💳 Taxa Cartão de Crédito (%)</label>
            <input type="number" value="${empresa.taxaCredito||2.5}" min="0" max="100" step="0.01" placeholder="2.5" oninput="empresa.taxaCredito=this.value"/>
            <span style="font-size:.7rem;color:var(--color-text-muted)">Descontado automaticamente nas entradas de crédito</span>
          </div>
          <div class="orc-field">
            <label>💳 Taxa Cartão de Débito (%)</label>
            <input type="number" value="${empresa.taxaDebito||1.5}" min="0" max="100" step="0.01" placeholder="1.5" oninput="empresa.taxaDebito=this.value"/>
            <span style="font-size:.7rem;color:var(--color-text-muted)">Descontado automaticamente nas entradas de débito</span>
          </div>
        </div>
        <div style="margin-top:20px">
          <button class="btn" style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:10px 28px;font-size:.9rem" onclick="salvarEmpresa()">💾 Salvar Configurações</button>
        </div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:22px 28px;margin-bottom:16px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#34d399;margin-bottom:14px">📊 METAS DO ESTOQUE</div>
        <div class="orc-field" style="max-width:280px">
          <label>🎯 Meta de Margem de Lucro (%)</label>
          <input type="number" value="${empresa.margemMeta||30}" min="0" max="999" step="1" placeholder="30" oninput="empresa.margemMeta=this.value"/>
          <span style="font-size:.7rem;color:var(--color-text-muted)">Peças abaixo da meta ficam em amarelo no estoque</span>
        </div>
        <div style="margin-top:14px">
          <button class="btn" style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:8px 20px;font-size:.85rem" onclick="salvarEmpresa();mostrarToast('✓ Meta salva!')">💾 Salvar Meta</button>
        </div>
      </div>

      <div style="background:rgba(13,35,71,.5);border:1px solid var(--color-border);border-radius:12px;padding:16px 20px;font-size:.78rem;color:var(--color-text-muted);line-height:1.8">
        <b style="color:#94a3b8">ℹ️ Sobre as configurações:</b><br>
        Os dados da empresa aparecem automaticamente nos PDFs de Orçamento, OS e Comprovante de Serviços.
      </div>

      <!-- M01 — TEMA -->
      <div style="background:rgba(255,255,255,.03);border:1px solid var(--color-border);border-radius:14px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:.85rem;font-weight:700;color:var(--color-text-primary)">🎨 Tema</div>
          <div style="font-size:.72rem;color:var(--color-text-muted)">Alternar entre modo escuro e claro</div>
        </div>
        <button onclick="toggleTema()" id="btn-tema" style="padding:8px 20px;border-radius:20px;border:1px solid var(--color-border);background:var(--color-elevated);color:var(--color-text-primary);cursor:pointer;font-size:.82rem;font-weight:600">
          ${document.body.classList.contains('tema-claro') ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
        </button>
      </div>

      <!-- I12 — BACKUP E RELATÓRIO -->
      <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:24px;margin-bottom:16px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#60a5fa;margin-bottom:16px">💾 BACKUP E RELATÓRIOS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button onclick="backupExportarJSON()" style="padding:12px;background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.3);color:#60a5fa;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700">
            📦 Exportar backup JSON<br><span style="font-size:.7rem;color:var(--color-text-muted);font-weight:400">Todos os dados em JSON</span>
          </button>
          <button onclick="relatorioMensalPDF()" style="padding:12px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);color:#34d399;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700">
            📄 Relatório Mensal PDF<br><span style="font-size:.7rem;color:var(--color-text-muted);font-weight:400">Resumo financeiro do mês</span>
          </button>
          <button onclick="renderRelatorioComissao()" style="padding:12px;background:rgba(167,139,250,.1);border:1px solid rgba(167,139,250,.3);color:#a78bfa;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700">
            💰 Comissões do mês<br><span style="font-size:.7rem;color:var(--color-text-muted);font-weight:400">Por mecânico</span>
          </button>
          <button onclick="renderRankingClientes()" style="padding:12px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);color:#fbbf24;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700">
            🏆 Ranking de Clientes<br><span style="font-size:.7rem;color:var(--color-text-muted);font-weight:400">Top clientes por faturamento</span>
          </button>
        </div>
      </div>

      <!-- CHECKLIST DE ENTREGA -->
      <div style="background:linear-gradient(135deg,rgba(13,35,71,.9),rgba(26,58,107,.5));border:1px solid var(--color-border);border-radius:14px;padding:28px 32px;margin-top:16px">
        <div style="font-family:'Inter';font-size:.9rem;letter-spacing:3px;color:#34d399;margin-bottom:6px">✅ CHECKLIST DE ENTREGA DA OS</div>
        <div style="font-size:.75rem;color:var(--color-text-muted);margin-bottom:16px">Itens que devem ser verificados antes de marcar a OS como Pronta. Você pode adicionar, editar ou remover itens.</div>
        <div id="checklist-config-lista">
          ${checklistEntrega.map((item, i) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="color:#34d399;font-size:.85rem">✓</span>
              <input type="text" value="${item.replace(/"/g,'&quot;')}" style="flex:1" oninput="checklistEntrega[${i}]=this.value"/>
              <button class="btn btn-del btn-sm" onclick="checklistEntrega.splice(${i},1);renderConfiguracoes()">✕</button>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-add btn-sm" onclick="checklistEntrega.push('Novo item');renderConfiguracoes()">+ Adicionar Item<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
          <button class="btn btn-sm" style="background:linear-gradient(135deg,#16a34a,#15803d);color:white" onclick="salvarEmpresa();mostrarToast('✓ Checklist salvo!')">💾 Salvar Checklist</button>
        </div>
      </div>
    </div>
  `;
}