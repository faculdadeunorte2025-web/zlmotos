// Caixa: lançamentos do mês (entradas, saídas e contas fixas).
import { S, calcMes, salvarLancamentos, trocarAno, garantirMeses, copiarFixas } from '../dados.js';
import { registrarLog } from '../firebase.js';
import { MESES, FORMAS, moeda, num, esc, hojeISO, horaAgora, diaSemana, dataBR, gerarId, abrirModal, fecharModal, confirmar, aviso, erro, icone, lerForm } from '../util.js';
import { relatorioMensalPDF } from '../pdf.js';

let filtro = 'todos';
let termo = '';

// Junta as 3 listas do mês numa só, com referência para editar
function itensDoMes(m) {
  const d = S.dados[m] || { entradas: [], variaveis: [], fixos: [] };
  const out = [];
  d.entradas.forEach((x, i) => out.push({ tipo: 'entrada', lista: 'entradas', i, x, desc: x.desc, valor: num(x.valor) + num(x.valor2), info: [x.formaPgto, x.formaPgto2].filter(Boolean).join(' + ') }));
  d.variaveis.forEach((x, i) => out.push({ tipo: x.cat === 'Fixo' ? 'fixa' : 'saida', lista: 'variaveis', i, x, desc: x.desc, valor: num(x.valor) + num(x.valor2), info: [x.cat, x.formaPgto].filter(Boolean).join(' · ') }));
  d.fixos.forEach((x, i) => out.push({ tipo: 'fixa', lista: 'fixos', i, x, desc: x.nome, valor: num(x.valor), info: 'Conta fixa' }));
  return out;
}

