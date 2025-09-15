# DART — Design & Development Accountability Tracker

Vite + React app for tracking course development tasks. The project is preconfigured for deployment to GitHub Pages at `https://galvinradleyngo.github.io/dart/`.

## Local Development

```bash
npm install
npm run dev
```

## Testing

Run the unit tests with:

```bash
npm test
```

Vitest and React Testing Library power the test suite.

## Milestone Templates

The app now includes a library of reusable milestone templates. Use the “add from template” dropdown when adding a milestone to clone the milestone and its pre-defined tasks. You can save any existing milestone as a new template and remove templates by selecting one and clicking the trash icon. Default templates are seeded from [`scripts/defaultMilestoneTemplates.json`](scripts/defaultMilestoneTemplates.json).
