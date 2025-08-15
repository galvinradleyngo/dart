// auth.js
import { initFirebase } from './firebase.js';
const { auth, googleProvider } = initFirebase();

import { onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
// ...
export async function loginWithGoogle(){
  await signInWithRedirect(auth, googleProvider);
}
export function watchAuth(onUser){
  onAuthStateChanged(auth, async (user)=>{
    if(user){
      await ensureUserDoc(user);
      const profile = await getUser(user.uid);
      onUser({ ...user, profile });
    }else{
      onUser(null);
    }
  });
}
export async function loginWithGoogle(){
  await signInWithPopup(auth, googleProvider);
}
export async function logout(){
  await signOut(auth);
}
