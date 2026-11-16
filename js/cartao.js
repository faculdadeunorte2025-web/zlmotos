// Preço no cartão "sem juros" — mesma regra do sistema de comissão.
// Abaixo de R$ 300 = 1x; a cada R$ 300 libera mais 1 parcela (R$ 300 = 2x, R$ 600 = 3x… até 6x).
// A taxa embutida é a da parcela máxima, usando a maior entre as bandeiras. Pix e dinheiro pagam o valor à vista.
import { S } from './dados.js';
import { moeda } from './util.js';

export const TAXAS_PADRAO = [3.21, 4.26, 4.94, 5.62, 6.27, 6.92]; // 1x..6x
const PARCELA_MIN = 300;

export function taxasCartao() {
  const t = S.config && S.config.taxasCartao;
  return Array.isArray(t) && t.length === 6 ? t.map(Number) : TAXAS_PADRAO;
}
const c100 = v => Math.round((Number(v) || 0) * 100);
// Taxa do orçamento: a da parcela máxima liberada pelo total à vista (em reais)
function taxaPara(base) { const n = Math.max(1, Math.min(6, Math.floor(c100(base) / (PARCELA_MIN * 100)) + 1)); return { n, t: Number(taxasCartao()[n - 1]) || 0 }; }
// Valor de UMA peça ou mão de obra já com a taxa da maquininha (em reais)
export function noCartao(v, base) { const t = taxaPara(base).t, c = c100(v); return (t > 0 && c > 0 ? Math.round(c / (1 - t / 100)) : c) / 100; }
// base = total à vista; valores = cada peça/mão de obra à vista (subtotais). Sem lista: calcula pelo total.
export function cartao(base, valores) {
  const r = taxaPara(base);
  const cents = Array.isArray(valores) && valores.length ? valores.reduce((a, v) => a + c100(noCartao(v, base)), 0) : c100(noCartao(base, base));
  return { n: r.n, total: cents / 100, parcela: Math.ceil(cents / r.n) / 100, taxa: r.t };
}
// Cartão de um orçamento do sistema: soma cada item com a taxa (com desconto, usa o total)
export function cartaoOrc(o, t) {
  const sub = (o.itens || []).map(it => (Number(String(it.qtd).replace(',', '.')) || 1) * (Number(String(it.vunit).replace(',', '.')) || 0)).filter(v => v > 0);
  return t.desconto > 0 ? cartao(t.total) : cartao(t.total, sub);
}
const pct = x => String(x).replace('.', ',');
export function linhaCartao(base, c) {
  c = c || cartao(base);
  return c.n > 1 ? `Até ${c.n}x de ${moeda(c.parcela)} sem juros (total ${moeda(c.total)})` : `${moeda(c.total)} no cartão`;
}
export function linhaPix(base, c) {
  c = c || cartao(base);
  const d = c.total > base ? Math.floor((c.total - base) * 1000 / c.total) / 10 : 0;
  return `ou ${moeda(base)} no Pix/dinheiro${d ? ` (${pct(d)}% de desconto)` : ''}`;
}
