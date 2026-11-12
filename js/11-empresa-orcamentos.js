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

async function salvarEmpresa() {
  try {
    const ref = window._userDoc('empresa_config');
    await window._firestoreSetDoc(ref, { dados: empresa, checklistEntrega, atualizadoEm: new Date().toISOString() });
    mostrarToast('✓ Dados da empresa salvos!');
  } catch(e) { mostrarErro('Erro ao salvar dados da empresa'); }
}

async function carregarEmpresa() {
  try {
    const ref = window._userDoc('empresa_config');
    const snap = await window._firestoreGetDoc(ref);
    if (snap.exists() && snap.data().dados) {
      empresa = Object.assign(empresa, snap.data().dados);
    }
    if (snap.exists() && snap.data().checklistEntrega) {
      checklistEntrega = snap.data().checklistEntrega;
    }
  } catch(e) {}
}

let chartTipo = 'barras'; // 'barras' ou 'linha'
let vendaBusca = '';
let vendaItens = [];
let vendaCliente = { nome: '', tel: '', id: null };
let vendaClienteBusca = '';
let vendaDesconto = 0;
let vendaDescontoTipo = 'valor';
let vendaPagamento = 'dinheiro';
let vendaHistorico = [];
let vendaModoModal = null; // null | 'novo-cliente' | 'novo-item'

let orcAtual = {
  cliente: '', telefone: '', veiculo: '', data: hojeISO(),
  itens: [],
  descTipo: 'percentual', descValor: '',
  obs: '',
  autorizaRodagem: false
};

// Lista de orçamentos salvos
let orcamentos = [];
let _osUnsubscribe = null; // listener tempo real de OS
let osBuscaTermo = '';     // RF07 — busca global
let osFiltroUrgente = false; // RF08
let osFiltroAtrasadas = false; // RF08
let osFiltroStatus = '';   // RF08
let agendamentos = []; // Agendamentos de serviço
let orcFiltroMes = ''; // '' = todos, '01'..'12' = mês específico
let orcModoFormulario = false; // false = lista, true = formulário
let orcViewMode = 'kanban'; // 'kanban' | 'lista'

async function orcSalvar() {
  if (!orcAtual.cliente.trim()) { mostrarErro('Informe o nome do cliente para salvar'); return; }
  // Deep copy garante que itens são salvos corretamente
  const orc = {
    ...JSON.parse(JSON.stringify(orcAtual)),
    id: orcAtual._id || ('orc_' + Date.now()),
    criadoEm: orcAtual._criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    status: orcAtual.status || 'pendente',
    calc: orcCalc()
  };
  orcAtual._id = orc.id;
  orcAtual._criadoEm = orc.criadoEm;
  orcAtual.status = orc.status;
  const idx = orcamentos.findIndex(o => o.id === orc.id);
  if (idx >= 0) orcamentos[idx] = orc;
  else orcamentos.unshift(orc);
  try {
    const ref = window._userDoc('orcamentos_lista');
    await window._firestoreSetDoc(ref, { lista: orcamentos, atualizadoEm: new Date().toISOString() });
    mostrarToast('✓ Orçamento salvo!');
    orcModoFormulario = false;
  } catch(e) {
    mostrarErro('Erro ao salvar orçamento no Firebase');
  }
  renderOrcamento();
}

async function orcSetStatus(id, status) {
  const orc = orcamentos.find(o => o.id === id);
  if (!orc) return;
  orc.status = status;
  if (orcAtual._id === id) orcAtual.status = status;
  const ref = window._userDoc('orcamentos_lista');
  window._firestoreSetDoc(ref, { lista: orcamentos, atualizadoEm: new Date().toISOString() });
  renderOrcamento();
}

// Grava a lista de orçamentos no Firebase.
// CORREÇÃO: essa função era chamada (duplicar orçamento, aprovação pelo link)
// mas não existia — o orçamento duplicado/aprovado nunca era salvo.
async function orcSalvarLista() {
  try {
    await window._firestoreSetDoc(window._userDoc('orcamentos_lista'), { lista: orcamentos, atualizadoEm: new Date().toISOString() });
  } catch(e) { console.warn('Erro ao salvar orçamentos:', e); mostrarErro('Erro ao salvar orçamento — verifique a conexão'); }
}
const salvarOrcamentos = orcSalvarLista;

