# ZL Motos v7.4 — orçamento no mesmo layout do sistema de comissão

- **Cada item tem Peça e Mão de obra.** Você digita o valor normal (à vista) de cada um; a coluna "No cartão" mostra o item já com a taxa.
- **PDF igual ao do sistema de comissão:** tabela Item | Peça | Mão de obra | Total (valores com a taxa da maquininha),
  depois Peças, Mão de obra, "R$ X no cartão" (ou "Até Nx de R$ ... sem juros") e "ou R$ Y no Pix/dinheiro (d% de desconto)".
  Cabeçalho da oficina, dados do cliente, condições e assinaturas continuam.
- **WhatsApp** no mesmo formato.
- **Orçamentos antigos** (tipo + qtd + valor) continuam com o mesmo total. Ao abrir um deles, cada linha vira Peça ou Mão de obra
  conforme o tipo (qtd maior que 1 vai para o nome, ex.: "2x Óleo").
- Taxas e regra de parcelas: as mesmas da v7.3 (Ajustes → Taxas da maquininha).

Arquivos mudados: `index.html` (7.4.0), `js/dados.js`, `js/cartao.js`, `js/analise.js`, `js/telas/orcamentos.js`, `js/telas/ajustes.js`, `js/pdf.js`, `css/app.css`.
