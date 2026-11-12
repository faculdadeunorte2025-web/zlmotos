// ══════════════════════════════════════════════════════
// DASHBOARD INICIAL
// ══════════════════════════════════════════════════════

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

  // Orçamentos pendentes
  const orcPendentes = orcamentos.filter(o => (o.status||'pendente') === 'pendente').length;

  // ── GRÁFICO 6 MESES ──────────────────────────────────────
  // Pega os últimos 6 meses (incluindo o atual)
  const graf6 = [];
  for (let i = 5; i >= 0; i--) {
    let m = mesAtual - i;
    // CORREÇÃO: no começo do ano, os meses anteriores a janeiro eram pegos do
    // FIM do mesmo ano (ex.: em março mostrava nov/dez do ano atual, vazios).
    // Agora usa os dados do ano anterior.
    let c;
    if (m < 0) { m += 12; c = calcularMesComDados(m, (dadosAnoAnterior || {})[m]); }
    else c = calcularMes(m);
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
      rx="3" fill="#5cab84" opacity="${opBruto}" style="cursor:pointer" onclick="sbIr(${g.idx})"
      title="${g.mes}: Entradas ${fmt(g.bruto)}"><title>${g.mes} — Entradas: ${fmt(g.bruto)}</title></rect>`;

    // barra saídas
    barrasHTML += `<rect x="${x + barW2 + barPad}" y="${(PAD_T + grafH - hSaidas).toFixed(1)}" width="${barW2}" height="${hSaidas.toFixed(1)}"
      rx="3" fill="#eab7b7" opacity="${opSaidas}" style="cursor:pointer" onclick="sbIr(${g.idx})"
      title="${g.mes}: Saídas ${fmt(g.saidas)}"><title>${g.mes} — Saídas: ${fmt(g.saidas)}</title></rect>`;

    // label do mês
    barrasHTML += `<text x="${(x + barW2 + barPad/2).toFixed(1)}" y="${SVG_H - 8}" text-anchor="middle"
      font-size="9" fill="${isAtual ? '#d4d4d8' : 'rgba(255,255,255,0.35)'}" font-family="Inter,sans-serif">${g.mes}</text>`;
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
    const cor = g.liquido >= 0 ? '#c2c2c5' : '#eab7b7';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${cor}" stroke="#0a0a0d" stroke-width="1.5" style="cursor:pointer" onclick="sbIr(${g.idx})"><title>${g.mes} — Lucro: ${fmt(g.liquido)}</title></circle>`;
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
    <polyline points="${pontosLinha}" fill="none" stroke="#c2c2c5" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.8"/>
    <!-- pontos lucro -->
    ${circulosLinha}
  </svg>`;

  // ── LEGENDA TOTAIS ANO ────────────────────────────────────
  const totalEntAno = graf6.reduce((s,g) => s + g.bruto, 0);
  const totalSaiAno = graf6.reduce((s,g) => s + g.saidas, 0);
  const totalLiqAno = totalEntAno - totalSaiAno;

  const cards = [
    { icon:'', label:'Entradas ' + MESES_PT[mesAtual], valor: fmt(calc.totalBruto), cor:'#5cab84', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.1)', onclick:'sbIr(' + mesAtual + ')' },
    { icon:'', label:'Saídas ' + MESES_PT[mesAtual], valor: fmt(calc.totalSaidas), cor:'#eab7b7', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.1)', onclick:'sbIr(' + mesAtual + ')' },
    { icon:'', label:'Lucro ' + MESES_PT[mesAtual], valor: fmt(calc.totalLiquido), cor: calc.totalLiquido >= 0 ? '#c2c2c5' : '#eab7b7', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.1)', onclick:'sbIr(' + mesAtual + ')' },
    { icon:'', label:'Orçamentos Pendentes', valor: orcPendentes + ' aguardando', cor:'#d4d4d8', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.1)', onclick:'sbIr(13)' },
  ];

  const cardsHTML = cards.map(c =>
    '<div onclick="' + c.onclick + '" style="cursor:pointer;position:relative;overflow:hidden;background:#1e1e21;border:1px solid ' + c.borda + ';border-radius:14px;padding:18px 20px;transition:transform .25s cubic-bezier(.23,1,.32,1),box-shadow .25s,border-color .2s;box-shadow:0 4px 16px rgba(0,0,0,.4)">'
    + '<div style="position:relative;z-index:1;font-size:.72rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:6px">' + c.icon + ' ' + c.label + '</div>'
    + '<div style="position:relative;z-index:1;font-size:1.3rem;font-weight:700;color:' + c.cor + ';font-family:\'JetBrains Mono\',monospace">' + c.valor + '</div>'
    + '</div>'
  ).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter',sans-serif;font-size:1.35rem;letter-spacing:.5px;color:#d4d4d8">Dashboard</span>
      <div class="toolbar-right">
        <span style="font-size:.75rem;color:var(--color-text-muted)">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</span>
      </div>
    </div>

    <!-- META MENSAL C09 -->
    ${metaMensal > 0 ? (() => {
      const pct = Math.min(100, Math.round((calc.totalBruto / metaMensal) * 100));
      const corMeta = pct >= 100 ? '#5cab84' : pct >= 80 ? '#d4d4d8' : '#dd8c8c';
      const fmt2 = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0});
      return `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:16px;cursor:pointer" onclick="sbIr(${mesAtual})">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
            <span style="font-size:.72rem;color:var(--color-text-muted);letter-spacing:1px">META ${MESES_PT[mesAtual].toUpperCase()}</span>
            <span style="font-size:.82rem;font-weight:700;color:${corMeta}">${pct}% — ${fmt2(calc.totalBruto)} de ${fmt2(metaMensal)}</span>
          </div>
          <div style="height:8px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${corMeta};border-radius:999px;transition:width .5s"></div>
          </div>
        </div>
        <div style="font-size:1.4rem;font-weight:700;color:${corMeta}">${pct >= 100 ? '' : pct >= 80 ? '' : ''}</div>
      </div>`;
    })() : `<div style="background:rgba(255,255,255,.02);border:1px dashed rgba(255,255,255,.08);border-radius:14px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="dashDefinirMeta()">
      <span style="font-size:.82rem;color:var(--color-text-muted)">Definir meta mensal de faturamento</span>
      <button style="margin-left:auto;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#5cab84;border-radius:8px;padding:5px 14px;font-size:.78rem;cursor:pointer">+ Definir</button>
    </div>`}

    <!-- ALERTAS ACIONÁVEIS C06 -->
    ${(() => {
      const alertasAtivos = [];
      // Orçamentos pendentes há +3 dias
      const orcParados = orcamentos.filter(o => {
        if ((o.status||'pendente') !== 'pendente') return false;
        const d = o.criadoEm||o.data;
        if (!d) return false;
        return Math.floor((new Date()-new Date(d))/(86400000)) >= 3;
      });
      if (orcParados.length > 0) alertasAtivos.push({
        cor:'#c2c2c5', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.125)',
        icon:'', txt: `<b>${orcParados.length} orçamento${orcParados.length>1?'s':''}</b> pendente${orcParados.length>1?'s':''} há +3 dias sem resposta`,
        acao: `orcViewMode='kanban';abaAtiva=13;renderAll()`
      });
      // Contas a pagar vencidas ou vencendo em até 2 dias
      const _cpAlerta = contasPagarPendentes().filter(c => c.vencimento && c.vencimento <= _cpHojeMais(2));
      if (_cpAlerta.length > 0) {
        const _venc = _cpAlerta.filter(c => c.vencimento < hojeISO()).length;
        alertasAtivos.push({
          cor:'#e06c6c', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.125)', icon:'',
          txt: `<b>${_cpAlerta.length} conta${_cpAlerta.length>1?'s':''} a pagar</b> ${_venc ? '— ' + _venc + ' vencida' + (_venc>1?'s':'') : 'vencendo em até 2 dias'}`,
          acao: `sbIr(24)`
        });
      }
      // ── ALERTAS DE META ──
      if (metaMensal > 0) {
        const pctMeta = calc.totalBruto / metaMensal * 100;
        const diasNoMes = new Date(anoAtual, mesAtual+1, 0).getDate();
        const diaAtual = new Date().getDate();
        const mesPassou = mesAtual < new Date().getMonth() || anoAtual < new Date().getFullYear();

        if (mesPassou && pctMeta < 100) {
          // Mês fechou sem bater a meta
          alertasAtivos.push({
            cor:'#dd8c8c', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.125)',
            icon:'', txt: `<b>Meta de ${MESES_PT[mesAtual]} não foi batida</b> — atingido ${Math.round(pctMeta)}% (R$ ${parseFloat(calc.totalBruto).toLocaleString('pt-BR',{minimumFractionDigits:0})} de R$ ${parseFloat(metaMensal).toLocaleString('pt-BR',{minimumFractionDigits:0})})`,
            acao: `sbIrMes(${mesAtual})`
          });
        } else if (!mesPassou && pctMeta >= 100) {
          // Meta batida!
          alertasAtivos.push({
            cor:'#5cab84', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.125)',
            icon:'', txt: `<b>Meta de ${MESES_PT[mesAtual]} batida!</b> — ${Math.round(pctMeta)}% alcançado. Parabéns!`,
            acao: `sbIrMes(${mesAtual})`
          });
        } else if (!mesPassou && pctMeta >= 80 && pctMeta < 100) {
          // 80% da meta
          const faltam = metaMensal - calc.totalBruto;
          alertasAtivos.push({
            cor:'#d4d4d8', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.125)',
            icon:'', txt: `<b>80% da meta atingida!</b> — Faltam R$ ${parseFloat(faltam).toLocaleString('pt-BR',{minimumFractionDigits:0})} para bater a meta de ${MESES_PT[mesAtual]}`,
            acao: `sbIrMes(${mesAtual})`
          });
        } else if (!mesPassou && pctMeta < 50 && diaAtual > diasNoMes * 0.6) {
          // Menos de 50% da meta com mais de 60% do mês passado
          alertasAtivos.push({
            cor:'#dd8c8c', bg:'rgba(255,255,255,0.03)', borda:'rgba(255,255,255,0.1)',
            icon:'', txt: `<b>Atenção com a meta!</b> — ${Math.round(pctMeta)}% em ${diaAtual} dias. Ritmo abaixo do necessário para bater em ${MESES_PT[mesAtual]}`,
            acao: `sbIrMes(${mesAtual})`
          });
        }
      }
      // Aniversariantes da semana C08
      const hoje2 = new Date(); const fimSemana = new Date(hoje2); fimSemana.setDate(hoje2.getDate()+7);
      const aniversariantes = (clientesCadastradosManuais||[]).filter(c => {
        if (!c.nascimento) return false;
        const nasc = new Date(c.nascimento+'T12:00:00');
        const esteAno = new Date(hoje2.getFullYear(), nasc.getMonth(), nasc.getDate());
        return esteAno >= hoje2 && esteAno <= fimSemana;
      });
      if (aniversariantes.length > 0) alertasAtivos.push({
        cor:'#b3b3b6', bg:'rgba(255,255,255,0.04)', borda:'rgba(255,255,255,0.125)',
        icon:'', txt: `<b>${aniversariantes.length} aniversariante${aniversariantes.length>1?'s':''}</b> esta semana: ${aniversariantes.slice(0,2).map(c=>c.nome.split(' ')[0]).join(', ')}`,
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
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      ${cardsHTML}
    </div>

    <!-- GRÁFICO FATURAMENTO 6 MESES -->
    <div style="background:#121215;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:18px 20px;margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:.72rem;letter-spacing:1px;color:var(--color-text-muted);margin-bottom:2px">VISÃO GERAL · ÚLTIMOS 6 MESES</div>
          <div style="font-size:.82rem;font-weight:600;color:var(--color-text-primary)">Faturamento mensal</div>
        </div>
        <!-- legenda + totais acumulados -->
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:#5cab84"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#5cab84"></span> Entradas</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:#eab7b7"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#eab7b7"></span> Saídas</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:.7rem;color:#c2c2c5"><span style="display:inline-block;width:10px;height:6px;border-radius:1px;background:none;border-top:2px dashed #c2c2c5"></span> Lucro</div>
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
          <div style="font-size:1rem;font-weight:700;color:#5cab84;font-family:'JetBrains Mono',monospace">${fmt(totalEntAno)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.65rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:3px">SAÍDAS ACUM.</div>
          <div style="font-size:1rem;font-weight:700;color:#eab7b7;font-family:'JetBrains Mono',monospace">${fmt(totalSaiAno)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:.65rem;color:var(--color-text-muted);letter-spacing:1px;margin-bottom:3px">LUCRO ACUM.</div>
          <div style="font-size:1rem;font-weight:700;color:${totalLiqAno >= 0 ? '#c2c2c5' : '#eab7b7'};font-family:'JetBrains Mono',monospace">${fmt(totalLiqAno)}</div>
        </div>
      </div>
    </div>

  `;
}