export function tela() {
  garantirMeses();
  const m = S.mes, c = calcMes(m);
  const anoHoje = new Date().getFullYear();
  const anos = []; for (let a = anoHoje - 4; a <= anoHoje + 1; a++) anos.push(a);
  if (!anos.includes(S.ano)) anos.push(S.ano);

  let itens = itensDoMes(m);
  if (filtro === 'entradas') itens = itens.filter(t => t.tipo === 'entrada');
  if (filtro === 'saidas') itens = itens.filter(t => t.tipo === 'saida');
  if (filtro === 'fixas') itens = itens.filter(t => t.tipo === 'fixa');
  if (termo) { const q = termo.toLowerCase(); itens = itens.filter(t => (t.desc + ' ' + t.info).toLowerCase().includes(q)); }
  // fixas sem valor nem data (modelo) só aparecem no filtro "Fixas"
  if (filtro !== 'fixas') itens = itens.filter(t => !(t.lista === 'fixos' && !num(t.x.valor) && !t.x.data));

  const porDia = {};
  itens.forEach(t => { const k = t.x.data || ''; (porDia[k] = porDia[k] || []).push(t); });
  const dias = Object.keys(porDia).sort().reverse();

  const lista = dias.length ? dias.map(dia => {
    const doDia = porDia[dia].sort((a, b) => String(b.x.hora || '').localeCompare(String(a.x.hora || '')));
    const saldo = doDia.reduce((s, t) => s + (t.tipo === 'entrada' ? t.valor : -t.valor), 0);
    return `<div class="dia"><span>${dia ? diaSemana(dia) : 'Sem data'}</span><span class="mono ${saldo >= 0 ? 'pos' : 'neg'}">${saldo >= 0 ? '+' : '−'} ${moeda(Math.abs(saldo))}</span></div>`
      + doDia.map(t => `
      <div class="linha clicavel" data-acao="editar-lanc" data-ref="${m}|${t.lista}|${t.i}">
        <div class="principal">
          <div class="titulo">${esc(t.desc || 'Sem descrição')}</div>
          <div class="meta">${t.tipo === 'entrada' ? 'Entrada' : t.tipo === 'fixa' ? 'Fixa' : 'Saída'}${t.info ? ' · ' + esc(t.info) : ''}${t.x.hora ? ' · ' + esc(t.x.hora) : ''}</div>
        </div>
        ${t.tipo !== 'entrada' ? `<span class="etiqueta ${t.x.pago ? '' : 'forte'}">${t.x.pago ? 'Pago' : 'A pagar'}</span>` : ''}
        <div class="valor ${t.tipo === 'entrada' ? 'pos' : 'neg'}">${t.tipo === 'entrada' ? '+' : '−'} ${moeda(t.valor)}</div>
      </div>`).join('');
  }).join('') : `<div class="vazio">Nenhum lançamento ${termo || filtro !== 'todos' ? 'com esse filtro' : 'neste mês'}.</div>`;

  const chip = (k, n) => `<button class="filtro ${filtro === k ? 'ativo' : ''}" data-acao="filtro-caixa" data-f="${k}">${n}</button>`;

  return `
  <div class="cabecalho">
    <div class="nav-mes">
      <button class="btn btn-icone" data-acao="mes-ant" title="Mês anterior">${icone('esq')}</button>
      <div class="nome"><h1 style="font-size:1.2rem">${MESES[m]}</h1></div>
      <button class="btn btn-icone" data-acao="mes-prox" title="Próximo mês">${icone('dir')}</button>
      <select data-mudar="ano" style="width:92px;margin-left:6px">${anos.sort().map(a => `<option ${a === S.ano ? 'selected' : ''}>${a}</option>`).join('')}</select>
    </div>
    <div class="acoes">
      <button class="btn" data-acao="novo-lanc" data-tipo="saida">${icone('mais')} Saída</button>
      <button class="btn btn-primario" data-acao="novo-lanc" data-tipo="entrada">${icone('mais')} Entrada</button>
    </div>
  </div>

  <div class="indicadores">
    <div class="indicador"><div class="rotulo">Entradas</div><div class="valor pos">${moeda(c.entradas)}</div></div>
    <div class="indicador"><div class="rotulo">Saídas</div><div class="valor neg">${moeda(c.saidas)}</div><div class="detalhe">Fixas ${moeda(c.fixas)} · Variáveis ${moeda(c.variaveis)}</div></div>
    <div class="indicador"><div class="rotulo">Resultado</div><div class="valor ${c.resultado >= 0 ? 'pos' : 'neg'}">${moeda(c.resultado)}</div></div>
  </div>

  <div class="caixa">
    <div class="filtros">
      ${chip('todos', 'Todos')}${chip('entradas', 'Entradas')}${chip('saidas', 'Saídas')}${chip('fixas', 'Fixas')}
      <input type="search" class="busca" placeholder="Buscar no mês…" value="${esc(termo)}" data-digitar="busca-caixa" data-sem-redesenho>
    </div>
    <div class="lista">${lista}</div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Observações do mês</h2>
      <div class="acoes">
        <button class="btn btn-p" data-acao="copiar-fixas">Copiar fixas do mês anterior</button>
        <button class="btn btn-p" data-acao="csv-mes">Exportar CSV</button>
        <button class="btn btn-p" data-acao="pdf-mes">Relatório PDF</button>
      </div>
    </div>
    <textarea data-mudar="obs" placeholder="Anotações do mês…">${esc(S.dados[m].obs || '')}</textarea>
  </div>`;
}

