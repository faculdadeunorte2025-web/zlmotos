// CONFIGURAÇÃO
// ═══════════════════════════════════════════
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const FIXOS_PADRAO = ['Água','Luz','Aluguel','Contador','Sistema de Vendas','Sistema de Alarme'];
let CATEGORIAS = ['Peça','Serviço','Imposto','Combustível','Funcionário','Outros'];
let metaMensal = 0; // C09
let contasPagar = [];         // C10

let dados = {};
let abaAtiva = 18;
let filtroCategoria = 'Todos';
let filtroFormaPgto = 'Todos';
let extratoPaginas = {}; // quantas páginas de datas mostrar por mês (7 datas por página)
const EXTRATO_PAGE = 7;  // dias por página

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
    }
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
      orcamentos, clientesCadastradosManuais, metaMensal,
      dados, // dados financeiros
      chave: chaveStorage(),
      uid: (window._auth && window._auth.currentUser) ? window._auth.currentUser.uid : '',
      cachedAt: new Date().toISOString()
    }));
  } catch(e) { console.warn('Cache local cheio:', e); }
}

function _carregarCacheLocal() {
  try {
    const raw = localStorage.getItem('zlmotos_cache');
    if (!raw) return false;
    const cache = JSON.parse(raw);
    if (!cache.cachedAt) return false;
    const age = (new Date()-new Date(cache.cachedAt)) / 3600000; // horas
    if (age > 24) return false; // cache de até 24h
    // CORREÇÃO: só usa a cópia se for do mesmo usuário e do mesmo ano
    const uid = (window._auth && window._auth.currentUser) ? window._auth.currentUser.uid : '';
    if (cache.uid && cache.uid !== uid) return false;
    if (cache.chave && cache.chave !== chaveStorage()) return false;
    orcamentos = cache.orcamentos || orcamentos;
    clientesCadastradosManuais = cache.clientesCadastradosManuais || clientesCadastradosManuais;
    metaMensal = cache.metaMensal || metaMensal;
    if (cache.dados) dados = cache.dados; // restaurar dados financeiros
    return true;
  } catch(e) { return false; }
}

// I12 — Backup manual ─────────────────────────────────────────────
async function _verificarBackupAuto() {
  try {
    const CHAVE = 'zlmotos_ultimo_backup_auto';
    const ultimo = localStorage.getItem(CHAVE);
    const agora = Date.now();
    const UM_DIA = 24 * 60 * 60 * 1000;
    if (ultimo && (agora - parseInt(ultimo)) < UM_DIA) return; // menos de 24h
    // Fazer backup automático
    const payload = {
      data: new Date().toISOString(),
      tipo: 'auto',
      dados: dados,
      versao: document.title
    };
    await window._firestoreSetDoc(
      window._userDoc('backup_auto_' + new Date().toISOString().slice(0,10)),
      payload
    );
    localStorage.setItem(CHAVE, agora.toString());
    console.log('ZLMotos: backup automático realizado em', payload.data);
  } catch(e) {
    console.warn('ZLMotos: erro no backup automático:', e);
  }
}

