# DART — Design & Development Accountability & Responsibility Tracker

This build includes **your Firebase config**, so it should work right after upload.

## Quick deploy
1) Upload everything in this folder to a GitHub repo (root).
2) GitHub → Repo Settings → Pages → Deploy from branch (main, root).
3) Firebase Console:
   - Auth → Sign-in method → enable Google
   - Auth → Authorized domains → add `YOUR_USERNAME.github.io`
   - Firestore → Create DB → Rules: paste `firestore.rules` and Publish
4) Open your site → “Continue with Google”.

First user is auto-promoted to **PC**.
