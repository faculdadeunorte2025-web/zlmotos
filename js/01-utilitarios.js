// ─── SEARCH INPUT HELPER ─────────────────────────────────────────
var _searchSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
var _filterSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>';
// ── Utilitários de formatação ────────────────────────────
function limparTel(v) { return (v||'').replace(/\D/g,''); }
function fmtTel(v) {
  const d = limparTel(v);
  if (d.length === 11) return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
  return v || '';
}
function limparCPFCNPJ(v) { return (v||'').replace(/\D/g,''); }

function searchWrap(inputAttrs, wrapStyle) {
  var ws = wrapStyle ? ' style="' + wrapStyle + '"' : '';
  return '<div class="search-wrap"' + ws + '>'
    + '<div class="search-layer sl-dark"></div>'
    + '<div class="search-layer sl-white"></div>'
    + '<div class="search-layer sl-border"></div>'
    + '<div class="search-layer sl-glow"></div>'
    + '<span class="search-icon">' + _searchSvg + '</span>'
    + '<div class="search-pink"></div>'
    + '<input class="search-input" type="text" ' + (inputAttrs||'') + '/>'
    + '<div class="search-filter-btn">' + _filterSvg + '</div>'
    + '</div>';
}
// ─────────────────────────────────────────────────────────────────

// ─── BTN ADD HELPER ──────────────────────────────────────────────
var _plusSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
function btnAdd(label, onclick, opts) {
  opts = opts || {};
  var cls = 'btn btn-add' + (opts.cls ? ' ' + opts.cls : '') + (opts.sm ? ' btn-sm' : '');
  var style = opts.style ? ' style="' + opts.style + '"' : '';
  return '<button class="' + cls + '"' + style + ' onclick="' + onclick + '">'
    + label
    + '<span class="btn-add-icon">' + _plusSvg + '</span>'
    + '</button>';
}
// ─────────────────────────────────────────────────────────────────

// ─── NEON CHECKBOX HELPER ────────────────────────────────────────
function neonChk(attrs, extraClass) {
  var cls = 'neon-checkbox' + (extraClass ? ' ' + extraClass : '');
  return '<label class="' + cls + '">'
    + '<input type="checkbox" ' + (attrs||'') + '/>'
    + '<div class="neon-checkbox__frame">'
    + '<div class="neon-checkbox__glow"></div>'
    + '<div class="neon-checkbox__box"></div>'
    + '<div class="neon-checkbox__borders"><span></span><span></span><span></span><span></span></div>'
    + '<div class="neon-checkbox__check-container">'
    + '<svg class="neon-checkbox__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
    + '</div>'
    + '<div class="neon-checkbox__particles"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>'
    + '<div class="neon-checkbox__rings"><div class="ring"></div><div class="ring"></div><div class="ring"></div></div>'
    + '<div class="neon-checkbox__sparks"><span></span><span></span><span></span><span></span></div>'
    + '</div>'
    + '</label>';
}
// ─────────────────────────────────────────────────────────────────

// ╔══════════════════════════════════════════════════════════════╗
// ║               ZL MOTOS — ÍNDICE DO SISTEMA                  ║
// ║         Use Ctrl+F para navegar até cada seção               ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  [LOGIN]         LOGIN / LOGOUT — Firebase Authentication    ║
// ║  [CADASTRO]      CADASTRO — Firebase Authentication          ║
// ║  [CONFIG]        CONFIGURAÇÃO (empresa, checklist, margens)  ║
// ║  [INIT]          INICIALIZAR / SALVAR (Firestore)            ║
// ║  [FORMAT]        FORMATAÇÃO / CÁLCULOS                       ║
// ║  [TABS]          RENDER TABS / SIDEBAR                       ║
// ║  [MES]           RENDER MÊS (entradas, saídas, fixos)        ║
// ║  [ANUAL]         ABA ANUAL (resumo do ano, gráficos)         ║
// ║  [ORCAMENTO]     ORÇAMENTO (formulário, PDF, WhatsApp)       ║
// ║  [CATALOGO]      CATÁLOGO DE PEÇAS                           ║
// ║  [ESTOQUE]       ESTOQUE (peças, movimentações, alertas)     ║
// ║  [OS]            MÓDULO ORDENS DE SERVIÇO                    ║
// ║  [COMPROVANTE]   COMPROVANTE DE PRESTAÇÃO DE SERVIÇOS        ║
// ║  [DASHBOARD]     DASHBOARD INICIAL                           ║
// ║  [TEMPO_MEDIO]   RELATÓRIO: TEMPO MÉDIO POR TIPO DE SERVIÇO  ║
// ║  [GARANTIAS]     RELATÓRIO: GARANTIAS PRÓXIMAS DO VENCIMENTO ║
// ║  [CONTAS]        MÓDULO CONTAS A PAGAR                       ║
// ║  [CAIXA]         FECHAMENTO DE CAIXA DIÁRIO                  ║
// ║  [AGENDAMENTOS]  MÓDULO AGENDAMENTOS                         ║
// ║  [BOT]           CHAT ASSISTENTE / BOT ZL MOTOS              ║
// ╚══════════════════════════════════════════════════════════════╝



// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
