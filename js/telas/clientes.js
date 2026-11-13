// Clientes: lista, ficha e cadastro.
import { S, salvarCliente, excluirCliente, totalOrcamento, orcAceito, orcRecusado, salvarConfig } from '../dados.js';
import { retornosOleo, ultimasTrocas, DIAS_OLEO_PADRAO } from '../analise.js';
import { num, somaDias } from '../util.js';
import { moeda, esc, dataBR, abrirModal, fecharModal, confirmar, aviso, erro, icone, lerForm, linkWhats } from '../util.js';
import { novoParaCliente } from './orcamentos.js';

let termo = '';
const chave = s => String(s || '').trim().toLowerCase();

// Junta clientes cadastrados com nomes que só aparecem em orçamentos
function todos() {
  const mapa = new Map();
  S.clientes.forEach(c => mapa.set(chave(c.nome), { ...c, cadastrado: true, orcs: [] }));
  S.orcamentos.forEach(o => {
    const k = chave(o.cliente); if (!k) return;
    if (!mapa.has(k)) mapa.set(k, { id: 'nome:' + o.cliente.trim(), nome: o.cliente.trim(), tel: o.telefone || '', veic: o.veiculo || '', placa: o.placa || '', cadastrado: false, orcs: [] });
    mapa.get(k).orcs.push(o);
  });
  return Array.from(mapa.values()).map(c => ({ ...c, gasto: c.orcs.filter(orcAceito).reduce((s, o) => s + totalOrcamento(o).total, 0) }))
    .sort((a, b) => chave(a.nome).localeCompare(chave(b.nome)));
}

export function tela(param) {
  if (param === 'retornos') return telaRetornos();
  if (param) { const c = todos().find(x => x.id === param); if (c) return ficha(c); }
  let lista = todos();
  if (termo) { const q = chave(termo); lista = lista.filter(c => [c.nome, c.tel, c.veic, c.placa, c.cpf].join(' ').toLowerCase().includes(q)); }
  return `
  <div class="cabecalho">
    <div><h1>Clientes</h1><div class="sub">${lista.length} cliente(s)</div></div>
    <div class="acoes">${(() => { const n = retornosOleo().length; return n ? `<button class="btn" data-acao="ir" data-tela="clientes" data-p="retornos">Troca de óleo <span class="etiqueta forte" style="margin-left:4px">${n}</span></button>` : ''; })()}<button class="btn btn-primario" data-acao="novo-cliente">${icone('mais')} Novo cliente</button></div>
  </div>
  <div class="caixa">
    <div class="filtros"><input type="search" class="busca" style="margin-left:0;width:100%" placeholder="Nome, telefone, moto ou placa…" value="${esc(termo)}" data-digitar="busca-cli" data-sem-redesenho></div>
    <div class="lista">${lista.length ? lista.map(c => `
      <div class="linha clicavel" data-acao="ir" data-tela="clientes" data-p="${esc(c.id)}">
        <div class="principal"><div class="titulo">${esc(c.nome)}</div>
          <div class="meta">${esc([c.tel, c.veic, c.placa].filter(Boolean).join(' · ') || 'Sem contato')}</div></div>
        ${!c.cadastrado ? '<span class="etiqueta">Não cadastrado</span>' : ''}
        <span class="mudo esconder-celular" style="font-size:.8rem">${c.orcs.length} orçamento(s)</span>
        <div class="valor">${c.gasto ? moeda(c.gasto) : ''}</div>
      </div>`).join('') : '<div class="vazio">Nenhum cliente encontrado.</div>'}</div>
  </div>`;
}

