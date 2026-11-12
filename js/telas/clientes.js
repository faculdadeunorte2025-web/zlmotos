// Clientes: lista, ficha e cadastro.
import { S, salvarCliente, excluirCliente, totalOrcamento, orcAceito, orcRecusado } from '../dados.js';
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
  if (param) { const c = todos().find(x => x.id === param); if (c) return ficha(c); }
  let lista = todos();
  if (termo) { const q = chave(termo); lista = lista.filter(c => [c.nome, c.tel, c.veic, c.placa, c.cpf].join(' ').toLowerCase().includes(q)); }
  return `
  <div class="cabecalho">
    <div><h1>Clientes</h1><div class="sub">${lista.length} cliente(s)</div></div>
    <div class="acoes"><button class="btn btn-primario" data-acao="novo-cliente">${icone('mais')} Novo cliente</button></div>
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
