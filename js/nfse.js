// Nota fiscal de serviço (NFS-e) pelo Emissor Nacional.
// A emissão roda numa função do Firebase (projeto prestadores-e2a2a), que guarda o certificado digital.
// A nota leva só a mão de obra. Peças (NF-e) ficam para uma etapa futura.
import { S, salvarCliente, totalOrcamento, valoresItem } from './dados.js';
import { auth } from './firebase.js';
import { resumoOrc } from './cartao.js';
import { moeda, num, esc, dataBR, abrirModal, fecharModal, confirmar, aviso, erro, lerForm, linkWhats, soNumeros } from './util.js';

// Servidor de nota fiscal (Render, plano grátis). Quando fica 15 min parado ele "dorme" e leva até 1 min pra acordar.
export const URL_NFSE = 'https://zlmotos-nfse.onrender.com/nfse';

// ── Cadastro do cliente (campos que a nota precisa) ─────────────────────
export function cpfValido(v) {
  const c = soNumeros(v); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
export function cnpjValido(v) {
  const c = soNumeros(v); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { const p = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const s = p.reduce((a, x, i) => a + x * +c[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
export function faltandoParaNota(c = {}) {
  const f = [], d = soNumeros(c.cpf);
  if (!String(c.nome || '').trim()) f.push('nome');
  if (!d) f.push('CPF ou CNPJ'); else if (!(d.length === 11 ? cpfValido(d) : cnpjValido(d))) f.push('CPF ou CNPJ válido');
  if (!/^\S+@\S+\.\S+$/.test(String(c.email || '').trim())) f.push('e-mail');
  if (soNumeros(c.tel).length < 10) f.push('telefone com DDD');
  if (soNumeros(c.cep).length !== 8) f.push('CEP');
  if (!String(c.logradouro || '').trim()) f.push('rua');
  if (!String(c.numero || '').trim()) f.push('número');
  if (!String(c.bairro || '').trim()) f.push('bairro');
  if (soNumeros(c.codMun).length !== 7) f.push('cidade (busque pelo CEP)');
  return f;
}
// Campos de documento e endereço (usados no cadastro do cliente e na conferência da nota)
export function camposClienteNota(c = {}) {
  const f = (n, rot, extra = '', cls = '') => `<label class="campo ${cls}"><span>${rot}</span><input name="${n}" value="${esc(c[n] || '')}" ${extra}></label>`;
  const cidade = c.cidade ? `${c.cidade}${c.uf ? ' - ' + c.uf : ''}` : '';
  return `${f('cpf', 'CPF ou CNPJ', 'inputmode="numeric"')}${f('email', 'E-mail', 'type="email"')}
    ${f('cep', 'CEP', 'inputmode="numeric" data-digitar="cep-busca" placeholder="00000-000"')}
    <label class="campo"><span>Cidade</span><input name="cidadeTxt" value="${esc(cidade)}" readonly placeholder="Preenchida pelo CEP" tabindex="-1"></label>
    ${f('logradouro', 'Rua', '', 'span-tudo')}${f('numero', 'Número')}${f('complemento', 'Complemento')}${f('bairro', 'Bairro', '', 'span-tudo')}
    <input type="hidden" name="cidade" value="${esc(c.cidade || '')}"><input type="hidden" name="uf" value="${esc(c.uf || '')}"><input type="hidden" name="codMun" value="${esc(c.codMun || '')}">
    ${c.endereco && !c.logradouro ? `<p class="mudo span-tudo" style="margin:0;font-size:.8rem">Endereço antigo anotado: ${esc(c.endereco)}</p>` : ''}`;
}
export const dadosNotaDoForm = f => ({ cpf: f.cpf || '', email: (f.email || '').trim(), cep: f.cep || '', logradouro: (f.logradouro || '').trim(), numero: (f.numero || '').trim(),
  complemento: (f.complemento || '').trim(), bairro: (f.bairro || '').trim(), cidade: f.cidade || '', uf: f.uf || '', codMun: f.codMun || '' });

// Busca o endereço pelo CEP (ViaCEP) e preenche o formulário aberto
export async function buscarCep(el) {
  const cep = soNumeros(el.value), form = el.closest('.modal') || document;
  if (cep.length !== 8 || el.dataset.ultimo === cep) return;
  el.dataset.ultimo = cep;
  const set = (n, v, sobrescrever = true) => { const i = form.querySelector(`[name="${n}"]`); if (i && (sobrescrever || !i.value)) i.value = v || ''; };
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then(x => x.json());
    if (r.erro) { erro('CEP não encontrado.'); set('codMun', ''); set('cidade', ''); set('cidadeTxt', ''); return; }
    set('logradouro', r.logradouro, false); set('bairro', r.bairro, false);
    set('cidade', r.localidade); set('uf', r.uf); set('codMun', r.ibge); set('cidadeTxt', `${r.localidade} - ${r.uf}`);
    const n = form.querySelector('[name="numero"]'); if (n && !n.value) n.focus();
  } catch (e) { erro('Não consegui buscar o CEP. Confira a internet.'); el.dataset.ultimo = ''; }
}

// ── Chamada à função ────────────────────────────────────────────────────
async function chamar(corpo) {
  const u = auth.currentUser; if (!u) throw new Error('Entre no sistema de novo.');
  const token = await u.getIdToken();
  let r;
  try { r = await fetch(URL_NFSE, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(corpo) }); }
  catch (e) { throw Object.assign(new Error('Sem conexão com a função de nota fiscal. Confira a internet. Se emitiu agora, espere 1 minuto e clique em Emitir de novo: o sistema confere antes e não emite em dobro.'), { codigo: 'incerto' }); }
  let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
  if (!r.ok) throw Object.assign(new Error(j.erro || 'Erro na função de nota fiscal (' + r.status + ').'), j);
  return j;
}
let ambienteCache = null;
// Também serve para ACORDAR o servidor assim que a tela de conferência abre
async function ambiente() { if (!ambienteCache) ambienteCache = chamar({ acao: 'ambiente' }).then(r => r.ambiente).catch(() => { ambienteCache = null; return null; }); return ambienteCache; }
setInterval(() => { ambienteCache = null; }, 10 * 60e3); // reconfere de tempos em tempos

const b64Blob = b64 => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: 'application/pdf' }); };
const nomePdf = n => `NFSe_${n.numero}${n.ambiente === 'producao' ? '' : '_TESTE'}.pdf`;
function baixar(n, b64) { const a = document.createElement('a'); a.href = URL.createObjectURL(b64Blob(b64)); a.download = nomePdf(n); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
const textoNota = (o, n) => `Olá${o.cliente ? ', ' + o.cliente.split(' ')[0] : ''}! Segue a nota fiscal de serviço nº ${n.numero} da ${S.empresa.nomeFantasia || 'ZL Motos'}${n.valor ? ', no valor de ' + moeda(n.valor) : ''}.\n\nConsulta da nota: ${n.link}`;

async function enviarWhats(o, n, b64) {
  const arq = new File([b64Blob(b64)], nomePdf(n), { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [arq] })) {
    try { await navigator.share({ files: [arq], text: textoNota(o, n) }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  // Computador: baixa o PDF e abre a conversa; é só anexar o arquivo baixado
  baixar(n, b64);
  window.open(linkWhats(o.telefone, textoNota(o, n)), '_blank');
  aviso('PDF baixado. Anexe ele na conversa do WhatsApp que abriu.');
}

// ── Valor padrão da nota: a mão de obra que o cliente pagou ─────────────
export function valorMaoDeObra(o) {
  const t = totalOrcamento(o);
  const mao = (o.itens || []).reduce((s, it) => s + valoresItem(it).mao, 0);
  const fator = t.subtotal > 0 ? t.total / t.subtotal : 1; // desconto dividido entre peça e mão de obra
  if (/cr[ée]dito|d[ée]bito|cart/i.test(o.formaPgto || '')) {
    const r = resumoOrc(o, t), bruto = r.pecas + r.mao;
    return Math.round(r.mao * (bruto > 0 ? r.cartao / bruto : 1) * 100) / 100;
  }
  return Math.round(mao * fator * 100) / 100;
}
const descricaoPadrao = o => {
  const nomes = (o.itens || []).filter(it => valoresItem(it).mao > 0 && String(it.desc || '').trim()).map(it => String(it.desc).trim());
  const moto = [o.veiculo, o.placa].filter(Boolean).join(' placa ');
  return 'Mão de obra' + (moto ? ' na moto ' + moto : '') + (nomes.length ? ': ' + nomes.join('; ') : '') + '.';
};
const clienteDoOrc = o => S.clientes.find(c => c.id === o.clienteId) || S.clientes.find(c => (c.nome || '').trim().toLowerCase() === String(o.cliente || '').trim().toLowerCase()) || null;
const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

// ── Bloco "Nota fiscal" no orçamento ────────────────────────────────────
export function caixaNotaHTML(o) {
  if (o._novo) return '';
  const n = o.nfse, teste = n && n.ambiente !== 'producao' ? ' <span class="etiqueta">teste</span>' : '';
  let corpo;
  if (n && n.situacao === 'emitida') {
    corpo = `<div class="acoes"><span class="mudo">Nota nº <b>${esc(n.numero)}</b>${teste} · ${moeda(n.valor)} · emitida em ${dataBR((n.emitidaEm || '').slice(0, 10))}</span>
      <span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-fantasma" data-acao="nf-pdf">PDF</button><button class="btn btn-fantasma" data-acao="nf-whats">WhatsApp</button><button class="btn btn-fantasma" data-acao="nf-cancelar">Cancelar nota</button></span></div>`;
  } else {
    corpo = `<div class="acoes">${n && n.situacao === 'cancelada' ? `<span class="mudo">Nota nº ${esc(n.numero)}${teste} cancelada em ${dataBR((n.canceladaEm || '').slice(0, 10))}</span>` : '<span class="mudo">Só a mão de obra. Emita quando o cliente pedir.</span>'}
      <button class="btn" data-acao="nf-abrir" style="margin-left:auto">Emitir nota fiscal</button></div>`;
  }
  return `<div class="caixa"><div class="caixa-titulo"><h2>Nota fiscal</h2>${n && n.situacao === 'emitida' ? '<span class="etiqueta pos">Nota emitida</span>' : ''}</div>${corpo}</div>`;
}

// ── Ações (o orçamento passa como pegar o orçamento aberto e salvar) ────
export function acoesNota({ atual, salvar, sujo }) {
  const carregando = (b, txt) => { if (b) { b.disabled = true; b.dataset.txt = b.textContent; b.textContent = txt; } };
  const solta = b => { if (b) { b.disabled = false; b.textContent = b.dataset.txt || b.textContent; } };
  const guardarNaOrc = async (campos, msg) => { const o = atual(); o.nfse = Object.assign({}, o.nfse || {}, campos); await salvar(msg); };

  async function abrirConferencia(forcar = false) {
    const o = atual();
    if (sujo()) { if (!(await confirmar('Salvar as alterações do orçamento antes de emitir a nota?', { botao: 'Salvar' }))) return; if (!(await salvar('Orçamento salvo'))) return; }
    if (o.nfse && o.nfse.situacao === 'emitida' && !forcar) {
      if (!(await confirmar(`Este orçamento já tem a nota nº ${esc(o.nfse.numero)}. Emitir OUTRA nota mesmo assim?`, { botao: 'Emitir outra', perigo: true }))) return;
      forcar = true;
    }
    const c = Object.assign({ nome: o.cliente, tel: o.telefone }, clienteDoOrc(o) || {});
    abrirModal({
      titulo: 'Emitir nota fiscal de serviço', largo: true,
      corpo: `<div id="nf-amb" class="faixa" hidden></div>
        <p class="mudo" style="margin:0 0 6px">Confira os dados. O que mudar aqui no cliente também fica salvo no cadastro dele.</p>
        <h3 style="margin:8px 0 6px;font-size:.95rem">Cliente (tomador)</h3>
        <div class="grade g2"><label class="campo span-tudo"><span>Nome</span><input name="nome" value="${esc(c.nome || '')}"></label>
          <label class="campo"><span>Telefone</span><input name="tel" value="${esc(c.tel || '')}" inputmode="tel"></label>${camposClienteNota(c)}</div>
        <h3 style="margin:14px 0 6px;font-size:.95rem">Serviço</h3>
        <div class="grade g2">
          <label class="campo"><span>Valor da nota (só mão de obra)</span><input name="valor" type="number" step="0.01" min="0" value="${valorMaoDeObra(o).toFixed(2)}"></label>
          <label class="campo"><span>Competência</span><input name="competencia" type="month" value="${mesAtual()}" max="${mesAtual()}"></label>
          <label class="campo span-tudo"><span>Descrição na nota</span><textarea name="descricao" rows="3">${esc(descricaoPadrao(o))}</textarea></label>
        </div>
        <p class="mudo" style="margin:6px 0 0;font-size:.8rem">${/cr[ée]dito|d[ée]bito|cart/i.test(o.formaPgto || '') ? 'Pago no cartão: o valor já vem com a taxa da maquininha, que foi o que o cliente pagou.' : 'Valor à vista da mão de obra.'} Dá pra mudar antes de emitir.</p>
        <div id="nf-falta" class="faixa" hidden></div>`,
      rodape: `<div class="direita"><button class="btn" data-acao="fechar-modal">Cancelar</button><button class="btn btn-primario" data-acao="nf-emitir" data-forcar="${forcar ? 1 : 0}">Emitir nota</button></div>`,
    });
    const faixa = document.getElementById('nf-amb');
    const lento = setTimeout(() => { if (faixa && faixa.hidden) { faixa.hidden = false; faixa.textContent = 'Ligando o servidor da nota fiscal (pode levar até 1 minuto)… Pode ir conferindo os dados.'; } }, 1500);
    ambiente().then(a => {
      clearTimeout(lento); const el = document.getElementById('nf-amb'); if (!el) return;
      if (a && a !== 'producao') { el.hidden = false; el.textContent = 'MODO TESTE (homologação): a nota sai sem valor fiscal.'; }
      else if (a === 'producao') el.hidden = true;
      else { el.hidden = false; el.textContent = 'Não consegui falar com o servidor da nota fiscal. Confira a internet e tente de novo.'; }
    });
  }

  async function emitir(el) {
    const o = atual(), m = document.querySelector('.modal'), f = lerForm(m);
    const cad = Object.assign({}, clienteDoOrc(o) || {}, { nome: f.nome.trim(), tel: f.tel }, dadosNotaDoForm(f));
    const falta = faltandoParaNota(cad), box = document.getElementById('nf-falta');
    if (falta.length) { box.hidden = false; box.textContent = 'Falta preencher: ' + falta.join(', ') + '. A nota só sai com o cadastro completo.'; return; }
    const valor = num(f.valor);
    if (!(valor > 0)) return erro('Informe o valor da nota.');
    if (String(f.descricao || '').trim().length < 3) return erro('Descreva o serviço.');
    carregando(el, 'Emitindo… (até 1 min)');
    try {
      // guarda os dados no cadastro do cliente (cria o cadastro se ainda não existir)
      const salvo = await salvarCliente(cad);
      if (o.clienteId !== salvo.id) o.clienteId = salvo.id;
      const r = await chamar({ acao: 'emitir', orcId: o.id, forcar: el.dataset.forcar === '1', valor, descricao: f.descricao, competencia: f.competencia,
        tomador: { nome: cad.nome, doc: cad.cpf, email: cad.email, fone: cad.tel, cep: cad.cep, logradouro: cad.logradouro, numero: cad.numero, complemento: cad.complemento, bairro: cad.bairro, codMunicipio: cad.codMun } });
      const nota = { numero: r.numero, chave: r.chave, link: r.link, ambiente: r.ambiente, valor: r.valor, competencia: r.competencia, emitidaEm: r.emitidaEm, situacao: 'emitida' };
      fecharModal();
      o.nfse = nota; await salvar('Nota fiscal emitida');
      mostrarResultado(o, nota, r.pdf, r.alertas, r.recuperada);
    } catch (e) {
      solta(el);
      if (e.codigo === 'ja_emitida' && e.nota) {
        o.nfse = Object.assign({ situacao: 'emitida' }, e.nota); fecharModal(); await salvar('Nota já emitida');
        return erro(`Esse orçamento já tem a nota nº ${e.nota.numero}. Para emitir outra, clique em Emitir nota fiscal de novo e confirme.`);
      }
      if (e.falta) { box.hidden = false; box.textContent = e.erro || e.message; return; }
      mostrarErro('A nota não foi emitida', e.erro || e.message);
    }
  }

  function mostrarResultado(o, n, b64, alertas = [], recuperada = false) {
    abrirModal({
      titulo: recuperada ? 'Nota fiscal confirmada' : 'Nota fiscal emitida',
      corpo: `${n.ambiente !== 'producao' ? '<div class="faixa">MODO TESTE (homologação): nota sem valor fiscal.</div>' : ''}
        <p style="font-size:1.1rem;margin:6px 0">Nota nº <b>${esc(n.numero)}</b> · ${moeda(n.valor)}</p>
        ${recuperada ? '<p class="mudo">O envio anterior tinha saído: esta é a nota dele (não foi emitida outra).</p>' : ''}
        <p class="mudo" style="word-break:break-all;font-size:.8rem">Chave: ${esc(n.chave)}<br><a href="${esc(n.link)}" target="_blank" rel="noopener">Abrir consulta da nota</a></p>
        ${alertas && alertas.length ? `<p class="mudo" style="font-size:.8rem">Avisos da Receita: ${esc(alertas.join(' · '))}</p>` : ''}`,
      rodape: `<div class="direita"><button class="btn" data-acao="fechar-modal">Fechar</button><button class="btn" data-acao="nf-baixar">Baixar PDF</button><button class="btn btn-primario" data-acao="nf-whats-agora">Enviar no WhatsApp</button></div>`,
    });
    ultimoPdf = { chave: n.chave, b64 };
  }
  let ultimoPdf = null;
  async function pdfDaNota() {
    const n = atual().nfse;
    if (ultimoPdf && ultimoPdf.chave === n.chave) return ultimoPdf.b64;
    const r = await chamar({ acao: 'pdf', chave: n.chave });
    ultimoPdf = { chave: n.chave, b64: r.pdf }; return r.pdf;
  }
  function mostrarErro(titulo, texto) {
    abrirModal({ titulo, corpo: `<p style="white-space:pre-wrap;margin:0">${esc(texto)}</p>`, rodape: `<div class="direita"><button class="btn btn-primario" data-acao="fechar-modal">Entendi</button></div>` });
  }

  return {
    'nf-abrir': () => abrirConferencia(),
    'nf-emitir': el => emitir(el),
    'nf-baixar': async el => { carregando(el, 'Gerando…'); try { baixar(atual().nfse, await pdfDaNota()); } catch (e) { erro(e.erro || e.message); } solta(el); },
    'nf-pdf': async el => { carregando(el, 'Gerando…'); try { baixar(atual().nfse, await pdfDaNota()); } catch (e) { erro(e.erro || e.message); } solta(el); },
    'nf-whats': async el => { carregando(el, 'Gerando…'); try { await enviarWhats(atual(), atual().nfse, await pdfDaNota()); } catch (e) { erro(e.erro || e.message); } solta(el); },
    'nf-whats-agora': async el => { try { await enviarWhats(atual(), atual().nfse, await pdfDaNota()); } catch (e) { erro(e.erro || e.message); } },
    'nf-cancelar': () => {
      const n = atual().nfse;
      abrirModal({
        titulo: `Cancelar a nota nº ${esc(n.numero)}`,
        corpo: `<p class="mudo" style="margin-top:0">O cancelamento vai para a Receita e não tem volta. Só dá pra cancelar dentro do prazo da prefeitura.</p>
          <div class="grade g2"><label class="campo"><span>Motivo</span><select name="motivo"><option value="1">Erro na emissão</option><option value="2">Serviço não prestado</option><option value="9">Outros</option></select></label>
          <label class="campo span-tudo"><span>Explique (mínimo 15 letras)</span><textarea name="justificativa" rows="2"></textarea></label></div>`,
        rodape: `<div class="direita"><button class="btn" data-acao="fechar-modal">Voltar</button><button class="btn btn-perigo" data-acao="nf-cancelar-ok">Cancelar nota</button></div>`,
      });
    },
    'nf-cancelar-ok': async el => {
      const f = lerForm(document.querySelector('.modal')), n = atual().nfse;
      if (String(f.justificativa || '').trim().length < 15) return erro('Explique o motivo com pelo menos 15 letras.');
      carregando(el, 'Cancelando…');
      try {
        const r = await chamar({ acao: 'cancelar', chave: n.chave, motivo: f.motivo, justificativa: f.justificativa });
        fecharModal(); await guardarNaOrc({ situacao: 'cancelada', canceladaEm: r.canceladaEm || new Date().toISOString() }, 'Nota cancelada');
      } catch (e) { solta(el); mostrarErro('A nota não foi cancelada', e.erro || e.message); }
    },
  };
}