function telaRetornos() {
  const lista = retornosOleo(), dias = num(S.config.diasOleo) || DIAS_OLEO_PADRAO, emp = S.empresa.nomeFantasia || 'ZL Motos';
  const msg = r => `Olá, ${r.cliente.split(' ')[0]}! Aqui é da ${emp}. A última troca de óleo da sua ${r.veiculo || 'moto'} foi em ${dataBR(r.data)}${r.km ? ' (' + r.km + ' km)' : ''}. Já está na hora da próxima. Quer agendar?`;
  return `
  <div class="cabecalho">
    <div class="acoes"><button class="btn btn-icone" data-acao="ir" data-tela="clientes" title="Voltar">${icone('voltar')}</button>
      <div><h1>Troca de óleo</h1><div class="sub">Clientes que trocaram o óleo há ${dias} dias ou mais (muda em Ajustes)</div></div></div>
  </div>
  <div class="caixa"><div class="lista">${lista.length ? lista.map(r => `
    <div class="linha">
      <div class="principal"><div class="titulo">${esc(r.cliente)}</div>
        <div class="meta">${esc([r.veiculo, r.placa].filter(Boolean).join(' · ') || '—')} · última troca ${dataBR(r.data)}${r.km ? ' · ' + esc(r.km) + ' km' : ''} · ${r.atraso > 0 ? `<span class="neg">venceu há ${r.atraso} dia(s)</span>` : r.atraso === 0 ? 'vence hoje' : `vence em ${-r.atraso} dia(s)`}</div></div>
      ${r.cliTel ? `<a class="btn btn-p" href="${linkWhats(r.cliTel, msg(r))}" target="_blank" rel="noopener">${icone('whats')} Avisar</a>` : '<span class="mudo" style="font-size:.8rem">sem telefone</span>'}
      <button class="btn btn-p btn-fantasma" data-acao="oleo-avisado" data-k="${esc(r.chave)}" data-d="${esc(r.data)}" title="Tirar da lista">Feito</button>
    </div>`).join('') : '<div class="vazio">Ninguém para avisar agora.</div>'}</div></div>
  <p class="mudo" style="font-size:.8rem">A lista usa os orçamentos aceitos ou pagos que têm "óleo" em algum item. Depois de avisar, toque em "Feito" para tirar o cliente da lista até a próxima troca.</p>`;
}

function ficha(c) {
  const orcs = c.orcs.slice().sort((a, b) => String(b.data || b.criadoEm || '').localeCompare(String(a.data || a.criadoEm || '')));
  const campo = (rot, v) => v ? `<div><div class="mudo" style="font-size:.76rem">${rot}</div><div>${esc(v)}</div></div>` : '';
  return `
  <div class="cabecalho">
    <div class="acoes"><button class="btn btn-icone" data-acao="ir" data-tela="clientes" title="Voltar">${icone('voltar')}</button>
      <div><h1>${esc(c.nome)}</h1><div class="sub">${c.cadastrado ? 'Cliente desde ' + dataBR(c.criadoEm) : 'Aparece em orçamentos, mas não está cadastrado'}</div></div></div>
    <div class="acoes">
      ${c.tel ? `<a class="btn" href="${linkWhats(c.tel, 'Olá, ' + c.nome.split(' ')[0] + '! Aqui é da ' + (S.empresa.nomeFantasia || 'ZL Motos') + '.')}" target="_blank" rel="noopener">${icone('whats')} WhatsApp</a>` : ''}
      <button class="btn" data-acao="editar-cliente" data-id="${esc(c.id)}">${c.cadastrado ? 'Editar' : 'Cadastrar'}</button>
      <button class="btn btn-primario" data-acao="orc-cliente" data-id="${esc(c.id)}">${icone('mais')} Orçamento</button>
    </div>
  </div>
  <div class="indicadores">
    <div class="indicador"><div class="rotulo">Orçamentos</div><div class="valor">${orcs.length}</div></div>
    <div class="indicador"><div class="rotulo">Aceitos</div><div class="valor">${orcs.filter(orcAceito).length}</div></div>
    <div class="indicador"><div class="rotulo">Total gasto (aceitos)</div><div class="valor pos">${moeda(c.gasto)}</div></div>
  </div>
  <div class="caixa"><div class="grade g3">
    ${campo('Telefone', c.tel)}${campo('CPF/CNPJ', c.cpf)}${campo('E-mail', c.email)}${campo('Moto', c.veic)}${campo('Placa', c.placa)}${campo('Nascimento', c.nascimento && dataBR(c.nascimento))}${campo('Endereço', c.endereco)}${campo('Observações', c.obs)}
  </div></div>
  ${(() => { const t = ultimasTrocas().get(chave(c.nome)); if (!t) return ''; const dias = num(S.config.diasOleo) || DIAS_OLEO_PADRAO;
    return `<div class="caixa"><div class="caixa-titulo"><h2>Troca de óleo</h2></div><div class="grade g3">
      <div><div class="mudo" style="font-size:.76rem">Última troca</div><div>${dataBR(t.data)}${t.km ? ' · ' + esc(t.km) + ' km' : ''}</div></div>
      <div><div class="mudo" style="font-size:.76rem">Próxima (a cada ${dias} dias)</div><div>${dataBR(somaDias(dias, new Date(t.data + 'T12:00:00')))}</div></div></div></div>`; })()}
  <div class="caixa"><div class="caixa-titulo"><h2>Histórico de orçamentos</h2></div>
    <div class="lista">${orcs.length ? orcs.map(o => `
      <div class="linha clicavel" data-acao="ir" data-tela="orcamentos" data-p="${esc(o.id)}">
        <div class="principal"><div class="titulo">${esc([o.veiculo, o.placa].filter(Boolean).join(' · ') || 'Orçamento')}</div><div class="meta">${dataBR(o.data || o.criadoEm)} · ${(o.itens || []).length} item(ns)</div></div>
        <span class="etiqueta ${orcAceito(o) ? 'pos' : orcRecusado(o) ? 'neg' : ''}">${orcAceito(o) ? 'Aceito' : orcRecusado(o) ? 'Recusado' : o.status === 'enviado' ? 'Enviado' : 'Pendente'}</span>
        <div class="valor">${moeda(totalOrcamento(o).total)}</div></div>`).join('') : '<div class="vazio">Nenhum orçamento ainda.</div>'}</div>
  </div>
  ${c.cadastrado ? `<div class="acoes" style="margin-top:16px"><button class="btn btn-perigo" data-acao="excluir-cliente" data-id="${esc(c.id)}" style="margin-left:auto">${icone('lixo')} Excluir cliente</button></div>` : ''}`;
}