// M04 — Duplicar orçamento ────────────────────────────────────────
function orcDuplicar(id) {
  const orig = orcamentos.find(o => o.id === id);
  if (!orig) return;
  const novo = JSON.parse(JSON.stringify(orig));
  novo.id = 'orc_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
  novo.data = hojeISO();
  novo.status = 'pendente';
  novo.pago = false;
  novo.valorPago = 0;
  novo.criadoEm = new Date().toISOString();
  orcamentos.unshift(novo);
  orcSalvarLista();
  mostrarToast('✓ Orçamento duplicado!');
  orcCarregar(novo.id);
}

function orcCarregar(id) {
  const orc = orcamentos.find(o => o.id === id);
  if (!orc) return;
  // Deep copy para garantir que itens e todos campos são restaurados
  orcAtual = JSON.parse(JSON.stringify(orc));
  // CORREÇÃO: mapear _id e _criadoEm para evitar duplicação ao salvar
  orcAtual._id = orc.id;
  orcAtual._criadoEm = orc.criadoEm;
  // Garantir campos obrigatórios
  if (!orcAtual.itens) orcAtual.itens = [];
  if (!orcAtual.descTipo) orcAtual.descTipo = 'percentual';
  if (!orcAtual.descValor) orcAtual.descValor = '';
  if (!orcAtual.obs) orcAtual.obs = '';
  if (!orcAtual.telefone) orcAtual.telefone = '';
  if (orcAtual.autorizaRodagem === undefined) orcAtual.autorizaRodagem = false;
  orcModoFormulario = true;
  renderOrcamento();
  mostrarToast('✓ Orçamento carregado — ' + orcAtual.itens.length + ' item(s)');
}

function orcExcluirSalvo(id) {
  const orc = orcamentos.find(o => o.id === id);
  if (!orc) return;
  confirmarExclusao(orc.cliente, async () => {
    orcamentos = orcamentos.filter(o => o.id !== id);
    if (orcAtual._id === id) orcNovoOrcamento();
    try {
      const ref = window._userDoc('orcamentos_lista');
      await window._firestoreSetDoc(ref, { lista: orcamentos, atualizadoEm: new Date().toISOString() });
      mostrarToast('✓ Orçamento excluído');
    } catch(e) {}
    renderOrcamento();
  });
}

function orcDiasDesde(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (1000*60*60*24));
}

function orcStatusBadge(orc) {
  const dias = orcDiasDesde(orc.criadoEm);
  const vencido = orc.status !== 'aceito' && dias > 15;
  if (orc.status === 'aceito')    return '<span class="badge badge-success"><span class="badge-dot static"></span>✓ ACEITO</span>';
  if (vencido)                    return '<span class="badge badge-danger"><span class="badge-dot"></span>EXPIRADO</span>';
  if (orc.status === 'enviado')   return '<span class="badge badge-info"><span class="badge-dot"></span>ENVIADO</span>';
  if (orc.status === 'reprovado') return '<span class="badge badge-danger"><span class="badge-dot static"></span>✕ REPROVADO</span>';
  return '<span class="badge badge-muted"><span class="badge-dot static"></span>PENDENTE</span>';
}

function orcCalc() {
  const totalItens = orcAtual.itens.reduce((s, it) => s + (parseFloat(it.qtd)||0) * (parseFloat(it.vunit)||0), 0);
  const subtotal = totalItens;
  let descValorNum = 0;
  if (orcAtual.descTipo === 'percentual') {
    descValorNum = subtotal * ((parseFloat(orcAtual.descValor)||0) / 100);
  } else {
    descValorNum = parseFloat(orcAtual.descValor) || 0;
  }
  const descFidelidadeNum = parseFloat(orcAtual.descFidelidade) || 0;
  const total = Math.max(0, subtotal - descValorNum - descFidelidadeNum);
  return { totalItens, descValorNum, descFidelidadeNum, subtotal, total };
}

