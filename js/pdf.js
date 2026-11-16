// PDFs: orçamento para o cliente e relatório mensal. Layout branco, sóbrio.
import { S, calcMes, totalOrcamento } from './dados.js';
import { MESES, num, moeda, dataBR, somaDias, erro, aviso } from './util.js';
import { linhaCartao, linhaPix, noCartao, cartaoOrc } from './cartao.js';

const W = 210, M = 16;
const TEXTO = [24, 24, 27], CINZA = [113, 113, 122], LINHA = [222, 222, 226], FUNDO = [246, 246, 248], MARCA = [200, 16, 46];

function novoDoc() {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) { erro('Gerador de PDF ainda não carregou. Verifique a internet e tente de novo.'); return null; }
  return new J({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}
const cor = (d, c) => d.setTextColor(...c);
function baixar(doc, nome) {
  const url = URL.createObjectURL(doc.output('blob'));
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const nomeArquivo = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');

function cabecalho(doc, titulo, direita) {
  const e = S.empresa || {};
  doc.setFillColor(...MARCA); doc.rect(0, 0, W, 2.5, 'F');
  let y = 16;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); cor(doc, TEXTO);
  doc.text((e.nomeFantasia || e.razaoSocial || 'ZL Motos').toUpperCase(), M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); cor(doc, CINZA);
  const l1 = [e.endereco, e.bairro, [e.cidade, e.estado].filter(Boolean).join(' - '), e.cep].filter(Boolean).join(', ');
  const l2 = [e.telefone, e.email, e.cnpj ? 'CNPJ ' + e.cnpj : ''].filter(Boolean).join('  ·  ');
  if (l1) doc.text(l1, M, y + 5.5, { maxWidth: 120 });
  if (l2) doc.text(l2, M, y + 9.5, { maxWidth: 120 });
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); cor(doc, TEXTO);
  doc.text(titulo, W - M, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); cor(doc, CINZA);
  direita.forEach((t, i) => doc.text(t, W - M, y + 5.5 + i * 4.2, { align: 'right' }));
  y += 16;
  doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, y, W - M, y);
  return y + 8;
}
function rodapePaginas(doc, texto) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); cor(doc, CINZA);
    doc.text(texto, M, 289); doc.text(`Página ${i} de ${n}`, W - M, 289, { align: 'right' });
  }
}

