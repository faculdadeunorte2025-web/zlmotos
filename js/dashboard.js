function dashDefinirMeta() {
  const val = prompt('Meta mensal de faturamento (R$):', metaMensal > 0 ? metaMensal : '');
  if (val === null) return;
  const n = parseFloat(val.replace(/[^\d.,]/g,'').replace(',','.')) || 0;
  metaMensal = n;
  dashSalvarMeta();
  renderDashboard();
}

async function dashSalvarMeta() {
  try {
    const snap = await window._firestoreGetDoc(window._userDoc('config_geral'));
    const base = snap.exists() ? snap.data() : {};
    await window._firestoreSetDoc(window._userDoc('config_geral'), { ...base, metaMensal, atualizadoEm: new Date().toISOString() });
  } catch(e) {}
}

async function dashCarregarMeta() {
  try {
    const snap = await window._firestoreGetDoc(window._userDoc('config_geral'));
    if (snap.exists()) {
      metaMensal = parseFloat(snap.data().metaMensal)||0;
      mecanicosCadastrados = snap.data().mecanicos || [];
    }
  } catch(e) {}
}

// C02 — Mecânicos ─────────────────────────────────────────────────
async function mecSalvar() {
  try {
    const snap = await window._firestoreGetDoc(window._userDoc('config_geral'));
    const base = snap.exists() ? snap.data() : {};
    await window._firestoreSetDoc(window._userDoc('config_geral'), { ...base, mecanicos: mecanicosCadastrados, atualizadoEm: new Date().toISOString() });
  } catch(e) {}
}

// M01 — Tema claro/escuro ─────────────────────────────────────────
function toggleTema() {
  document.body.classList.toggle('tema-claro');
  localStorage.setItem('zlmotos_tema', document.body.classList.contains('tema-claro') ? 'claro' : 'escuro');
  renderConfiguracoes();
}
(function() {
  const tema = localStorage.getItem('zlmotos_tema');
  if (tema === 'claro') document.body.classList.add('tema-claro');
})();

// I13 — Modo offline / cache local ───────────────────────────────
function _salvarCacheLocal() {
  try {
    localStorage.setItem('zlmotos_cache', JSON.stringify({
      ordens, orcamentos, estoque, clientesCadastradosManuais,
      agendamentos, vendaHistorico, metaMensal,
      cachedAt: new Date().toISOString()
    }));
  } catch(e) {}
}

function _carregarCacheLocal() {
  try {
    const raw = localStorage.getItem('zlmotos_cache');
    if (!raw) return false;
    const cache = JSON.parse(raw);
    if (!cache.cachedAt) return false;
    const age = (new Date()-new Date(cache.cachedAt)) / 3600000; // horas
    if (age > 24) return false; // cache de até 24h
    ordens = cache.ordens || ordens;
    orcamentos = cache.orcamentos || orcamentos;
    estoque = cache.estoque || estoque;
    clientesCadastradosManuais = cache.clientesCadastradosManuais || clientesCadastradosManuais;
    agendamentos = cache.agendamentos || agendamentos;
    vendaHistorico = cache.vendaHistorico || vendaHistorico;
    metaMensal = cache.metaMensal || metaMensal;
    return true;
  } catch(e) { return false; }
}

function mecNomeStr(m) { return typeof m === 'string' ? m : (m.nome||''); }
function mecComissao(nome) {
  const m = mecanicosCadastrados.find(x => mecNomeStr(x)===nome);
  return m && typeof m === 'object' ? (m.comissao||0) : 0;
}

