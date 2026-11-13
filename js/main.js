// Início do sistema: login, menu, navegação entre telas e cliques.
import { auth, entrar, sair, onAuthStateChanged, salvamento } from './firebase.js';
import { S, carregarTudo, pararTudo, quandoMudar, quandoSalvar, salvarAgora, calcMes } from './dados.js';
import { icone, esc, aviso, erro, fecharModal, hojeISO, somaDias } from './util.js';
import * as inicio from './telas/inicio.js';
import * as caixa from './telas/caixa.js';
import * as orcamentos from './telas/orcamentos.js';
import * as clientes from './telas/clientes.js';
import * as contas from './telas/contas.js';
import * as ajustes from './telas/ajustes.js';
import * as busca from './telas/busca.js';

const TELAS = {
  inicio:     { nome: 'Início',     icone: 'inicio',     mod: inicio },
  caixa:      { nome: 'Caixa',      icone: 'caixa',      mod: caixa },
  orcamentos: { nome: 'Orçamentos', icone: 'orcamentos', mod: orcamentos },
  clientes:   { nome: 'Clientes',   icone: 'clientes',   mod: clientes },
  contas:     { nome: 'Contas a pagar', curto: 'Contas', icone: 'contas', mod: contas },
  ajustes:    { nome: 'Ajustes',    icone: 'ajustes',    mod: ajustes },
};
let atual = 'inicio';
let param = null;

// ── Navegação ───────────────────────────────────────────────────────
export function ir(tela, p = null) {
  if (!TELAS[tela]) tela = 'inicio';
  atual = tela; param = p;
  if (location.hash !== '#' + tela) history.replaceState(null, '', '#' + tela);
  desenhar();
  window.scrollTo(0, 0);
}
window.zlIr = ir;

function contasVencendo() {
  const lim = somaDias(2);
  return S.contas.filter(c => c.status !== 'pago' && c.vencimento && c.vencimento <= lim).length;
}

function desenharMenu() {
  const n = contasVencendo();
  const item = (k, t, curto) => `<button class="menu-item ${atual === k ? 'ativo' : ''}" data-acao="ir" data-tela="${k}">
      ${icone(t.icone)}<span>${curto ? (t.curto || t.nome) : t.nome}</span>${k === 'contas' && n ? `<b class="contador">${n}</b>` : ''}</button>`;
  document.getElementById('menu-itens').innerHTML = Object.entries(TELAS).map(([k, t]) => item(k, t)).join('');
  document.getElementById('barra-celular').innerHTML = ['inicio', 'caixa', 'orcamentos', 'clientes', 'contas', 'ajustes']
    .map(k => `<button class="${atual === k ? 'ativo' : ''}" data-acao="ir" data-tela="${k}">${icone(TELAS[k].icone)}<span>${TELAS[k].curto || TELAS[k].nome}</span></button>`).join('');
}

export function desenhar(forcar = true) {
  desenharMenu();
  const el = document.getElementById('tela');
  // Não redesenha a tela enquanto a pessoa digita (evita perder o foco)
  const foco = document.activeElement;
  const digitando = foco && el.contains(foco) && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName);
  if (digitando && (!forcar || foco.dataset.semRedesenho !== undefined)) { desenharMenu(); return; }
  try { el.innerHTML = TELAS[atual].mod.tela(param); TELAS[atual].mod.depois && TELAS[atual].mod.depois(el, param); }
  catch (e) { console.error(e); el.innerHTML = `<div class="vazio">Erro ao abrir esta tela: ${esc(e.message)}</div>`; }
  document.getElementById('aviso-topo').innerHTML = S.carregado ? '' :
    '<div class="faixa neg">Não consegui carregar os lançamentos do servidor. Seus dados não foram apagados — tentando de novo…</div>';
}
window.zlDesenhar = desenhar;

