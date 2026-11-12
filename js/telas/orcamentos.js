// Orçamentos: lista e formulário.
import { S, salvarOrcamento, excluirOrcamento, totalOrcamento, orcAceito, orcRecusado, salvarCliente } from '../dados.js';
import { registrarLog } from '../firebase.js';
import { moeda, num, esc, hojeISO, somaDias, dataBR, diasDesde, gerarId, copia, abrirModal, fecharModal, confirmar, aviso, erro, icone, lerForm, linkWhats, soNumeros } from '../util.js';
import { orcamentoPDF } from '../pdf.js';

const STATUS = {
  pendente: { nome: 'Pendente' },
  enviado:  { nome: 'Enviado' },
  aceito:   { nome: 'Aceito', cls: 'pos' },
  recusado: { nome: 'Recusado', cls: 'neg' },
};
const statusDe = o => orcAceito(o) ? 'aceito' : orcRecusado(o) ? 'recusado' : (o.status === 'enviado' ? 'enviado' : 'pendente');

let filtro = 'abertos';
let termo = '';
let atual = null;     // orçamento em edição (cópia)
let sujo = false;

export function tela(param) {
  if (param === 'novo') { if (!atual || !atual._novo) novo(); return formulario(); }
  if (param && param !== 'lista') {
    if (!atual || atual.id !== param) { const o = S.orcamentos.find(x => x.id === param); if (o) { atual = prepara(copia(o)); sujo = false; } }
    if (atual) return formulario();
  }
  atual = null;
  return lista();
}

// ── Lista ───────────────────────────────────────────────────────────
function lista() {
  const cont = { abertos: 0, aceitos: 0, receber: 0, recusados: 0, todos: S.orcamentos.length };
  S.orcamentos.forEach(o => { const s = statusDe(o); if (s === 'pendente' || s === 'enviado') cont.abertos++; if (s === 'aceito') cont.aceitos++; if (s === 'aceito' && !o.pago) cont.receber++; if (s === 'recusado') cont.recusados++; });
  let itens = S.orcamentos.filter(o => {
    const s = statusDe(o);
    if (filtro === 'abertos') return s === 'pendente' || s === 'enviado';
    if (filtro === 'aceitos') return s === 'aceito';
    if (filtro === 'receber') return s === 'aceito' && !o.pago;
    if (filtro === 'recusados') return s === 'recusado';
    return true;
  });
  if (termo) { const q = termo.toLowerCase(); itens = itens.filter(o => [o.cliente, o.veiculo, o.placa, o.telefone].join(' ').toLowerCase().includes(q)); }
  const soma = itens.reduce((s, o) => s + totalOrcamento(o).total, 0);
  const chip = (k, n) => `<button class="filtro ${filtro === k ? 'ativo' : ''}" data-acao="filtro-orc" data-f="${k}">${n} <span class="mudo">${cont[k]}</span></button>`;

  return `
  <div class="cabecalho">
    <div><h1>Orçamentos</h1><div class="sub">${itens.length} orçamento(s) · ${moeda(soma)}</div></div>
    <div class="acoes"><button class="btn btn-primario" data-acao="novo-orc">${icone('mais')} Novo orçamento</button></div>
  </div>
  <div class="caixa">
    <div class="filtros">
      ${chip('abertos', 'Em aberto')}${chip('aceitos', 'Aceitos')}${chip('receber', 'A receber')}${chip('recusados', 'Recusados')}${chip('todos', 'Todos')}
      <input type="search" class="busca" placeholder="Cliente, moto ou placa…" value="${esc(termo)}" data-digitar="busca-orc" data-sem-redesenho>
    </div>
    <div class="lista">
      ${itens.length ? itens.map(o => {
        const s = statusDe(o), t = totalOrcamento(o).total, pago = num(o.valorPago);
        const dias = diasDesde(o.criadoEm || o.data);
        return `<div class="linha clicavel" data-acao="ir" data-tela="orcamentos" data-p="${esc(o.id)}">
          <div class="principal">
            <div class="titulo">${esc(o.cliente || 'Sem cliente')}</div>
            <div class="meta">${esc([o.veiculo, o.placa].filter(Boolean).join(' · ') || '—')} · ${dataBR(o.data || o.criadoEm)}${(s === 'pendente' || s === 'enviado') && dias >= 3 ? ` · há ${dias} dias` : ''}</div>
          </div>
          ${s === 'aceito' ? `<span class="etiqueta ${o.pago ? 'pos' : 'forte'}">${o.pago ? 'Pago' : pago > 0 ? 'Pago ' + moeda(pago) : 'A receber'}</span>` : ''}
          <span class="etiqueta ${STATUS[s].cls || ''}">${STATUS[s].nome}</span>
          <div class="valor">${moeda(t)}</div>
        </div>`;
      }).join('') : '<div class="vazio">Nenhum orçamento aqui.</div>'}
    </div>
  </div>`;
}

