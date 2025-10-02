# Resolving the milestone sorting merge conflicts

This guide walks through fixing the merge conflicts between the base branch `main` and the feature branch `codex/add-milestone-task-sorting-functionality-zf78iq` for pull request #319.

## 1. Update your local branches
1. Fetch the latest branches from GitHub:
   ```bash
   git fetch origin
   ```
2. Make sure `main` is current:
   ```bash
   git checkout main
   git pull origin main
   ```
3. Switch to the PR branch and bring in the newest remote commits:
   ```bash
   git checkout codex/add-milestone-task-sorting-functionality-zf78iq
   git pull --ff-only origin codex/add-milestone-task-sorting-functionality-zf78iq
   ```
4. Merge the updated `main` into the feature branch to surface conflicts locally:
   ```bash
   git merge origin/main
   ```

## 2. Identify the conflicting files
Run the following commands to list files that need attention:
```bash
git status
git diff --name-only --diff-filter=U
```
You should see:
- `src/App.jsx`
- `src/MilestoneCard.jsx`
- `src/MilestoneCard.test.jsx`

Open each file and search for `<<<<<<<`, `=======`, and `>>>>>>>` markers. Every conflict block must be resolved before committing.

## 3. Resolve each conflict

### `src/App.jsx`
- Keep the version that **removes** the milestone sorting toolbar from the section header. The milestone list should only render `<MilestoneCard>` components without passing shared `taskSort` props or callbacks.
- Confirm that the milestone header still exposes the filter menu, template picker, and “Add Milestone” button, but no longer renders a “Sort by” control.

### `src/MilestoneCard.jsx`
- Preserve the feature-branch logic that:
  - Defaults the card’s internal sort state to `'numeric'`.
  - Provides the `extractNumeric`, `compareNumeric`, and `compareTitleAlpha` helpers so numeric prefixes (single digits before double digits) are honored in both numeric and alphabetical modes.
  - Uses the guarded `handleTaskSortChange` handler to avoid redundant parent updates when the value doesn’t change.
  - Renders the in-card `<select>` with options: `1–N`, `Status`, `A–Z`, and `Deadline`.
- Remove any leftover imports or props tied to the old section-level sort state.

### `src/MilestoneCard.test.jsx`
- Keep the tests that assert:
  - Numeric ordering is the default (`Task 1`, `Task 3`, `Task 007`, …).
  - The alphabetical mode is numeric-aware (`1 Outline`, `2 Kickoff`, … before non-numeric titles).
  - Explicit `status` and `deadline` modes still work.
  - The integration test verifies only the in-card selector exists and that changing its value updates task order accordingly.
- Delete the obsolete expectations from `main` that assumed status-based defaults or a header-level sorter.

When editing, ensure every conflict marker is removed and the merged code compiles.

## 4. Verify the result
1. Confirm there are no remaining conflict markers:
   ```bash
   rg "<<<<<<<" -n
   ```
2. Run the targeted test suite (or the full test suite if time permits):
   ```bash
   npm test -- --runTestsByPath src/MilestoneCard.test.jsx
   ```

## 5. Commit and update the PR
1. Stage your fixes:
   ```bash
   git add src/App.jsx src/MilestoneCard.jsx src/MilestoneCard.test.jsx
   ```
2. Commit with a clear message:
   ```bash
   git commit -m "Resolve milestone sorting merge conflicts"
   ```
3. Push the updated branch to GitHub:
   ```bash
   git push origin codex/add-milestone-task-sorting-functionality-zf78iq
   ```

After the push, GitHub will re-run the PR checks. Verify the PR diff looks correct and that the conflicts banner is gone before requesting another review.
