# ZL Motos v7.5 — nota fiscal de serviço (NFS-e)

- **Botão "Emitir nota fiscal"** em cada orçamento salvo (não precisa estar pago). A nota leva só a mão de obra.
- **Tela de conferência:** dados do cliente (o que mudar ali fica salvo no cadastro), valor, descrição, competência
  (padrão: mês atual). Se faltar CPF/CNPJ, e-mail, telefone ou endereço com CEP, a nota não sai.
- **Valor padrão:** a mão de obra que o cliente pagou — no cartão vem com a taxa embutida; Pix/dinheiro à vista. Dá pra mudar.
- **Depois de emitir:** número, link de consulta, **PDF** e **WhatsApp** (no celular manda o PDF; no computador baixa o PDF e abre a conversa).
  O orçamento mostra "Nota emitida" e não emite outra sem perguntar. **Cancelar nota** pede o motivo.
- **Cadastro do cliente:** CPF ou CNPJ, e-mail, CEP (busca rua, bairro e cidade sozinho), número, complemento.
- A emissão roda no servidor `zlmotos-nfse` no Render, grátis (veja `servidor-nfse/LEIA-ME-NOTA-FISCAL.md` no Sistema Porcentagem). Depois de 15 min parado ele leva até 1 min pra acordar; a tela de conferência já acorda ele.
  Enquanto ela estiver em homologação, aparece a faixa **MODO TESTE** e as notas ficam marcadas como "teste".

Arquivos: `js/nfse.js` (novo), `js/telas/orcamentos.js`, `js/telas/clientes.js`, `js/telas/ajustes.js`, `css/app.css`, `index.html` (7.5.0).
