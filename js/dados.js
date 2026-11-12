// Estado do sistema + carregar/salvar no Firebase.
// O formato dos dados no Firebase é o MESMO do sistema antigo
// (só os orçamentos passaram a ficar um por documento).
import { docUsuario, colUsuario, docColecao, gravar, ler, escutar, gravarDireto, deleteDoc, escutarDireto, salvamento, registrarLog } from './firebase.js';
import { num, hojeISO, copia, gerarId } from './util.js';

export const FIXOS_PADRAO = ['Água', 'Luz', 'Aluguel', 'Contador', 'Sistema de Vendas', 'Sistema de Alarme'];
export const CATEGORIAS_PADRAO = ['Peça', 'Serviço', 'Imposto', 'Combustível', 'Funcionário', 'Outros'];

export const S = {
  ano: new Date().getFullYear(),
  mes: new Date().getMonth(),
  dados: {},               // { 0..11: { fixos:[], variaveis:[], entradas:[], obs:'' } }
  dadosAnoAnterior: null,
  carregado: false,        // lançamentos do ano vieram do servidor?
  orcamentos: [],
  clientes: [],
  contas: [],
  categorias: CATEGORIAS_PADRAO.slice(),
  config: {},              // config_geral (metaMensal, ...)
  empresa: {},             // empresa_config.dados
};

let aoMudar = () => {};
export const quandoMudar = fn => { aoMudar = fn; };
const avisar = (o) => { try { aoMudar(o); } catch (e) { console.error(e); } };

// ── Cálculos ────────────────────────────────────────────────────────
// Saídas fixas = lista "fixos" + saídas variáveis da categoria "Fixo".
// Valores divididos em 2 formas de pagamento (valor2) entram no total.
export function calcMes(m, base = S.dados) {
  const d = base && base[m];
  if (!d) return { entradas: 0, fixas: 0, variaveis: 0, saidas: 0, resultado: 0 };
  const v = x => num(x.valor) + num(x.valor2);
  const fixas = (d.fixos || []).reduce((s, f) => s + num(f.valor), 0)
              + (d.variaveis || []).filter(x => x.cat === 'Fixo').reduce((s, x) => s + v(x), 0);
  const variaveis = (d.variaveis || []).filter(x => x.cat !== 'Fixo').reduce((s, x) => s + v(x), 0);
  const entradas = (d.entradas || []).reduce((s, x) => s + v(x), 0);
  return { entradas, fixas, variaveis, saidas: fixas + variaveis, resultado: entradas - fixas - variaveis };
}

export function totalOrcamento(o) {
  const sub = (o.itens || []).reduce((s, it) => s + num(it.qtd) * num(it.vunit), 0);
  const desc = o.descTipo === 'percentual' ? sub * num(o.descValor) / 100 : num(o.descValor);
  const total = Math.max(0, sub - desc - num(o.descFidelidade));
  return { subtotal: sub, desconto: sub - total, total };
}
export const orcAceito = o => o.status === 'aceito' || o.status === 'aprovado';
export const orcRecusado = o => o.status === 'recusado' || o.status === 'reprovado';

// Garante 12 meses com todas as listas (um mês incompleto travava o sistema antigo)
export function garantirMeses(d = S.dados) {
  for (let m = 0; m < 12; m++) {
    if (!d[m] || typeof d[m] !== 'object') { d[m] = { fixos: FIXOS_PADRAO.map(n => ({ nome: n, valor: '', data: '', pago: false })), variaveis: [], entradas: [], obs: '' }; continue; }
    ['fixos', 'variaveis', 'entradas'].forEach(k => { if (!Array.isArray(d[m][k])) d[m][k] = []; d[m][k] = d[m][k].filter(Boolean); });
    if (typeof d[m].obs !== 'string') d[m].obs = d[m].obs ? String(d[m].obs) : '';
  }
  return d;
}

// ── Carregamento ────────────────────────────────────────────────────
const desligar = [];
let anoDesligar = null;
let timerSalvar = null;
let migrou = false;

async function lerDoc(chave) {
  try { const s = await ler(docUsuario(chave)); return { ok: true, dados: s.exists() ? s.data() : null }; }
  catch (e) { console.warn('Falha ao ler', chave, e); return { ok: false }; }
}

