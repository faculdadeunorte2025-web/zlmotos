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
let ordens = []; // Ordens de Serviço
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
  const eraAceito = orc.status === 'aceito';
  orc.status = status;
  if (orcAtual._id === id) orcAtual.status = status;
  // Dar baixa no estoque ao aceitar (só uma vez)
  if (status === 'aceito' && !eraAceito && orc.itens && orc.itens.length > 0) {
    await orcDarBaixaEstoque(orc.itens);
  }
  // CORREÇÃO: criar OS automaticamente ao aceitar orçamento (só uma vez)
  if (status === 'aceito' && !eraAceito) {
    const jaTemOS = ordens.find(o => o.orcId === orc.id);
    if (!jaTemOS) {
      await osCarregarContador();
      osContador++;
      const novaOS = {
        id: 'os_' + Date.now(),
        numero: osContador,
        orcId: orc.id,
        cliente: orc.cliente || '',
        telefone: orc.telefone || '',
        veiculo: orc.veiculo || '',
        placa: orc.placa || '',
        km: orc.km || '',
        itens: JSON.parse(JSON.stringify(orc.itens || [])),
        total: ((orc.calc && orc.calc.total) != null && orc.calc.total > 0)
          ? orc.calc.total
          : (orc.itens||[]).reduce((s,it) => s + (parseFloat(it.qtd)||0)*(parseFloat(it.vunit)||0), 0),
        status: 'aberta',
        mecanico: '',
        dataEntrada: new Date().toISOString().split('T')[0],
        previsaoEntrega: '',
        obsInternas: '',
        obsCliente: orc.obs || '',
        checklist: (orc.itens || []).map((it, i) => ({ id: i, desc: it.desc || '—', cat: it.cat || '', feito: false })),
        criadoEm: new Date().toISOString()
      };
      ordens.unshift(novaOS);
      await salvarOS();
      window._registrarLog('OS_CRIADA_AUTO', { numero: osNumeroFormatado(novaOS.numero), cliente: novaOS.cliente });
      mostrarToast('✓ Orçamento aceito! OS ' + osNumeroFormatado(novaOS.numero) + ' criada automaticamente.');
    }
  }
  const ref = window._userDoc('orcamentos_lista');
  window._firestoreSetDoc(ref, { lista: orcamentos, atualizadoEm: new Date().toISOString() });
  renderOrcamento();
}

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
  catBusca = '';
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
  if (vencido)                    return '<span class="badge badge-danger"><span class="badge-dot"></span>⛔ EXPIRADO</span>';
  if (orc.status === 'enviado')   return '<span class="badge badge-info"><span class="badge-dot"></span>📤 ENVIADO</span>';
  if (orc.status === 'reprovado') return '<span class="badge badge-danger"><span class="badge-dot static"></span>✕ REPROVADO</span>';
  return '<span class="badge badge-muted"><span class="badge-dot static"></span>⏳ PENDENTE</span>';
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
    txt += `📎 _PDF com orçamento completo: ${nomeArq}_\n`;
    txt += `_(Anexe o arquivo PDF baixado antes de enviar)_`;
    if (orcAtual.obs) txt += `\n━━━━━━━━━━━━━━━━━━━━━━━\n_${orcAtual.obs}_`;
    const url = 'https://wa.me/?text=' + encodeURIComponent(txt);
    window.open(url, '_blank');
  }, 800);
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
  doc.setFillColor(13,35,71); doc.roundedRect(120,y,76,calc.descValorNum>0?30:22,3,3,'F');
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
  doc.text('Subtotal:', 124, y+7); doc.setTextColor(96,165,250); doc.setFont('helvetica','bold');
  doc.text('R$ '+parseFloat(calc.totalItens||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}), 194, y+7, {align:'right'});
  let ty = y + 7;
  if (calc.descValorNum > 0) {
    ty += 8;
    doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184); doc.text('Desconto:', 124, ty);
    doc.setTextColor(167,139,250); doc.setFont('helvetica','bold'); doc.text('-R$ '+parseFloat(calc.descValorNum||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}), 194, ty, {align:'right'});
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
// CATÁLOGO DE PEÇAS
// ═══════════════════════════════════════════
// Catálogo carregado do Firebase (integrado ao estoque)
let catalogoPecas = [];

function catCarregarDoEstoque() {
  // Sincroniza catálogo com peças do estoque
  const pecasEstoque = estoque.map(p => ({
    nome: p.nome,
    cat: p.cat || 'Outros',
    preco: p.venda || ''
  }));
  // Mantém itens manuais do catálogo que não estão no estoque
  const nomesEstoque = pecasEstoque.map(p => p.nome.toLowerCase());
  const manuais = catalogoPecas.filter(p => p._manual && !nomesEstoque.includes(p.nome.toLowerCase()));
  catalogoPecas = [...pecasEstoque, ...manuais];
}

let catBusca = '';

function catSalvar() {
  // Catálogo agora é derivado do estoque — salvar apenas itens manuais (_manual)
  const manuais = catalogoPecas.filter(p => p._manual);
  localStorage.setItem('zlmotos_catalogo_manuais', JSON.stringify(manuais));
}

function catFiltradas() {
  if (!catBusca.trim()) return catalogoPecas;
  const b = catBusca.toLowerCase();
  return catalogoPecas.filter(p => p.nome.toLowerCase().includes(b) || p.cat.toLowerCase().includes(b));
}

function orcAddFromCatalog(idx) {
  const peca = catalogoPecas[idx];
  if (!peca) return;
  // Verificar estoque disponível
  const itemEstoque = estoque.find(p => p.nome.toLowerCase() === peca.nome.toLowerCase());
  if (itemEstoque !== undefined) {
    const qtdDisp = parseFloat(itemEstoque.qtd) || 0;
    if (qtdDisp <= 0) {
      mostrarErro('⛔ ' + peca.nome + ' está zerado no estoque!');
      return;
    }
  }
  orcAtual.itens.unshift({ desc: peca.nome, cat: 'Peça', qtd: '1', vunit: peca.preco || '', obs: '', _estoqueNome: peca.nome });
  renderOrcamento();
  mostrarToast('✓ ' + peca.nome + ' adicionada!');
  setTimeout(() => {
    const busca = document.getElementById('cat-busca');
    if (busca) { busca.value = catBusca; busca.focus(); }
  }, 50);
}

