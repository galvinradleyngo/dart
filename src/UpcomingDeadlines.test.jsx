import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserDashboard, UPCOMING_DAYS } from './App.jsx';
import { fmt, todayStr } from './utils.js';

vi.mock('./firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  doc: vi.fn(),
  setDoc: vi.fn(),
}));

describe('Upcoming Deadlines window', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('formats today and due dates without relying on UTC conversions', () => {
    const originalToISOString = Date.prototype.toISOString;
    const sample = new Date(2024, 0, 1, 23, 45, 0);
    const expected = `${sample.getFullYear()}-${String(sample.getMonth() + 1).padStart(2, "0")}-${String(sample.getDate()).padStart(2, "0")}`;

    try {
      Date.prototype.toISOString = vi.fn(() => {
        throw new Error('toISOString should not be called');
      });
      vi.useFakeTimers();
      vi.setSystemTime(sample);

      expect(fmt(sample)).toBe(expected);
      expect(todayStr()).toBe(expected);
    } finally {
      vi.useRealTimers();
      Date.prototype.toISOString = originalToISOString;
    }
  });

  it('shows tasks due within the upcoming window', async () => {
    const today = new Date();
    // window spans today through UPCOMING_DAYS - 1
    const day14 = new Date();
    day14.setDate(today.getDate() + (UPCOMING_DAYS - 1));
    const day15 = new Date();
    day15.setDate(today.getDate() + UPCOMING_DAYS);

    const courses = [{
      course: { id: 'c1', name: 'Course 1' },
      milestones: [
        { id: 'm1', title: 'Milestone 1' },
        { id: 'm2', title: 'Milestone 2' },
      ],
      tasks: [
        { id: 't1', title: 'Today Task', status: 'todo', dueDate: fmt(today), assigneeId: 'u1', milestoneId: 'm1' },
        { id: 't2', title: 'Future Task', status: 'todo', dueDate: fmt(day14), assigneeId: 'u1', milestoneId: 'm2' },
        { id: 't4', title: 'Blocked Task', status: 'blocked', dueDate: fmt(day14), assigneeId: 'u1', milestoneId: 'm2' },
        { id: 't5', title: 'Skip Task', status: 'skip', dueDate: fmt(today), assigneeId: 'u1', milestoneId: 'm1' },
        { id: 't3', title: 'Outside Task', status: 'todo', dueDate: fmt(day15), assigneeId: 'u1', milestoneId: 'm1' },
      ],
      team: [{ id: 'u1', name: 'Alice', roleType: 'LD' }],
      schedule: {},
    }];

    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    render(<UserDashboard onOpenCourse={() => {}} onBack={() => {}} initialUserId="u1" />);

    const taskButton = await screen.findByRole('button', {
      name: 'Today Task for Milestone 1',
    });
    expect(taskButton).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Future Task for Milestone 2' })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Blocked Task for Milestone 2' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip Task for Milestone 1' })).toBeNull();
    expect(screen.queryByText('Outside Task')).toBeNull();

    fireEvent.click(taskButton);
    expect(await screen.findByText('Delete')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByLabelText('Close')).toBeNull());

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Today Task for Milestone 1',
    });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: 'Today Task for Milestone 1',
        })
      ).toBeNull()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Milestones' }));
    const courseSummary = await screen.findByText('Course 1');
    fireEvent.click(courseSummary.closest('summary') ?? courseSummary);
    const milestoneSummary = await screen.findByText('Milestone 1');
    fireEvent.click(milestoneSummary.closest('summary') ?? milestoneSummary);
    const skipBadge = await screen.findByText('Skipped');
    expect(skipBadge).toHaveClass('bg-pink-100/80');
  });

  it('lists overdue tasks before upcoming deadlines', async () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const courses = [
      {
        course: { id: 'c1', name: 'Course 1' },
        milestones: [{ id: 'm1', title: 'Milestone 1' }],
        tasks: [
          {
            id: 't-over',
            title: 'Overdue Task',
            status: 'todo',
            dueDate: fmt(yesterday),
            assigneeId: 'u1',
            milestoneId: 'm1',
          },
          {
            id: 't-up',
            title: 'Upcoming Task',
            status: 'todo',
            dueDate: fmt(tomorrow),
            assigneeId: 'u1',
            milestoneId: 'm1',
          },
        ],
        team: [{ id: 'u1', name: 'Alice', roleType: 'LD' }],
        schedule: {},
      },
    ];

    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    render(<UserDashboard onOpenCourse={() => {}} onBack={() => {}} initialUserId="u1" />);

    const upcomingHeader = await screen.findByText('Upcoming Deadlines');
    const upcomingSection = upcomingHeader.closest('section');
    expect(upcomingSection).not.toBeNull();
    const section = upcomingSection ?? document.createElement('section');

    expect(within(section).getByText('Overdue')).toBeInTheDocument();

    const taskButtons = within(section).getAllByRole('button', {
      name: /for Milestone 1/,
    });
    expect(taskButtons[0]).toHaveAccessibleName(/Overdue Task for Milestone 1/);
    expect(taskButtons[1]).toHaveAccessibleName(/Upcoming Task for Milestone 1/);
  });

  it('prompts for link when completing from deadlines panel', async () => {
    const today = new Date();
    const courses = [{
      course: { id: 'c1', name: 'Course 1' },
      milestones: [{ id: 'm1', title: 'Milestone 1' }],
      tasks: [
        { id: 't1', title: 'Task', status: 'todo', dueDate: fmt(today), assigneeId: 'u1', links: [], milestoneId: 'm1' },
      ],
      team: [{ id: 'u1', name: 'Alice', roleType: 'LD' }],
      schedule: {},
    }];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));
    render(<UserDashboard onOpenCourse={() => {}} onBack={() => {}} initialUserId="u1" />);
    const box = await screen.findByRole('checkbox', { name: 'Task for Milestone 1' });
    fireEvent.click(box);
    expect(await screen.findByText('Please provide a link to the output')).toBeInTheDocument();
    fireEvent.click(screen.getByText('No link'));
    expect(box).toBeChecked();
  });

  it('lists dashboard blocks and allows resolving them', async () => {
    const courses = [
      {
        course: { id: 'c1', name: 'Course 1' },
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
                reportedAt: '2024-01-02',
                reportedBy: 'u1',
                description: 'Need dataset',
                taggedMemberIds: ['u2'],
                resolvedAt: null,
                resolvedBy: null,
                resolution: '',
              },
              {
                id: 'b2',
                reportedAt: '2024-01-03',
                reportedBy: 'u2',
                description: 'Awaiting review',
                taggedMemberIds: ['u1'],
                resolvedAt: null,
                resolvedBy: null,
                resolution: '',
              },
              {
                id: 'b3',
                reportedAt: '2024-01-01',
                reportedBy: 'u1',
                description: 'Old block',
                taggedMemberIds: [],
                resolvedAt: '2024-01-04',
                resolvedBy: 'u1',
                resolution: 'Completed work',
              },
            ],
          },
        ],
        team: [
          { id: 'u1', name: 'Alice', roleType: 'PM' },
          { id: 'u2', name: 'Bob', roleType: 'LD' },
        ],
        schedule: {},
      },
    ];
    localStorage.setItem('healthPM:courses:v1', JSON.stringify(courses));

    render(<UserDashboard onOpenCourse={() => {}} onBack={() => {}} initialUserId="u1" />);

    const showBlocks = await screen.findByRole('button', { name: 'Show' });
    fireEvent.click(showBlocks);

    expect(await screen.findByText('Need dataset')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();

    const helpSection = screen.getByText('Blocks I Can Help Address').parentElement;
    const helpResolve = within(helpSection).getByRole('button', { name: 'Resolve' });
    fireEvent.click(helpResolve);

    const dialog = await screen.findByRole('dialog', { name: 'Resolve Block' });
    fireEvent.change(screen.getByLabelText('Resolution notes'), {
      target: { value: 'Provided feedback' },
    });
    fireEvent.change(screen.getByLabelText('Resolved by'), {
      target: { value: 'u1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve Block' }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    expect(screen.getByText('Need dataset')).toBeInTheDocument();
    expect(screen.getByText('No blocks are currently tagging you.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resolved (2)' }));
    expect(await screen.findByText('Provided feedback')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('healthPM:courses:v1'));
    const updated = stored[0].tasks[0].blocks.find((b) => b.id === 'b2');
    expect(updated.resolvedAt).toBeTruthy();
    expect(updated.resolution).toBe('Provided feedback');
  });
});