// I12 — Backup manual ─────────────────────────────────────────────
async function backupExportarJSON() {
  mostrarToast('⏳ Preparando backup...');
  const backup = {
    exportadoEm: new Date().toISOString(),
    versao: 'v5.5.7',
    empresa: empresa || {},
    ordens, orcamentos, estoque, agendamentos,
    clientes: clientesCadastradosManuais,
    vendaHistorico, fornecedores, estEntradas,
    mecanicosCadastrados, categorias: CATEGORIAS,
    metaMensal
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ZLMotos_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast('✓ Backup exportado!');
}

// I05 — Relatório mensal PDF ──────────────────────────────────────
async function relatorioMensalPDF() {
  let jsPDF;
  try { jsPDF = (window.jspdf&&window.jspdf.jsPDF)||window.jsPDF||null; } catch(e){jsPDF=null;}
  if (!jsPDF) { mostrarToast('PDF não disponível'); return; }

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const calc = calcularMes(mesAtual);
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const mesInicio = new Date(anoAtual,mesAtual,1);
  const mesFim = new Date(anoAtual,mesAtual+1,0);
  const dentroMes = d => { if(!d) return false; const dt=new Date(d.length===10?d+'T12:00:00':d); return dt>=mesInicio&&dt<=mesFim; };

  const osDoMes = ordens.filter(o=>dentroMes(o.dataEntrada||o.criadoEm));
  const osConcluidas = osDoMes.filter(o=>o.status==='concluida'||o.status==='entregue');
  const fatOS = osConcluidas.reduce((s,o)=>s+(parseFloat(osCalcTotal(o))||0),0);
  const fatVenda = vendaHistorico.filter(v=>dentroMes(v.data)).reduce((s,v)=>s+(parseFloat(v.total)||0),0);

  // Top clientes
  const topCli = {};
  osConcluidas.forEach(o=>{const c=o.cliente||'—';if(!topCli[c])topCli[c]=0;topCli[c]+=parseFloat(osCalcTotal(o))||0;});
  const topCliList = Object.entries(topCli).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W = 210, M = 18;
  let y = 20;

  // Header
  doc.setFillColor(10,10,16); doc.rect(0,0,W,297,'F');
  doc.setFontSize(20); doc.setTextColor(200,16,46); doc.setFont('helvetica','bold');
  doc.text('ZL MOTOS', M, y);
  doc.setFontSize(11); doc.setTextColor(150,150,160); doc.setFont('helvetica','normal');
  doc.text(`Relatório Mensal — ${MESES[mesAtual]} ${anoAtual}`, M, y+8);
  doc.text(new Date().toLocaleDateString('pt-BR'), W-M, y+8, {align:'right'});
  y += 18;

  doc.setDrawColor(200,16,46); doc.setLineWidth(0.6); doc.line(M,y,W-M,y); y+=10;

  // Cards financeiros
  const blocos = [
    {label:'ENTRADAS', val:fmt(calc.totalBruto), cor:[52,211,153]},
    {label:'SAÍDAS', val:fmt(calc.totalSaidas), cor:[248,113,113]},
    {label:'LÍQUIDO', val:fmt(calc.totalLiquido), cor:calc.totalLiquido>=0?[167,139,250]:[248,113,113]},
    {label:'OS CONCLUÍDAS', val:String(osConcluidas.length), cor:[96,165,250]},
    {label:'FAT. OS', val:fmt(fatOS), cor:[251,191,36]},
    {label:'FAT. VENDAS', val:fmt(fatVenda), cor:[251,191,36]},
  ];
  const cw=(W-2*M-10)/3;
  blocos.forEach((b,i)=>{
    const col=i%3, row=Math.floor(i/3);
    const bx=M+col*(cw+5), by=y+row*22;
    doc.setFillColor(30,30,46); doc.roundedRect(bx,by,cw,18,2,2,'F');
    doc.setFontSize(7); doc.setTextColor(...b.cor.map(v=>Math.min(255,v+80)));
    doc.setFont('helvetica','bold'); doc.text(b.label, bx+4, by+6);
    doc.setFontSize(11); doc.setTextColor(...b.cor); doc.text(b.val, bx+4, by+14);
  });
  y += 52;

  doc.setDrawColor(50,50,70); doc.line(M,y,W-M,y); y+=8;

  // OS do mês
  doc.setFontSize(10); doc.setTextColor(200,200,220); doc.setFont('helvetica','bold');
  doc.text('ORDENS DE SERVIÇO DO MÊS', M, y); y+=7;
  doc.setFontSize(8); doc.setTextColor(180,180,200); doc.setFont('helvetica','normal');
  osConcluidas.slice(0,10).forEach(o=>{
    const linha = `OS ${osNumeroFormatado(o.numero)} · ${o.cliente||'—'} · ${o.veiculo||'—'} · ${fmt(osCalcTotal(o))}`;
    doc.text(linha.substring(0,85), M, y); y+=6;
    if(y>260){doc.addPage();doc.setFillColor(10,10,16);doc.rect(0,0,W,297,'F');y=20;}
  });
  if(osDoMes.length>osConcluidas.length){
    doc.text(`+ ${osDoMes.length-osConcluidas.length} OS em andamento`, M, y); y+=8;
  }
  y+=4; doc.line(M,y,W-M,y); y+=8;

  // Top clientes
  if(topCliList.length>0){
    doc.setFontSize(10); doc.setTextColor(200,200,220); doc.setFont('helvetica','bold');
    doc.text('TOP CLIENTES DO MÊS', M, y); y+=7;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(180,180,200);
    topCliList.forEach(([nome,val],i)=>{
      doc.text(`${i+1}. ${nome}`, M, y);
      doc.text(fmt(val), W-M, y, {align:'right'}); y+=6;
    });
  }

  doc.save(`ZLMotos_Relatorio_${MESES[mesAtual]}_${anoAtual}.pdf`);
  mostrarToast('✓ Relatório gerado!');
}

// I04 — Relatório de comissão por mecânico ────────────────────────
function renderRelatorioComissao() {
  const main = document.getElementById('mainContent');
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mesInicio = new Date(anoAtual,mesAtual,1);
  const mesFim = new Date(anoAtual,mesAtual+1,0);
  const dentroMes = d=>{if(!d)return false;const dt=new Date(d.length===10?d+'T12:00:00':d);return dt>=mesInicio&&dt<=mesFim;};
  const map = {};
  ordens.filter(o=>(o.status==='concluida'||o.status==='entregue')&&dentroMes(o.dataEntrada||o.criadoEm)).forEach(o=>{
    const mec=(o.mecanico||'Sem mecânico').trim();
    if(!map[mec])map[mec]={os:0,total:0};
    map[mec].os++; map[mec].total+=parseFloat(osCalcTotal(o)||0);
  });
  const rows = Object.entries(map).sort((a,b)=>b[1].total-a[1].total).map(([mec,d])=>{
    const pct=mecComissao(mec); const comVal=d.total*(pct/100);
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.05)">
      <td style="padding:10px 14px;font-weight:700">👨‍🔧 ${mec}</td>
      <td style="padding:10px 14px;text-align:center;color:var(--color-text-muted)">${d.os}</td>
      <td style="padding:10px 14px;text-align:right;color:#6ee7b7;font-family:monospace">${fmt(d.total)}</td>
      <td style="padding:10px 14px;text-align:center;color:#a78bfa">${pct}%</td>
      <td style="padding:10px 14px;text-align:right;color:#fbbf24;font-weight:700;font-family:monospace">${fmt(comVal)}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted);padding:24px">Nenhuma OS concluída este mês</td></tr>';

  main.innerHTML = `<div class="toolbar">
    <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:#a78bfa">💰 Comissões — ${MESES[mesAtual]}</span>
    <div class="toolbar-right"><button class="btn" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted)" onclick="abaAtiva=22;renderAll()">← Voltar</button></div>
  </div>
  <div style="max-width:800px;margin:0 auto">
    <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,.03);border:1px solid var(--color-border);border-radius:14px;overflow:hidden">
      <thead><tr style="border-bottom:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04)">
        <th style="padding:10px 14px;text-align:left;font-size:.72rem;color:var(--color-text-muted)">MECÂNICO</th>
        <th style="padding:10px 14px;text-align:center;font-size:.72rem;color:var(--color-text-muted)">OS</th>
        <th style="padding:10px 14px;text-align:right;font-size:.72rem;color:var(--color-text-muted)">FATURADO</th>
        <th style="padding:10px 14px;text-align:center;font-size:.72rem;color:var(--color-text-muted)">COMISSÃO %</th>
        <th style="padding:10px 14px;text-align:right;font-size:.72rem;color:var(--color-text-muted)">A PAGAR</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:10px;font-size:.72rem;color:var(--color-text-muted)">Configure os percentuais em Configurações → Mecânicos</div>
  </div>`;
}

async function mecAdicionar(nome) {
  nome = nome.trim();
  if (!nome) return;
  const nomes = mecanicosCadastrados.map(m => mecNomeStr(m).toLowerCase());
  if (nomes.includes(nome.toLowerCase())) { mostrarToast('Mecânico já cadastrado'); return; }
  mecanicosCadastrados.push({ nome, comissao: 0 });
  await mecSalvar();
  mostrarToast('✓ ' + nome + ' cadastrado');
  renderConfiguracoes();
}

async function mecRemover(nome) {
  mecanicosCadastrados = mecanicosCadastrados.filter(m => mecNomeStr(m) !== nome);
  await mecSalvar();
  renderConfiguracoes();
}

async function mecAtualizarComissao(idx, val) {
  if (typeof mecanicosCadastrados[idx] === 'string') {
    mecanicosCadastrados[idx] = { nome: mecanicosCadastrados[idx], comissao: parseFloat(val)||0 };
  } else {
    mecanicosCadastrados[idx].comissao = parseFloat(val)||0;
  }
  await mecSalvar();
}

function mecAutoCompleteOS(osId, inputEl) {
  const termo = inputEl.value.toLowerCase();
  const drop = document.getElementById('mec-drop-' + osId);
  if (!drop) return;
  const sugs = mecanicosCadastrados.filter(m => mecNomeStr(m).toLowerCase().includes(termo));
  if (!sugs.length || !termo) { drop.innerHTML = ''; return; }
  drop.innerHTML = sugs.map(m =>
    `<div onclick="osSalvarCampo('${osId}','mecanico','${mecNomeStr(m).replace(/'/g,"\\'")}');document.getElementById('mec-drop-${osId}').innerHTML='';renderOS()"
      style="padding:7px 12px;cursor:pointer;font-size:.82rem;border-bottom:1px solid rgba(255,255,255,.05)"
      onmouseover="this.style.background='rgba(167,139,250,.1)'" onmouseout="this.style.background=''">
      👨‍🔧 ${mecNomeStr(m)}
    </div>`
  ).join('');
}

// C01 — WhatsApp automático ao mudar status ───────────────────────
const _osStatusMsg = {
  andamento: (os) => `🔧 *Olá, ${os.cliente||'cliente'}!*\n\nSua moto *${os.veiculo||''}* já está sendo atendida pelos nossos mecânicos na *ZL MOTOS*. ⚙️\n\n*OS:* ${osNumeroFormatado(os.numero)}\n\nQualquer dúvida, estamos à disposição! 🏍️`,
  concluida: (os) => `✅ *Olá, ${os.cliente||'cliente'}!*\n\nBoa notícia! O serviço da sua moto *${os.veiculo||''}* foi *concluído* com sucesso na *ZL MOTOS*!\n\n*OS:* ${osNumeroFormatado(os.numero)}\n*Total:* R$ ${parseFloat(osCalcTotal(os)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}\n\nAgendaremos a entrega em breve. 🏁`,
  entregue:  (os) => `🏍️ *Olá, ${os.cliente||'cliente'}!*\n\nSua moto *${os.veiculo||''}* está *pronta para retirada* na *ZL MOTOS*!\n\nEstamos aguardando você. Obrigado pela confiança! 🙏\n\n_ZL MOTOS — ${empresa?.nomeFantasia||'ZL Motos'}_`,
};

function osWhatsAppAutomatico(os, novoStatus) {
  if (!os.telefone) return;
  const msgFn = _osStatusMsg[novoStatus];
  if (!msgFn) return;
  const tel = os.telefone.replace(/\D/g,'');
  const msg = msgFn(os);
  setTimeout(() => {
    if (confirm(`📲 Enviar WhatsApp para ${os.cliente||'cliente'} sobre mudança de status?\n\n"${msg.substring(0,80)}..."`)) {
      window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  }, 400);
}

// C08 — Aniversariantes ───────────────────────────────────────────
function aniversariantesHoje() {
  const hoje = new Date();
  return (clientesCadastradosManuais||[]).filter(c => {
    if (!c.nascimento) return false;
    const n = new Date(c.nascimento+'T12:00:00');
    return n.getDate()===hoje.getDate() && n.getMonth()===hoje.getMonth();
  });
}

function aniversariantesSemana() {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const fim = new Date(hoje); fim.setDate(hoje.getDate()+7);
  return (clientesCadastradosManuais||[]).filter(c => {
    if (!c.nascimento) return false;
    const n = new Date(c.nascimento+'T12:00:00');
    const esteAno = new Date(hoje.getFullYear(), n.getMonth(), n.getDate());
    return esteAno >= hoje && esteAno <= fim;
  }).sort((a,b) => {
    const hoje2 = new Date();
    const da = new Date(hoje2.getFullYear(), new Date(a.nascimento+'T12:00:00').getMonth(), new Date(a.nascimento+'T12:00:00').getDate());
    const db = new Date(hoje2.getFullYear(), new Date(b.nascimento+'T12:00:00').getMonth(), new Date(b.nascimento+'T12:00:00').getDate());
    return da - db;
  });
}

function whatsAppAniversario(cli) {
  const tel = (cli.tel||'').replace(/\D/g,'');
  if (!tel) { mostrarToast('Cliente sem telefone cadastrado'); return; }
  const msg = `🎂 *Parabéns, ${cli.nome.split(' ')[0]}!*\n\nA equipe da *ZL MOTOS* deseja a você um feliz aniversário! 🎉🏍️\n\nQue seu dia seja incrível e que a estrada sempre seja generosa com você!\n\n_Com carinho, ZL MOTOS_`;
  window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function categoriasCarregar() {
  try {
    const snap = await window._firestoreGetDoc(window._userDoc('categorias_mes'));
    if (snap.exists() && snap.data().lista?.length) CATEGORIAS = snap.data().lista;
  } catch(e) {}
}

async function categoriasSalvar() {
  try {
    await window._firestoreSetDoc(window._userDoc('categorias_mes'), { lista: CATEGORIAS, atualizadoEm: new Date().toISOString() });
  } catch(e) { mostrarErro('Erro ao salvar categorias'); }
}

async function categoriaAdicionar(nome) {
  nome = nome.trim();
  if (!nome) return;
  if (CATEGORIAS.find(c => c.toLowerCase() === nome.toLowerCase())) { mostrarToast('Categoria já existe'); return; }
  CATEGORIAS.push(nome);
  await categoriasSalvar();
  mostrarToast('✓ Categoria "' + nome + '" adicionada');
  renderMes(abaAtiva);
}

async function categoriaExcluir(nome) {
  if (!confirm('Excluir categoria "' + nome + '"?')) return;
  CATEGORIAS = CATEGORIAS.filter(c => c !== nome);
  await categoriasSalvar();
  if (filtroCategoria === nome) filtroCategoria = 'Todos';
  mostrarToast('Categoria removida');
  renderMes(abaAtiva);
}


function chaveStorage() {
  return `zlmotos_${( document.getElementById('anoGlobal') ? document.getElementById('anoGlobal').value : new Date().getFullYear() ) || new Date().getFullYear()}`;
}

// ═══════════════════════════════════════════
// INICIALIZAR / SALVAR
// ═══════════════════════════════════════════
// ── SELETOR DE ANO ──────────────────────────────────────────────
function abrirModalAno() {
  const anoAtual = document.getElementById('anoGlobal').value || '2025';
  const anoBase = parseInt(anoAtual);
  // Gera lista de anos: 3 antes, atual, 3 depois
  const anos = [];
  for (let a = anoBase - 3; a <= anoBase + 3; a++) anos.push(a);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-ano';
  overlay.innerHTML = `
    <div class="modal" style="width:360px">
      <div class="modal-titulo">📅 Selecionar Ano</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">
        ${anos.map(a => `
          <button class="btn" onclick="confirmarTrocaAno(${a})"
            style="padding:14px;font-family:'Inter';font-size:1.3rem;letter-spacing:2px;
            ${a == anoAtual ? 'background:rgba(59,130,246,.25);border:1px solid var(--color-primary);color:var(--color-primary-hover)' : 'background:rgba(255,255,255,.05);border:1px solid var(--color-border);color:var(--color-text-muted)'}">
            ${a}${a == anoAtual ? '<br><span style="font-size:.55rem;letter-spacing:1px">ATUAL</span>' : ''}
          </button>`).join('')}
      </div>
      <button class="btn" style="width:100%;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted)" onclick="fecharModal('modal-ano')">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
}

async function confirmarTrocaAno(novoAno) {
  novoAno = String(novoAno);
  const anoAtual = document.getElementById('anoGlobal').value || '2025';
  fecharModal('modal-ano');
  if (novoAno === anoAtual) return;

  // Cancela qualquer save pendente
  if (typeof _saveTimer !== 'undefined' && _saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }

  // Salva dados do ano atual de forma forçada
  try {
    const ref = window._userDoc('zlmotos_' + anoAtual);
    await window._firestoreSetDoc(ref, {
      dados: JSON.parse(JSON.stringify(dados)),
      atualizadoEm: new Date().toISOString()
    });
  } catch(e) { console.warn('Erro ao salvar ano atual:', e); }

  // Atualiza o input
  document.getElementById('anoGlobal').value = novoAno;

  // Zera dados na memória
  dados = {};

  // Carrega dados do novo ano
  try {
    const ref = window._userDoc('zlmotos_' + novoAno);
    const snap = await window._firestoreGetDoc(ref);
    if (snap.exists() && snap.data() && snap.data().dados) {
      dados = JSON.parse(JSON.stringify(snap.data().dados));
      mostrarToast('✓ Ano ' + novoAno + ' carregado!');
    } else {
      dados = {};
      mostrarToast('ℹ️ Ano ' + novoAno + ' — planilha zerada');
    }
  } catch(e) {
    dados = {};
    mostrarErro('Erro ao carregar ano ' + novoAno);
  }

  inicializarDadosLocal();
  renderAll();
}
// ─────────────────────────────────────────────────────────────────

function inicializarDadosLocal() {
  for (let m = 0; m < 12; m++) {
    if (!dados[m]) {
      dados[m] = { fixos: FIXOS_PADRAO.map(n => ({nome:n,valor:'',data:''})), variaveis:[], entradas:[], obs:'' };
    } else {
      dados[m].fixos.forEach(f => { if(!f.data) f.data=''; if(f.pago===undefined) f.pago=false; });
      dados[m].variaveis.forEach(v => { if(!v.data) v.data=''; if(!v.cat) v.cat='Outros'; if(v.pago===undefined) v.pago=false; });
      dados[m].entradas.forEach(e => { if(!e.data) e.data=''; });
      if(!dados[m].obs) dados[m].obs='';
    }
  }
}

async function inicializarDados() {
  try {
    const chave = chaveStorage();
    const ref = window._userDoc(chave);
    const snap = await window._firestoreGetDoc(ref);
    if (snap.exists()) {
      dados = snap.data().dados || {};
    } else {
      dados = {};
    }

    // Carrega dados iniciais com getDoc (primeira carga rápida)
    const refEst  = window._userDoc('estoque_global');
    const snapEst = await window._firestoreGetDoc(refEst);
    if (snapEst.exists()) estoque = snapEst.data().itens || [];

    const refOrcs  = window._userDoc('orcamentos_lista');
    const snapOrcs = await window._firestoreGetDoc(refOrcs);
    if (snapOrcs.exists()) {
      orcamentos = snapOrcs.data().lista || [];
      let precisaSalvar = false;
      orcamentos.forEach(o => {
        if (!o.id) { o.id = 'orc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6); precisaSalvar = true; }
      });
      if (precisaSalvar) {
        try { await window._firestoreSetDoc(window._userDoc('orcamentos_lista'), { lista: orcamentos, atualizadoEm: new Date().toISOString() }); } catch(e) {}
      }
    }

    const refOS  = window._userDoc('os_lista');
    const snapOS = await window._firestoreGetDoc(refOS);
    if (snapOS.exists()) ordens = snapOS.data().lista || [];

    const refAg  = window._userDoc('agendamentos_lista');
    const snapAg = await window._firestoreGetDoc(refAg);
    if (snapAg.exists()) {
      agendamentos = snapAg.data().lista || [];
      agHorariosBloqueados = snapAg.data().horariosBloqueados || {};
      agListaEspera = snapAg.data().listaEspera || [];
    }


    const refCli  = window._userDoc('clientes_manuais');
    const snapCli = await window._firestoreGetDoc(refCli);
    if (snapCli.exists()) clientesCadastradosManuais = snapCli.data().lista || [];

  } catch(e) {
    console.warn('Firestore indisponível:', e);
    const temCache = _carregarCacheLocal();
    if (temCache) {
      mostrarToast('⚠️ Modo offline — exibindo dados em cache');
    } else {
      mostrarErro('Sem conexão com o Firebase. Verifique a internet.');
    }
    dados = {};
  }
  await carregarEmpresa();
  await carregarFilaMotos();
  inicializarDadosLocal();
  catCarregarDoEstoque();
  renderAll();
  agVerificarLembretes();
  estVerificarReposicao();
  orcVerificarAprovacaoURL();
  carregarClientesManuais();
  osIniciarListenerTempoReal(); // RF01 — sincronização em tempo real
  iniciarListenersTempoReal();  // ← NOVO: todos os outros dados
  await categoriasCarregar();
  await dashCarregarMeta();
  await estCarregarFornecedores();
  await estCarregarEntradas();
  // I13 — salvar cache local para modo offline
  _salvarCacheLocal();
}

// ── Listeners em tempo real para todos os dados ──────────────────
let _unsubOrcs = null, _unsubEst = null, _unsubAg = null, _unsubCli = null;

function iniciarListenersTempoReal() {
  try {
    // Orçamentos
    if (!_unsubOrcs) {
      _unsubOrcs = window._firestoreOnSnapshot(window._userDoc('orcamentos_lista'), snap => {
        if (!snap.exists()) return;
        orcamentos = snap.data().lista || [];
        if (abaAtiva === 13) renderOrcamento();
        renderSidebar && renderSidebar();
      });
    }
    // Estoque
    if (!_unsubEst) {
      _unsubEst = window._firestoreOnSnapshot(window._userDoc('estoque_global'), snap => {
        if (!snap.exists()) return;
        estoque = snap.data().itens || [];
        catCarregarDoEstoque && catCarregarDoEstoque();
        if (abaAtiva === 14) renderEstoque();
      });
    }
    // Agendamentos
    if (!_unsubAg) {
      _unsubAg = window._firestoreOnSnapshot(window._userDoc('agendamentos_lista'), snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        agendamentos = d.lista || [];
        agHorariosBloqueados = d.horariosBloqueados || {};
        agListaEspera = d.listaEspera || [];
        if (abaAtiva === 16) renderAgendamentos && renderAgendamentos();
        renderSidebar && renderSidebar();
      });
    }
    // Clientes
    if (!_unsubCli) {
      try {
        // Listener na collection 'clientes' (formato atual)
        const colCli = window._userCollection('clientes');
        _unsubCli = window._firestoreOnSnapshot(colCli, snap => {
          if (!snap || snap.empty === undefined) return;
          if (!snap.empty) {
            clientesCadastradosManuais = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }
          if (abaAtiva === 20) renderClientes();
        });
      } catch(e) {
        // Fallback: listener no documento legado
        _unsubCli = window._firestoreOnSnapshot(window._userDoc('clientes_manuais'), snap => {
          if (!snap.exists()) return;
          const lista = snap.data().lista || [];
          if (lista.length > 0) clientesCadastradosManuais = lista;
          if (abaAtiva === 20) renderClientes();
        });
      }
    }
    // Contas a pagar
  } catch(e) { console.warn('iniciarListenersTempoReal:', e); }
}

let _saveTimer = null;
async function salvarDados() {
  const st = document.getElementById('saveStatus');
  if (st) { st.textContent = '⏳ Salvando...'; st.classList.add('salvando'); st.classList.remove('visible'); }

  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const chave = chaveStorage();
      const ref = window._userDoc(chave);
      await window._firestoreSetDoc(ref, { dados: dados, atualizadoEm: new Date().toISOString() });
    } catch(e) {
      console.warn('Erro ao salvar no Firestore:', e);
      mostrarErro('Erro ao salvar — verifique sua conexão');
    }
    const st2 = document.getElementById('saveStatus');
    if (st2) {
      st2.textContent = '✓ SALVO';
      st2.classList.remove('salvando');
      st2.classList.add('visible');
      setTimeout(() => st2.classList.remove('visible'), 2000);
    }
  }, 800);
}

// ═══════════════════════════════════════════
// FORMATAÇÃO / CÁLCULOS
// ═══════════════════════════════════════════
function fmt(v) {
  const n = parseFloat(v)||0;
  return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function num(v) { return parseFloat(v)||0; }

function calcularMes(m) {
  const mes = dados[m];
  const totalFixos = mes.fixos.reduce((s,f) => s+(f.pago!==false?num(f.valor):0),0);
  const totalVar   = mes.variaveis.reduce((s,v) => s+(v.pago!==false?num(v.valor):0),0);
  const totalSaidas = totalFixos+totalVar;
  const totalBruto  = mes.entradas.reduce((s,e) => s+num(e.valor),0);
  const totalLiquido = totalBruto-totalSaidas;
  const vazio = totalSaidas===0 && totalBruto===0;
  return { totalFixos, totalVar, totalSaidas, totalBruto, totalLiquido, vazio };
}

function calcularMesComDados(m, mesData) {
  if (!mesData) return { totalFixos:0, totalVar:0, totalSaidas:0, totalBruto:0, totalLiquido:0, vazio:true };
  const totalFixos = (mesData.fixos||[]).reduce((s,f) => s+(f.pago!==false?num(f.valor):0),0);
  const totalVar   = (mesData.variaveis||[]).reduce((s,v) => s+(v.pago!==false?num(v.valor):0),0);
  const totalSaidas = totalFixos+totalVar;
  const totalBruto  = (mesData.entradas||[]).reduce((s,e) => s+num(e.valor),0);
  const totalLiquido = totalBruto-totalSaidas;
  const vazio = totalSaidas===0 && totalBruto===0;
  return { totalFixos, totalVar, totalSaidas, totalBruto, totalLiquido, vazio };
}

// Armazena dados de outros anos para comparativo
let dadosTodos = {};


function tendencia(m) {
  if (m === 0) return null;
  const atual = calcularMes(m).totalLiquido;
  const ant   = calcularMes(m-1).totalLiquido;
  if (ant === 0) return null;
  const pct = ((atual-ant)/Math.abs(ant)*100).toFixed(1);
  return { pct, up: atual >= ant };
}

// ═══════════════════════════════════════════
// CONFIRMAÇÃO DE EXCLUSÃO
// ═══════════════════════════════════════════
function confirmarExclusao(descricao, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <p>Excluir este item?</p>
      <small>${descricao}</small>
      <div class="confirm-btns">
        <button class="btn-confirm-cancel" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button>
        <button class="btn-confirm-del" id="btn-confirm-ok">Excluir</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('btn-confirm-ok').onclick = () => { overlay.remove(); onConfirm(); };
}

// ═══════════════════════════════════════════
// RENDER TABS
// ═══════════════════════════════════════════
let sbMesesAberto = false; // controla expansão dos meses

function abrirSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
function toggleSidebarMini() {
  const sb = document.getElementById('sidebar');
  const mini = sb.classList.toggle('mini');
  const btn = document.getElementById('btn-sidebar-mini');
  if (btn) btn.textContent = mini ? '⊞' : '🏠';
  try { localStorage.setItem('zl_sb_mini', mini ? '1' : '0'); } catch(e) {}
}
(function(){
  try {
    if (localStorage.getItem('zl_sb_mini') === '1') {
      document.addEventListener('DOMContentLoaded', () => {
        const sb = document.getElementById('sidebar');
        if (sb) { sb.classList.add('mini'); const b = document.getElementById('btn-sidebar-mini'); if(b) b.textContent='⊞'; }
      });
    }
  } catch(e) {}
})();

function renderTabs() { renderSidebar(); }

function renderSidebar() {
  const sb = document.getElementById('sidebarBody');
  if (!sb) return;
  const mesAtual = new Date().getMonth();
  const anoAtual = document.getElementById('anoGlobal') ? document.getElementById('anoGlobal').value : '2025';

  // Badges
  const osAbertas = ordens.filter(o => o.status === 'aberta' || o.status === 'andamento').length;
  const estAlerta = typeof estoque !== 'undefined' ? estoque.filter(p => (parseFloat(p.qtd)||0) <= (parseFloat(p.minimo)||0) && (parseFloat(p.minimo)||0) > 0).length : 0;

  const badgeOS = osAbertas > 0 ? '<span class="sb-badge">' + osAbertas + '</span>' : '';
  const badgeEst = estAlerta > 0 ? '<span class="sb-badge" style="background:#f59e0b">' + estAlerta + '</span>' : '';

  let html = '';
  // ── BUSCA GLOBAL ──
  html += '<div class="sb-item sb-busca-btn" onclick="abrirBuscaGlobal()" title="Busca Global (Ctrl+K)">'
    + '<span class="sb-icon">🔍</span>'
    + '<span class="sb-label" style="display:flex;align-items:center;justify-content:space-between;width:100%">Busca Global <span style="font-size:.62rem;opacity:.5;font-family:monospace;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 5px">Ctrl+K</span></span>'
    + '</div>';
  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';
  // ── DASHBOARD ──
  html += '<div class="sb-item' + (abaAtiva===18?' ativo':'') + '" onclick="sbIr(18)">'
    + '<span class="sb-icon">🏠</span><span class="sb-label">Dashboard</span></div>';
  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';


  // ── MESES ──
  html += '<div class="sb-item" onclick="sbToggleMeses()">'
    + '<span class="sb-icon">📅</span>'
    + '<span class="sb-label">Meses <small style="font-size:.7rem;opacity:.6;font-weight:400">(' + anoAtual + ')</small></span>'
    + '<span class="sb-expand-btn' + (sbMesesAberto?' open':'') + '" id="sb-expand-meses" style="position:relative;z-index:10;color:white">▾</span>'
    + '</div>'
    + '<div class="sb-meses' + (sbMesesAberto?' open':'') + '" id="sb-meses-wrap">';

  MESES.forEach(function(mes, i) {
    const c = calcularMes(i);
    const isAtivo = abaAtiva === i;
    const isHoje = i === mesAtual;
    let cls = 'sb-mes-item';
    if (isAtivo) cls += ' ativo';
    if (isHoje) cls += ' hoje';
    html += '<div class="' + cls + '" onclick="sbIrMes(' + i + ')">'
      + '<span>' + mes + '</span>'
      + (isHoje ? '<span style="font-size:.62rem;color:var(--verde);opacity:.7">hoje</span>' : '')
      + (!c.vazio && c.totalLiquido < 0 ? '<span style="font-size:.62rem;color:#f87171">⚠</span>' : '')
      + '</div>';
  });
  html += '</div>';

  // ── ANUAL ──
  html += '<div class="sb-item' + (abaAtiva===12?' ativo':'') + '" onclick="sbIr(12)">'
    + '<span class="sb-icon">★</span><span class="sb-label">Resumo Anual</span></div>';

  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';

  // ── MÓDULOS ──
  html += '<div class="sb-section">MÓDULOS</div>';

  html += '<div class="sb-item' + (abaAtiva===13?' ativo':'') + '" onclick="sbIr(13)">'
    + '<span class="sb-icon">📋</span><span class="sb-label">Orçamentos</span></div>';

  html += '<div class="sb-item' + (abaAtiva===14?' ativo':'') + '" onclick="sbIr(14)">'
    + '<span class="sb-icon">📦</span><span class="sb-label">Estoque</span>' + badgeEst + '</div>';

  html += '<div class="sb-item' + (abaAtiva===15?' ativo':'') + '" onclick="sbIr(15)">'
    + '<span class="sb-icon">🔧</span><span class="sb-label">Ordens de Serviço</span>' + badgeOS + '</div>';

  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';

  html += '<div class="sb-item' + (abaAtiva===16?' ativo':'') + '" onclick="sbIr(16)">'
    + '<span class="sb-icon">⚙️</span><span class="sb-label">Configurações</span></div>';

  html += '<div class="sb-item' + (abaAtiva===17?' ativo':'') + '" onclick="sbIr(17)">'
    + '<span class="sb-icon">📅</span><span class="sb-label">Agendamentos</span></div>';


  html += '<div class="sb-item' + (abaAtiva===20?' ativo':'') + '" onclick="sbIr(20)">'
    + '<span class="sb-icon">👥</span><span class="sb-label">Clientes</span></div>';

  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';
  html += '<div class="sb-item' + (abaAtiva===21?' ativo':'') + '" onclick="sbIr(21)">'
    + '<span class="sb-icon">📑</span><span class="sb-label">Contador</span></div>';

  const mecBadgeTotal = mecRascunhosPendentes;
  const badgeMec = mecRascunhosPendentes > 0
    ? '<span class="sb-badge" style="background:var(--color-primary);color:#fff;border-radius:999px;padding:1px 7px;font-size:.6rem;font-weight:700;min-width:18px;text-align:center;margin-left:auto">' + mecRascunhosPendentes + '</span>'
    : '';
  html += '<div class="sb-item' + (abaAtiva===22?' ativo':'') + '" onclick="sbIr(22)">'
    + '<span class="sb-icon">🏍️</span><span class="sb-label">Fila de Motos</span></div>';

  html += '<div class="sb-item' + (abaAtiva===23?' ativo':'') + '" onclick="sbIr(23)" style="' + (mecRascunhosPendentes>0?'color:var(--color-primary)':'') + '">'
    + '<span class="sb-icon">🔧</span><span class="sb-label" style="display:flex;align-items:center;width:100%">Área do Mecânico' + badgeMec + '</span></div>';

  sb.innerHTML = html;
}

function sbToggleMeses() {
  sbMesesAberto = !sbMesesAberto;
  renderSidebar();
}

function sbIr(aba) {
  abaAtiva = aba;
  if (aba !== 13) orcModoFormulario = false;
  clienteDetalhe = null;
  filtroCategoria = 'Todos';
  renderAll();
  // fecha em mobile
  if (window.innerWidth <= 900) fecharSidebar();
}

function sbIrMes(i) {
  abaAtiva = i;
  filtroCategoria = 'Todos';
  renderAll();
  if (window.innerWidth <= 900) fecharSidebar();
}

// ═══════════════════════════════════════════
// RENDER MÊS
// ═══════════════════════════════════════════