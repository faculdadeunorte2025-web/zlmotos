# ZL Motos v7.3 — ligado ao sistema de comissão

Mudanças (feita em cima da v7.2 do RS Socorro, que continua igual):

- **Cada peça e mão de obra aparece com a taxa da maquininha somada** (coluna "No cartão" na tela, valores no PDF e no WhatsApp). Você digita o valor normal (à vista).
- **Preço no cartão "sem juros"** no orçamento (tela, PDF e WhatsApp): a parcela aparece primeiro e o Pix com desconto embaixo.
  Mesma regra do sistema de comissão: abaixo de R$ 300 é 1x; a cada R$ 300 libera mais uma parcela (até 6x).
  A taxa da parcela máxima vai embutida no preço do cartão; Pix e dinheiro pagam o valor à vista.
- **Ajustes → Taxas da maquininha:** as 6 taxas (1x a 6x). Use as mesmas do sistema de comissão.
- **Registrar pagamento** agora pede a **forma de pagamento**. No cartão já sugere o valor com a taxa. A entrada no Caixa sai com a forma preenchida.
- Pagamentos marcados no sistema de comissão chegam sozinhos (orçamento pago + entrada no Caixa).

Arquivos mudados: `index.html` (versão 7.3.0), `js/cartao.js` (novo), `js/telas/orcamentos.js`, `js/pdf.js`, `js/telas/ajustes.js`.