function modalCliente(c = {}) {
  const f = (n, rot, tipo = 'text', cls = '') => `<label class="campo ${cls}"><span>${rot}</span><input type="${tipo}" name="${n}" value="${esc(c[n] || '')}"></label>`;
  abrirModal({
    titulo: c.cadastrado ? 'Editar cliente' : 'Novo cliente', largo: true,
    corpo: `<div class="grade g2">${f('nome', 'Nome', 'text', 'span-tudo')}${f('tel', 'Telefone')}${f('cpf', 'CPF/CNPJ')}${f('veic', 'Moto')}${f('placa', 'Placa')}${f('email', 'E-mail', 'email')}${f('nascimento', 'Nascimento', 'date')}${f('endereco', 'Endereço', 'text', 'span-tudo')}
      <label class="campo span-tudo"><span>Observações</span><textarea name="obs">${esc(c.obs || '')}</textarea></label></div>
      <input type="hidden" name="id" value="${esc(c.cadastrado ? c.id : '')}">`,
    rodape: `<div class="direita"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" data-acao="salvar-cliente">Salvar</button></div>`
  });
}

export const acoes = {
  'oleo-avisado': async el => {
    const av = Object.assign({}, S.config.retornosAvisados || {}); av[el.dataset.k] = el.dataset.d;
    await salvarConfig({ retornosAvisados: av }); aviso('Tirado da lista'); window.zlDesenhar();
  },
  'novo-cliente': () => modalCliente(),
  'editar-cliente': el => modalCliente(todos().find(x => x.id === el.dataset.id)),
  'salvar-cliente': async () => {
    const f = lerForm(document.querySelector('.modal'));
    if (!f.nome.trim()) return erro('Informe o nome.');
    const existente = f.id ? S.clientes.find(c => c.id === f.id) : null;
    if (!existente && S.clientes.some(c => chave(c.nome) === chave(f.nome))) return erro('Já existe um cliente com esse nome.');
    const c = Object.assign(existente ? { ...existente } : {}, { nome: f.nome.trim(), tel: f.tel, cpf: f.cpf, veic: f.veic, placa: f.placa.toUpperCase(), email: f.email, nascimento: f.nascimento, endereco: f.endereco, obs: f.obs });
    await salvarCliente(c);
    fecharModal(); aviso('Cliente salvo'); window.zlIr('clientes', c.id);
  },
  'excluir-cliente': async el => {
    const c = S.clientes.find(x => x.id === el.dataset.id); if (!c) return;
    if (!(await confirmar(`Excluir o cadastro de ${esc(c.nome)}? Os orçamentos dele continuam guardados.`, { botao: 'Excluir', perigo: true }))) return;
    await excluirCliente(c.id); aviso('Cliente excluído'); window.zlIr('clientes');
  },
  'orc-cliente': el => { const c = todos().find(x => x.id === el.dataset.id); novoParaCliente(c && c.cadastrado ? c : { nome: c?.nome, tel: c?.tel, veic: c?.veic, placa: c?.placa }); },
};
export const digitacao = {
  'busca-cli': el => {
    termo = el.value; clearTimeout(el._t);
    el._t = setTimeout(() => { const pos = el.selectionStart; delete el.dataset.semRedesenho; window.zlDesenhar(); const n = document.querySelector('[data-digitar="busca-cli"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250);
  },
};
