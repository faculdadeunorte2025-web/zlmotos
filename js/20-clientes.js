// CLIENTES
// ══════════════════════════════════════════════════════

let clientesCadastradosManuais = [];
let clienteDetalhe = null; // id do cliente em detalhe
let clienteModalAberto = false;
let clienteEditandoId = null;

// ── Pontuação fidelidade ──────────────────────────────
const PONTOS_POR_OS = 10; // pontos por orçamento aceito
function _orcTotal(o) { return parseFloat((o.calc && o.calc.total) || o.total || 0) || 0; }
function fidelidadeCalcularPontos(nome) {
  return orcamentos.filter(o =>
    (o.status==='aceito'||o.status==='aprovado') &&
    (o.cliente||'').toLowerCase().trim() === nome.toLowerCase().trim()
  ).length * PONTOS_POR_OS;
}
function fidelidadeBadge(pontos) {
  if (pontos >= 500) return { label:'Diamante', cor:'#b0b0b3', icon:'', next: null,     prox: 0,   beneficio:'15% de desconto em peças' };
  if (pontos >= 200) return { label:'Platinum',  cor:'#e9e9ec', icon:'', next: 500,    prox: 500-pontos, beneficio:'10% de desconto em peças' };
  if (pontos >= 100) return { label:'Ouro',      cor:'#d4d4d8', icon:'', next: 200,    prox: 200-pontos, beneficio:'5% de desconto em serviços' };
  if (pontos >= 50)  return { label:'Prata',     cor:'#a6a6a9', icon:'', next: 100,    prox: 100-pontos, beneficio:'Prioridade no agendamento' };
  return               { label:'Bronze',     cor:'#d4d4d8', icon:'', next: 50,     prox: 50-pontos,  beneficio:'Acesso ao programa de fidelidade' };
}
function fidelidadeBadgeHTML(pontos) {
  const b = fidelidadeBadge(pontos);
  return `<span style="font-size:.65rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:1px 6px;color:${b.cor}">${b.icon} ${b.label} · ${pontos}pts</span>`;
}
function fidelidadeProgressoHTML(pontos) {
  const b = fidelidadeBadge(pontos);
  if (!b.next) return `<div style="font-size:.72rem;color:${b.cor};text-align:center">${b.icon} Nível máximo! ${b.beneficio}</div>`;
  const pct = Math.min(100, Math.round(((pontos-(b.next-b.prox-b.prox))/b.prox)*100));
  const pctReal = Math.round((pontos / b.next) * 100);
  return `<div style="font-size:.68rem;color:var(--color-text-muted);margin-bottom:4px">${b.icon} ${b.label} · <b style="color:${b.cor}">${pontos} pts</b> · Faltam <b>${b.prox}</b> pts para ${fidelidadeBadge(b.next).label}</div>
    <div style="height:5px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden">
      <div style="height:100%;width:${Math.min(100,pctReal)}%;background:${b.cor};border-radius:999px"></div>
    </div>
    <div style="font-size:.62rem;color:var(--color-text-muted);margin-top:2px">${b.beneficio}</div>`;
}

// ── Carregar / Salvar ────────────────────────────────
async function carregarClientesManuais() {
  try {
    if (window._firestoreGetDocs && window._userCollection) {
      const col  = window._userCollection('clientes');
      const snap = await window._firestoreGetDocs(col);
      if (!snap.empty) {
        clientesCadastradosManuais = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return;
      }
      // Migração legado
      try {
        const ref  = window._userDoc('clientes_manuais');
        const sn2  = await window._firestoreGetDoc(ref);
        if (sn2 && sn2.exists && sn2.exists()) {
          const lista = sn2.data().lista || [];
          clientesCadastradosManuais = lista;
          for (const cli of lista) {
            const docRef = window._userCollectionDoc('clientes', cli.id || ('cli_'+Date.now()+Math.random()));
            await window._firestoreSetDoc(docRef, cli);
          }
        }
      } catch(e2) {}
    }
  } catch(e) { console.warn('Erro ao carregar clientes:', e); }
}

