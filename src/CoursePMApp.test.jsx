import { render, screen, fireEvent, within } from '@testing-library/react';
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

const createBootStateWithTask = () => ({
  ...createBootState(),
  tasks: [
    {
      id: 'task-1',
      order: 0,
      title: 'Orientation Deck',
      details: '',
      note: '',
      links: [],
      blocks: [],
      depTaskId: null,
      assigneeIds: [],
      assigneeId: null,
      milestoneId: 'm2',
      status: 'todo',
      startDate: '',
      workDays: 0,
      dueDate: '',
      completedDate: '',
    },
  ],
});

const createBootStateWithExistingLink = () => ({
  ...createBootState(),
  tasks: [
    {
      id: 'task-1',
      order: 0,
      title: 'Orientation Deck',
      details: '',
      note: '',
      links: ['https://example.com/orientation'],
      blocks: [],
      depTaskId: null,
      assigneeIds: [],
      assigneeId: null,
      milestoneId: 'm2',
      status: 'todo',
      startDate: '',
      workDays: 0,
      dueDate: '',
      completedDate: '',
    },
  ],
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

  it('sorts milestones alphabetically regardless of collapse state', () => {
    renderApp();
    const heading = screen.getByRole('heading', { name: 'Milestones' });
    const section = heading.closest('section');
    expect(section).not.toBeNull();

    expect(getMilestoneTitles(section)).toEqual(['Alpha', 'Beta', 'Gamma']);

    const collapseButton = screen.getByRole('button', { name: /collapse milestones/i });
    fireEvent.click(collapseButton);

    expect(getMilestoneTitles(section)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

describe('CoursePMApp task documents', () => {
  it('adds new task links to the course link library with task context', async () => {
    render(
      <CoursePMApp
        boot={createBootStateWithTask()}
        onBack={() => {}}
        onStateChange={() => {}}
        people={[]}
        milestoneTemplates={[]}
        onChangeMilestoneTemplates={() => {}}
        onOpenUser={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /expand course tasks/i }));
    fireEvent.click(screen.getByRole('button', { name: /board/i }));

    const taskCard = await screen.findByTestId('task-card');
    const expandTaskButton = within(taskCard).getByTitle('Expand');
    fireEvent.click(expandTaskButton);

    const documentInput = within(taskCard).getByPlaceholderText('Paste link and press Enter');
    fireEvent.change(documentInput, { target: { value: 'example.com/resources' } });
    const addDocumentButton = within(taskCard).getByRole('button', { name: /add document/i });
    fireEvent.click(addDocumentButton);

    const expandLinkLibrary = screen.getByLabelText('Expand course link library');
    fireEvent.click(expandLinkLibrary);

    const link = await screen.findByRole('link', { name: 'Alpha' });
    expect(link).toHaveAttribute('href', 'https://example.com/resources');
  });

  it('populates the link library from existing task links on load', () => {
    render(
      <CoursePMApp
        boot={createBootStateWithExistingLink()}
        onBack={() => {}}
        onStateChange={() => {}}
        people={[]}
        milestoneTemplates={[]}
        onChangeMilestoneTemplates={() => {}}
        onOpenUser={() => {}}
      />
    );

    fireEvent.click(screen.getByLabelText('Expand course link library'));

    const link = screen.getByRole('link', { name: 'Alpha' });
    expect(link).toHaveAttribute('href', 'https://example.com/orientation');
  });

  it('allows pinning course links to keep them at the top', () => {
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

    const toggle = screen.getByLabelText('Expand course link library');
    fireEvent.click(toggle);
    const courseSection = toggle.closest('section');
    expect(courseSection).not.toBeNull();
    if (!courseSection) throw new Error('Course link library section not found');

    const labelInput = within(courseSection).getByLabelText('Label');
    const urlInput = within(courseSection).getByLabelText('URL');
    const addButton = within(courseSection).getByRole('button', { name: 'Add Link' });

    fireEvent.change(labelInput, { target: { value: 'First Link' } });
    fireEvent.change(urlInput, { target: { value: 'https://example.com/first' } });
    fireEvent.click(addButton);

    fireEvent.change(labelInput, { target: { value: 'Second Link' } });
    fireEvent.change(urlInput, { target: { value: 'https://example.com/second' } });
    fireEvent.click(addButton);

    let items = within(courseSection).getAllByRole('listitem');
    expect(within(items[0]).getByRole('link', { name: 'First Link' })).toBeInTheDocument();
    expect(within(items[1]).getByRole('link', { name: 'Second Link' })).toBeInTheDocument();

    const pinButton = within(items[1]).getByRole('button', { name: 'Pin link' });
    fireEvent.click(pinButton);

    items = within(courseSection).getAllByRole('listitem');
    expect(within(items[0]).getByRole('link', { name: 'Second Link' })).toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: 'Unpin link' })).toBeInTheDocument();
  });
});
