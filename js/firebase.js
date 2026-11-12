import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyCf6hV2ONkPdoGvUFgslYrZUShsOeUMzvI",
    authDomain: "zl-motos.firebaseapp.com",
    projectId: "zl-motos",
    storageBucket: "zl-motos.firebasestorage.app",
    messagingSenderId: "968389356035",
    appId: "1:968389356035:web:115ad32b691cf12a77fc36",
    measurementId: "G-BJCWGDWN0P"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  window._db = db;
  window._auth = auth;
  window._firestoreDoc = doc;
  // _firestoreSetDoc / _firestoreGetDoc / _firestoreOnSnapshot são
  // substituídos mais abaixo pela "gravação segura" (ver salvamento-seguro).
  window._firestoreSetDoc = setDoc;
  window._firestoreGetDoc = getDoc;
  window._firestoreCollection = collection;
  window._firestoreGetDocs = getDocs;
  window._firestoreDeleteDoc = deleteDoc;
  window._firestoreOnSnapshot = onSnapshot;

  // Aliases curtos usados pelo módulo mecânico
  window._fsDoc = (col, id) => doc(db, col, id);
  window._fsCol = (path) => collection(db, path);
  window._fsSet = setDoc;
  window._fsGet = getDoc;
  window._fsDel = deleteDoc;
  window._fsUpdate = (ref, data) => setDoc(ref, data, { merge: true });

  // Retorna referência isolada por usuário: zlmotos/{uid}/dados/{chave}
  // CORREÇÃO: antes, sem login, gravava/lia numa pasta "anonimo" (dados pareciam sumir).
  // Agora dá erro claro se ninguém estiver logado.
  function _uidAtual() {
    const u = window._auth.currentUser;
    if (!u) throw new Error('Nenhum usuário logado — faça login novamente.');
    return u.uid;
  }
  window._userDoc = function(chave) {
    return doc(db, 'zlmotos', _uidAtual(), 'dados', chave);
  };

  // Retorna referência de collection isolada por usuário
  window._userCollection = function(nome) {
    return collection(db, 'zlmotos', _uidAtual(), nome);
  };

  // Retorna referência de documento dentro de uma collection do usuário
  window._userCollectionDoc = function(colNome, docId) {
    return doc(db, 'zlmotos', _uidAtual(), colNome, docId);
  };

  // ── SISTEMA DE AUDITORIA ──────────────────────────────────────────
  window._registrarLog = async function(acao, detalhes) {
    try {
      if (!window._auth.currentUser) return; // sem login não registra
      const uid   = window._auth.currentUser.uid;
      const email = window._auth.currentUser ? window._auth.currentUser.email : 'desconhecido';
      const logRef = doc(db, 'zlmotos', uid, 'auditoria', Date.now() + '_' + Math.random().toString(36).slice(2,7));
      await setDoc(logRef, {
        acao,
        detalhes,
        usuario: email,
        uid,
        timestamp: new Date().toISOString()
      });
    } catch(e) { console.warn('Erro ao registrar log:', e); }
  };
  // ─────────────────────────────────────────────────────────────────
  window._firebaseSignIn = signInWithEmailAndPassword;
  window._firebaseSignOut = signOut;
  window._firebaseSignInAnon = signInAnonymously;
  window._firebaseUpdatePassword = updatePassword;
  window._fsGetDocs = getDocs;
  // Liga a camada de gravação segura (js/salvamento-seguro.js)
  window._instalarSalvamentoSeguro({ setDoc, getDoc, onSnapshot });
  window._firebaseReady = true;

  // Monitora estado de autenticação
  let _mecLastUidConfirmado = undefined;
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window._currentUser = user;
    } else {
      window._currentUser = null;
    }
    // Reinicia os listeners do módulo de mecânico quando a identidade
    // confirmada muda — evita que fiquem "presos" escutando o UID errado
    // por causa da corrida entre o carregamento da página e o login.
    const uidConfirmado = user ? user.uid : null;
    if (uidConfirmado !== _mecLastUidConfirmado) {
      _mecLastUidConfirmado = uidConfirmado;
      if (window._mecReiniciarListeners) window._mecReiniciarListeners();
    }
  });

  document.dispatchEvent(new Event('firebase-ready'));