export async function carregarTudo() {
  migrou = false;
  const [cfg, emp, cat, contas] = await Promise.all([lerDoc('config_geral'), lerDoc('empresa_config'), lerDoc('categorias_mes'), lerDoc('contas_pagar')]);
  S.config = (cfg.dados) || {};
  S.empresa = (emp.dados && emp.dados.dados) || {};
  if (cat.dados && Array.isArray(cat.dados.lista) && cat.dados.lista.length) S.categorias = cat.dados.lista;
  S.contas = (contas.dados && contas.dados.lista) || [];
  await carregarAno(S.ano);

  // Tempo real: contas, clientes e orçamentos
  desligar.push(escutar(docUsuario('contas_pagar'), snap => {
    if (snap.metadata && snap.metadata.hasPendingWrites) return;
    if (snap.exists()) { S.contas = snap.data().lista || []; avisar('contas'); }
  }));
  desligar.push(escutarDireto(colUsuario('clientes'), snap => {
    S.clientes = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.excluido);
    avisar('clientes');
  }, e => console.warn('clientes', e)));
  desligar.push(escutarDireto(colUsuario('orcamentos'), snap => {
    S.orcamentos = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    S.orcamentos.sort((a, b) => String(b.criadoEm || b.data || '').localeCompare(String(a.criadoEm || a.data || '')));
    avisar('orcamentos');
    if (!migrou) { migrou = true; migrarOrcamentos(new Set(S.orcamentos.map(o => o.id))); }
  }, e => console.warn('orcamentos', e)));
}

async function carregarAno(ano) {
  S.carregado = false;
  S.ano = ano;
  if (anoDesligar) { anoDesligar(); anoDesligar = null; }
  const r = await lerDoc('zlmotos_' + ano);
  if (r.ok) {
    S.dados = garantirMeses((r.dados && r.dados.dados) || {});
    S.carregado = true;
  } else {
    S.dados = garantirMeses({});
    setTimeout(() => { if (!S.carregado && S.ano === ano) carregarAno(ano).then(() => avisar('dados')); }, 15000);
  }
  const ant = await lerDoc('zlmotos_' + (ano - 1));
  S.dadosAnoAnterior = ant.ok && ant.dados ? garantirMeses(ant.dados.dados || {}) : null;
  // Tempo real dos lançamentos (um aparelho vê o que o outro lança)
  anoDesligar = escutar(docUsuario('zlmotos_' + ano), snap => {
    if (snap.metadata && snap.metadata.hasPendingWrites) return;
    if (!snap.exists() || S.ano !== ano || timerSalvar) return;
    const remoto = snap.data().dados || {};
    if (JSON.stringify(remoto) === JSON.stringify(S.dados)) return;
    S.dados = garantirMeses(copia(remoto));
    S.carregado = true;
    avisar('dados');
  });
  avisar('dados');
}

export async function trocarAno(ano) {
  await salvarAgora();
  await carregarAno(ano);
}

export function pararTudo() {
  desligar.splice(0).forEach(f => { try { f(); } catch (e) {} });
  if (anoDesligar) { anoDesligar(); anoDesligar = null; }
  clearTimeout(timerSalvar); timerSalvar = null;
  salvamento.limpar();
  Object.assign(S, { dados: {}, carregado: false, orcamentos: [], clientes: [], contas: [], config: {}, empresa: {} });
}

// ── Lançamentos ─────────────────────────────────────────────────────
let aoSalvar = () => {};
export const quandoSalvar = fn => { aoSalvar = fn; };

export function salvarLancamentos() {
  if (!S.carregado) return false;   // nunca grava por cima sem ter carregado
  clearTimeout(timerSalvar);
  aoSalvar('salvando');
  timerSalvar = setTimeout(salvarAgora, 600);
  return true;
}
export async function salvarAgora() {
  if (!timerSalvar) return;
  clearTimeout(timerSalvar); timerSalvar = null;
  try {
    await gravar(docUsuario('zlmotos_' + S.ano), { dados: S.dados, atualizadoEm: new Date().toISOString() });
    aoSalvar(salvamento.pendentes() ? 'pendente' : 'salvo');
  } catch (e) { console.error(e); aoSalvar('erro'); }
}
window._aposJuntarDados = () => { garantirMeses(); avisar('dados'); };

