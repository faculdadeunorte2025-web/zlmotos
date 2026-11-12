// MIGRAÇÃO DE DADOS ENTRE ANOS
// ═══════════════════════════════════════════
async function migrarAnoParaAno(anoOrigem, anoDestino) {
  if (!confirm(`ATENÇÃO!\n\nIsso vai:\n1. APAGAR todos os dados de ${anoDestino}\n2. Copiar todos os dados de ${anoOrigem} para ${anoDestino}\n\nEssa ação não pode ser desfeita.\n\nDeseja continuar?`)) return;

  mostrarToast('Migrando dados...');

  try {
    // Carregar dados do ano origem
    const refOrigem = window._userDoc('zlmotos_' + anoOrigem);
    const snapOrigem = await window._firestoreGetDoc(refOrigem);
    if (!snapOrigem.exists()) {
      mostrarErro('Nenhum dado encontrado em ' + anoOrigem);
      return;
    }
    const dadosOrigem = snapOrigem.data().dados;
    if (!dadosOrigem) {
      mostrarErro('Dados de ' + anoOrigem + ' estão vazios');
      return;
    }

    const refDestino = window._userDoc('zlmotos_' + anoDestino);

    // CORREÇÃO: antes de apagar o ano de destino, guarda uma cópia de segurança
    // dele no Firebase (backup_antes_migracao_ANO_DATA). Antes, era perdido para sempre.
    const snapDestino = await window._firestoreGetDoc(refDestino);
    if (snapDestino.exists()) {
      const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
      await window._fsSet(window._userDoc('backup_antes_migracao_' + anoDestino + '_' + carimbo), snapDestino.data());
    }

    // Salvar no ano destino (substitui de propósito)
    await window._salvamentoSeguro.gravarSubstituindo(refDestino, {
      dados: dadosOrigem,
      atualizadoEm: new Date().toISOString(),
      migradoDe: anoOrigem,
      migradoEm: new Date().toISOString()
    });

    // Atualiza o ano no header e recarrega
    if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
    document.getElementById('anoGlobal').value = anoDestino;
    dados = JSON.parse(JSON.stringify(dadosOrigem));
    _dadosCarregados = true;
    inicializarDadosLocal();
    _escutarAno();
    mostrarToast('✓ Dados de ' + anoOrigem + ' migrados para ' + anoDestino + ' com sucesso!');
    renderAll();

  } catch(e) {
    console.error('Erro na migração:', e);
    mostrarErro('Erro ao migrar dados: ' + e.message);
  }
}