// ── Formulário ──────────────────────────────────────────────────────
function prepara(o) {
  o.itens = Array.isArray(o.itens) ? o.itens : [];
  o.descTipo = o.descTipo === 'percentual' ? 'percentual' : 'valor';
  if (o.descValor === undefined) o.descValor = '';
  return o;
}
function novo(cli) {
  atual = prepara({
    id: gerarId('orc'), cliente: cli?.nome || '', telefone: cli?.tel || '', veiculo: cli?.veic || '', placa: cli?.placa || '', clienteId: cli?.id || '',
    km: '', data: hojeISO(), validade: somaDias(7), itens: [{ desc: '', cat: 'Peça', qtd: '1', vunit: '' }], obs: '', status: 'pendente', autorizaRodagem: false, _novo: true,
  });
  sujo = false;
}

function formulario() {
  const o = atual, t = totalOrcamento(o), s = statusDe(o);
  return `
  <div class="cabecalho">
    <div class="acoes">
      <button class="btn btn-icone" data-acao="voltar-orc" title="Voltar">${icone('voltar')}</button>
      <div><h1>${o._novo ? 'Novo orçamento' : esc(o.cliente || 'Orçamento')}</h1><div class="sub">${o._novo ? 'Preencha e salve' : 'Criado em ' + dataBR(o.criadoEm || o.data)}</div></div>
    </div>
    <div class="acoes">
      ${!o._novo ? `<button class="btn" data-acao="pdf-orc">${icone('pdf')} PDF</button>
      <button class="btn" data-acao="whats-orc">${icone('whats')} WhatsApp</button>` : ''}
      <button class="btn btn-primario" data-acao="salvar-orc">Salvar</button>
    </div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Cliente e moto</h2></div>
    <div class="grade g3">
      <label class="campo span2 relativo"><span>Cliente</span>
        <input type="text" value="${esc(o.cliente)}" data-digitar="orc-cliente" data-campo="cliente" autocomplete="off" placeholder="Nome do cliente">
        <div class="sugestoes" id="sug-cliente" hidden></div></label>
      <label class="campo"><span>Telefone</span><input type="text" value="${esc(o.telefone)}" data-digitar="orc-campo" data-campo="telefone"></label>
      <label class="campo"><span>Moto</span><input type="text" value="${esc(o.veiculo)}" data-digitar="orc-campo" data-campo="veiculo" placeholder="Ex: CG 160 Fan"></label>
      <label class="campo"><span>Placa</span><input type="text" value="${esc(o.placa)}" data-digitar="orc-campo" data-campo="placa"></label>
      <label class="campo"><span>KM</span><input type="text" value="${esc(o.km || '')}" data-digitar="orc-campo" data-campo="km"></label>
      <label class="campo"><span>Data</span><input type="date" value="${esc(o.data || '')}" data-digitar="orc-campo" data-campo="data"></label>
      <label class="campo"><span>Validade</span><input type="date" value="${esc(o.validade || '')}" data-digitar="orc-campo" data-campo="validade"></label>
      <label class="campo"><span>Situação</span><select data-mudar="orc-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${s === k ? 'selected' : ''}>${v.nome}</option>`).join('')}</select></label>
    </div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Peças e serviços</h2>
      <div class="acoes"><button class="btn btn-p" data-acao="item-add" data-cat="Peça">${icone('mais')} Peça</button><button class="btn btn-p" data-acao="item-add" data-cat="Mão de Obra">${icone('mais')} Mão de obra</button></div></div>
    <div style="overflow-x:auto"><table class="tabela" id="tabela-itens">
      <thead><tr><th>Descrição</th><th style="width:130px">Tipo</th><th style="width:70px" class="num">Qtd</th><th style="width:120px" class="num">Valor unit.</th><th style="width:110px" class="num">Subtotal</th><th style="width:40px"></th></tr></thead>
      <tbody>${o.itens.map((it, i) => `<tr>
        <td><input type="text" value="${esc(it.desc)}" data-digitar="item" data-i="${i}" data-campo="desc" placeholder="Descrição"></td>
        <td><select data-mudar="item-cat" data-i="${i}">${['Peça', 'Mão de Obra', 'Serviço'].map(c => `<option ${it.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
        <td><input type="number" class="num" min="0" step="1" value="${esc(it.qtd)}" data-digitar="item" data-i="${i}" data-campo="qtd"></td>
        <td><input type="number" class="num" min="0" step="0.01" value="${esc(it.vunit)}" data-digitar="item" data-i="${i}" data-campo="vunit"></td>
        <td class="num mono" id="sub-${i}">${moeda(num(it.qtd) * num(it.vunit))}</td>
        <td><button class="btn btn-fantasma btn-p btn-icone" data-acao="item-del" data-i="${i}" title="Remover">${icone('lixo')}</button></td></tr>`).join('')}</tbody>
    </table></div>
    <div class="grade g3" style="margin-top:14px">
      <label class="campo"><span>Desconto</span><input type="number" min="0" step="0.01" value="${esc(o.descValor)}" data-digitar="orc-campo" data-campo="descValor"></label>
      <label class="campo"><span>Tipo de desconto</span><select data-mudar="orc-desc-tipo"><option value="valor" ${o.descTipo === 'valor' ? 'selected' : ''}>Em reais (R$)</option><option value="percentual" ${o.descTipo === 'percentual' ? 'selected' : ''}>Em porcentagem (%)</option></select></label>
      <div class="totais" id="totais">${totaisHTML(t)}</div>
    </div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Observações</h2></div>
    <textarea data-digitar="orc-campo" data-campo="obs" placeholder="Observações para o cliente…">${esc(o.obs || '')}</textarea>
    <label class="check" style="margin-top:10px"><input type="checkbox" data-mudar="orc-rodagem" ${o.autorizaRodagem ? 'checked' : ''}> Cliente autorizou teste de rodagem</label>
  </div>

  ${!o._novo && s === 'aceito' ? `<div class="caixa">
    <div class="caixa-titulo"><h2>Pagamento</h2><span class="etiqueta ${o.pago ? 'pos' : 'forte'}">${o.pago ? 'Pago' : 'A receber'}</span></div>
    <div class="acoes"><span class="mudo">Recebido: <b class="mono">${moeda(o.valorPago || (o.pago ? t.total : 0))}</b> de <b class="mono">${moeda(t.total)}</b></span>
      ${!o.pago ? `<button class="btn" data-acao="pagar-orc" style="margin-left:auto">Registrar pagamento</button>` : `<button class="btn btn-fantasma" data-acao="despagar-orc" style="margin-left:auto">Desfazer pagamento</button>`}</div>
  </div>` : ''}

  ${!o._novo ? `<div class="acoes" style="margin-top:16px">
    <button class="btn btn-fantasma" data-acao="duplicar-orc">${icone('copiar')} Duplicar</button>
    <button class="btn btn-perigo" data-acao="excluir-orc" style="margin-left:auto">${icone('lixo')} Excluir orçamento</button>
  </div>` : ''}`;
}
const totaisHTML = t => `${t.desconto > 0 ? `<span class="mudo">Subtotal ${moeda(t.subtotal)} · Desconto − ${moeda(t.desconto)}</span>` : ''}<span class="total">${moeda(t.total)}</span>`;

function atualizarTotais() {
  const el = document.getElementById('totais'); if (el) el.innerHTML = totaisHTML(totalOrcamento(atual));
  atual.itens.forEach((it, i) => { const c = document.getElementById('sub-' + i); if (c) c.textContent = moeda(num(it.qtd) * num(it.vunit)); });
}

async function salvar(msg = 'Orçamento salvo') {
  const o = atual;
  if (!String(o.cliente || '').trim()) { erro('Informe o nome do cliente.'); return false; }
  o.itens = (o.itens || []).filter(it => String(it.desc || '').trim() || num(it.vunit));
  const eraNovo = o._novo; delete o._novo;
  // cadastra o cliente automaticamente se ainda não existir
  if (!o.clienteId && !S.clientes.some(c => (c.nome || '').trim().toLowerCase() === o.cliente.trim().toLowerCase())) {
    const c = await salvarCliente({ nome: o.cliente.trim(), tel: o.telefone || '', veic: o.veiculo || '', placa: o.placa || '' });
    o.clienteId = c.id;
  }
  await salvarOrcamento(o);
  if (eraNovo) registrarLog('ORCAMENTO_CRIADO', { id: o.id, cliente: o.cliente, total: o.calc.total });
  sujo = false;
  aviso(msg);
  window.zlIr('orcamentos', o.id);
  return true;
}

function textoWhats(o) {
  const t = totalOrcamento(o), emp = S.empresa.nomeFantasia || 'ZL Motos';
  let s = `*${emp} — Orçamento*\n\nCliente: ${o.cliente}\n`;
  if (o.veiculo || o.placa) s += `Moto: ${[o.veiculo, o.placa].filter(Boolean).join(' · ')}\n`;
  s += `Data: ${dataBR(o.data)}${o.validade ? ` · Válido até ${dataBR(o.validade)}` : ''}\n\n`;
  o.itens.filter(it => it.desc).forEach(it => { s += `• ${it.desc} — ${num(it.qtd) || 1}x ${moeda(it.vunit)} = ${moeda(num(it.qtd) * num(it.vunit))}\n`; });
  if (t.desconto > 0) s += `\nSubtotal: ${moeda(t.subtotal)}\nDesconto: − ${moeda(t.desconto)}`;
  s += `\n*Total: ${moeda(t.total)}*`;
  if (o.obs) s += `\n\nObs: ${o.obs}`;
  return s;
}

// ── Ações ───────────────────────────────────────────────────────────
export const acoes = {
  'novo-orc': () => { novo(); window.zlIr('orcamentos', 'novo'); },
  'filtro-orc': el => { filtro = el.dataset.f; window.zlDesenhar(); },
  'voltar-orc': async () => {
    if (sujo && !(await confirmar('Sair sem salvar as alterações deste orçamento?', { botao: 'Sair sem salvar', perigo: true }))) return;
    atual = null; sujo = false; window.zlIr('orcamentos');
  },
  'salvar-orc': () => salvar(),
  'item-add': el => { atual.itens.push({ desc: '', cat: el.dataset.cat, qtd: '1', vunit: '' }); sujo = true; window.zlDesenhar(); const ins = document.querySelectorAll('#tabela-itens tbody tr:last-child input'); ins[0] && ins[0].focus(); },
  'item-del': el => { atual.itens.splice(+el.dataset.i, 1); sujo = true; window.zlDesenhar(); },
  'escolher-cliente': el => {
    const c = S.clientes.find(x => x.id === el.dataset.id); if (!c) return;
    Object.assign(atual, { cliente: c.nome, telefone: c.tel || c.telefone || atual.telefone, veiculo: c.veic || atual.veiculo, placa: c.placa || atual.placa, clienteId: c.id });
    sujo = true; window.zlDesenhar();
  },
  'pdf-orc': () => orcamentoPDF(atual),
  'whats-orc': () => {
    window.open(linkWhats(atual.telefone, textoWhats(atual)), '_blank');
    if (statusDe(atual) === 'pendente') { atual.status = 'enviado'; salvar('Marcado como enviado'); }
  },
  'pagar-orc': () => {
    const t = totalOrcamento(atual).total, ja = num(atual.valorPago);
    abrirModal({
      titulo: 'Registrar pagamento',
      corpo: `<p class="mudo" style="margin:0">Total ${moeda(t)} · já recebido ${moeda(ja)}</p>
        <label class="campo"><span>Valor recebido agora (R$)</span><input type="number" step="0.01" min="0" name="valor" value="${(t - ja).toFixed(2)}"></label>
        <label class="check"><input type="checkbox" name="lancar" checked> Lançar como entrada no Caixa de hoje</label>`,
      rodape: `<div class="direita"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" data-acao="confirmar-pagamento">Confirmar</button></div>`
    });
  },
  'confirmar-pagamento': async () => {
    const f = lerForm(document.querySelector('.modal'));
    const v = num(f.valor); if (!(v > 0)) return erro('Informe o valor recebido.');
    const t = totalOrcamento(atual).total;
    atual.valorPago = Math.round((num(atual.valorPago) + v) * 100) / 100;
    atual.pago = atual.valorPago >= t - 0.009;
    if (f.lancar) {
      const { S: E, salvarLancamentos } = await import('../dados.js');
      const h = new Date();
      if (h.getFullYear() !== E.ano) erro('A entrada não foi lançada: o Caixa está em outro ano.');
      else { E.dados[h.getMonth()].entradas.push({ data: hojeISO(), hora: String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0'), desc: 'Orçamento — ' + atual.cliente + (atual.veiculo ? ' (' + atual.veiculo + ')' : ''), valor: v.toFixed(2), formaPgto: '', pago: true, _orcId: atual.id, _id: gerarId('e') }); salvarLancamentos(); }
    }
    fecharModal();
    await salvar(atual.pago ? 'Orçamento quitado' : 'Pagamento parcial registrado');
  },
  'despagar-orc': async () => { if (!(await confirmar('Marcar este orçamento como não pago? (entradas já lançadas no Caixa continuam lá)'))) return; atual.pago = false; atual.valorPago = 0; await salvar('Pagamento desfeito'); },
  'duplicar-orc': () => { const c = copia(atual); Object.assign(c, { id: gerarId('orc'), data: hojeISO(), validade: somaDias(7), status: 'pendente', pago: false, valorPago: 0, criadoEm: '', _novo: true }); atual = prepara(c); sujo = true; window.zlIr('orcamentos', atual.id); aviso('Cópia criada — confira e salve'); },
  'excluir-orc': async () => {
    if (!(await confirmar(`Excluir o orçamento de ${esc(atual.cliente)} (${moeda(totalOrcamento(atual).total)})? Isso não pode ser desfeito.`, { botao: 'Excluir', perigo: true }))) return;
    await excluirOrcamento(atual.id); atual = null; aviso('Orçamento excluído'); window.zlIr('orcamentos');
  },
};
export const mudancas = {
  'orc-status': el => { atual.status = el.value; sujo = true; window.zlDesenhar(); },
  'orc-desc-tipo': el => { atual.descTipo = el.value; sujo = true; atualizarTotais(); },
  'orc-rodagem': el => { atual.autorizaRodagem = el.checked; sujo = true; },
  'item-cat': el => { atual.itens[+el.dataset.i].cat = el.value; sujo = true; },
};
export const digitacao = {
  'orc-campo': el => { atual[el.dataset.campo] = el.value; sujo = true; if (el.dataset.campo === 'descValor') atualizarTotais(); },
  'item': el => { atual.itens[+el.dataset.i][el.dataset.campo] = el.value; sujo = true; atualizarTotais(); },
  'orc-cliente': el => {
    atual.cliente = el.value; atual.clienteId = ''; sujo = true;
    const q = el.value.trim().toLowerCase(), box = document.getElementById('sug-cliente');
    const sug = q.length < 2 ? [] : S.clientes.filter(c => (c.nome || '').toLowerCase().includes(q) || soNumeros(c.tel).includes(soNumeros(q) || '#')).slice(0, 8);
    box.hidden = !sug.length;
    box.innerHTML = sug.map(c => `<button type="button" data-acao="escolher-cliente" data-id="${esc(c.id)}"><b>${esc(c.nome)}</b> <span class="mudo">${esc([c.tel, c.veic, c.placa].filter(Boolean).join(' · '))}</span></button>`).join('');
  },
  'busca-orc': el => {
    termo = el.value; clearTimeout(el._t);
    el._t = setTimeout(() => { const pos = el.selectionStart; delete el.dataset.semRedesenho; window.zlDesenhar(); const n = document.querySelector('[data-digitar="busca-orc"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250);
  },
};
export const novoParaCliente = cli => { novo(cli); window.zlIr('orcamentos', atual.id); };