async function salvarCliente(cli) {
  try {
    if (window._firestoreSetDoc && window._userCollectionDoc) {
      const ref = window._userCollectionDoc('clientes', cli.id);
      await window._firestoreSetDoc(ref, cli);
    }
  } catch(e) { console.warn('Erro ao salvar cliente:', e); }
}

async function deletarCliente(id) {
  try {
    if (window._firestoreDeleteDoc && window._userCollectionDoc) {
      const ref = window._userCollectionDoc('clientes', id);
      await window._firestoreDeleteDoc(ref);
    }
  } catch(e) { console.warn('Erro ao deletar cliente:', e); }
}

// ── Modal de cadastro / edição ───────────────────────
function clienteAbrirModal(id) {
  clienteEditandoId = id || null;
  clienteModalAberto = true;
  renderClientes();
}

function clienteFecharModal() {
  clienteModalAberto = false;
  clienteEditandoId = null;
  renderClientes();
}

async function clienteSalvarModal() {
  const nome       = (document.getElementById('cli-nome')?.value      || '').trim();
  const tel        = limparTel(document.getElementById('cli-tel')?.value || '');
  const cpf        = (document.getElementById('cli-cpf')?.value       || '').trim();
  const veic       = (document.getElementById('cli-veic')?.value      || '').trim();
  const placa      = (document.getElementById('cli-placa')?.value     || '').trim().toUpperCase();
  const email      = (document.getElementById('cli-email')?.value     || '').trim();
  const obs        = (document.getElementById('cli-obs')?.value       || '').trim();
  const endereco   = (document.getElementById('cli-endereco')?.value  || '').trim();
  const nascimento = (document.getElementById('cli-nasc')?.value      || '').trim();

  if (!nome) { mostrarToast('Informe o nome do cliente'); return; }

  if (clienteEditandoId) {
    const idx = clientesCadastradosManuais.findIndex(c => c.id === clienteEditandoId);
    if (idx >= 0) {
      clientesCadastradosManuais[idx] = { ...clientesCadastradosManuais[idx], nome, tel, cpf, veic, placa, email, obs, endereco, nascimento };
      await salvarCliente(clientesCadastradosManuais[idx]);
      mostrarToast('✓ Cliente atualizado');
    }
  } else {
    const existe = clientesCadastradosManuais.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    if (existe) { mostrarToast('Cliente já cadastrado'); return; }
    const id  = 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
    const cli = { id, nome, tel, cpf, veic, placa, email, obs, endereco, nascimento, criadoEm: new Date().toISOString() };
    clientesCadastradosManuais.push(cli);
    await salvarCliente(cli);
    mostrarToast('✓ Cliente cadastrado');
  }

  clienteFecharModal();
}

async function clienteExcluirSemId(nome) {
  confirmarExclusao('o cliente "' + nome + '"', async () => {
    // Cadastra rapidamente e já exclui
    const id = 'cli_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
    const cli = { id, nome, tel:'', cpf:'', veic:'', placa:'', email:'', obs:'', criadoEm: new Date().toISOString(), excluido: true };
    clientesCadastradosManuais.push(cli);
    await salvarCliente(cli);
    await deletarCliente(id);
    clientesCadastradosManuais = clientesCadastradosManuais.filter(c => c.id !== id);
    mostrarToast('✓ Cliente removido');
    renderClientes();
  });
}

async function clienteExcluir(id) {
  confirmarExclusao('este cliente', async () => {
    clientesCadastradosManuais = clientesCadastradosManuais.filter(c => c.id !== id);
    await deletarCliente(id);
    if (clienteDetalhe === id) clienteDetalhe = null;
    mostrarToast('✓ Cliente removido');
    renderClientes();
  });
}

