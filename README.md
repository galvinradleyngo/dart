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

The app now includes a library of reusable milestone templates. Selecting a template when adding a milestone will clone the milestone and its pre-defined tasks. You can also save any existing milestone as a new template.
Select "Add from template" to insert a template into your timeline. Stored templates can be removed via the trash icon, and any templates saved locally merge with the default templates seeded from [`scripts/defaultMilestoneTemplates.json`](scripts/defaultMilestoneTemplates.json).
