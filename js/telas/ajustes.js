// Ajustes: dados da empresa, meta, categorias, senha e backup.
import { S, salvarEmpresa, salvarConfig, salvarCategorias } from '../dados.js';
import { auth, updatePassword, ler, docUsuario, getDocs, colUsuario } from '../firebase.js';
import { moeda, esc, aviso, erro, lerForm, abrirModal, fecharModal, confirmar, hojeISO } from '../util.js';
import { taxasCartao } from '../cartao.js';

const CAMPOS_EMPRESA = [['nomeFantasia', 'Nome fantasia'], ['razaoSocial', 'Razão social'], ['cnpj', 'CNPJ'], ['telefone', 'Telefone'], ['email', 'E-mail'], ['endereco', 'Endereço', 'span-tudo'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['estado', 'Estado'], ['cep', 'CEP']];

export function tela() {
  const e = S.empresa || {};
  return `
  <div class="cabecalho"><div><h1>Ajustes</h1><div class="sub">${esc(auth.currentUser?.email || '')}</div></div></div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Dados da oficina</h2><button class="btn btn-primario btn-p" data-acao="salvar-empresa">Salvar</button></div>
    <p class="mudo" style="margin:-4px 0 12px;font-size:.82rem">Aparecem no cabeçalho dos PDFs de orçamento.</p>
    <div class="grade g2" id="form-empresa">
      ${CAMPOS_EMPRESA.map(([k, r, cls]) => `<label class="campo ${cls || ''}"><span>${r}</span><input type="text" name="${k}" value="${esc(e[k] || '')}"></label>`).join('')}
    </div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Meta mensal de faturamento</h2></div>
    <div class="acoes"><input type="number" min="0" step="100" style="max-width:220px" value="${esc(S.config.metaMensal || '')}" placeholder="Ex: 50000" data-mudar="meta">
      <span class="mudo">${S.config.metaMensal ? 'Atual: ' + moeda(S.config.metaMensal) : 'Sem meta definida'}</span></div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Taxas da maquininha</h2><button class="btn btn-primario btn-p" data-acao="salvar-taxas">Salvar</button></div>
    <p class="mudo" style="margin:-4px 0 12px;font-size:.82rem">A maior taxa entre as bandeiras. Abaixo de R$ 300 é 1x; a cada R$ 300 libera mais uma parcela (até 6x). A taxa da parcela máxima vai embutida no preço do cartão; Pix e dinheiro pagam o valor à vista. Use as mesmas do sistema de comissão.</p>
    <div class="grade g3" id="form-taxas">
      ${taxasCartao().map((t, i) => `<label class="campo"><span>${i ? (i + 1) + 'x' : '1x / débito'} (%)</span><input type="number" step="0.01" min="0" max="29.99" name="t${i}" value="${esc(t)}"></label>`).join('')}
    </div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Lembrete de troca de óleo</h2></div>
    <div class="acoes"><span>Avisar o cliente</span><input type="number" min="7" max="365" step="1" style="max-width:90px" value="${esc(S.config.diasOleo || 60)}" data-mudar="dias-oleo"><span>dias depois da última troca</span></div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Categorias de saída</h2></div>
    <div class="filtros">${S.categorias.map(c => `<span class="etiqueta forte" style="height:30px;gap:8px">${esc(c)}<button class="btn btn-fantasma btn-p btn-icone" style="height:20px;width:20px" data-acao="cat-del" data-c="${esc(c)}" title="Remover">✕</button></span>`).join('')}</div>
    <div class="acoes"><input type="text" id="nova-cat" placeholder="Nova categoria" style="max-width:220px"><button class="btn" data-acao="cat-add">Adicionar</button></div>
  </div>

  <div class="caixa">
    <div class="caixa-titulo"><h2>Segurança e backup</h2></div>
    <div class="acoes">
      <button class="btn" data-acao="trocar-senha">Trocar senha</button>
      <button class="btn" data-acao="backup">Baixar backup completo</button>
    </div>
    <p class="mudo" style="font-size:.8rem;margin:10px 0 0">O backup baixa tudo que está no servidor, inclusive dados de módulos antigos (OS, estoque, vendas). Guarde o arquivo em local seguro.</p>
  </div>
  <p class="mudo" style="text-align:center;font-size:.75rem;margin-top:24px">ZL Motos · versão 7.3.0</p>`;
}

export const acoes = {
  'salvar-taxas': async () => {
    const f = lerForm(document.getElementById('form-taxas'));
    const tx = [0, 1, 2, 3, 4, 5].map(i => parseFloat(String(f['t' + i]).replace(',', '.')));
    if (tx.some(t => isNaN(t) || t < 0 || t >= 30)) return erro('Taxa inválida (0 a 29,99%).');
    await salvarConfig({ taxasCartao: tx }); aviso('Taxas salvas'); window.zlDesenhar();
  },
  'salvar-empresa': async () => {
    const f = lerForm(document.getElementById('form-empresa'));
    S.empresa = Object.assign(S.empresa || {}, f);
    await salvarEmpresa(); aviso('Dados da oficina salvos');
  },
  'cat-add': async () => {
    const el = document.getElementById('nova-cat'), n = el.value.trim();
    if (!n) return;
    if (S.categorias.some(c => c.toLowerCase() === n.toLowerCase())) return erro('Essa categoria já existe.');
    S.categorias.push(n); await salvarCategorias(); aviso('Categoria adicionada'); window.zlDesenhar();
  },
  'cat-del': async el => {
    if (!(await confirmar(`Remover a categoria "${esc(el.dataset.c)}"? Lançamentos antigos continuam com ela.`, { botao: 'Remover' }))) return;
    S.categorias = S.categorias.filter(c => c !== el.dataset.c); await salvarCategorias(); window.zlDesenhar();
  },
  'trocar-senha': () => abrirModal({
    titulo: 'Trocar senha',
    corpo: `<label class="campo"><span>Nova senha</span><input type="password" name="s1" autocomplete="new-password"></label>
      <label class="campo"><span>Repita a nova senha</span><input type="password" name="s2" autocomplete="new-password"></label>
      <p class="mudo" style="margin:0;font-size:.8rem">Use pelo menos 8 caracteres, misturando letras e números.</p>`,
    rodape: `<div class="direita"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" data-acao="confirmar-senha">Salvar senha</button></div>`
  }),
  'confirmar-senha': async () => {
    const f = lerForm(document.querySelector('.modal'));
    if (f.s1.length < 8) return erro('A senha precisa ter pelo menos 8 caracteres.');
    if (f.s1 !== f.s2) return erro('As senhas não são iguais.');
    try { await updatePassword(auth.currentUser, f.s1); fecharModal(); aviso('Senha alterada'); }
    catch (e) { erro(e.code === 'auth/requires-recent-login' ? 'Por segurança, saia e entre de novo antes de trocar a senha.' : 'Não foi possível trocar a senha.'); }
  },
  'backup': async () => {
    aviso('Preparando backup…');
    const ano = new Date().getFullYear();
    const chaves = ['config_geral', 'empresa_config', 'categorias_mes', 'orcamentos_lista', 'contas_pagar', 'os_lista', 'os_contador', 'estoque_global', 'ferramental_global', 'vendas_historico', 'est_entradas', 'fornecedores', 'agendamentos_lista'];
    for (let a = ano - 6; a <= ano + 1; a++) chaves.push('zlmotos_' + a);
    const b = { exportadoEm: new Date().toISOString(), versao: '7.0.0', documentos: {} };
    for (const k of chaves) { try { const s = await ler(docUsuario(k)); if (s.exists()) b.documentos[k] = s.data(); } catch (e) {} }
    for (const col of ['clientes', 'orcamentos']) { try { const s = await getDocs(colUsuario(col)); b[col] = s.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) {} }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' }));
    a.download = `ZLMotos_backup_${hojeISO()}.json`; a.click();
    aviso('Backup baixado');
  },
};
export const mudancas = {
  'dias-oleo': async el => { const d = Math.max(7, Math.min(365, parseInt(el.value) || 60)); await salvarConfig({ diasOleo: d }); aviso('Lembrete: ' + d + ' dias'); window.zlDesenhar(); },
  'meta': async el => { await salvarConfig({ metaMensal: parseFloat(el.value) || 0 }); aviso('Meta salva'); window.zlDesenhar(); },
};
