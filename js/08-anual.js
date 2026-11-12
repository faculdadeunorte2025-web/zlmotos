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
      <span style="font-family:'Inter',sans-serif;font-size:1.35rem;letter-spacing:.5px;color:var(--dourado)">Resumo Anual</span>
      <div class="toolbar-right">
        <button class="btn btn-export" onclick="exportarCSVAnual()">CSV Anual</button>
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
        <div class="chart-title" style="margin-bottom:0">&#2d5742; Evolução Mensal</div>
        <div style="display:flex;gap:6px">
          <button class="filtro-btn${chartTipo==='barras'?' ativo':''}" onclick="chartTipo=&quot;barras&quot;;renderAnual()" style="font-size:.7rem;padding:3px 10px">&#2d5742; Barras</button>
          <button class="filtro-btn${chartTipo==='linha'?' ativo':''}" onclick="chartTipo=&quot;linha&quot;;renderAnual()" style="font-size:.7rem;padding:3px 10px">&#2c5641; Linha</button>
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
              return '<circle cx="'+(PAD+i*xStep).toFixed(1)+'" cy="'+yPos(v).toFixed(1)+'" r="4" fill="'+color+'" stroke="#0a0a0d" stroke-width="1.5"><title>ZL Motos v5.1.0</title></circle>';
            }).join('');
          };
          var labels = linhas.map(function(l,i){
            return '<text x="'+(PAD+i*xStep).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="9" fill="#78787b">'+l.mes.substring(0,3)+'</text>';
          }).join('');
          var zeroY = yPos(0).toFixed(1);
          var entradas = linhas.map(function(l){return l.totalBruto;});
          var saidas = linhas.map(function(l){return l.totalSaidas;});
          var liquidos = linhas.map(function(l){return l.totalLiquido;});
          return '<div style="overflow-x:auto"><svg viewBox="0 0 '+W+' '+H+'" style="width:100%;min-width:360px;height:'+H+'px">'
            + '<line x1="'+PAD+'" y1="'+zeroY+'" x2="'+(W-PAD)+'" y2="'+zeroY+'" stroke="rgba(255,255,255,.1)" stroke-dasharray="4"/>'
            + makePath(entradas,'#adadb0') + makePath(saidas,'#dd8c8c') + makePath(liquidos,'#5cab84')
            + makeDots(entradas,'#adadb0') + makeDots(saidas,'#dd8c8c') + makeDots(liquidos,'#5cab84')
            + labels + '</svg></div>';
        } else {
          var maxV2 = Math.max.apply(null, linhas.map(function(l){return Math.max(l.totalBruto,l.totalSaidas,Math.abs(l.totalLiquido));}));
          maxV2 = maxV2 || 1;
          var bH = function(v){ return Math.max(Math.round((Math.abs(v)/maxV2)*120), v!==0?3:0); };
          return '<div style="overflow-x:auto"><div class="chart-bars">'
            + linhas.map(function(l,i){
                var tip = MESES[i]+': Ent '+fmt(l.totalBruto)+' | Saí '+fmt(l.totalSaidas)+' | Líq '+fmt(l.totalLiquido);
                return '<div class="chart-col" title="'+tip+'">'
                  + '<div style="font-size:.58rem;color:'+(l.totalLiquido>=0?'#5cab84':'#dd8c8c')+';text-align:center;min-height:13px">'+(l.vazio?'':fmt(l.totalLiquido).replace('R$ ',''))+'</div>'
                  + '<div class="chart-bars-inner">'
                  + '<div class="bar bar-entrada" style="height:'+bH(l.totalBruto)+'px" title="Entradas: '+fmt(l.totalBruto)+'"></div>'
                  + '<div class="bar bar-saida" style="height:'+bH(l.totalSaidas)+'px" title="Saídas: '+fmt(l.totalSaidas)+'"></div>'
                  + '<div class="bar bar-liquido" style="height:'+bH(l.totalLiquido)+'px;background:'+(l.totalLiquido<0?'linear-gradient(to top,#b91c1c,#d16262)':'linear-gradient(to top,#35664e,#5cab84)')+'" title="Líquido: '+fmt(l.totalLiquido)+'"></div>'
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
            + '<td><span style="font-size:.72rem;letter-spacing:1px;color:' + (l.vazio?'var(--color-text-muted)':l.totalLiquido>=0?'var(--verde)':'var(--vermelho)') + '">' + (l.vazio?'—':l.totalLiquido>=0?'✓ OK':'NEG') + '</span></td>'
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
    <div style="background:linear-gradient(135deg,rgba(42,42,45,.9),rgba(66,66,69,.5));border:1px solid var(--color-border);border-radius:14px;padding:20px 24px;margin-top:16px">
      <div style="font-family:'Inter',sans-serif;font-size:.9rem;letter-spacing:.5px;color:var(--dourado);margin-bottom:14px">META DE FATURAMENTO ANUAL</div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
        <div style="flex:1;min-width:200px">
          <label style="font-size:.7rem;color:var(--color-text-muted);letter-spacing:1px">META (R$)</label>
          <input type="number" id="meta-anual-input" value="${localStorage.getItem('zlmotos_meta_anual_'+document.getElementById('anoGlobal').value)||''}" placeholder="Ex: 50000" min="0" step="100"
            style="width:100%;background:rgba(10,10,13,.8);border:1px solid var(--color-border);border-radius:8px;color:var(--color-text-primary);font-family:'JetBrains Mono';font-size:1rem;padding:8px 12px;margin-top:4px"
            oninput="localStorage.setItem('zlmotos_meta_anual_'+document.getElementById('anoGlobal').value,this.value);renderAnual()"/>
        </div>
        <div style="flex:2;min-width:200px">
          ${(() => {
            const metaVal = parseFloat(localStorage.getItem('zlmotos_meta_anual_'+document.getElementById('anoGlobal').value)||0);
            if (!metaVal) return '<div style="color:var(--color-text-muted);font-size:.8rem">Defina uma meta para acompanhar o progresso.</div>';
            const pct = Math.min(100, Math.round((totalBrutoAno/metaVal)*100));
            const cor = pct >= 100 ? '#5cab84' : pct >= 70 ? '#d4d4d8' : '#dd8c8c';
            return '<div><div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:6px"><span style="color:'+cor+'">'+pct+'% atingido</span><span style="color:var(--color-text-muted)">'+fmt(totalBrutoAno)+' / '+fmt(metaVal)+'</span></div>'
              + '<div style="background:rgba(255,255,255,.08);border-radius:20px;height:14px;overflow:hidden"><div style="height:100%;border-radius:20px;background:linear-gradient(90deg,'+cor+','+cor+'99);width:'+pct+'%;transition:width .5s"></div></div>'
              + (pct >= 100 ? '<div style="color:#5cab84;font-size:.75rem;margin-top:6px">Meta atingida!</div>' : '<div style="color:var(--color-text-muted);font-size:.72rem;margin-top:6px">Faltam '+fmt(metaVal-totalBrutoAno)+' para atingir a meta.</div>')
              + '</div>';
          })()}
        </div>
      </div>
    </div>

    <div id="dre-container"></div>

  `;
  renderDRE();
}

// ═══════════════════════════════════════════
// DRE SIMPLIFICADO
// ═══════════════════════════════════════════
function renderDRE() {
  const dreEl = document.getElementById('dre-container');
  if (!dreEl) return;
  const fmt2 = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const num2 = v => parseFloat(String(v||'0').replace(',','.')) || 0;
  let totalBrutoAno = 0, totalSaidasAno = 0;
  const catTotais = {};
  for (let m = 0; m < 12; m++) {
    if (!dados[m]) continue;
    const c = calcularMes(m);
    totalBrutoAno += c.totalBruto;
    totalSaidasAno += c.totalSaidas;
    (dados[m].variaveis||[]).forEach(v => {
      const cat = v.cat || 'Outros';
      catTotais[cat] = (catTotais[cat]||0) + num2(v.valor);
    });
    (dados[m].fixos||[]).forEach(f => {
      const cat = f.nome || 'Fixo';
      catTotais[cat] = (catTotais[cat]||0) + num2(f.valor);
    });
  }
  const totalLiquidoAno = totalBrutoAno - totalSaidasAno;
  const cats = Object.entries(catTotais).sort((a,b) => b[1]-a[1]);
  dreEl.innerHTML = `
    <div style="margin-top:20px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px 20px">
      <div style="font-size:.72rem;letter-spacing:1px;color:var(--color-text-muted);margin-bottom:14px">DRE SIMPLIFICADO · ${new Date().getFullYear()}</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
          <span style="font-size:.82rem;font-weight:700;color:#5cab84">Receita Bruta</span>
          <span style="font-size:.82rem;font-weight:700;color:#5cab84">${fmt2(totalBrutoAno)}</span>
        </div>
        ${cats.map(([cat,val]) => `
        <div style="display:flex;justify-content:space-between;padding:5px 8px;border-radius:6px" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='transparent'">
          <span style="font-size:.78rem;color:var(--color-text-muted)">(-) ${cat}</span>
          <span style="font-size:.78rem;color:#eab7b7">(${fmt2(val)})</span>
        </div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);margin-top:4px">
          <span style="font-size:.82rem;font-weight:700;color:var(--color-text-primary)">Resultado Líquido</span>
          <span style="font-size:.85rem;font-weight:700;color:${totalLiquidoAno>=0?'#5cab84':'#eab7b7'}">${fmt2(totalLiquidoAno)}</span>
        </div>
      </div>
    </div>`;
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