// Dá baixa no estoque quando orçamento é aceito
async function orcDarBaixaEstoque(itens) {
  let alterou = false;
  itens.forEach(it => {
    if (!it._estoqueNome && !it.desc) return;
    const nome = it._estoqueNome || it.desc;
    const idx = estoque.findIndex(p => p.nome.toLowerCase() === nome.toLowerCase());
    if (idx >= 0) {
      const qtdAtual = parseFloat(estoque[idx].qtd) || 0;
      const qtdUsar  = parseFloat(it.qtd) || 1;
      estoque[idx].qtd = Math.max(0, qtdAtual - qtdUsar);
      alterou = true;
    }
  });
  if (alterou) {
    await estSalvar();
    mostrarToast('✓ Estoque atualizado automaticamente');
  }
}

function renderCatalogo() {
  const lista = catFiltradas();
  const cats = [...new Set(catalogoPecas.map(p => p.cat))];

  if (lista.length === 0) {
    return `<div class="orc-catalogo-vazio">Nenhuma peça encontrada. Cadastre peças no Estoque para elas aparecerem aqui.</div>`;
  }

  function pecaItem(p, realIdx) {
    const itemEst = estoque.find(e => e.nome.toLowerCase() === p.nome.toLowerCase());
    const semEstoque = itemEst && (parseFloat(itemEst.qtd)||0) <= 0;
    const qtdDisp = itemEst ? (parseFloat(itemEst.qtd)||0) : null;
    const estBadge = semEstoque
      ? `<span style="background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.4);color:#fca5a5;font-size:.55rem;padding:1px 5px;border-radius:8px;white-space:nowrap">⛔ Zerado</span>`
      : qtdDisp !== null
        ? `<span style="background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:#34d399;font-size:.55rem;padding:1px 5px;border-radius:8px;white-space:nowrap">Qtd: ${qtdDisp}</span>`
        : '';
    const style = semEstoque ? 'opacity:.5;cursor:not-allowed' : '';
    return `<div class="orc-peca-item" onclick="orcAddFromCatalog(${realIdx})" style="${style}">
      <div style="flex:1;min-width:0">
        <div class="orc-peca-nome">${p.nome}</div>
        <div style="display:flex;gap:5px;align-items:center;margin-top:2px">
          ${p.preco ? `<span class="orc-peca-preco">R$ ${parseFloat(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>` : ''}
          ${estBadge}
        </div>
      </div>
      <div class="orc-peca-add-btn" style="${semEstoque?'opacity:.3':''}">+</div>
    </div>`;
  }

  if (catBusca.trim()) {
    return lista.map(p => pecaItem(p, catalogoPecas.indexOf(p))).join('');
  }

  return cats.map(cat => {
    const pecasCat = catalogoPecas.filter(p => p.cat === cat);
    if (!pecasCat.length) return '';
    return `<div class="orc-cat-group-label">📦 ${cat}</div>` +
      pecasCat.map(p => pecaItem(p, catalogoPecas.indexOf(p))).join('');
  }).join('');
}

function abrirModalNovaPeca() {
  const cats = [...new Set(catalogoPecas.map(p => p.cat))];
  const opts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  const ov = document.createElement('div');
  ov.className = 'cat-modal-overlay';
  ov.id = 'cat-modal-overlay';
  ov.innerHTML = `
    <div class="cat-modal">
      <div class="cat-modal-titulo">➕ Nova Peça no Catálogo</div>
      <div class="cat-modal-campo">
        <label>Nome da Peça *</label>
        <input type="text" id="cat-nome" placeholder="Ex: Pastilha de Freio XYZ..." autofocus/>
      </div>
      <div class="cat-modal-campo">
        <label>Categoria</label>
        <select id="cat-cat">
          ${opts}
          <option value="Outros">Outros</option>
          <option value="__nova__">+ Nova categoria...</option>
        </select>
      </div>
      <div class="cat-modal-campo" id="cat-nova-cat-wrap" style="display:none">
        <label>Nome da Nova Categoria</label>
        <input type="text" id="cat-nova-cat" placeholder="Ex: Carburação..."/>
      </div>
      <div class="cat-modal-campo">
        <label>Preço de Venda (opcional)</label>
        <input type="number" id="cat-preco" placeholder="R$ 0,00" min="0" step="0.01"/>
      </div>
      <div class="cat-modal-btns">
        <button class="btn-cat-cancel" onclick="document.getElementById('cat-modal-overlay').remove()">Cancelar</button>
        <button class="btn-cat-ok" onclick="salvarNovaPeca()">✓ Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('cat-cat').addEventListener('change', function() {
    document.getElementById('cat-nova-cat-wrap').style.display = this.value === '__nova__' ? 'block' : 'none';
  });
  document.getElementById('cat-nome').addEventListener('keydown', e => { if(e.key==='Enter') salvarNovaPeca(); });
}

function salvarNovaPeca(editIdx) {
  const nome = (document.getElementById('cat-nome').value || '').trim();
  if (!nome) { mostrarErro('Informe o nome da peça'); return; }
  let cat = document.getElementById('cat-cat').value;
  if (cat === '__nova__') {
    cat = (document.getElementById('cat-nova-cat').value || '').trim() || 'Outros';
  }
  const preco = document.getElementById('cat-preco').value || '';
  const novaPeca = { nome, cat, preco, _manual: true };
  if (editIdx !== undefined) {
    catalogoPecas[editIdx] = novaPeca;
    mostrarToast('✓ Peça atualizada!');
  } else {
    catalogoPecas.unshift(novaPeca);
    mostrarToast('✓ Peça adicionada ao catálogo!');
  }
  catSalvar();
  document.getElementById('cat-modal-overlay').remove();
  renderOrcamento();
}

function abrirGerenciarCatalogo() {
  const ov = document.createElement('div');
  ov.className = 'cat-modal-overlay';
  ov.id = 'cat-modal-overlay';
  
  const linhas = catalogoPecas.map((p, i) => `
    <tr>
      <td style="font-weight:600;color:var(--color-text-primary)">${p.nome}</td>
      <td><span class="cat-tag cat-peca" style="font-size:.6rem">${p.cat}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;color:#34d399">${p.preco ? 'R$ '+parseFloat(p.preco).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-del btn-sm" onclick="catExcluir(${i})">✕</button>
      </td>
    </tr>`).join('');

  ov.innerHTML = `
    <div class="cat-modal" style="width:560px;max-height:80vh;display:flex;flex-direction:column">
      <div class="cat-modal-titulo">📋 Gerenciar Catálogo</div>
      <div style="overflow-y:auto;flex:1;margin-bottom:14px">
        <table style="width:100%;font-size:.82rem">
          <thead><tr><th style="font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted);padding:6px 4px;text-align:left">Peça</th><th style="font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted);padding:6px 4px">Cat.</th><th style="font-size:.62rem;letter-spacing:2px;color:var(--color-text-muted);padding:6px 4px">Preço</th><th></th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
        ${catalogoPecas.length===0?'<div class="orc-catalogo-vazio">Catálogo vazio</div>':''}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-cat-cancel" style="flex:1" onclick="document.getElementById('cat-modal-overlay').remove();renderOrcamento()">Fechar</button>
        <button class="btn btn-add warning btn-sm" style="flex:1" onclick="document.getElementById('cat-modal-overlay').remove();abrirModalNovaPeca()">+ Nova Peça<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
      </div>
    </div>`;
  document.body.appendChild(ov);
}

function catExcluir(idx) {
  catalogoPecas.splice(idx, 1);
  catSalvar();
  document.getElementById('cat-modal-overlay').remove();
  abrirGerenciarCatalogo();
}

// ═══════════════════════════════════════════
// SELEÇÃO DE ORÇAMENTO PARA PDF
// ═══════════════════════════════════════════
let orcSelecionadoId = null;

function orcSelecionarLinha(id, event) {
  // Não selecionar se clicou em botão
  if (event && event.target.tagName === 'BUTTON') return;
  orcSelecionadoId = orcSelecionadoId === id ? null : id;
  orcAtualizarBotaoPDF();
}

function orcAtualizarBotaoPDF() {
  // Atualiza visual dos cards
  document.querySelectorAll('.orc-glass-card').forEach(function(card) {
    card.style.outline = '';
    card.style.boxShadow = '';
  });
  const hint = document.getElementById('orc-pdf-hint');
  const btnPdf = document.getElementById('btn-pdf-lista');
  if (orcSelecionadoId) {
    const card = document.querySelector('.orc-glass-card[data-orcid="' + orcSelecionadoId + '"]');
    if (card) {
      card.style.outline = '2px solid var(--color-primary)';
      card.style.boxShadow = '0 0 16px rgba(59,130,246,.4)';
    }
    if (hint) { hint.textContent = '✓ Orçamento selecionado — clique em Gerar PDF'; hint.className = 'orc-pdf-hint pronto'; }
    if (btnPdf) { btnPdf.style.opacity = '1'; btnPdf.style.cursor = 'pointer'; btnPdf.disabled = false; }
  } else {
    if (hint) { hint.textContent = '👆 Clique em um orçamento da lista para selecionar'; hint.className = 'orc-pdf-hint'; }
    if (btnPdf) { btnPdf.style.opacity = '.5'; btnPdf.style.cursor = 'not-allowed'; btnPdf.disabled = true; }
  }
}

function orcPDFSelecionado() {
  if (!orcSelecionadoId) { mostrarErro('Selecione um orçamento na lista antes de gerar o PDF'); return; }
  const orc = orcamentos.find(o => o.id === orcSelecionadoId);
  if (!orc) { mostrarErro('Orçamento não encontrado'); return; }
  // Gerar PDF passando os dados diretamente, sem trocar orcAtual
  orcPDFDireto(orc);
}

// ═══════════════════════════════════════════
// ── KANBAN DE ORÇAMENTOS ────────────────────────────────────────
function renderOrcamentosKanban() {
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const colunas = [
    { key: 'pendente',  keys: ['pendente',''],      icon: '⏳', titulo: 'Pendentes',           cor: '#fbbf24', bg: 'rgba(251,191,36,.06)',   borda: 'rgba(251,191,36,.25)' },
    { key: 'enviado',   keys: ['enviado'],           icon: '📤', titulo: 'Enviados',            cor: '#60a5fa', bg: 'rgba(96,165,250,.06)',   borda: 'rgba(96,165,250,.25)' },
    { key: 'aceito',    keys: ['aceito','aprovado'], icon: '✅', titulo: 'Autorizados',         cor: '#34d399', bg: 'rgba(52,211,153,.06)',   borda: 'rgba(52,211,153,.25)' },
    { key: 'parcial',   keys: ['__parcial__'],       icon: '💳', titulo: 'Pgto. Parcial',       cor: '#a78bfa', bg: 'rgba(167,139,250,.06)',  borda: 'rgba(167,139,250,.25)' },
    { key: 'pago',      keys: ['__pago__'],          icon: '🏁', titulo: 'Concluídos / Pagos',  cor: '#2BE08C', bg: 'rgba(43,224,140,.06)',   borda: 'rgba(43,224,140,.25)' },
    { key: 'reprovado', keys: ['reprovado'],          icon: '❌', titulo: 'Reprovados',          cor: '#f87171', bg: 'rgba(248,113,113,.06)',  borda: 'rgba(248,113,113,.25)' },
  ];

  const colunasHTML = colunas.map(col => {
    let itens;
    if (col.key === 'pago') {
      itens = orcamentos.filter(o => {
        const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
        const pago  = parseFloat(o.valorPago||0);
        return o.pago || (pago >= total * 0.999 && total > 0 && (o.status==='aceito'||o.status==='aprovado'));
      });
    } else if (col.key === 'parcial') {
      itens = orcamentos.filter(o => {
        const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
        const pago  = parseFloat(o.valorPago||0);
        return !o.pago && pago > 0 && pago < total * 0.999 && total > 0
          && (o.status==='aceito'||o.status==='aprovado');
      });
    } else if (col.key === 'aceito') {
      itens = orcamentos.filter(o => {
        const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
        const pago  = parseFloat(o.valorPago||0);
        const isPago    = o.pago || (pago >= total * 0.999 && total > 0);
        const isParcial = !isPago && pago > 0;
        return col.keys.includes(o.status||'') && !isPago && !isParcial;
      });
    } else {
      itens = orcamentos.filter(o => col.keys.includes(o.status||''));
    }

    const totalCol = itens.reduce((s,o) => s + parseFloat((o.calc&&o.calc.total)||o.total||0), 0);

    const cards = itens.length === 0
      ? '<div style="text-align:center;color:rgba(255,255,255,.2);font-size:.75rem;padding:20px 0">Nenhum</div>'
      : [...itens].sort((a,b)=>(b.criadoEm||b.data||'').localeCompare(a.criadoEm||a.data||'')).map(o => {
          const total = parseFloat((o.calc&&o.calc.total)||o.total||0);
          const pago  = parseFloat(o.valorPago||0);
          const isPago = o.pago || (pago >= total * 0.999 && total > 0);
          const isParcial = !isPago && pago > 0;
          const diasO = orcDiasDesde(o.criadoEm);
          const vencido = (o.status!=='aceito'&&o.status!=='aprovado') && diasO > 7;
          const dataFmt = o.data ? new Date(o.data+'T12:00:00').toLocaleDateString('pt-BR') : '—';
          const btnOS = (o.status==='aceito'||o.status==='aprovado')
            ? '<button onclick="event.stopPropagation();osConverterOrcamento(\'' + o.id + '\')" style="font-size:.68rem;padding:3px 8px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.4);color:#a78bfa;border-radius:6px;cursor:pointer">🔧 OS</button>' : '';
          const btnPagar = (o.status==='aceito'||o.status==='aprovado') && !isPago
            ? '<button onclick="event.stopPropagation();orcRegistrarPagamento(\'' + o.id + '\')" style="font-size:.68rem;padding:3px 8px;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.35);color:#34d399;border-radius:6px;cursor:pointer">💰 ' + (isParcial?'Completar':'Pagar') + '</button>' : '';
          const pagBadge = isPago ? '<span style="font-size:.6rem;color:#34d399;font-weight:700">✓ PAGO</span>'
            : isParcial ? '<span style="font-size:.6rem;color:#a78bfa;font-weight:700">⚡ ' + fmtN(pago) + ' pago</span>'
            : '';

          return '<div onclick="if(event.target.tagName!==\'BUTTON\'){orcCarregar(\'' + o.id + '\')}"'
            + ' style="background:rgba(255,255,255,.04);border:1px solid ' + (vencido?'rgba(252,165,165,.3)':col.borda) + ';border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:all .15s"'
            + ' onmouseover="this.style.background=\'rgba(255,255,255,.07)\'" onmouseout="this.style.background=\'rgba(255,255,255,.04)\'">'
            + '<div style="font-weight:700;font-size:.88rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (o.cliente||'—') + '</div>'
            + '<div style="font-size:.72rem;color:var(--color-text-muted);margin:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🏍️ ' + (o.veiculo||'—') + '</div>'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">'
            + '<span style="font-size:.85rem;font-weight:700;color:' + col.cor + '">' + fmtN(total) + '</span>'
            + '<span style="font-size:.65rem;color:var(--color-text-muted)">' + dataFmt + (vencido?' <span style="color:#fca5a5">⚠️</span>':'') + '</span>'
            + '</div>'
            + (pagBadge ? '<div style="margin-top:4px">' + pagBadge + '</div>' : '')
            + '<div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">'
            + '<button onclick="event.stopPropagation();orcCarregar(\'' + o.id + '\')" style="font-size:.68rem;padding:3px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--color-text-muted);border-radius:6px;cursor:pointer">✏️ Editar</button>'
            + btnOS + btnPagar
            + '<button onclick="event.stopPropagation();orcExcluirSalvo(\'' + o.id + '\')" style="font-size:.68rem;padding:3px 8px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);color:#f87171;border-radius:6px;cursor:pointer">✕</button>'
            + '</div>'
            + '</div>';
        }).join('');

    return '<div style="flex:1;min-width:200px;background:' + col.bg + ';border:1px solid ' + col.borda + ';border-radius:14px;padding:14px;display:flex;flex-direction:column">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid ' + col.borda + '">'
      + '<div style="font-size:.9rem;font-weight:700;color:' + col.cor + '">' + col.icon + ' ' + col.titulo + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">'
      + '<span style="font-size:.68rem;background:' + col.borda + ';color:' + col.cor + ';border-radius:999px;padding:1px 8px;font-weight:700">' + itens.length + '</span>'
      + (itens.length>0?'<span style="font-size:.6rem;color:var(--color-text-muted)">' + fmtN(totalCol) + '</span>':'')
      + '</div></div>'
      + '<div style="flex:1;overflow-y:auto;max-height:calc(100vh - 200px)">' + cards + '</div>'
      + '</div>';
  }).join('');

  return '<div style="display:flex;gap:12px;align-items:flex-start;overflow-x:auto;padding-bottom:8px">' + colunasHTML + '</div>';
}

function renderOrcamentosListaHTML() {
  const mesesNome = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const filtroHtml = '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px;align-items:center">'
    + '<span style="font-size:.68rem;color:var(--color-text-muted);letter-spacing:1px">MÊS:</span>'
    + '<button class="filtro-btn' + (orcFiltroMes===''?' ativo':'') + '" onclick="orcFiltroMes=\'\';renderOrcamento()" style="font-size:.65rem;padding:2px 8px">Todos</button>'
    + mesesNome.map(function(m,i) {
        var mv = String(i+1).padStart(2,'0');
        return '<button class="filtro-btn' + (orcFiltroMes===mv?' ativo':'') + '" onclick="orcFiltroMes=\'' + mv + '\';renderOrcamento()" style="font-size:.65rem;padding:2px 8px">' + m + '</button>';
      }).join('')
    + '</div>';

  const orcsFiltrados = orcFiltroMes
    ? orcamentos.filter(function(o) {
        var d = o.criadoEm || o.data || '';
        return d.slice(5,7) === orcFiltroMes;
      })
    : orcamentos;

  if (!orcamentos.length) return '';
  if (!orcsFiltrados.length) return filtroHtml + '<div class="orc-vazio">Nenhum orçamento encontrado para este mês.</div>';

  var fmtN = function(v){ return 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); };

  // Agrupa por data
  var gruposOrc = {};
  orcsFiltrados.forEach(function(o) {
    var d = (o.criadoEm || o.data || '').slice(0,10);
    if (!gruposOrc[d]) gruposOrc[d] = [];
    gruposOrc[d].push(o);
  });
  var datasOrc = Object.keys(gruposOrc).sort().reverse();

  var grupoHtml = datasOrc.map(function(d) {
    var itens = gruposOrc[d];
    var totalDia = itens.reduce(function(s,o){ return s + ((o.calc&&o.calc.total)||0); }, 0);
    var dLabel = d ? (function(){ try { return new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}); } catch(e){ return d; } })() : 'Sem data';

    var cardsHtml = itens.map(function(o) {
      var diasO = orcDiasDesde(o.criadoEm);
      var venc = o.status !== 'aceito' && diasO > 7;
      var statusClass = o.status === 'aceito' ? 'aceito'
        : (o.status === 'reprovado' ? 'reprovado'
        : (venc ? 'expirado'
        : (o.status === 'enviado' ? 'enviado' : '')));
      var dataFmt = o.data ? new Date(o.data+'T12:00:00').toLocaleDateString('pt-BR') : '—';
      var btnOS = o.status === 'aceito'
        ? '<button class="btn btn-sm" style="background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.4);color:#a78bfa" onclick="event.stopPropagation();osConverterOrcamento(\'' + o.id + '\')">🔧 OS</button>'
        : '';
      var vencBadge = (o.validade && o.validade < hojeISO() && (o.status||'pendente') !== 'aceito')
        ? '<span style="font-size:.62rem;color:#fca5a5">⚠️ Vencido</span>' : '';

      var totalOrc = parseFloat((o.calc&&o.calc.total)||o.total||0);
      var valorPago = parseFloat(o.valorPago||0);
      var isPago = o.pago || (valorPago >= totalOrc * 0.999 && totalOrc > 0);
      var isParcial = !isPago && valorPago > 0;
      var isAceitoNaoPago = (o.status==='aceito'||o.status==='aprovado') && !isPago;
      var inadimpClass = isAceitoNaoPago && isParcial ? ' orc-card-parcial' : isAceitoNaoPago ? ' orc-card-inadimp' : '';
      var btnPagar = (o.status==='aceito'||o.status==='aprovado') && !isPago ? '<button class="btn btn-sm" style="background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.35);color:#34d399" onclick="event.stopPropagation();orcRegistrarPagamento(\'' + o.id + '\')">💰 ' + (isParcial?'Completar':'Pagar') + '</button>' : '';
      var pagBadge = isPago ? '<span class="inadimp-badge pago">✓ PAGO</span>' : isParcial ? '<span class="inadimp-badge parcial">⚡ PARCIAL</span>' : isAceitoNaoPago ? '<span class="inadimp-badge total">💸 NÃO PAGO</span>' : '';
      var cardHtml = '<div class="orc-glass-card ' + statusClass + inadimpClass + '" data-orcid="' + o.id + '" onclick="if(event.target.tagName!==\'BUTTON\'){orcCarregar(\'' + o.id + '\')}">'
        + '<div class="orc-card-dots">'
        + '<div class="orc-card-dot r"></div>'
        + '<div class="orc-card-dot y"></div>'
        + '<div class="orc-card-dot g"></div>'
        + '</div>'
        + '<div class="orc-card-collapsed">'
        + '<div class="orc-card-cliente" title="' + (o.cliente||'') + '">' + (o.cliente||'—') + '</div>'
        + '<div class="orc-card-veiculo" title="' + (o.veiculo||'') + '">🏍️ ' + (o.veiculo||'—') + '</div>'
        + '<div class="orc-card-total">' + fmtN(totalOrc) + '</div>'
        + '</div>'
        + '<div class="orc-card-expanded">'
        + '<div class="orc-card-info-row">📅 <b>' + dataFmt + '</b> &nbsp;|&nbsp; ' + orcStatusBadge(o) + ' ' + vencBadge + ' ' + pagBadge + '</div>'
        + (o.telefone ? '<div class="orc-card-info-row">📞 ' + o.telefone + '</div>' : '')
        + '<div class="orc-card-btns">'
        + '<button class="btn btn-sm" style="color:var(--color-text-muted);border-color:rgba(255,255,255,.1)" onclick="event.stopPropagation();orcSetStatus(\'' + o.id + '\',\'pendente\')">⏳</button>'
        + '<button class="btn btn-sm" style="color:var(--color-text-muted);border-color:rgba(255,255,255,.1)" onclick="event.stopPropagation();orcSetStatus(\'' + o.id + '\',\'enviado\')">📤</button>'
        + '<button class="btn btn-sm" style="color:#6ee7b7;border-color:rgba(52,211,153,.3)" onclick="event.stopPropagation();orcSetStatus(\'' + o.id + '\',\'aceito\')">✓</button>'
        + '<button class="btn btn-sm btn-duplic" onclick="event.stopPropagation();orcCarregar(\'' + o.id + '\')">✏️ Editar</button>'
        + '<button class="btn btn-sm" onclick="event.stopPropagation();orcDuplicar(\'' + o.id + '\')" style="background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.3);color:#60a5fa;font-size:.68rem;padding:4px 8px">📋 Duplicar</button>'
        + btnOS
        + btnPagar
        + '<button class="btn btn-sm" style="color:#38bdf8;border-color:rgba(56,189,248,.3)" onclick="event.stopPropagation();orcGerarLinkAprovacao(\'' + o.id + '\')" title="Link aprovação">🔗</button>'
        + '<button class="btn btn-del btn-sm" onclick="event.stopPropagation();orcExcluirSalvo(\'' + o.id + '\')">✕</button>'
        + '</div>'
        + '</div>'
        + '</div>';
      return cardHtml;
    }).join('');

    return '<div style="margin-bottom:22px">'
      + '<div class="orc-grupo-data-label">📅 ' + dLabel + ' &nbsp;·&nbsp; ' + itens.length + ' orçamento(s) &nbsp;·&nbsp; <span style="color:#6ee7b7">' + fmtN(totalDia) + '</span></div>'
      + '<div class="orc-cards-grid">' + cardsHtml + '</div>'
      + '</div>';
  }).join('');

  return filtroHtml
    + '<div style="background:rgba(13,35,71,.6);border:1px solid var(--color-border);border-radius:12px;padding:16px 20px;margin-bottom:18px">'
    + '<div style="font-size:.95rem;letter-spacing:3px;color:var(--color-primary-hover);margin-bottom:14px;font-weight:700">📁 Orçamentos Salvos' + (orcFiltroMes ? ' — ' + mesesNome[parseInt(orcFiltroMes)-1] : '') + '</div>'
    + grupoHtml
    + '</div>';
}

// RENDER ORÇAMENTO
// ═══════════════════════════════════════════
function renderOrcamento() {
  const main = document.getElementById('mainContent');

  // MODO LISTA — tela principal de orçamentos
  if (!orcModoFormulario) {
    main.innerHTML = '<div class="toolbar">'
      + '<span style="font-family:var(--font-titulo);font-size:1.35rem;letter-spacing:3px;color:var(--verde)">📋 Orçamentos</span>'
      + '<div class="toolbar-right">'
      + '<button class="btn btn-sm" onclick="orcViewMode=\'kanban\';renderOrcamento()" style="background:' + (orcViewMode==='kanban'?'rgba(52,211,153,.2)':'rgba(255,255,255,.06)') + ';border-color:' + (orcViewMode==='kanban'?'rgba(52,211,153,.5)':'var(--color-border)') + ';color:' + (orcViewMode==='kanban'?'#34d399':'var(--color-text-muted)') + '">⬛ Kanban</button>'
      + '<button class="btn btn-sm" onclick="orcViewMode=\'lista\';renderOrcamento()" style="background:' + (orcViewMode==='lista'?'rgba(52,211,153,.2)':'rgba(255,255,255,.06)') + ';border-color:' + (orcViewMode==='lista'?'rgba(52,211,153,.5)':'var(--color-border)') + ';color:' + (orcViewMode==='lista'?'#34d399':'var(--color-text-muted)') + '">☰ Lista</button>'
      + '<button class="btn btn-add" onclick="orcNovoOrcamento()">+ Novo Orçamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>'
      + '</div></div>'
      + (orcViewMode === 'kanban' ? renderOrcamentosKanban() : renderOrcamentosListaHTML());
    return;
  }

  const calc = orcCalc();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  const itensRows = orcAtual.itens.map((it, i) => {
    const sub = (parseFloat(it.qtd)||0) * (parseFloat(it.vunit)||0);
    const isMO = it.cat === 'Mão de Obra';
    return `<tr style="${isMO?'background:rgba(245,158,11,.05);border-left:2px solid rgba(245,158,11,.3)':''}">
      <td data-label="Descrição"><input type="text" value="${(it.desc||'').replace(/"/g,'&quot;')}" placeholder="Ex: Pastilha de freio..." oninput="orcAtual.itens[${i}].desc=this.value"/></td>
      <td data-label="Cat.">
        <select style="max-width:120px;font-size:.75rem" onchange="orcAtual.itens[${i}].cat=this.value;renderOrcamento()">
          ${['Peça','Mão de Obra','Serviço','Outros'].map(c=>`<option value="${c}"${(it.cat||'Peça')===c?' selected':''}>${c}</option>`).join('')}
        </select>
      </td>
      <td class="col-qtd" data-label="Qtd"><input type="number" class="valor" value="${it.qtd||''}" placeholder="1" min="0.01" step="0.01" oninput="orcAtual.itens[${i}].qtd=this.value;orcAtualizarSubtotais()"/></td>
      <td class="col-vunit" data-label="V. Unit R$"><input type="number" class="valor" value="${it.vunit||''}" placeholder="0,00" min="0" step="0.01" oninput="orcAtual.itens[${i}].vunit=this.value;orcAtualizarSubtotais()"/></td>
      <td class="col-desc-orc" data-label="Obs"><input type="text" value="${(it.obs||'').replace(/"/g,'&quot;')}" placeholder="Obs..." oninput="orcAtual.itens[${i}].obs=this.value" style="font-size:.78rem;color:var(--color-text-muted)"/></td>
      <td class="col-subtot subtotal-cel" data-label="Subtotal" id="orc-sub-${i}">${fmtN(sub)}</td>
      <td class="td-del"><button class="btn btn-del" onclick="orcRemItem(${i})">✕</button></td>
    </tr>`;
  }).join('');

  const statusAtual = orcAtual.status || 'pendente';
  const diasCriado = orcDiasDesde(orcAtual._criadoEm);
  const vencido = orcAtual._criadoEm && statusAtual !== 'aceito' && diasCriado > 15;
  const validadeExpirada = orcAtual.validade && orcAtual.validade < hojeISO() && statusAtual !== 'aceito';

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter';font-size:1.35rem;letter-spacing:3px;color:var(--verde)">📋 ${orcAtual._id ? 'Editar Orçamento' : 'Novo Orçamento'}</span>
      <button class="btn-voltar" onclick="orcModoFormulario=false;renderOrcamento()" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#96daf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
      ${orcAtual._id ? orcStatusBadge(orcAtual) : ''}
      ${validadeExpirada ? '<span style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5;padding:2px 10px;border-radius:10px;font-size:.72rem">⛔ Validade expirada em ' + new Date(orcAtual.validade+'T12:00:00').toLocaleDateString('pt-BR') + '</span>' : (orcAtual.validade ? '<span style="background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.3);color:#34d399;padding:2px 10px;border-radius:10px;font-size:.72rem">✓ Válido até ' + new Date(orcAtual.validade+'T12:00:00').toLocaleDateString('pt-BR') + '</span>' : '')}
      <div class="toolbar-right">
        <span class="orc-pdf-hint" id="orc-pdf-hint">👆 Clique em um orçamento da lista para selecionar</span>
        <button class="btn btn-add verde" onclick="orcNovoOrcamento()">➕ Novo Orçamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
        <button class="btn btn-duplic" onclick="orcSalvar()">💾 Salvar</button>
        ${orcAtual._id ? `<button class="btn" style="background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.4);color:#a78bfa" onclick="orcAtribuirMecanico('${orcAtual._id}')">🔧 Atribuir Mecânico</button>` : ''}
        <button class="btn btn-pdf" onclick="${orcAtual._id ? 'orcPDFDireto(orcAtual)' : 'orcPDFSelecionado()'}" ${orcAtual._id ? '' : 'id="btn-pdf-lista" style="opacity:.5;cursor:not-allowed" disabled'}><span class="pdf-star pdf-star-1"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-2"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-3"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-4"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-5"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span><span class="pdf-star pdf-star-6"><svg viewBox="0 0 784.11 815.53" xmlns="http://www.w3.org/2000/svg"><path class="fil0" d="M392.05 0c-20.9,210.08 -184.06,378.41 -392.05,407.78 207.96,29.37 371.12,197.68 392.05,407.74 20.93,-210.06 184.09,-378.37 392.05,-407.74 -207.98,-29.38 -371.16,-197.69 -392.05,-407.78z"/></svg></span>🖨️ Gerar PDF</button>
        <button class="btn" style="background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:9px 18px;font-size:.88rem" onclick="orcWhatsApp()">📲 WhatsApp</button>
      </div>
    </div>

    <div class="orc-layout">
      <!-- COLUNA PRINCIPAL -->
      <div class="orc-main-col">

        <!-- INFO CLIENTE -->
        <div class="orc-header-info" style="grid-template-columns:1fr 1fr 1fr;gap:14px">
          <div class="orc-field" style="position:relative">
            <label>👤 Cliente</label>
            <input type="text" id="orc-cliente-input" value="${(orcAtual.cliente||'').replace(/"/g,'&quot;')}" placeholder="Nome do cliente..."
              oninput="orcAtual.cliente=this.value;orcClienteAutoComplete(this.value)"
              onblur="setTimeout(()=>{const d=document.getElementById('orc-cli-drop');if(d)d.remove();},200)"/>
            <div id="orc-cli-drop" style="display:none"></div>
          </div>
          <div class="orc-field">
            <label>📞 Telefone</label>
            <input type="text" value="${(orcAtual.telefone||'').replace(/"/g,'&quot;')}" placeholder="(11) 99999-9999..." oninput="orcAtual.telefone=this.value"/>
          </div>
          <div class="orc-field">
            <label>🏍️ Veículo / Modelo</label>
            <input type="text" value="${(orcAtual.veiculo||'').replace(/"/g,'&quot;')}" placeholder="Ex: Honda Titan 160 2022..." oninput="orcAtual.veiculo=this.value"/>
          </div>
          <div class="orc-field">
            <label>🔖 Placa</label>
            <input type="text" value="${(orcAtual.placa||'').replace(/"/g,'&quot;')}" placeholder="Ex: ABC-1234..." oninput="orcAtual.placa=this.value.toUpperCase();this.value=orcAtual.placa" style="text-transform:uppercase"/>
          </div>
          <div class="orc-field">
            <label>📏 KM Entrada</label>
            <input type="number" class="valor" value="${orcAtual.km||''}" placeholder="Ex: 12500" min="0" step="1" oninput="orcAtual.km=this.value"/>
          </div>
          <div class="orc-field">
            <label>📅 Data</label>
            <input type="date" value="${orcAtual.data||''}" oninput="orcAtual.data=this.value"/>
          </div>
          <div class="orc-field" style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,.06);padding-top:12px;margin-top:2px">
            <label>⏳ Válido até</label>
            <div style="display:flex;align-items:center;gap:10px">
              <input type="date" value="${orcAtual.validade||''}" oninput="orcAtual.validade=this.value" style="max-width:180px;${orcAtual.validade && orcAtual.validade < hojeISO() ? 'border-color:rgba(252,165,165,.5);color:#fca5a5' : ''}"/>
              ${orcAtual.validade && orcAtual.validade < hojeISO() ? '<span style="font-size:.7rem;color:#fca5a5">⚠️ Validade expirada</span>' : (orcAtual.validade ? '<span style="font-size:.7rem;color:#6ee7b7">✓ Válido</span>' : '<span style="font-size:.7rem;color:var(--color-text-muted)">Preenchido automaticamente ao criar</span>')}
            </div>
          </div>
        </div>

        <!-- CARDS TOTAIS -->
        <div class="orc-totais" style="grid-template-columns:repeat(3,1fr)">
          <div class="orc-card pecas">
            <div class="orc-card-label">⚙️ Subtotal Itens</div>
            <div class="orc-card-valor" id="orc-c-pecas">${fmtN(calc.totalItens)}</div>
          </div>
          <div class="orc-card desc">
            <div class="orc-card-label">🏷️ Desconto${calc.descFidelidadeNum > 0 ? ' + Fidelidade' : ''}</div>
            <div class="orc-card-valor" id="orc-c-desc">${fmtN(calc.descValorNum + calc.descFidelidadeNum)}</div>
          </div>
          <div class="orc-card total">
            <div class="orc-card-label">💰 Total Final</div>
            <div class="orc-card-valor" id="orc-c-total">${fmtN(calc.total)}</div>
          </div>
        </div>

        <!-- LISTA DE ITENS (peças + mão de obra juntos) -->
        <div class="orc-lista">
          <div class="orc-lista-header">
            <div class="orc-lista-titulo">🔩 Itens do Orçamento</div>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-add btn-sm warning" onclick="orcAddItem()">📦 + Nova Peça<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
              <button class="btn btn-add btn-sm" onclick="orcAddMaoDeObra()">🔧 + Mão de Obra<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
              <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:4px 10px">
                <span style="font-size:.72rem;color:var(--color-text-muted);white-space:nowrap">🏷️ Desc:</span>
                <select style="font-size:.72rem;padding:2px 4px;max-width:90px" onchange="orcAtual.descTipo=this.value;orcAtualizarTotais()">
                  <option value="percentual" ${orcAtual.descTipo==='percentual'?'selected':''}>%</option>
                  <option value="fixo" ${orcAtual.descTipo==='fixo'?'selected':''}>R$</option>
                </select>
                <input type="number" style="width:70px;font-size:.78rem;padding:3px 6px" value="${orcAtual.descValor||''}" placeholder="0" min="0" step="0.01" oninput="orcAtual.descValor=this.value;orcAtualizarTotais()"/>
                ${calc.descValorNum > 0 ? '<span style="font-size:.68rem;color:#a78bfa;white-space:nowrap">-' + fmtN(calc.descValorNum) + '</span>' : ''}
                ${calc.descFidelidadeNum > 0 ? '<span style="font-size:.68rem;color:#34d399;white-space:nowrap">🎁-' + fmtN(calc.descFidelidadeNum) + '</span>' : ''}
              </div>
            </div>
          </div>
          <div class="orc-lista-body">
            <table class="tabela-mobile">
              <thead><tr><th>Descrição</th><th>Cat.</th><th class="col-qtd">Qtd</th><th class="col-vunit">V. Unit R$</th><th class="col-desc-orc">Obs</th><th class="col-subtot">Subtotal</th><th></th></tr></thead>
              <tbody id="orc-tbody">${itensRows}</tbody>
              <tfoot><tr class="total-row"><td colspan="5" style="color:var(--color-text-muted);font-size:.72rem;letter-spacing:2px">SUBTOTAL</td><td colspan="2" id="orc-total-pecas" style="color:#6ee7b7;font-family:'JetBrains Mono',monospace;font-weight:700">${fmtN(calc.totalItens)}</td></tr></tfoot>
            </table>
            ${orcAtual.itens.length===0 ? '<div class="orc-vazio">👈 Clique em uma peça do catálogo, "+ Item" ou "+ Mão de Obra" para começar</div>' : ''}
          </div>
        </div>

        <!-- OBS -->
        <div class="obs-mes-wrap" style="margin-bottom:14px">
          <div class="obs-mes-label">📝 Observações do Orçamento</div>
          <textarea class="obs-textarea" placeholder="Observações adicionais..." oninput="orcAtual.obs=this.value">${orcAtual.obs||''}</textarea>
        </div>

        <!-- AUTORIZAÇÃO RODAGEM -->
        <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:center;gap:12px">
          <label class="neon-checkbox dourado" style="flex-shrink:0">
            <input type="checkbox" id="chk-rodagem" ${orcAtual.autorizaRodagem?'checked':''} onchange="orcAtual.autorizaRodagem=this.checked"/>
            <div class="neon-checkbox__frame">
              <div class="neon-checkbox__glow"></div>
              <div class="neon-checkbox__box"></div>
              <div class="neon-checkbox__borders"><span></span><span></span><span></span><span></span></div>
              <div class="neon-checkbox__check-container">
                <svg class="neon-checkbox__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="neon-checkbox__particles"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
              <div class="neon-checkbox__rings"><div class="ring"></div><div class="ring"></div><div class="ring"></div></div>
              <div class="neon-checkbox__sparks"><span></span><span></span><span></span><span></span></div>
            </div>
          </label>
          <label for="chk-rodagem" style="cursor:pointer;font-size:.85rem;color:var(--dourado);font-weight:600;letter-spacing:.5px">🏍️ Cliente autorizou teste de rodagem do veículo pelo mecânico</label>
        </div>

      </div><!-- /orc-main-col -->

      <!-- COLUNA CATÁLOGO -->
      <div class="orc-catalogo-col">
        <div class="orc-catalogo">
          <div class="orc-catalogo-header">
            <div class="orc-catalogo-titulo">🗂️ Catálogo de Peças</div>
            <div class="search-wrap"><div class="search-layer sl-dark"></div><div class="search-layer sl-white"></div><div class="search-layer sl-border"></div><div class="search-layer sl-glow"></div><span class="search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span><div class="search-pink"></div><input class="search-input" type="text" id="cat-busca" placeholder="Buscar peça..." value="${catBusca.replace(/"/g,'&quot;')}" oninput="catBusca=this.value;atualizarCatalogo()"/><div class="search-filter-btn"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg></div></div>
          </div>
          <div class="orc-catalogo-body" id="cat-lista">
            ${renderCatalogo()}
          </div>
          <div class="orc-catalogo-footer" style="display:flex;gap:6px">
            <button class="btn btn-add warning btn-sm" onclick="abrirModalNovaPeca()" style="flex:1">+ Nova Peça Manual<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
          </div>
        </div>

        

    </div><!-- /orc-catalogo-col -->

    </div><!-- /orc-layout -->
  `;
  // Restaurar estado do botão PDF após rerender do DOM
  setTimeout(() => orcAtualizarBotaoPDF(), 0);
}