function orcAddItem() {
  orcAtual.itens.unshift({ desc: '', cat: 'Peça', qtd: '1', vunit: '', obs: '' });
  renderOrcamento();
  setTimeout(() => {
    const rows = document.querySelectorAll('#orc-tbody tr');
    if (rows.length) {
      const inp = rows[0].querySelector('input[type="text"]');
      if (inp) inp.focus();
    }
  }, 50);
}

function orcAddMaoDeObra() {
  orcAtual.itens.unshift({ desc: 'Mão de Obra', cat: 'Mão de Obra', qtd: '1', vunit: '', obs: '' });
  renderOrcamento();
  setTimeout(() => {
    const rows = document.querySelectorAll('#orc-tbody tr');
    if (rows.length) {
      const last = rows[rows.length - 1];
      const inp = last.querySelector('input[type="number"].valor');
      if (inp) { inp.focus(); inp.select(); }
    }
  }, 50);
}

function orcRemItem(i) {
  orcAtual.itens.splice(i, 1);
  renderOrcamento();
}

function orcNovoOrcamento(dadosCliente) {
  const hoje = new Date();
  const validade = new Date(hoje); validade.setDate(validade.getDate() + 7);
  const validadeISO = validade.toISOString().split('T')[0];
  orcAtual = {
    cliente:  dadosCliente?.nome      || '',
    telefone: dadosCliente?.telefone  || '',
    veiculo:  dadosCliente?.veiculo   || '',
    placa:    dadosCliente?.placa     || '',
    data: hojeISO(),
    validade: validadeISO,
    itens: [], descTipo:'percentual', descValor:'', descFidelidade:'', obs:'', autorizaRodagem: false
  };
  orcModoFormulario = true;
  renderOrcamento();
}