// ── Modal HTML ───────────────────────────────────────
function clienteModalHTML() {
  const cli = clienteEditandoId ? clientesCadastradosManuais.find(c => c.id === clienteEditandoId) : null;
  const titulo = cli ? 'Editar Cliente' : '+ Novo Cliente';

  return `<div onclick="if(event.target===this)clienteFecharModal()"
    style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px">
    <div onclick="event.stopPropagation()" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <div style="font-size:.9rem;font-weight:700;color:var(--color-text-primary)">${titulo}</div>
        <button onclick="clienteFecharModal()" style="background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="orc-field"><label>Nome *</label>
          <input id="cli-nome" type="text" placeholder="Nome completo" value="${cli?.nome||''}" style="text-transform:capitalize"/>
        </div>
        <div style="display:flex;gap:10px">
          <div class="orc-field" style="flex:1"><label>Telefone</label>
            <input id="cli-tel" type="text" placeholder="(17) 99999-9999" value="${cli?.tel||''}"/>
          </div>
          <div class="orc-field" style="flex:1"><label>CPF/CNPJ</label>
            <input id="cli-cpf" type="text" placeholder="000.000.000-00" value="${cli?.cpf||''}"/>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <div class="orc-field" style="flex:1"><label>Veículo</label>
            <input id="cli-veic" type="text" placeholder="Ex: Honda CG 160" value="${cli?.veic||''}"/>
          </div>
          <div class="orc-field" style="width:130px"><label>Placa</label>
            <input id="cli-placa" type="text" placeholder="ABC-1234" maxlength="8" value="${cli?.placa||''}" style="text-transform:uppercase;font-family:'JetBrains Mono',monospace"/>
          </div>
        </div>
        <div class="orc-field"><label>E-mail</label>
          <input id="cli-email" type="email" placeholder="email@exemplo.com" value="${cli?.email||''}"/>
        </div>
        <div class="orc-field"><label>Data de Nascimento</label>
          <input id="cli-nasc" type="date" value="${cli?.nascimento||''}"/>
        </div>
        <div class="orc-field"><label>Endereço</label>
          <input id="cli-endereco" type="text" placeholder="Rua, número, bairro, cidade..." value="${cli?.endereco||''}"/>
        </div>
        <div class="orc-field"><label>Observações</label>
          <textarea id="cli-obs" placeholder="Anotações sobre o cliente..." style="height:60px;resize:vertical">${cli?.obs||''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button onclick="clienteFecharModal()" style="flex:1;padding:10px;background:transparent;border:1px solid var(--color-border);color:var(--color-text-muted);border-radius:8px;cursor:pointer;font-size:.85rem">Cancelar</button>
        <button onclick="clienteSalvarModal()" style="flex:2;padding:10px;background:var(--color-primary);border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:.85rem;font-weight:700">Salvar</button>
      </div>
    </div>
  </div>`;
}

