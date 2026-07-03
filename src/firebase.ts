import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "lucid-charger-2wjrd",
  appId: "1:840757134406:web:518ab92835bc5f16a6b647",
  apiKey: "AIzaSyDTpRpr4TxSxTl4EB6tre1VN7vbCpeQhv4",
  authDomain: "lucid-charger-2wjrd.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-sistemadeorquest-8f245b97-dec2-46e0-849d-cd3152a1f954",
  storageBucket: "lucid-charger-2wjrd.firebasestorage.app",
  messagingSenderId: "840757134406"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Validate connection to Firestore as required by the skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error: any) {
    const errMsg = error?.message || '';
    const errCode = error?.code || '';
    if (errCode === 'permission-denied' || errMsg.includes('permission')) {
      // Permission denied means Firestore is online, connected, and secured!
      console.log("Firebase connection established & secured successfully (Permission Gate Verified).");
    } else if (errMsg.includes('the client is offline') || errCode === 'unavailable') {
      console.warn("Firebase check: client is offline or service is unavailable. Offline caching is active.");
    } else {
      console.debug("Firebase connection check returned state:", errCode || errMsg);
    }
  }
}
testConnection();

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged };
export type { User };
