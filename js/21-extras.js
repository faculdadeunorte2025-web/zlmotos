// ══════════════════════════════════════════════════════
// REQ 3: CADASTRO COMPLETO — CPF/CNPJ NA OS E ORÇAMENTO
// ══════════════════════════════════════════════════════

function fmtCPFCNPJ(v) {
  const n = (v||'').replace(/\D/g,'');
  if (n.length <= 11) {
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// ══════════════════════════════════════════════════════
// REQ 4: MÚLTIPLOS VEÍCULOS POR CLIENTE
// ══════════════════════════════════════════════════════

let clientesCadastrados = []; // cache de clientes com múltiplos veículos

function clienteBuscarVeiculos(nome) {
  if (!nome || nome.length < 3) return [];
  const nomeLower = nome.toLowerCase();
  const mapa = {};
  orcamentos.filter(o => o.cliente && o.cliente.toLowerCase().includes(nomeLower)).forEach(os => {
    const key = os.cliente.toLowerCase();
    if (!mapa[key]) mapa[key] = { cliente: os.cliente, veiculos: [] };
    if (os.veiculo && !mapa[key].veiculos.find(v => v.placa === os.placa)) {
      mapa[key].veiculos.push({ veiculo: os.veiculo, placa: os.placa||'' });
    }
  });
  return Object.values(mapa);
}

