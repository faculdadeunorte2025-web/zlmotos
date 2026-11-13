// Ligação com o RS Socorro (outro projeto Firebase: rssocorro).
// Usa o mesmo login do painel do Jean no RS Socorro (usuário "jean" + PIN).
// As regras do RS Socorro só deixam o Jean LER corridas da ZL e marcar/desmarcar "pago".
// Versão 10.14.1 de propósito: fica totalmente separada do Firebase da ZL Motos (outro login, outro banco).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const PAINEL_URL = 'https://rssocorro.web.app/admin.html';
const config = {
  apiKey: 'AIzaSyDtbqgUTr7Z3QnpNLBlbrpefbRSL2nktwo',
  authDomain: 'rssocorro.firebaseapp.com',
  projectId: 'rssocorro',
  storageBucket: 'rssocorro.firebasestorage.app',
  messagingSenderId: '25408117365',
  appId: '1:25408117365:web:62f3a4a35a5f6223df763c'
};

// estado: 'carregando' | 'desligado' | 'ok' | 'erro'
export const RS = { estado: 'carregando', lista: [], erro: '' };
let app, auth, db, pararLista = null, aviso = () => {};

export function iniciarSocorro(aoMudar) {
  if (app) return;
  aviso = aoMudar || aviso;
  app = initializeApp(config, 'rssocorro');
  auth = getAuth(app); db = getFirestore(app);
  onAuthStateChanged(auth, u => {
    if (pararLista) { pararLista(); pararLista = null; }
    if (!u) { RS.estado = 'desligado'; RS.lista = []; return aviso(); }
    pararLista = onSnapshot(query(collection(db, 'corridas'), where('tipo', '==', 'zl')), s => {
      RS.lista = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.excluida).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
      RS.estado = 'ok'; RS.erro = ''; aviso();
    }, e => { RS.estado = 'erro'; RS.erro = e.code === 'permission-denied' ? 'Sem permissão no RS Socorro.' : 'Não foi possível ler as corridas.'; aviso(); });
  });
}

export async function entrarSocorro(pin) {
  await signInWithEmailAndPassword(auth, 'jean@rssocorro.app', pin);
}
export const sairSocorro = () => signOut(auth);

// Só muda "pago" e "pagoEm", como as regras do RS Socorro exigem.
export function marcarPagoSocorro(id, pago) {
  return updateDoc(doc(db, 'corridas', id), { pago, pagoEm: pago ? Date.now() : null });
}

export const abertasSocorro = () => RS.lista.filter(c => !c.pago);
export const totalAbertoSocorro = () => abertasSocorro().reduce((s, c) => s + (Number(c.valorFinal) || 0), 0);
