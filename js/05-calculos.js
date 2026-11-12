// FORMATAÇÃO / CÁLCULOS
// ═══════════════════════════════════════════
function fmt(v) {
  const n = parseFloat(v)||0;
  return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function num(v) { return parseFloat(v)||0; }
function _gerarId(prefixo) { return prefixo + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,8); }

function calcularMes(m) {
  // Mesmo cálculo para qualquer mês (não trava se faltar alguma lista)
  return calcularMesComDados(m, dados[m]);
}

function calcularMesComDados(m, mesData) {
  if (!mesData) return { totalFixos:0, totalVar:0, totalSaidas:0, totalBruto:0, totalLiquido:0, vazio:true };
  const totalFixos = (mesData.fixos||[]).reduce((s,f) => s+num(f.valor),0)
                   + (mesData.variaveis||[]).filter(v => v.cat==='Fixo').reduce((s,v) => s+num(v.valor)+num(v.valor2),0);
  const totalVar   = (mesData.variaveis||[]).filter(v => v.cat!=='Fixo').reduce((s,v) => s+num(v.valor)+num(v.valor2),0);
  const totalSaidas = totalFixos+totalVar;
  const totalBruto  = (mesData.entradas||[]).reduce((s,e) => s+num(e.valor)+num(e.valor2),0);
  const totalLiquido = totalBruto-totalSaidas;
  const vazio = totalSaidas===0 && totalBruto===0;
  return { totalFixos, totalVar, totalSaidas, totalBruto, totalLiquido, vazio };
}

// Armazena dados de outros anos para comparativo
let dadosTodos = {};
let dadosAnoAnterior = null; // lançamentos do ano anterior (só leitura, usado no gráfico do dashboard)


function tendencia(m) {
  if (m === 0) return null;
  const atual = calcularMes(m).totalLiquido;
  const ant   = calcularMes(m-1).totalLiquido;
  if (ant === 0) return null;
  const pct = ((atual-ant)/Math.abs(ant)*100).toFixed(1);
  return { pct, up: atual >= ant };
}

// ═══════════════════════════════════════════
// CONFIRMAÇÃO DE EXCLUSÃO
// ═══════════════════════════════════════════
function confirmarExclusao(descricao, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <p>Excluir este item?</p>
      <small>${descricao}</small>
      <div class="confirm-btns">
        <button class="btn-confirm-cancel" onclick="this.closest('.confirm-overlay').remove()">Cancelar</button>
        <button class="btn-confirm-del" id="btn-confirm-ok">Excluir</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('btn-confirm-ok').onclick = () => { overlay.remove(); onConfirm(); };
}

// ═══════════════════════════════════════════
