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

## Course History Resilience

When a course is deleted, the app now stages a copy of that deletion event in `localStorage` before it is sent to Firestore. If the remote write fails (for example, due to a lost connection), the backup entry is merged into the history dialog on the next load so the deletion still appears in the version history. Once Firestore confirms the change, the local cache automatically removes that fallback entry.

## Milestone Templates

The app now includes a library of reusable milestone templates. Selecting a template when adding a milestone will clone the milestone and its pre-defined tasks. You can also save any existing milestone as a new template.
Select "Add from template" to insert a template into your timeline. Stored templates can be removed via the trash icon, and any templates saved locally merge with the default templates seeded from [`scripts/defaultMilestoneTemplates.json`](scripts/defaultMilestoneTemplates.json).

### Template Deletion Tracking

To prevent deleted templates from reappearing after app restart or remote synchronization, the app now tracks deleted template IDs in localStorage (`healthPM:deletedTemplates:v1`). When a template is deleted:
1. Its ID is recorded in the deletion tracking list
2. The template is removed from storage (local and remote)
3. Any draft data for that template is cleared from memory

During app initialization and remote sync, the merge logic excludes any template whose ID appears in the deletion tracking list, ensuring deleted templates stay deleted even if they exist in:
- Default templates (`scripts/defaultMilestoneTemplates.json`)
- Remote storage (Firebase)
- Incoming sync operations from other devices
