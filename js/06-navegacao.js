// RENDER TABS
// ═══════════════════════════════════════════
let sbMesesAberto = false; // controla expansão dos meses

function abrirSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
const _ICO_MINI = { abrir: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>', fechar: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>' };
function toggleSidebarMini() {
  const sb = document.getElementById('sidebar');
  const mini = sb.classList.toggle('mini');
  const btn = document.getElementById('btn-sidebar-mini');
  if (btn) btn.innerHTML = mini ? _ICO_MINI.abrir : _ICO_MINI.fechar;
  try { localStorage.setItem('zl_sb_mini', mini ? '1' : '0'); } catch(e) {}
}
(function(){
  try {
    if (localStorage.getItem('zl_sb_mini') === '1') {
      document.addEventListener('DOMContentLoaded', () => {
        const sb = document.getElementById('sidebar');
        if (sb) { sb.classList.add('mini'); const b = document.getElementById('btn-sidebar-mini'); if(b) b.innerHTML=_ICO_MINI.abrir; }
      });
    }
  } catch(e) {}
})();

function renderTabs() { renderSidebar(); }

function renderSidebar() {
  const sb = document.getElementById('sidebarBody');
  if (!sb) return;
  const mesAtual = new Date().getMonth();
  const anoAtual = document.getElementById('anoGlobal') ? document.getElementById('anoGlobal').value : String(new Date().getFullYear());

  // Badges

  let html = '';
  // ── BUSCA GLOBAL ──
  html += '<div class="sb-item sb-busca-btn" onclick="abrirBuscaGlobal()" title="Busca Global (Ctrl+K)">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>'
    + '<span class="sb-label" style="display:flex;align-items:center;justify-content:space-between;width:100%">Busca Global <span style="font-size:.62rem;opacity:.5;font-family:monospace;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 5px">Ctrl+K</span></span>'
    + '</div>';
  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';
  // ── DASHBOARD ──
  html += '<div class="sb-item' + (abaAtiva===18?' ativo':'') + '" onclick="sbIr(18)">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg></span><span class="sb-label">Dashboard</span></div>';
  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';


  // ── MESES ──
  html += '<div class="sb-item" onclick="sbToggleMeses()">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>'
    + '<span class="sb-label">Meses <small style="font-size:.7rem;opacity:.6;font-weight:400">(' + anoAtual + ')</small></span>'
    + '<span class="sb-expand-btn' + (sbMesesAberto?' open':'') + '" id="sb-expand-meses" style="position:relative;z-index:10;color:white">▾</span>'
    + '</div>'
    + '<div class="sb-meses' + (sbMesesAberto?' open':'') + '" id="sb-meses-wrap">';

  MESES.forEach(function(mes, i) {
    const c = calcularMes(i);
    const isAtivo = abaAtiva === i;
    const isHoje = i === mesAtual;
    let cls = 'sb-mes-item';
    if (isAtivo) cls += ' ativo';
    if (isHoje) cls += ' hoje';
    html += '<div class="' + cls + '" onclick="sbIrMes(' + i + ')">'
      + '<span>' + mes + '</span>'
      + (isHoje ? '<span style="font-size:.62rem;color:var(--verde);opacity:.7">hoje</span>' : '')
      + (!c.vazio && c.totalLiquido < 0 ? '<span style="font-size:.62rem;color:#dd8c8c">▼</span>' : '')
      + '</div>';
  });
  html += '</div>';

  // ── ANUAL ──
  html += '<div class="sb-item' + (abaAtiva===12?' ativo':'') + '" onclick="sbIr(12)">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 3 3 5-6"/></svg></span><span class="sb-label">Resumo Anual</span></div>';

  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';

  // ── MÓDULOS ──
  html += '<div class="sb-section">MÓDULOS</div>';

  html += '<div class="sb-item' + (abaAtiva===13?' ativo':'') + '" onclick="sbIr(13)">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg></span><span class="sb-label">Orçamentos</span></div>';




  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';

  html += '<div class="sb-item' + (abaAtiva===16?' ativo':'') + '" onclick="sbIr(16)">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></span><span class="sb-label">Configurações</span></div>';



  html += '<div class="sb-item' + (abaAtiva===20?' ativo':'') + '" onclick="sbIr(20)">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg></span><span class="sb-label">Clientes</span></div>';

  html += '<div style="height:1px;background:var(--color-border);margin:6px 12px"></div>';

  const mecBadgeTotal = mecRascunhosPendentes;
  const badgeMec = mecRascunhosPendentes > 0
    ? '<span class="sb-badge" style="background:var(--color-primary);color:#fff;border-radius:999px;padding:1px 7px;font-size:.6rem;font-weight:700;min-width:18px;text-align:center;margin-left:auto">' + mecRascunhosPendentes + '</span>'
    : '';

  html += '<div class="sb-item' + (abaAtiva===23?' ativo':'') + '" onclick="sbIr(23)" style="' + (mecRascunhosPendentes>0?'color:var(--color-primary)':'') + '">'
    + '<span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg></span><span class="sb-label" style="display:flex;align-items:center;width:100%">Área do Mecânico' + badgeMec + '</span></div>';
  const _bCP = contasPagarBadge();
  html += '<div class="sb-item' + (abaAtiva===24?' ativo':'') + '" onclick="sbIr(24)" style="' + (_bCP>0?'animation:pulse-red 1.5s infinite':'') + '"><span class="sb-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></span><span class="sb-label" style="display:flex;align-items:center;width:100%">Contas a Pagar' + (_bCP>0?'<span style="margin-left:auto;background:#d16262;color:#fff;border-radius:10px;padding:1px 7px;font-size:.65rem;font-weight:700">' + _bCP + '</span>':'') + '</span></div>';

  sb.innerHTML = html;
}

function sbToggleMeses() {
  sbMesesAberto = !sbMesesAberto;
  renderSidebar();
}

function sbIr(aba) {
  abaAtiva = aba;
  if (aba !== 13) orcModoFormulario = false;
  clienteDetalhe = null;
  filtroCategoria = 'Todos';
  filtroFormaPgto = 'Todos';
  renderAll();
  // fecha em mobile
  if (window.innerWidth <= 900) fecharSidebar();
}

function sbIrMes(i) {
  abaAtiva = i;
  filtroCategoria = 'Todos';
  filtroFormaPgto = 'Todos';
  renderAll();
  if (window.innerWidth <= 900) fecharSidebar();
}

// ═══════════════════════════════════════════