// ── Cliques: todo botão com data-acao passa por aqui ────────────────
const ACOES = {
  'ir': el => ir(el.dataset.tela, el.dataset.p || null),
  'fechar-modal': () => fecharModal(),
  'buscar': () => busca.abrir(),
  'sair': () => fazerSair(),
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-acao]');
  if (!el) return;
  const nome = el.dataset.acao;
  const fn = ACOES[nome] || Object.values(TELAS).map(t => t.mod.acoes && t.mod.acoes[nome]).find(Boolean) || (busca.acoes && busca.acoes[nome]);
  if (fn) { e.preventDefault(); try { const r = fn(el, e); if (r && r.catch) r.catch(err => { console.error(err); erro('Erro: ' + err.message); }); } catch (err) { console.error(err); erro('Erro: ' + err.message); } }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-mudar]');
  if (!el) return;
  const nome = el.dataset.mudar;
  const fn = Object.values(TELAS).map(t => t.mod.mudancas && t.mod.mudancas[nome]).find(Boolean);
  if (fn) fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-digitar]');
  if (!el) return;
  const nome = el.dataset.digitar;
  const fn = Object.values(TELAS).map(t => t.mod.digitacao && t.mod.digitacao[nome]).find(Boolean) || (busca.digitacao && busca.digitacao[nome]);
  if (fn) fn(el, e);
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !document.getElementById('app').hidden) { e.preventDefault(); busca.abrir(); }
  if (e.key === 'Escape') fecharModal();
});

// ── Indicador de salvamento ─────────────────────────────────────────
quandoSalvar(estado => {
  const el = document.getElementById('estado-salvar');
  const textos = { salvando: 'Salvando…', salvo: 'Salvo', pendente: 'Sem internet — envia quando voltar', erro: 'Não salvou — verifique a internet' };
  el.textContent = textos[estado] || '';
  el.hidden = false;
  clearTimeout(el._t);
  if (estado === 'salvo') el._t = setTimeout(() => { el.hidden = true; }, 1500);
});
quandoMudar(() => desenhar(false));

// ── Login / sessão ──────────────────────────────────────────────────
const MINUTOS_INATIVO = 30;
let ultimoUso = Date.now();
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { ultimoUso = Date.now(); }, { passive: true }));
setInterval(() => {
  if (!document.getElementById('app').hidden && Date.now() - ultimoUso > MINUTOS_INATIVO * 60000) fazerSair('Sessão encerrada por inatividade.');
}, 30000);

document.getElementById('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  const botao = document.getElementById('login-botao'), msg = document.getElementById('login-erro');
  botao.disabled = true; botao.textContent = 'Entrando…'; msg.hidden = true;
  try {
    await entrar(document.getElementById('login-email').value.trim(), document.getElementById('login-senha').value);
  } catch (err) {
    msg.textContent = err.code === 'auth/too-many-requests' ? 'Muitas tentativas. Tente mais tarde.'
      : err.code === 'auth/network-request-failed' ? 'Sem conexão com a internet.' : 'E-mail ou senha incorretos.';
    msg.hidden = false;
  } finally { botao.disabled = false; botao.textContent = 'Entrar'; }
});

let iniciado = false;
onAuthStateChanged(auth, async user => {
  if (user && !user.isAnonymous) {
    if (iniciado) return;
    iniciado = true;
    document.getElementById('tela-login').hidden = true;
    document.getElementById('app').hidden = false;
    document.getElementById('tela').innerHTML = '<div class="vazio">Carregando…</div>';
    ultimoUso = Date.now();
    const h = location.hash.replace('#', '');
    atual = TELAS[h] ? h : 'inicio';
    await carregarTudo();
    // RS Socorro: carrega à parte; se falhar, o resto do sistema segue normal
    import('./socorro.js').then(m => { window.zlSocorro = m; m.iniciarSocorro(() => desenhar(false)); }).catch(e => console.warn('RS Socorro indisponível', e));
    desenhar();
  } else {
    iniciado = false;
    document.getElementById('app').hidden = true;
    document.getElementById('tela-login').hidden = false;
  }
});

async function fazerSair(motivo) {
  try { await salvarAgora(); await salvamento.gravarPendentes(); } catch (e) {}
  pararTudo();
  fecharModal();
  await sair();
  document.getElementById('login-senha').value = '';
  if (motivo) { const m = document.getElementById('login-erro'); m.textContent = motivo; m.hidden = false; }
}
