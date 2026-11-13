// Contas a pagar.
import { S, salvarContas, salvarLancamentos } from '../dados.js';
import { MESES, moeda, num, esc, hojeISO, somaDias, dataBR, gerarId, horaAgora, abrirModal, fecharModal, confirmar, aviso, erro, icone, lerForm } from '../util.js';

const REPETE = { unica: 'Única', mensal: 'Mensal', semanal: 'Semanal', anual: 'Anual' };
const repete = c => c.recorrencia === 'mensal' || c.recorrencia === 'semanal' || c.recorrencia === 'anual';

// Próximo vencimento (31/01 + 1 mês = 28/02, não 03/03)
function proximo(venc, rec) {
  const [a, m, d] = venc.split('-').map(Number);
  if (rec === 'semanal') return somaDias(7, new Date(a, m - 1, d));
  let ano = a, mes = m - 1;
  if (rec === 'mensal') { mes++; if (mes > 11) { mes = 0; ano++; } }
  if (rec === 'anual') ano++;
  const ult = new Date(ano, mes + 1, 0).getDate();
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
}

export function tela() {
  const hoje = hojeISO(), lim = somaDias(2);
  const pend = S.contas.filter(c => c.status !== 'pago').sort((a, b) => String(a.vencimento || '').localeCompare(String(b.vencimento || '')));
  const pagas = S.contas.filter(c => c.status === 'pago').sort((a, b) => String(b.pagoEm || '').localeCompare(String(a.pagoEm || ''))).slice(0, 15);
  const vencidas = pend.filter(c => c.vencimento < hoje);
  const breve = pend.filter(c => c.vencimento >= hoje && c.vencimento <= lim);
  const rsM = window.zlSocorro, rsAberto = rsM && rsM.RS.estado === 'ok' ? rsM.totalAbertoSocorro() : 0;
  const situ = c => c.vencimento < hoje ? `<span class="neg">Venceu em ${dataBR(c.vencimento)}</span>` : c.vencimento === hoje ? '<span class="neg">Vence hoje</span>' : 'Vence em ' + dataBR(c.vencimento);
  return `
  <div class="cabecalho">
    <div><h1>Contas a pagar</h1><div class="sub">${pend.length} pendente(s)${rsAberto ? ` + ${rsM.abertasSocorro().length} corrida(s) do RS Socorro` : ''}</div></div>
    <div class="acoes"><button class="btn btn-primario" data-acao="nova-conta">${icone('mais')} Nova conta</button></div>
  </div>
  <div class="indicadores">
    <div class="indicador"><div class="rotulo">Vencidas</div><div class="valor ${vencidas.length ? 'neg' : ''}">${vencidas.length}</div><div class="detalhe">${moeda(vencidas.reduce((s, c) => s + num(c.valor), 0))}</div></div>
    <div class="indicador"><div class="rotulo">Vencem em até 2 dias</div><div class="valor">${breve.length}</div></div>
    <div class="indicador"><div class="rotulo">Total pendente</div><div class="valor">${moeda(pend.reduce((s, c) => s + num(c.valor), 0) + rsAberto)}</div>${rsAberto ? `<div class="detalhe">inclui ${moeda(rsAberto)} do RS Socorro</div>` : ''}</div>
  </div>
  ${secaoSocorro()}
  <div class="caixa"><div class="lista">
    ${pend.length ? pend.map(c => `
      <div class="linha">
        <div class="principal clicavel" data-acao="editar-conta" data-id="${esc(c.id)}"><div class="titulo">${esc(c.nome)}</div>
          <div class="meta">${situ(c)} · ${REPETE[c.recorrencia] || 'Única'}${c.obs ? ' · ' + esc(c.obs) : ''}</div></div>
        <div class="valor">${c.valor ? moeda(c.valor) : '—'}</div>
        <button class="btn btn-p" data-acao="pagar-conta" data-id="${esc(c.id)}">Pagar</button>
      </div>`).join('') : '<div class="vazio">Nenhuma conta pendente.</div>'}
  </div></div>
  ${pagas.length ? `<div class="caixa"><div class="caixa-titulo"><h2>Pagas recentemente</h2></div><div class="lista">
    ${pagas.map(c => `<div class="linha"><div class="principal"><div class="titulo mudo">${esc(c.nome)}</div><div class="meta">Paga em ${dataBR(c.dataPago || c.pagoEm)}</div></div>
      <div class="valor mudo">${c.valor ? moeda(c.valor) : '—'}</div><button class="btn btn-p btn-fantasma" data-acao="desfazer-conta" data-id="${esc(c.id)}">Desfazer</button></div>`).join('')}
  </div></div>` : ''}`;
}

