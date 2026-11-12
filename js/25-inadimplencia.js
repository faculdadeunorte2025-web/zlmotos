// PAGAMENTO ORÇAMENTOS — INADIMPLÊNCIA
// ═══════════════════════════════════════════
function orcRegistrarPagamento(id) {
  const orc = orcamentos.find(o => o.id === id);
  if (!orc) return;
  const total = parseFloat(orc.calc?.total||orc.total||0);
  const fmt   = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const jaFoi = parseFloat(orc.valorPago||0);
  const falta = total - jaFoi;

  const val = prompt('Valor recebido (R$) — ' + (orc.cliente||'') + ' | Total: ' + fmt(total) + ' | Pago: ' + fmt(jaFoi) + ' | Falta: ' + fmt(falta), falta > 0 ? falta.toFixed(2) : total.toFixed(2));
  if (val === null) return;
  const valor = parseFloat(val.toString().replace(',','.')) || 0;
  if (valor <= 0) { mostrarToast('Valor inválido'); return; }

  const novoPago = jaFoi + valor;
  orc.valorPago = novoPago;
  orc.pago = novoPago >= total * 0.999;

  // Salva lista de orçamentos
  try {
    const refOrc = window._userDoc('orcamentos_lista');
    window._firestoreSetDoc(refOrc, { lista: orcamentos, atualizadoEm: new Date().toISOString() });
  } catch(e) { console.warn('Erro ao salvar orçamentos:', e); }
  mostrarToast(orc.pago ? '✓ Orçamento quitado!' : '✓ Pagamento parcial registrado — Falta '+fmt(total-novoPago));
  renderOrcamento();
}