// ── Orçamentos (um documento por orçamento) ─────────────────────────
export async function salvarOrcamento(o) {
  if (!o.id) o.id = gerarId('orc');
  o.calc = totalOrcamento(o);
  o.atualizadoEm = new Date().toISOString();
  if (!o.criadoEm) o.criadoEm = o.atualizadoEm;
  const i = S.orcamentos.findIndex(x => x.id === o.id);
  if (i >= 0) S.orcamentos[i] = o; else S.orcamentos.unshift(o);
  await gravarDireto(docColecao('orcamentos', o.id), copia(o));
  return o;
}
export async function excluirOrcamento(id) {
  S.orcamentos = S.orcamentos.filter(o => o.id !== id);
  await deleteDoc(docColecao('orcamentos', id));
  // lembra que foi excluído para a migração não trazer de volta da lista antiga
  const exc = Array.from(new Set([...(S.config.orcExcluidos || []), id]));
  await salvarConfig({ orcExcluidos: exc });
  registrarLog('ORCAMENTO_EXCLUIDO', { id });
}

// Migração: copia orçamentos da lista antiga (um documento só) para a coleção.
// A lista antiga NÃO é apagada, e é feita uma cópia de segurança antes.
function idLegado(o) {
  if (o.id) return String(o.id).replace(/\//g, '_');
  let h = 5381; const s = JSON.stringify(o);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'orc_legado_' + (h >>> 0).toString(36);
}
async function migrarOrcamentos(idsColecao) {
  try {
    const r = await lerDoc('orcamentos_lista');
    const lista = (r.dados && r.dados.lista) || [];
    if (!lista.length) return;
    const exc = new Set(S.config.orcExcluidos || []);
    const faltando = lista.filter(o => o && !idsColecao.has(idLegado(o)) && !exc.has(idLegado(o)));
    if (!faltando.length) return;
    if (!S.config.orcBackupFeito) {
      await gravarDireto(docUsuario('backup_orcamentos_lista_' + hojeISO()), r.dados);
      await salvarConfig({ orcBackupFeito: hojeISO() });
    }
    for (const o of faltando) {
      const novo = { ...o, id: idLegado(o) };
      if (!novo.calc || !(novo.calc.total >= 0)) novo.calc = totalOrcamento(novo);
      await gravarDireto(docColecao('orcamentos', novo.id), copia(novo));
    }
    console.info('ZL Motos: ' + faltando.length + ' orçamento(s) migrados para a nova estrutura.');
  } catch (e) { console.error('Migração de orçamentos:', e); }
}

// ── Clientes (um documento por cliente) ─────────────────────────────
export async function salvarCliente(c) {
  if (!c.id) { c.id = gerarId('cli'); c.criadoEm = new Date().toISOString(); }
  const i = S.clientes.findIndex(x => x.id === c.id);
  if (i >= 0) S.clientes[i] = c; else S.clientes.push(c);
  await gravarDireto(docColecao('clientes', c.id), copia(c));
  return c;
}
export async function excluirCliente(id) {
  S.clientes = S.clientes.filter(c => c.id !== id);
  await deleteDoc(docColecao('clientes', id));
}

// ── Contas a pagar, configurações, empresa, categorias ──────────────
export async function salvarContas() {
  await gravar(docUsuario('contas_pagar'), { lista: S.contas, atualizadoEm: new Date().toISOString() });
}
export async function salvarConfig(parcial) {
  Object.assign(S.config, parcial);
  await gravarDireto(docUsuario('config_geral'), { ...parcial, atualizadoEm: new Date().toISOString() }, { merge: true });
}
export async function salvarEmpresa() {
  await gravarDireto(docUsuario('empresa_config'), { dados: S.empresa, atualizadoEm: new Date().toISOString() }, { merge: true });
}
export async function salvarCategorias() {
  await gravar(docUsuario('categorias_mes'), { lista: S.categorias, atualizadoEm: new Date().toISOString() });
}