// opcoes.compartilhar: no celular abre o menu de compartilhar (WhatsApp etc.) com o PDF anexado.
export function orcamentoPDF(o, opcoes = {}) {
  if (!o || !String(o.cliente || '').trim()) return erro('Informe o nome do cliente antes de gerar o PDF.');
  const doc = novoDoc(); if (!doc) return;
  const t = totalOrcamento(o);
  const data = o.data || String(o.criadoEm || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const validade = o.validade || somaDias(7, new Date(data + 'T12:00:00'));
  let y = cabecalho(doc, 'ORÇAMENTO', [`Data: ${dataBR(data)}`, `Válido até: ${dataBR(validade)}`]);

  // Cliente e veículo
  const campos = [['Cliente', o.cliente], ['Telefone', o.telefone], ['Veículo', o.veiculo], ['Placa', o.placa], ['KM', o.km ? o.km + ' km' : '']];
  doc.setFillColor(...FUNDO); doc.roundedRect(M, y, W - 2 * M, 20, 1.5, 1.5, 'F');
  const larg = [52, 34, 44, 24, 24]; let x = M + 4;
  campos.forEach(([r, v], i) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); cor(doc, CINZA); doc.text(r.toUpperCase(), x, y + 7);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); cor(doc, TEXTO); doc.text(String(v || '—'), x, y + 13.5, { maxWidth: larg[i] - 3 });
    x += larg[i];
  });
  y += 28;

  // Itens
  const col = { desc: M + 2, cat: 112, qtd: 140, un: 166, tot: W - M - 2 };
  const cabItens = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); cor(doc, CINZA);
    doc.text('DESCRIÇÃO', col.desc, y); doc.text('TIPO', col.cat, y);
    doc.text('QTD', col.qtd, y, { align: 'right' }); doc.text('VALOR UNIT.', col.un, y, { align: 'right' }); doc.text('TOTAL', col.tot, y, { align: 'right' });
    y += 2.5; doc.setDrawColor(...TEXTO); doc.setLineWidth(0.4); doc.line(M, y, W - M, y); y += 5.5;
  };
  cabItens();
  (o.itens || []).filter(i => String(i.desc || '').trim() || num(i.vunit)).forEach(it => {
    const linhas = doc.splitTextToSize(String(it.desc || '—'), 92);
    const alt = linhas.length * 4.2 + 2.8;
    if (y + alt > 262) { doc.addPage(); y = 20; cabItens(); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); cor(doc, TEXTO);
    doc.text(linhas, col.desc, y);
    doc.setFontSize(7.8); cor(doc, CINZA); doc.text(String(it.cat || ''), col.cat, y);
    doc.setFontSize(8.8); cor(doc, TEXTO);
    doc.text(String(num(it.qtd) || 1).replace('.', ','), col.qtd, y, { align: 'right' });
    const qq = num(it.qtd) || 1, cTot = noCartao(qq * num(it.vunit), t.total);
    doc.text(moeda(cTot / qq), col.un, y, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.text(moeda(cTot), col.tot, y, { align: 'right' });
    y += alt - 3.5; doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 5;
  });

  // Totais (como antes: com desconto, o cliente vê só o total final)
  if (y > 240) { doc.addPage(); y = 20; }
  y += 2;
  const cc = cartaoOrc(o, t);
  const pecas = (o.itens || []).filter(i => /pe[cç]a/i.test(i.cat || '')).reduce((s, i) => s + noCartao((num(i.qtd) || 1) * num(i.vunit), t.total), 0);
  const servicos = cc.total - pecas;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); cor(doc, CINZA);
  if (!t.desconto && pecas > 0 && servicos > 0) {
    doc.text('Peças', 140, y); doc.text(moeda(pecas), W - M - 2, y, { align: 'right' }); y += 5;
    doc.text('Mão de obra', 140, y); doc.text(moeda(servicos), W - M - 2, y, { align: 'right' }); y += 3;
  }
  // Preço no cartão em destaque (parcela primeiro) e o Pix com desconto embaixo
  doc.setFillColor(...TEXTO); doc.roundedRect(M + 60, y, W - 2 * M - 60, 11, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text(linhaCartao(t.total, cc), W - M - 4, y + 7.3, { align: 'right' });
  y += 17;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); cor(doc, TEXTO);
  doc.text(linhaPix(t.total, cc), W - M - 2, y, { align: 'right' });
  y += 10;

  if (String(o.obs || '').trim()) {
    const l = doc.splitTextToSize(String(o.obs), W - 2 * M);
    if (y + l.length * 4 > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); cor(doc, CINZA); doc.text('OBSERVAÇÕES', M, y); y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); cor(doc, TEXTO); doc.text(l, M, y); y += l.length * 4 + 6;
  }

  // Condições
  const termos = [
    'Orçamento válido por 7 (sete) dias corridos. Após esse prazo os valores podem mudar conforme reajustes de peças, insumos e serviços.',
    'A aprovação deste orçamento implica concordância com os valores e condições aqui apresentados.',
    'O cliente autoriza testes de funcionamento e rodagem do veículo pelo mecânico responsável, em percurso compatível com a verificação dos serviços.',
    'Após a conclusão dos serviços e o aviso ao cliente, o veículo deve ser retirado em até 15 (quinze) dias corridos.',
    'Sem retirada no prazo e sem acordo prévio, será cobrada estadia de R$ 10,00 (dez reais) por dia pela guarda do veículo.',
  ];
  if (y > 222) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); cor(doc, CINZA); doc.text('CONDIÇÕES', M, y); y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2);
  termos.forEach((tx, i) => { const l = doc.splitTextToSize(`${i + 1}. ${tx}`, W - 2 * M); doc.text(l, M, y); y += l.length * 3.5 + 1; });

  // Autorização e assinaturas
  y += 5; if (y > 255) { doc.addPage(); y = 24; }
  doc.setDrawColor(...TEXTO); doc.setLineWidth(0.3); doc.rect(M, y - 3.2, 3.8, 3.8);
  if (o.autorizaRodagem) { doc.setLineWidth(0.6); doc.line(M + 0.8, y - 1.3, M + 1.7, y - 0.1); doc.line(M + 1.7, y - 0.1, M + 3.1, y - 2.6); }
  doc.setFontSize(8); cor(doc, TEXTO); doc.text('Autorizo o teste de rodagem do veículo pelo mecânico responsável.', M + 6, y);
  y += 18;
  doc.setDrawColor(...CINZA); doc.setLineWidth(0.25);
  doc.line(M, y, 95, y); doc.line(115, y, W - M, y);
  doc.setFontSize(7.2); cor(doc, CINZA);
  doc.text('Assinatura do cliente', M, y + 4.5); doc.text('Responsável pela oficina', 115, y + 4.5);

  rodapePaginas(doc, `${(S.empresa && S.empresa.nomeFantasia) || 'ZL Motos'} · orçamento emitido em ${new Date().toLocaleDateString('pt-BR')}`);
  const nome = `Orcamento_${nomeArquivo(o.cliente)}_${data}.pdf`;
  if (opcoes.compartilhar && podeCompartilharArquivo()) {
    const arquivo = new File([doc.output('blob')], nome, { type: 'application/pdf' });
    navigator.share({ files: [arquivo], title: 'Orçamento', text: opcoes.texto || '' }).catch(() => {});
    return 'compartilhado';
  }
  baixar(doc, nome);
  aviso('PDF gerado');
  return 'baixado';
}

