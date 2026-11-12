// Conexão com o Firebase (mesmo projeto e mesmos dados de sempre).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { instalarSalvamentoSeguro } from './salvamento-seguro.js';

const app = initializeApp({
  apiKey: "AIzaSyCf6hV2ONkPdoGvUFgslYrZUShsOeUMzvI",
  authDomain: "zl-motos.firebaseapp.com",
  projectId: "zl-motos",
  storageBucket: "zl-motos.firebasestorage.app",
  messagingSenderId: "968389356035",
  appId: "1:968389356035:web:115ad32b691cf12a77fc36"
});

export const db = getFirestore(app);
export const auth = getAuth(app);

// Gravação segura para documentos que guardam listas inteiras
const seguro = instalarSalvamentoSeguro({ setDoc, getDoc, onSnapshot });
export const gravar = seguro.setDoc;          // junta alterações de outros aparelhos
export const ler = seguro.getDoc;
export const escutar = seguro.onSnapshot;
export const salvamento = seguro;
export { setDoc as gravarDireto, getDocs, deleteDoc, onSnapshot as escutarDireto, signOut, onAuthStateChanged, updatePassword };

function uid() {
  if (!auth.currentUser) throw new Error('Nenhum usuário logado.');
  return auth.currentUser.uid;
}
// zlmotos/{uid}/dados/{chave}
export const docUsuario = chave => doc(db, 'zlmotos', uid(), 'dados', chave);
// zlmotos/{uid}/{colecao}
export const colUsuario = nome => collection(db, 'zlmotos', uid(), nome);
export const docColecao = (nome, id) => doc(db, 'zlmotos', uid(), nome, id);

export const entrar = (email, senha) => signInWithEmailAndPassword(auth, email, senha);
export const sair = () => signOut(auth);

// Registro de auditoria (quem fez o quê) — mesmo formato do sistema antigo
export async function registrarLog(acao, detalhes) {
  try {
    if (!auth.currentUser) return;
    const ref = doc(db, 'zlmotos', uid(), 'auditoria', Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    await setDoc(ref, { acao, detalhes, usuario: auth.currentUser.email, uid: uid(), timestamp: new Date().toISOString() });
  } catch (e) { /* auditoria nunca trava o sistema */ }
}
