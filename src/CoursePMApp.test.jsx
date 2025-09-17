import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, beforeEach, beforeAll, expect, vi } from 'vitest';
import { CoursePMApp } from './App.jsx';

vi.mock('./firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(),
  doc: vi.fn(),
}));

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

beforeAll(() => {
  window.matchMedia = window.matchMedia || (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

beforeEach(() => {
  localStorage.clear();
});

const createBootState = () => ({
  course: {
    id: 'course-1',
    name: 'Test Course',
    description: '',
    accent: 'from-slate-500 via-slate-500 to-slate-500',
    courseLDIds: [],
    courseSMEIds: [],
  },
  schedule: { workweek: [1, 2, 3, 4, 5], holidays: [] },
  team: [],
  milestones: [
    { id: 'm1', title: 'Gamma' },
    { id: 'm2', title: 'Alpha' },
    { id: 'm3', title: 'Beta' },
  ],
  tasks: [],
});

describe('CoursePMApp milestones collapse ordering', () => {
  const renderApp = () =>
    render(
      <CoursePMApp
        boot={createBootState()}
        onBack={() => {}}
        onStateChange={() => {}}
        people={[]}
        milestoneTemplates={[]}
        onChangeMilestoneTemplates={() => {}}
        onOpenUser={() => {}}
      />
    );

  const getMilestoneTitles = (section) =>
    Array.from(section.querySelectorAll('details > summary .font-semibold'))
      .map((el) => el.textContent.trim())
      .filter(Boolean);

  it('preserves manual ordering when expanded and sorts alphabetically when collapsed', () => {
    renderApp();
    const heading = screen.getByRole('heading', { name: 'Milestones' });
    const section = heading.closest('section');
    expect(section).not.toBeNull();

    expect(getMilestoneTitles(section)).toEqual(['Gamma', 'Alpha', 'Beta']);

    const collapseButton = screen.getByRole('button', { name: /collapse milestones/i });
    fireEvent.click(collapseButton);

    expect(getMilestoneTitles(section)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});
