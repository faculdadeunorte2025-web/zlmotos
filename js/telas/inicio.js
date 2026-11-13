// Tela inicial: meta, números do mês, avisos e gráfico dos últimos 6 meses.
import { S, calcMes, orcAceito, copiarFixas, faltamFixas, salvarConfig } from '../dados.js';
import { retornosOleo, comparativo, servicosQueMaisRendem } from '../analise.js';
import { aviso, erro } from '../util.js';
import { MESES, MESES_CURTO, moeda, moedaCurta, num, hojeISO, somaDias, diasDesde, esc } from '../util.js';

export function tela() {
  const hoje = new Date();
  const mes = hoje.getMonth();
  const anoAtual = hoje.getFullYear() === S.ano;
  const c = anoAtual ? calcMes(mes) : { entradas: 0, saidas: 0, resultado: 0 };
  const meta = num(S.config.metaMensal);
  const pend = S.orcamentos.filter(o => ((o.status || 'pendente') === 'pendente' || o.status === 'enviado') && !o.arquivado);
  const valorPend = pend.reduce((s, o) => s + num(o.calc && o.calc.total), 0);

  // Avisos
  const avisos = [];
  const lim = somaDias(2), hojeS = hojeISO();
  const contas = S.contas.filter(x => x.status !== 'pago' && x.vencimento && x.vencimento <= lim);
  if (contas.length) {
    const venc = contas.filter(x => x.vencimento < hojeS).length;
    avisos.push({ neg: true, tela: 'contas', txt: `<b>${contas.length} conta${contas.length > 1 ? 's' : ''} a pagar</b> ${venc ? `— ${venc} vencida${venc > 1 ? 's' : ''}` : 'vencendo em até 2 dias'}` });
  }
  const parados = pend.filter(o => diasDesde(o.criadoEm || o.data) >= 3);
  if (parados.length) avisos.push({ tela: 'orcamentos', txt: `<b>${parados.length} orçamento${parados.length > 1 ? 's' : ''}</b> sem resposta há mais de 3 dias` });
  const aReceber = S.orcamentos.filter(o => orcAceito(o) && !o.pago);
  const retornos = anoAtual ? retornosOleo() : [];
  if (retornos.length) avisos.push({ tela: 'clientes', p: 'retornos', txt: `<b>${retornos.length} cliente${retornos.length > 1 ? 's' : ''}</b> na hora de trocar o óleo` });
  if (aReceber.length) avisos.push({ tela: 'orcamentos', txt: `<b>${aReceber.length} orçamento${aReceber.length > 1 ? 's' : ''} aceito${aReceber.length > 1 ? 's' : ''}</b> ainda não pago${aReceber.length > 1 ? 's' : ''}` });

  return `
  <div class="cabecalho">
    <div><h1>Início</h1><div class="sub">${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
    <div class="acoes">
      <button class="btn" data-acao="ir" data-tela="caixa">Abrir caixa</button>
      <button class="btn btn-primario" data-acao="novo-orc">Novo orçamento</button>
    </div>
  </div>

  ${!anoAtual ? `<div class="faixa">Você está vendo o ano de ${S.ano}. Os números do mês abaixo são do ano atual; troque o ano na tela Caixa.</div>` : ''}

  <div class="indicadores">
    <div class="indicador clicavel" data-acao="ir" data-tela="caixa"><div class="rotulo">Entradas de ${MESES[mes]}</div><div class="valor pos">${moeda(c.entradas)}</div></div>
    <div class="indicador clicavel" data-acao="ir" data-tela="caixa"><div class="rotulo">Saídas de ${MESES[mes]}</div><div class="valor neg">${moeda(c.saidas)}</div></div>
    <div class="indicador clicavel" data-acao="ir" data-tela="caixa"><div class="rotulo">Resultado do mês</div><div class="valor ${c.resultado >= 0 ? 'pos' : 'neg'}">${moeda(c.resultado)}</div></div>
    <div class="indicador clicavel" data-acao="ir" data-tela="orcamentos"><div class="rotulo">Orçamentos em aberto</div><div class="valor">${pend.length}</div><div class="detalhe">${moeda(valorPend)}</div></div>
  </div>

  ${meta > 0 ? (() => { const p = Math.min(100, Math.round(c.entradas / meta * 100)); return `
  <div class="caixa" style="margin-bottom:14px">
    <div class="caixa-titulo"><h2>Meta de ${MESES[mes]}</h2><span class="mono">${p}% · ${moeda(c.entradas)} de ${moeda(meta)}</span></div>
    <div class="progresso"><div style="width:${p}%"></div></div>
  </div>`; })() : ''}

  ${anoAtual && faltamFixas(mes) && S.config.fixasIgnoradas !== `${S.ano}-${mes}` ? `<div class="faixa" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
    <span style="flex:1">${MESES[mes]} ainda não tem as contas fixas lançadas. Copiar as de ${MESES[(mes + 11) % 12]}?</span>
    <button class="btn btn-p btn-fantasma" data-acao="ignorar-fixas">Agora não</button><button class="btn btn-p btn-primario" data-acao="copiar-fixas-inicio">Copiar fixas</button></div>` : ''}

  ${avisos.length ? `<div style="margin-bottom:14px">${avisos.map(a => `<div class="alerta" data-acao="ir" data-tela="${a.tela}" ${a.p ? `data-p="${a.p}"` : ''}><span class="ponto ${a.neg ? 'neg' : ''}"></span><span style="flex:1">${a.txt}</span><span class="mudo">Ver</span></div>`).join('')}</div>` : ''}

  <div class="caixa">
    <div class="caixa-titulo"><h2>Últimos 6 meses</h2>
      <div class="legenda"><span><i style="background:var(--positivo)"></i>Entradas</span><span><i style="background:var(--negativo)"></i>Saídas</span></div></div>
    ${grafico()}
  </div>
  ${anoAtual ? comparativoHTML(mes) : ''}`;
}

