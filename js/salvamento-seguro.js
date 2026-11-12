// ═══════════════════════════════════════════════════════════════════
// GRAVAÇÃO SEGURA NO FIREBASE
// ═══════════════════════════════════════════════════════════════════
// Problema que isso resolve: o sistema grava listas inteiras (lançamentos do
// ano, OS, orçamentos, estoque...) de uma vez só. Se um aparelho estava com a
// tela aberta há horas (ou carregou com falha), ao salvar ele SOBRESCREVIA o
// que outro aparelho tinha gravado — e os dados "sumiam".
//
// Agora, antes de gravar uma dessas listas, o sistema:
//   1. lê o que está no Firebase naquele momento;
//   2. compara com a última versão que este aparelho viu;
//   3. junta as mudanças dos dois lados (o que foi adicionado em outro aparelho
//      é mantido; o que você apagou aqui continua apagado);
//   4. só então grava — e atualiza a tela com o resultado.
// Se estiver sem internet, guarda na fila e grava sozinho quando voltar.
// ═══════════════════════════════════════════════════════════════════
(function () {
  // Documentos que são listas inteiras e precisam de junção segura.
  const CHAVES_LISTA = /^(zlmotos_\d{4}|orcamentos_lista|os_lista|estoque_global|ferramental_global|contas_pagar|vendas_historico|est_entradas|fornecedores|categorias_mes|agendamentos_lista)$/;

  const base = {};          // caminho -> última versão vista do servidor (cópia)
  const filas = {};         // caminho -> Promise (grava um de cada vez por documento)
  const pendentes = {};     // caminho -> { ref, payload } aguardando internet
  let fb = null;            // { setDoc, getDoc, onSnapshot } originais

  const copia = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

  function ehLista(ref) {
    if (!ref || !ref.path) return false;
    const p = ref.path.split('/');
    return p.length === 4 && p[0] === 'zlmotos' && p[2] === 'dados' && CHAVES_LISTA.test(p[3]);
  }

  // JSON com chaves em ordem (para comparar objetos de forma estável)
  function estavel(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + estavel(v[k])).join(',') + '}';
  }

  function chaveItem(x) {
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      if (x.id !== undefined && x.id !== null && x.id !== '') return 'id:' + x.id;
      if (x._id) return '_id:' + x._id;
    }
    return 'json:' + estavel(x);
  }

  // Indexa uma lista: chave -> item (itens repetidos ganham #2, #3...)
  function indexar(lista) {
    const mapa = new Map(), cont = {};
    (Array.isArray(lista) ? lista : []).forEach(item => {
      const k0 = chaveItem(item);
      cont[k0] = (cont[k0] || 0) + 1;
      mapa.set(cont[k0] > 1 ? k0 + '#' + cont[k0] : k0, item);
    });
    return mapa;
  }

  // Junção de 3 vias de uma lista: base (o que vimos), local (nossa), remoto (servidor)
  function juntarLista(b, l, r) {
    const B = indexar(b), L = indexar(l), R = indexar(r);
    const out = [];
    let mudou = false;
    L.forEach((item, k) => {
      if (R.has(k) || !B.has(k)) { out.push(item); return; }
      // existia antes, foi apagado em outro aparelho
      if (estavel(item) === estavel(B.get(k))) { mudou = true; return; } // aqui não mexemos: apaga
      out.push(item); // mexemos aqui depois de apagado lá: mantém
    });
    R.forEach((item, k) => {
      if (L.has(k)) return;
      if (B.has(k)) return;            // apagamos aqui: continua apagado
      out.push(copia(item)); mudou = true; // adicionado em outro aparelho
    });
    return { lista: out, mudou };
  }

  function juntarValor(b, l, r) {
    if (Array.isArray(l) || Array.isArray(r)) return juntarLista(b, l, r);
    if (estavel(l) !== estavel(b)) return { valor: l, mudou: false }; // mudamos aqui: vale o nosso
    return { valor: copia(r), mudou: estavel(l) !== estavel(r) };
  }

  // Junta o documento de lançamentos do ano: { dados: { 0: {fixos,variaveis,entradas,obs}, ... } }
  function juntarDadosAno(bD, lD, rD) {
    bD = bD || {}; rD = rD || {};
    let mudou = false;
    const meses = new Set([...Object.keys(lD), ...Object.keys(rD)]);
    meses.forEach(m => {
      const bm = bD[m] || {}, rm = rD[m];
      if (!lD[m]) { if (rm) { lD[m] = copia(rm); mudou = true; } return; }
      if (!rm) return;
      const lm = lD[m];
      const campos = new Set([...Object.keys(lm), ...Object.keys(rm)]);
      campos.forEach(c => {
        if (Array.isArray(lm[c]) || Array.isArray(rm[c])) {
          const j = juntarLista(bm[c], lm[c], rm[c]);
          if (j.mudou) mudou = true;
          substituirArray(lm, c, j.lista);
        } else {
          const j = juntarValor(bm[c], lm[c], rm[c]);
          if (j.mudou) { lm[c] = j.valor; mudou = true; }
        }
      });
    });
    return mudou;
  }

  // Troca o conteúdo do array mantendo a MESMA referência (o resto do sistema
  // guarda referência para essas listas em variáveis globais).
  function substituirArray(obj, campo, nova) {
    if (Array.isArray(obj[campo])) obj[campo].splice(0, obj[campo].length, ...nova);
    else obj[campo] = nova;
  }

  // Junta o payload local com o remoto. Altera o payload no lugar.
  function juntar(path, payload, remoto) {
    const b = base[path] || {};
    let mudou = false;
    Object.keys(payload).forEach(campo => {
      if (campo === 'atualizadoEm') return;
      if (campo === 'dados' && payload.dados && typeof payload.dados === 'object' && !Array.isArray(payload.dados)) {
        if (juntarDadosAno(b.dados, payload.dados, remoto.dados)) mudou = true;
      } else if (Array.isArray(payload[campo]) || Array.isArray(remoto[campo])) {
        const j = juntarLista(b[campo], payload[campo], remoto[campo]);
        if (j.mudou) mudou = true;
        substituirArray(payload, campo, j.lista);
      } else if (payload[campo] && typeof payload[campo] === 'object' && remoto[campo] && typeof remoto[campo] === 'object') {
        // objeto simples (ex.: horários bloqueados): chaves dos dois lados
        Object.keys(remoto[campo]).forEach(k => {
          if (!(k in payload[campo]) && !(b[campo] && k in b[campo])) { payload[campo][k] = copia(remoto[campo][k]); mudou = true; }
        });
      }
    });
    // campos que só existem no servidor
    Object.keys(remoto).forEach(c => { if (!(c in payload)) payload[c] = copia(remoto[c]); });
    return mudou;
  }

  async function gravarLista(ref, payload, opts) {
    const path = ref.path;
    const snap = await fb.getDoc(ref);               // falha se estiver sem internet
    const remoto = snap.exists() ? (snap.data() || {}) : null;
    let mudou = false;
    if (remoto) {
      const b = base[path];
      const igualBase = b && estavel(b) === estavel(remoto);
      if (!igualBase) {
        mudou = juntar(path, payload, remoto);
        if (mudou) console.info('ZLMotos: alterações de outro aparelho foram mantidas em', path);
      }
    }
    await fb.setDoc(ref, payload, opts);
    base[path] = copia(payload);
    if (mudou && typeof window._aposJuntarDados === 'function') {
      try { window._aposJuntarDados(path.split('/')[3]); } catch (e) { console.warn(e); }
    }
  }

  function ehErroDeRede(e) {
    const c = (e && e.code) || '';
    return !navigator.onLine || c === 'unavailable' || c === 'deadline-exceeded' || /offline|network/i.test((e && e.message) || '');
  }

  function setDocSeguro(ref, payload, opts) {
    if (!ehLista(ref) || (opts && opts.merge)) return fb.setDoc(ref, payload, opts);
    const path = ref.path;
    const anterior = filas[path] || Promise.resolve();
    const atual = anterior.catch(() => {}).then(() => gravarLista(ref, payload, opts)).then(() => {
      delete pendentes[path];
    }).catch(e => {
      if (ehErroDeRede(e)) {
        pendentes[path] = { ref, payload, opts };
        console.warn('ZLMotos: sem conexão — gravação de', path.split('/')[3], 'ficou na fila.');
        if (typeof window._avisarPendencia === 'function') window._avisarPendencia(Object.keys(pendentes).length);
        return; // não perde: grava quando a internet voltar
      }
      throw e;
    });
    filas[path] = atual;
    return atual;
  }

  async function getDocSeguro(ref) {
    const snap = await fb.getDoc(ref);
    if (ehLista(ref) && snap.exists()) base[ref.path] = copia(snap.data());
    return snap;
  }

  function onSnapshotSeguro(ref, cb, err) {
    if (!ehLista(ref)) return fb.onSnapshot(ref, cb, err);
    return fb.onSnapshot(ref, snap => {
      const local = snap.metadata && snap.metadata.hasPendingWrites;
      if (!local && snap.exists()) base[ref.path] = copia(snap.data());
      cb(snap);
    }, err || (e => console.warn('ZLMotos: listener parou', ref.path, e)));
  }

  async function gravarPendentes() {
    const lista = Object.values(pendentes);
    for (const p of lista) {
      try { await setDocSeguro(p.ref, p.payload, p.opts); } catch (e) { console.warn(e); }
    }
    const resta = Object.keys(pendentes).length;
    if (typeof window._avisarPendencia === 'function') window._avisarPendencia(resta);
    return resta;
  }

  window.addEventListener('online', () => setTimeout(gravarPendentes, 1500));
  setInterval(() => { if (Object.keys(pendentes).length && navigator.onLine) gravarPendentes(); }, 30000);
  window.addEventListener('beforeunload', e => {
    if (Object.keys(pendentes).length) { e.preventDefault(); e.returnValue = 'Há dados ainda não enviados ao servidor.'; }
  });

  window._instalarSalvamentoSeguro = function (originais) {
    fb = originais;
    window._firestoreSetDoc = setDocSeguro;
    window._firestoreGetDoc = getDocSeguro;
    window._firestoreOnSnapshot = onSnapshotSeguro;
  };
  window._salvamentoSeguro = {
    pendentes: () => Object.keys(pendentes).length,
    gravarPendentes,
    // Gravação que SUBSTITUI de propósito (ex.: migração entre anos), sem juntar
    gravarSubstituindo: async (ref, payload) => { await fb.setDoc(ref, payload); base[ref.path] = copia(payload); },
    limpar: () => { Object.keys(base).forEach(k => delete base[k]); Object.keys(pendentes).forEach(k => delete pendentes[k]); },
    // exposto para testes
    _juntarLista: juntarLista, _juntarDadosAno: juntarDadosAno
  };
})();
