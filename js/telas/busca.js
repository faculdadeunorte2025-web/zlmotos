// Busca global (Ctrl+K): orçamentos, clientes, lançamentos do ano e contas.
import { S, totalOrcamento } from '../dados.js';
import { MESES, moeda, num, esc, dataBR, abrirModal, fecharModal } from '../util.js';

export function abrir() {
  abrirModal({
    classe: 'busca-modal', largo: true,
    corpo: `<input type="search" placeholder="Buscar cliente, moto, placa, lançamento, conta…" data-digitar="busca-global" autocomplete="off">
      <div class="busca-resultados" id="busca-resultados"><div class="vazio" style="border:0">Digite pelo menos 2 letras.</div></div>`
  });
}

function buscar(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return '<div class="vazio" style="border:0">Digite pelo menos 2 letras.</div>';
  const tem = (...v) => v.join(' ').toLowerCase().includes(q);
  const grupos = [];
  const orcs = S.orcamentos.filter(o => tem(o.cliente, o.veiculo, o.placa, o.telefone, (o.itens || []).map(i => i.desc).join(' '))).slice(0, 8);
  if (orcs.length) grupos.push(['Orçamentos', orcs.map(o => linha(`${esc(o.cliente)}`, `${esc([o.veiculo, o.placa].filter(Boolean).join(' · '))} · ${dataBR(o.data || o.criadoEm)}`, moeda(totalOrcamento(o).total), 'orcamentos', o.id))]);
  const clis = S.clientes.filter(c => tem(c.nome, c.tel, c.veic, c.placa, c.cpf)).slice(0, 8);
  if (clis.length) grupos.push(['Clientes', clis.map(c => linha(esc(c.nome), esc([c.tel, c.veic, c.placa].filter(Boolean).join(' · ')), '', 'clientes', c.id))]);
  const lancs = [];
  for (let m = 11; m >= 0 && lancs.length < 10; m--) {
    const d = S.dados[m]; if (!d) continue;
    d.entradas.forEach(x => { if (tem(x.desc, x.formaPgto)) lancs.push({ m, x, e: true }); });
    d.variaveis.forEach(x => { if (tem(x.desc, x.cat)) lancs.push({ m, x, e: false }); });
    d.fixos.forEach(x => { if (num(x.valor) && tem(x.nome)) lancs.push({ m, x: { ...x, desc: x.nome }, e: false }); });
  }
  if (lancs.length) grupos.push(['Lançamentos de ' + S.ano, lancs.slice(0, 10).map(l => linha(esc(l.x.desc || '—'), `${MESES[l.m]} · ${dataBR(l.x.data)}`, `<span class="${l.e ? 'pos' : 'neg'}">${l.e ? '+' : '−'} ${moeda(num(l.x.valor) + num(l.x.valor2))}</span>`, 'caixa', null, l.m))]);
  const contas = S.contas.filter(c => tem(c.nome, c.obs)).slice(0, 6);
  if (contas.length) grupos.push(['Contas a pagar', contas.map(c => linha(esc(c.nome), (c.status === 'pago' ? 'Paga · ' : 'Vence ') + dataBR(c.vencimento), c.valor ? moeda(c.valor) : '', 'contas'))]);
  if (!grupos.length) return '<div class="vazio" style="border:0">Nada encontrado.</div>';
  return grupos.map(([t, ls]) => `<div class="busca-grupo">${t}</div>${ls.join('')}`).join('');
}
const linha = (t, meta, valor, tela, p, mes) => `<div class="linha clicavel" data-acao="abrir-resultado" data-tela="${tela}" ${p ? `data-p="${esc(p)}"` : ''} ${mes !== undefined ? `data-mes="${mes}"` : ''}>
  <div class="principal"><div class="titulo">${t}</div><div class="meta">${meta}</div></div><div class="valor">${valor}</div></div>`;

export const acoes = {
  'abrir-resultado': el => { fecharModal(); if (el.dataset.mes !== undefined) S.mes = +el.dataset.mes; window.zlIr(el.dataset.tela, el.dataset.p || null); },
};
export const digitacao = {
  'busca-global': el => { document.getElementById('busca-resultados').innerHTML = buscar(el.value); },
};
