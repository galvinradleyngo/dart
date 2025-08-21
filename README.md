# DART — GitHub Pages Starter

This ZIP is preconfigured for `https://galvinradleyngo.github.io/dart/`.

- `vite.config.js` has `base: '/dart/'`
- `public/404.html` handles deep-link refresh on Pages
- GitHub Actions workflow builds and deploys automatically

## Using this
1. Upload all files to your `galvinradleyngo/dart` repo (commit to `main`).
2. In **Settings → Pages**, choose **Source: GitHub Actions**.
3. Replace `src/App.jsx` with your full app code from ChatGPT canvas (the placeholder just shows a stub).

## Local dev
```bash
npm i
npm run dev
```

## Testing

```bash
npm test
```

The test script uses Node's built-in test runner (`node --test`) and requires Node.js 18 or newer.
