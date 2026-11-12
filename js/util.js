// Funções de apoio usadas por todo o sistema.

export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const FORMAS = ['Dinheiro', 'PIX', 'Crédito', 'Débito'];

export const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
export const moeda = v => 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const moedaCurta = v => { v = num(v); return Math.abs(v) >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : moeda(v); };

// Escapa texto para colocar dentro de HTML (evita que nomes com aspas quebrem a tela)
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const gerarId = p => p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
export const copia = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

// Datas sempre no fuso local (nada de toISOString, que usa UTC)
export const isoData = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const hojeISO = () => isoData(new Date());
export const somaDias = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return isoData(d); };
export const horaAgora = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
export const dataBR = iso => { if (!iso) return '—'; const s = String(iso).slice(0, 10); const [a, m, d] = s.split('-'); return a && m && d ? `${d}/${m}/${a}` : '—'; };
export const diaSemana = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
export const diasDesde = iso => iso ? Math.floor((Date.now() - new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso)) / 86400000) : 0;

export const soNumeros = s => String(s || '').replace(/\D/g, '');
export function linkWhats(tel, texto) {
  const t = soNumeros(tel);
  const numero = t ? (t.length <= 11 ? '55' + t : t) : '';
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
}

// ── Avisos ─────────────────────────────────────────────────────────
export function aviso(msg, tipo = 'ok', ms = 2800) {
  const el = document.createElement('div');
  el.className = 'aviso' + (tipo === 'erro' ? ' erro' : '');
  el.textContent = msg;
  document.getElementById('avisos').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
export const erro = (msg) => aviso(msg, 'erro', 4000);

// ── Modal ──────────────────────────────────────────────────────────
// abrirModal({ titulo, corpo (html), rodape (html), largo }) → elemento
export function abrirModal({ titulo, corpo, rodape = '', largo = false, classe = '' }) {
  fecharModal();
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `<div class="modal ${largo ? 'largo' : ''} ${classe}" role="dialog" aria-modal="true">
      ${titulo ? `<div class="modal-topo"><h2>${titulo}</h2><button class="btn btn-fantasma btn-icone" data-acao="fechar-modal" title="Fechar"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>` : ''}
      <div class="modal-corpo">${corpo}</div>
      ${rodape ? `<div class="modal-rodape">${rodape}</div>` : ''}
    </div>`;
  fundo.addEventListener('mousedown', e => { if (e.target === fundo) fecharModal(); });
  document.getElementById('modais').appendChild(fundo);
  const primeiro = fundo.querySelector('input:not([type=hidden]), select, textarea');
  if (primeiro) setTimeout(() => primeiro.focus(), 30);
  return fundo;
}
export function fecharModal() { document.getElementById('modais').innerHTML = ''; }

// Confirmação simples. Retorna Promise<boolean>.
export function confirmar(texto, { botao = 'Confirmar', perigo = false } = {}) {
  return new Promise(resolve => {
    const m = abrirModal({
      titulo: 'Confirmar',
      corpo: `<p style="margin:0">${texto}</p>`,
      rodape: `<div class="direita"><button class="btn" data-r="0">Cancelar</button><button class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-r="1">${esc(botao)}</button></div>`
    });
    m.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { fecharModal(); resolve(b.dataset.r === '1'); }));
  });
}

// Lê os campos [name] de um elemento em um objeto
export function lerForm(el) {
  const o = {};
  el.querySelectorAll('[name]').forEach(i => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
  return o;
}

// Ícones (traço simples)
export const ICONES = {
  inicio: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  caixa: '<path d="M3 7h18v13H3z"/><path d="M3 7l2-4h14l2 4M12 11v5M9.5 13.5h5"/>',
  orcamentos: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  contas: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  esq: '<path d="m15 18-6-6 6-6"/>',
  dir: '<path d="m9 18 6-6-6-6"/>',
  lixo: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/>',
  whats: '<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.3-5.3A8.4 8.4 0 1 1 21 11.5z"/>',
  copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  voltar: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
};
export const icone = (n) => `<svg viewBox="0 0 24 24">${ICONES[n] || ''}</svg>`;
