# ZL Motos — Sistema de Gestão (v6.0.0)

Sistema da oficina, em HTML + JavaScript puro, sem framework. Os dados ficam no Firebase (Firestore).
Para publicar, basta subir esta pasta inteira no GitHub Pages, sem build e sem instalar nada.

## Estrutura

```
index.html                    → telas fixas (login, cabeçalho, menu) e a lista de scripts, na ordem
css/estilos.css               → todo o visual (tema escuro neutro no final do arquivo)
js/salvamento-seguro.js       → gravação segura no Firebase (um aparelho não apaga o que outro gravou)
js/firebase.js                → conexão com o Firebase e login
js/00-imagens.js              → imagem do rodapé dos PDFs
js/01-utilitarios.js          → funções de apoio
js/02-login.js                → login, logout, sessão, troca de senha
js/03-configuracao.js         → meta, tema, backup completo, relatório mensal PDF, categorias, aniversariantes
js/04-dados.js                → carregar/salvar, troca de ano, tempo real
js/05-calculos.js             → totais do mês (entradas, saídas, lucro)
js/06-navegacao.js            → menu lateral
js/07-mes.js                  → tela de cada mês (lançamentos)
js/08-anual.js                → resumo anual e DRE
js/09-migracao-render.js      → migração entre anos, tela de configurações, troca de telas
js/10-busca-atalhos.js        → busca global e atalhos de teclado
js/11-empresa-orcamentos.js   → dados da empresa e orçamentos
js/13-orcamentos-telas.js     → telas de orçamento (lista, kanban, formulário, PDF)
js/18-dashboard.js            → dashboard
js/19-aprovacao-orcamento.js  → aprovação de orçamento por link
js/20-clientes.js             → clientes
js/21-extras.js               → CPF/CNPJ e veículos por cliente
js/22-contas-pagar.js         → contas a pagar
js/25-inadimplencia.js        → pagamento de orçamentos
js/26-pwa.js                  → tela de abertura e instalação no celular
js/27-mecanico.js             → área do mecânico
```

## Onde os dados ficam no Firebase (não mudou)

`zlmotos/{usuário}/dados/...`: `zlmotos_2025`, `zlmotos_2026` (lançamentos de cada ano), `orcamentos_lista`,
`contas_pagar`, `config_geral`, `empresa_config`, `categorias_mes`, além da coleção `zlmotos/{usuário}/clientes`.

Saíram do sistema: **Contador, Fila de Motos, Agendamentos, Ordens de Serviço, Estoque, Catálogo,
Venda no Balcão, Ferramental, Caixa, Relatório por Categoria e Sino**. Os dados delas **continuam guardados
no Firebase** (`os_lista`, `estoque_global`, `vendas_historico`, `agendamentos_lista`...). Nada foi apagado,
e o botão **Configurações → Exportar backup JSON** baixa tudo, inclusive esses dados antigos.

## Ao atualizar

Ao trocar algum arquivo, aumente o número `?v=6.0.0` no `index.html`. Assim os celulares baixam a versão nova.