// Celular com menu de compartilhar que aceita arquivos (Android/iPhone).
export function podeCompartilharArquivo() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] })) && matchMedia('(pointer: coarse)').matches; }
  catch (e) { return false; }
}

export function relatorioMensalPDF(m) {
  const doc = novoDoc(); if (!doc) return;
  const d = S.dados[m] || { entradas: [], variaveis: [], fixos: [] };
  const c = calcMes(m);
  let y = cabecalho(doc, 'RELATÓRIO MENSAL', [`${MESES[m]} de ${S.ano}`, `Emitido em ${new Date().toLocaleDateString('pt-BR')}`]);

  const blocos = [['Entradas', c.entradas], ['Saídas', c.saidas], ['Resultado', c.resultado]];
  const cw = (W - 2 * M - 8) / 3;
  blocos.forEach(([r, v], i) => {
    const bx = M + i * (cw + 4);
    doc.setFillColor(...FUNDO); doc.roundedRect(bx, y, cw, 18, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); cor(doc, CINZA); doc.text(r.toUpperCase(), bx + 4, y + 6.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5);
    if (i === 2) doc.setTextColor(...(v < 0 ? [180, 40, 40] : [30, 120, 70])); else cor(doc, TEXTO);
    doc.text(moeda(v), bx + 4, y + 14);
  });
  y += 27;

  const secao = (titulo, linhas) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); cor(doc, TEXTO); doc.text(titulo, M, y); y += 2.5;
    doc.setDrawColor(...LINHA); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (!linhas.length) { cor(doc, CINZA); doc.text('Nada lançado.', M, y); y += 9; return; }
    linhas.forEach(([a, b, v]) => {
      if (y > 275) { doc.addPage(); y = 20; }
      cor(doc, CINZA); doc.text(a, M, y);
      cor(doc, TEXTO); doc.text(String(b), M + 22, y, { maxWidth: 120 });
      doc.text(moeda(v), W - M, y, { align: 'right' }); y += 5.2;
    });
    y += 5;
  };

  // Resumo por forma de pagamento
  const formas = {};
  d.entradas.forEach(e => { if (num(e.valor)) formas[e.formaPgto || 'Não informada'] = (formas[e.formaPgto || 'Não informada'] || 0) + num(e.valor); if (num(e.valor2)) formas[e.formaPgto2 || 'Não informada'] = (formas[e.formaPgto2 || 'Não informada'] || 0) + num(e.valor2); });
  secao('Entradas por forma de pagamento', Object.entries(formas).sort((a, b) => b[1] - a[1]).map(([f, v]) => ['', f, v]));

  // Saídas por categoria
  const cats = {};
  d.variaveis.forEach(v => { const k = v.cat === 'Fixo' ? 'Custos fixos' : (v.cat || 'Outros'); cats[k] = (cats[k] || 0) + num(v.valor) + num(v.valor2); });
  const fixos = d.fixos.reduce((s, f) => s + num(f.valor), 0);
  if (fixos) cats['Custos fixos'] = (cats['Custos fixos'] || 0) + fixos;
  secao('Saídas por categoria', Object.entries(cats).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => ['', k, v]));

  // Lançamentos
  const ord = (a, b) => String(a.data || '').localeCompare(String(b.data || ''));
  secao('Entradas', [...d.entradas].sort(ord).filter(e => num(e.valor) + num(e.valor2)).map(e => [dataBR(e.data).slice(0, 5), e.desc || '—', num(e.valor) + num(e.valor2)]));
  secao('Saídas', [...d.fixos.filter(f => num(f.valor)).map(f => ({ data: f.data, desc: f.nome + ' (fixo)', valor: f.valor })), ...d.variaveis].sort(ord)
    .map(v => [dataBR(v.data).slice(0, 5), (v.desc || '—') + (v.cat ? ` · ${v.cat}` : ''), num(v.valor) + num(v.valor2)]));

  rodapePaginas(doc, `${(S.empresa && S.empresa.nomeFantasia) || 'ZL Motos'} · relatório de ${MESES[m]} de ${S.ano}`);
  baixar(doc, `Relatorio_${MESES[m]}_${S.ano}.pdf`);
  aviso('Relatório gerado');
}
