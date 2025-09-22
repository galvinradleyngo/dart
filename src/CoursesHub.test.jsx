import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { CoursesHub } from './App.jsx';

vi.mock('./firebase.js', () => ({ db: {} }));
const addDoc = vi.fn().mockResolvedValue({ id: 'history-doc' });
const getDocs = vi.fn().mockResolvedValue({ forEach: () => {}, docs: [] });

vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(),
  doc: vi.fn(),
  collection: vi.fn(() => ({})),
  addDoc,
  getDocs,
  query: vi.fn((...args) => args),
  where: vi.fn((...args) => args),
  orderBy: vi.fn((...args) => args),
  limit: vi.fn((...args) => args),
  serverTimestamp: vi.fn(() => ({ server: true })),
  Timestamp: {
    fromMillis: (ms) => ({ toMillis: () => ms }),
  },
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

describe('CoursesHub undo functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    addDoc.mockClear();
    getDocs.mockClear();
  });

  const renderHub = () =>
    render(
      <CoursesHub
        onOpenCourse={() => {}}
        onEditTemplate={() => {}}
        onAddCourse={() => {}}
        onOpenUser={() => {}}
        people={[]}
        onPeopleChange={() => {}}
      />
    );

  it('restores course list after deleting and undoing', async () => {
    const courses = [
      { id: 'c1', course: { id: 'c1', name: 'Course 1', description: '' }, tasks: [], team: [], schedule: {} },
      { id: 'c2', course: { id: 'c2', name: 'Course 2', description: '' }, tasks: [], team: [], schedule: {} },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    renderHub();

    await screen.findByText('Course 1');
    await screen.findByText('Course 2');

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    expect(undoButton).toBeDisabled();

    const deleteButton = screen.getAllByRole('button', { name: /Delete course/i })[0];
    fireEvent.click(deleteButton);

    expect(screen.queryByText('Course 1')).toBeNull();
    expect(undoButton).not.toBeDisabled();

    fireEvent.click(undoButton);

    await screen.findByText('Course 1');
    expect(undoButton).toBeDisabled();
  });

  it('supports undoing up to ten steps', async () => {
    const courses = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i + 1}`,
      course: { id: `c${i + 1}`, name: `Course ${i + 1}`, description: '' },
      tasks: [],
      team: [],
      schedule: {},
    }));
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    renderHub();
    await screen.findByText('Course 1');

    const undoButton = screen.getByRole('button', { name: 'Undo' });

    for (let i = 0; i < 10; i++) {
      const del = screen.getAllByRole('button', { name: /Delete course/i })[0];
      fireEvent.click(del);
    }

    expect(screen.queryAllByRole('button', { name: 'Open' })).toHaveLength(0);
    expect(undoButton).not.toBeDisabled();

    for (let i = 0; i < 10; i++) {
      fireEvent.click(undoButton);
    }

    expect(await screen.findAllByRole('button', { name: 'Open' })).toHaveLength(10);
    expect(undoButton).toBeDisabled();
  });

  it('shows course blocks and resolves them', async () => {
    const courses = [
      {
        id: 'c1',
        course: { id: 'c1', name: 'Course 1', description: '' },
        milestones: [{ id: 'm1', title: 'Milestone 1' }],
        tasks: [
          {
            id: 't1',
            title: 'Task 1',
            status: 'blocked',
            milestoneId: 'm1',
            blocks: [
              {
                id: 'b1',
                reportedAt: '2024-01-01',
                reportedBy: 'u1',
                description: 'Need approval',
                taggedMemberIds: ['u2'],
                resolvedAt: null,
                resolvedBy: null,
                resolution: '',
              },
              {
                id: 'b2',
                reportedAt: '2024-01-02',
                reportedBy: 'u2',
                description: 'Resolved earlier',
                taggedMemberIds: [],
                resolvedAt: '2024-01-03',
                resolvedBy: 'u3',
                resolution: 'Shared reference deck',
              },
            ],
          },
        ],
        team: [
          { id: 'u1', name: 'Alice', roleType: 'PM' },
          { id: 'u2', name: 'Bob', roleType: 'LD' },
          { id: 'u3', name: 'Cara', roleType: 'SME' },
        ],
        schedule: {},
      },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    render(
      <CoursesHub
        onOpenCourse={() => {}}
        onEditTemplate={() => {}}
        onAddCourse={() => {}}
        onOpenUser={() => {}}
        people={courses[0].team}
        onPeopleChange={() => {}}
      />
    );

    await screen.findByText('Course 1');

    const toggle = screen.getByRole('button', { name: /Blocks/i });
    fireEvent.click(toggle);

    expect(await screen.findByText('Need approval')).toBeInTheDocument();
    expect(screen.getByText('Resolved earlier')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    const dialog = await screen.findByRole('dialog', { name: 'Resolve Block' });
    fireEvent.change(screen.getByLabelText('Resolution notes'), {
      target: { value: 'Approved by lead' },
    });
    fireEvent.change(screen.getByLabelText('Resolved by'), {
      target: { value: 'u2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve Block' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.queryByText('Need approval')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resolved (2)' }));
    expect(await screen.findByText('Approved by lead')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('healthPM:courses:v1'));
    const updated = stored[0].tasks[0].blocks.find((b) => b.id === 'b1');
    expect(updated.resolvedAt).toBeTruthy();
    expect(updated.resolution).toBe('Approved by lead');
  });

  it('restores a deleted course from version history without affecting others', async () => {
    const courses = [
      { id: 'c1', course: { id: 'c1', name: 'Course 1', description: 'Alpha' }, tasks: [], team: [], schedule: {} },
      { id: 'c2', course: { id: 'c2', name: 'Course 2', description: 'Beta' }, tasks: [], team: [], schedule: {} },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    renderHub();

    await screen.findByText('Course 1');
    await screen.findByText('Course 2');

    const deleteButton = screen.getAllByRole('button', { name: /Delete course/i })[0];
    fireEvent.click(deleteButton);

    expect(screen.queryByText('Course 1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Version history/i }));

    const retrieveButton = await screen.findByRole('button', { name: 'Retrieve' });
    fireEvent.click(retrieveButton);

    await waitFor(() => {
      expect(screen.getByText('Course 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Course 2')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Course version history/i })).not.toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('healthPM:courses:v1'));
    expect(stored.map((c) => c.course.name)).toEqual(['Course 1', 'Course 2']);
    expect(addDoc).toHaveBeenCalled();
  });
});