// inverso: para saídas, subir é ruim (vermelho) e cair é bom (verde)
const varia = (a, b, inverso) => {
  if (!b) return '<span class="mudo">—</span>';
  const p = Math.round((a - b) / Math.abs(b) * 100);
  return `<span class="${(p >= 0) !== !!inverso ? 'pos' : 'neg'}">${p >= 0 ? '+' : ''}${p}%</span>`;
};
function comparativoHTML(m) {
  const c = comparativo(m), mAnt = (m + 11) % 12;
  const col = (r, v) => v ? `<td class="mono">${moeda(v[r])}</td>` : '<td class="mudo">sem dados</td>';
  const linha = (rot, r) => `<tr><td>${rot}</td><td class="mono"><b>${moeda(c.atual[r])}</b></td>${col(r, c.anterior)}<td>${c.anterior ? varia(c.atual[r], c.anterior[r], r === 'saidas') : ''}</td>${col(r, c.anoPassado)}<td>${c.anoPassado ? varia(c.atual[r], c.anoPassado[r], r === 'saidas') : ''}</td></tr>`;
  const tot = c.pecas + c.mao, top = servicosQueMaisRendem();
  return `
  <div class="caixa" style="margin-top:14px">
    <div class="caixa-titulo"><h2>Comparativo</h2><span class="mudo" style="font-size:.8rem">${MESES[m]} até hoje</span></div>
    <div style="overflow-x:auto"><table class="tabela">
      <thead><tr><th></th><th>${MESES[m]}</th><th>${MESES[mAnt]}</th><th></th><th>${MESES[m]} ${S.ano - 1}</th><th></th></tr></thead>
      <tbody>${linha('Entradas', 'entradas')}${linha('Saídas', 'saidas')}${linha('Resultado', 'resultado')}</tbody>
    </table></div>
    ${tot ? `<div style="margin-top:14px"><div class="mudo" style="font-size:.8rem;margin-bottom:6px">Orçamentos aceitos em ${MESES[m]} (${c.qtd}): de onde veio o valor</div>
      <div class="progresso dupla"><div style="width:${Math.round(c.mao / tot * 100)}%"></div></div>
      <div class="legenda" style="margin-top:6px"><span><i style="background:var(--texto)"></i>Mão de obra ${moeda(c.mao)} (${Math.round(c.mao / tot * 100)}%)</span><span><i style="background:var(--borda-forte)"></i>Peças ${moeda(c.pecas)}</span></div></div>` : ''}
    ${top.length ? `<div style="margin-top:16px"><div class="mudo" style="font-size:.8rem;margin-bottom:6px">Serviços que mais faturaram em ${S.ano} (mão de obra, orçamentos aceitos)</div>
      <div class="lista">${top.map(t => `<div class="linha"><div class="principal"><div class="titulo">${esc(t.nome)}</div><div class="meta">${t.vezes} vez(es)</div></div><div class="valor">${moeda(t.total)}</div></div>`).join('')}</div></div>` : ''}
  </div>`;
}

export const acoes = {
  'copiar-fixas-inicio': () => {
    const r = copiarFixas(new Date().getMonth());
    if (r.erro) return erro(r.erro);
    aviso(r.n ? r.n + ' conta(s) fixa(s) copiada(s)' : 'As contas fixas já estão neste mês.'); window.zlDesenhar();
  },
  'ignorar-fixas': async () => { await salvarConfig({ fixasIgnoradas: `${S.ano}-${new Date().getMonth()}` }); window.zlDesenhar(); },
};

function grafico() {
  const hoje = new Date();
  const pontos = [];
  for (let i = 5; i >= 0; i--) {
    let m = hoje.getMonth() - i, base = S.dados, ano = S.ano;
    if (m < 0) { m += 12; base = S.dadosAnoAnterior; ano = S.ano - 1; }
    const c = base ? calcMes(m, base) : { entradas: 0, saidas: 0, resultado: 0 };
    pontos.push({ rot: MESES_CURTO[m], ...c });
  }
  const max = Math.max(1, ...pontos.map(p => Math.max(p.entradas, p.saidas)));
  const W = 640, H = 200, E = 8, B = 28, larg = (W - E * 2) / 6, bw = Math.min(26, larg / 3);
  const y = v => H - B - (v / max) * (H - B - 16);
  const barras = pontos.map((p, i) => {
    const x = E + i * larg + larg / 2;
    return `<rect x="${x - bw - 2}" y="${y(p.entradas)}" width="${bw}" height="${H - B - y(p.entradas)}" rx="3" fill="var(--positivo)" opacity=".85"><title>${p.rot}: entradas ${moeda(p.entradas)}</title></rect>
      <rect x="${x + 2}" y="${y(p.saidas)}" width="${bw}" height="${H - B - y(p.saidas)}" rx="3" fill="var(--negativo)" opacity=".85"><title>${p.rot}: saídas ${moeda(p.saidas)}</title></rect>
      <text x="${x}" y="${H - 10}" text-anchor="middle" fill="var(--texto-3)" font-size="12">${p.rot}</text>
      <text x="${x}" y="${Math.min(y(p.entradas), y(p.saidas)) - 5}" text-anchor="middle" fill="${p.resultado >= 0 ? 'var(--texto-2)' : 'var(--negativo)'}" font-size="10.5">${p.entradas || p.saidas ? moedaCurta(p.resultado) : ''}</text>`;
  }).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}"><line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" stroke="var(--borda)"/>${barras}</svg>
    <div class="mudo" style="font-size:.75rem;margin-top:6px">O número acima de cada mês é o resultado (entradas menos saídas).</div>`;
}