// ── RS Socorro: corridas que o socorrista trouxe para a ZL ──────────
const dataMs = ms => ms ? new Date(ms).toLocaleDateString('pt-BR') : '—';
function secaoSocorro() {
  const M = window.zlSocorro; if (!M) return '';
  const { RS } = M, link = `<a class="btn btn-p btn-fantasma" href="${M.PAINEL_URL}" target="_blank" rel="noopener">Abrir painel do RS Socorro</a>`;
  if (RS.estado === 'carregando') return '';
  if (RS.estado === 'desligado') return `<div class="caixa"><div class="caixa-titulo"><h2>RS Socorro</h2>${link}</div>
    <p class="mudo" style="margin:0 0 10px;font-size:.85rem">Conecte uma vez neste aparelho para ver aqui as corridas trazidas para a ZL e pagar por elas.</p>
    <div class="acoes"><input type="password" id="rs-pin" inputmode="numeric" autocomplete="off" placeholder="PIN do painel (usuário jean)" style="max-width:240px"><button class="btn btn-primario" data-acao="rs-entrar">Conectar</button></div></div>`;
  if (RS.estado === 'erro') return `<div class="caixa"><div class="caixa-titulo"><h2>RS Socorro</h2>${link}</div><p class="neg" style="margin:0">${esc(RS.erro)}</p>
    <div class="acoes" style="margin-top:10px"><button class="btn btn-p" data-acao="rs-sair">Desconectar</button></div></div>`;
  const ab = M.abertasSocorro(), pagas = RS.lista.filter(c => c.pago).sort((a, b) => (b.pagoEm || 0) - (a.pagoEm || 0)).slice(0, 15);
  const meta = c => [dataMs(c.criadoEm), c.nome, c.km ? c.km + ' km' : ''].filter(Boolean).map(esc).join(' · ');
  const valor = c => `<div class="valor">${moeda(c.valorFinal)}${num(c.descontoPct) ? `<div class="mudo" style="font-size:.72rem;font-weight:400">${moeda(c.valor)} − ${num(c.descontoPct)}%</div>` : ''}</div>`;
  return `<div class="caixa">
    <div class="caixa-titulo"><h2>RS Socorro <span class="mudo" style="font-weight:400;font-size:.85rem">· ${ab.length} moto(s) em aberto · <b class="${ab.length ? 'neg' : ''}">${moeda(M.totalAbertoSocorro())}</b></span></h2>${link}</div>
    <div class="lista">${ab.length ? ab.map(c => `<div class="linha">
      <div class="principal"><div class="titulo">${esc(c.placa || '—')} <span class="mudo" style="font-weight:400">${esc(c.moto || '')}</span></div><div class="meta">${meta(c)}</div></div>
      ${valor(c)}<button class="btn btn-p" data-acao="rs-pagar" data-id="${esc(c.id)}">Pagar</button></div>`).join('') : '<div class="vazio">Nenhuma corrida em aberto.</div>'}</div>
    ${pagas.length ? `<details style="margin-top:10px"><summary class="mudo" style="cursor:pointer;font-size:.85rem">Pagas recentemente (${pagas.length})</summary><div class="lista">
      ${pagas.map(c => `<div class="linha"><div class="principal"><div class="titulo mudo">${esc(c.placa || '—')} ${esc(c.moto || '')}</div><div class="meta">Paga em ${dataMs(c.pagoEm)}</div></div>
      <div class="valor mudo">${moeda(c.valorFinal)}</div><button class="btn btn-p btn-fantasma" data-acao="rs-desfazer" data-id="${esc(c.id)}">Desfazer</button></div>`).join('')}</div></details>` : ''}
    <div class="acoes" style="margin-top:10px"><button class="btn btn-p btn-fantasma" data-acao="rs-sair" style="margin-left:auto">Desconectar do RS Socorro</button></div>
  </div>`;
}