// ── Render principal ─────────────────────────────────
function renderClientes() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  const fmt = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  if (clienteDetalhe) { renderClienteDetalhe(clienteDetalhe); return; }

  // Monta mapa
  const mapa = {};
  // Clientes a partir dos orçamentos (faturamento = orçamentos aceitos)
  orcamentos.forEach(os => {
    const nome = (os.cliente||'').trim();
    if (!nome) return;
    if (!mapa[nome]) mapa[nome] = { nome, veiculos:[], osTotal:0, faturamento:0 };
    mapa[nome].osTotal++;
    if (os.status==='aceito'||os.status==='aprovado') mapa[nome].faturamento += _orcTotal(os);
    if (os.veiculo && !mapa[nome].veiculos.find(v=>v.placa===(os.placa||'')))
      mapa[nome].veiculos.push({ veiculo:os.veiculo, placa:os.placa||'' });
  });

  clientesCadastradosManuais.forEach(c => {
    if (!mapa[c.nome]) mapa[c.nome] = { nome:c.nome, veiculos:[], osTotal:0, faturamento:0 };
    mapa[c.nome].id        = c.id;
    mapa[c.nome].tel       = c.tel||c.telefone||'';
    mapa[c.nome].cpf       = c.cpf||c.cpfcnpj||'';
    mapa[c.nome].email     = c.email||'';
    mapa[c.nome].obs       = c.obs||'';
    mapa[c.nome].criadoEm  = c.criadoEm||'';
    mapa[c.nome].endereco  = c.endereco||'';
    mapa[c.nome].nascimento= c.nascimento||'';
    if (c.veic && !mapa[c.nome].veiculos.find(v=>v.placa===(c.placa||'')))
      mapa[c.nome].veiculos.push({ veiculo:c.veic||c.veiculo||'', placa:c.placa||'' });
  });

  const clientes = Object.values(mapa).sort((a,b) => {
    const ta = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
    const tb = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
    if(tb !== ta) return tb - ta;
    return b.faturamento - a.faturamento;
  });

  // Grupos de datas
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate()-1);
  const grupos = {};
  const ordemGrupos = [];
  clientes.forEach(c => {
    let chave = 'Sem data';
    if (c.criadoEm) {
      const d = new Date(c.criadoEm); d.setHours(0,0,0,0);
      if (d.getTime()===hoje.getTime()) chave='Hoje';
      else if (d.getTime()===ontem.getTime()) chave='Ontem';
      else chave=new Date(c.criadoEm).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
    }
    if (!grupos[chave]) { grupos[chave]=[]; ordemGrupos.push(chave); }
    grupos[chave].push(c);
  });

  // Aniversariantes
  const anivHoje = aniversariantesHoje();
  const anivSemana = aniversariantesSemana().filter(c=>!anivHoje.find(a=>a.id===c.id));
  const anivHTML = (anivHoje.length>0||anivSemana.length>0) ? `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.125);border-radius:12px;padding:12px 16px;margin-bottom:14px">
      <div style="font-size:.72rem;letter-spacing:1px;color:#b3b3b6;margin-bottom:8px">ANIVERSARIANTES</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px">
        ${[...anivHoje.map(c=>({...c,_hoje:true})),...anivSemana].map(c=>{
          const nasc=new Date(c.nascimento+'T12:00:00');
          const dias=c._hoje?0:Math.ceil((new Date(new Date().getFullYear(),nasc.getMonth(),nasc.getDate())-new Date())/86400000);
          const tel=(c.tel||'').replace(/\D/g,'');
          return `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;display:flex;align-items:center;gap:8px">
            <div><div style="font-weight:700;font-size:.82rem">${c.nome}</div><div style="font-size:.65rem;color:var(--color-text-muted)">${c._hoje?'Hoje!':'Em '+dias+'d'}</div></div>
            ${tel?`<button onclick="whatsAppAniversario(${JSON.stringify(c).replace(/"/g,'&quot;')})" style="font-size:.7rem;padding:3px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:#5cab84;border-radius:6px;cursor:pointer">WhatsApp</button>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const renderCard = c => {
    const pontos = fidelidadeCalcularPontos(c.nome);
    const badge  = fidelidadeBadge(pontos);
    const veicStr= c.veiculos.map(v=>v.veiculo+(v.placa?' · '+v.placa:'')).join(', ')||'—';
    // Usar nome como identificador quando não tem id
    const cliKey  = c.id || c.nome;
    const cliKeyEsc = cliKey.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const cliNomeEsc= c.nome.replace(/'/g,"\\'");
    const telEsc  = (c.tel||'').replace(/'/g,"\\'");
    const veicEsc = (c.veiculos[0]?.veiculo||'').replace(/'/g,"\\'");
    const placaEsc= (c.veiculos[0]?.placa||'').replace(/'/g,"\\'");
    return '<div class="orc-glass-card" style="--card-accent:rgba(255,255,255,0.2)" onclick="clienteDetalhe=\'' + cliKeyEsc + '\';renderClientes()">'
      + '<div class="orc-card-dots"><div class="orc-card-dot r"></div><div class="orc-card-dot y"></div><div class="orc-card-dot g"></div></div>'
      + '<div class="orc-card-collapsed">'
      + '<div class="orc-card-cliente" title="' + c.nome + '">' + c.nome + '</div>'
      + '<div class="orc-card-veiculo">' + veicStr + '</div>'
      + '<div class="orc-card-total">' + fmt(c.faturamento) + '</div>'
      + '</div>'
      + '<div class="orc-card-expanded">'
      + '<div class="orc-card-info-row"><b>' + c.osTotal + '</b> orçamento(s) &nbsp;·&nbsp; ' + fidelidadeBadgeHTML(pontos) + '</div>'
      + (c.tel ? '<div class="orc-card-info-row">' + c.tel + '</div>' : '')
      + (c.cpf ? '<div class="orc-card-info-row">' + c.cpf + '</div>' : '')
      + '<div class="orc-card-btns">'
      + (c.id ? '<button class="btn btn-sm btn-duplic" onclick="event.stopPropagation();clienteAbrirModal(\'' + c.id + '\')">Editar</button>' : '')
      + (c.id ? '<button class="btn btn-del btn-sm" onclick="event.stopPropagation();clienteExcluir(\'' + c.id + '\')">✕</button>' : '')
      + '<button class="btn btn-add btn-sm" onclick="event.stopPropagation();orcNovoOrcamento({nome:\'' + cliNomeEsc + '\',telefone:\'' + telEsc + '\',veiculo:\'' + veicEsc + '\',placa:\'' + placaEsc + '\'});sbIr(13)">+ Orçamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>'
      + '</div>'
      + '</div>'
      + '</div>';
  };

  // Acordeão por data (igual entradas/saídas)
  const cards = clientes.length === 0
    ? '<div style="color:var(--color-text-muted);font-size:.85rem;padding:32px;text-align:center">Nenhum cliente ainda. Cadastre o primeiro!</div>'
    : ordemGrupos.map((chave, gi) => {
        const label = chave==='Hoje'?'Hoje':chave==='Ontem'?'Ontem':chave==='Sem data'?'Sem data':chave;
        const grpId = 'cli-grp-' + gi;
        const isFirst = gi === 0;
        const qtd = grupos[chave].length;
        return '<div style="margin-bottom:8px">'
          + '<div onclick="toggleGrupo(\'' + grpId + '\')" style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;cursor:pointer;user-select:none">'
          + '<div style="display:flex;align-items:center;gap:10px">'
          + '<span style="font-size:.82rem;font-weight:700;color:#98989b">' + label + '</span>'
          + '<span style="font-size:.68rem;color:var(--color-text-muted)">' + qtd + ' cliente(s)</span>'
          + '</div>'
          + '<span id="arr-' + grpId + '" style="color:var(--color-text-muted);font-size:.85rem">' + (isFirst ? '▼' : '▶') + '</span>'
          + '</div>'
          + '<div id="' + grpId + '" style="display:' + (isFirst ? 'block' : 'none') + ';margin-top:6px">'
          + '<div class="orc-cards-grid" id="cli-grid-' + gi + '">'
          + grupos[chave].map(renderCard).join('')
          + '</div>'
          + '</div>'
          + '</div>';
      }).join('');

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter',sans-serif;font-size:1.35rem;letter-spacing:.5px;color:#98989b">Clientes</span>
      <div class="toolbar-right">
        <span style="font-size:.75rem;color:var(--color-text-muted)">${clientes.length} cliente(s)</span>
        <button class="btn btn-add" onclick="clienteAbrirModal()">+ Novo Cliente<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
      </div>
    </div>
    ${anivHTML}
    <div style="margin-bottom:12px">
      <input type="text" id="cli-busca" placeholder="Buscar por nome, telefone ou veículo..."
        oninput="cliFiltroBusca(this.value)"
        style="width:100%;max-width:480px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:10px;padding:9px 14px;font-size:.85rem;outline:none"/>
    </div>
    <div id="cli-acordeao">${cards}</div>
  `;

  let mc = document.getElementById('cli-modal-container');
  if (!mc) { mc=document.createElement('div'); mc.id='cli-modal-container'; document.body.appendChild(mc); }
  mc.innerHTML = clienteModalAberto ? clienteModalHTML() : '';
  if (clienteModalAberto) setTimeout(()=>document.getElementById('cli-nome')?.focus(),50);
}