function renderConfiguracoes() {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="toolbar">
      <span style="font-family:'Inter',sans-serif;font-size:1.2rem;letter-spacing:.5px;color:#a6a6a9">CONFIGURAÇÕES DA EMPRESA</span>
    </div>
    <div style="max-width:700px;margin:0 auto">

      <!-- MIGRAÇÃO DE DADOS -->
      <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:20px 24px;margin-bottom:16px">
        <div style="font-family:'Inter',sans-serif;font-size:.9rem;letter-spacing:.5px;color:#dd8c8c;margin-bottom:12px">MIGRAÇÃO DE DADOS</div>
        <div style="font-size:.82rem;color:var(--color-text-muted);margin-bottom:14px">Copia todos os dados de um ano para outro. O ano de destino será <b style="color:#dd8c8c">completamente substituído</b>.</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:.75rem;color:var(--color-text-muted)">De:</label>
            <select id="migrar-origem" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:6px 10px;font-size:.82rem">
              ${(function(){var y=new Date().getFullYear(),r=[];for(var a=y-4;a<=y+1;a++)r.push(a);return r})().map(a => '<option value="'+a+'"'+(a===new Date().getFullYear()-1?' selected':'')+'>'+a+'</option>').join('')}
            </select>
          </div>
          <div style="font-size:.9rem;color:var(--color-text-muted)">→</div>
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:.75rem;color:var(--color-text-muted)">Para:</label>
            <select id="migrar-destino" style="background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text-primary);border-radius:8px;padding:6px 10px;font-size:.82rem">
              ${(function(){var y=new Date().getFullYear(),r=[];for(var a=y-4;a<=y+1;a++)r.push(a);return r})().map(a => '<option value="'+a+'"'+(a===new Date().getFullYear()?' selected':'')+'>'+a+'</option>').join('')}
            </select>
          </div>
          <button onclick="const o=document.getElementById('migrar-origem').value;const d=document.getElementById('migrar-destino').value;if(o===d){mostrarErro('Origem e destino não podem ser iguais');return;}migrarAnoParaAno(o,d)"
            style="padding:8px 18px;background:rgba(255,255,255,0.075);border:1px solid rgba(255,255,255,0.2);color:#eab7b7;border-radius:8px;cursor:pointer;font-size:.82rem;font-weight:600">
            Migrar Dados
          </button>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,rgba(42,42,45,.9),rgba(66,66,69,.5));border:1px solid var(--color-border);border-radius:14px;padding:24px;margin-bottom:16px">
        <div style="font-family:'Inter',sans-serif;font-size:.9rem;letter-spacing:.5px;color:#5cab84;margin-bottom:16px">META MENSAL</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="orc-field" style="flex:1;margin:0">
            <label>Meta de faturamento mensal (R$)</label>
            <input type="number" min="0" step="100" value="${metaMensal||''}" placeholder="Ex: 15000" id="cfg-meta-mensal"
              oninput="metaMensal=parseFloat(this.value)||0;dashSalvarMeta()"
              style="font-size:1rem"/>
          </div>
          <div style="text-align:center;min-width:80px">
            ${metaMensal > 0 ? `<div style="font-size:.72rem;color:var(--color-text-muted)">Este mês</div><div style="font-size:1.1rem;font-weight:700;color:${Math.round((calcularMes(new Date().getMonth()).totalBruto/metaMensal)*100) >= 100 ? '#5cab84' : '#d4d4d8'}">${Math.min(100,Math.round((calcularMes(new Date().getMonth()).totalBruto/metaMensal)*100))}%</div>` : ''}
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="orc-field" style="grid-column:1/-1">
            <label>Razão Social</label>
            <input type="text" value="${empresa.razaoSocial||''}" placeholder="Razão Social..." oninput="empresa.razaoSocial=this.value"/>
          </div>
          <div class="orc-field">
            <label>Nome Fantasia</label>
            <input type="text" value="${empresa.nomeFantasia||''}" placeholder="Nome Fantasia..." oninput="empresa.nomeFantasia=this.value"/>
          </div>
          <div class="orc-field">
            <label>CNPJ</label>
            <input type="text" value="${empresa.cnpj||''}" placeholder="00.000.000/0000-00" oninput="empresa.cnpj=this.value"/>
          </div>
          <div class="orc-field" style="grid-column:1/-1">
            <label>Endereço</label>
            <input type="text" value="${empresa.endereco||''}" placeholder="Rua, número..." oninput="empresa.endereco=this.value"/>
          </div>
          <div class="orc-field">
            <label>Bairro</label>
            <input type="text" value="${empresa.bairro||''}" placeholder="Bairro..." oninput="empresa.bairro=this.value"/>
          </div>
          <div class="orc-field">
            <label>Cidade</label>
            <input type="text" value="${empresa.cidade||''}" placeholder="Cidade..." oninput="empresa.cidade=this.value"/>
          </div>
          <div class="orc-field">
            <label>Estado</label>
            <input type="text" value="${empresa.estado||''}" placeholder="SP" maxlength="2" oninput="empresa.estado=this.value.toUpperCase();this.value=empresa.estado" style="text-transform:uppercase"/>
          </div>
          <div class="orc-field">
            <label>CEP</label>
            <input type="text" value="${empresa.cep||''}" placeholder="00.000-000" oninput="empresa.cep=this.value"/>
          </div>
          <div class="orc-field">
            <label>Telefone</label>
            <input type="text" value="${empresa.telefone||''}" placeholder="(17) 99999-9999" oninput="empresa.telefone=limparTel(this.value)"/>
          </div>
          <div class="orc-field">
            <label>E-mail</label>
            <input type="email" value="${empresa.email||''}" placeholder="email@empresa.com" oninput="empresa.email=this.value"/>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
          <div class="orc-field">
            <label>Taxa Cartão de Crédito (%)</label>
            <input type="number" value="${empresa.taxaCredito||2.5}" min="0" max="100" step="0.01" placeholder="2.5" oninput="empresa.taxaCredito=this.value"/>
            <span style="font-size:.7rem;color:var(--color-text-muted)">Descontado automaticamente nas entradas de crédito</span>
          </div>
          <div class="orc-field">
            <label>Taxa Cartão de Débito (%)</label>
            <input type="number" value="${empresa.taxaDebito||1.5}" min="0" max="100" step="0.01" placeholder="1.5" oninput="empresa.taxaDebito=this.value"/>
            <span style="font-size:.7rem;color:var(--color-text-muted)">Descontado automaticamente nas entradas de débito</span>
          </div>
        </div>
        <div style="margin-top:20px">
          <button class="btn" style="background:linear-gradient(135deg,#3f7a5d,#33624b);color:white;padding:10px 28px;font-size:.9rem" onclick="salvarEmpresa()">Salvar Configurações</button>
        </div>
      </div>
      <div style="background:rgba(42,42,45,.5);border:1px solid var(--color-border);border-radius:12px;padding:16px 20px;font-size:.78rem;color:var(--color-text-muted);line-height:1.8">
        <b style="color:#a6a6a9">Sobre as configurações:</b><br>
        Os dados da empresa aparecem automaticamente nos PDFs de Orçamento.
      </div>

      <!-- M01 — TEMA -->
      <div style="background:rgba(255,255,255,.03);border:1px solid var(--color-border);border-radius:14px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:.85rem;font-weight:700;color:var(--color-text-primary)">Tema</div>
          <div style="font-size:.72rem;color:var(--color-text-muted)">Alternar entre modo escuro e claro</div>
        </div>
        <button onclick="toggleTema()" id="btn-tema" style="padding:8px 20px;border-radius:20px;border:1px solid var(--color-border);background:var(--color-elevated);color:var(--color-text-primary);cursor:pointer;font-size:.82rem;font-weight:600">
          ${document.body.classList.contains('tema-claro') ? 'Modo Escuro' : 'Modo Claro'}
        </button>
      </div>

      <!-- I12 — BACKUP E RELATÓRIO -->
      <div style="background:linear-gradient(135deg,rgba(42,42,45,.9),rgba(66,66,69,.5));border:1px solid var(--color-border);border-radius:14px;padding:24px;margin-bottom:16px">
        <div style="font-family:'Inter',sans-serif;font-size:.9rem;letter-spacing:.5px;color:#adadb0;margin-bottom:16px">BACKUP E RELATÓRIOS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button onclick="backupExportarJSON()" style="padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#adadb0;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700">
            Exportar backup JSON<br><span style="font-size:.7rem;color:var(--color-text-muted);font-weight:400">Todos os dados em JSON</span>
          </button>
          <button onclick="relatorioMensalPDF()" style="padding:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#5cab84;border-radius:10px;cursor:pointer;font-size:.82rem;font-weight:700">
            Relatório Mensal PDF<br><span style="font-size:.7rem;color:var(--color-text-muted);font-weight:400">Resumo financeiro do mês</span>
          </button>
          </div>
      </div>

      <!-- CHECKLIST DE ENTREGA -->
      </div>
  `;
}

function renderAll() {
  const _scrollEl = document.getElementById('app-main');
  const _scrollY = _scrollEl ? _scrollEl.scrollTop : (window.scrollY || 0);
  _renderAllInner();
  requestAnimationFrame(() => {
    if (_scrollEl) _scrollEl.scrollTop = _scrollY;
    else window.scrollTo(0, _scrollY);
  });
}

function _renderAllInner() {
  renderTabs();
  // C12 — atualizar bottom nav mobile
  ['dash','os','orc','cli','est'].forEach(id => {
    const el = document.getElementById('bn-'+id);
    if (el) el.classList.remove('ativo');
  });
  const bnMap = {18:'dash',13:'orc',20:'cli',24:'cp'};
  const bnEl = document.getElementById('bn-'+(bnMap[abaAtiva]||''));
  if (bnEl) bnEl.classList.add('ativo');
  if (abaAtiva===12) renderAnual();
  else if (abaAtiva===13) renderOrcamento();
  else if (abaAtiva===16) renderConfiguracoes();
  else if (abaAtiva===18) renderDashboard();
  else if (abaAtiva===20) renderClientes();
  else if (abaAtiva===23) renderAreaMecanico();
  else if (abaAtiva===24) renderContasPagar();
  else if (abaAtiva===99) renderBuscaGlobal();
  else if (abaAtiva >= 0 && abaAtiva <= 11) renderMes(abaAtiva);
  else { abaAtiva = 18; renderDashboard(); } // aba que não existe mais → Dashboard
}


// ═══════════════════════════════════════════
