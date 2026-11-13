// Cálculos de apoio: retorno de troca de óleo e comparativo de meses.
import { S, calcMes, orcAceito, totalOrcamento } from './dados.js';
import { num, hojeISO, somaDias } from './util.js';

export const DIAS_OLEO_PADRAO = 60;
const chave = s => String(s || '').trim().toLowerCase();
const temOleo = o => (o.itens || []).some(it => /[óo]leo/i.test(it.desc || '') && !/filtro de [óo]leo$/i.test((it.desc || '').trim()));

// Última troca de óleo de cada cliente (orçamentos aceitos ou pagos com item de óleo).
export function ultimasTrocas() {
  const mapa = new Map();
  S.orcamentos.forEach(o => {
    if (!(orcAceito(o) || o.pago) || !temOleo(o)) return;
    const k = chave(o.cliente); if (!k) return;
    const data = o.data || String(o.criadoEm || '').slice(0, 10);
    const atual = mapa.get(k);
    if (!atual || data > atual.data) mapa.set(k, { chave: k, cliente: o.cliente.trim(), telefone: o.telefone || '', veiculo: o.veiculo || '', placa: o.placa || '', km: o.km || '', data, orcId: o.id });
  });
  return mapa;
}

// Clientes que já passaram (ou estão a 3 dias) da data de voltar para trocar o óleo.
export function retornosOleo() {
  const dias = num(S.config.diasOleo) || DIAS_OLEO_PADRAO;
  const avisados = S.config.retornosAvisados || {};
  const limite = somaDias(3), hoje = new Date(hojeISO() + 'T12:00:00');
  const lista = [];
  ultimasTrocas().forEach(t => {
    const proxima = somaDias(dias, new Date(t.data + 'T12:00:00'));
    if (proxima > limite) return;                                  // ainda não é hora
    if (avisados[t.chave] && avisados[t.chave] >= t.data) return;  // já foi avisado desta troca
    const atraso = Math.round((hoje - new Date(proxima + 'T12:00:00')) / 864e5);
    if (atraso > dias * 2) return;                                 // muito antigo: provavelmente trocou em outro lugar
    lista.push({ ...t, proxima, atraso, cliTel: telefoneCadastro(t) });
  });
  return lista.sort((a, b) => a.proxima.localeCompare(b.proxima));
}
function telefoneCadastro(t) {
  const c = S.clientes.find(x => chave(x.nome) === t.chave);
  return (c && (c.tel || c.telefone)) || t.telefone;
}

// Números de um mês (base = dados do ano) ou null se não houver dados.
function numeros(base, m) {
  if (!base || !base[m]) return null;
  const c = calcMes(m, base);
  return c.entradas || c.saidas ? c : null;
}

// Comparativo do mês m do ano aberto com o mês anterior e com o mesmo mês do ano passado.
export function comparativo(m) {
  const atual = numeros(S.dados, m) || { entradas: 0, saidas: 0, resultado: 0 };
  const anterior = m === 0 ? numeros(S.dadosAnoAnterior, 11) : numeros(S.dados, m - 1);
  const anoPassado = numeros(S.dadosAnoAnterior, m);
  // Orçamentos aceitos no mês: quanto foi peça e quanto foi mão de obra
  const prefixo = `${S.ano}-${String(m + 1).padStart(2, '0')}`;
  let pecas = 0, mao = 0, qtd = 0;
  S.orcamentos.forEach(o => {
    if (!orcAceito(o) || !String(o.data || o.criadoEm || '').startsWith(prefixo)) return;
    qtd++;
    const t = totalOrcamento(o), fator = t.subtotal ? t.total / t.subtotal : 1; // desconto distribuído
    (o.itens || []).forEach(it => {
      const v = (num(it.qtd) || 1) * num(it.vunit) * fator;
      if (/pe[cç]a/i.test(it.cat || '')) pecas += v; else mao += v;
    });
  });
  return { atual, anterior, anoPassado, pecas, mao, qtd };
}

// Serviços (mão de obra) que mais faturaram no ano aberto.
export function servicosQueMaisRendem(limite = 6) {
  const mapa = new Map();
  S.orcamentos.forEach(o => {
    if (!orcAceito(o) || !String(o.data || o.criadoEm || '').startsWith(String(S.ano))) return;
    (o.itens || []).forEach(it => {
      if (/pe[cç]a/i.test(it.cat || '') || !String(it.desc || '').trim()) return;
      if (/^(m[ãa]o de obra|servi[çc]o|servi[çc]os|mo)$/i.test(it.desc.trim())) return; // nomes genéricos não dizem qual serviço
      const nome = it.desc.trim().replace(/\s+/g, ' ');
      const k = nome.toLowerCase();
      const v = (num(it.qtd) || 1) * num(it.vunit);
      const a = mapa.get(k) || { nome, total: 0, vezes: 0 };
      a.total += v; a.vezes++; mapa.set(k, a);
    });
  });
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total).slice(0, limite);
}
