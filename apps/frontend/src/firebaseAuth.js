import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

const hasFirebaseConfig = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);

const getFirebaseAuth = () => {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase設定が不足しています（VITE_FIREBASE_*）');
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  return getAuth(app);
};

export async function loginWithEmailPassword(email, password) {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
  const idToken = await cred.user.getIdToken(true);
  return {
    uid: cred.user.uid,
    email: cred.user.email || '',
    idToken
  };
}

export async function logoutFirebaseSession() {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