// Busca de clientes — funciona com layout acordeão
function cliFiltroBusca(busca) {
  const acordeao = document.getElementById('cli-acordeao');
  if (!acordeao) return;
  const b = busca.toLowerCase().trim();
  // Mostrar/ocultar cards
  acordeao.querySelectorAll('.orc-glass-card').forEach(card => {
    const txt = card.textContent.toLowerCase();
    card.style.display = (!b || txt.includes(b)) ? '' : 'none';
  });
  // Mostrar/ocultar grupos e garantir que grupos com resultados estejam abertos
  acordeao.querySelectorAll('[id^="cli-grp-"]').forEach(grp => {
    const temVisivel = [...grp.querySelectorAll('.orc-glass-card')].some(c => c.style.display !== 'none');
    const wrapper = grp.parentElement;
    if (wrapper) wrapper.style.display = temVisivel ? '' : 'none';
    if (temVisivel && b) {
      grp.style.display = 'block';
      const gi = grp.id.replace('cli-grp-', '');
      const arr = document.getElementById('arr-cli-grp-' + gi);
      if (arr) arr.textContent = '▼';
    }
  });
}

function renderClienteDetalhe(idOuNome) {
  const main = document.getElementById('mainContent');
  const fmt  = v => 'R$ ' + parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const fmtD = d => d ? new Date(d.length===10?d+'T12:00:00':d).toLocaleDateString('pt-BR') : '—';
  const fmtDT = d => d ? new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

  const cliCad = clientesCadastradosManuais.find(c => c.id===idOuNome || c.nome===idOuNome);
  const nome   = cliCad ? cliCad.nome : idOuNome;

  const orcCliente = orcamentos.filter(o => (o.cliente||'').toLowerCase().trim()===nome.toLowerCase().trim());

  const pontos     = fidelidadeCalcularPontos(nome);
  const badge      = fidelidadeBadge(pontos);
  const faturamentoTotal = orcCliente.filter(o=>(o.status==='aceito'||o.status==='aprovado')).reduce((s,o)=>s+_orcTotal(o),0);

  const veiculos = [];
  orcCliente.forEach(os => {
    if (os.veiculo && !veiculos.find(v=>v.placa===(os.placa||'')))
      veiculos.push({ veiculo:os.veiculo, placa:os.placa||'' });
  });
  if (cliCad?.veic && !veiculos.find(v=>v.veiculo===cliCad.veic))
    veiculos.push({ veiculo:cliCad.veic, placa:cliCad.placa||'' });

  // ── Histórico unificado ──────────────────────────────────────
  const eventos = [];

  orcCliente.forEach(o => {
    const s = o.status||'pendente';
    const statusLabel = {aprovado:'Aprovado',reprovado:'Reprovado',enviado:'Enviado',pendente:'Pendente',aceito:'Aceito'}[s]||s;
    const statusCor   = {aprovado:'#5cab84',reprovado:'#dd8c8c',enviado:'#adadb0',aceito:'#5cab84'}[s]||'#d4d4d8';
    eventos.push({
      tipo: 'orc', icon: '', cor: '#5cab84',
      data: o.criadoEm||o.data||'',
      titulo: 'Orçamento' + (o.veiculo?' — '+o.veiculo:''),
      sub: o.data ? fmtD(o.data) : '',
      desc: (o.itens||[]).slice(0,3).map(it=>it.desc).join(', '),
      valor: parseFloat(o.calc&&o.calc.total||o.total||0),
      badge: statusLabel, badgeCor: statusCor,
      acao: `sbIr(13);orcCarregar('${o.id||o._id||''}')`
    });
  });

  // Ordenar mais recente primeiro
  eventos.sort((a,b) => (b.data||'').localeCompare(a.data||''));

  // ── Filtro por tipo ──────────────────────────────────────────
  const filtroAtivo = window._cliHistFiltro || 'todos';
  const eventosFiltrados = filtroAtivo === 'todos' ? eventos
    : eventos.filter(e => e.tipo === filtroAtivo);

  const totalFiltrado = eventosFiltrados.reduce((s,e)=>s+e.valor,0);

  const historicoHTML = eventosFiltrados.length === 0
    ? '<div style="text-align:center;padding:40px;color:var(--color-text-muted)">Nenhum registro encontrado</div>'
    : eventosFiltrados.map(ev => `
        <div ${ev.acao?`onclick="${ev.acao}" style="cursor:pointer"`:'style="cursor:default"'}
          style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);margin-bottom:8px;transition:background .15s"
          ${ev.acao?'onmouseover="this.style.background=\'rgba(255,255,255,.07)\'" onmouseout="this.style.background=\'rgba(255,255,255,.03)\'"':''}>
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(${ev.cor==='#adadb0'?'96,165,250':ev.cor==='#5cab84'?'52,211,153':ev.cor==='#d4d4d8'?'251,191,36':'167,139,250'},.15);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${ev.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div>
                <div style="font-weight:700;font-size:.88rem;color:#fff">${ev.titulo}</div>
                ${ev.sub?`<div style="font-size:.72rem;color:var(--color-text-muted);margin-top:1px">${ev.sub}</div>`:''}
                ${ev.desc?`<div style="font-size:.72rem;color:var(--color-text-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px">${ev.desc}</div>`:''}
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:.95rem;font-weight:700;color:#8fc6ab">${ev.valor>0?fmt(ev.valor):'—'}</div>
                <div style="font-size:.65rem;color:var(--color-text-muted);margin-top:2px">${fmtDT(ev.data)}</div>
              </div>
            </div>
            <div style="margin-top:5px">
              <span style="font-size:.65rem;font-weight:700;color:${ev.badgeCor}">${ev.badge}</span>
              ${ev.acao?'<span style="font-size:.62rem;color:rgba(255,255,255,.2);margin-left:8px">→ abrir</span>':''}
            </div>
          </div>
        </div>`
    ).join('');

  // ── Info do cliente ──────────────────────────────────────────
  const nascFmt = cliCad?.nascimento ? new Date(cliCad.nascimento+'T12:00:00').toLocaleDateString('pt-BR') : null;
  const idade = cliCad?.nascimento ? Math.floor((new Date()-new Date(cliCad.nascimento+'T12:00:00'))/(365.25*24*60*60*1000)) : null;

  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter',sans-serif;font-size:1.35rem;letter-spacing:.5px;color:#98989b">${nome}</span>
      <div class="toolbar-right">
        ${cliCad?`<button class="btn btn-sm btn-duplic" onclick="clienteAbrirModal('${cliCad.id}')">Editar</button>`:''}
        <button class="btn btn-voltar" onclick="clienteDetalhe=null;renderClientes()" title="Voltar"><span class="bv-box"><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><svg class="bv-elem" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#c3c3c6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></span></button>
        <button class="btn btn-add" onclick="orcNovoOrcamento({nome:'${nome.replace(/'/g,"\\'")}',telefone:'${(cliCad?.tel||'').replace(/'/g,"\\'")}',veiculo:'${(cliCad?.veic||'').replace(/'/g,"\\'")}',placa:'${(cliCad?.placa||'').replace(/'/g,"\\'")}' });sbIr(13)">+ Orçamento<span class="btn-add-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></button>
      </div>
    </div>

    <!-- CARDS RESUMO -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.075);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;color:#5cab84">${orcCliente.length}</div>
        <div style="font-size:.65rem;color:var(--color-text-muted)">Orçamentos</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.075);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:.85rem;font-weight:900;color:#8fc6ab;font-family:'JetBrains Mono',monospace">${fmt(faturamentoTotal)}</div>
        <div style="font-size:.65rem;color:var(--color-text-muted)">Total Gasto</div>
      </div>
      <div style="background:rgba(${badge.cor==='#d4d4d8'?'255,215,0':badge.cor==='#C0C0C0'?'192,192,192':badge.cor==='#d4d4d8'?'205,127,50':'100,100,100'},.06);border:1px solid rgba(255,255,255,0.075);border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.2rem;font-weight:900;color:${badge.cor}">${badge.icon} ${pontos}</div>
        <div style="font-size:.65rem;color:var(--color-text-muted)">${badge.label}</div>
      </div>
    </div>
    <!-- Barra de progresso fidelidade -->
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 14px;margin-bottom:16px">
      ${fidelidadeProgressoHTML(pontos)}
    </div>

    <div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">

      <!-- INFO DO CLIENTE -->
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="background:rgba(42,42,45,.6);border:1px solid var(--color-border);border-radius:12px;padding:14px">
          <div style="font-family:'Inter',sans-serif;font-size:.8rem;letter-spacing:.5px;color:#98989b;margin-bottom:10px">DADOS</div>
          <div style="display:flex;flex-direction:column;gap:7px;font-size:.82rem">
            ${cliCad?.tel?`<div><span style="color:var(--color-text-muted);font-size:.68rem">Telefone</span><br><b>${cliCad.tel}</b></div>`:''}
            ${cliCad?.email?`<div><span style="color:var(--color-text-muted);font-size:.68rem">E-mail</span><br><b>${cliCad.email}</b></div>`:''}
            ${cliCad?.cpf?`<div><span style="color:var(--color-text-muted);font-size:.68rem">CPF/CNPJ</span><br><b>${cliCad.cpf}</b></div>`:''}
            ${nascFmt?`<div><span style="color:var(--color-text-muted);font-size:.68rem">Nascimento</span><br><b>${nascFmt}</b>${idade?` <span style="color:var(--color-text-muted);font-size:.68rem">(${idade} anos)</span>`:''}</div>`:''}
            ${cliCad?.endereco?`<div><span style="color:var(--color-text-muted);font-size:.68rem">Endereço</span><br><b>${cliCad.endereco}</b></div>`:''}
            ${veiculos.length?`<div><span style="color:var(--color-text-muted);font-size:.68rem">Veículos</span><br>${veiculos.map(v=>'<b>'+v.veiculo+'</b>'+(v.placa?' <span style="color:var(--color-text-muted)">'+v.placa+'</span>':'')).join('<br>')}</div>`:''}
            ${cliCad?.obs?`<div><span style="color:var(--color-text-muted);font-size:.68rem">Obs</span><br><span style="color:var(--color-text-muted)">${cliCad.obs}</span></div>`:''}
          </div>
        </div>
      </div>

      <!-- HISTÓRICO UNIFICADO -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-family:'Inter',sans-serif;font-size:.85rem;letter-spacing:.5px;color:#fff">HISTÓRICO COMPLETO</div>
          <div style="display:flex;gap:6px;align-items:center">
            ${[['todos','Tudo'],['os','OS'],['orc','Orç.'],['venda','Vendas']].map(([id,label])=>
              `<button onclick="window._cliHistFiltro='${id}';renderClienteDetalhe('${idOuNome}')"
                style="padding:5px 10px;border-radius:8px;font-size:.72rem;cursor:pointer;
                border:1px solid ${filtroAtivo===id?'rgba(152,152,155,.5)':'rgba(255,255,255,.1)'};
                background:${filtroAtivo===id?'rgba(255,255,255,0.075)':'rgba(255,255,255,.04)'};
                color:${filtroAtivo===id?'#98989b':'var(--color-text-muted)'}">${label}</button>`
            ).join('')}
            ${filtroAtivo!=='todos'?`<span style="font-size:.72rem;color:var(--color-text-muted)">Total: <b style="color:#8fc6ab">${fmt(totalFiltrado)}</b></span>`:''}
          </div>
        </div>
        <div style="max-height:calc(100vh - 280px);overflow-y:auto;padding-right:4px">
          ${historicoHTML}
        </div>
      </div>
    </div>
  `;

  let mc = document.getElementById('cli-modal-container');
  if (!mc) { mc = document.createElement('div'); mc.id='cli-modal-container'; document.body.appendChild(mc); }
  mc.innerHTML = clienteModalAberto ? clienteModalHTML() : '';
}

function renderClientesFiltrado(busca) {
  const grid = document.getElementById('cli-grid');
  if (!grid) return;
  const b = busca.toLowerCase().trim();
  let count = 0;
  grid.querySelectorAll('.orc-glass-card').forEach(card => {
    const txt = card.textContent.toLowerCase();
    const show = !b || txt.includes(b);
    card.style.display = show ? '' : 'none';
    if (show) count++;
  });
}

// ══════════════════════════════════════════════════════
