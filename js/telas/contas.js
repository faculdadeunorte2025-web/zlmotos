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
  const situ = c => c.vencimento < hoje ? `<span class="neg">Venceu em ${dataBR(c.vencimento)}</span>` : c.vencimento === hoje ? '<span class="neg">Vence hoje</span>' : 'Vence em ' + dataBR(c.vencimento);
  return `
  <div class="cabecalho">
    <div><h1>Contas a pagar</h1><div class="sub">${pend.length} pendente(s)</div></div>
    <div class="acoes"><button class="btn btn-primario" data-acao="nova-conta">${icone('mais')} Nova conta</button></div>
  </div>
  <div class="indicadores">
    <div class="indicador"><div class="rotulo">Vencidas</div><div class="valor ${vencidas.length ? 'neg' : ''}">${vencidas.length}</div><div class="detalhe">${moeda(vencidas.reduce((s, c) => s + num(c.valor), 0))}</div></div>
    <div class="indicador"><div class="rotulo">Vencem em até 2 dias</div><div class="valor">${breve.length}</div></div>
    <div class="indicador"><div class="rotulo">Total pendente</div><div class="valor">${moeda(pend.reduce((s, c) => s + num(c.valor), 0))}</div></div>
  </div>
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
