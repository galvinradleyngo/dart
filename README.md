# DART – Course Design & Development PM

This is your React + Vite project containing the DART prototype. TailwindCSS, framer-motion, and lucide-react are prewired.

## Quick start

```bash
npm i
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Firebase Hosting

This repo includes `firebase.json` and `.firebaserc` for project **dart-ed2ab**.

1. Install the CLI and login:

```bash
npm i -g firebase-tools
firebase login
```

2. Deploy (after `npm run build`):

```bash
firebase deploy --only hosting
```

> SPA rewrite is configured so deep links work.

## GitHub

Create a new repo, push this folder, then (optional) set up **Firebase Hosting GitHub Action** from the Firebase console for automatic deploys on push.