function modalConta(c = {}) {
  const cats = ['Fixo'].concat(S.categorias.filter(x => x !== 'Fixo'));
  abrirModal({
    titulo: c.id ? 'Editar conta' : 'Nova conta a pagar',
    corpo: `<label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(c.nome || '')}" placeholder="Ex: Aluguel"></label>
      <div class="grade g2">
        <label class="campo"><span>Valor (R$)</span><input type="number" name="valor" min="0" step="0.01" value="${esc(c.valor || '')}"></label>
        <label class="campo"><span>Vencimento</span><input type="date" name="vencimento" value="${esc(c.vencimento || '')}"></label>
        <label class="campo"><span>Repetir</span><select name="recorrencia">${Object.entries(REPETE).map(([k, v]) => `<option value="${k}" ${(c.recorrencia || 'unica') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="campo"><span>Categoria da saída</span><select name="categoria">${cats.map(x => `<option ${(c.categoria || 'Fixo') === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span>Observação</span><input type="text" name="obs" value="${esc(c.obs || '')}"></label>
      <input type="hidden" name="id" value="${esc(c.id || '')}">`,
    rodape: `${c.id ? `<button class="btn btn-perigo" data-acao="excluir-conta" data-id="${esc(c.id)}">${icone('lixo')} Excluir</button>` : ''}
      <div class="direita"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" data-acao="salvar-conta">Salvar</button></div>`
  });
}

export const acoes = {
  'rs-entrar': async () => {
    const M = window.zlSocorro, el = document.getElementById('rs-pin'), pin = el && el.value.trim();
    if (!M || !pin) return;
    try { await M.entrarSocorro(pin); el.value = ''; aviso('Conectado ao RS Socorro'); }
    catch (e) { erro('PIN incorreto ou sem internet.'); }
  },
  'rs-sair': async () => { if (await confirmar('Desconectar do RS Socorro neste aparelho?', { botao: 'Desconectar' })) { await window.zlSocorro.sairSocorro(); window.zlDesenhar(); } },
  'rs-pagar': async el => {
    const M = window.zlSocorro, c = M && M.RS.lista.find(x => x.id === el.dataset.id); if (!c) return;
    const agora = new Date();
    if (S.ano !== agora.getFullYear()) return erro(`O Caixa está em ${S.ano}. Volte para ${agora.getFullYear()} para lançar o pagamento.`);
    if (!S.carregado) return erro('Aguarde os dados carregarem.');
    if (!(await confirmar(`Pagar a corrida da moto ${esc(c.placa || '')} (${moeda(c.valorFinal)})? Ela fica marcada como paga no RS Socorro e a saída é lançada no Caixa de hoje.`, { botao: 'Pagar' }))) return;
    try { await M.marcarPagoSocorro(c.id, true); } catch (e) { return erro('Não foi possível marcar no RS Socorro. Verifique a internet.'); }
    S.dados[agora.getMonth()].variaveis.push({ data: hojeISO(), hora: horaAgora(), desc: `RS Socorro — ${c.placa || ''} ${c.moto || ''}`.trim(), valor: String(num(c.valorFinal).toFixed(2)), cat: 'Socorro', formaPgto: '', pago: true, _socorroId: c.id, _id: gerarId('v') });
    salvarLancamentos(); aviso('Corrida paga. Saída lançada em ' + MESES[agora.getMonth()] + '.'); window.zlDesenhar();
  },
  'rs-desfazer': async el => {
    const M = window.zlSocorro, c = M && M.RS.lista.find(x => x.id === el.dataset.id); if (!c) return;
    if (!(await confirmar(`Desfazer o pagamento da moto ${esc(c.placa || '')}? Ela volta a ficar em aberto no RS Socorro e a saída sai do Caixa.`, { botao: 'Desfazer' }))) return;
    try { await M.marcarPagoSocorro(c.id, false); } catch (e) { return erro('Não foi possível desmarcar no RS Socorro.'); }
    let removeu = false;
    Object.values(S.dados).forEach(d => { const i = (d.variaveis || []).findIndex(v => v._socorroId === c.id); if (i >= 0) { d.variaveis.splice(i, 1); removeu = true; } });
    if (removeu) salvarLancamentos();
    aviso('Pagamento desfeito'); window.zlDesenhar();
  },
  'nova-conta': () => modalConta(),
  'editar-conta': el => modalConta(S.contas.find(c => c.id === el.dataset.id)),
  'salvar-conta': async () => {
    const f = lerForm(document.querySelector('.modal'));
    if (!f.nome.trim()) return erro('Informe o nome.');
    if (!f.vencimento) return erro('Informe o vencimento.');
    const dados = { nome: f.nome.trim(), valor: f.valor, vencimento: f.vencimento, recorrencia: f.recorrencia, categoria: f.categoria, obs: f.obs.trim() };
    if (f.id) Object.assign(S.contas.find(c => c.id === f.id), dados);
    else S.contas.push({ id: gerarId('cp'), ...dados, status: 'pendente', criadoEm: new Date().toISOString() });
    await salvarContas(); fecharModal(); aviso(f.id ? 'Conta atualizada' : 'Conta adicionada'); window.zlDesenhar();
  },
  'excluir-conta': async el => {
    const c = S.contas.find(x => x.id === el.dataset.id); if (!c) return;
    if (!(await confirmar(`Excluir a conta "${esc(c.nome)}"?`, { botao: 'Excluir', perigo: true }))) return;
    S.contas = S.contas.filter(x => x.id !== c.id); await salvarContas(); aviso('Conta excluída'); window.zlDesenhar();
  },
  'pagar-conta': async el => {
    const c = S.contas.find(x => x.id === el.dataset.id); if (!c) return;
    if (!(num(c.valor) > 0)) { erro('Essa conta está sem valor. Edite e informe o valor.'); return modalConta(c); }
    const agora = new Date();
    if (S.ano !== agora.getFullYear()) return erro(`O Caixa está em ${S.ano}. Volte para ${agora.getFullYear()} para lançar o pagamento no mês de hoje.`);
    if (!S.carregado) return erro('Aguarde os dados carregarem.');
    if (!(await confirmar(`Marcar "${esc(c.nome)}" (${moeda(c.valor)}) como paga? A saída será lançada no Caixa de hoje.`, { botao: 'Pagar' }))) return;
    c.status = 'pago'; c.pagoEm = agora.toISOString(); c.dataPago = hojeISO();
    if (repete(c)) {
      const p = { ...c, id: gerarId('cp'), status: 'pendente', vencimento: proximo(c.vencimento, c.recorrencia) };
      delete p.pagoEm; delete p.dataPago; delete p.proximaId;
      S.contas.push(p); c.proximaId = p.id;
    }
    S.dados[agora.getMonth()].variaveis.push({ data: hojeISO(), hora: horaAgora(), desc: c.nome + (c.obs ? ' (' + c.obs + ')' : ''), valor: c.valor, cat: c.categoria || 'Fixo', formaPgto: '', pago: true, _contaPagarId: c.id, _id: gerarId('v') });
    salvarLancamentos(); await salvarContas();
    aviso('Paga. Saída lançada em ' + MESES[agora.getMonth()] + '.'); window.zlDesenhar();
  },
  'desfazer-conta': async el => {
    const c = S.contas.find(x => x.id === el.dataset.id); if (!c) return;
    if (!(await confirmar(`Desfazer o pagamento de "${esc(c.nome)}"? A saída lançada no Caixa também será removida.`, { botao: 'Desfazer' }))) return;
    let removeu = false;
    Object.values(S.dados).forEach(d => { const i = (d.variaveis || []).findIndex(v => v._contaPagarId === c.id); if (i >= 0) { d.variaveis.splice(i, 1); removeu = true; } });
    if (c.proximaId) { const p = S.contas.find(x => x.id === c.proximaId); if (p && p.status !== 'pago') S.contas = S.contas.filter(x => x.id !== c.proximaId); }
    c.status = 'pendente'; delete c.pagoEm; delete c.dataPago; delete c.proximaId;
    if (removeu) salvarLancamentos();
    await salvarContas(); aviso(removeu ? 'Pagamento desfeito' : 'Pagamento desfeito (a saída não estava no ano aberto)'); window.zlDesenhar();
  },
};