function orcWhatsApp() {
  if (!orcAtual.cliente.trim()) { mostrarErro('Informe o nome do cliente'); return; }
  // Tenta gerar PDF, mas não bloqueia o WhatsApp se falhar
  try { orcPDF(); } catch(e) { console.warn('PDF error:', e); }
  // Abre WhatsApp independentemente
  setTimeout(() => {
    const calc = orcCalc();
    const fmtNum = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const nomeArq = `ZL_MOTOS_Orc_${(orcAtual.cliente||'cliente').replace(/\s+/g,'_')}.pdf`;
    let txt = `*ZL MOTOS — Orçamento*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `*Cliente:* ${orcAtual.cliente}\n`;
    if (orcAtual.telefone) txt += `*Telefone:* ${orcAtual.telefone}\n`;
    if (orcAtual.veiculo) txt += `*Veículo:* ${orcAtual.veiculo}\n`;
    if (orcAtual.placa) txt += `*Placa:* ${orcAtual.placa}\n`;
    if (orcAtual.km) txt += `*KM Entrada:* ${orcAtual.km}\n`;
    txt += `*Data:* ${orcAtual.data ? new Date(orcAtual.data+'T12:00:00').toLocaleDateString('pt-BR') : '—'}\n`;
    txt += `*Validade:* 7 dias\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `*PEÇAS / SERVIÇOS*\n`;
    orcAtual.itens.forEach((it, i) => {
      const sub = (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
      txt += `${i+1}. ${it.desc||'—'} — ${it.qtd||1}x ${fmtNum(it.vunit)} = *${fmtNum(sub)}*\n`;
      if (it.obs) txt += `   _${it.obs}_\n`;
    });
    txt += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (calc.descValorNum > 0) txt += `*Desconto:* -${fmtNum(calc.descValorNum)}\n`;
    txt += `*TOTAL FINAL: ${fmtNum(calc.total)}*\n`;
    txt += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    txt += `_PDF com orçamento completo: ${nomeArq}_\n`;
    txt += `_(Anexe o arquivo PDF baixado antes de enviar)_`;
    if (orcAtual.obs) txt += `\n━━━━━━━━━━━━━━━━━━━━━━━\n_${orcAtual.obs}_`;
    const telLimpo = (orcAtual.telefone||'').replace(/\D/g,'');
    const url = telLimpo
      ? 'https://wa.me/55' + telLimpo + '?text=' + encodeURIComponent(txt)
      : 'https://wa.me/?text=' + encodeURIComponent(txt);
    window.open(url, '_blank');
  }, 800);
}

// Enviar WhatsApp de orçamento a partir da lista (sem abrir modal)
function orcWhatsAppDireto(orc) {
  if (!orc) return;
  const calc = orcCalcDados(orc);
  const fmtNum = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const telLimpo = (orc.telefone||'').replace(/\D/g,'');
  let txt = `*ZL MOTOS — Orçamento*\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `*Cliente:* ${orc.cliente||'—'}\n`;
  if (orc.veiculo) txt += `*Veículo:* ${orc.veiculo}\n`;
  if (orc.placa)   txt += `*Placa:* ${orc.placa}\n`;
  txt += `*Data:* ${orc.data ? new Date(orc.data+'T12:00:00').toLocaleDateString('pt-BR') : '—'}\n`;
  txt += `*Validade:* 7 dias\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  (orc.itens||[]).forEach((it,i) => {
    const sub = (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
    txt += `${i+1}. ${it.desc||'—'} — ${it.qtd||1}x ${fmtNum(it.vunit)} = *${fmtNum(sub)}*\n`;
  });
  txt += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  txt += `*TOTAL: ${fmtNum(calc.total||0)}*\n`;
  txt += `*(PDF disponível ao solicitar)*`;
  const url = telLimpo
    ? 'https://wa.me/55' + telLimpo + '?text=' + encodeURIComponent(txt)
    : 'https://wa.me/?text=' + encodeURIComponent(txt);
  window.open(url, '_blank');
}

// Calcular total de um orçamento sem alterar orcAtual
// CORREÇÃO: usava campos que não existem (desconto/tipoDesc) e ignorava o
// desconto real do orçamento (descTipo/descValor/descFidelidade).
function orcCalcDados(orc) {
  if (!orc || !orc.itens) return { total: 0 };
  const sub = orc.itens.reduce((s,it) => s + (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0), 0);
  const descV = orc.descTipo === 'percentual'
    ? sub * ((parseFloat(orc.descValor)||0) / 100)
    : (parseFloat(orc.descValor) || parseFloat(orc.desconto) || 0);
  const descF = parseFloat(orc.descFidelidade) || 0;
  return { subtotal: sub, total: Math.max(0, sub - descV - descF) };
}

function orcPDFDireto(dados) {
  // Gerar PDF diretamente dos dados passados, sem alterar orcAtual
  const _backup = orcAtual;
  orcAtual = Object.assign({}, dados, { _id: dados.id, _criadoEm: dados.criadoEm });
  orcPDF();
  setTimeout(() => { orcAtual = _backup; }, 500);
}

function orcPDF() {
  if (!orcAtual || !orcAtual.cliente || !orcAtual.cliente.trim()) { mostrarErro('Informe o nome do cliente'); return; }
  // Localizar jsPDF de forma robusta a cada chamada
  let jsPDF;
  try {
    jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF
          : (typeof jspdf !== 'undefined' && jspdf.jsPDF) ? jspdf.jsPDF
          : window.jsPDF || null;
  } catch(e) { jsPDF = null; }
  if (!jsPDF) { mostrarErro('Erro: jsPDF não carregado. Verifique sua conexão.'); return; }
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210; let y = 20;
  const calc = orcCalc();
  const fmtNum = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dataOrc = orcAtual.data ? new Date(orcAtual.data+'T12:00:00') : new Date();
  const dataVenc = new Date(dataOrc.getTime() + 15*24*60*60*1000);
  const fmtData = d => d.toLocaleDateString('pt-BR');

  // Header com dados da empresa
  doc.setFillColor(10,22,40);
  doc.rect(0,0,W,36,'F');
  doc.setTextColor(96,165,250); doc.setFontSize(20); doc.setFont('helvetica','bold');
  doc.text((empresa.nomeFantasia||empresa.razaoSocial||'ZL MOTOS').toUpperCase(),W/2,12,{align:'center'});
  doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
  const endEmp = [empresa.endereco, empresa.bairro, empresa.cidade&&empresa.estado?empresa.cidade+' — '+empresa.estado:''].filter(Boolean).join(' | ');
  const contEmp = [empresa.telefone, empresa.cnpj?'CNPJ: '+empresa.cnpj:''].filter(Boolean).join(' | ');
  doc.text(endEmp, W/2, 19, {align:'center', maxWidth:180});
  doc.text(contEmp, W/2, 24, {align:'center', maxWidth:180});
  doc.setFontSize(8); doc.setTextColor(96,165,250);
  doc.text('ORÇAMENTO DE SERVIÇOS',W/2,31,{align:'center'});
  doc.setFontSize(7); doc.setTextColor(148,163,184);
  doc.text(`Data: ${fmtData(dataOrc)}   |   Validade: ${fmtData(dataVenc)}`,W/2,36,{align:'center'});
  y = 46;

  // Info cliente
  doc.setFillColor(13,35,71); doc.roundedRect(14,y,55,20,3,3,'F');
  doc.roundedRect(75,y,65,20,3,3,'F');
  doc.roundedRect(146,y,50,20,3,3,'F');
  doc.setFontSize(7); doc.setTextColor(148,163,184);
  doc.text('CLIENTE', 20, y+6); doc.text('VEÍCULO / MODELO', 81, y+6); doc.text('TELEFONE', 152, y+6);
  doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(240,246,255);
  doc.text(orcAtual.cliente||'—', 20, y+15, {maxWidth:44});
  doc.text(orcAtual.veiculo||'—', 81, y+15, {maxWidth:54});
  doc.text(orcAtual.telefone||'—', 152, y+15, {maxWidth:40});
  y += 30;

  // Placa / KM
  doc.setFillColor(13,35,71); doc.roundedRect(14,y,90,14,2,2,'F');
  doc.roundedRect(110,y,86,14,2,2,'F');
  doc.setFontSize(6.5); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
  doc.text('PLACA', 20, y+5); doc.text('KM ENTRADA', 116, y+5);
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(240,246,255);
  doc.text(orcAtual.placa||'—', 20, y+11, {maxWidth:80});
  doc.text(orcAtual.km ? String(orcAtual.km)+' km' : '—', 116, y+11, {maxWidth:76});
  y += 22;

  // Tabela itens — separar peças de mão de obra
  doc.setFillColor(26,58,107); doc.rect(14,y,182,8,'F');
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('DESCRIÇÃO', 16, y+5.5);
  doc.text('CAT.', 100, y+5.5);
  doc.text('QTD', 122, y+5.5, {align:'right'});
  doc.text('V. UNIT.', 155, y+5.5, {align:'right'});
  doc.text('SUBTOTAL', 196, y+5.5, {align:'right'});
  y += 11;

  doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  orcAtual.itens.forEach((it, i) => {
    if (y > 220) { doc.addPage(); y = 20; }
    const sub = (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0);
    doc.setTextColor(i%2===0?200:180, i%2===0?220:200, i%2===0?255:240);
    if (i%2===0) { doc.setFillColor(13,35,71); doc.rect(14,y-3,182,7,'F'); }
    else { doc.setFillColor(24,48,90); doc.rect(14,y-3,182,7,'F'); }
    doc.text(it.desc||'—', 16, y+1, {maxWidth:80});
    doc.setFontSize(7); doc.setTextColor(148,163,184);
    doc.text(it.cat||'', 100, y+1);
    doc.setFontSize(8.5); doc.setTextColor(i%2===0?200:180, i%2===0?220:200, i%2===0?255:240);
    doc.text(String(it.qtd||1), 122, y+1, {align:'right'});
    doc.text('R$ '+parseFloat(it.vunit||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}), 155, y+1, {align:'right'});
    doc.setTextColor(134,239,172);
    doc.text('R$ '+sub.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}), 196, y+1, {align:'right'});
    if (it.obs) {
      y += 6;
      doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','italic');
      doc.text('  ' + it.obs, 16, y+1, {maxWidth:180});
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    }
    y += 8;
    doc.setDrawColor(20,40,80); doc.line(14,y-2,196,y-2);
  });

  // Totais
  y += 4;
  doc.setFillColor(13,35,71); doc.roundedRect(120,y,76,22,3,3,'F');
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
  let ty = y + 7;
  if (calc.descValorNum > 0) {
    // Desconto já aplicado no valor dos itens/total — não exibir ao cliente
  } else {
    doc.text('Subtotal:', 124, ty); doc.setTextColor(96,165,250); doc.setFont('helvetica','bold');
    doc.text('R$ '+parseFloat(calc.totalItens||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}), 194, ty, {align:'right'});
  }
  ty += 10;
  doc.setFillColor(16,58,40); doc.roundedRect(120,ty-5,76,12,2,2,'F');
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(52,211,153);
  doc.text('TOTAL:', 124, ty+3);
  doc.text('R$ '+parseFloat(calc.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}), 194, ty+3, {align:'right'});
  y = ty + 16;

  if (orcAtual.obs) {
    if (y>240){doc.addPage();y=20;}
    doc.setFontSize(8); doc.setFont('helvetica','italic'); doc.setTextColor(148,163,184);
    doc.text('Obs: '+orcAtual.obs, 14, y, {maxWidth:182});
    y += 12;
  }

  // RODAPÉ JURÍDICO
  if (y > 210) { doc.addPage(); y = 20; }
  doc.setDrawColor(40,70,120); doc.line(14, y, 196, y);
  y += 6;
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(148,163,184);
  doc.text('OBSERVAÇÕES IMPORTANTES:', 14, y);
  y += 6;
  doc.setFont('helvetica','normal'); doc.setFontSize(6.8); doc.setTextColor(120,140,170);

  const termos = [
    '• O presente orçamento possui validade de 7 (sete) dias corridos. Após esse período, os valores poderão ser alterados em razão de reajustes de peças, insumos e serviços praticados pelos fornecedores.',
    '• A aprovação deste orçamento implica a concordância do cliente com os valores e condições aqui apresentados.',
    '• O cliente autoriza a realização de testes de funcionamento e rodagem do veículo pelo mecânico responsável, em percurso compatível com a verificação dos serviços executados.',
    '• Após a conclusão dos serviços e comunicação ao cliente, o veículo deverá ser retirado no prazo máximo de 15 (quinze) dias corridos.',
    '• Caso o veículo não seja retirado dentro do prazo e não haja acordo prévio com a oficina, será cobrada taxa de estadia no valor de R$ 10,00 (dez reais) por dia, referente à utilização do espaço para guarda do veículo.',
  ];
  termos.forEach(t => {
    if (y > 270) { doc.addPage(); y = 20; }
    const lines = doc.splitTextToSize(t, 182);
    doc.text(lines, 14, y);
    y += lines.length * 4.5 + 1;
  });

  // Assinatura e checkbox rodagem
  y += 4;
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(7); doc.setTextColor(148,163,184);
  doc.text('Declaro estar ciente e de acordo com os termos acima.', 14, y);
  y += 8;

  // Checkbox autorização rodagem
  const checked = orcAtual.autorizaRodagem;
  doc.setDrawColor(96,165,250); doc.setLineWidth(0.5);
  doc.rect(14, y-4, 5, 5);
  if (checked) {
    doc.setTextColor(52,211,153); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('✓', 14.8, y);
  }
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(148,163,184);
  doc.text('Autorizo o teste de rodagem do veículo pelo mecânico responsável.', 21, y);
  y += 10;

  // Linha de assinatura
  doc.setLineWidth(0.3); doc.setDrawColor(60,90,120);
  doc.line(14, y, 95, y);
  doc.line(115, y, 196, y);
  doc.setFontSize(6.5); doc.setTextColor(100,120,150);
  doc.text('Assinatura do Cliente', 14, y+5);
  doc.text('Assinatura do Responsável', 115, y+5);

  doc.setFontSize(7); doc.setTextColor(60,90,130); doc.setFont('helvetica','normal');
  doc.text((empresa.nomeFantasia||'ZL MOTOS') + ' — Orçamento gerado em ' + new Date().toLocaleDateString('pt-BR'), W/2, 297, {align:'center'});

  const nomeArq = `ZL_MOTOS_Orc_${(orcAtual.cliente||'cliente').replace(/\s+/g,'_')}.pdf`;
  // Sempre usar blob para garantir download confiável em múltiplas chamadas
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArq;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch(e) {
    try { doc.save(nomeArq); } catch(e2) { mostrarErro('Erro ao gerar PDF. Tente novamente.'); }
  }
}

// ═══════════════════════════════════════════