// ── Modal de lançamento ─────────────────────────────────────────────
function modalLanc({ tipo, ref, x = {} }) {
  const editando = !!ref;
  const ehFixa = tipo === 'fixa', ehEntrada = tipo === 'entrada';
  const cats = ['Fixo'].concat(S.categorias.filter(c => c !== 'Fixo'));
  const forma = (n, v) => `<select name="${n}"><option value="">—</option>${FORMAS.map(f => `<option ${v === f ? 'selected' : ''}>${f}</option>`).join('')}</select>`;
  const dataPadrao = (() => { const h = new Date(); return (h.getFullYear() === S.ano && h.getMonth() === S.mes) ? hojeISO() : `${S.ano}-${String(S.mes + 1).padStart(2, '0')}-01`; })();
  const dividido = x.valor2 !== undefined && x.valor2 !== '';
  const titulo = (editando ? 'Editar ' : 'Nova ') + (ehEntrada ? 'entrada' : ehFixa ? 'conta fixa' : 'saída');

  const corpo = `
    ${!editando ? `<div class="filtros" style="margin:0">
      ${['entrada', 'saida', 'fixa'].map(t => `<button class="filtro ${t === tipo ? 'ativo' : ''}" data-acao="tipo-lanc" data-tipo="${t}">${t === 'entrada' ? 'Entrada' : t === 'saida' ? 'Saída' : 'Conta fixa'}</button>`).join('')}
    </div>` : ''}
    <label class="campo"><span>Descrição</span><input type="text" name="desc" value="${esc(ehFixa && x.nome !== undefined ? x.nome : x.desc || '')}" placeholder="${ehEntrada ? 'Ex: Troca de óleo — CG 160' : 'Ex: Compra de peças'}"></label>
    <div class="grade g3">
      <label class="campo"><span>Valor (R$)</span><input type="number" name="valor" step="0.01" min="0" value="${esc(x.valor ?? '')}"></label>
      <label class="campo"><span>Data</span><input type="date" name="data" value="${esc(x.data || dataPadrao)}"></label>
      <label class="campo"><span>Hora</span><input type="time" name="hora" value="${esc(x.hora || (editando ? '' : horaAgora()))}"></label>
    </div>
    ${!ehFixa ? `<div class="grade g2">
      ${!ehEntrada ? `<label class="campo"><span>Categoria</span><select name="cat">${cats.map(c => `<option ${(x.cat || 'Outros') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>` : ''}
      <label class="campo"><span>Forma de pagamento</span>${forma('formaPgto', x.formaPgto)}</label>
    </div>
    <label class="check"><input type="checkbox" name="dividir" data-mudar="dividir" ${dividido ? 'checked' : ''}> Pago em 2 formas</label>
    <div class="grade g2" id="segunda-forma" ${dividido ? '' : 'hidden'}>
      <label class="campo"><span>Valor da 2ª forma (R$)</span><input type="number" name="valor2" step="0.01" min="0" value="${esc(x.valor2 ?? '')}"></label>
      <label class="campo"><span>2ª forma</span>${forma('formaPgto2', x.formaPgto2)}</label>
    </div>` : ''}
    ${!ehEntrada ? `<label class="check"><input type="checkbox" name="pago" ${x.pago ? 'checked' : ''}> Já está pago</label>` : ''}
    <input type="hidden" name="tipo" value="${tipo}"><input type="hidden" name="ref" value="${esc(ref || '')}">`;
  abrirModal({
    titulo, corpo,
    rodape: `${editando ? `<button class="btn btn-perigo" data-acao="excluir-lanc">${icone('lixo')} Excluir</button>` : ''}
      <div class="direita"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" data-acao="salvar-lanc">Salvar</button></div>`
  });
}

function pegarRef(ref) {
  const [m, lista, i] = ref.split('|');
  return { m: +m, lista, i: +i, x: S.dados[+m][lista][+i] };
}

function salvarLanc() {
  const f = lerForm(document.querySelector('.modal'));
  const editando = !!f.ref;
  if (!S.carregado) { erro('Ainda carregando os dados — tente em instantes.'); return; }
  if (!f.desc.trim()) { erro('Informe a descrição.'); return; }
  if (!(num(f.valor) > 0) && f.tipo !== 'fixa') { erro('Informe um valor.'); return; }
  const p = /^(\d{4})-(\d{2})-\d{2}$/.exec(f.data || '');
  if (p && +p[1] !== S.ano) { erro(`Essa data é de ${p[1]}. Troque o ano para ${p[1]} antes de lançar.`); return; }
  const mesDestino = p ? +p[2] - 1 : S.mes;

  // monta o item preservando campos que já existiam
  let item, origem = null;
  if (editando) { origem = pegarRef(f.ref); item = origem.x; } else item = { _id: gerarId(f.tipo === 'entrada' ? 'e' : f.tipo === 'fixa' ? 'f' : 'v') };
  const listaDestino = f.tipo === 'entrada' ? 'entradas' : (f.tipo === 'fixa' && (!editando || origem.lista === 'fixos')) ? 'fixos' : 'variaveis';
  if (listaDestino === 'fixos') { item.nome = f.desc.trim(); delete item.desc; } else item.desc = f.desc.trim();
  item.valor = f.valor; item.data = f.data; item.hora = f.hora;
  if (listaDestino !== 'fixos') {
    item.formaPgto = f.formaPgto || '';
    if (f.tipo !== 'entrada') item.cat = f.cat || (f.tipo === 'fixa' ? 'Fixo' : 'Outros');
    if (f.dividir && num(f.valor2) > 0) { item.valor2 = f.valor2; item.formaPgto2 = f.formaPgto2 || ''; } else { delete item.valor2; delete item.formaPgto2; }
  }
  if (f.tipo === 'entrada') { if (item.pago === undefined) item.pago = true; } else item.pago = !!f.pago;

  if (editando) {
    if (origem.m !== mesDestino || origem.lista !== listaDestino) {
      S.dados[origem.m][origem.lista].splice(origem.i, 1);
      S.dados[mesDestino][listaDestino].push(item);
    }
  } else {
    S.dados[mesDestino][listaDestino].push(item);
    registrarLog(f.tipo === 'entrada' ? 'ENTRADA_ADICIONADA' : 'SAIDA_ADICIONADA', { mes: mesDestino, desc: item.desc || item.nome, valor: item.valor, data: item.data });
  }
  salvarLancamentos();
  fecharModal();
  if (mesDestino !== S.mes) { aviso('Lançado em ' + MESES[mesDestino] + ' (mês da data)'); S.mes = mesDestino; }
  else aviso(editando ? 'Lançamento atualizado' : 'Lançamento salvo');
  window.zlDesenhar();
}

