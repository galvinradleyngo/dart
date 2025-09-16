import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserDashboard, UPCOMING_DAYS } from './App.jsx';
import { fmt } from './utils.js';

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
});