// Backup completo: baixa TUDO que está no Firebase, inclusive os dados das
// abas que saíram do sistema (OS, estoque, vendas, agendamentos...).
async function backupExportarJSON() {
  mostrarToast('Preparando backup...');
  const ano = new Date().getFullYear();
  const chaves = ['config_geral','empresa_config','categorias_mes','orcamentos_lista','contas_pagar',
    'os_lista','os_contador','estoque_global','ferramental_global','vendas_historico','est_entradas',
    'fornecedores','agendamentos_lista'];
  for (let a = ano - 6; a <= ano + 1; a++) chaves.push('zlmotos_' + a);
  const backup = { exportadoEm: new Date().toISOString(), versao: 'v6.0.0', documentos: {} };
  for (const k of chaves) {
    try { const s = await window._fsGet(window._userDoc(k)); if (s.exists()) backup.documentos[k] = s.data(); } catch(e) {}
  }
  try {
    const cs = await window._fsGetDocs(window._userCollection('clientes'));
    backup.clientes = cs.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { backup.clientes = clientesCadastradosManuais; }
  const blob = new Blob([JSON.stringify(backup, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url;
  el.download = 'ZLMotos_backup_' + new Date().toISOString().split('T')[0] + '.json';
  el.click();
  URL.revokeObjectURL(url);
  mostrarToast('Backup baixado');
}

// I05 — Relatório mensal PDF ──────────────────────────────────────
async function relatorioMensalPDF() {
  let jsPDF;
  try { jsPDF = (window.jspdf&&window.jspdf.jsPDF)||window.jsPDF||null; } catch(e){jsPDF=null;}
  if (!jsPDF) { mostrarToast('PDF não disponível'); return; }

  const mesAtual = new Date().getMonth();
  const anoAtual = parseInt(document.getElementById('anoGlobal').value) || new Date().getFullYear();
  const calc = calcularMes(mesAtual);
  const mes = dados[mesAtual] || { variaveis: [], fixos: [] };
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Saídas por categoria (inclui 2ª forma de pagamento)
  const porCat = {};
  (mes.variaveis||[]).forEach(v => { const c = v.cat || 'Outros'; porCat[c] = (porCat[c]||0) + num(v.valor) + num(v.valor2); });
  const totFixos = (mes.fixos||[]).reduce((s,f) => s + num(f.valor), 0);
  if (totFixos) porCat['Fixos'] = (porCat['Fixos']||0) + totFixos;
  const cats = Object.entries(porCat).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);

  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W = 210, M = 18;
  let y = 22;
  doc.setFontSize(18); doc.setTextColor(20,20,24); doc.setFont('helvetica','bold');
  doc.text('ZL MOTOS', M, y);
  doc.setFontSize(10); doc.setTextColor(110,110,120); doc.setFont('helvetica','normal');
  doc.text('Relatório Mensal — ' + MESES[mesAtual] + ' ' + anoAtual, M, y+7);
  doc.text(new Date().toLocaleDateString('pt-BR'), W-M, y+7, {align:'right'});
  y += 14;
  doc.setDrawColor(210,210,215); doc.setLineWidth(0.4); doc.line(M,y,W-M,y); y += 10;

  const blocos = [
    {label:'Entradas', val:fmt(calc.totalBruto)},
    {label:'Saídas', val:fmt(calc.totalSaidas)},
    {label:'Resultado', val:fmt(calc.totalLiquido)},
  ];
  const cw = (W-2*M-10)/3;
  blocos.forEach((b,i) => {
    const bx = M + i*(cw+5);
    doc.setDrawColor(210,210,215); doc.roundedRect(bx,y,cw,18,2,2,'S');
    doc.setFontSize(8); doc.setTextColor(110,110,120); doc.setFont('helvetica','normal'); doc.text(b.label, bx+4, y+6);
    doc.setFontSize(12); doc.setTextColor(20,20,24); doc.setFont('helvetica','bold'); doc.text(b.val, bx+4, y+14);
  });
  y += 30;

  doc.setFontSize(10); doc.setTextColor(20,20,24); doc.setFont('helvetica','bold');
  doc.text('Saídas por categoria', M, y); y += 7;
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,70);
  cats.forEach(([nome, val]) => {
    doc.text(nome, M, y); doc.text(fmt(val), W-M, y, {align:'right'}); y += 6;
  });
  if (!cats.length) { doc.text('Nenhuma saída no mês.', M, y); }

  doc.save('ZLMotos_Relatorio_' + MESES[mesAtual] + '_' + anoAtual + '.pdf');
  mostrarToast('Relatório gerado');
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
  const msg = `*Parabéns, ${cli.nome.split(' ')[0]}!*\n\nA equipe da *ZL MOTOS* deseja a você um feliz aniversário! \n\nQue seu dia seja incrível e que a estrada sempre seja generosa com você!\n\n_Com carinho, ZL MOTOS_`;
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