function atualizarCatalogo() {
  const el = document.getElementById('cat-lista');
  if (el) el.innerHTML = renderCatalogo();
}

function orcAtualizarSubtotais() {
  const calc = orcCalc();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  orcAtual.itens.forEach((it, i) => {
    const sub = (parseFloat(it.qtd)||0) * (parseFloat(it.vunit)||0);
    const el = document.getElementById('orc-sub-'+i);
    if (el) el.textContent = fmtN(sub);
  });
  const tp = document.getElementById('orc-total-pecas');
  if (tp) tp.textContent = fmtN(calc.totalItens);
  orcAtualizarTotais();
}

function orcAtualizarTotais() {
  const calc = orcCalc();
  const fmtN = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const s = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  s('orc-c-pecas', fmtN(calc.totalItens));
  s('orc-c-desc', fmtN(calc.descValorNum));
  s('orc-c-total', fmtN(calc.total));
  s('orc-desc-preview', '= '+fmtN(calc.descValorNum));
  s('orc-total-pecas', fmtN(calc.totalItens));
}


// ═══════════════════════════════════════════
// ESTOQUE — salvo local
// ═══════════════════════════════════════════
const EST_CATS = ['Freio','Motor','Elétrica','Transmissão','Suspensão','Funilaria','Lubrificante','Outros'];
const EST_CAT_COLORS = {
  'Freio':'rgba(239,68,68,.18);color:#fca5a5;border-color:rgba(239,68,68,.4)',
  'Motor':'rgba(245,158,11,.15);color:var(--dourado);border-color:rgba(245,158,11,.35)',
  'Elétrica':'rgba(96,165,250,.18);color:var(--color-primary-hover);border-color:rgba(96,165,250,.4)',
  'Transmissão':'rgba(167,139,250,.15);color:#a78bfa;border-color:rgba(167,139,250,.35)',
  'Suspensão':'rgba(52,211,153,.15);color:#34d399;border-color:rgba(52,211,153,.35)',
  'Funilaria':'rgba(249,115,22,.15);color:#fb923c;border-color:rgba(249,115,22,.35)',
  'Lubrificante':'rgba(20,184,166,.15);color:#2dd4bf;border-color:rgba(20,184,166,.35)',
  'Outros':'rgba(148,163,184,.1);color:var(--color-text-muted);border-color:rgba(148,163,184,.25)'
};

let estoque = [];
let estFiltroCAT = 'Todos';
let estBusca = '';
let estMostrarApenasAlerta = false;