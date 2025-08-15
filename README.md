# DART — Design & Development Accountability & Responsibility Tracker

This build includes:
- In-app **Role Manager** with **Invites** (email + roles, mailto helper)
- Improved, Trello/Notion-inspired UI
- One-click **Sample Course** seeding
- Google Sign-in only (no email-link auth needed)

## Deploy
1) Upload all files to a GitHub repo (root), enable GitHub Pages.
2) Firebase Console:
   - Auth → Sign-in method → enable Google
   - Auth → Authorized domains → add `YOUR_USERNAME.github.io`
   - Firestore → Create DB → Rules: paste `firestore.rules` and Publish
3) Open your site → Google sign-in.
4) As PC, open **Role Manager** to invite teammates; share the site link.

## Dynamic Links / Email Link Auth Note
Per Firebase’s FAQ, web **email actions are not impacted** by Dynamic Links shutdown; mobile email-link and Cordova OAuth are. We use **Google popup** sign-in, so you’re unaffected.

If you later add email-link sign-in, follow Firebase’s migration guides and latest SDKs.
