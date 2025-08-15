// auth.js
import { initFirebase } from './firebase.js';
const { auth, googleProvider } = initFirebase();

import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { ensureUserDoc, getUser, applyInvitesForUser } from './db.js';

export function watchAuth(onUser){
  onAuthStateChanged(auth, async (user)=>{
    if(user){
      await ensureUserDoc(user);
      await applyInvitesForUser(user);
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
