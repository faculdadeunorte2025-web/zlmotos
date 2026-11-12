// APROVAÇÃO DE ORÇAMENTO VIA LINK
// ═══════════════════════════════════════════
function orcGerarLinkAprovacao(orcId) {
  const orc = orcamentos.find(o => o.id === orcId);
  if (!orc) return;
  // Link para o portal do cliente com parâmetro de aprovação
  const base = 'https://faculdadeunorte2025-web.github.io/ZLMOTOS-CLIENTES/';
  const link = base + '?aprovar=' + orcId + '&uid=' + (window._auth && window._auth.currentUser ? window._auth.currentUser.uid : '');
  navigator.clipboard.writeText(link).then(() => {
    mostrarToast('✓ Link copiado! Envie para o cliente aprovar.');
  }).catch(() => {
    prompt('Copie o link de aprovação:', link);
  });
}

async function orcProcessarAprovacao(orcId, decisao) {
  // Chamado pelo portal do cliente via parâmetro URL
  const orc = orcamentos.find(o => o.id === orcId);
  if (!orc) return;
  orc.status = decisao; // 'aceito' ou 'reprovado'
  orc.decisaoEm = new Date().toISOString();
  await salvarOrcamentos();
}

function orcVerificarAprovacaoURL() {
  const params = new URLSearchParams(window.location.search);
  const aprovar = params.get('aprovar');
  const decisao = params.get('decisao');
  if (aprovar && decisao) {
    orcProcessarAprovacao(aprovar, decisao).then(() => {
      mostrarToast(decisao === 'aceito' ? '✓ Orçamento aprovado pelo cliente!' : '✕ Orçamento recusado pelo cliente');
    });
  }
}

// ══════════════════════════════════════════════════════