async function excluirLanc() {
  const ref = document.querySelector('.modal [name=ref]').value;
  const o = pegarRef(ref);
  if (!(await confirmar(`Excluir "${esc(o.x.desc || o.x.nome || 'lançamento')}" de ${moeda(num(o.x.valor) + num(o.x.valor2))}?`, { botao: 'Excluir', perigo: true }))) return;
  S.dados[o.m][o.lista].splice(o.i, 1);
  registrarLog('LANCAMENTO_REMOVIDO', { mes: o.m, desc: o.x.desc || o.x.nome, valor: o.x.valor, data: o.x.data });
  salvarLancamentos();
  aviso('Lançamento excluído');
  window.zlDesenhar();
}

// ── Ações ───────────────────────────────────────────────────────────
export const acoes = {
  'filtro-caixa': el => { filtro = el.dataset.f; window.zlDesenhar(); },
  'mes-ant': async () => { if (S.mes === 0) { await trocarAno(S.ano - 1); S.mes = 11; } else S.mes--; window.zlDesenhar(); },
  'mes-prox': async () => { if (S.mes === 11) { await trocarAno(S.ano + 1); S.mes = 0; } else S.mes++; window.zlDesenhar(); },
  'novo-lanc': el => modalLanc({ tipo: el.dataset.tipo }),
  'tipo-lanc': el => {
    const f = lerForm(document.querySelector('.modal'));
    modalLanc({ tipo: el.dataset.tipo, x: { desc: f.desc, valor: f.valor, data: f.data, hora: f.hora } });
  },
  'editar-lanc': el => { const o = pegarRef(el.dataset.ref); modalLanc({ tipo: o.lista === 'entradas' ? 'entrada' : (o.lista === 'fixos' || o.x.cat === 'Fixo') ? 'fixa' : 'saida', ref: el.dataset.ref, x: o.x }); },
  'salvar-lanc': salvarLanc,
  'excluir-lanc': excluirLanc,
  'copiar-fixas': () => {
    const r = copiarFixas(S.mes);
    if (r.erro) return erro(r.erro);
    if (!r.n) return aviso('As contas fixas já estão neste mês.');
    aviso(r.n + ' conta(s) fixa(s) copiada(s)'); window.zlDesenhar();
  },
  'csv-mes': () => {
    const linhas = [['Data', 'Hora', 'Tipo', 'Descrição', 'Categoria', 'Forma', 'Valor']];
    itensDoMes(S.mes).forEach(t => linhas.push([dataBR(t.x.data), t.x.hora || '', t.tipo, t.desc || '', t.x.cat || '', t.info, (t.tipo === 'entrada' ? '' : '-') + t.valor.toFixed(2).replace('.', ',')]));
    const csv = '﻿' + linhas.map(l => l.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ZLMotos_${MESES[S.mes]}_${S.ano}.csv`; a.click();
  },
  'pdf-mes': () => relatorioMensalPDF(S.mes),
};
export const mudancas = {
  'ano': async el => { await trocarAno(+el.value); window.zlDesenhar(); },
  'obs': el => { S.dados[S.mes].obs = el.value; if (salvarLancamentos()) aviso('Observação salva'); },
  'dividir': el => { document.getElementById('segunda-forma').hidden = !el.checked; },
};
export const digitacao = {
  'busca-caixa': el => {
    termo = el.value;
    clearTimeout(el._t);
    el._t = setTimeout(() => { const pos = el.selectionStart; delete el.dataset.semRedesenho; window.zlDesenhar(); const n = document.querySelector('[data-digitar="busca-caixa"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250);
  },
};
